import { v4 as uuidv4 } from 'uuid'
import type { DatabaseWrapper } from './db'

export interface SeedResult {
  success: boolean
  message: string
  stats: {
    items: number
    customers: number
    suppliers: number
    invoices: number
    expenses: number
    returns?: number
    online_orders?: number
  }
}

export function seedDemoData(database: DatabaseWrapper, mode: 'if_empty' | 'force' = 'if_empty'): SeedResult {
  const existingItemCount = (database.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number } | null)?.c || 0

  if (mode === 'if_empty' && existingItemCount >= 10) {
    return {
      success: true,
      message: `Database already contains ${existingItemCount} items. Skipping demo seed.`,
      stats: { items: existingItemCount, customers: 0, suppliers: 0, invoices: 0, expenses: 0 }
    }
  }

  console.log(`[SeedDemoData] Seeding comprehensive demo dataset (mode=${mode})...`)

  // 1. Fetch system users
  const users = database.prepare('SELECT id, role, name FROM users').all() as { id: string; role: string; name: string }[]
  const ownerUser = users.find(u => u.role === 'owner') || users[0]
  const managerUser = users.find(u => u.role === 'manager') || ownerUser
  const hassanUser = users.find(u => u.name.toLowerCase().includes('hassan')) || users[1] || ownerUser
  const aliUser = users.find(u => u.name.toLowerCase().includes('ali')) || users[2] || ownerUser
  const staffList = [ownerUser.id, managerUser.id, hassanUser.id, aliUser.id]

  // 2. Clean brand names: rename any remaining 'Al-Deewan' brand to 'House Brand'
  try {
    database.prepare("UPDATE brands SET name = 'House Brand' WHERE name LIKE '%deewan%'").run()
    database.prepare("UPDATE settings SET value = 'INV' WHERE key = 'invoice_prefix' AND (value = 'AD' OR value LIKE '%AD%')").run()
    database.prepare("UPDATE settings SET value = 'My Store' WHERE key = 'company_name' AND (value LIKE '%deewan%' OR value = 'Al-Deewan')").run()
  } catch {}

  // 3. Ensure Brands Exist
  const brandNames = [
    'House Brand',
    'Sapphire',
    'Gul Ahmed',
    'Khaadi',
    'Bonanza Satrangi',
    'Alkaram Studio',
    'Junaid Jamshed',
    'Sana Safinaz',
    'Maria.B',
    'Nishat Linen',
    'Cross Stitch',
    'Limelight'
  ]
  const brandMap = new Map<string, string>()
  for (const bName of brandNames) {
    let row = database.prepare('SELECT id FROM brands WHERE name = ?').get(bName) as { id: string } | null
    if (!row) {
      const bId = uuidv4()
      database.prepare('INSERT INTO brands (id, name) VALUES (?, ?)').run(bId, bName)
      brandMap.set(bName, bId)
    } else {
      brandMap.set(bName, row.id)
    }
  }

  // 4. Ensure Categories Exist
  const categoryNames = [
    '3-Piece Suits',
    '2-Piece Suits',
    'Kurta & Shirts',
    'Fabric & Unstitched',
    'Shawls & Dupattas',
    'Men\'s Ethnic Wear',
    'Footwear & Khussa',
    'Accessories'
  ]
  const catMap = new Map<string, string>()
  for (const cName of categoryNames) {
    let row = database.prepare('SELECT id FROM categories WHERE name = ?').get(cName) as { id: string } | null
    if (!row) {
      const cId = uuidv4()
      database.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(cId, cName)
      catMap.set(cName, cId)
    } else {
      catMap.set(cName, row.id)
    }
  }

  // 5. Seed Suppliers
  const suppliersDef = [
    { name: 'Sapphire Textile Mills', contact: '0300-8456123', address: 'Raiwind Road, Lahore', balance: 65000, notes: 'Primary lawn and luxury unstitched mill' },
    { name: 'Gul Ahmed Wholesale Depot', contact: '0321-9876512', address: 'Cloth Market, Karachi', balance: 120000, notes: 'Cotton and festive collections' },
    { name: 'Alkaram Studio Logistics', contact: '0333-4567890', address: 'Industrial Area, Faisalabad', balance: 45000, notes: 'Direct warehouse distributor' },
    { name: 'Sitara Premium Textiles', contact: '0345-1234567', address: 'Circular Road, Lahore', balance: 0, notes: 'Chiffon, organza & formal fabrics' },
    { name: 'Orient Cloth Distributors', contact: '0312-8765432', address: 'Shah Alam Market, Lahore', balance: 85000, notes: 'Wholesale menswear & ethnic wear' },
    { name: 'Zellbury Wholesale', contact: '0301-7778899', address: 'Tariq Road, Karachi', balance: 30000, notes: 'Ready-to-wear kurtas and pret sets' },
    { name: 'Master Box & Packaging', contact: '0302-3334455', address: 'Urdu Bazar, Lahore', balance: 7500, notes: 'Custom shopping bags and labels' }
  ]
  const supplierMap = new Map<string, string>()
  for (const s of suppliersDef) {
    let row = database.prepare('SELECT id FROM suppliers WHERE name = ?').get(s.name) as { id: string } | null
    if (!row) {
      const sId = uuidv4()
      database.prepare(`
        INSERT INTO suppliers (id, name, contact, address, balance, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','-45 days'))
      `).run(sId, s.name, s.contact, s.address, s.balance, s.notes, ownerUser.id)
      supplierMap.set(s.name, sId)
    } else {
      supplierMap.set(s.name, row.id)
    }
  }

  // 6. Seed Customers
  const customersDef = [
    { name: 'Cash Customer (Walk-in)', phone: '', whatsapp: '', address: '', type: 'walkin', balance: 0, notes: 'Default in-store cash walkin customer' },
    { name: 'Tariq Mahmood', phone: '03004123456', whatsapp: '03004123456', address: 'DHA Phase 6, Lahore', type: 'regular', balance: 0, notes: 'VIP customer, prefers luxury lawn' },
    { name: 'Ayesha Farooq', phone: '03218765432', whatsapp: '03218765432', address: 'Gulberg III, Lahore', type: 'regular', balance: 2500, notes: 'Frequent buyer, bridal inquiry' },
    { name: 'Muhammad Usman', phone: '03335551234', whatsapp: '03335551234', address: 'Model Town, Lahore', type: 'regular', balance: 18500, notes: 'Wholesale & family retail credit client' },
    { name: 'Zainab Bibi', phone: '03459876543', whatsapp: '03459876543', address: 'Clifton Block 4, Karachi', type: 'online', balance: 0, notes: 'Instagram repeat customer' },
    { name: 'Bilal Butt', phone: '03123456789', whatsapp: '03123456789', address: 'Johar Town, Lahore', type: 'regular', balance: 0, notes: 'Menswear & kurta purchaser' },
    { name: 'Fatima Zahra', phone: '03027778899', whatsapp: '03027778899', address: 'Sector F-7/2, Islamabad', type: 'online', balance: 4200, notes: 'WhatsApp order with online advance' },
    { name: 'Hamza Sheikh', phone: '03221112233', whatsapp: '03221112233', address: 'Wapda Town, Lahore', type: 'regular', balance: 0, notes: 'Festive collection regular' },
    { name: 'Sana Mir', phone: '03014445566', whatsapp: '03014445566', address: 'Cantt Officers Colony, Lahore', type: 'regular', balance: 0, notes: 'Prefers Maria.B & Sana Safinaz' },
    { name: 'Kamran Akmal', phone: '03349990011', whatsapp: '03349990011', address: 'Bahria Town, Lahore', type: 'regular', balance: 7500, notes: 'Active ledger customer' },
    { name: 'Nida Yasir', phone: '03156667788', whatsapp: '03156667788', address: 'Gulshan-e-Iqbal, Karachi', type: 'online', balance: 0, notes: 'WhatsApp catalog shopper' },
    { name: 'Owais Khan Wholesale', phone: '03078889900', whatsapp: '03078889900', address: 'G.T. Road, Gujranwala', type: 'regular', balance: 45000, notes: 'Sub-dealer boutique owner' },
    { name: 'Dr. Samina Rizvi', phone: '03234455667', whatsapp: '03234455667', address: 'Shadman, Lahore', type: 'regular', balance: 0, notes: 'Corporate gift buyer' },
    { name: 'Shahid Afridi', phone: '03009988776', whatsapp: '03009988776', address: 'Hayatabad Phase 3, Peshawar', type: 'online', balance: 0, notes: 'Special order shawls & ethnic wear' }
  ]
  const customerMap = new Map<string, string>()
  for (const c of customersDef) {
    let row = database.prepare('SELECT id FROM customers WHERE name = ?').get(c.name) as { id: string } | null
    if (!row) {
      const cId = uuidv4()
      database.prepare(`
        INSERT INTO customers (id, name, phone, whatsapp, address, type, balance, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','-40 days'))
      `).run(cId, c.name, c.phone, c.whatsapp, c.address, c.type, c.balance, c.notes, ownerUser.id)
      customerMap.set(c.name, cId)
    } else {
      customerMap.set(c.name, row.id)
      try {
        database.prepare('UPDATE customers SET phone = ?, whatsapp = ?, address = ?, balance = ? WHERE id = ?')
          .run(c.phone, c.whatsapp, c.address, c.balance, row.id)
      } catch {}
    }
  }

  // 7. Seed Products / Items (32 realistic, branded apparel items)
  const productsDef = [
    // 3-Piece Suits
    { sku: 'SKU-3P-001', barcode: '8901001001', name: 'Sapphire Embroidered 3-Piece Lawn', brand: 'Sapphire', cat: '3-Piece Suits', supp: 'Sapphire Textile Mills', size: 'Unstitched', cost: 3800, retail: 5990, qty: 28, reorder: 5 },
    { sku: 'SKU-3P-002', barcode: '8901001002', name: 'Gul Ahmed Festive Chiffon 3-Piece', brand: 'Gul Ahmed', cat: '3-Piece Suits', supp: 'Gul Ahmed Wholesale Depot', size: 'Unstitched', cost: 4500, retail: 7200, qty: 22, reorder: 5 },
    { sku: 'SKU-3P-003', barcode: '8901001003', name: 'Maria.B Wedding Edition Silk Suit', brand: 'Maria.B', cat: '3-Piece Suits', supp: 'Sapphire Textile Mills', size: 'Unstitched', cost: 7500, retail: 12500, qty: 14, reorder: 4 },
    { sku: 'SKU-3P-004', barcode: '8901001004', name: 'Sana Safinaz Muzlin Printed 3-Piece', brand: 'Sana Safinaz', cat: '3-Piece Suits', supp: 'Gul Ahmed Wholesale Depot', size: 'Unstitched', cost: 3200, retail: 4990, qty: 35, reorder: 5 },
    { sku: 'SKU-3P-005', barcode: '8901001005', name: 'Cross Stitch Embroidered Velvet 3-Piece', brand: 'Cross Stitch', cat: '3-Piece Suits', supp: 'Sitara Premium Textiles', size: 'Unstitched', cost: 6200, retail: 9800, qty: 12, reorder: 4 },
    { sku: 'SKU-3P-006', barcode: '8901001006', name: 'Alkaram Digital Lawn 3-Piece', brand: 'Alkaram Studio', cat: '3-Piece Suits', supp: 'Alkaram Studio Logistics', size: 'Unstitched', cost: 2800, retail: 4200, qty: 40, reorder: 6 },
    { sku: 'SKU-3P-007', barcode: '8901001007', name: 'Khaadi Stitched Jacquard Suit (M)', brand: 'Khaadi', cat: '3-Piece Suits', supp: 'Sapphire Textile Mills', size: 'M', cost: 4800, retail: 7500, qty: 18, reorder: 5 },
    { sku: 'SKU-3P-008', barcode: '8901001008', name: 'Khaadi Stitched Jacquard Suit (L)', brand: 'Khaadi', cat: '3-Piece Suits', supp: 'Sapphire Textile Mills', size: 'L', cost: 4800, retail: 7500, qty: 16, reorder: 5 },

    // 2-Piece Suits
    { sku: 'SKU-2P-001', barcode: '8901002001', name: 'Limelight Printed Lawn 2-Piece', brand: 'Limelight', cat: '2-Piece Suits', supp: 'Zellbury Wholesale', size: 'Free Size', cost: 1800, retail: 2850, qty: 32, reorder: 5 },
    { sku: 'SKU-2P-002', barcode: '8901002002', name: 'Sapphire Daily Wear Linen 2-Piece (M)', brand: 'Sapphire', cat: '2-Piece Suits', supp: 'Sapphire Textile Mills', size: 'M', cost: 2400, retail: 3690, qty: 24, reorder: 5 },
    { sku: 'SKU-2P-003', barcode: '8901002003', name: 'Sapphire Daily Wear Linen 2-Piece (L)', brand: 'Sapphire', cat: '2-Piece Suits', supp: 'Sapphire Textile Mills', size: 'L', cost: 2400, retail: 3690, qty: 20, reorder: 5 },
    { sku: 'SKU-2P-004', barcode: '8901002004', name: 'Bonanza Embroidered Cotton 2-Piece', brand: 'Bonanza Satrangi', cat: '2-Piece Suits', supp: 'Orient Cloth Distributors', size: 'M', cost: 2900, retail: 4500, qty: 19, reorder: 5 },
    { sku: 'SKU-2P-005', barcode: '8901002005', name: 'House Brand Casual Cambric 2-Piece', brand: 'House Brand', cat: '2-Piece Suits', supp: 'Orient Cloth Distributors', size: 'M', cost: 1500, retail: 2400, qty: 45, reorder: 6 },

    // Kurta & Shirts
    { sku: 'SKU-KRT-001', barcode: '8901003001', name: 'J. Men Premium Cotton Kurta (White / 40)', brand: 'Junaid Jamshed', cat: 'Kurta & Shirts', supp: 'Orient Cloth Distributors', size: 'M', cost: 2200, retail: 3850, qty: 26, reorder: 5 },
    { sku: 'SKU-KRT-002', barcode: '8901003002', name: 'J. Men Premium Cotton Kurta (White / 42)', brand: 'Junaid Jamshed', cat: 'Kurta & Shirts', supp: 'Orient Cloth Distributors', size: 'L', cost: 2200, retail: 3850, qty: 22, reorder: 5 },
    { sku: 'SKU-KRT-003', barcode: '8901003003', name: 'Gul Ahmed Festive Men Kurta (Black)', brand: 'Gul Ahmed', cat: 'Kurta & Shirts', supp: 'Gul Ahmed Wholesale Depot', size: 'L', cost: 2600, retail: 4200, qty: 18, reorder: 4 },
    { sku: 'SKU-KRT-004', barcode: '8901003004', name: 'Limelight Fusion Embroidered Kurti', brand: 'Limelight', cat: 'Kurta & Shirts', supp: 'Zellbury Wholesale', size: 'S', cost: 1400, retail: 2290, qty: 25, reorder: 4 },
    { sku: 'SKU-KRT-005', barcode: '8901003005', name: 'Khaadi Short Casual Kurti', brand: 'Khaadi', cat: 'Kurta & Shirts', supp: 'Sapphire Textile Mills', size: 'M', cost: 1300, retail: 2150, qty: 30, reorder: 5 },

    // Fabric & Unstitched
    { sku: 'SKU-FAB-001', barcode: '8901004001', name: 'Nishat Linen Boski Fabric (7 Meters)', brand: 'Nishat Linen', cat: 'Fabric & Unstitched', supp: 'Orient Cloth Distributors', size: '7 Mtrs', cost: 3500, retail: 5500, qty: 25, reorder: 5 },
    { sku: 'SKU-FAB-002', barcode: '8901004002', name: 'Egyptian Giza Cotton Unstitched', brand: 'House Brand', cat: 'Fabric & Unstitched', supp: 'Orient Cloth Distributors', size: '4.5 Mtrs', cost: 2800, retail: 4600, qty: 30, reorder: 5 },
    { sku: 'SKU-FAB-003', barcode: '8901004003', name: 'Pure Karandi Winter Fabric (4.5m)', brand: 'Gul Ahmed', cat: 'Fabric & Unstitched', supp: 'Gul Ahmed Wholesale Depot', size: '4.5 Mtrs', cost: 3200, retail: 5200, qty: 20, reorder: 4 },

    // Shawls & Dupattas
    { sku: 'SKU-SHW-001', barcode: '8901005001', name: 'Pure Cashmere Woolen Shawl (Men)', brand: 'Bonanza Satrangi', cat: 'Shawls & Dupattas', supp: 'Orient Cloth Distributors', size: 'Free Size', cost: 4200, retail: 6990, qty: 15, reorder: 3 },
    { sku: 'SKU-SHW-002', barcode: '8901005002', name: 'Hand-Embroidered Pashmina Shawl (Black)', brand: 'House Brand', cat: 'Shawls & Dupattas', supp: 'Sitara Premium Textiles', size: 'Free Size', cost: 5500, retail: 8900, qty: 10, reorder: 3 },
    { sku: 'SKU-SHW-003', barcode: '8901005003', name: 'Chiffon Crinkle Dupatta (Multi)', brand: 'House Brand', cat: 'Shawls & Dupattas', supp: 'Sitara Premium Textiles', size: 'Free Size', cost: 650, retail: 1200, qty: 50, reorder: 8 },

    // Men's Ethnic Wear
    { sku: 'SKU-ETH-001', barcode: '8901006001', name: 'J. Classic Shalwar Kameez Suit (Navy / M)', brand: 'Junaid Jamshed', cat: 'Men\'s Ethnic Wear', supp: 'Orient Cloth Distributors', size: 'M', cost: 3600, retail: 5990, qty: 22, reorder: 5 },
    { sku: 'SKU-ETH-002', barcode: '8901006002', name: 'J. Classic Shalwar Kameez Suit (Navy / L)', brand: 'Junaid Jamshed', cat: 'Men\'s Ethnic Wear', supp: 'Orient Cloth Distributors', size: 'L', cost: 3600, retail: 5990, qty: 18, reorder: 5 },
    { sku: 'SKU-ETH-003', barcode: '8901006003', name: 'Bonanza Wool Blend Prince Waistcoat (40)', brand: 'Bonanza Satrangi', cat: 'Men\'s Ethnic Wear', supp: 'Orient Cloth Distributors', size: '40', cost: 3100, retail: 5200, qty: 14, reorder: 3 },

    // Footwear & Khussa
    { sku: 'SKU-FTW-001', barcode: '8901007001', name: 'Handmade Leather Peshawari Chappal (42)', brand: 'House Brand', cat: 'Footwear & Khussa', supp: 'Orient Cloth Distributors', size: '42', cost: 2100, retail: 3600, qty: 16, reorder: 4 },
    { sku: 'SKU-FTW-002', barcode: '8901007002', name: 'Handmade Leather Peshawari Chappal (43)', brand: 'House Brand', cat: 'Footwear & Khussa', supp: 'Orient Cloth Distributors', size: '43', cost: 2100, retail: 3600, qty: 14, reorder: 4 },
    { sku: 'SKU-FTW-003', barcode: '8901007003', name: 'Tilla Embroidered Bridal Khussa (38)', brand: 'House Brand', cat: 'Footwear & Khussa', supp: 'Sitara Premium Textiles', size: '38', cost: 1800, retail: 3200, qty: 12, reorder: 3 },

    // Low Stock Alert items (for stock alert badges demonstration!)
    { sku: 'SKU-LOW-001', barcode: '8901008001', name: 'Limited Edition Zari Net Dupatta', brand: 'Sana Safinaz', cat: 'Shawls & Dupattas', supp: 'Sitara Premium Textiles', size: 'Free Size', cost: 1900, retail: 3400, qty: 2, reorder: 5 },
    { sku: 'SKU-LOW-002', barcode: '8901008002', name: 'Silk Organza Formal Kurti (Small)', brand: 'Maria.B', cat: 'Kurta & Shirts', supp: 'Sapphire Textile Mills', size: 'S', cost: 3200, retail: 5600, qty: 3, reorder: 5 }
  ]

  const itemMap = new Map<string, any>()
  for (const p of productsDef) {
    const bId = brandMap.get(p.brand) || null
    const cId = catMap.get(p.cat) || null
    const sId = supplierMap.get(p.supp) || null

    let row = database.prepare('SELECT id FROM items WHERE part_number = ?').get(p.sku) as { id: string } | null
    if (!row) {
      const pId = uuidv4()
      database.prepare(`
        INSERT INTO items (
          id, part_number, barcode, name, brand_id, category_id, supplier_id,
          size_variant, cost_price, retail_price, quantity_on_hand, reorder_level,
          is_active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now','-35 days'), datetime('now','-1 days'))
      `).run(pId, p.sku, p.barcode, p.name, bId, cId, sId, p.size, p.cost, p.retail, p.qty, p.reorder, ownerUser.id)
      itemMap.set(p.sku, { id: pId, ...p })
    } else {
      // Update existing item details
      database.prepare(`
        UPDATE items SET
          barcode = ?, name = ?, brand_id = ?, category_id = ?, supplier_id = ?,
          size_variant = ?, cost_price = ?, retail_price = ?, quantity_on_hand = ?, reorder_level = ?, is_active = 1
        WHERE id = ?
      `).run(p.barcode, p.name, bId, cId, sId, p.size, p.cost, p.retail, p.qty, p.reorder, row.id)
      itemMap.set(p.sku, { id: row.id, ...p })
    }
  }

  // 8. Seed Purchases & Stock Movements
  const purchasesDef = [
    { num: 'PO-2026-101', supp: 'Sapphire Textile Mills', date: '2026-08-05', cost: 150000, paid: 100000, bal: 50000, status: 'partial' },
    { num: 'PO-2026-102', supp: 'Gul Ahmed Wholesale Depot', date: '2026-08-12', cost: 220000, paid: 150000, bal: 70000, status: 'partial' },
    { num: 'PO-2026-103', supp: 'Orient Cloth Distributors', date: '2026-08-18', cost: 185000, paid: 120000, bal: 65000, status: 'partial' },
    { num: 'PO-2026-104', supp: 'Alkaram Studio Logistics', date: '2026-08-25', cost: 110000, paid: 75000, bal: 35000, status: 'partial' },
    { num: 'PO-2026-105', supp: 'Sitara Premium Textiles', date: '2026-09-02', cost: 85000, paid: 85000, bal: 0, status: 'paid' },
    { num: 'PO-2026-106', supp: 'Zellbury Wholesale', date: '2026-09-08', cost: 95000, paid: 65000, bal: 30000, status: 'partial' },
    { num: 'PO-2026-107', supp: 'Master Box & Packaging', date: '2026-09-12', cost: 18500, paid: 11000, bal: 7500, status: 'partial' }
  ]
  for (const po of purchasesDef) {
    let row = database.prepare('SELECT id FROM purchases WHERE purchase_number = ?').get(po.num) as { id: string } | null
    if (!row) {
      const poId = uuidv4()
      const sId = supplierMap.get(po.supp) || null
      database.prepare(`
        INSERT INTO purchases (
          id, purchase_number, supplier_id, date, invoice_ref, total_cost,
          amount_paid, balance_due, payment_status, payment_source, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bank', 'Bulk seasonal inventory dispatch', ?, ? || ' 10:00:00')
      `).run(poId, po.num, sId, po.date, 'SUP-INV-' + po.num.slice(-3), po.cost, po.paid, po.bal, po.status, ownerUser.id, po.date)
    }
  }

  // 9. Seed Invoices Across Last 30 Days (2026-08-20 to 2026-09-18)
  const allProductItems = Array.from(itemMap.values())
  const regularCustomers = Array.from(customerMap.entries()).filter(([name]) => !name.includes('Walk-in'))
  const walkInId = customerMap.get('Cash Customer (Walk-in)') || null

  const targetInvoiceCount = 75
  const currentInvCount = (database.prepare('SELECT COUNT(*) as c FROM invoices').get() as { c: number } | null)?.c || 0

  if (currentInvCount < 50 || mode === 'force') {
    console.log('[SeedDemoData] Generating 75 realistic invoices spanning last 30 days...')

    // Generate dates across 30 days (Aug 20 to Sep 18, 2026)
    const dates: string[] = []
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const d = new Date(2026, 8, 18) // Sep 18, 2026
      d.setDate(d.getDate() - dayOffset)
      const dateStr = d.toISOString().slice(0, 10)
      // 2 to 4 invoices per day
      const countForDay = (dayOffset === 0 ? 5 : (dayOffset % 7 === 0 || dayOffset % 7 === 1 ? 4 : 2))
      for (let k = 0; k < countForDay; k++) {
        dates.push(dateStr)
      }
    }

    let invIdx = 1001
    for (const invDate of dates.slice(0, targetInvoiceCount)) {
      const invNum = `INV-2026-${String(invIdx++).padStart(4, '0')}`
      // Check if invoice number already exists
      const existing = database.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(invNum)
      if (existing) continue

      const invId = uuidv4()
      const staffId = staffList[invIdx % staffList.length]
      const isOnline = (invIdx % 9 === 0)
      const isPending = isOnline && (invDate >= '2026-09-17')
      const isConfirmed = isOnline && (invDate === '2026-09-16')
      const isDispatched = isOnline && (invDate === '2026-09-15')

      let status = 'completed'
      let source = 'instore'
      let trackingNumber: string | null = null
      let onlineContact: string | null = null

      if (isPending) {
        status = 'pending'
        source = 'whatsapp'
        onlineContact = '03027778899'
      } else if (isConfirmed) {
        status = 'confirmed'
        source = 'whatsapp'
        onlineContact = '03459876543'
      } else if (isDispatched) {
        status = 'dispatched'
        source = 'socialmedia'
        trackingNumber = `TCS-${8900000 + invIdx}`
        onlineContact = '03156667788'
      }

      // Customer selection
      let custId = walkInId
      if (invIdx % 3 === 0) {
        const custPair = regularCustomers[invIdx % regularCustomers.length]
        if (custPair) custId = custPair[1]
      }

      // Pick 1 to 3 items
      const numItems = (invIdx % 4 === 0 ? 3 : (invIdx % 2 === 0 ? 2 : 1))
      const selectedProducts: any[] = []
      for (let s = 0; s < numItems; s++) {
        const pItem = allProductItems[(invIdx + s * 7) % allProductItems.length]
        if (pItem) selectedProducts.push(pItem)
      }

      let subtotal = 0
      let costTotal = 0
      const invoiceItemRows: any[] = []

      for (const prod of selectedProducts) {
        const qty = (invIdx % 5 === 0 && numItems === 1 ? 2 : 1)
        const unitPrice = prod.retail
        const costPrice = prod.cost
        const lineTotal = unitPrice * qty
        subtotal += lineTotal
        costTotal += costPrice * qty

        invoiceItemRows.push({
          id: uuidv4(),
          invoice_id: invId,
          item_id: prod.id,
          qty,
          unit_price: unitPrice,
          cost_price: costPrice,
          discount_pct: 0,
          line_total: lineTotal
        })
      }

      // Discount (optional 5% or 10% on occasional invoices)
      let discountAmount = 0
      if (invIdx % 6 === 0 && subtotal > 4000) {
        discountAmount = Math.round(subtotal * 0.05)
      }
      const grandTotal = subtotal - discountAmount
      const profit = grandTotal - costTotal

      // Payment method
      const paymentMethods = ['cash', 'card', 'bank', 'cash', 'cash', 'card']
      const paymentMethod = (custId && custId !== walkInId && invIdx % 7 === 0) ? 'credit' : paymentMethods[invIdx % paymentMethods.length]
      const amountPaid = (status === 'pending') ? 0 : (paymentMethod === 'credit' ? 0 : grandTotal)
      const balanceDue = grandTotal - amountPaid

      const hour = 11 + (invIdx % 9)
      const minute = (invIdx * 17) % 60
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
      const datetimeCreated = `${invDate} ${timeStr}`

      database.prepare(`
        INSERT INTO invoices (
          id, invoice_number, date, datetime_created, customer_id, source, status,
          subtotal, discount_amount, grand_total, amount_paid, balance_due,
          cost_total, profit, payment_method, staff_id, void_reason, notes,
          online_customer_contact, tracking_number, is_locked
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, NULL, ?,
          ?, ?, 0
        )
      `).run(
        invId, invNum, invDate, datetimeCreated, custId, source, status,
        subtotal, discountAmount, grandTotal, amountPaid, balanceDue,
        costTotal, profit, paymentMethod, staffId,
        isOnline ? 'Online customer checkout' : null,
        onlineContact, trackingNumber
      )

      for (const itemRow of invoiceItemRows) {
        database.prepare(`
          INSERT INTO invoice_items (
            id, invoice_id, item_id, qty, unit_price, cost_price, discount_pct, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          itemRow.id, itemRow.invoice_id, itemRow.item_id, itemRow.qty,
          itemRow.unit_price, itemRow.cost_price, itemRow.discount_pct, itemRow.line_total
        )

        // Insert stock transaction for sales
        if (status === 'completed') {
          database.prepare(`
            INSERT INTO stock_transactions (
              id, item_id, type, qty_change, qty_after, reference, user_id, date, notes, created_at
            ) VALUES (?, ?, 'sale', ?, (SELECT quantity_on_hand FROM items WHERE id = ?), ?, ?, ?, 'Sale invoice POS checkout', ?)
          `).run(uuidv4(), itemRow.item_id, -itemRow.qty, itemRow.item_id, invNum, staffId, invDate, datetimeCreated)
        }
      }
    }
  }

  // 10. Seed Operational Expenses (16 realistic expenses across the past month)
  const expensesDef = [
    { num: 'EXP-2026-001', date: '2026-08-22', cat: 'Rent', amount: 85000, method: 'bank', payee: 'Malik Riaz (Property Owner)', desc: 'Store monthly rent - Main Boulevard' },
    { num: 'EXP-2026-002', date: '2026-08-25', cat: 'Utilities', amount: 38450, method: 'bank', payee: 'LESCO Commercial', desc: 'August commercial electricity tariff bill' },
    { num: 'EXP-2026-003', date: '2026-08-28', cat: 'Tea & Refreshments', amount: 480, method: 'cash', payee: 'Al-Madina Tea Stall', desc: 'Staff morning & evening tea & snacks' },
    { num: 'EXP-2026-004', date: '2026-08-30', cat: 'Packaging', amount: 14500, method: 'cash', payee: 'Master Box & Packaging', desc: '500 Luxury matte laminated shopping bags' },
    { num: 'EXP-2026-005', date: '2026-09-02', cat: 'Utilities', amount: 4200, method: 'bank', payee: 'PTCL Flash Fiber', desc: '100 Mbps store broadband internet bill' },
    { num: 'EXP-2026-006', date: '2026-09-04', cat: 'Shop Maintenance', amount: 6500, method: 'cash', payee: 'Farooq AC Services', desc: 'HVAC AC filter cleaning & gas checkup' },
    { num: 'EXP-2026-007', date: '2026-09-06', cat: 'General Expenses', amount: 18000, method: 'card', payee: 'Meta Ads Manager', desc: 'Eid & festive lawn Facebook/Instagram campaign' },
    { num: 'EXP-2026-008', date: '2026-09-08', cat: 'General Expenses', amount: 3500, method: 'cash', payee: 'Decent Chemical Store', desc: 'Shop floor cleaner, air freshener & napkins' },
    { num: 'EXP-2026-009', date: '2026-09-09', cat: 'Delivery & Freight', amount: 5200, method: 'cash', payee: 'TCS Express Courier', desc: 'Advance bulk shipment courier flyers' },
    { num: 'EXP-2026-010', date: '2026-09-11', cat: 'Shop Maintenance', amount: 4800, method: 'cash', payee: 'Paper World Urdu Bazar', desc: '50 Rolls 80mm thermal receipt printer paper' },
    { num: 'EXP-2026-011', date: '2026-09-13', cat: 'Tea & Refreshments', amount: 650, method: 'cash', payee: 'Al-Madina Tea Stall', desc: 'Staff lunch refreshments & tea' },
    { num: 'EXP-2026-012', date: '2026-09-14', cat: 'General Expenses', amount: 2800, method: 'cash', payee: 'Gulberg Stationery', desc: 'Barcode label ribbon & thermal sticker rolls' },
    { num: 'EXP-2026-013', date: '2026-09-15', cat: 'Tea & Refreshments', amount: 550, method: 'cash', payee: 'Al-Madina Tea Stall', desc: 'Daily staff tea refreshments' },
    { num: 'EXP-2026-014', date: '2026-09-16', cat: 'Delivery & Freight', amount: 3200, method: 'cash', payee: 'Leopard Courier Express', desc: 'Dispatch rider charges for city deliveries' },
    { num: 'EXP-2026-015', date: '2026-09-17', cat: 'Tea & Refreshments', amount: 520, method: 'cash', payee: 'Al-Madina Tea Stall', desc: 'Daily staff tea refreshments' },
    { num: 'EXP-2026-016', date: '2026-09-18', cat: 'Tea & Refreshments', amount: 600, method: 'cash', payee: 'Al-Madina Tea Stall', desc: 'Today morning tea & bakery biscuits' }
  ]

  for (const exp of expensesDef) {
    let row = database.prepare('SELECT id FROM expenses WHERE expense_number = ?').get(exp.num) as { id: string } | null
    if (!row) {
      const expId = uuidv4()
      database.prepare(`
        INSERT INTO expenses (
          id, expense_number, date, datetime_created, category, amount,
          payment_method, payee, description, staff_id, created_at
        ) VALUES (?, ?, ?, ? || ' 12:30:00', ?, ?, ?, ?, ?, ?, ? || ' 12:30:00')
      `).run(expId, exp.num, exp.date, exp.date, exp.cat, exp.amount, exp.method, exp.payee, exp.desc, ownerUser.id, exp.date)
    }
  }

  // 11. Seed Day Close Records (past 5 days)
  const dayCloseDates = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  for (const dcDate of dayCloseDates) {
    let existing = database.prepare('SELECT id FROM day_closes WHERE date = ?').get(dcDate)
    if (!existing) {
      const dcId = uuidv4()
      // Calculate totals from invoices on that date
      const invStats = database.prepare(`
        SELECT
          COUNT(*) as cnt,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(discount_amount), 0) as total_discounts,
          COALESCE(SUM(profit), 0) as total_profit,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_paid ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount_paid ELSE 0 END), 0) as card_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'bank' THEN amount_paid ELSE 0 END), 0) as bank_sales
        FROM invoices
        WHERE date = ? AND status = 'completed'
      `).get(dcDate) as any

      const tSales = invStats?.total_sales || 35000
      const cSales = invStats?.cash_sales || 24000
      const cardSales = invStats?.card_sales || 11000
      const bSales = invStats?.bank_sales || 0

      database.prepare(`
        INSERT INTO day_closes (
          id, date, total_sales, total_discounts, total_returns, total_profit,
          cash_sales, card_sales, bank_sales, expected_cash, counted_cash, variance,
          staff_breakdown, notes, signed_by, signed_at
        ) VALUES (
          ?, ?, ?, ?, 0, ?,
          ?, ?, ?, ?, ?, 0,
          ?, 'Day closed without cash variance. Night deposit verified.', ?, ? || ' 22:15:00'
        )
      `).run(
        dcId, dcDate, tSales, invStats?.total_discounts || 0, invStats?.total_profit || 12000,
        cSales, cardSales, bSales, cSales, cSales,
        JSON.stringify({ note: 'Verified by register supervisor' }),
        ownerUser.id, dcDate
      )
    }
  }

  // 12. Seed Parked Sales (for F9 resume demo!)
  try {
    const parkedCount = (database.prepare('SELECT COUNT(*) as c FROM parked_sales').get() as { c: number } | null)?.c || 0
    if (parkedCount === 0) {
      const pItem1 = allProductItems[0]
      const pItem2 = allProductItems[2]
      const sampleCart = [
        { item: pItem1, qty: 1, unitPrice: pItem1.retail, discountPct: 0, lineTotal: pItem1.retail },
        { item: pItem2, qty: 1, unitPrice: pItem2.retail, discountPct: 5, lineTotal: Math.round(pItem2.retail * 0.95) }
      ]
      database.prepare(`
        INSERT INTO parked_sales (id, label, cart_data, customer_id, staff_id, created_at)
        VALUES (?, 'Customer went to ATM machine', ?, ?, ?, datetime('now','-2 hours'))
      `).run(uuidv4(), JSON.stringify(sampleCart), customerMap.get('Tariq Mahmood') || null, hassanUser.id)

      const sampleCart2 = [
        { item: allProductItems[1], qty: 2, unitPrice: allProductItems[1].retail, discountPct: 0, lineTotal: allProductItems[1].retail * 2 }
      ]
      database.prepare(`
        INSERT INTO parked_sales (id, label, cart_data, customer_id, staff_id, created_at)
        VALUES (?, 'VIP fitting room selection hold', ?, ?, ?, datetime('now','-45 minutes'))
      `).run(uuidv4(), JSON.stringify(sampleCart2), customerMap.get('Ayesha Farooq') || null, aliUser.id)
    }
  } catch {}

  // 13. Seed Explicit Online & WhatsApp Orders across all workflow statuses
  const onlineOrdersDef = [
    {
      num: 'INV-2026-0901',
      date: '2026-09-18',
      time: '10:15:00',
      source: 'whatsapp',
      status: 'pending',
      cust: 'Ayesha Farooq',
      contact: '0300-8451294, House 42-A, DHA Phase 5, Lahore',
      items: [{ item: allProductItems[0], qty: 1 }],
      notes: 'WhatsApp order — customer requested size confirmation',
      tracking: null
    },
    {
      num: 'INV-2026-0902',
      date: '2026-09-18',
      time: '10:45:00',
      source: 'socialmedia',
      status: 'pending',
      cust: 'Fatima Zahra',
      contact: '0321-4567890, Flat 304, Askari 11, Lahore',
      items: [{ item: allProductItems[1], qty: 1 }, { item: allProductItems[2], qty: 1 }],
      notes: 'Instagram DM order — customer requested evening rider delivery',
      tracking: null
    },
    {
      num: 'INV-2026-0903',
      date: '2026-09-17',
      time: '15:20:00',
      source: 'whatsapp',
      status: 'pending',
      cust: 'Zainab Bibi',
      contact: '0334-1122334, Street 9, F-7/2, Islamabad',
      items: [{ item: allProductItems[5], qty: 1 }],
      notes: 'Customer sent bank deposit screenshot, awaiting cashier confirmation',
      tracking: null
    },
    {
      num: 'INV-2026-0904',
      date: '2026-09-17',
      time: '16:40:00',
      source: 'whatsapp',
      status: 'confirmed',
      cust: 'Sara Ahmed',
      contact: '0301-2345678, Bungalow 12-B, Model Town, Lahore',
      items: [{ item: allProductItems[4], qty: 1 }],
      notes: 'JazzCash payment verified, order packed and ready for rider pickup',
      tracking: null
    },
    {
      num: 'INV-2026-0905',
      date: '2026-09-16',
      time: '11:10:00',
      source: 'whatsapp',
      status: 'confirmed',
      cust: 'Rabia Basri',
      contact: '0305-6677889, House 18, Block G, Johar Town, Lahore',
      items: [{ item: allProductItems[3], qty: 2 }],
      notes: 'Confirmed via WhatsApp, scheduled for morning dispatch',
      tracking: null
    },
    {
      num: 'INV-2026-0906',
      date: '2026-09-16',
      time: '14:30:00',
      source: 'whatsapp',
      status: 'dispatched',
      cust: 'Kamran Akmal',
      contact: '0322-7788990, Street 4, Cantt, Rawalpindi',
      items: [{ item: allProductItems[6], qty: 1 }, { item: allProductItems[7], qty: 1 }],
      notes: 'Dispatched via TCS Express. Tracking shared with customer',
      tracking: 'TCS-8901041'
    },
    {
      num: 'INV-2026-0907',
      date: '2026-09-15',
      time: '13:15:00',
      source: 'socialmedia',
      status: 'dispatched',
      cust: 'Tariq Mahmood',
      contact: '0302-3344556, House 71, Phase 2, Hayatabad, Peshawar',
      items: [{ item: allProductItems[8], qty: 1 }],
      notes: 'Dispatched via Leopard Courier. COD amount Rs. 6,200',
      tracking: 'LEOPARD-552194'
    },
    {
      num: 'INV-2026-0908',
      date: '2026-09-14',
      time: '12:00:00',
      source: 'whatsapp',
      status: 'completed',
      cust: 'Bilal Ashraf',
      contact: '0333-8899001, Sector 4, Clifton Block 5, Karachi',
      items: [{ item: allProductItems[9], qty: 1 }],
      notes: 'Delivered successfully via TRAX Express. Payment reconciled',
      tracking: 'TRAX-994120'
    },
    {
      num: 'INV-2026-0909',
      date: '2026-09-13',
      time: '17:45:00',
      source: 'socialmedia',
      status: 'completed',
      cust: 'Owais Khan Wholesale',
      contact: '0345-9988776, Cloth Market, Faisalabad',
      items: [{ item: allProductItems[10], qty: 3 }],
      notes: 'Delivered to wholesale commercial hub',
      tracking: 'TCS-8901035'
    },
    {
      num: 'INV-2026-0910',
      date: '2026-09-12',
      time: '14:20:00',
      source: 'whatsapp',
      status: 'completed',
      cust: 'Ayesha Farooq',
      contact: '0300-8451294, DHA Phase 5, Lahore',
      items: [{ item: allProductItems[11], qty: 1 }],
      notes: 'Customer returned item due to size fitting; approved for return',
      tracking: 'TCS-8901022'
    }
  ]

  for (const o of onlineOrdersDef) {
    let existingInv = database.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(o.num) as { id: string } | null
    if (!existingInv) {
      const invId = uuidv4()
      const custId = customerMap.get(o.cust) || walkInId
      const datetimeCreated = `${o.date} ${o.time}`
      let subtotal = 0
      let costTotal = 0
      const itemRows = []

      for (const it of o.items) {
        const lineTotal = it.item.retail * it.qty
        const lineCost = it.item.cost * it.qty
        subtotal += lineTotal
        costTotal += lineCost
        itemRows.push({
          id: uuidv4(),
          invoice_id: invId,
          item_id: it.item.id,
          qty: it.qty,
          unit_price: it.item.retail,
          cost_price: it.item.cost,
          discount_pct: 0,
          line_total: lineTotal
        })
      }

      const grandTotal = subtotal
      const profit = grandTotal - costTotal
      const amountPaid = o.status === 'completed' ? grandTotal : 0
      const balanceDue = grandTotal - amountPaid

      database.prepare(`
        INSERT INTO invoices (
          id, invoice_number, date, datetime_created, customer_id, source, status,
          subtotal, discount_amount, grand_total, amount_paid, balance_due,
          cost_total, profit, payment_method, staff_id, void_reason, notes,
          online_customer_contact, tracking_number, is_locked
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, 0, ?, ?, ?,
          ?, ?, 'bank', ?, NULL, ?,
          ?, ?, 0
        )
      `).run(
        invId, o.num, o.date, datetimeCreated, custId, o.source, o.status,
        subtotal, grandTotal, amountPaid, balanceDue,
        costTotal, profit, hassanUser.id, o.notes,
        o.contact, o.tracking
      )

      for (const ir of itemRows) {
        database.prepare(`
          INSERT INTO invoice_items (
            id, invoice_id, item_id, qty, unit_price, cost_price, discount_pct, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(ir.id, ir.invoice_id, ir.item_id, ir.qty, ir.unit_price, ir.cost_price, ir.discount_pct, ir.line_total)
      }
    }
  }

  // 14. Seed Customer Returns & Refunds
  const returnsDef = [
    {
      num: 'RET-2026-001',
      date: '2026-09-17',
      invNum: 'INV-2026-0018',
      reason: 'Size fitting exchange (Medium to Large)',
      method: 'cash',
      amount: 4450,
      status: 'approved',
      restocked: 1,
      itemIdx: 0,
      notes: 'Tags intact. Item restocked into catalog shelf.'
    },
    {
      num: 'RET-2026-002',
      date: '2026-09-16',
      invNum: 'INV-2026-0024',
      reason: 'Color shade variation from online display picture',
      method: 'bank',
      amount: 6850,
      status: 'approved',
      restocked: 1,
      itemIdx: 1,
      notes: 'Customer refunded via JazzCash. Stock quantity restored.'
    },
    {
      num: 'RET-2026-003',
      date: '2026-09-15',
      invNum: 'INV-2026-0031',
      reason: 'Customer requested store credit voucher for wedding gift',
      method: 'storecredit',
      amount: 5200,
      status: 'approved',
      restocked: 1,
      itemIdx: 2,
      notes: 'Issued Store Credit voucher under customer account.'
    },
    {
      num: 'RET-2026-004',
      date: '2026-09-14',
      invNum: 'INV-2026-0910',
      reason: 'Wrong sleeve length received from online dispatch',
      method: 'cash',
      amount: 2150,
      status: 'approved',
      restocked: 1,
      itemIdx: 11,
      notes: 'Online order return accepted. Rider collected item and returned to warehouse.'
    },
    {
      num: 'RET-2026-005',
      date: '2026-09-18',
      invNum: 'INV-2026-0042',
      reason: 'Minor stitching defect on border lace',
      method: 'cash',
      amount: 3850,
      status: 'pending',
      restocked: 0,
      itemIdx: 3,
      notes: 'Under inspection by store manager. Awaiting approval.'
    },
    {
      num: 'RET-2026-006',
      date: '2026-09-18',
      invNum: 'INV-2026-0050',
      reason: 'Duplicate wedding gift return',
      method: 'storecredit',
      amount: 7450,
      status: 'pending',
      restocked: 0,
      itemIdx: 4,
      notes: 'Customer brought receipt. Under review.'
    }
  ]

  for (const r of returnsDef) {
    let existingRet = database.prepare('SELECT id FROM returns WHERE return_number = ?').get(r.num) as { id: string } | null
    if (!existingRet) {
      const retId = uuidv4()
      const invRow = database.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(r.invNum) as { id: string } | null
      const targetInvId = invRow?.id || null
      const retItem = allProductItems[r.itemIdx % allProductItems.length]

      database.prepare(`
        INSERT INTO returns (
          id, return_number, invoice_id, date, reason, refund_method,
          refund_amount, status, processed_by, approved_by, approved_at, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ? || ' 14:00:00'
        )
      `).run(
        retId, r.num, targetInvId, r.date, r.reason, r.method,
        r.amount, r.status, hassanUser.id,
        r.status === 'approved' ? ownerUser.id : null,
        r.status === 'approved' ? `${r.date} 15:30:00` : null,
        r.notes, r.date
      )

      database.prepare(`
        INSERT INTO return_items (
          id, return_id, item_id, qty, unit_price, line_total, restocked
        ) VALUES (?, ?, ?, 1, ?, ?, ?)
      `).run(uuidv4(), retId, retItem.id, r.amount, r.amount, r.restocked)
    }
  }

  // Final stats
  const finalItems = (database.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number })?.c || 0
  const finalCusts = (database.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number })?.c || 0
  const finalSupps = (database.prepare('SELECT COUNT(*) as c FROM suppliers').get() as { c: number })?.c || 0
  const finalInvs = (database.prepare('SELECT COUNT(*) as c FROM invoices').get() as { c: number })?.c || 0
  const finalExps = (database.prepare('SELECT COUNT(*) as c FROM expenses').get() as { c: number })?.c || 0
  const finalReturns = (database.prepare('SELECT COUNT(*) as c FROM returns').get() as { c: number })?.c || 0
  const finalOnline = (database.prepare("SELECT COUNT(*) as c FROM invoices WHERE source IN ('whatsapp', 'socialmedia', 'other')").get() as { c: number })?.c || 0

  console.log(`[SeedDemoData] Demo seeding complete! Items: ${finalItems}, Customers: ${finalCusts}, Suppliers: ${finalSupps}, Invoices: ${finalInvs}, Expenses: ${finalExps}, Returns: ${finalReturns}, Online Orders: ${finalOnline}`)

  return {
    success: true,
    message: `Successfully populated ${finalItems} products, ${finalCusts} customers, ${finalSupps} suppliers, ${finalInvs} invoices, ${finalReturns} returns, and ${finalOnline} online orders.`,
    stats: {
      items: finalItems,
      customers: finalCusts,
      suppliers: finalSupps,
      invoices: finalInvs,
      expenses: finalExps,
      returns: finalReturns,
      online_orders: finalOnline
    }
  }
}
