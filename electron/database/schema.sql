-- ============================================================
-- POS System - SQLite Database Schema
-- Version: 1.0.0
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- USERS & PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  pin_hash    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('owner','manager','salesperson')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  -- Granular permission flags (owner can toggle each per user)
  perm_view_cost_price          INTEGER NOT NULL DEFAULT 0,
  perm_view_profit              INTEGER NOT NULL DEFAULT 0,
  perm_apply_discount           INTEGER NOT NULL DEFAULT 1,
  perm_discount_limit           REAL    NOT NULL DEFAULT 10.0,  -- max % discount
  perm_edit_price               INTEGER NOT NULL DEFAULT 1,     -- allow custom unit price in POS
  perm_void_invoice             INTEGER NOT NULL DEFAULT 0,
  perm_edit_invoice             INTEGER NOT NULL DEFAULT 0,     -- KEY: staff cannot edit invoice unless owner enables
  perm_process_return           INTEGER NOT NULL DEFAULT 0,
  perm_add_edit_stock           INTEGER NOT NULL DEFAULT 0,
  perm_record_purchase          INTEGER NOT NULL DEFAULT 0,
  perm_view_accounts            INTEGER NOT NULL DEFAULT 0,
  perm_view_all_reports         INTEGER NOT NULL DEFAULT 0,
  perm_manual_stock_adjust      INTEGER NOT NULL DEFAULT 0,
  -- Navigation Bar Module Visibility
  perm_pos                      INTEGER NOT NULL DEFAULT 1,
  perm_orders                   INTEGER NOT NULL DEFAULT 1,
  perm_sales                    INTEGER NOT NULL DEFAULT 1,
  perm_barcode                  INTEGER NOT NULL DEFAULT 1,
  perm_customers                INTEGER NOT NULL DEFAULT 1,
  -- Permissions
  perm_open_cash_drawer         INTEGER NOT NULL DEFAULT 0,
  perm_day_closing              INTEGER NOT NULL DEFAULT 0,
  perm_access_maintenance       INTEGER NOT NULL DEFAULT 0,
  perm_manage_users             INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- CATEGORIES & BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id   TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id   TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- ============================================================
-- ITEMS / INVENTORY
-- ============================================================
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

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  whatsapp    TEXT,
  address     TEXT,
  type        TEXT NOT NULL DEFAULT 'walkin' CHECK(type IN ('walkin','regular','online')),
  balance     REAL NOT NULL DEFAULT 0,   -- positive = owes us, negative = credit
  notes       TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT,
  address     TEXT,
  balance     REAL NOT NULL DEFAULT 0,  -- positive = we owe them
  notes       TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- INVOICES / SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  invoice_number  TEXT UNIQUE NOT NULL,
  date            TEXT NOT NULL DEFAULT (date('now','localtime')),
  datetime_created TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  customer_id     TEXT REFERENCES customers(id),
  source          TEXT NOT NULL DEFAULT 'instore' CHECK(source IN ('instore','whatsapp','socialmedia','other')),
  status          TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','confirmed','dispatched','completed','voided','parked','refunded')),
  -- Amounts
  subtotal        REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  grand_total     REAL NOT NULL DEFAULT 0,
  amount_paid     REAL NOT NULL DEFAULT 0,
  balance_due     REAL NOT NULL DEFAULT 0,
  -- Internal fields (NEVER printed on customer receipt)
  cost_total      REAL NOT NULL DEFAULT 0,
  profit          REAL NOT NULL DEFAULT 0,
  -- Payment
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','bank','split','credit')),
  -- Staff
  staff_id        TEXT NOT NULL REFERENCES users(id),
  void_reason     TEXT,
  voided_by       TEXT REFERENCES users(id),
  voided_at       TEXT,
  notes           TEXT,
  online_customer_contact TEXT,
  tracking_number TEXT,
  is_locked       INTEGER NOT NULL DEFAULT 0   -- locked after day close
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES items(id),
  qty         REAL NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL,
  cost_price  REAL NOT NULL,   -- snapshot at time of sale (internal only)
  discount_pct REAL NOT NULL DEFAULT 0,
  line_total  REAL NOT NULL
);

-- ============================================================
-- RETURNS / REFUNDS
-- ============================================================
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

-- ============================================================
-- PURCHASES
-- ============================================================
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

-- ============================================================
-- STOCK TRANSACTIONS (full audit log of all stock movements)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id),
  type        TEXT NOT NULL CHECK(type IN ('purchase','sale','return_in','adjustment','opening')),
  qty_change  REAL NOT NULL,  -- positive = in, negative = out
  qty_after   REAL NOT NULL,
  reference   TEXT,           -- invoice_id, purchase_id, return_id, etc.
  user_id     TEXT NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL DEFAULT (date('now','localtime')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- ACCOUNTS / LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  account_code  TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
  balance       REAL NOT NULL DEFAULT 0,
  is_system     INTEGER NOT NULL DEFAULT 0,   -- system accounts cannot be deleted
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

-- ============================================================
-- PAYMENTS RECEIVED (from credit customers)
-- ============================================================
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

-- ============================================================
-- PAYMENTS TO SUPPLIERS
-- ============================================================
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

-- ============================================================
-- EXPENSES (Daily Operational & Store Expenses)
-- ============================================================
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

-- ============================================================
-- DAY CLOSING
-- ============================================================
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
  staff_breakdown TEXT,   -- JSON
  notes           TEXT,
  signed_by       TEXT NOT NULL REFERENCES users(id),
  signed_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================
-- AUDIT LOG (every significant action)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  details   TEXT,   -- JSON
  ip_addr   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- PARKED SALES (F9 hold)
-- ============================================================
CREATE TABLE IF NOT EXISTS parked_sales (
  id          TEXT PRIMARY KEY,
  label       TEXT,
  cart_data   TEXT NOT NULL,   -- JSON snapshot of cart
  customer_id TEXT REFERENCES customers(id),
  staff_id    TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
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

-- ============================================================
-- DEFAULT SEED DATA
-- ============================================================

-- Default system accounts
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

-- Default system settings
INSERT OR IGNORE INTO settings VALUES
  ('company_name',       'My Store'),
  ('company_address',    'Lahore, Pakistan'),
  ('company_phone',      ''),
  ('currency',           'PKR'),
  ('currency_symbol',    'Rs.'),
  ('receipt_footer',     'Thank you for your purchase!'),
  ('tax_rate',           '0'),
  ('receipt_printer',    '80mm'),
  ('discount_limit_sp',  '10'),
  ('discount_limit_mgr', '20'),
  ('invoice_prefix',     'INV'),
  ('purchase_prefix',    'PO'),
  ('return_prefix',      'RET'),
  ('db_version',         '1');
