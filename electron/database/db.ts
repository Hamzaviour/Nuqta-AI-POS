import initSqlJs, { Database as SqlJsDatabase, BindParams } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export class DatabaseWrapper {
  private db: SqlJsDatabase
  private dbPath: string

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db
    this.dbPath = dbPath
  }

  save(): void {
    try {
      const data = this.db.export()
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.dbPath, Buffer.from(data))
    } catch (err) {
      console.error('[DB] Save error:', err)
    }
  }

  exec(sql: string): void {
    this.db.run(sql)
    this.save()
  }

  run(sql: string, ...params: unknown[]): { changes: number } {
    return this.prepare(sql).run(...params)
  }

  pragma(sql: string): void {
    try {
      this.db.run(`PRAGMA ${sql};`)
    } catch {
      // Pragmas like journal_mode in memory are no-op in wasm
    }
  }

  close(): void {
    this.save()
    this.db.close()
  }

  prepare(sql: string) {
    const self = this
    return {
      get(...params: unknown[]) {
        const stmt = self.db.prepare(sql)
        const flatParams = params.length === 1 && Array.isArray(params[0])
          ? params[0]
          : (params.length === 1 && typeof params[0] === 'object' && params[0] !== null ? params[0] : params)
        stmt.bind(flatParams as BindParams)
        let row: Record<string, unknown> | null = null
        if (stmt.step()) {
          row = stmt.getAsObject()
        }
        stmt.free()
        return row
      },
      all(...params: unknown[]) {
        const stmt = self.db.prepare(sql)
        const flatParams = params.length === 1 && Array.isArray(params[0])
          ? params[0]
          : (params.length === 1 && typeof params[0] === 'object' && params[0] !== null ? params[0] : params)
        stmt.bind(flatParams as BindParams)
        const rows: Record<string, unknown>[] = []
        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
        stmt.free()
        return rows
      },
      run(...params: unknown[]) {
        const flatParams = params.length === 1 && Array.isArray(params[0])
          ? params[0]
          : (params.length === 1 && typeof params[0] === 'object' && params[0] !== null ? params[0] : params)
        self.db.run(sql, flatParams as BindParams)
        self.save()
        return { changes: 1 }
      }
    }
  }
}

let dbInstance: DatabaseWrapper | null = null

export function getDB(): DatabaseWrapper {
  if (!dbInstance) throw new Error('Database not initialized')
  return dbInstance
}

export async function initDatabase(): Promise<DatabaseWrapper> {
  const locateFile = (file: string) => {
    const devPath = path.join(app.getAppPath(), 'node_modules/sql.js/dist', file)
    if (fs.existsSync(devPath)) return devPath

    const resourcePath = path.join(process.resourcesPath || '', file)
    if (fs.existsSync(resourcePath)) return resourcePath

    const parentNodePath = path.join(__dirname, '../../node_modules/sql.js/dist', file)
    if (fs.existsSync(parentNodePath)) return parentNodePath

    return file
  }

  const SQL = await initSqlJs({ locateFile })
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'aldeewan-pos.db')

  console.log('[DB] Database path:', dbPath)

  let sqlDatabase: SqlJsDatabase
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    sqlDatabase = new SQL.Database(fileBuffer)
  } else {
    sqlDatabase = new SQL.Database()
  }

  dbInstance = new DatabaseWrapper(sqlDatabase, dbPath)

  // Run schema
  const schemaCandidates = [
    path.join(process.resourcesPath || '', 'electron/database/schema.sql'),
    path.join(process.resourcesPath || '', 'resources/electron/database/schema.sql'),
    path.join(process.resourcesPath || '', 'schema.sql'),
    path.join(__dirname, '../../electron/database/schema.sql'),
    path.join(app.getAppPath(), 'electron/database/schema.sql'),
    path.join(app.getAppPath(), 'out/database/schema.sql')
  ]

  let schemaSQL = ''
  for (const candidate of schemaCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf-8')
        if (content && content.trim().length > 0) {
          schemaSQL = content
          console.log('[DB] Loaded schema from:', candidate)
          break
        }
      } catch {}
    }
  }

  if (!schemaSQL) {
    console.log('[DB] Using inline SQLite schema fallback')
    schemaSQL = getInlineSchema()
  }

  dbInstance.exec(schemaSQL)

  // Comprehensive Auto-Migrations for users table permissions & columns
  const userMigrations = [
    { col: 'perm_view_cost_price', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_view_profit', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_apply_discount', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_discount_limit', type: 'REAL NOT NULL DEFAULT 10.0' },
    { col: 'perm_edit_price', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_void_invoice', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_edit_invoice', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_process_return', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_add_edit_stock', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_record_purchase', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_view_accounts', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_view_all_reports', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_manual_stock_adjust', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_pos', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_orders', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_sales', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_barcode', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_customers', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'perm_open_cash_drawer', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_day_closing', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_access_maintenance', type: 'INTEGER NOT NULL DEFAULT 0' },
    { col: 'perm_manage_users', type: 'INTEGER NOT NULL DEFAULT 0' }
  ]

  for (const m of userMigrations) {
    try {
      dbInstance.prepare(`ALTER TABLE users ADD COLUMN ${m.col} ${m.type}`).run()
    } catch {}
  }

  // Auto-Migrations for items table
  const itemMigrations = [
    { col: 'created_by', type: 'TEXT' },
    { col: 'created_at', type: "TEXT DEFAULT (datetime('now','localtime'))" },
    { col: 'updated_at', type: "TEXT DEFAULT (datetime('now','localtime'))" },
    { col: 'size_variant', type: 'TEXT' },
    { col: 'barcode', type: 'TEXT' },
    { col: 'supplier_id', type: 'TEXT REFERENCES suppliers(id)' },
    { col: 'brand_id', type: 'TEXT REFERENCES brands(id)' },
    { col: 'category_id', type: 'TEXT REFERENCES categories(id)' },
    { col: 'reorder_level', type: 'REAL NOT NULL DEFAULT 0' },
    { col: 'is_active', type: 'INTEGER NOT NULL DEFAULT 1' },
    { col: 'cost_price', type: 'REAL NOT NULL DEFAULT 0' },
    { col: 'retail_price', type: 'REAL NOT NULL DEFAULT 0' },
    { col: 'quantity_on_hand', type: 'REAL NOT NULL DEFAULT 0' }
  ]
  for (const m of itemMigrations) {
    try { dbInstance.prepare(`ALTER TABLE items ADD COLUMN ${m.col} ${m.type}`).run() } catch {}
  }

  // Auto-Migrations for suppliers & customers
  const supplierMigrations = [
    { col: 'balance', type: 'REAL NOT NULL DEFAULT 0' },
    { col: 'contact', type: 'TEXT' },
    { col: 'address', type: 'TEXT' },
    { col: 'notes', type: 'TEXT' },
    { col: 'created_by', type: 'TEXT' },
    { col: 'created_at', type: "TEXT DEFAULT (datetime('now','localtime'))" }
  ]
  for (const m of supplierMigrations) {
    try { dbInstance.prepare(`ALTER TABLE suppliers ADD COLUMN ${m.col} ${m.type}`).run() } catch {}
  }

  const customerMigrations = [
    { col: 'balance', type: 'REAL NOT NULL DEFAULT 0' },
    { col: 'phone', type: 'TEXT' },
    { col: 'whatsapp', type: 'TEXT' },
    { col: 'address', type: 'TEXT' },
    { col: 'type', type: "TEXT NOT NULL DEFAULT 'walkin'" },
    { col: 'notes', type: 'TEXT' },
    { col: 'created_by', type: 'TEXT' },
    { col: 'created_at', type: "TEXT DEFAULT (datetime('now','localtime'))" }
  ]
  for (const m of customerMigrations) {
    try { dbInstance.prepare(`ALTER TABLE customers ADD COLUMN ${m.col} ${m.type}`).run() } catch {}
  }

  // Auto-correct any negative stock quantities to 0 & set defaults
  try { dbInstance.prepare('UPDATE items SET quantity_on_hand = 0 WHERE quantity_on_hand < 0').run() } catch {}
  try { dbInstance.prepare('UPDATE items SET is_active = 1 WHERE is_active IS NULL').run() } catch {}
  try { dbInstance.prepare("UPDATE items SET created_by = 'usr-owner' WHERE created_by IS NULL").run() } catch {}

  // Expenses table migration & seed accounts
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        expense_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL DEFAULT (date('now','localtime')),
        datetime_created TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        category TEXT NOT NULL,
        account_id TEXT REFERENCES accounts(id),
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','bank')),
        payee TEXT,
        description TEXT NOT NULL,
        reference TEXT,
        staff_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

      INSERT OR IGNORE INTO accounts VALUES
        ('acc-tea',      '6004', 'Tea & Refreshments',   'expense',  0, 1, datetime('now','localtime')),
        ('acc-delivery', '6005', 'Delivery & Freight',   'expense',  0, 1, datetime('now','localtime')),
        ('acc-maint',    '6006', 'Shop Maintenance',     'expense',  0, 1, datetime('now','localtime')),
        ('acc-misc-exp', '6007', 'General Expenses',     'expense',  0, 1, datetime('now','localtime'));
    `)
  } catch {}

  // Invoices table migration to allow 'refunded' status
  try {
    const invTableSql = (dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'").get() as {sql?: string})?.sql || ''
    if (invTableSql && !invTableSql.includes('refunded')) {
      dbInstance.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS invoices_new (
          id              TEXT PRIMARY KEY,
          invoice_number  TEXT UNIQUE NOT NULL,
          date            TEXT NOT NULL DEFAULT (date('now','localtime')),
          datetime_created TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          customer_id     TEXT REFERENCES customers(id),
          source          TEXT NOT NULL DEFAULT 'instore' CHECK(source IN ('instore','whatsapp','socialmedia','other')),
          status          TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','confirmed','dispatched','completed','voided','parked','refunded')),
          subtotal        REAL NOT NULL DEFAULT 0,
          discount_amount REAL NOT NULL DEFAULT 0,
          grand_total     REAL NOT NULL DEFAULT 0,
          amount_paid     REAL NOT NULL DEFAULT 0,
          balance_due     REAL NOT NULL DEFAULT 0,
          cost_total      REAL NOT NULL DEFAULT 0,
          profit          REAL NOT NULL DEFAULT 0,
          payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','bank','split','credit')),
          staff_id        TEXT NOT NULL REFERENCES users(id),
          void_reason     TEXT,
          voided_by       TEXT REFERENCES users(id),
          voided_at       TEXT,
          notes           TEXT,
          online_customer_contact TEXT,
          tracking_number TEXT,
          is_locked       INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO invoices_new SELECT * FROM invoices;
        DROP TABLE invoices;
        ALTER TABLE invoices_new RENAME TO invoices;
        PRAGMA foreign_keys = ON;
      `)
    }
  } catch (err) {
    console.warn('[DB Migration] Invoices refunded check migration note:', err)
  }

  // Purchases table migration for payment_source & status consistency
  try {
    const pCols = (dbInstance.prepare("PRAGMA table_info(purchases)").all() as { name: string }[]).map(c => c.name)
    if (!pCols.includes('payment_source')) {
      dbInstance.exec("ALTER TABLE purchases ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'drawer'")
    }
    // Auto-correct any existing purchase status mismatches
    dbInstance.exec(`
      UPDATE purchases SET payment_status = 'unpaid' WHERE balance_due > 0 AND (amount_paid IS NULL OR amount_paid = 0);
      UPDATE purchases SET payment_status = 'partial' WHERE balance_due > 0 AND amount_paid > 0;
      UPDATE purchases SET payment_status = 'paid' WHERE balance_due <= 0;
    `)
  } catch (err) {
    try {
      dbInstance.exec("ALTER TABLE purchases ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'drawer'")
    } catch {}
  }

  // Seed default owner if no users exist
  seedDefaultUsers(dbInstance)

  console.log('[DB] Database initialized successfully with sql.js')
  return dbInstance
}

function getInlineSchema(): string {
  return `
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      username    TEXT UNIQUE NOT NULL,
      pin_hash    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('owner','manager','salesperson')),
      is_active   INTEGER NOT NULL DEFAULT 1,
      perm_view_cost_price          INTEGER NOT NULL DEFAULT 0,
      perm_view_profit              INTEGER NOT NULL DEFAULT 0,
      perm_apply_discount           INTEGER NOT NULL DEFAULT 1,
      perm_discount_limit           REAL    NOT NULL DEFAULT 10.0,
      perm_edit_price               INTEGER NOT NULL DEFAULT 1,
      perm_void_invoice             INTEGER NOT NULL DEFAULT 0,
      perm_edit_invoice             INTEGER NOT NULL DEFAULT 0,
      perm_process_return           INTEGER NOT NULL DEFAULT 0,
      perm_add_edit_stock           INTEGER NOT NULL DEFAULT 0,
      perm_record_purchase          INTEGER NOT NULL DEFAULT 0,
      perm_view_accounts            INTEGER NOT NULL DEFAULT 0,
      perm_view_all_reports         INTEGER NOT NULL DEFAULT 0,
      perm_manual_stock_adjust      INTEGER NOT NULL DEFAULT 0,
      perm_pos                      INTEGER NOT NULL DEFAULT 1,
      perm_orders                   INTEGER NOT NULL DEFAULT 1,
      perm_sales                    INTEGER NOT NULL DEFAULT 1,
      perm_barcode                  INTEGER NOT NULL DEFAULT 1,
      perm_customers                INTEGER NOT NULL DEFAULT 1,
      perm_open_cash_drawer         INTEGER NOT NULL DEFAULT 0,
      perm_day_closing              INTEGER NOT NULL DEFAULT 0,
      perm_access_maintenance       INTEGER NOT NULL DEFAULT 0,
      perm_manage_users             INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id   TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id   TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      contact     TEXT,
      address     TEXT,
      balance     REAL NOT NULL DEFAULT 0,
      notes       TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id                TEXT PRIMARY KEY,
      part_number       TEXT UNIQUE NOT NULL,
      barcode           TEXT UNIQUE,
      name              TEXT NOT NULL,
      brand_id          TEXT REFERENCES brands(id),
      category_id       TEXT REFERENCES categories(id),
      supplier_id       TEXT REFERENCES suppliers(id),
      size_variant      TEXT,
      cost_price        REAL NOT NULL DEFAULT 0,
      retail_price      REAL NOT NULL DEFAULT 0,
      quantity_on_hand  REAL NOT NULL DEFAULT 0,
      reorder_level     REAL NOT NULL DEFAULT 0,
      is_active         INTEGER NOT NULL DEFAULT 1,
      created_by        TEXT NOT NULL REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT,
      whatsapp    TEXT,
      address     TEXT,
      type        TEXT NOT NULL DEFAULT 'walkin' CHECK(type IN ('walkin','regular','online')),
      balance     REAL NOT NULL DEFAULT 0,
      notes       TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT UNIQUE NOT NULL,
      date            TEXT NOT NULL DEFAULT (date('now','localtime')),
      datetime_created TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      customer_id     TEXT REFERENCES customers(id),
      source          TEXT NOT NULL DEFAULT 'instore' CHECK(source IN ('instore','whatsapp','socialmedia','other')),
      status          TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','confirmed','dispatched','completed','voided','parked','refunded')),
      subtotal        REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      grand_total     REAL NOT NULL DEFAULT 0,
      amount_paid     REAL NOT NULL DEFAULT 0,
      balance_due     REAL NOT NULL DEFAULT 0,
      cost_total      REAL NOT NULL DEFAULT 0,
      profit          REAL NOT NULL DEFAULT 0,
      payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','bank','split','credit')),
      staff_id        TEXT NOT NULL REFERENCES users(id),
      void_reason     TEXT,
      voided_by       TEXT REFERENCES users(id),
      voided_at       TEXT,
      notes           TEXT,
      online_customer_contact TEXT,
      tracking_number TEXT,
      is_locked       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          TEXT PRIMARY KEY,
      invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_id     TEXT NOT NULL REFERENCES items(id),
      qty         REAL NOT NULL DEFAULT 1,
      unit_price  REAL NOT NULL,
      cost_price  REAL NOT NULL,
      discount_pct REAL NOT NULL DEFAULT 0,
      line_total  REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id              TEXT PRIMARY KEY,
      return_number   TEXT UNIQUE NOT NULL,
      invoice_id      TEXT REFERENCES invoices(id),
      date            TEXT NOT NULL DEFAULT (date('now','localtime')),
      reason          TEXT NOT NULL,
      refund_method   TEXT NOT NULL DEFAULT 'cash' CHECK(refund_method IN ('cash','bank','storecredit')),
      refund_amount   REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      processed_by    TEXT NOT NULL REFERENCES users(id),
      approved_by     TEXT REFERENCES users(id),
      approved_at     TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id          TEXT PRIMARY KEY,
      return_id   TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      item_id     TEXT NOT NULL REFERENCES items(id),
      qty         REAL NOT NULL DEFAULT 1,
      unit_price  REAL NOT NULL,
      line_total  REAL NOT NULL,
      restocked   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id              TEXT PRIMARY KEY,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_id     TEXT REFERENCES suppliers(id),
      date            TEXT NOT NULL DEFAULT (date('now','localtime')),
      invoice_ref     TEXT,
      total_cost      REAL NOT NULL DEFAULT 0,
      amount_paid     REAL NOT NULL DEFAULT 0,
      balance_due     REAL NOT NULL DEFAULT 0,
      payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('paid','partial','unpaid')),
      payment_source  TEXT NOT NULL DEFAULT 'drawer',
      notes           TEXT,
      created_by      TEXT NOT NULL REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id          TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      item_id     TEXT NOT NULL REFERENCES items(id),
      qty         REAL NOT NULL DEFAULT 1,
      cost_price  REAL NOT NULL,
      line_total  REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id          TEXT PRIMARY KEY,
      item_id     TEXT NOT NULL REFERENCES items(id),
      type        TEXT NOT NULL CHECK(type IN ('purchase','sale','return_in','adjustment','opening')),
      qty_change  REAL NOT NULL,
      qty_after   REAL NOT NULL,
      reference   TEXT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      date        TEXT NOT NULL DEFAULT (date('now','localtime')),
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT PRIMARY KEY,
      account_code  TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
      balance       REAL NOT NULL DEFAULT 0,
      is_system     INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id          TEXT PRIMARY KEY,
      entry_number TEXT UNIQUE NOT NULL,
      date        TEXT NOT NULL DEFAULT (date('now','localtime')),
      description TEXT NOT NULL,
      reference   TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id          TEXT PRIMARY KEY,
      entry_id    TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      debit       REAL NOT NULL DEFAULT 0,
      credit      REAL NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS payments_received (
      id          TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      date        TEXT NOT NULL DEFAULT (date('now','localtime')),
      amount      REAL NOT NULL,
      method      TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','card','bank')),
      reference   TEXT,
      notes       TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS payments_to_suppliers (
      id          TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      date        TEXT NOT NULL DEFAULT (date('now','localtime')),
      amount      REAL NOT NULL,
      method      TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','card','bank')),
      reference   TEXT,
      notes       TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id                TEXT PRIMARY KEY,
      expense_number    TEXT UNIQUE NOT NULL,
      date              TEXT NOT NULL DEFAULT (date('now','localtime')),
      datetime_created  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      category          TEXT NOT NULL,
      account_id        TEXT REFERENCES accounts(id),
      amount            REAL NOT NULL,
      payment_method    TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','bank')),
      payee             TEXT,
      description       TEXT NOT NULL,
      reference         TEXT,
      staff_id          TEXT NOT NULL REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS day_closes (
      id              TEXT PRIMARY KEY,
      date            TEXT UNIQUE NOT NULL,
      total_sales     REAL NOT NULL DEFAULT 0,
      total_discounts REAL NOT NULL DEFAULT 0,
      total_returns   REAL NOT NULL DEFAULT 0,
      total_profit    REAL NOT NULL DEFAULT 0,
      cash_sales      REAL NOT NULL DEFAULT 0,
      card_sales      REAL NOT NULL DEFAULT 0,
      bank_sales      REAL NOT NULL DEFAULT 0,
      expected_cash   REAL NOT NULL DEFAULT 0,
      counted_cash    REAL NOT NULL DEFAULT 0,
      variance        REAL NOT NULL DEFAULT 0,
      staff_breakdown TEXT,
      notes           TEXT,
      signed_by       TEXT NOT NULL REFERENCES users(id),
      signed_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id),
      action    TEXT NOT NULL,
      entity    TEXT NOT NULL,
      entity_id TEXT,
      details   TEXT,
      ip_addr   TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS parked_sales (
      id          TEXT PRIMARY KEY,
      label       TEXT,
      cart_data   TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id),
      staff_id    TEXT NOT NULL REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_items_part_number  ON items(part_number);
    CREATE INDEX IF NOT EXISTS idx_items_barcode       ON items(barcode);
    CREATE INDEX IF NOT EXISTS idx_items_name          ON items(name);
    CREATE INDEX IF NOT EXISTS idx_invoices_date       ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoices_staff      ON invoices(staff_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_stock_tx_item       ON stock_transactions(item_id);
    CREATE INDEX IF NOT EXISTS idx_stock_tx_date       ON stock_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_log(entity, entity_id);

    INSERT OR IGNORE INTO accounts VALUES
      ('acc-cash',     '1001', 'Cash in Hand',        'asset',    0, 1, datetime('now','localtime')),
      ('acc-bank',     '1002', 'Bank Account',         'asset',    0, 1, datetime('now','localtime')),
      ('acc-stock',    '1003', 'Stock / Inventory',    'asset',    0, 1, datetime('now','localtime')),
      ('acc-ar',       '1004', 'Accounts Receivable',  'asset',    0, 1, datetime('now','localtime')),
      ('acc-ap',       '2001', 'Accounts Payable',     'liability',0, 1, datetime('now','localtime')),
      ('acc-sales',    '4001', 'Sales Revenue',        'income',   0, 1, datetime('now','localtime')),
      ('acc-cogs',     '5001', 'Cost of Goods Sold',   'expense',  0, 1, datetime('now','localtime')),
      ('acc-discount', '5002', 'Discounts Given',      'expense',  0, 1, datetime('now','localtime')),
      ('acc-rent',     '6001', 'Rent',                 'expense',  0, 1, datetime('now','localtime')),
      ('acc-salary',   '6002', 'Salaries',             'expense',  0, 1, datetime('now','localtime')),
      ('acc-utility',  '6003', 'Utilities',            'expense',  0, 1, datetime('now','localtime')),
      ('acc-tea',      '6004', 'Tea & Refreshments',   'expense',  0, 1, datetime('now','localtime')),
      ('acc-delivery', '6005', 'Delivery & Freight',   'expense',  0, 1, datetime('now','localtime')),
      ('acc-maint',    '6006', 'Shop Maintenance',     'expense',  0, 1, datetime('now','localtime')),
      ('acc-misc-exp', '6007', 'General Expenses',     'expense',  0, 1, datetime('now','localtime'));

    INSERT OR IGNORE INTO settings VALUES
      ('company_name',       'Al-Deewan Brand'),
      ('company_address',    'Lahore, Pakistan'),
      ('company_phone',      ''),
      ('currency',           'PKR'),
      ('currency_symbol',    'Rs.'),
      ('receipt_footer',     'Thank you for shopping at Al-Deewan Brand!'),
      ('tax_rate',           '0'),
      ('receipt_printer',    '80mm'),
      ('discount_limit_sp',  '10'),
      ('discount_limit_mgr', '20'),
      ('invoice_prefix',     'AD'),
      ('purchase_prefix',    'PO'),
      ('return_prefix',      'RET'),
      ('db_version',         '1');
  `
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin + 'aldeewan-salt-2024').digest('hex')
}

