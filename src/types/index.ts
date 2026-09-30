// POS System — Shared TypeScript Types

export interface User {
  id: string
  name: string
  username: string
  role: 'owner' | 'manager' | 'salesperson'
  is_active: number
  // Navigation Module Access (1 = visible in navbar, 0 = hidden)
  perm_pos?: number
  perm_orders?: number
  perm_sales?: number
  perm_barcode?: number
  perm_customers?: number
  // Permissions (1 = allowed, 0 = denied)
  perm_view_cost_price: number
  perm_view_profit: number
  perm_apply_discount: number
  perm_discount_limit: number
  perm_edit_price?: number        // Allow changing item unit selling price in POS (including below cost)
  perm_void_invoice: number
  perm_edit_invoice: number      // KEY: staff cannot edit invoice unless owner enables this
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

export interface UserPublic {
  id: string
  name: string
  username: string
  role: string
}

export type PermissionKey = keyof Pick<User,
  'perm_pos' | 'perm_orders' | 'perm_sales' | 'perm_barcode' | 'perm_customers' |
  'perm_view_cost_price' | 'perm_view_profit' | 'perm_apply_discount' | 'perm_edit_price' |
  'perm_void_invoice' | 'perm_edit_invoice' | 'perm_process_return' |
  'perm_add_edit_stock' | 'perm_record_purchase' | 'perm_view_accounts' |
  'perm_view_all_reports' | 'perm_manual_stock_adjust' | 'perm_open_cash_drawer' |
  'perm_day_closing' | 'perm_access_maintenance' | 'perm_manage_users'
>

export interface Item {
  id: string
  part_number: string
  barcode?: string
  name: string
  brand_id?: string
  brand_name?: string
  category_id?: string
  category_name?: string
  supplier_id?: string
  supplier_name?: string
  size_variant?: string
  cost_price: number
  retail_price: number
  quantity_on_hand: number
  reorder_level: number
  is_active: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string             // temp ID for cart row
  item_id: string
  item: Item
  qty: number
  unit_price: number
  cost_price: number
  discount_pct: number
  line_total: number
}

export interface Customer {
  id: string
  name: string
  phone?: string
  whatsapp?: string
  address?: string
  type: 'walkin' | 'regular' | 'online'
  balance: number
  current_balance?: number
  credit_limit?: number
  notes?: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact?: string
  address?: string
  balance: number
  current_balance?: number
  notes?: string
  created_at?: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  item_id: string
  item_name?: string
  part_number?: string
  qty: number
  unit_price: number
  cost_price: number
  discount_pct: number
  line_total: number
}

export interface Invoice {
  id: string
  invoice_number: string
  date: string
  datetime_created: string
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_whatsapp?: string
  source: 'instore' | 'whatsapp' | 'socialmedia' | 'other'
  status: 'pending' | 'confirmed' | 'dispatched' | 'completed' | 'voided' | 'parked' | 'refunded'
  subtotal: number
  discount_amount: number
  grand_total: number
  amount_paid: number
  balance_due: number
  cost_total: number
  profit: number
  payment_method: 'cash' | 'card' | 'bank' | 'split' | 'credit'
  staff_id: string
  staff_name?: string
  void_reason?: string
  voided_by?: string
  voided_at?: string
  notes?: string
  online_customer_contact?: string
  tracking_number?: string
  is_locked: number
  items?: InvoiceItem[]
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

export interface Purchase {
  id: string
  purchase_number: string
  supplier_id?: string
  supplier_name?: string
  date: string
  invoice_ref?: string
  total_cost: number
  amount_paid: number
  balance_due: number
  payment_status: 'paid' | 'partial' | 'unpaid'
  payment_source?: 'drawer' | 'outside' | 'bank' | 'other'
  notes?: string
  created_at?: string
  created_by: string
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

export interface QuantityReportRow {
  part_number: string
  name: string
  size_variant?: string
  brand_name?: string
  category_name?: string
  supplier_name?: string
  quantity_on_hand: number
  cost_price: number
  retail_price: number
  cost_value: number
}

export interface StockTransaction {
  id: string
  item_id: string
  type: 'purchase' | 'sale' | 'return_in' | 'adjustment' | 'opening'
  qty_change: number
  qty_after: number
  reference?: string
  user_id: string
  user_name?: string
  date: string
  notes?: string
}

export interface DailySaleReport {
  date: string
  invoices: (Invoice & { items: InvoiceItem[] })[]
  totals: {
    total_sales: number
    total_cost: number
    total_discount: number
    total_profit: number
    invoice_count: number
  }
}

export interface StaffSalesReport {
  user_id: string
  user_name: string
  role: string
  invoice_count: number
  total_sales: number
  total_cost: number
  total_discounts: number
  total_profit: number
}

export interface ParkedSale {
  id: string
  label?: string
  cart_data: string
  customer_id?: string
  customer_name?: string
  staff_id: string
  staff_name?: string
  created_at: string
}

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
  refund_method: 'cash' | 'bank' | 'storecredit'
  refund_amount: number
  status: 'pending' | 'approved' | 'rejected'
  processed_by: string
  processed_by_name?: string
  approved_by?: string
  notes?: string
  created_at: string
  items?: ReturnItem[]
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
  staff_breakdown: { user_id: string; name: string; sales: number; invoices: number; cash: number; card: number; bank: number }[]
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

export interface POSSummary {
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

export interface Brand { id: string; name: string }
export interface Category { id: string; name: string }

export interface PartyStatementRow {
  id: string
  date: string
  type: 'sale_invoice' | 'payment_received' | 'purchase_invoice' | 'payment_made' | 'return' | 'opening'
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

export interface BarcodeLabelConfig {
  size: '50x25' | '40x28' | '38x25'
  show_brand: boolean
  show_price: boolean
  show_size: boolean
  show_barcode_text: boolean
  currency_prefix: string
}

export interface AppSettings {
  company_name: string
  company_address: string
  company_phone: string
  company_ntn?: string
  whatsapp_number?: string
  currency: string
  currency_symbol: string
  receipt_footer: string
  receipt_return_policy?: string
  receipt_show_qr?: string
  receipt_header_logo?: string
  receipt_qr_image?: string
  receipt_qr_label?: string
  tax_rate: string
  receipt_printer: string
  discount_limit_sp: string
  discount_limit_mgr: string
  pos_allow_price_edit?: string
  pos_show_cost_in_price_edit?: string
  invoice_prefix: string
  purchase_prefix: string
  return_prefix: string
  voice_stt_api_key?: string
  voice_llm_provider?: string
  voice_llm_api_key?: string
  voice_llm_base_url?: string
  voice_llm_model?: string
  [key: string]: string | undefined
}

// Window API type (from preload)
export interface ElectronAPI {
  login: (username: string, pin: string) => Promise<{ success: boolean; user?: User; error?: string }>
  getUsersForLogin: () => Promise<UserPublic[]>
  getAllUsers: (requestingUserId: string) => Promise<{ success: boolean; data?: User[]; error?: string }>
  createUser: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: User; error?: string }>
  updateUserProfile: (requestingUserId: string, targetUserId: string, data: { name?: string; username?: string; role?: string }) => Promise<{ success: boolean; data?: User; error?: string }>
  updateUserPermissions: (requestingUserId: string, targetUserId: string, perms: object) => Promise<{ success: boolean; error?: string }>
  resetUserPin: (requestingUserId: string, targetUserId: string, newPin: string) => Promise<{ success: boolean; error?: string }>
  toggleUserActive: (requestingUserId: string, targetUserId: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>
  deleteUser: (requestingUserId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>
  searchItems: (query: string) => Promise<Item[]>
  getItemByBarcode: (barcode: string) => Promise<Item | null>
  getAllItems: () => Promise<Item[]>
  getItemById: (id: string) => Promise<Item | null>
  createItem: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Item; error?: string }>
  updateItem: (requestingUserId: string, itemId: string, data: object) => Promise<{ success: boolean; error?: string }>
  getQuantityReport: () => Promise<QuantityReportRow[]>
  getTransactionHistory: (itemId: string) => Promise<StockTransaction[]>
  createInvoice: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Invoice; error?: string }>
  getInvoiceById: (id: string) => Promise<Invoice | null>
  getInvoicesByDate: (date: string) => Promise<Invoice[]>
  getInvoicesByRange: (from: string, to: string, staffId?: string, source?: string, paymentMethod?: string, search?: string) => Promise<Invoice[]>
  getPendingInvoices: (requestingUserId?: string, search?: string) => Promise<Invoice[]>
  updateInvoice: (requestingUserId: string, invoiceId: string, data: UpdateInvoiceInput) => Promise<{ success: boolean; data?: Invoice; error?: string }>
  voidInvoice: (requestingUserId: string, invoiceId: string, reason: string) => Promise<{ success: boolean; error?: string }>
  checkInvoiceEditPermission: (requestingUserId: string, invoiceId: string) => Promise<{ canEdit: boolean; reason?: string }>
  recordInvoicePayment: (requestingUserId: string, data: { invoice_id: string; amount: number; method: 'cash' | 'card' | 'bank'; reference?: string; notes?: string }) => Promise<{ success: boolean; data?: Invoice; error?: string }>
  parkSale: (requestingUserId: string, cartData: object, customerId: string | null, label: string) => Promise<{ success: boolean; error?: string }>
  getParkedSales: (requestingUserId: string) => Promise<ParkedSale[]>
  deleteParkedSale: (id: string) => Promise<{ success: boolean }>
  getAllCustomers: () => Promise<Customer[]>
  searchCustomers: (query: string) => Promise<Customer[]>
  getCustomerByPhone: (phone: string) => Promise<Customer | null>
  createCustomer: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Customer; error?: string }>
  updateCustomer: (requestingUserId: string, customerId: string, data: object) => Promise<{ success: boolean; data?: Customer; error?: string }>
  deleteCustomer: (requestingUserId: string, customerId: string) => Promise<{ success: boolean; error?: string }>
  getAllSuppliers: () => Promise<Supplier[]>
  createSupplier: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Supplier; error?: string }>
  updateSupplier: (requestingUserId: string, supplierId: string, data: object) => Promise<{ success: boolean; data?: Supplier; error?: string }>
  deleteSupplier: (requestingUserId: string, supplierId: string) => Promise<{ success: boolean; error?: string }>
  createPurchase: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Purchase; error?: string }>
  getAllPurchases: (requestingUserId: string) => Promise<{ success: boolean; data?: Purchase[]; error?: string }>
  payPurchaseInvoice: (requestingUserId: string, data: { purchase_id: string; amount: number; payment_source?: 'drawer' | 'outside' | 'bank'; reference?: string; notes?: string }) => Promise<{ success: boolean; data?: Purchase; error?: string }>
  getDailySaleReport: (requestingUserId: string, date: string) => Promise<{ success: boolean; data?: DailySaleReport; error?: string }>
  getStaffSalesReport: (requestingUserId: string, fromDate: string, toDate?: string, staffId?: string) => Promise<{ success: boolean; data?: StaffSalesReport[]; error?: string }>
  getAllSettings: () => Promise<AppSettings>
  setSetting: (requestingUserId: string, key: string, value: string) => Promise<{ success: boolean; error?: string }>
  getAllBrands: () => Promise<Brand[]>
  createBrand: (requestingUserId: string, name: string) => Promise<{ success: boolean; data?: Brand; error?: string }>
  getAllCategories: () => Promise<Category[]>
  reindexData: (requestingUserId: string) => Promise<{ success: boolean; data?: { fixed: number; message: string }; error?: string }>
  backupDatabase: (requestingUserId: string) => Promise<{ success: boolean; path?: string; error?: string }>
  restoreDatabase: (requestingUserId: string) => Promise<{ success: boolean; message?: string; error?: string }>
  seedDemoData: (requestingUserId: string, mode?: 'if_empty' | 'force') => Promise<{ success: boolean; message?: string; data?: any; error?: string }>
  updateInvoiceStatus: (requestingUserId: string, invoiceId: string, status: string, trackingNumber?: string) => Promise<{ success: boolean; error?: string }>
  getOnlineOrders: (statusFilter?: string) => Promise<Invoice[]>
  createReturn: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Return; error?: string }>
  getAllReturns: (requestingUserId: string) => Promise<{ success: boolean; data?: Return[]; error?: string }>
  getReturnById: (id: string) => Promise<Return | null>
  calculateDayClose: (requestingUserId: string, date: string) => Promise<{ success: boolean; data?: DayCloseCalculation; error?: string }>
  submitDayClose: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: DayClose; error?: string }>
  getDayCloses: (requestingUserId: string) => Promise<{ success: boolean; data?: DayClose[]; error?: string }>
  isDayClosed: (date: string) => Promise<boolean>

  // EXPENSES & CASH OUT (POS & Store Operations)
  createExpense: (requestingUserId: string, data: CreateExpenseInput) => Promise<{ success: boolean; data?: Expense; error?: string }>
  getExpenses: (requestingUserId: string, fromDate?: string, toDate?: string, category?: string) => Promise<{ success: boolean; data?: Expense[]; error?: string }>
  deleteExpense: (requestingUserId: string, expenseId: string) => Promise<{ success: boolean; error?: string }>
  getTodayPOSSummary: (requestingUserId: string) => Promise<{ success: boolean; data?: POSSummary; error?: string }>

  // ACCOUNTS (Phase 3)
  getAllAccounts: (requestingUserId: string) => Promise<{ success: boolean; data?: Account[]; error?: string }>
  createAccount: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: Account; error?: string }>
  getAccountLedger: (requestingUserId: string, accountId: string, fromDate?: string, toDate?: string) => Promise<{ success: boolean; data?: LedgerRow[]; error?: string }>
  createJournalEntry: (requestingUserId: string, data: object) => Promise<{ success: boolean; data?: JournalEntry; error?: string }>
  getAllJournalEntries: (requestingUserId: string, fromDate?: string, toDate?: string) => Promise<{ success: boolean; data?: JournalEntry[]; error?: string }>
  recordCustomerPayment: (requestingUserId: string, data: object) => Promise<{ success: boolean; error?: string }>
  recordSupplierPayment: (requestingUserId: string, data: object) => Promise<{ success: boolean; error?: string }>
  getProfitAndLossReport: (requestingUserId: string, fromDate: string, toDate: string) => Promise<{ success: boolean; data?: ProfitAndLossReport; error?: string }>
  getFinancialAnalytics: (requestingUserId: string, fromDate: string, toDate: string) => Promise<{ success: boolean; data?: any; error?: string }>
  getItemSalesPerformance: (fromDate?: string, toDate?: string) => Promise<{ success: boolean; data?: any; error?: string }>
  getDailyEntriesReport: (requestingUserId: string, date: string) => Promise<{ success: boolean; data?: DailyEntryRow[]; error?: string }>

  // STATEMENTS (Phase 4)
  getCustomerStatement: (requestingUserId: string, customerId: string, fromDate?: string, toDate?: string) => Promise<{ success: boolean; data?: PartyStatementReport; error?: string }>
  getSupplierStatement: (requestingUserId: string, supplierId: string, fromDate?: string, toDate?: string) => Promise<{ success: boolean; data?: PartyStatementReport; error?: string }>

  // ENTERPRISE SUITE (Phase 5)
  getAgingReport: (requestingUserId: string, type: 'ar' | 'ap') => Promise<{ success: boolean; data?: AgingReportSummary; error?: string }>
  bulkImportItems: (requestingUserId: string, items: BulkImportItemInput[]) => Promise<{ success: boolean; imported?: number; error?: string }>
  getAuditLogs: (requestingUserId: string, filters?: { userId?: string; action?: string; fromDate?: string; toDate?: string }) => Promise<{ success: boolean; data?: AuditLogRow[]; error?: string }>
  getLowStockItems: () => Promise<Item[]>

  // PRINTING & PRINT PREVIEW
  print: (options?: { silent?: boolean; printBackground?: boolean; deviceName?: string; color?: boolean; margins?: object; pageSize?: string | object }) => Promise<{ success: boolean; error?: string }>
  getPrinters: () => Promise<Array<{ name: string; displayName: string; description: string; status: number; isDefault: boolean }>>
  printToPDF: (defaultFilename?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>

  // MOBILE COMPANION & WHATSAPP AUTOMATION
  getMobileServerInfo: () => Promise<{ success: boolean; data?: MobileServerInfo; error?: string }>
  startMobileServer: (port?: number) => Promise<{ success: boolean; data?: MobileServerInfo; error?: string }>
  stopMobileServer: () => Promise<{ success: boolean; data?: MobileServerInfo; error?: string }>
  restartMobileServer: (port: number) => Promise<{ success: boolean; data?: MobileServerInfo; error?: string }>
  allowFirewall: () => Promise<{ success: boolean; error?: string }>
  getWhatsAppConfig: () => Promise<{ success: boolean; data?: WhatsAppConfig; error?: string }>
  saveWhatsAppConfig: (config: Partial<WhatsAppConfig>) => Promise<{ success: boolean; error?: string }>
  sendWhatsAppDayClose: (dateStr?: string, forceManual?: boolean) => Promise<{ success: boolean; url?: string; error?: string }>
  getWhatsAppPreview: (dateStr?: string) => Promise<{ success: boolean; data?: { message: string; date: string; phone: string; whatsappUrl: string }; error?: string }>

  // CLOUDFLARE WORLDWIDE TUNNEL & EXTERNAL BROWSER
  checkCloudflare: () => Promise<{ success: boolean; data?: CloudflareCheckResult; error?: string }>
  startCloudflareTunnel: (port?: number) => Promise<{ success: boolean; data?: CloudflareStatus; error?: string }>
  stopCloudflareTunnel: () => Promise<{ success: boolean; data?: CloudflareStatus; error?: string }>
  getCloudflareStatus: () => Promise<{ success: boolean; data?: CloudflareStatus; error?: string }>
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>

  // VOICE AI SPEECH TRANSCRIPTION & LLM INTELLIGENCE
  transcribeAudio: (audioBase64: string, mimeType: string, language?: string) => Promise<{ success: boolean; text?: string; error?: string }>
  processVoiceWithLLM: (payload: {
    transcript: string
    catalog: Array<{ id: string; name: string; part_number?: string; barcode?: string; retail_price: number; cost_price?: number; quantity_on_hand?: number }>
    cart: Array<{ id: string; item_id: string; name: string; part_number?: string; qty: number; unit_price: number; line_total: number }>
    customers: Array<{ id: string; name: string; phone?: string; current_balance?: number }>
    canEditPrice: boolean
  }) => Promise<{ success: boolean; result?: any; provider?: string; model?: string; latencyMs?: number; isFallback?: boolean; error?: string }>
  testLLMConnection: (provider: string, apiKey: string, baseUrl?: string, model?: string) => Promise<{ success: boolean; message: string; latencyMs: number }>
  checkOmniRouteStatus: (customUrl?: string) => Promise<{ isRunning: boolean; baseUrl: string; dashboardUrl: string; models: string[]; error?: string }>

  // MULTI-TERMINAL & LAN NETWORK SYNC
  scanMasterServers: () => Promise<{ success: boolean; data: DiscoveredMasterServer[]; error?: string }>
  getActiveTerminals: () => Promise<{ success: boolean; data: ActiveTerminalInfo[]; error?: string }>
  testLanPing: (url: string) => Promise<{ success: boolean; latencyMs: number; message: string }>

  // AUTOMATED GOOGLE DRIVE CLOUD BACKUP
  getGDriveConfig: () => Promise<{ success: boolean; data?: GDriveConfig; error?: string }>
  saveGDriveConfig: (config: Partial<GDriveConfig>) => Promise<{ success: boolean; error?: string }>
  backupToGDriveNow: (requestingUserId?: string) => Promise<{ success: boolean; message: string; timestamp: number }>
  testGDriveConnection: (webhookUrl?: string) => Promise<{ success: boolean; message: string; latencyMs: number }>
}

