import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Type-safe API exposed to renderer
const api = {
  // AUTH
  login: (username: string, pin: string) =>
    ipcRenderer.invoke('auth:login', username, pin),
  getUsersForLogin: () =>
    ipcRenderer.invoke('auth:get-all-users-for-login'),

  // USERS
  getAllUsers: (requestingUserId: string) =>
    ipcRenderer.invoke('users:get-all', requestingUserId),
  createUser: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('users:create', requestingUserId, data),
  updateUserProfile: (requestingUserId: string, targetUserId: string, data: { name?: string; username?: string; role?: string }) =>
    ipcRenderer.invoke('users:update-profile', requestingUserId, targetUserId, data),
  updateUserPermissions: (requestingUserId: string, targetUserId: string, perms: object) =>
    ipcRenderer.invoke('users:update-permissions', requestingUserId, targetUserId, perms),
  resetUserPin: (requestingUserId: string, targetUserId: string, newPin: string) =>
    ipcRenderer.invoke('users:reset-pin', requestingUserId, targetUserId, newPin),
  toggleUserActive: (requestingUserId: string, targetUserId: string, isActive: boolean) =>
    ipcRenderer.invoke('users:toggle-active', requestingUserId, targetUserId, isActive),
  deleteUser: (requestingUserId: string, targetUserId: string) =>
    ipcRenderer.invoke('users:delete', requestingUserId, targetUserId),

  // ITEMS
  searchItems: (query: string) =>
    ipcRenderer.invoke('items:search', query),
  getItemByBarcode: (barcode: string) =>
    ipcRenderer.invoke('items:by-barcode', barcode),
  getAllItems: () =>
    ipcRenderer.invoke('items:get-all'),
  getItemById: (id: string) =>
    ipcRenderer.invoke('items:get-by-id', id),
  createItem: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('items:create', requestingUserId, data),
  updateItem: (requestingUserId: string, itemId: string, data: object) =>
    ipcRenderer.invoke('items:update', requestingUserId, itemId, data),
  getQuantityReport: () =>
    ipcRenderer.invoke('items:quantity-report'),
  getTransactionHistory: (itemId: string) =>
    ipcRenderer.invoke('items:transaction-history', itemId),

  // INVOICES
  createInvoice: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('invoices:create', requestingUserId, data),
  getInvoiceById: (id: string) =>
    ipcRenderer.invoke('invoices:get-by-id', id),
  getInvoicesByDate: (date: string) =>
    ipcRenderer.invoke('invoices:get-by-date', date),
  getInvoicesByRange: (from: string, to: string, staffId?: string, source?: string, paymentMethod?: string, search?: string) =>
    ipcRenderer.invoke('invoices:get-by-range', from, to, staffId, source, paymentMethod, search),
  getPendingInvoices: (requestingUserId?: string, search?: string) =>
    ipcRenderer.invoke('invoices:get-pending', requestingUserId, search),
  updateInvoice: (requestingUserId: string, invoiceId: string, data: object) =>
    ipcRenderer.invoke('invoices:update', requestingUserId, invoiceId, data),
  voidInvoice: (requestingUserId: string, invoiceId: string, reason: string) =>
    ipcRenderer.invoke('invoices:void', requestingUserId, invoiceId, reason),
  recordInvoicePayment: (requestingUserId: string, data: { invoice_id: string; amount: number; method: 'cash' | 'card' | 'bank'; reference?: string; notes?: string }) =>
    ipcRenderer.invoke('invoices:pay-balance', requestingUserId, data),
  checkInvoiceEditPermission: (requestingUserId: string, invoiceId: string) =>
    ipcRenderer.invoke('invoices:edit-check', requestingUserId, invoiceId),

  // PARKED SALES
  parkSale: (requestingUserId: string, cartData: object, customerId: string | null, label: string) =>
    ipcRenderer.invoke('sales:park', requestingUserId, cartData, customerId, label),
  getParkedSales: (requestingUserId: string) =>
    ipcRenderer.invoke('sales:get-parked', requestingUserId),
  deleteParkedSale: (id: string) =>
    ipcRenderer.invoke('sales:delete-parked', id),

  // CUSTOMERS
  getAllCustomers: () =>
    ipcRenderer.invoke('customers:get-all'),
  searchCustomers: (query: string) =>
    ipcRenderer.invoke('customers:search', query),
  createCustomer: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('customers:create', requestingUserId, data),
  updateCustomer: (requestingUserId: string, customerId: string, data: object) =>
    ipcRenderer.invoke('customers:update', requestingUserId, customerId, data),
  deleteCustomer: (requestingUserId: string, customerId: string) =>
    ipcRenderer.invoke('customers:delete', requestingUserId, customerId),
  getCustomerByPhone: (phone: string) =>
    ipcRenderer.invoke('customers:by-phone', phone),

  // SUPPLIERS
  getAllSuppliers: () =>
    ipcRenderer.invoke('suppliers:get-all'),
  createSupplier: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('suppliers:create', requestingUserId, data),
  updateSupplier: (requestingUserId: string, supplierId: string, data: object) =>
    ipcRenderer.invoke('suppliers:update', requestingUserId, supplierId, data),
  deleteSupplier: (requestingUserId: string, supplierId: string) =>
    ipcRenderer.invoke('suppliers:delete', requestingUserId, supplierId),

  // PURCHASES
  createPurchase: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('purchases:create', requestingUserId, data),
  getAllPurchases: (requestingUserId: string) =>
    ipcRenderer.invoke('purchases:get-all', requestingUserId),
  payPurchaseInvoice: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('purchases:pay', requestingUserId, data),

  // REPORTS
  getDailySaleReport: (requestingUserId: string, date: string) =>
    ipcRenderer.invoke('reports:daily-sale', requestingUserId, date),
  getStaffSalesReport: (requestingUserId: string, fromDate: string, toDate?: string, staffId?: string) =>
    ipcRenderer.invoke('reports:staff-sales', requestingUserId, fromDate, toDate, staffId),

  // SETTINGS
  getAllSettings: () =>
    ipcRenderer.invoke('settings:get-all'),
  setSetting: (requestingUserId: string, key: string, value: string) =>
    ipcRenderer.invoke('settings:set', requestingUserId, key, value),

  // BRANDS & CATEGORIES
  getAllBrands: () =>
    ipcRenderer.invoke('brands:get-all'),
  createBrand: (requestingUserId: string, name: string) =>
    ipcRenderer.invoke('brands:create', requestingUserId, name),
  getAllCategories: () =>
    ipcRenderer.invoke('categories:get-all'),

  // MAINTENANCE
  reindexData: (requestingUserId: string) =>
    ipcRenderer.invoke('maintenance:reindex', requestingUserId),
  backupDatabase: (requestingUserId: string) =>
    ipcRenderer.invoke('maintenance:backup', requestingUserId),
  seedDemoData: (requestingUserId: string, mode?: 'if_empty' | 'force') =>
    ipcRenderer.invoke('maintenance:seed-demo-data', requestingUserId, mode),

  // ONLINE & WHATSAPP ORDERS (Phase 2)
  getOnlineOrders: (statusFilter?: string) =>
    ipcRenderer.invoke('orders:get-online', statusFilter),
  updateInvoiceStatus: (requestingUserId: string, invoiceId: string, status: string, trackingNumber?: string) =>
    ipcRenderer.invoke('invoices:update-status', requestingUserId, invoiceId, status, trackingNumber),

  // RETURNS & REFUNDS (Phase 2)
  createReturn: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('returns:create', requestingUserId, data),
  getAllReturns: (requestingUserId: string) =>
    ipcRenderer.invoke('returns:get-all', requestingUserId),
  getReturnById: (id: string) =>
    ipcRenderer.invoke('returns:get-by-id', id),

  // DAY CLOSING (Phase 2)
  calculateDayClose: (requestingUserId: string, date: string) =>
    ipcRenderer.invoke('dayclose:calculate', requestingUserId, date),
  submitDayClose: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('dayclose:submit', requestingUserId, data),
  getDayCloses: (requestingUserId: string) =>
    ipcRenderer.invoke('dayclose:get-all', requestingUserId),
  isDayClosed: (date: string) =>
    ipcRenderer.invoke('dayclose:check-status', date),

  // EXPENSES & STORE CASH OUT
  createExpense: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('expenses:create', requestingUserId, data),
  getExpenses: (requestingUserId: string, fromDate?: string, toDate?: string, category?: string) =>
    ipcRenderer.invoke('expenses:get-all', requestingUserId, fromDate, toDate, category),
  getExpenseById: (id: string) =>
    ipcRenderer.invoke('expenses:get-by-id', id),
  deleteExpense: (requestingUserId: string, expenseId: string) =>
    ipcRenderer.invoke('expenses:delete', requestingUserId, expenseId),
  getTodayPOSSummary: (requestingUserId: string) =>
    ipcRenderer.invoke('pos:get-today-summary', requestingUserId),

  // ACCOUNTS & FINANCIAL LEDGER (Phase 3)
  getAllAccounts: (requestingUserId: string) =>
    ipcRenderer.invoke('accounts:get-all', requestingUserId),
  createAccount: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('accounts:create', requestingUserId, data),
  getAccountLedger: (requestingUserId: string, accountId: string, fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke('accounts:ledger', requestingUserId, accountId, fromDate, toDate),
  createJournalEntry: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('journal:create', requestingUserId, data),
  getAllJournalEntries: (requestingUserId: string, fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke('journal:get-all', requestingUserId, fromDate, toDate),
  recordCustomerPayment: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('payments:customer-receive', requestingUserId, data),
  recordSupplierPayment: (requestingUserId: string, data: object) =>
    ipcRenderer.invoke('payments:supplier-pay', requestingUserId, data),
  getProfitAndLossReport: (requestingUserId: string, fromDate: string, toDate: string) =>
    ipcRenderer.invoke('reports:profit-loss', requestingUserId, fromDate, toDate),
  getFinancialAnalytics: (requestingUserId: string, fromDate: string, toDate: string) =>
    ipcRenderer.invoke('reports:financial-analytics', requestingUserId, fromDate, toDate),
  getItemSalesPerformance: (fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke('reports:item-sales-performance', fromDate, toDate),
  getDailyEntriesReport: (requestingUserId: string, date: string) =>
    ipcRenderer.invoke('reports:daily-entries', requestingUserId, date),

  // STATEMENTS & RESTORE (Phase 4)
  getCustomerStatement: (requestingUserId: string, customerId: string, fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke('statements:customer', requestingUserId, customerId, fromDate, toDate),
  getSupplierStatement: (requestingUserId: string, supplierId: string, fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke('statements:supplier', requestingUserId, supplierId, fromDate, toDate),
  restoreDatabase: (requestingUserId: string) =>
    ipcRenderer.invoke('maintenance:restore', requestingUserId),

  // ENTERPRISE SUITE (Phase 5)
  getAgingReport: (requestingUserId: string, type: 'ar' | 'ap') =>
    ipcRenderer.invoke('reports:aging', requestingUserId, type),
  bulkImportItems: (requestingUserId: string, items: object[]) =>
    ipcRenderer.invoke('items:bulk-import', requestingUserId, items),
  getAuditLogs: (requestingUserId: string, filters?: object) =>
    ipcRenderer.invoke('audit:get-logs', requestingUserId, filters),
  getLowStockItems: () =>
    ipcRenderer.invoke('items:low-stock'),

  // PRINTING & PRINT PREVIEW
  print: (options?: object) =>
    ipcRenderer.invoke('print:print', options),
  getPrinters: () =>
    ipcRenderer.invoke('print:get-printers'),
  printToPDF: (defaultFilename?: string) =>
    ipcRenderer.invoke('print:to-pdf', defaultFilename),

  // MOBILE COMPANION & WHATSAPP AUTOMATION
  getMobileServerInfo: () =>
    ipcRenderer.invoke('mobile:get-info'),
  startMobileServer: (port?: number) =>
    ipcRenderer.invoke('mobile:start', port),
  stopMobileServer: () =>
    ipcRenderer.invoke('mobile:stop'),
  restartMobileServer: (port: number) =>
    ipcRenderer.invoke('mobile:restart', port),
  allowFirewall: () =>
    ipcRenderer.invoke('mobile:allow-firewall'),
  getWhatsAppConfig: () =>
    ipcRenderer.invoke('whatsapp:get-config'),
  saveWhatsAppConfig: (config: object) =>
    ipcRenderer.invoke('whatsapp:save-config', config),
  sendWhatsAppDayClose: (dateStr?: string, forceManual?: boolean) =>
    ipcRenderer.invoke('whatsapp:send-day-close', dateStr, forceManual),
  getWhatsAppPreview: (dateStr?: string) =>
    ipcRenderer.invoke('whatsapp:get-preview', dateStr),

  // CLOUDFLARE WORLDWIDE TUNNEL & EXTERNAL BROWSER
  checkCloudflare: () =>
    ipcRenderer.invoke('cloudflare:check'),
  startCloudflareTunnel: (port?: number) =>
    ipcRenderer.invoke('cloudflare:start', port),
  stopCloudflareTunnel: () =>
    ipcRenderer.invoke('cloudflare:stop'),
  getCloudflareStatus: () =>
    ipcRenderer.invoke('cloudflare:status'),
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke('system:open-url', url),

  // VOICE AI SPEECH TRANSCRIPTION & LLM INTELLIGENCE
  transcribeAudio: (audioBase64: string, mimeType: string, language?: string) =>
    ipcRenderer.invoke('voice:transcribe', audioBase64, mimeType, language),
  processVoiceWithLLM: (payload: any) =>
    ipcRenderer.invoke('llm:processVoiceCommand', payload),
  testLLMConnection: (provider: string, apiKey: string, baseUrl?: string, model?: string) =>
    ipcRenderer.invoke('llm:testConnection', provider, apiKey, baseUrl, model),
  checkOmniRouteStatus: (customUrl?: string) =>
    ipcRenderer.invoke('llm:checkOmniRoute', customUrl),

  // MULTI-TERMINAL & LAN NETWORK SYNC
  scanMasterServers: () =>
    ipcRenderer.invoke('terminal:scan-master'),
  getActiveTerminals: () =>
    ipcRenderer.invoke('terminal:get-active-list'),
  testLanPing: (url: string) =>
    ipcRenderer.invoke('terminal:test-lan-ping', url),

  // AUTOMATED GOOGLE DRIVE CLOUD BACKUP
  getGDriveConfig: () =>
    ipcRenderer.invoke('gdrive:get-config'),
  saveGDriveConfig: (config: any) =>
    ipcRenderer.invoke('gdrive:save-config', config),
  backupToGDriveNow: (requestingUserId?: string) =>
    ipcRenderer.invoke('gdrive:backup-now', requestingUserId),
  testGDriveConnection: (webhookUrl?: string) =>
    ipcRenderer.invoke('gdrive:test-connection', webhookUrl),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