function seedDefaultUsers(database: DatabaseWrapper): void {
  const count = (database.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | null)?.c || 0
  if (count > 0) return

  console.log('[DB] Seeding default users...')

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  // Default Owner: PIN 1234
  database.prepare(`
    INSERT INTO users (
      id, name, username, pin_hash, role,
      perm_view_cost_price, perm_view_profit, perm_apply_discount, perm_discount_limit,
      perm_void_invoice, perm_edit_invoice, perm_process_return, perm_add_edit_stock,
      perm_record_purchase, perm_view_accounts, perm_view_all_reports,
      perm_manual_stock_adjust, perm_open_cash_drawer, perm_day_closing,
      perm_access_maintenance, perm_manage_users, created_at, updated_at
    ) VALUES (
      ?, 'Owner', 'owner', ?, 'owner',
      1, 1, 1, 100,
      1, 1, 1, 1,
      1, 1, 1,
      1, 1, 1,
      1, 1, ?, ?
    )
  `).run(uuidv4(), hashPin('1234'), now, now)

  // Default Manager: PIN 2345
  database.prepare(`
    INSERT INTO users (
      id, name, username, pin_hash, role,
      perm_view_cost_price, perm_view_profit, perm_apply_discount, perm_discount_limit,
      perm_void_invoice, perm_edit_invoice, perm_process_return, perm_add_edit_stock,
      perm_record_purchase, perm_view_accounts, perm_view_all_reports,
      perm_manual_stock_adjust, perm_open_cash_drawer, perm_day_closing,
      perm_access_maintenance, perm_manage_users, created_at, updated_at
    ) VALUES (
      ?, 'Manager', 'manager', ?, 'manager',
      1, 1, 1, 20,
      1, 1, 1, 1,
      1, 1, 1,
      0, 0, 0,
      0, 0, ?, ?
    )
  `).run(uuidv4(), hashPin('2345'), now, now)

  // Default Salesperson 1: Hassan, PIN 3456
  database.prepare(`
    INSERT INTO users (
      id, name, username, pin_hash, role,
      perm_view_cost_price, perm_view_profit, perm_apply_discount, perm_discount_limit,
      perm_void_invoice, perm_edit_invoice, perm_process_return, perm_add_edit_stock,
      perm_record_purchase, perm_view_accounts, perm_view_all_reports,
      perm_manual_stock_adjust, perm_open_cash_drawer, perm_day_closing,
      perm_access_maintenance, perm_manage_users, created_at, updated_at
    ) VALUES (
      ?, 'Hassan', 'hassan', ?, 'salesperson',
      0, 0, 1, 10,
      0, 0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, ?, ?
    )
  `).run(uuidv4(), hashPin('3456'), now, now)

  // Default Salesperson 2: Ali, PIN 4567
  database.prepare(`
    INSERT INTO users (
      id, name, username, pin_hash, role,
      perm_view_cost_price, perm_view_profit, perm_apply_discount, perm_discount_limit,
      perm_void_invoice, perm_edit_invoice, perm_process_return, perm_add_edit_stock,
      perm_record_purchase, perm_view_accounts, perm_view_all_reports,
      perm_manual_stock_adjust, perm_open_cash_drawer, perm_day_closing,
      perm_access_maintenance, perm_manage_users, created_at, updated_at
    ) VALUES (
      ?, 'Ali', 'ali', ?, 'salesperson',
      0, 0, 1, 10,
      0, 0, 0, 0,
      0, 0, 0,
      0, 0, 0,
      0, 0, ?, ?
    )
  `).run(uuidv4(), hashPin('4567'), now, now)

  // Default walk-in customer
  database.prepare(`
    INSERT INTO customers (id, name, phone, type, balance, created_by, created_at)
    VALUES (?, 'Cash Customer (Walk-in)', '', 'walkin', 0, (SELECT id FROM users WHERE role='owner' LIMIT 1), ?)
  `).run(uuidv4(), now)

  // Sample brands
  const brands = ['Al-Deewan', 'Alkaram', 'Safa Noor', 'Sapphire', 'Gul Ahmed', 'Khaadi', 'Lakhani', 'Bonanza']
  for (const brand of brands) {
    database.prepare('INSERT OR IGNORE INTO brands (id, name) VALUES (?, ?)').run(uuidv4(), brand)
  }

  // Sample categories
  const categories = ['2-Piece Suit', '3-Piece Suit', 'Kurta', 'Shalwar', 'Fabric', 'Dupatta', 'Accessories']
  for (const cat of categories) {
    database.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(uuidv4(), cat)
  }

  console.log('[DB] Default users seeded. Owner PIN: 1234, Manager PIN: 2345, Hassan PIN: 3456, Ali PIN: 4567')
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// ---------------------------------------------------------------
// AUTH QUERIES
// ---------------------------------------------------------------
export function verifyLogin(username: string, pin: string): User | null {
  const pinHash = hashPin(pin)
  const user = getDB().prepare(`
    SELECT * FROM users WHERE username = ? AND pin_hash = ? AND is_active = 1
  `).get(username, pinHash) as unknown as User | undefined
  return user || null
}

export function getUserById(id: string): User | null {
  return (getDB().prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as User | undefined) || null
}

export function getAllUsers(): User[] {
  return getDB().prepare('SELECT * FROM users ORDER BY name').all() as unknown as User[]
}

export function createUser(data: CreateUserInput): User {
  const id = uuidv4()
  const pinHash = hashPin(data.pin)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  getDB().prepare(`
    INSERT INTO users (
      id, name, username, pin_hash, role,
      perm_view_cost_price, perm_view_profit, perm_apply_discount, perm_discount_limit,
      perm_void_invoice, perm_edit_invoice, perm_process_return, perm_add_edit_stock,
      perm_record_purchase, perm_view_accounts, perm_view_all_reports,
      perm_manual_stock_adjust, perm_open_cash_drawer, perm_day_closing,
      perm_access_maintenance, perm_manage_users, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    id, data.name, data.username, pinHash, data.role,
    data.perm_view_cost_price ? 1 : 0,
    data.perm_view_profit ? 1 : 0,
    data.perm_apply_discount ? 1 : 0,
    data.perm_discount_limit || getDefaultDiscountLimit(data.role),
    data.perm_void_invoice ? 1 : 0,
    data.perm_edit_invoice ? 1 : 0,
    data.perm_process_return ? 1 : 0,
    data.perm_add_edit_stock ? 1 : 0,
    data.perm_record_purchase ? 1 : 0,
    data.perm_view_accounts ? 1 : 0,
    data.perm_view_all_reports ? 1 : 0,
    data.perm_manual_stock_adjust ? 1 : 0,
    data.perm_open_cash_drawer ? 1 : 0,
    data.perm_day_closing ? 1 : 0,
    data.perm_access_maintenance ? 1 : 0,
    data.perm_manage_users ? 1 : 0,
    now, now
  )

  return getUserById(id)!
}

export function updateUser(id: string, data: { name?: string; username?: string; role?: string }): User {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const fields = Object.entries(data).filter(([_, v]) => v !== undefined).map(([k]) => `${k} = ?`).join(', ')
  const values = Object.entries(data).filter(([_, v]) => v !== undefined).map(([_, v]) => v)
  if (values.length > 0) {
    getDB().prepare(`UPDATE users SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  }
  return getUserById(id)!
}

export function updateUserPermissions(id: string, perms: Partial<UserPermissions>): void {
  const db = getDB()
  // Ensure all columns exist before updating to avoid "no such column" errors
  for (const key of Object.keys(perms)) {
    try {
      db.prepare(`ALTER TABLE users ADD COLUMN ${key} INTEGER NOT NULL DEFAULT 1`).run()
    } catch {
      // Column already exists, ignore error
    }
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const fields = Object.entries(perms)
    .map(([k]) => `${k} = ?`)
    .join(', ')
  const values = Object.values(perms)
  db.prepare(`UPDATE users SET ${fields}, updated_at = ? WHERE id = ?`)
    .run(...values, now, id)
}

export function resetUserPin(id: string, newPin: string): void {
  const pinHash = hashPin(newPin)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  getDB().prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?').run(pinHash, now, id)
}

export function toggleUserActive(id: string, isActive: boolean): void {
  getDB().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id)
}

export function deleteUser(id: string): void {
  getDB().prepare('DELETE FROM users WHERE id = ?').run(id)
}

function getDefaultDiscountLimit(role: string): number {
  switch (role) {
    case 'owner': return 100
    case 'manager': return 20
    default: return 10
  }
}

// ---------------------------------------------------------------
// ITEM QUERIES
// ---------------------------------------------------------------
export function searchItems(query: string): ItemSearchResult[] {
  const trimmed = query.trim()
  const q = `%${trimmed}%`
  return getDB().prepare(`
    SELECT i.*, b.name as brand_name, c.name as category_name, s.name as supplier_name
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE COALESCE(i.is_active, 1) != 0 AND (
      i.name LIKE ?
      OR i.part_number LIKE ?
      OR i.barcode LIKE ?
      OR b.name LIKE ?
      OR s.name LIKE ?
      OR c.name LIKE ?
      OR i.size_variant LIKE ?
    )
    ORDER BY i.name
    LIMIT 300
  `).all(q, q, q, q, q, q, q) as unknown as ItemSearchResult[]
}

export function getItemByBarcode(barcode: string): ItemSearchResult | null {
  return (getDB().prepare(`
    SELECT i.*, b.name as brand_name, c.name as category_name, s.name as supplier_name
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE i.barcode = ? AND COALESCE(i.is_active, 1) != 0
  `).get(barcode) as unknown as ItemSearchResult | undefined) || null
}

export function getAllItems(): ItemSearchResult[] {
  return getDB().prepare(`
    SELECT i.*, b.name as brand_name, c.name as category_name, s.name as supplier_name
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE COALESCE(i.is_active, 1) != 0
    ORDER BY i.name
  `).all() as unknown as ItemSearchResult[]
}

export function getItemById(id: string): ItemSearchResult | null {
  return (getDB().prepare(`
    SELECT i.*, b.name as brand_name, c.name as category_name, s.name as supplier_name
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE i.id = ?
  `).get(id) as unknown as ItemSearchResult | undefined) || null
}

export function createItem(data: CreateItemInput, userId: string): Item {
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const qty = Number(data.quantity_on_hand) || 0
  const cost = Number(data.cost_price) || 0
  const shouldCreateInvoice = Boolean(data.create_stock_invoice && data.supplier_id && qty > 0)

  getDB().prepare(`
    INSERT INTO items (id, part_number, barcode, name, brand_id, category_id, supplier_id,
      size_variant, cost_price, retail_price, quantity_on_hand, reorder_level, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.part_number, data.barcode || null, data.name,
    data.brand_id || null, data.category_id || null, data.supplier_id || null, data.size_variant || null,
    cost, Number(data.retail_price) || 0, shouldCreateInvoice ? 0 : qty,
    Number(data.reorder_level) || 0, userId, now, now
  )

  if (qty > 0) {
    if (shouldCreateInvoice) {
      const totalCost = qty * cost
      const paid = data.amount_paid !== undefined ? Number(data.amount_paid) : (data.payment_status === 'unpaid' ? 0 : totalCost)
      const balance = Math.max(0, totalCost - paid)
      const status = data.payment_status || (balance === 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'))
      const source = data.payment_source || 'drawer'

      createPurchase({
        supplier_id: data.supplier_id,
        invoice_ref: data.invoice_ref || undefined,
        total_cost: totalCost,
        amount_paid: paid,
        balance_due: balance,
        payment_status: status,
        payment_source: source,
        notes: `Opening stock invoice for item: ${data.name} (${data.part_number})`,
        items: [{
          item_id: id,
          qty,
          cost_price: cost,
          line_total: totalCost
        }]
      }, userId)
    } else {
      recordStockTransaction({
        item_id: id,
        type: 'opening',
        qty_change: qty,
        qty_after: qty,
        reference: null,
        user_id: userId,
        notes: 'Opening stock'
      })
    }
  }

  return getItemById(id)! as unknown as Item
}

export function updateItem(id: string, data: Partial<CreateItemInput>): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const fields = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([k]) => `${k} = ?`)
    .join(', ')
  const values = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([, v]) => v)
  getDB().prepare(`UPDATE items SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, id)
}

// ---------------------------------------------------------------
// STOCK TRANSACTIONS
// ---------------------------------------------------------------
export function recordStockTransaction(data: {
  item_id: string
  type: string
  qty_change: number
  qty_after: number
  reference: string | null
  user_id: string
  notes?: string
}): void {
  getDB().prepare(`
    INSERT INTO stock_transactions (id, item_id, type, qty_change, qty_after, reference, user_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(uuidv4(), data.item_id, data.type, data.qty_change, data.qty_after, data.reference, data.user_id, data.notes || null)
}

export function getQuantityReport(): QuantityReportRow[] {
  return getDB().prepare(`
    SELECT i.part_number, i.name, i.size_variant,
           b.name as brand_name, c.name as category_name, s.name as supplier_name,
           i.quantity_on_hand, i.cost_price, i.retail_price,
           (i.quantity_on_hand * i.cost_price) as cost_value
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE i.is_active = 1
    ORDER BY b.name, i.name
  `).all() as unknown as QuantityReportRow[]
}

export function getTransactionHistory(itemId: string): StockTransaction[] {
  return getDB().prepare(`
    SELECT st.*, u.name as user_name
    FROM stock_transactions st
    LEFT JOIN users u ON st.user_id = u.id
    WHERE st.item_id = ?
    ORDER BY st.created_at DESC
  `).all(itemId) as unknown as StockTransaction[]
}

// ---------------------------------------------------------------
// INVOICES
// ---------------------------------------------------------------
export function generateInvoiceNumber(): string {
  const prefix = (getDB().prepare("SELECT value FROM settings WHERE key='invoice_prefix'").get() as {value:string} | null)?.value || 'AD'
  const count = ((getDB().prepare('SELECT COUNT(*) as c FROM invoices').get() as {c:number} | null)?.c || 0) + 1
  const date = new Date()
  const yymmdd = `${date.getFullYear().toString().slice(-2)}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`
  return `${prefix}-${yymmdd}-${String(count).padStart(4,'0')}`
}

export function createInvoice(data: CreateInvoiceInput, staffId: string): Invoice {
  const db2 = getDB()

  // 1. Strict Stock Availability Check (Prevent negative stock)
  for (const item of data.items) {
    const currentItem = db2.prepare('SELECT id, name, quantity_on_hand FROM items WHERE id = ?').get(item.item_id) as { id: string; name: string; quantity_on_hand: number } | undefined
    if (!currentItem) {
      throw new Error(`Product not found in database (ID: ${item.item_id})`)
    }
    const currentQty = currentItem.quantity_on_hand ?? 0
    if (currentQty < item.qty) {
      if (currentQty <= 0) {
        throw new Error(`Cannot complete sale: "${currentItem.name}" is OUT OF STOCK (0 on hand).`)
      } else {
        throw new Error(`Cannot sell ${item.qty} units of "${currentItem.name}". Only ${currentQty} available in stock.`)
      }
    }
  }

  const id = uuidv4()
  const invoiceNumber = generateInvoiceNumber()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const today = now.slice(0, 10)

  const defaultStatus = (data.source === 'whatsapp' || data.source === 'socialmedia') ? 'pending' : 'completed'
  const finalStatus = (data.balance_due && data.balance_due > 0) ? 'pending' : (data.status || defaultStatus)

  db2.prepare(`
    INSERT INTO invoices (
      id, invoice_number, date, datetime_created, customer_id, source, status,
      subtotal, discount_amount, grand_total, amount_paid, balance_due,
      cost_total, profit, payment_method, staff_id, notes, online_customer_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, invoiceNumber, today, now,
    data.customer_id || null,
    data.source || 'instore',
    finalStatus,
    data.subtotal, data.discount_amount, data.grand_total,
    data.amount_paid, data.balance_due,
    data.cost_total, data.profit,
    data.payment_method || 'cash',
    staffId,
    data.notes || null,
    data.online_customer_contact || null
  )

  for (const item of data.items) {
    const lineId = uuidv4()
    db2.prepare(`
      INSERT INTO invoice_items (id, invoice_id, item_id, qty, unit_price, cost_price, discount_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(lineId, id, item.item_id, item.qty, item.unit_price, item.cost_price, item.discount_pct, item.line_total)

    // Deduct stock safely
    const currentItem = db2.prepare('SELECT quantity_on_hand FROM items WHERE id = ?').get(item.item_id) as {quantity_on_hand: number}
    const newQty = Math.max(0, (currentItem?.quantity_on_hand || 0) - item.qty)
    db2.prepare('UPDATE items SET quantity_on_hand = ?, updated_at = ? WHERE id = ?').run(newQty, now, item.item_id)

    recordStockTransaction({
      item_id: item.item_id,
      type: 'sale',
      qty_change: -item.qty,
      qty_after: newQty,
      reference: id,
      user_id: staffId,
      notes: `Sale ${invoiceNumber}`
    })
  }

  // Update customer balance if credit sale
  if (data.balance_due > 0 && data.customer_id) {
    db2.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(data.balance_due, data.customer_id)
  }
  if (data.customer_id && data.amount_paid && data.amount_paid > 0) {
    try {
      const payId = uuidv4()
      const today = now.slice(0, 10)
      db2.prepare(`
        INSERT INTO payments_received (id, customer_id, date, amount, method, reference, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payId, data.customer_id, today, data.amount_paid,
        data.payment_method === 'bank' ? 'bank' : (data.payment_method === 'card' ? 'card' : 'cash'),
        invoiceNumber,
        `POS Payment at Sale #${invoiceNumber}`,
        staffId, now
      )
    } catch (e) {
      console.warn('[Create Invoice] Customer payment log note:', e)
    }
  }

  return getInvoiceById(id)!
}

export function getInvoiceById(id: string): Invoice | null {
  const inv = getDB().prepare(`
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded'
        ELSE inv.status
      END as status,
      c.name as customer_name,
      c.phone as customer_phone,
      c.whatsapp as customer_whatsapp,
      u.name as staff_name
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE inv.id = ?
  `).get(id) as unknown as Invoice | undefined

  if (!inv) return null

  const items = getDB().prepare(`
    SELECT ii.*, i.name as item_name, i.part_number
    FROM invoice_items ii
    LEFT JOIN items i ON ii.item_id = i.id
    WHERE ii.invoice_id = ?
  `).all(id) as unknown as InvoiceItem[]

  return { ...inv, items }
}

export function getPendingInvoices(search?: string): Invoice[] {
  // Sync invoices table with approved returns
  try {
    getDB().prepare(`
      UPDATE invoices
      SET status = 'refunded'
      WHERE id IN (SELECT DISTINCT invoice_id FROM returns WHERE invoice_id IS NOT NULL AND status = 'approved')
        AND status != 'refunded'
    `).run()
  } catch {}

  let sql = `
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded'
        ELSE inv.status
      END as status,
      c.name as customer_name,
      c.phone as customer_phone,
      c.whatsapp as customer_whatsapp,
      u.name as staff_name
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE (inv.status = 'pending' OR inv.balance_due > 0)
      AND inv.status != 'voided'
      AND inv.status != 'refunded'
      AND inv.status != 'parked'
  `
  const params: unknown[] = []

  if (search && search.trim()) {
    sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ? OR inv.online_customer_contact LIKE ?)'
    const q = `%${search.trim()}%`
    params.push(q, q, q, q, q)
  }

  sql += ' ORDER BY inv.datetime_created DESC'
  const invoices = getDB().prepare(sql).all(params) as unknown as Invoice[]

  // Attach items to each pending invoice
  return invoices.map(inv => {
    const items = getDB().prepare(`
      SELECT ii.*, i.name as item_name, i.part_number
      FROM invoice_items ii
      LEFT JOIN items i ON ii.item_id = i.id
      WHERE ii.invoice_id = ?
    `).all(inv.id) as unknown as InvoiceItem[]
    return { ...inv, items }
  })
}

export function getInvoicesByDate(date: string): Invoice[] {
  return getDB().prepare(`
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded'
        ELSE inv.status
      END as status,
      c.name as customer_name, c.phone as customer_phone, u.name as staff_name,
      (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = inv.id) as item_count
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE inv.date = ? AND inv.status != 'voided' AND inv.status != 'parked'
    ORDER BY inv.datetime_created DESC
  `).all(date) as unknown as Invoice[]
}

export function getInvoicesByDateRange(
  from: string,
  to: string,
  staffId?: string,
  source?: string,
  paymentMethod?: string,
  search?: string
): Invoice[] {
  // Sync invoices table with approved returns
  try {
    getDB().prepare(`
      UPDATE invoices
      SET status = 'refunded'
      WHERE id IN (SELECT DISTINCT invoice_id FROM returns WHERE invoice_id IS NOT NULL AND status = 'approved')
        AND status != 'refunded'
    `).run()
  } catch {}

  let sql = `
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded'
        ELSE inv.status
      END as status,
      c.name as customer_name, c.phone as customer_phone, u.name as staff_name,
      (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = inv.id) as item_count
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE inv.date BETWEEN ? AND ? AND inv.status != 'parked'
  `
  const params: unknown[] = [from, to]

  if (staffId && staffId !== 'all') {
    sql += ' AND inv.staff_id = ?'
    params.push(staffId)
  }
  if (source && source !== 'all') {
    sql += ' AND inv.source = ?'
    params.push(source)
  }
  if (paymentMethod && paymentMethod !== 'all') {
    if (paymentMethod === 'bank') {
      sql += " AND (inv.payment_method = 'bank' OR inv.payment_method LIKE '%bank%' OR inv.payment_method LIKE '%jazzcash%' OR inv.payment_method LIKE '%easypaisa%')"
    } else {
      sql += ' AND inv.payment_method = ?'
      params.push(paymentMethod)
    }
  }
  if (search && search.trim()) {
    sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR inv.online_customer_contact LIKE ?)'
    const q = `%${search.trim()}%`
    params.push(q, q, q, q)
  }

  sql += ' ORDER BY inv.datetime_created DESC'
  return getDB().prepare(sql).all(params) as unknown as Invoice[]
}