export interface GDriveConfig {
  enabled: boolean
  webhookUrl: string
  folderName: string
  frequencyDays: number
  lastBackupTime: number | null
  lastStatus: 'success' | 'failed' | 'idle' | 'running'
  lastMessage: string | null
  nextBackupTime: number | null
  isOnline: boolean
}

export interface DiscoveredMasterServer {
  ip: string
  port: number
  url: string
  name: string
  latencyMs: number
}

export interface ActiveTerminalInfo {
  terminalId: string
  terminalName: string
  ip: string
  os: string
  lastPing: number
  isMaster?: boolean
}

export interface CloudflareCheckResult {
  isInstalled: boolean
  executablePath?: string
  version?: string
  downloadUrl: string
  platform?: 'win32' | 'darwin' | 'linux'
  arch?: string
  platformLabel?: string
  brewCommand?: string
}

export interface CloudflareStatus {
  isRunning: boolean
  publicUrl: string | null
  port: number | null
  error: string | null
  executablePath?: string
}

export interface MobileServerInfo {
  isRunning: boolean
  port: number
  localIps: string[]
  primaryUrl: string
  allUrls: string[]
}

export interface WhatsAppConfig {
  ownerPhone: string
  autoCloseTime: string
  autoCloseEnabled: boolean
  sendOnDayClose: boolean
  lastSentDate?: string
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
// VOICE-CONTROLLED POS AGENT TYPES
// ============================================================
export type VoiceIntent =
  | 'ADD_ITEM'
  | 'ADD_MULTI'
  | 'REMOVE_ITEM'
  | 'UPDATE_QTY'
  | 'SET_PRICE'
  | 'SET_CUSTOMER'
  | 'CREATE_CUSTOMER'
  | 'SET_DISCOUNT'
  | 'SET_PAYMENT'
  | 'SET_AMOUNT_PAID'
  | 'HOLD_BILL'
  | 'RESUME_BILL'
  | 'CLEAR_CART'
  | 'REVIEW_INVOICE'
  | 'CHECK_STOCK'
  | 'CONFIRM_PROCEED'
  | 'CANCEL_DISCARD'
  | 'NAVIGATE'
  | 'UNKNOWN'

export interface VoiceItemEntity {
  product_query: string
  quantity: number
  unit_price?: number
  discount_pct?: number
  matched_item?: Item
  candidate_items?: Item[]
  stock_shortage?: boolean
  available_stock?: number
  price_mismatch?: boolean
  below_cost_price?: boolean
  cost_price?: number
  catalog_price?: number
  confidence: number
}

export interface LLMMetadata {
  provider: string
  model: string
  latencyMs: number
  raw_json?: any
  isFallback?: boolean
  error?: string
}

export interface VoiceParsedCommand {
  intent: VoiceIntent
  language: 'en' | 'ur' | 'mixed'
  transcript: string
  items?: VoiceItemEntity[]
  product_query?: string
  quantity?: number
  unit_price?: number
  customer_name?: string
  customer_phone?: string
  matched_customer?: Customer
  candidate_customers?: Customer[]
  discount_amount?: number
  discount_pct?: number
  payment_method?: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial'
  bank_provider?: 'JazzCash' | 'EasyPaisa' | 'Other Bank'
  amount_paid?: number
  spoken_response?: string
  confidence: number
  raw_command: string
  target_cart_row?: number
  needs_disambiguation?: boolean
  disambiguation_type?: 'product' | 'customer'
  ambiguous_options?: Array<{ id: string; label: string; sublabel?: string; data: any }>
  needs_confirmation?: boolean
  confirmation_message?: string
  route_path?: string
  llm_meta?: LLMMetadata
}

export interface VoiceMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  transcript?: string
  parsed?: VoiceParsedCommand
  timestamp: number
  language?: 'en' | 'ur'
  actionStatus?: 'pending' | 'applied' | 'rejected' | 'clarifying'
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