export function voidInvoice(id: string, reason: string, userId: string): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const inv = getInvoiceById(id)
  if (!inv) throw new Error('Invoice not found')
  if (inv.is_locked) throw new Error('Invoice is locked after day close. Contact owner.')

  const db2 = getDB()
  db2.prepare(`
    UPDATE invoices SET status = 'voided', void_reason = ?, voided_by = ?, voided_at = ? WHERE id = ?
  `).run(reason, userId, now, id)

  // Restore stock
  for (const item of (inv.items || [])) {
    const current = db2.prepare('SELECT quantity_on_hand FROM items WHERE id = ?').get(item.item_id) as {quantity_on_hand: number}
    const newQty = (current?.quantity_on_hand || 0) + item.qty
    db2.prepare('UPDATE items SET quantity_on_hand = ?, updated_at = ? WHERE id = ?').run(newQty, now, item.item_id)
    recordStockTransaction({
      item_id: item.item_id,
      type: 'return_in',
      qty_change: item.qty,
      qty_after: newQty,
      reference: id,
      user_id: userId,
      notes: `Void ${inv.invoice_number}`
    })
  }
}

export function updateInvoice(id: string, data: UpdateInvoiceInput, userId: string): Invoice {
  const db2 = getDB()
  const oldInv = getInvoiceById(id)
  if (!oldInv) throw new Error('Invoice not found')
  if (oldInv.status === 'voided') throw new Error('Cannot edit a voided invoice')
  if (oldInv.status === 'refunded') throw new Error('Cannot edit a refunded invoice')
  if (!data.items || data.items.length === 0) throw new Error('Invoice must contain at least one item')

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  // 1. Pre-validation of items before any state changes
  if (!data.items || data.items.length === 0) {
    throw new Error('Invoice must have at least one item')
  }
  for (const item of data.items) {
    if (!item.qty || item.qty <= 0) throw new Error('Item quantity must be greater than 0')
    const cur = db2.prepare('SELECT id, name, quantity_on_hand, cost_price, retail_price FROM items WHERE id = ?').get(item.item_id) as { id: string; name: string; quantity_on_hand: number; cost_price: number; retail_price: number } | undefined
    if (!cur) throw new Error(`Item ${item.item_id} not found`)
  }

  // 2. Revert previous item stock deductions
  for (const oldItem of (oldInv.items || [])) {
    const cur = db2.prepare('SELECT quantity_on_hand FROM items WHERE id = ?').get(oldItem.item_id) as { quantity_on_hand: number } | undefined
    if (cur) {
      const restoredQty = (cur.quantity_on_hand || 0) + oldItem.qty
      db2.prepare('UPDATE items SET quantity_on_hand = ?, updated_at = ? WHERE id = ?').run(restoredQty, now, oldItem.item_id)
      recordStockTransaction({
        item_id: oldItem.item_id,
        type: 'adjustment',
        qty_change: oldItem.qty,
        qty_after: restoredQty,
        reference: id,
        user_id: userId,
        notes: `Revert line for Edit Invoice ${oldInv.invoice_number}`
      })
    }
  }

  // 3. Apply new stock deductions & calculate financials
  let subtotal = 0
  let lineDiscounts = 0
  let costTotal = 0

  for (const item of data.items) {
    const cur = db2.prepare('SELECT id, name, quantity_on_hand, cost_price, retail_price FROM items WHERE id = ?').get(item.item_id) as { id: string; name: string; quantity_on_hand: number; cost_price: number; retail_price: number }
    // Deduct new qty from restored stock
    const newQtyOnHand = Math.max(0, cur.quantity_on_hand - item.qty)
    db2.prepare('UPDATE items SET quantity_on_hand = ?, updated_at = ? WHERE id = ?').run(newQtyOnHand, now, item.item_id)

    recordStockTransaction({
      item_id: item.item_id,
      type: 'adjustment',
      qty_change: -item.qty,
      qty_after: newQtyOnHand,
      reference: id,
      user_id: userId,
      notes: `Edit Invoice ${oldInv.invoice_number}`
    })

    const discPct = item.discount_pct || 0
    const lineGross = item.qty * item.unit_price
    const lineDisc = lineGross * (discPct / 100)
    subtotal += lineGross
    lineDiscounts += lineDisc
    costTotal += (item.qty * (item.cost_price || cur.cost_price || 0))
  }

  const invoiceDiscount = data.discount_amount || 0
  const totalDiscount = lineDiscounts + invoiceDiscount
  const grandTotal = Math.max(0, subtotal - totalDiscount)
  const profit = grandTotal - costTotal

  const amountPaid = data.amount_paid !== undefined ? Math.min(grandTotal, Math.max(0, Number(data.amount_paid))) : Math.min(grandTotal, oldInv.amount_paid)
  const balanceDue = Math.max(0, grandTotal - amountPaid)
  const newStatus = balanceDue > 0 ? 'pending' : 'completed'

  // 3. Customer balance adjustment if credit invoice
  const oldCustomerId = oldInv.customer_id
  const newCustomerId = data.customer_id !== undefined ? data.customer_id : oldCustomerId

  if (oldCustomerId && oldInv.balance_due > 0) {
    try {
      db2.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldInv.balance_due, oldCustomerId)
    } catch {}
  }
  if (newCustomerId && balanceDue > 0) {
    try {
      db2.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(balanceDue, newCustomerId)
    } catch {}
  }

  // 4. Update invoices table
  db2.prepare(`
    UPDATE invoices
    SET customer_id = ?,
        subtotal = ?,
        discount_amount = ?,
        grand_total = ?,
        amount_paid = ?,
        balance_due = ?,
        cost_total = ?,
        profit = ?,
        payment_method = ?,
        status = ?,
        notes = ?,
        online_customer_contact = ?
    WHERE id = ?
  `).run(
    newCustomerId || null,
    subtotal,
    totalDiscount,
    grandTotal,
    amountPaid,
    balanceDue,
    costTotal,
    profit,
    data.payment_method || oldInv.payment_method || 'cash',
    newStatus,
    data.notes !== undefined ? data.notes : oldInv.notes,
    data.online_customer_contact !== undefined ? data.online_customer_contact : oldInv.online_customer_contact,
    id
  )

  // 5. Delete old invoice items & insert new ones
  db2.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id)
  for (const item of data.items) {
    const lineId = uuidv4()
    const discPct = item.discount_pct || 0
    const lineTotal = Math.max(0, (item.qty * item.unit_price) - (item.qty * item.unit_price * (discPct / 100)))
    db2.prepare(`
      INSERT INTO invoice_items (id, invoice_id, item_id, qty, unit_price, cost_price, discount_pct, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(lineId, id, item.item_id, item.qty, item.unit_price, item.cost_price, discPct, lineTotal)
  }

  // 6. Log audit action
  try {
    logAction(userId, 'EDIT_INVOICE', 'invoices', id, {
      invoice_number: oldInv.invoice_number,
      old_grand_total: oldInv.grand_total,
      new_grand_total: grandTotal,
      old_items_count: oldInv.items?.length || 0,
      new_items_count: data.items.length
    })
  } catch {}

  return getInvoiceById(id)!
}

export function parkSale(cartData: object, customerId: string | null, staffId: string, label: string): void {
  getDB().prepare(`
    INSERT INTO parked_sales (id, label, cart_data, customer_id, staff_id, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(uuidv4(), label, JSON.stringify(cartData), customerId, staffId)
}

export function getParkedSales(staffId: string): ParkedSale[] {
  return getDB().prepare(`
    SELECT ps.*, u.name as staff_name, c.name as customer_name
    FROM parked_sales ps
    LEFT JOIN users u ON ps.staff_id = u.id
    LEFT JOIN customers c ON ps.customer_id = c.id
    WHERE ps.staff_id = ? OR 'owner' = (SELECT role FROM users WHERE id = ?)
    ORDER BY ps.created_at DESC
  `).all(staffId, staffId) as unknown as ParkedSale[]
}

export function deleteParkedSale(id: string): void {
  getDB().prepare('DELETE FROM parked_sales WHERE id = ?').run(id)
}

// ---------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[\s\-\(\)\.]/g, '').trim()
}

export function getAllCustomers(): Customer[] {
  return getDB().prepare('SELECT * FROM customers ORDER BY name').all() as unknown as Customer[]
}

export function searchCustomers(query: string): Customer[] {
  const q = `%${query}%`
  return getDB().prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR whatsapp LIKE ? OR address LIKE ? ORDER BY name LIMIT 50').all(q, q, q, q) as unknown as Customer[]
}

export function getCustomerByPhone(phone: string): Customer | null {
  if (!phone || !phone.trim()) return null
  const cleaned = normalizePhoneNumber(phone)
  if (cleaned.length < 5) return null
  const last10 = cleaned.slice(-10)
  const all = getAllCustomers()
  for (const c of all) {
    const cPhone = normalizePhoneNumber(c.phone || '')
    const cWhatsapp = normalizePhoneNumber(c.whatsapp || '')
    if (cPhone && (cPhone === cleaned || (last10.length >= 7 && cPhone.endsWith(last10)) || (cPhone.length >= 7 && cleaned.endsWith(cPhone.slice(-10))))) {
      return c
    }
    if (cWhatsapp && (cWhatsapp === cleaned || (last10.length >= 7 && cWhatsapp.endsWith(last10)) || (cWhatsapp.length >= 7 && cleaned.endsWith(cWhatsapp.slice(-10))))) {
      return c
    }
  }
  return null
}

export function createCustomer(data: CreateCustomerInput, userId: string): Customer {
  const phoneToMatch = data.phone || data.whatsapp || ''
  if (phoneToMatch.trim()) {
    const existing = getCustomerByPhone(phoneToMatch)
    if (existing) {
      // Return existing customer to avoid duplicates
      return existing
    }
  }

  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  getDB().prepare(`
    INSERT INTO customers (id, name, phone, whatsapp, address, type, balance, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, data.name.trim(), data.phone || '', data.whatsapp || data.phone || '', data.address || '', data.type || 'walkin', data.notes || '', userId, now)
  return getDB().prepare('SELECT * FROM customers WHERE id = ?').get(id) as unknown as Customer
}

export function updateCustomer(id: string, data: Partial<CreateCustomerInput>): Customer {
  const fields: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()) }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone.trim()) }
  if (data.whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(data.whatsapp.trim()) }
  if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address.trim()) }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type) }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes) }

  if (fields.length > 0) {
    getDB().prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return getDB().prepare('SELECT * FROM customers WHERE id = ?').get(id) as unknown as Customer
}

export function deleteCustomer(id: string): void {
  const db = getDB()
  try {
    db.prepare('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?').run(id)
  } catch {}
  try {
    db.prepare('DELETE FROM parked_sales WHERE customer_id = ?').run(id)
  } catch {}
  try {
    db.prepare('DELETE FROM customer_payments WHERE customer_id = ?').run(id)
  } catch {}
  try {
    db.prepare('DELETE FROM customer_ledger WHERE customer_id = ?').run(id)
  } catch {}
  db.prepare('DELETE FROM customers WHERE id = ?').run(id)
}

// ---------------------------------------------------------------
// SUPPLIERS
// ---------------------------------------------------------------
export function getAllSuppliers(): Supplier[] {
  return getDB().prepare('SELECT * FROM suppliers ORDER BY name').all() as unknown as Supplier[]
}

export function createSupplier(data: CreateSupplierInput, userId: string): Supplier {
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  getDB().prepare(`
    INSERT INTO suppliers (id, name, contact, address, balance, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, data.name, data.contact || '', data.address || '', data.notes || '', userId, now)
  return getDB().prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as unknown as Supplier
}

export function updateSupplier(id: string, data: Partial<CreateSupplierInput>): Supplier {
  const db = getDB()
  const fields: string[] = []
  const values: any[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()) }
  if (data.contact !== undefined) { fields.push('contact = ?'); values.push(data.contact.trim()) }
  if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address.trim()) }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes.trim()) }

  if (fields.length > 0) {
    values.push(id)
    db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as unknown as Supplier
}

export function deleteSupplier(id: string): void {
  const db = getDB()
  try { db.prepare('UPDATE items SET supplier_id = NULL WHERE supplier_id = ?').run(id) } catch {}
  try { db.prepare('UPDATE purchases SET supplier_id = NULL WHERE supplier_id = ?').run(id) } catch {}
  try { db.prepare('DELETE FROM payments_to_suppliers WHERE supplier_id = ?').run(id) } catch {}
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
}

// ---------------------------------------------------------------
// PURCHASES
// ---------------------------------------------------------------
export function generatePurchaseNumber(): string {
  const prefix = (getDB().prepare("SELECT value FROM settings WHERE key='purchase_prefix'").get() as {value:string} | null)?.value || 'PO'
  const count = ((getDB().prepare('SELECT COUNT(*) as c FROM purchases').get() as {c:number} | null)?.c || 0) + 1
  return `${prefix}-${String(count).padStart(5,'0')}`
}

function ensurePurchaseColumns(db: DatabaseWrapper) {
  try {
    const pCols = (db.prepare("PRAGMA table_info(purchases)").all() as { name: string }[]).map(c => c.name)
    if (!pCols.includes('payment_source')) {
      db.exec("ALTER TABLE purchases ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'drawer'")
    }
  } catch (err) {
    try {
      db.exec("ALTER TABLE purchases ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'drawer'")
    } catch {}
  }
}

export function createPurchase(data: CreatePurchaseInput, userId: string): Purchase {
  const id = uuidv4()
  const purchaseNumber = generatePurchaseNumber()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const today = now.slice(0, 10)
  const paymentSource = data.payment_source || 'drawer'

  const totalCost = Number(data.total_cost) || 0
  const amountPaid = Number(data.amount_paid) || 0
  const balanceDue = data.balance_due !== undefined ? Number(data.balance_due) : Math.max(0, totalCost - amountPaid)
  const computedStatus = balanceDue === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid')

  const db2 = getDB()
  ensurePurchaseColumns(db2)

  db2.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, date, invoice_ref, total_cost, amount_paid, balance_due, payment_status, payment_source, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, purchaseNumber,
    data.supplier_id || null, today,
    data.invoice_ref || null,
    totalCost, amountPaid, balanceDue,
    computedStatus,
    paymentSource,
    data.notes || null, userId, now
  )

  for (const item of data.items) {
    db2.prepare(`
      INSERT INTO purchase_items (id, purchase_id, item_id, qty, cost_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), id, item.item_id, item.qty, item.cost_price, item.line_total)

    // Add to stock and update cost price
    const current = db2.prepare('SELECT quantity_on_hand FROM items WHERE id = ?').get(item.item_id) as {quantity_on_hand: number}
    const newQty = (current?.quantity_on_hand || 0) + item.qty
    db2.prepare('UPDATE items SET quantity_on_hand = ?, cost_price = ?, updated_at = ? WHERE id = ?')
      .run(newQty, item.cost_price, now, item.item_id)

    recordStockTransaction({
      item_id: item.item_id,
      type: 'purchase',
      qty_change: item.qty,
      qty_after: newQty,
      reference: id,
      user_id: userId,
      notes: `Purchase ${purchaseNumber}`
    })
  }

  // Update supplier balance and log initial payment
  if (balanceDue > 0 && data.supplier_id) {
    db2.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(balanceDue, data.supplier_id)
  }
  if (amountPaid > 0 && data.supplier_id) {
    try {
      const payId = uuidv4()
      db2.prepare(`
        INSERT INTO payments_to_suppliers (id, supplier_id, date, amount, method, reference, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payId, data.supplier_id, today, amountPaid,
        paymentSource === 'drawer' ? 'cash' : 'bank',
        purchaseNumber,
        `Initial payment for PO #${purchaseNumber}`,
        userId, now
      )
    } catch (e) {
      console.warn('[Create Purchase] Supplier payment log note:', e)
    }
  }

  // Accounting double entry
  try {
    const lines: { account_id: string; debit: number; credit: number; description?: string }[] = [
      { account_id: 'acc-stock', debit: totalCost, credit: 0, description: `Stock inflow (${purchaseNumber})` }
    ]
    if (amountPaid > 0) {
      const creditAcc = paymentSource === 'drawer' ? 'acc-cash' : 'acc-bank'
      lines.push({ account_id: creditAcc, debit: 0, credit: amountPaid, description: `Paid from ${paymentSource === 'drawer' ? 'Drawer Cash' : 'Outside/Bank'}` })
    }
    if (balanceDue > 0) {
      lines.push({ account_id: 'acc-ap', debit: 0, credit: balanceDue, description: 'Accounts Payable to Supplier' })
    }
    createJournalEntry({
      date: today,
      description: `Stock Purchase Invoice ${purchaseNumber} (${computedStatus}, source: ${paymentSource})`,
      reference: purchaseNumber,
      lines
    }, userId)
  } catch (err) {
    console.warn('[Purchase] Journal entry note:', err)
  }

  return db2.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as unknown as Purchase
}

export function getAllPurchases(): Purchase[] {
  const rows = getDB().prepare(`
    SELECT p.*, s.name as supplier_name, u.name as created_by_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN users u ON p.created_by = u.id
    ORDER BY p.created_at DESC
  `).all() as unknown as Purchase[]

  for (const p of rows) {
    // Dynamically guarantee status integrity
    if ((p.balance_due || 0) <= 0) {
      p.payment_status = 'paid'
    } else if ((p.amount_paid || 0) > 0) {
      p.payment_status = 'partial'
    } else {
      p.payment_status = 'unpaid'
    }

    const items = getDB().prepare(`
      SELECT pi.*, i.name as item_name, i.part_number
      FROM purchase_items pi
      LEFT JOIN items i ON pi.item_id = i.id
      WHERE pi.purchase_id = ?
    `).all(p.id) as unknown as any[]
    ;(p as any).items = items
  }

  return rows
}

export function payPurchaseInvoice(data: {
  purchase_id: string
  amount: number
  payment_source?: 'drawer' | 'outside' | 'bank' | 'other'
  reference?: string
  notes?: string
}, userId: string): Purchase {
  const db2 = getDB()
  ensurePurchaseColumns(db2)
  const purchase = db2.prepare('SELECT * FROM purchases WHERE id = ?').get(data.purchase_id) as unknown as Purchase | undefined
  if (!purchase) throw new Error('Stock Purchase invoice not found')

  const payAmount = Number(data.amount) || 0
  if (payAmount <= 0) throw new Error('Payment amount must be greater than 0')

  const newAmountPaid = (purchase.amount_paid || 0) + payAmount
  const newBalance = Math.max(0, (purchase.total_cost || 0) - newAmountPaid)
  const newStatus = newBalance === 0 ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid')
  const paymentSource = data.payment_source || purchase.payment_source || 'drawer'

  // 1. Update purchase invoice
  db2.prepare(`
    UPDATE purchases
    SET amount_paid = ?, balance_due = ?, payment_status = ?, payment_source = ?
    WHERE id = ?
  `).run(newAmountPaid, newBalance, newStatus, paymentSource, data.purchase_id)

  const today = new Date().toISOString().slice(0, 10)

  // 2. If supplier is associated, reduce supplier balance and log supplier payment
  if (purchase.supplier_id) {
    try {
      const supp = db2.prepare('SELECT id FROM suppliers WHERE id = ?').get(purchase.supplier_id) as { id: string } | undefined
      if (supp) {
        db2.prepare('UPDATE suppliers SET balance = MAX(0, balance - ?) WHERE id = ?').run(payAmount, purchase.supplier_id)
        const payId = uuidv4()
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        db2.prepare(`
          INSERT INTO payments_to_suppliers (id, supplier_id, date, amount, method, reference, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          payId, purchase.supplier_id, today, payAmount,
          paymentSource === 'drawer' ? 'cash' : 'bank',
          data.reference || purchase.purchase_number,
          data.notes || `Payment for Stock Invoice ${purchase.purchase_number}`,
          userId, now
        )
      }
    } catch (suppErr) {
      console.warn('[Pay Purchase] Supplier update note:', suppErr)
    }
  }

  // 3. Double-entry Journal
  try {
    const creditAcc = paymentSource === 'drawer' ? 'acc-cash' : 'acc-bank'
    createJournalEntry({
      date: today,
      description: `Payment for Stock Invoice ${purchase.purchase_number} (${paymentSource === 'drawer' ? 'Shop Drawer' : 'Outside/Bank'})`,
      reference: purchase.purchase_number,
      lines: [
        { account_id: 'acc-ap', debit: payAmount, credit: 0, description: 'Accounts Payable reduction' },
        { account_id: creditAcc, debit: 0, credit: payAmount, description: `Cash/Bank outflow (${paymentSource})` }
      ]
    }, userId)
  } catch (err) {
    console.warn('[Pay Purchase] Journal error:', err)
  }

  try {
    logAction(userId, 'PAY_PURCHASE_INVOICE', 'purchases', data.purchase_id, {
      purchase_number: purchase.purchase_number,
      amount: payAmount,
      new_balance: newBalance,
      payment_source: paymentSource
    })
  } catch (logErr) {
    console.warn('[Pay Purchase] Audit log note:', logErr)
  }

  return db2.prepare('SELECT * FROM purchases WHERE id = ?').get(data.purchase_id) as unknown as Purchase
}

// ---------------------------------------------------------------
// INVOICE BALANCE COLLECTION
// ---------------------------------------------------------------
export function recordInvoicePayment(data: {
  invoice_id: string
  amount: number
  method: 'cash' | 'card' | 'bank'
  reference?: string
  notes?: string
}, userId: string): Invoice {
  const db2 = getDB()
  const inv = db2.prepare('SELECT * FROM invoices WHERE id = ?').get(data.invoice_id) as unknown as Invoice | undefined
  if (!inv) throw new Error('Invoice not found')
  if (inv.status === 'voided' || inv.status === 'refunded') throw new Error('Cannot collect payment on voided or refunded invoice')
  if (inv.balance_due <= 0) throw new Error('Invoice already fully paid')

  const payAmount = Math.min(Number(data.amount) || 0, inv.balance_due)
  if (payAmount <= 0) throw new Error('Payment amount must be greater than 0')

  const newAmountPaid = (inv.amount_paid || 0) + payAmount
  const newBalance = Math.max(0, inv.grand_total - newAmountPaid)
  const newStatus = newBalance === 0 ? 'completed' : inv.status

  db2.prepare(`
    UPDATE invoices
    SET amount_paid = ?, balance_due = ?, status = ?
    WHERE id = ?
  `).run(newAmountPaid, newBalance, newStatus, data.invoice_id)

  // Reduce customer balance if customer linked
  if (inv.customer_id) {
    try {
      db2.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(payAmount, inv.customer_id)
    } catch (e) {
      console.warn('[Invoice Payment] Customer balance update note:', e)
    }
  }

  // Double-entry journal
  const cashAcc = data.method === 'bank' ? 'acc-bank' : 'acc-cash'
  try {
    createJournalEntry({
      date: new Date().toISOString().slice(0, 10),
      description: `Invoice payment collected — ${inv.invoice_number} (${data.notes || data.method})`,
      reference: data.reference || inv.invoice_number,
      lines: [
        { account_id: cashAcc, debit: payAmount, credit: 0, description: 'Cash / Bank Inflow' },
        { account_id: 'acc-ar', debit: 0, credit: payAmount, description: 'Accounts Receivable reduction' }
      ]
    }, userId)
  } catch (err) {
    console.warn('[Invoice Payment] Journal error:', err)
  }

  try {
    logAction(userId, 'COLLECT_INVOICE_PAYMENT', 'invoices', data.invoice_id, {
      invoice_number: inv.invoice_number,
      amount: payAmount,
      new_balance: newBalance,
      method: data.method
    })
  } catch (logErr) {
    console.warn('[Invoice Payment] Audit log note:', logErr)
  }

  return getInvoiceById(data.invoice_id)!
}

// ---------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------
export function getDailySaleReport(date: string): DailySaleReport {
  const invoices = getDB().prepare(`
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COALESCE(SUM(r.refund_amount),0) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') >= inv.grand_total THEN 'refunded'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'partial_refund'
        ELSE inv.status
      END as status,
      c.name as customer_name, u.name as staff_name
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE inv.date = ? AND inv.status != 'parked'
    ORDER BY inv.datetime_created
  `).all(date) as unknown as Invoice[]

  for (const inv of invoices) {
    const items = getDB().prepare(`
      SELECT ii.*, i.name as item_name, i.part_number
      FROM invoice_items ii
      LEFT JOIN items i ON ii.item_id = i.id
      WHERE ii.invoice_id = ?
    `).all(inv.id) as unknown as InvoiceItem[]
    ;(inv as Invoice & {items: InvoiceItem[]}).items = items
  }

  // Only count active sales in totals; do NOT add fully refunded or voided sales into profit or sales
  const activeInvoices = invoices.filter(i => i.status !== 'voided' && i.status !== 'refunded')

  const totals = {
    total_sales: activeInvoices.reduce((s, i) => s + (i.grand_total || 0), 0),
    total_cost: activeInvoices.reduce((s, i) => s + (i.cost_total || 0), 0),
    total_discount: activeInvoices.reduce((s, i) => s + (i.discount_amount || 0), 0),
    total_profit: activeInvoices.reduce((s, i) => {
      const ratio = (i.grand_total && i.grand_total > 0) ? ((i.amount_paid ?? i.grand_total) / i.grand_total) : 1
      return s + (i.profit || 0) * Math.min(1, Math.max(0, ratio))
    }, 0),
    invoice_count: activeInvoices.length
  }

  return { date, invoices: invoices as (Invoice & {items: InvoiceItem[]})[], totals }
}

export function getStaffSalesReport(fromDate: string, toDate?: string, staffId?: string): StaffSalesReport[] {
  const to = toDate || fromDate
  let sql = `
    SELECT
      u.id as user_id,
      u.name as user_name,
      u.role,
      COUNT(CASE WHEN inv.status NOT IN ('voided','parked','refunded') THEN inv.id END) as invoice_count,
      COALESCE(SUM(CASE WHEN inv.status NOT IN ('voided','parked','refunded') THEN inv.grand_total ELSE 0 END), 0) as total_sales,
      COALESCE(SUM(CASE WHEN inv.status NOT IN ('voided','parked','refunded') THEN inv.cost_total ELSE 0 END), 0) as total_cost,
      COALESCE(SUM(CASE WHEN inv.status NOT IN ('voided','parked','refunded') THEN inv.discount_amount ELSE 0 END), 0) as total_discounts,
      COALESCE(SUM(CASE WHEN inv.status NOT IN ('voided','parked','refunded') THEN inv.profit * MIN(1.0, MAX(0.0, CASE WHEN inv.grand_total > 0 THEN (inv.amount_paid * 1.0 / inv.grand_total) ELSE 1.0 END)) ELSE 0 END), 0) as total_profit
    FROM users u
    LEFT JOIN invoices inv ON inv.staff_id = u.id AND inv.date BETWEEN ? AND ?
    WHERE u.is_active = 1
  `
  const params: unknown[] = [fromDate, to]

  if (staffId && staffId !== 'all') {
    sql += ' AND u.id = ?'
    params.push(staffId)
  }

  sql += ' GROUP BY u.id ORDER BY total_sales DESC'
  return getDB().prepare(sql).all(params) as unknown as StaffSalesReport[]
}

// ---------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------
export function getSetting(key: string): string | null {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key) as {value:string} | null
  return row?.value || null
}

export function setSetting(key: string, value: string): void {
  getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDB().prepare('SELECT key, value FROM settings').all() as unknown as {key:string, value:string}[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// ---------------------------------------------------------------
// BRANDS & CATEGORIES
// ---------------------------------------------------------------
export function getAllBrands(): Brand[] {
  return getDB().prepare('SELECT * FROM brands ORDER BY name').all() as unknown as Brand[]
}

export function createBrand(name: string, userId?: string): Brand {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Brand name cannot be empty')
  const existing = getDB().prepare('SELECT * FROM brands WHERE LOWER(name) = LOWER(?)').get(trimmed) as unknown as Brand | undefined
  if (existing) return existing
  const id = uuidv4()
  getDB().prepare('INSERT INTO brands (id, name) VALUES (?, ?)').run(id, trimmed)
  if (userId) {
    try {
      logAction(userId, 'CREATE_BRAND', 'brands', id, { name: trimmed })
    } catch {}
  }
  return { id, name: trimmed }
}

export function getAllCategories(): Category[] {
  return getDB().prepare('SELECT * FROM categories ORDER BY name').all() as unknown as Category[]
}

// ---------------------------------------------------------------
// AUDIT LOG
// ---------------------------------------------------------------
export function logAction(userId: string, action: string, entity: string, entityId: string | null, details?: object): void {
  getDB().prepare(`
    INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(uuidv4(), userId, action, entity, entityId, details ? JSON.stringify(details) : null)
}

// ---------------------------------------------------------------
// ONLINE & WHATSAPP ORDERS (Phase 2)
// ---------------------------------------------------------------
export function updateInvoiceStatus(invoiceId: string, status: string, trackingNumber?: string): void {
  const db2 = getDB()
  if (trackingNumber !== undefined) {
    db2.prepare('UPDATE invoices SET status = ?, tracking_number = ? WHERE id = ?').run(status, trackingNumber, invoiceId)
  } else {
    db2.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, invoiceId)
  }
}

export function getOnlineOrders(statusFilter?: string): Invoice[] {
  // Sync invoices table with approved returns
  try {
    getDB().prepare(`
      UPDATE invoices
      SET status = 'refunded'
      WHERE id IN (SELECT DISTINCT invoice_id FROM returns WHERE invoice_id IS NOT NULL AND status = 'approved')
        AND status != 'refunded'
    `).run()
  } catch {}

  let query = `
    SELECT inv.*,
      CASE
        WHEN inv.status = 'voided' THEN 'voided'
        WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded'
        ELSE inv.status
      END as status,
      c.name as customer_name, c.phone as customer_phone, u.name as staff_name
    FROM invoices inv
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN users u ON inv.staff_id = u.id
    WHERE inv.source IN ('whatsapp', 'socialmedia', 'other')
  `
  const params: unknown[] = []
  if (statusFilter && statusFilter !== 'all') {
    query += ` AND (CASE WHEN (SELECT COUNT(*) FROM returns r WHERE r.invoice_id = inv.id AND r.status = 'approved') > 0 THEN 'refunded' ELSE inv.status END) = ?`
    params.push(statusFilter)
  }
  query += ' ORDER BY inv.datetime_created DESC'

  const invoices = getDB().prepare(query).all(...params) as unknown as Invoice[]
  for (const inv of invoices) {
    const items = getDB().prepare(`
      SELECT ii.*, i.name as item_name, i.part_number
      FROM invoice_items ii
      LEFT JOIN items i ON ii.item_id = i.id
      WHERE ii.invoice_id = ?
    `).all(inv.id) as unknown as InvoiceItem[]
    ;(inv as Invoice & {items: InvoiceItem[]}).items = items
  }
  return invoices
}

// ---------------------------------------------------------------
// RETURNS & REFUNDS (Phase 2)
// ---------------------------------------------------------------
export function generateReturnNumber(): string {
  const prefix = (getDB().prepare("SELECT value FROM settings WHERE key='return_prefix'").get() as {value:string} | null)?.value || 'RET'
  const count = ((getDB().prepare('SELECT COUNT(*) as c FROM returns').get() as {c:number} | null)?.c || 0) + 1
  return `${prefix}-${String(count).padStart(5,'0')}`
}

export function createReturn(data: CreateReturnInput, userId: string): Return {
  const db2 = getDB()

  // Guard against duplicate refunds for the same invoice/order
  if (data.invoice_id) {
    const inv = db2.prepare('SELECT * FROM invoices WHERE id = ?').get(data.invoice_id) as unknown as Invoice | undefined
    if (inv) {
      if (inv.status === 'refunded') {
        throw new Error(`Order / Invoice #${inv.invoice_number} has already been marked as REFUNDED and cannot be refunded again.`)
      }
      if (inv.status === 'voided') {
        throw new Error(`Order / Invoice #${inv.invoice_number} is VOIDED and cannot be refunded.`)
      }
    }

    const existingReturns = db2.prepare("SELECT * FROM returns WHERE invoice_id = ? AND status = 'approved'").all(data.invoice_id) as unknown as Return[]
    if (existingReturns.length > 0) {
      const alreadyRefunded = existingReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0)
      if (inv && alreadyRefunded >= inv.grand_total) {
        throw new Error(`Order #${inv.invoice_number} has already been fully refunded (Total: Rs. ${alreadyRefunded.toLocaleString()}).`)
      }
    }
  }

  const id = uuidv4()
  const returnNumber = generateReturnNumber()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const today = now.slice(0, 10)

  db2.prepare(`
    INSERT INTO returns (
      id, return_number, invoice_id, date, reason,
      refund_method, refund_amount, status, processed_by, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
  `).run(
    id, returnNumber,
    data.invoice_id || null, today,
    data.reason,
    data.refund_method || 'cash',
    data.refund_amount,
    userId,
    data.notes || null,
    now
  )

  for (const item of data.items) {
    const returnItemId = uuidv4()
    db2.prepare(`
      INSERT INTO return_items (id, return_id, item_id, qty, unit_price, line_total, restocked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(returnItemId, id, item.item_id, item.qty, item.unit_price, item.line_total, item.restocked ? 1 : 0)

    // If restock is enabled, restore inventory quantity and log transaction
    if (item.restocked) {
      const current = db2.prepare('SELECT quantity_on_hand FROM items WHERE id = ?').get(item.item_id) as {quantity_on_hand: number} | null
      const newQty = (current?.quantity_on_hand || 0) + item.qty
      db2.prepare('UPDATE items SET quantity_on_hand = ?, updated_at = ? WHERE id = ?').run(newQty, now, item.item_id)

      recordStockTransaction({
        item_id: item.item_id,
        type: 'return_in',
        qty_change: item.qty,
        qty_after: newQty,
        reference: id,
        user_id: userId,
        notes: `Return ${returnNumber} (${data.reason})`
      })
    }
  }

  // Update original invoice status to 'refunded' only if cumulative returns cover grand total
  if (data.invoice_id) {
    const inv = db2.prepare('SELECT grand_total FROM invoices WHERE id = ?').get(data.invoice_id) as { grand_total: number } | undefined
    const allReturns = db2.prepare("SELECT COALESCE(SUM(refund_amount), 0) as total FROM returns WHERE invoice_id = ? AND status = 'approved'").get(data.invoice_id) as { total: number } | undefined
    const totalRefunded = allReturns?.total || 0
    if (inv && totalRefunded >= inv.grand_total) {
      db2.prepare("UPDATE invoices SET status = 'refunded' WHERE id = ?").run(data.invoice_id)
    }
    logAction(userId, 'REFUND_ORDER', 'invoices', data.invoice_id, {
      return_number: returnNumber,
      refund_amount: data.refund_amount,
      refund_method: data.refund_method,
      reason: data.reason
    })
  }

  return getReturnById(id)!
}

export function getAllReturns(): Return[] {
  const rows = getDB().prepare(`
    SELECT r.*, u.name as processed_by_name, inv.invoice_number, c.name as customer_name
    FROM returns r
    LEFT JOIN users u ON r.processed_by = u.id
    LEFT JOIN invoices inv ON r.invoice_id = inv.id
    LEFT JOIN customers c ON inv.customer_id = c.id
    ORDER BY r.created_at DESC
  `).all() as unknown as Return[]

  for (const ret of rows) {
    const items = getDB().prepare(`
      SELECT ri.*, i.name as item_name, i.part_number
      FROM return_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      WHERE ri.return_id = ?
    `).all(ret.id) as unknown as ReturnItem[]
    ;(ret as Return & {items: ReturnItem[]}).items = items
  }

  return rows
}

export function getReturnById(id: string): Return | null {
  const ret = getDB().prepare(`
    SELECT r.*, u.name as processed_by_name, inv.invoice_number, c.name as customer_name
    FROM returns r
    LEFT JOIN users u ON r.processed_by = u.id
    LEFT JOIN invoices inv ON r.invoice_id = inv.id
    LEFT JOIN customers c ON inv.customer_id = c.id
    WHERE r.id = ?
  `).get(id) as unknown as Return | undefined

  if (!ret) return null

  const items = getDB().prepare(`
    SELECT ri.*, i.name as item_name, i.part_number
    FROM return_items ri
    LEFT JOIN items i ON ri.item_id = i.id
    WHERE ri.return_id = ?
  `).all(id) as unknown as ReturnItem[]

  return { ...ret, items }
}

// ---------------------------------------------------------------
// DAY CLOSING & RECONCILIATION (Phase 2)
// ---------------------------------------------------------------
export function isDayClosed(date: string): boolean {
  const row = getDB().prepare('SELECT id FROM day_closes WHERE date = ?').get(date)
  return !!row
}

export function calculateDayClose(date: string): DayCloseCalculation {
  const db2 = getDB()

  // Invoices for date (excluding fully refunded and voided)
  const invoices = db2.prepare(`
    SELECT * FROM invoices
    WHERE date = ? AND status NOT IN ('voided', 'parked', 'refunded')
  `).all(date) as unknown as Invoice[]

  const totalSales = invoices.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalDiscounts = invoices.reduce((s, i) => s + (i.discount_amount || 0), 0)
  const totalUnpaid = invoices.reduce((s, i) => s + (i.balance_due || 0), 0)

  // Returns for date
  const returns = db2.prepare(`
    SELECT * FROM returns WHERE date = ? AND status = 'approved'
  `).all(date) as unknown as Return[]

  let returnProfitReversal = 0
  for (const r of returns) {
    const rItems = db2.prepare(`
      SELECT ri.qty, ri.unit_price, ri.line_total, i.cost_price
      FROM return_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      WHERE ri.return_id = ?
    `).all(r.id) as { qty: number; unit_price: number; line_total: number; cost_price: number }[]
    for (const ri of rItems) {
      const lineCost = (ri.cost_price || 0) * ri.qty
      returnProfitReversal += Math.max(0, ri.line_total - lineCost)
    }
  }

  // Proportional profit recognition based on paid amount minus profit reversal on returns
  const grossProfitRecognized = invoices.reduce((s, i) => {
    const ratio = (i.grand_total && i.grand_total > 0) ? ((i.amount_paid ?? i.grand_total) / i.grand_total) : 1
    return s + (i.profit || 0) * Math.min(1, Math.max(0, ratio))
  }, 0)
  const totalProfit = Math.max(0, grossProfitRecognized - returnProfitReversal)

  // Granular payment channel breakdown (using actual amount collected into cash drawer or bank accounts)
  let cashSales = 0
  let cardSales = 0
  let jazzcashSales = 0
  let easypaisaSales = 0
  let otherBankSales = 0

  for (const inv of invoices) {
    const paid = inv.amount_paid !== undefined && inv.amount_paid !== null ? inv.amount_paid : (inv.grand_total || 0)
    if (paid <= 0) continue

    const method = (inv.payment_method || '').toLowerCase()
    const notes = (inv.notes || '').toLowerCase()

    if (method === 'cash' || method === 'partial') {
      cashSales += paid
    } else if (method === 'card') {
      cardSales += paid
    } else if (method === 'bank' || method.includes('bank') || method.includes('jazzcash') || method.includes('easypaisa') || method.includes('wallet')) {
      if (notes.includes('jazzcash') || method.includes('jazzcash')) {
        jazzcashSales += paid
      } else if (notes.includes('easypaisa') || method.includes('easypaisa')) {
        easypaisaSales += paid
      } else {
        otherBankSales += paid
      }
    } else {
      cashSales += paid
    }
  }

  const bankSales = jazzcashSales + easypaisaSales + otherBankSales
  const totalCollected = cashSales + cardSales + bankSales

  const totalReturns = returns.reduce((s, r) => s + (r.refund_amount || 0), 0)
  const cashReturns = returns.filter(r => (r.refund_method || '').toLowerCase() === 'cash').reduce((s, r) => s + (r.refund_amount || 0), 0)

  // Expenses for date
  const expenses = db2.prepare(`
    SELECT * FROM expenses WHERE date = ?
  `).all(date) as unknown as Expense[]

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const cashExpenses = expenses.filter(e => (e.payment_method || '').toLowerCase() === 'cash').reduce((s, e) => s + (e.amount || 0), 0)

  const expectedCash = Math.max(0, cashSales - cashReturns - cashExpenses)

  // Staff breakdown
  const users = db2.prepare('SELECT id, name FROM users WHERE is_active = 1').all() as unknown as {id: string; name: string}[]
  const staffBreakdown = users.map(u => {
    const userInvoices = invoices.filter(i => i.staff_id === u.id)
    const userSales = userInvoices.reduce((s, i) => s + (i.grand_total || 0), 0)
    const userCash = userInvoices.filter(i => {
      const m = (i.payment_method || '').toLowerCase()
      return m === 'cash' || m === 'partial'
    }).reduce((s, i) => s + (i.amount_paid ?? i.grand_total ?? 0), 0)
    const userCard = userInvoices.filter(i => (i.payment_method || '').toLowerCase() === 'card').reduce((s, i) => s + (i.amount_paid ?? i.grand_total ?? 0), 0)
    const userBank = userInvoices.filter(i => {
      const m = (i.payment_method || '').toLowerCase()
      return m === 'bank' || m.includes('bank') || m.includes('jazzcash') || m.includes('easypaisa') || m.includes('wallet')
    }).reduce((s, i) => s + (i.amount_paid ?? i.grand_total ?? 0), 0)
    return {
      user_id: u.id,
      name: u.name,
      sales: userSales,
      invoices: userInvoices.length,
      cash: userCash,
      card: userCard,
      bank: userBank
    }
  }).filter(s => s.invoices > 0 || s.sales > 0)

  return {
    date,
    total_sales: totalSales,
    total_discounts: totalDiscounts,
    total_returns: totalReturns,
    total_profit: totalProfit,
    total_expenses: totalExpenses,
    cash_expenses: cashExpenses,
    expenses_count: expenses.length,
    cash_sales: cashSales,
    card_sales: cardSales,
    bank_sales: bankSales,
    jazzcash_sales: jazzcashSales,
    easypaisa_sales: easypaisaSales,
    other_bank_sales: otherBankSales,
    total_collected: totalCollected,
    total_unpaid: totalUnpaid,
    invoice_count: invoices.length,
    returns_count: returns.length,
    expected_cash: expectedCash,
    staff_breakdown: staffBreakdown,
    is_already_closed: isDayClosed(date)
  }
}

export function submitDayClose(data: SubmitDayCloseInput, userId: string): DayClose {
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const db2 = getDB()

  const variance = data.counted_cash - data.expected_cash

  db2.prepare(`
    INSERT INTO day_closes (
      id, date, total_sales, total_discounts, total_returns, total_profit,
      cash_sales, card_sales, bank_sales, expected_cash, counted_cash,
      variance, staff_breakdown, notes, signed_by, signed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.date, data.total_sales, data.total_discounts, data.total_returns, data.total_profit,
    data.cash_sales, data.card_sales, data.bank_sales, data.expected_cash, data.counted_cash,
    variance, data.staff_breakdown ? JSON.stringify(data.staff_breakdown) : null,
    data.notes || null, userId, now
  )

  // LOCK ALL INVOICES for this date so staff cannot alter past day invoices
  db2.prepare('UPDATE invoices SET is_locked = 1 WHERE date = ?').run(data.date)

  logAction(userId, 'DAY_CLOSE', 'day_closes', id, {
    date: data.date,
    expected_cash: data.expected_cash,
    counted_cash: data.counted_cash,
    variance
  })

  return db2.prepare(`
    SELECT dc.*, u.name as signed_by_name
    FROM day_closes dc
    LEFT JOIN users u ON dc.signed_by = u.id
    WHERE dc.id = ?
  `).get(id) as unknown as DayClose
}

export function getDayCloses(): DayClose[] {
  return getDB().prepare(`
    SELECT dc.*, u.name as signed_by_name
    FROM day_closes dc
    LEFT JOIN users u ON dc.signed_by = u.id
    ORDER BY dc.date DESC
  `).all() as unknown as DayClose[]
}

// ---------------------------------------------------------------
// ACCOUNTS & FINANCIAL LEDGER (Phase 3)
// ---------------------------------------------------------------
export function getAllAccounts(): Account[] {
  return getDB().prepare('SELECT * FROM accounts ORDER BY account_code').all() as unknown as Account[]
}

export function createAccount(data: { name: string; account_code: string; type: string; balance?: number }, userId: string): Account {
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const db2 = getDB()

  db2.prepare(`
    INSERT INTO accounts (id, account_code, name, type, balance, is_system, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, data.account_code, data.name, data.type, data.balance || 0, now)

  logAction(userId, 'CREATE_ACCOUNT', 'accounts', id, { code: data.account_code, name: data.name, type: data.type })
  return db2.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as unknown as Account
}

export function generateJournalNumber(): string {
  const count = ((getDB().prepare('SELECT COUNT(*) as c FROM journal_entries').get() as {c:number} | null)?.c || 0) + 1
  return `JV-${String(count).padStart(5, '0')}`
}

export function createJournalEntry(data: {
  date?: string
  description: string
  reference?: string
  lines: { account_id: string; debit: number; credit: number; description?: string }[]
}, userId: string): JournalEntry {
  const db2 = getDB()
  const totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Double-entry out of balance! Debits (Rs. ${totalDebit}) must equal Credits (Rs. ${totalCredit}).`)
  }

  const id = uuidv4()
  const entryNumber = generateJournalNumber()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const entryDate = data.date || now.slice(0, 10)

  db2.prepare(`
    INSERT INTO journal_entries (id, entry_number, date, description, reference, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, entryNumber, entryDate, data.description, data.reference || null, userId, now)

  for (const line of data.lines) {
    const lineId = uuidv4()
    const deb = Number(line.debit) || 0
    const cred = Number(line.credit) || 0

    db2.prepare(`
      INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(lineId, id, line.account_id, deb, cred, line.description || null)

    // Update account balance
    const acc = db2.prepare('SELECT type, balance FROM accounts WHERE id = ?').get(line.account_id) as { type: string; balance: number } | null
    if (acc) {
      let delta = 0
      if (acc.type === 'asset' || acc.type === 'expense') {
        delta = deb - cred
      } else {
        delta = cred - deb
      }
      db2.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(delta, line.account_id)
    }
  }

  logAction(userId, 'CREATE_JOURNAL_ENTRY', 'journal_entries', id, { entry_number: entryNumber, total: totalDebit })

  return {
    id,
    entry_number: entryNumber,
    date: entryDate,
    description: data.description,
    reference: data.reference,
    created_by: userId,
    created_at: now
  }
}

export function getAllJournalEntries(fromDate?: string, toDate?: string): JournalEntry[] {
  let query = `
    SELECT j.*, u.name as created_by_name
    FROM journal_entries j
    LEFT JOIN users u ON j.created_by = u.id
  `
  const params: unknown[] = []
  if (fromDate && toDate) {
    query += ' WHERE j.date >= ? AND j.date <= ?'
    params.push(fromDate, toDate)
  }
  query += ' ORDER BY j.date DESC, j.created_at DESC'

  const entries = getDB().prepare(query).all(...params) as unknown as JournalEntry[]

  for (const entry of entries) {
    const lines = getDB().prepare(`
      SELECT jl.*, a.account_code, a.name as account_name
      FROM journal_lines jl
      LEFT JOIN accounts a ON jl.account_id = a.id
      WHERE jl.entry_id = ?
    `).all(entry.id) as unknown as JournalLine[]
    entry.lines = lines
    entry.total_debit = lines.reduce((s, l) => s + l.debit, 0)
    entry.total_credit = lines.reduce((s, l) => s + l.credit, 0)
  }

  return entries
}

export function getAccountLedger(accountId: string, fromDate?: string, toDate?: string): LedgerRow[] {
  const db2 = getDB()
  const acc = db2.prepare('SELECT type FROM accounts WHERE id = ?').get(accountId) as { type: string } | null
  const isDebitNormal = acc?.type === 'asset' || acc?.type === 'expense'

  let query = `
    SELECT jl.id, j.date, j.entry_number, COALESCE(jl.description, j.description) as description,
           j.reference, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN journal_entries j ON jl.entry_id = j.id
    WHERE jl.account_id = ?
  `
  const params: unknown[] = [accountId]
  if (fromDate && toDate) {
    query += ' AND j.date >= ? AND j.date <= ?'
    params.push(fromDate, toDate)
  }
  query += ' ORDER BY j.date ASC, j.created_at ASC'

  const rows = db2.prepare(query).all(...params) as unknown as (LedgerRow & { debit: number; credit: number })[]

  let running = 0
  for (const row of rows) {
    if (isDebitNormal) {
      running += (row.debit - row.credit)
    } else {
      running += (row.credit - row.debit)
    }
    row.running_balance = running
  }

  return rows
}

export function recordCustomerPayment(data: {
  customer_id: string
  date?: string
  amount: number
  method: string
  reference?: string
  notes?: string
}, userId: string): void {
  const db2 = getDB()
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const payDate = data.date || now.slice(0, 10)

  // 1. Insert into payments_received
  db2.prepare(`
    INSERT INTO payments_received (id, customer_id, date, amount, method, reference, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.customer_id, payDate, data.amount, data.method || 'cash', data.reference || null, data.notes || null, userId, now)

  // 2. Reduce Customer balance
  db2.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(data.amount, data.customer_id)

  // 3. Post double entry: Debit Cash/Bank, Credit Accounts Receivable
  const cashAcc = data.method === 'bank' ? 'acc-bank' : 'acc-cash'
  createJournalEntry({
    date: payDate,
    description: `Customer payment received (${data.notes || data.method})`,
    reference: data.reference || id,
    lines: [
      { account_id: cashAcc, debit: data.amount, credit: 0, description: 'Cash / Bank Inflow' },
      { account_id: 'acc-ar', debit: 0, credit: data.amount, description: 'Accounts Receivable reduction' }
    ]
  }, userId)

  logAction(userId, 'CUSTOMER_PAYMENT', 'payments_received', id, { customer_id: data.customer_id, amount: data.amount })
}

export function recordSupplierPayment(data: {
  supplier_id: string
  date?: string
  amount: number
  method: string
  reference?: string
  notes?: string
}, userId: string): void {
  const db2 = getDB()
  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const payDate = data.date || now.slice(0, 10)

  // 1. Insert into payments_to_suppliers
  db2.prepare(`
    INSERT INTO payments_to_suppliers (id, supplier_id, date, amount, method, reference, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.supplier_id, payDate, data.amount, data.method || 'cash', data.reference || null, data.notes || null, userId, now)

  // 2. Reduce Supplier balance
  db2.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(data.amount, data.supplier_id)

  // 3. Post double entry: Debit Accounts Payable, Credit Cash/Bank
  const cashAcc = data.method === 'bank' ? 'acc-bank' : 'acc-cash'
  createJournalEntry({
    date: payDate,
    description: `Supplier payment made (${data.notes || data.method})`,
    reference: data.reference || id,
    lines: [
      { account_id: 'acc-ap', debit: data.amount, credit: 0, description: 'Accounts Payable reduction' },
      { account_id: cashAcc, debit: 0, credit: data.amount, description: 'Cash / Bank Outflow' }
    ]
  }, userId)

  logAction(userId, 'SUPPLIER_PAYMENT', 'payments_to_suppliers', id, { supplier_id: data.supplier_id, amount: data.amount })
}

// ---------------------------------------------------------------
// EXPENSES & STORE CASH OUT (Phase 3+)
// ---------------------------------------------------------------
export function generateExpenseNumber(): string {
  const count = ((getDB().prepare('SELECT COUNT(*) as c FROM expenses').get() as {c:number} | null)?.c || 0) + 1
  const date = new Date()
  const yymmdd = `${date.getFullYear().toString().slice(-2)}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`
  return `EXP-${yymmdd}-${String(count).padStart(4,'0')}`
}

export function createExpense(data: CreateExpenseInput, userId: string): Expense {
  const db2 = getDB()
  const id = uuidv4()
  const expenseNumber = generateExpenseNumber()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const today = data.date || now.slice(0, 10)
  const method = data.payment_method || 'cash'
  const amount = Number(data.amount) || 0

  if (amount <= 0) {
    throw new Error('Expense amount must be greater than 0.')
  }

  // Resolve expense account
  let targetAccountId = data.account_id
  if (!targetAccountId) {
    const catLower = (data.category || '').toLowerCase()
    if (catLower.includes('tea') || catLower.includes('refresh') || catLower.includes('lunch') || catLower.includes('food') || catLower.includes('meal')) {
      targetAccountId = 'acc-tea'
    } else if (catLower.includes('delivery') || catLower.includes('freight') || catLower.includes('transport') || catLower.includes('courier') || catLower.includes('fuel')) {
      targetAccountId = 'acc-delivery'
    } else if (catLower.includes('rent')) {
      targetAccountId = 'acc-rent'
    } else if (catLower.includes('salary') || catLower.includes('wage')) {
      targetAccountId = 'acc-salary'
    } else if (catLower.includes('utilit') || catLower.includes('elect') || catLower.includes('bill') || catLower.includes('gas') || catLower.includes('water') || catLower.includes('internet')) {
      targetAccountId = 'acc-utility'
    } else if (catLower.includes('maint') || catLower.includes('clean') || catLower.includes('repair') || catLower.includes('suppl') || catLower.includes('bag')) {
      targetAccountId = 'acc-maint'
    } else {
      targetAccountId = 'acc-misc-exp'
    }
  }

  // Ensure account exists or fallback
  const accCheck = db2.prepare('SELECT id FROM accounts WHERE id = ?').get(targetAccountId) as {id: string} | undefined
  if (!accCheck) {
    targetAccountId = 'acc-utility'
  }

  db2.prepare(`
    INSERT INTO expenses (
      id, expense_number, date, datetime_created, category, account_id,
      amount, payment_method, payee, description, reference, staff_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, expenseNumber, today, now, data.category, targetAccountId,
    amount, method, data.payee || null, data.description, data.reference || null, userId, now
  )

  // Automatic Double-Entry Journal Entry
  try {
    const cashAcc = method === 'bank' || method === 'card' ? 'acc-bank' : 'acc-cash'
    createJournalEntry({
      date: today,
      description: `Expense [${data.category}]: ${data.description}${data.payee ? ` (Paid to: ${data.payee})` : ''}`,
      reference: expenseNumber,
      lines: [
        { account_id: targetAccountId, debit: amount, credit: 0, description: `${data.category} expense` },
        { account_id: cashAcc, debit: 0, credit: amount, description: `Paid via ${method}` }
      ]
    }, userId)
  } catch (err) {
    console.warn('[Expense] Automatic journal entry creation note:', err)
  }

  logAction(userId, 'CREATE_EXPENSE', 'expenses', id, {
    expense_number: expenseNumber,
    category: data.category,
    amount,
    payment_method: method
  })

  return getExpenseById(id)!
}

export function getExpenseById(id: string): Expense | null {
  return (getDB().prepare(`
    SELECT e.*, a.name as account_name, u.name as staff_name
    FROM expenses e
    LEFT JOIN accounts a ON e.account_id = a.id
    LEFT JOIN users u ON e.staff_id = u.id
    WHERE e.id = ?
  `).get(id) as unknown as Expense | undefined) || null
}

export function getExpenses(fromDate?: string, toDate?: string, category?: string): Expense[] {
  let query = `
    SELECT e.*, a.name as account_name, u.name as staff_name
    FROM expenses e
    LEFT JOIN accounts a ON e.account_id = a.id
    LEFT JOIN users u ON e.staff_id = u.id
    WHERE 1=1
  `
  const params: unknown[] = []
  if (fromDate && toDate) {
    query += ' AND e.date >= ? AND e.date <= ?'
    params.push(fromDate, toDate)
  } else if (fromDate) {
    query += ' AND e.date = ?'
    params.push(fromDate)
  }
  if (category && category !== 'all') {
    query += ' AND e.category = ?'
    params.push(category)
  }
  query += ' ORDER BY e.datetime_created DESC'
  return getDB().prepare(query).all(...params) as unknown as Expense[]
}

export function deleteExpense(id: string, userId: string): void {
  const db2 = getDB()
  const exp = getExpenseById(id)
  if (!exp) throw new Error('Expense not found')

  db2.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  logAction(userId, 'DELETE_EXPENSE', 'expenses', id, { expense_number: exp.expense_number, amount: exp.amount })
}

export function getTodayPOSSummary(userId?: string): {
  date: string
  today_sales: number
  today_invoices_count: number
  today_expenses: number
  today_expenses_count: number
  cash_in_drawer: number
  cash_sales: number
  cash_returns: number
  cash_expenses: number
  bank_sales: number
  card_sales: number
} {
  const today = new Date().toISOString().slice(0, 10)
  const db2 = getDB()

  const invoices = db2.prepare(`
    SELECT * FROM invoices
    WHERE date = ? AND status NOT IN ('voided', 'parked', 'refunded')
  `).all(today) as unknown as Invoice[]

  const expenses = db2.prepare(`
    SELECT * FROM expenses WHERE date = ?
  `).all(today) as unknown as Expense[]

  const returns = db2.prepare(`
    SELECT * FROM returns WHERE date = ? AND status = 'approved'
  `).all(today) as unknown as Return[]

  const todaySales = invoices.reduce((s, i) => s + (i.grand_total || 0), 0)
  const cashSales = invoices.filter(i => {
    const m = (i.payment_method || '').toLowerCase()
    return m === 'cash' || m === 'partial'
  }).reduce((s, i) => s + (i.amount_paid !== undefined && i.amount_paid !== null ? i.amount_paid : (i.grand_total || 0)), 0)
  const cardSales = invoices.filter(i => (i.payment_method || '').toLowerCase() === 'card').reduce((s, i) => s + (i.amount_paid !== undefined && i.amount_paid !== null ? i.amount_paid : (i.grand_total || 0)), 0)
  const bankSales = invoices.filter(i => {
    const m = (i.payment_method || '').toLowerCase()
    return m === 'bank' || m.includes('bank') || m.includes('jazzcash') || m.includes('easypaisa') || m.includes('wallet')
  }).reduce((s, i) => s + (i.amount_paid !== undefined && i.amount_paid !== null ? i.amount_paid : (i.grand_total || 0)), 0)

  const todayExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const cashExpenses = expenses.filter(e => (e.payment_method || '').toLowerCase() === 'cash').reduce((s, e) => s + (e.amount || 0), 0)

  const cashReturns = returns.filter(r => (r.refund_method || '').toLowerCase() === 'cash').reduce((s, r) => s + (r.refund_amount || 0), 0)

  const cashInDrawer = Math.max(0, cashSales - cashReturns - cashExpenses)

  return {
    date: today,
    today_sales: todaySales,
    today_invoices_count: invoices.length,
    today_expenses: todayExpenses,
    today_expenses_count: expenses.length,
    cash_in_drawer: cashInDrawer,
    cash_sales: cashSales,
    cash_returns: cashReturns,
    cash_expenses: cashExpenses,
    bank_sales: bankSales,
    card_sales: cardSales
  }
}

export function getProfitAndLossReport(fromDate: string, toDate: string): ProfitAndLossReport {
  const db2 = getDB()

  // Invoices in range (excluding refunded and voided)
  const sales = db2.prepare(`
    SELECT COALESCE(SUM(subtotal), 0) as gross_subtotal,
           COALESCE(SUM(discount_amount), 0) as total_discounts,
           COALESCE(SUM(grand_total), 0) as total_sales,
           COALESCE(SUM(cost_total), 0) as total_cost,
           COALESCE(SUM(profit * MIN(1.0, MAX(0.0, CASE WHEN grand_total > 0 THEN (amount_paid * 1.0 / grand_total) ELSE 1.0 END))), 0) as total_profit
    FROM invoices
    WHERE date >= ? AND date <= ? AND status NOT IN ('voided', 'parked', 'refunded')
  `).get(fromDate, toDate) as { gross_subtotal: number; total_discounts: number; total_sales: number; total_cost: number; total_profit: number }

  // Returns in range and return profit reversal
  const returnsData = db2.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as total_refunds
    FROM returns
    WHERE date >= ? AND date <= ? AND status = 'approved'
  `).get(fromDate, toDate) as { total_refunds: number }

  let returnProfitReversal = 0
  const returnRows = db2.prepare(`
    SELECT * FROM returns WHERE date >= ? AND date <= ? AND status = 'approved'
  `).all(fromDate, toDate) as unknown as Return[]
  for (const r of returnRows) {
    const rItems = db2.prepare(`
      SELECT ri.qty, ri.unit_price, ri.line_total, i.cost_price
      FROM return_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      WHERE ri.return_id = ?
    `).all(r.id) as { qty: number; unit_price: number; line_total: number; cost_price: number }[]
    for (const ri of rItems) {
      const lineCost = (ri.cost_price || 0) * ri.qty
      returnProfitReversal += Math.max(0, ri.line_total - lineCost)
    }
  }

  const grossSales = sales?.total_sales || 0
  const totalDiscounts = sales?.total_discounts || 0
  const totalReturns = returnsData?.total_refunds || 0
  const totalRevenue = Math.max(0, grossSales - totalReturns)
  const cogs = sales?.total_cost || 0
  const grossProfit = (sales?.total_profit || 0) - returnProfitReversal
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // Direct operating expenses grouped by category
  const expensesByCategory = db2.prepare(`
    SELECT category as account_name,
           COALESCE(SUM(amount), 0) as amount
    FROM expenses
    WHERE date >= ? AND date <= ?
    GROUP BY category
    ORDER BY amount DESC
  `).all(fromDate, toDate) as unknown as { account_name: string; amount: number }[]

  let expenseAccounts: { account_id?: string; account_name: string; amount: number }[] = expensesByCategory
  if (expenseAccounts.length === 0) {
    expenseAccounts = db2.prepare(`
      SELECT a.id as account_id, a.name as account_name,
             COALESCE(SUM(jl.debit - jl.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries j ON jl.entry_id = j.id AND j.date >= ? AND j.date <= ?
      WHERE a.type = 'expense' AND a.id != 'acc-cogs'
      GROUP BY a.id, a.name
      HAVING amount > 0
    `).all(fromDate, toDate) as unknown as { account_id: string; account_name: string; amount: number }[]
  }

  const totalExpenses = expenseAccounts.reduce((s, e) => s + e.amount, 0)
  const netProfit = grossProfit - totalExpenses
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  return {
    from_date: fromDate,
    to_date: toDate,
    gross_sales: grossSales,
    total_discounts: totalDiscounts,
    total_returns: totalReturns,
    total_revenue: totalRevenue,
    cost_of_goods_sold: cogs,
    gross_profit: grossProfit,
    gross_margin_pct: grossMarginPct,
    operating_expenses: expenseAccounts,
    total_expenses: totalExpenses,
    expenses_total: totalExpenses,
    net_profit: netProfit,
    net_margin_pct: netMarginPct
  } as unknown as ProfitAndLossReport
}

export function getDailyEntriesReport(date: string): DailyEntryRow[] {
  return getDB().prepare(`
    SELECT j.id as entry_id, j.entry_number,
           strftime('%H:%M', j.created_at) as time,
           j.description, a.account_code, a.name as account_name,
           jl.debit, jl.credit, u.name as created_by_name
    FROM journal_lines jl
    JOIN journal_entries j ON jl.entry_id = j.id
    JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN users u ON j.created_by = u.id
    WHERE j.date = ?
    ORDER BY j.created_at ASC, jl.id ASC
  `).all(date) as unknown as DailyEntryRow[]
}

// ---------------------------------------------------------------
// PARTY STATEMENTS (Phase 4)
// ---------------------------------------------------------------
export function getCustomerStatement(customerId: string, fromDate?: string, toDate?: string): PartyStatementReport {
  const db2 = getDB()
  const customer = db2.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as unknown as Customer | undefined
  if (!customer) throw new Error('Customer not found')

  const start = fromDate || '2024-01-01'
  const end = toDate || new Date().toISOString().slice(0, 10)

  // 1. Invoices for customer (Debit = grand_total)
  const invoices = db2.prepare(`
    SELECT id, invoice_number as ref_number, date, grand_total as debit, 0 as credit,
           'Sale Invoice #' || invoice_number as description, datetime_created as sort_time,
           'sale_invoice' as type
    FROM invoices
    WHERE customer_id = ? AND date >= ? AND date <= ? AND status NOT IN ('voided', 'parked')
  `).all(customerId, start, end) as unknown as (PartyStatementRow & { sort_time: string })[]

  // 2. Payments received from customer (Credit = amount)
  const payments = db2.prepare(`
    SELECT id, COALESCE(reference, id) as ref_number, date, 0 as debit, amount as credit,
           'Payment Received (' || method || ')' as description, created_at as sort_time,
           'payment_received' as type
    FROM payments_received
    WHERE customer_id = ? AND date >= ? AND date <= ?
  `).all(customerId, start, end) as unknown as (PartyStatementRow & { sort_time: string })[]

  // Combine and sort
  const combined = [...invoices, ...payments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.sort_time || '').localeCompare(b.sort_time || '')
  })

  let running = 0
  let totalDebit = 0
  let totalCredit = 0

  for (const row of combined) {
    running += (row.debit - row.credit)
    row.running_balance = running
    totalDebit += row.debit
    totalCredit += row.credit
  }

  return {
    party_id: customer.id,
    party_name: customer.name,
    party_phone: customer.phone,
    party_type: 'customer',
    from_date: start,
    to_date: end,
    opening_balance: 0,
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: running,
    rows: combined
  }
}

export function getSupplierStatement(supplierId: string, fromDate?: string, toDate?: string): PartyStatementReport {
  const db2 = getDB()
  const supplier = db2.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as unknown as Supplier | undefined
  if (!supplier) throw new Error('Supplier not found')

  const start = fromDate || '2024-01-01'
  const end = toDate || new Date().toISOString().slice(0, 10)

  // 1. Purchases from supplier (Credit / Payable increases)
  const purchases = db2.prepare(`
    SELECT id, purchase_number as ref_number, date, 0 as debit, total_cost as credit,
           'Purchase Order #' || purchase_number as description, created_at as sort_time,
           'purchase_invoice' as type
    FROM purchases
    WHERE supplier_id = ? AND date >= ? AND date <= ?
  `).all(supplierId, start, end) as unknown as (PartyStatementRow & { sort_time: string })[]

  // 2. Payments to supplier (Debit / Payable decreases)
  const payments = db2.prepare(`
    SELECT id, COALESCE(reference, id) as ref_number, date, amount as debit, 0 as credit,
           'Payment Made (' || method || ')' as description, created_at as sort_time,
           'payment_made' as type
    FROM payments_to_suppliers
    WHERE supplier_id = ? AND date >= ? AND date <= ?
  `).all(supplierId, start, end) as unknown as (PartyStatementRow & { sort_time: string })[]

  // Combine and sort
  const combined = [...purchases, ...payments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.sort_time || '').localeCompare(b.sort_time || '')
  })

  let running = 0
  let totalDebit = 0
  let totalCredit = 0

  for (const row of combined) {
    running += (row.credit - row.debit)
    row.running_balance = running
    totalDebit += row.debit
    totalCredit += row.credit
  }

  return {
    party_id: supplier.id,
    party_name: supplier.name,
    party_phone: supplier.contact,
    party_type: 'supplier',
    from_date: start,
    to_date: end,
    opening_balance: 0,
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: running,
    rows: combined
  }
}

// ---------------------------------------------------------------
// DATABASE RESTORE (Phase 4)
// ---------------------------------------------------------------
export function restoreDatabaseFromFile(backupFilePath: string): void {
  const fs = require('fs')
  if (!fs.existsSync(backupFilePath)) {
    throw new Error('Backup file does not exist')
  }
  const bytes = fs.readFileSync(backupFilePath)
  // Verify valid sqlite header
  if (bytes.length < 100 || bytes.slice(0, 16).toString() !== 'SQLite format 3\0') {
    throw new Error('Invalid SQLite database backup file')
  }
}

// ---------------------------------------------------------------
// ENTERPRISE SUITE (Phase 5)
// ---------------------------------------------------------------
export function getAgingReport(type: 'ar' | 'ap'): AgingReportSummary {
  const db2 = getDB()
  const todayStr = new Date().toISOString().slice(0, 10)
  const rows: AgingReportRow[] = []

  let totCurrent = 0
  let tot30 = 0
  let tot60 = 0
  let tot90 = 0
  let grandTot = 0

  if (type === 'ar') {
    // Accounts Receivable from Customers with positive balance
    const customers = db2.prepare('SELECT id, name, phone, balance FROM customers WHERE balance > 0').all() as unknown as Customer[]
    for (const c of customers) {
      // Invoices with pending balance
      const unpaidInvoices = db2.prepare(`
        SELECT date, grand_total, balance_due FROM invoices
        WHERE customer_id = ? AND status NOT IN ('voided', 'parked')
        ORDER BY date ASC
      `).all(c.id) as unknown as { date: string; grand_total: number; balance_due: number }[]

      let remBalance = c.balance
      let current = 0
      let d30 = 0
      let d60 = 0
      let d90 = 0

      // Allocate remaining balance from oldest to newest or by invoice date
      for (const inv of unpaidInvoices) {
        if (remBalance <= 0) break
        const invAgeDays = Math.floor((new Date(todayStr).getTime() - new Date(inv.date).getTime()) / (1000 * 3600 * 24))
        const portion = Math.min(remBalance, inv.grand_total)
        remBalance -= portion

        if (invAgeDays <= 30) current += portion
        else if (invAgeDays <= 60) d30 += portion
        else if (invAgeDays <= 90) d60 += portion
        else d90 += portion
      }

      // If leftover balance beyond listed invoices
      if (remBalance > 0) d90 += remBalance

      const totalDue = current + d30 + d60 + d90
      totCurrent += current
      tot30 += d30
      tot60 += d60
      tot90 += d90
      grandTot += totalDue

      rows.push({
        party_id: c.id,
        party_name: c.name,
        phone: c.phone,
        current,
        days_30: d30,
        days_60: d60,
        days_90: d90,
        total_due: totalDue
      })
    }
  } else {
    // Accounts Payable to Suppliers with positive payable balance
    const suppliers = db2.prepare('SELECT id, name, contact, balance FROM suppliers WHERE balance > 0').all() as unknown as Supplier[]
    for (const s of suppliers) {
      const unpaidPurchases = db2.prepare(`
        SELECT date, total_cost, balance_due FROM purchases
        WHERE supplier_id = ? AND payment_status != 'paid'
        ORDER BY date ASC
      `).all(s.id) as unknown as { date: string; total_cost: number; balance_due: number }[]

      let remBalance = s.balance
      let current = 0
      let d30 = 0
      let d60 = 0
      let d90 = 0

      for (const po of unpaidPurchases) {
        if (remBalance <= 0) break
        const ageDays = Math.floor((new Date(todayStr).getTime() - new Date(po.date).getTime()) / (1000 * 3600 * 24))
        const portion = Math.min(remBalance, po.total_cost)
        remBalance -= portion

        if (ageDays <= 30) current += portion
        else if (ageDays <= 60) d30 += portion
        else if (ageDays <= 90) d60 += portion
        else d90 += portion
      }

      if (remBalance > 0) d90 += remBalance

      const totalDue = current + d30 + d60 + d90
      totCurrent += current
      tot30 += d30
      tot60 += d60
      tot90 += d90
      grandTot += totalDue

      rows.push({
        party_id: s.id,
        party_name: s.name,
        phone: s.contact,
        current,
        days_30: d30,
        days_60: d60,
        days_90: d90,
        total_due: totalDue
      })
    }
  }

  return {
    type,
    as_of_date: todayStr,
    total_current: totCurrent,
    total_30: tot30,
    total_60: tot60,
    total_90: tot90,
    grand_total: grandTot,
    rows
  }
}

export function bulkImportItems(userId: string, items: BulkImportItemInput[]): number {
  const db2 = getDB()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  let count = 0

  for (const item of items) {
    if (!item.part_number || !item.name) continue

    // Find or create brand if provided
    let brandId: string | null = null
    if (item.brand_name) {
      const existingBrand = db2.prepare('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)').get(item.brand_name.trim()) as { id: string } | null
      if (existingBrand) {
        brandId = existingBrand.id
      } else {
        brandId = uuidv4()
        db2.prepare('INSERT INTO brands (id, name) VALUES (?, ?)').run(brandId, item.brand_name.trim())
      }
    }

    // Find or create category if provided
    let catId: string | null = null
    if (item.category_name) {
      const existingCat = db2.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(item.category_name.trim()) as { id: string } | null
      if (existingCat) {
        catId = existingCat.id
      } else {
        catId = uuidv4()
        db2.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(catId, item.category_name.trim())
      }
    }

    const itemId = uuidv4()
    const barcode = item.barcode || item.part_number
    const qty = Number(item.quantity) || 0
    const cost = Number(item.cost_price) || 0
    const retail = Number(item.retail_price) || 0

    // Upsert or insert item
    db2.prepare(`
      INSERT INTO items (
        id, part_number, barcode, name, brand_id, category_id,
        size_variant, cost_price, retail_price, quantity_on_hand, reorder_level,
        is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 1, ?, ?, ?)
    `).run(
      itemId, item.part_number.trim(), barcode.trim(), item.name.trim(),
      brandId, catId, item.size_variant || null,
      cost, retail, qty, userId, now, now
    )

    // Opening Stock transaction
    if (qty > 0) {
      const todayStr = now.slice(0, 10)
      db2.prepare(`
        INSERT INTO stock_transactions (
          id, item_id, type, qty_change, qty_after, reference, user_id, date, notes, created_at
        ) VALUES (?, ?, 'opening', ?, ?, NULL, ?, ?, 'Bulk CSV Import Initial Stock', ?)
      `).run(uuidv4(), itemId, qty, qty, userId, todayStr, now)
    }

    count++
  }

  logAction(userId, 'BULK_IMPORT_ITEMS', 'items', null, { imported_count: count })
  return count
}

export function getAuditLogs(userId?: string, action?: string, fromDate?: string, toDate?: string): AuditLogRow[] {
  const db2 = getDB()
  let sql = `
    SELECT al.id, al.user_id, COALESCE(u.name, 'System') as user_name,
           al.action, al.entity, al.entity_id, al.details, al.created_at
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `
  const params: unknown[] = []

  if (userId) {
    sql += ' AND al.user_id = ?'
    params.push(userId)
  }
  if (action) {
    sql += ' AND al.action LIKE ?'
    params.push(`%${action}%`)
  }
  if (fromDate) {
    sql += ' AND al.created_at >= ?'
    params.push(fromDate + ' 00:00:00')
  }
  if (toDate) {
    sql += ' AND al.created_at <= ?'
    params.push(toDate + ' 23:59:59')
  }

  sql += ' ORDER BY al.created_at DESC LIMIT 200'
  return db2.prepare(sql).all(...params) as unknown as AuditLogRow[]
}

export function getLowStockItems(): Item[] {
  return getDB().prepare(`
    SELECT * FROM items
    WHERE is_active = 1 AND quantity_on_hand <= reorder_level
    ORDER BY quantity_on_hand ASC
  `).all() as unknown as Item[]
}

// ---------------------------------------------------------------
// DATA REINDEX (maintenance)
// ---------------------------------------------------------------
export function reindexData(): { fixed: number; message: string } {
  const db2 = getDB()
  let fixed = 0

  // Recalculate quantity_on_hand for all items
  const items = db2.prepare('SELECT id FROM items').all() as unknown as {id:string}[]
  for (const item of items) {
    const result = db2.prepare(`
      SELECT COALESCE(SUM(qty_change), 0) as total FROM stock_transactions WHERE item_id = ?
    `).get(item.id) as {total: number} | null
    db2.prepare('UPDATE items SET quantity_on_hand = ? WHERE id = ?').run(result?.total || 0, item.id)
    fixed++
  }

  return { fixed, message: `Reindexed ${fixed} items. All quantities recalculated from transaction history.` }
}

// ---------------------------------------------------------------
// TYPE DEFINITIONS (inline for main process)
// ---------------------------------------------------------------
export interface User {
  id: string
  name: string
  username: string
  role: 'owner' | 'manager' | 'salesperson'
  is_active: number
  perm_view_cost_price: number
  perm_view_profit: number
  perm_apply_discount: number
  perm_discount_limit: number
  perm_void_invoice: number
  perm_edit_invoice: number
  perm_process_return: number
  perm_add_edit_stock: number
  perm_record_purchase: number
  perm_view_accounts: number
  perm_view_all_reports: number
  perm_manual_stock_adjust: number
  perm_open_cash_drawer: number
  perm_day_closing: number
  perm_access_maintenance: number
  perm_manage_users: number
  created_at: string
}

export interface UserPermissions {
  perm_view_cost_price?: number
  perm_view_profit?: number
  perm_apply_discount?: number
  perm_discount_limit?: number
  perm_edit_price?: number
  perm_void_invoice?: number
  perm_edit_invoice?: number
  perm_process_return?: number
  perm_add_edit_stock?: number
  perm_record_purchase?: number
  perm_view_accounts?: number
  perm_view_all_reports?: number
  perm_manual_stock_adjust?: number
  perm_open_cash_drawer?: number
  perm_day_closing?: number
  perm_access_maintenance?: number
  perm_manage_users?: number
}

export interface CreateUserInput extends UserPermissions {
  name: string
  username: string
  pin: string
  role: string
}

export interface Item {
  id: string; part_number: string; barcode?: string; name: string
  brand_id?: string; category_id?: string; supplier_id?: string; size_variant?: string
  cost_price: number; retail_price: number; quantity_on_hand: number
  reorder_level: number; is_active: number; created_by: string; created_at: string
}

export interface ItemSearchResult extends Item {
  brand_name?: string; category_name?: string; supplier_name?: string
}

export interface CreateItemInput {
  part_number: string; barcode?: string; name: string
  brand_id?: string; category_id?: string; supplier_id?: string; size_variant?: string
  cost_price: number; retail_price: number; quantity_on_hand?: number; reorder_level?: number
  create_stock_invoice?: boolean
  invoice_ref?: string
  payment_status?: string
  payment_source?: string
  amount_paid?: number
}

export interface InvoiceItem {
  id: string; invoice_id: string; item_id: string
  qty: number; unit_price: number; cost_price: number
  discount_pct: number; line_total: number
  item_name?: string; part_number?: string
}

export interface Invoice {
  id: string; invoice_number: string; date: string; datetime_created: string
  customer_id?: string; customer_name?: string; source: string; status: string
  subtotal: number; discount_amount: number; grand_total: number
  amount_paid: number; balance_due: number; cost_total: number; profit: number
  payment_method: string; staff_id: string; staff_name?: string
  void_reason?: string; voided_by?: string; voided_at?: string
  notes?: string; online_customer_contact?: string; is_locked: number
  items?: InvoiceItem[]
}

export interface CreateInvoiceInput {
  customer_id?: string; source?: string; status?: string
  subtotal: number; discount_amount: number; grand_total: number
  amount_paid: number; balance_due: number; cost_total: number; profit: number
  payment_method?: string; notes?: string; online_customer_contact?: string
  items: { item_id: string; qty: number; unit_price: number; cost_price: number; discount_pct: number; line_total: number }[]
}

export interface UpdateInvoiceItemInput {
  item_id: string
  qty: number
  unit_price: number
  cost_price: number
  discount_pct?: number
  line_total: number
}

export interface UpdateInvoiceInput {
  customer_id?: string | null
  payment_method?: 'cash' | 'card' | 'bank' | 'split' | 'credit'
  discount_amount?: number
  amount_paid?: number
  notes?: string | null
  online_customer_contact?: string | null
  items: UpdateInvoiceItemInput[]
}

export interface Customer {
  id: string; name: string; phone?: string; whatsapp?: string; address?: string
  type: string; balance: number; notes?: string; created_at: string
}

export interface CreateCustomerInput {
  name: string; phone?: string; whatsapp?: string; address?: string; type?: string; notes?: string
}

export interface Supplier {
  id: string; name: string; contact?: string; address?: string; balance: number; notes?: string
}

export interface CreateSupplierInput {
  name: string; contact?: string; address?: string; notes?: string
}

export interface Purchase {
  id: string; purchase_number: string; supplier_id?: string; supplier_name?: string
  date: string; invoice_ref?: string; total_cost: number; amount_paid: number
  balance_due: number; payment_status: string; payment_source?: string; notes?: string; created_by: string
  created_by_name?: string
  items?: {
    id: string
    purchase_id: string
    item_id: string
    item_name?: string
    part_number?: string
    qty: number
    cost_price: number
    line_total: number
  }[]
}

export interface CreatePurchaseInput {
  supplier_id?: string; invoice_ref?: string; total_cost: number
  amount_paid: number; balance_due: number; payment_status?: string; payment_source?: string; notes?: string
  items: { item_id: string; qty: number; cost_price: number; line_total: number }[]
}

export interface QuantityReportRow {
  part_number: string; name: string; size_variant?: string
  brand_name?: string; category_name?: string; supplier_name?: string
  quantity_on_hand: number; cost_price: number; retail_price: number; cost_value: number
}

export interface StockTransaction {
  id: string; item_id: string; type: string; qty_change: number; qty_after: number
  reference?: string; user_id: string; user_name?: string; date: string; notes?: string
}

export interface DailySaleReport {
  date: string
  invoices: (Invoice & {items: InvoiceItem[]})[]
  totals: { total_sales: number; total_cost: number; total_discount: number; total_profit: number; invoice_count: number }
}

export interface StaffSalesReport {
  user_id: string; user_name: string; role: string
  invoice_count: number; total_sales: number; total_cost: number; total_discounts: number; total_profit: number
}

export interface ParkedSale {
  id: string; label?: string; cart_data: string; customer_id?: string; staff_id: string
  staff_name?: string; customer_name?: string; created_at: string
}

export interface Brand { id: string; name: string }
export interface Category { id: string; name: string }

export interface ReturnItem {
  id: string
  return_id: string
  item_id: string
  item_name?: string
  part_number?: string
  qty: number
  unit_price: number
  line_total: number
  restocked: number
}

export interface Return {
  id: string
  return_number: string
  invoice_id?: string
  invoice_number?: string
  customer_name?: string
  date: string
  reason: string
  refund_method: string
  refund_amount: number
  status: string
  processed_by: string
  processed_by_name?: string
  approved_by?: string
  notes?: string
  created_at: string
  items?: ReturnItem[]
}

export interface CreateReturnInput {
  invoice_id?: string
  reason: string
  refund_method?: string
  refund_amount: number
  notes?: string
  items: { item_id: string; qty: number; unit_price: number; line_total: number; restocked: boolean }[]
}

export interface DayClose {
  id: string
  date: string
  total_sales: number
  total_discounts: number
  total_returns: number
  total_profit: number
  cash_sales: number
  card_sales: number
  bank_sales: number
  expected_cash: number
  counted_cash: number
  variance: number
  staff_breakdown?: string
  notes?: string
  signed_by: string
  signed_by_name?: string
  signed_at: string
}

export interface DayCloseCalculation {
  date: string
  total_sales: number
  total_discounts: number
  total_returns: number
  total_profit: number
  total_expenses?: number
  cash_expenses?: number
  expenses_count?: number
  cash_sales: number
  card_sales: number
  bank_sales: number
  jazzcash_sales?: number
  easypaisa_sales?: number
  other_bank_sales?: number
  total_collected?: number
  total_unpaid?: number
  invoice_count: number
  returns_count: number
  expected_cash: number
  staff_breakdown: { user_id: string; name: string; sales: number; invoices: number; cash: number; card?: number; bank?: number }[]
  is_already_closed: boolean
}

export interface Expense {
  id: string
  expense_number: string
  date: string
  datetime_created: string
  category: string
  account_id?: string
  account_name?: string
  amount: number
  payment_method: 'cash' | 'card' | 'bank'
  payee?: string
  description: string
  reference?: string
  staff_id: string
  staff_name?: string
  created_at: string
}

export interface CreateExpenseInput {
  date?: string
  category: string
  amount: number
  payment_method?: 'cash' | 'card' | 'bank'
  payee?: string
  description: string
  reference?: string
  account_id?: string
}

export interface SubmitDayCloseInput {
  date: string
  total_sales: number
  total_discounts: number
  total_returns: number
  total_profit: number
  cash_sales: number
  card_sales: number
  bank_sales: number
  expected_cash: number
  counted_cash: number
  staff_breakdown?: object
  notes?: string
}

export interface Account {
  id: string
  account_code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  balance: number
  is_system: number
  created_at: string
}

export interface JournalLine {
  id: string
  entry_id: string
  account_id: string
  account_code?: string
  account_name?: string
  debit: number
  credit: number
  description?: string
}

export interface JournalEntry {
  id: string
  entry_number: string
  date: string
  description: string
  reference?: string
  created_by: string
  created_by_name?: string
  created_at: string
  lines?: JournalLine[]
  total_debit?: number
  total_credit?: number
}

export interface LedgerRow {
  id: string
  date: string
  entry_number: string
  description: string
  reference?: string
  debit: number
  credit: number
  running_balance: number
}

export interface ProfitAndLossReport {
  from_date: string
  to_date: string
  gross_sales: number
  total_discounts: number
  total_returns: number
  total_revenue: number
  cost_of_goods_sold: number
  gross_profit: number
  gross_margin_pct: number
  operating_expenses: { account_id?: string; account_name: string; amount: number }[]
  total_expenses: number
  net_profit: number
  net_margin_pct: number
}

export interface DailyEntryRow {
  entry_id: string
  entry_number: string
  time: string
  description: string
  account_code: string
  account_name: string
  debit: number
  credit: number
  created_by_name: string
}

export interface PartyStatementRow {
  id: string
  date: string
  type: string
  ref_number: string
  description: string
  debit: number
  credit: number
  running_balance: number
}

export interface PartyStatementReport {
  party_id: string
  party_name: string
  party_phone?: string
  party_type: 'customer' | 'supplier'
  from_date: string
  to_date: string
  opening_balance: number
  total_debit: number
  total_credit: number
  closing_balance: number
  rows: PartyStatementRow[]
}

export interface AgingReportRow {
  party_id: string
  party_name: string
  phone?: string
  current: number
  days_30: number
  days_60: number
  days_90: number
  total_due: number
}

export interface AgingReportSummary {
  type: 'ar' | 'ap'
  as_of_date: string
  total_current: number
  total_30: number
  total_60: number
  total_90: number
  grand_total: number
  rows: AgingReportRow[]
}

export interface AuditLogRow {
  id: string
  user_id: string
  user_name: string
  action: string
  entity: string
  entity_id?: string
  details: string
  created_at: string
}

export interface BulkImportItemInput {
  part_number: string
  name: string
  barcode?: string
  brand_name?: string
  category_name?: string
  size_variant?: string
  cost_price: number
  retail_price: number
  quantity: number
}

// ============================================================
// ITEM SALES & STOCK PERFORMANCE ANALYTICS
// ============================================================
export interface ItemPerformanceRow {
  id: string
  name: string
  part_number: string
  barcode: string
  category_name: string
  brand_name: string
  cost_price: number
  retail_price: number
  quantity_on_hand: number
  reorder_level: number
  units_sold: number
  revenue_generated: number
  cost_total: number
  profit_generated: number
  profit_margin_pct: number
  stock_value_cost: number
  stock_value_retail: number
  velocity: 'fast' | 'moderate' | 'slow' | 'stagnant' | 'out_of_stock'
}

export function getItemSalesPerformance(from?: string, to?: string): {
  items: ItemPerformanceRow[]
  summary: {
    total_units_sold: number
    total_revenue: number
    total_profit: number
    total_inventory_items: number
    total_inventory_units: number
    total_inventory_cost_value: number
    total_inventory_retail_value: number
    fast_movers_count: number
    moderate_movers_count: number
    slow_movers_count: number
    stagnant_count: number
    top_10_units: ItemPerformanceRow[]
    top_10_revenue: ItemPerformanceRow[]
    top_10_profit: ItemPerformanceRow[]
    category_performance: Array<{ name: string; units_sold: number; revenue: number; profit: number; stock_qty: number }>
    brand_performance: Array<{ name: string; units_sold: number; revenue: number; profit: number }>
  }
} {
  const db = getDB()
  let sql = `
    SELECT 
      i.id,
      i.part_number,
      COALESCE(i.barcode, '') as barcode,
      i.name,
      i.cost_price,
      i.retail_price,
      i.quantity_on_hand,
      i.reorder_level,
      COALESCE(b.name, 'Unbranded') as brand_name,
      COALESCE(c.name, 'General') as category_name,
      COALESCE(SUM(ii.qty), 0) as units_sold,
      COALESCE(SUM(ii.line_total), 0) as revenue_generated,
      COALESCE(SUM(ii.cost_price * ii.qty), 0) as cost_total,
      COALESCE(SUM(ii.line_total - (ii.cost_price * ii.qty)), 0) as profit_generated
    FROM items i
    LEFT JOIN brands b ON i.brand_id = b.id
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN invoice_items ii ON ii.item_id = i.id
    LEFT JOIN invoices inv ON ii.invoice_id = inv.id 
      AND inv.status = 'completed'
  `
  const params: unknown[] = []

  if (from && to) {
    sql += ` AND inv.date BETWEEN ? AND ?`
    params.push(from, to)
  }

  sql += `
    WHERE i.is_active = 1
    GROUP BY i.id
    ORDER BY units_sold DESC, revenue_generated DESC
  `

  const rows = db.prepare(sql).all(...params) as any[]

  let totalUnitsSold = 0
  let totalRevenue = 0
  let totalProfit = 0
  let totalInventoryUnits = 0
  let totalInventoryCostValue = 0
  let totalInventoryRetailValue = 0
  let fastMoversCount = 0
  let moderateMoversCount = 0
  let slowMoversCount = 0
  let stagnantCount = 0

  const catMap: Record<string, { units_sold: number; revenue: number; profit: number; stock_qty: number }> = {}
  const brandMap: Record<string, { units_sold: number; revenue: number; profit: number }> = {}

  const items: ItemPerformanceRow[] = rows.map(r => {
    const unitsSold = Number(r.units_sold) || 0
    const revenue = Number(r.revenue_generated) || 0
    const costTotal = Number(r.cost_total) || 0
    const profit = Number(r.profit_generated) || 0
    const qoh = Number(r.quantity_on_hand) || 0
    const costPrice = Number(r.cost_price) || 0
    const retailPrice = Number(r.retail_price) || 0
    const stockCostVal = qoh * costPrice
    const stockRetailVal = qoh * retailPrice
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0

    let velocity: 'fast' | 'moderate' | 'slow' | 'stagnant' | 'out_of_stock' = 'stagnant'
    if (unitsSold >= 8) {
      velocity = 'fast'
      fastMoversCount++
    } else if (unitsSold >= 3) {
      velocity = 'moderate'
      moderateMoversCount++
    } else if (unitsSold > 0) {
      velocity = 'slow'
      slowMoversCount++
    } else if (qoh <= 0) {
      velocity = 'out_of_stock'
    } else {
      velocity = 'stagnant'
      stagnantCount++
    }

    totalUnitsSold += unitsSold
    totalRevenue += revenue
    totalProfit += profit
    totalInventoryUnits += qoh
    totalInventoryCostValue += stockCostVal
    totalInventoryRetailValue += stockRetailVal

    // Category aggregation
    const cat = r.category_name || 'General'
    if (!catMap[cat]) catMap[cat] = { units_sold: 0, revenue: 0, profit: 0, stock_qty: 0 }
    catMap[cat].units_sold += unitsSold
    catMap[cat].revenue += revenue
    catMap[cat].profit += profit
    catMap[cat].stock_qty += qoh

    // Brand aggregation
    const br = r.brand_name || 'Unbranded'
    if (!brandMap[br]) brandMap[br] = { units_sold: 0, revenue: 0, profit: 0 }
    brandMap[br].units_sold += unitsSold
    brandMap[br].revenue += revenue
    brandMap[br].profit += profit

    return {
      id: r.id,
      name: r.name,
      part_number: r.part_number || '',
      barcode: r.barcode || '',
      category_name: cat,
      brand_name: br,
      cost_price: costPrice,
      retail_price: retailPrice,
      quantity_on_hand: qoh,
      reorder_level: Number(r.reorder_level) || 0,
      units_sold: unitsSold,
      revenue_generated: revenue,
      cost_total: costTotal,
      profit_generated: profit,
      profit_margin_pct: marginPct,
      stock_value_cost: stockCostVal,
      stock_value_retail: stockRetailVal,
      velocity
    }
  })

  const top10Units = [...items].sort((a, b) => b.units_sold - a.units_sold).slice(0, 10)
  const top10Revenue = [...items].sort((a, b) => b.revenue_generated - a.revenue_generated).slice(0, 10)
  const top10Profit = [...items].sort((a, b) => b.profit_generated - a.profit_generated).slice(0, 10)

  const categoryPerformance = Object.entries(catMap).map(([name, data]) => ({
    name,
    units_sold: data.units_sold,
    revenue: data.revenue,
    profit: data.profit,
    stock_qty: data.stock_qty
  })).sort((a, b) => b.revenue - a.revenue)

  const brandPerformance = Object.entries(brandMap).map(([name, data]) => ({
    name,
    units_sold: data.units_sold,
    revenue: data.revenue,
    profit: data.profit
  })).sort((a, b) => b.revenue - a.revenue)

  return {
    items,
    summary: {
      total_units_sold: totalUnitsSold,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      total_inventory_items: items.length,
      total_inventory_units: totalInventoryUnits,
      total_inventory_cost_value: totalInventoryCostValue,
      total_inventory_retail_value: totalInventoryRetailValue,
      fast_movers_count: fastMoversCount,
      moderate_movers_count: moderateMoversCount,
      slow_movers_count: slowMoversCount,
      stagnant_count: stagnantCount,
      top_10_units: top10Units,
      top_10_revenue: top10Revenue,
      top_10_profit: top10Profit,
      category_performance: categoryPerformance,
      brand_performance: brandPerformance
    }
  }
}

// ============================================================
// COMPREHENSIVE FINANCIAL VISUALIZATIONS & ANALYTICS
// ============================================================
export interface FinancialAnalyticsTimelineDay {
  date: string
  revenue: number
  cogs: number
  gross_profit: number
  expenses: number
  net_profit: number
  invoices_count: number
}

export interface FinancialAnalyticsReport {
  kpis: {
    gross_revenue: number
    cogs: number
    gross_profit: number
    gross_margin_pct: number
    operating_expenses: number
    net_profit: number
    net_margin_pct: number
    invoices_count: number
    average_order_value: number
  }
  dailyTimeline: FinancialAnalyticsTimelineDay[]
  paymentMethods: Array<{ name: string; count: number; amount: number; pct: number }>
  expenseCategories: Array<{ name: string; count: number; amount: number; pct: number }>
}

export function getFinancialAnalytics(from: string, to: string): FinancialAnalyticsReport {
  const db = getDB()

  // 1. Get official P&L Report for exact financial parity
  const pnl = getProfitAndLossReport(from, to)

  // 2. Invoices in range (excluding refunded and voided)
  const invoices = db.prepare(`
    SELECT * FROM invoices
    WHERE date BETWEEN ? AND ? AND status NOT IN ('voided', 'parked', 'refunded')
    ORDER BY date ASC
  `).all(from, to) as any[]

  // 3. Approved returns in range with line items for daily profit reversal
  const returnRows = db.prepare(`
    SELECT * FROM returns WHERE date >= ? AND date <= ? AND status = 'approved'
  `).all(from, to) as unknown as Return[]

  const dailyReturnMap: Record<string, { refund_amount: number; profit_reversal: number }> = {}
  for (const r of returnRows) {
    const d = r.date
    if (!dailyReturnMap[d]) dailyReturnMap[d] = { refund_amount: 0, profit_reversal: 0 }
    dailyReturnMap[d].refund_amount += Number(r.refund_amount) || 0

    const rItems = db.prepare(`
      SELECT ri.qty, ri.unit_price, ri.line_total, i.cost_price
      FROM return_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      WHERE ri.return_id = ?
    `).all(r.id) as { qty: number; unit_price: number; line_total: number; cost_price: number }[]
    for (const ri of rItems) {
      const lineCost = (ri.cost_price || 0) * ri.qty
      dailyReturnMap[d].profit_reversal += Math.max(0, ri.line_total - lineCost)
    }
  }

  // 4. Expenses in range
  const expenses = db.prepare(`
    SELECT * FROM expenses
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC
  `).all(from, to) as any[]

  const dailyMap: Record<string, FinancialAnalyticsTimelineDay> = {}

  const paymentMethods: Record<string, { count: number; amount: number }> = {}

  for (const inv of invoices) {
    const d = inv.date
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, revenue: 0, cogs: 0, gross_profit: 0, expenses: 0, net_profit: 0, invoices_count: 0 }
    }
    const rev = Number(inv.grand_total) || 0
    const cogs = Number(inv.cost_total) || 0
    const amountPaid = Number(inv.amount_paid) ?? rev
    const paidRatio = rev > 0 ? Math.min(1.0, Math.max(0.0, amountPaid / rev)) : 1.0
    const rawProfit = Number(inv.profit) || (rev - cogs)
    const realizedProfit = rawProfit * paidRatio

    dailyMap[d].revenue += rev
    dailyMap[d].cogs += cogs
    dailyMap[d].gross_profit += realizedProfit
    dailyMap[d].invoices_count += 1

    const pm = (inv.payment_method || 'cash').toLowerCase()
    const pmKey = pm.includes('jazzcash') ? 'JazzCash' :
                  pm.includes('easypaisa') ? 'EasyPaisa' :
                  pm.includes('bank') ? 'Bank Transfer' :
                  pm.includes('card') ? 'Card' :
                  pm.includes('credit') ? 'Khata / Udhar' : 'Cash'

    if (!paymentMethods[pmKey]) paymentMethods[pmKey] = { count: 0, amount: 0 }
    paymentMethods[pmKey].count += 1
    paymentMethods[pmKey].amount += rev
  }

  // Factor in daily returns
  for (const [d, retData] of Object.entries(dailyReturnMap)) {
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, revenue: 0, cogs: 0, gross_profit: 0, expenses: 0, net_profit: 0, invoices_count: 0 }
    }
    dailyMap[d].revenue = Math.max(0, dailyMap[d].revenue - retData.refund_amount)
    dailyMap[d].gross_profit = dailyMap[d].gross_profit - retData.profit_reversal
  }

  const expenseCategories: Record<string, { count: number; amount: number }> = {}

  for (const exp of expenses) {
    const d = exp.date
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, revenue: 0, cogs: 0, gross_profit: 0, expenses: 0, net_profit: 0, invoices_count: 0 }
    }
    const amt = Number(exp.amount) || 0
    dailyMap[d].expenses += amt

    const cat = exp.category || 'General & Misc'
    if (!expenseCategories[cat]) expenseCategories[cat] = { count: 0, amount: 0 }
    expenseCategories[cat].count += 1
    expenseCategories[cat].amount += amt
  }

  const dailyTimeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).map(day => {
    day.net_profit = day.gross_profit - day.expenses
    return day
  })

  const aov = pnl.gross_sales > 0 && invoices.length > 0 ? pnl.gross_sales / invoices.length : 0

  return {
    kpis: {
      gross_revenue: pnl.gross_sales || pnl.total_revenue,
      cogs: pnl.cost_of_goods_sold,
      gross_profit: pnl.gross_profit,
      gross_margin_pct: pnl.gross_margin_pct,
      operating_expenses: pnl.total_expenses,
      net_profit: pnl.net_profit,
      net_margin_pct: pnl.net_margin_pct,
      invoices_count: invoices.length,
      average_order_value: aov
    },
    dailyTimeline,
    paymentMethods: Object.entries(paymentMethods).map(([name, data]) => ({
      name,
      count: data.count,
      amount: data.amount,
      pct: pnl.gross_sales > 0 ? (data.amount / pnl.gross_sales) * 100 : 0
    })),
    expenseCategories: Object.entries(expenseCategories).map(([name, data]) => ({
      name,
      count: data.count,
      amount: data.amount,
      pct: pnl.total_expenses > 0 ? (data.amount / pnl.total_expenses) * 100 : 0
    }))
  }
}
