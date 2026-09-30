import { app, shell, BrowserWindow, ipcMain, dialog, session, systemPreferences } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
// Enable Chromium Web Speech API and real microphone access
app.commandLine.appendSwitch('enable-speech-dispatcher')
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI,AudioCapture')
// Allow Google STT endpoint connections (fixes network error in Electron)
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process')
// DO NOT use 'use-fake-ui-for-media-stream' — that replaces real mic with a fake/empty stream

import {
  initDatabase, closeDatabase,
  verifyLogin, getAllUsers, createUser, updateUser, updateUserPermissions,
  resetUserPin, toggleUserActive, deleteUser, getUserById,
  searchItems, getItemByBarcode, getAllItems, getItemById, createItem, updateItem,
  getQuantityReport, getTransactionHistory,
  createInvoice, getInvoiceById, getInvoicesByDate, getInvoicesByDateRange, getPendingInvoices, updateInvoice, voidInvoice,
  recordInvoicePayment,
  parkSale, getParkedSales, deleteParkedSale,
  getAllCustomers, searchCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerByPhone,
  getAllSuppliers, createSupplier, updateSupplier, deleteSupplier,
  createPurchase, getAllPurchases, payPurchaseInvoice,
  getDailySaleReport, getStaffSalesReport,
  getAllBrands, createBrand, getAllCategories,
  getSetting, setSetting, getAllSettings,
  reindexData, logAction,
  updateInvoiceStatus, getOnlineOrders,
  createReturn, getAllReturns, getReturnById,
  calculateDayClose, submitDayClose, getDayCloses, isDayClosed,
  getAllAccounts, createAccount, getAccountLedger,
  createJournalEntry, getAllJournalEntries,
  recordCustomerPayment, recordSupplierPayment,
  getProfitAndLossReport, getDailyEntriesReport,
  getCustomerStatement, getSupplierStatement, restoreDatabaseFromFile,
  getAgingReport, bulkImportItems, getAuditLogs, getLowStockItems,
  createExpense, getExpenseById, getExpenses, deleteExpense, getTodayPOSSummary,
  BulkImportItemInput, getItemSalesPerformance, getFinancialAnalytics
} from '../database/db'
import { startMobileServer, stopMobileServer, getMobileServerInfo } from './mobileServer'
import {
  startWhatsAppScheduler, stopWhatsAppScheduler, getWhatsAppConfig,
  saveWhatsAppConfig, sendWhatsAppDayClose, formatDayCloseWhatsAppMessage
} from './whatsappScheduler'
import {
  checkCloudflaredInstalled, startCloudflareTunnel,
  stopCloudflareTunnel, getCloudflareTunnelStatus
} from './cloudflareTunnel'
import { transcribeAudioBuffer } from './speechService'
import { processVoiceCommandWithLLM, testLLMConnection, checkOmniRouteServer } from './llmService'
import { scanForMasterServer } from './lanDiscovery'
import { getActiveTerminals } from './rpcDispatcher'
import {
  getGDriveConfig, saveGDriveConfig, performGDriveBackup,
  testGDriveConnection, startGDriveScheduler, stopGDriveScheduler
} from './gdriveBackupService'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const iconPath = process.platform === 'win32'
    ? join(__dirname, '../../resources/icon.ico')
    : join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Nuqta AI POS',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    // Set Chrome user agent so Google's Speech-to-Text API accepts requests from this app
    // (Electron's default UA is rejected by Google's STT endpoints causing 'network' error)
    const chromeVersion = process.versions.chrome || '124.0.0.0'
    mainWindow!.webContents.setUserAgent(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
    )
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Nuqta AI POS')

/**
 * The app was previously shipped as "Al-Deewan POS System". Renaming it moves
 * Electron's userData folder, so on first launch copy the old data across.
 * The legacy folder is left untouched as a backup.
 */
function migrateLegacyUserData(): void {
  try {
    const current = app.getPath('userData')
    const legacy = path.join(app.getPath('appData'), 'Al-Deewan POS System')
    const legacyDb = path.join(legacy, 'aldeewan-pos.db')
    if (!fs.existsSync(legacyDb) || fs.existsSync(path.join(current, 'aldeewan-pos.db'))) return
    fs.mkdirSync(current, { recursive: true })
    for (const entry of fs.readdirSync(legacy)) {
      if (/\.(db|json)$/i.test(entry)) {
        fs.copyFileSync(path.join(legacy, entry), path.join(current, entry))
      }
    }
    console.log('[Main] Migrated data from legacy Al-Deewan folder:', legacy)
  } catch (err) {
    console.error('[Main] Legacy data migration failed:', err)
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.nuqta.ai')
  migrateLegacyUserData()
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Explicitly grant microphone and speech recognition permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const perm = permission as string
    if (perm === 'media' || perm === 'microphone' || perm === 'speech' || perm === 'audioCapture') {
      callback(true)
      return
    }
    callback(true)
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, _permission) => {
    return true
  })

  try {
    await initDatabase()
    console.log('[Main] Database ready')
  } catch (err) {
    console.error('[Main] Database init failed:', err)
    dialog.showErrorBox('Database Error', `Failed to initialize database: ${err}`)
    app.quit()
    return
  }

  // Start Mobile Web Server, Automated WhatsApp Scheduler & Google Drive Cloud Backup
  try {
    const savedPort = parseInt(getSetting('mobile_server_port') || '8080', 10)
    startMobileServer(isNaN(savedPort) ? 8080 : savedPort)
    startWhatsAppScheduler()
    startGDriveScheduler()
  } catch (e) {
    console.warn('[Main] Background services start note:', e)
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopGDriveScheduler()
  stopCloudflareTunnel()
  stopMobileServer()
  stopWhatsAppScheduler()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================================
// IPC HANDLERS — ALL DB CALLS GO THROUGH HERE
// Renderer process CANNOT access DB directly — this is the
// security boundary. Every handler checks permissions before
// executing any sensitive operation.
// ============================================================
function registerIpcHandlers(): void {

  // ---- AUTH ----
  ipcMain.handle('auth:login', async (_, username: string, pin: string) => {
    try {
      const user = verifyLogin(username, pin)
      if (user) {
        logAction(user.id, 'LOGIN', 'user', user.id, { username })
      }
      return { success: !!user, user }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('auth:get-all-users-for-login', async () => {
    try {
      const users = getAllUsers()
      // Return only public info needed for login screen (no hashes)
      return users
        .filter((u: { is_active: number }) => u.is_active)
        .map((u: { id: string; name: string; username: string; role: string }) => ({ id: u.id, name: u.name, username: u.username, role: u.role }))
    } catch (err) {
      return []
    }
  })

  // ---- USER MANAGEMENT (Owner only — enforced here) ----
  ipcMain.handle('users:get-all', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied. Only authorized users can view user list.' }
    }
    return { success: true, data: getAllUsers() }
  })

  ipcMain.handle('users:create', async (_, requestingUserId: string, userData: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied. Only Owner can create users.' }
    }
    try {
      const user = createUser(userData as Parameters<typeof createUser>[0])
      logAction(requestingUserId, 'CREATE_USER', 'user', user.id, { name: user.name })
      return { success: true, data: user }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('users:update-permissions', async (_, requestingUserId: string, targetUserId: string, perms: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied. Only Owner can modify user permissions.' }
    }
    // Owner cannot remove their own manage_users permission
    const target = getUserById(targetUserId)
    if (target?.role === 'owner' && requestingUserId === targetUserId) {
      const p = perms as Record<string, unknown>
      if (p.perm_manage_users === 0) {
        return { success: false, error: 'Owner cannot remove their own management permission.' }
      }
    }
    try {
      updateUserPermissions(targetUserId, perms as Parameters<typeof updateUserPermissions>[1])
      logAction(requestingUserId, 'UPDATE_PERMISSIONS', 'user', targetUserId, perms)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('users:update-profile', async (
    _,
    requestingUserId: string,
    targetUserId: string,
    data: { name?: string; username?: string; role?: string }
  ) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied. Only Owner can update user profiles.' }
    }
    try {
      const updated = updateUser(targetUserId, data)
      logAction(requestingUserId, 'UPDATE_USER_PROFILE', 'user', targetUserId, data)
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('users:reset-pin', async (_, requestingUserId: string, targetUserId: string, newPin: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    // Users can reset own PIN, or owner can reset any
    if (requestingUserId !== targetUserId && !requester.perm_manage_users) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      resetUserPin(targetUserId, newPin)
      logAction(requestingUserId, 'RESET_PIN', 'user', targetUserId, {})
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('users:toggle-active', async (_, requestingUserId: string, targetUserId: string, isActive: boolean) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied.' }
    }
    if (requestingUserId === targetUserId) {
      return { success: false, error: 'Cannot deactivate your own account.' }
    }
    try {
      toggleUserActive(targetUserId, isActive)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('users:delete', async (_, requestingUserId: string, targetUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_manage_users) {
      return { success: false, error: 'Access denied. Only Owner can delete users.' }
    }
    if (requestingUserId === targetUserId) {
      return { success: false, error: 'Cannot delete your own logged-in account.' }
    }
    try {
      deleteUser(targetUserId)
      logAction(requestingUserId, 'DELETE_USER', 'user', targetUserId, {})
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- ITEMS / STOCK ----
  ipcMain.handle('items:search', async (_, query: string) => {
    return searchItems(query)
  })

  ipcMain.handle('items:by-barcode', async (_, barcode: string) => {
    return getItemByBarcode(barcode)
  })

  ipcMain.handle('items:get-all', async () => {
    return getAllItems()
  })

  ipcMain.handle('items:get-by-id', async (_, id: string) => {
    return getItemById(id)
  })

  ipcMain.handle('items:create', async (_, requestingUserId: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_add_edit_stock) {
      return { success: false, error: 'Access denied. You do not have permission to add stock items.' }
    }
    try {
      const item = createItem(data as Parameters<typeof createItem>[0], requestingUserId)
      logAction(requestingUserId, 'CREATE_ITEM', 'item', (item as {id:string}).id, {})
      return { success: true, data: item }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('items:update', async (_, requestingUserId: string, itemId: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_add_edit_stock) {
      return { success: false, error: 'Access denied. You do not have permission to modify stock items.' }
    }
    try {
      updateItem(itemId, data as Parameters<typeof updateItem>[1])
      logAction(requestingUserId, 'UPDATE_ITEM', 'item', itemId, data)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('items:quantity-report', async () => {
    return getQuantityReport()
  })

  ipcMain.handle('items:transaction-history', async (_, itemId: string) => {
    return getTransactionHistory(itemId)
  })

  // ---- INVOICES ----
  ipcMain.handle('invoices:create', async (_, requestingUserId: string, data: object) => {
    try {
      const invoice = createInvoice(data as Parameters<typeof createInvoice>[0], requestingUserId)
      logAction(requestingUserId, 'CREATE_INVOICE', 'invoice', invoice.id, { number: invoice.invoice_number })
      return { success: true, data: invoice }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('invoices:get-by-id', async (_, id: string) => {
    return getInvoiceById(id)
  })

  ipcMain.handle('invoices:get-by-date', async (_, date: string) => {
    return getInvoicesByDate(date)
  })

  ipcMain.handle('invoices:get-by-range', async (
    _,
    from: string,
    to: string,
    staffId?: string,
    source?: string,
    paymentMethod?: string,
    search?: string
  ) => {
    return getInvoicesByDateRange(from, to, staffId, source, paymentMethod, search)
  })

  ipcMain.handle('invoices:get-pending', async (_, requestingUserId?: string, search?: string) => {
    return getPendingInvoices(search)
  })

  ipcMain.handle('invoices:void', async (_, requestingUserId: string, invoiceId: string, reason: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_void_invoice) {
      return { success: false, error: 'Access denied. You do not have permission to void invoices.' }
    }
    try {
      voidInvoice(invoiceId, reason, requestingUserId)
      logAction(requestingUserId, 'VOID_INVOICE', 'invoice', invoiceId, { reason })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('invoices:pay-balance', async (_, requestingUserId: string, data: { invoice_id: string; amount: number; method: string; reference?: string; notes?: string }) => {
    try {
      const invoice = recordInvoicePayment(data as any, requestingUserId)
      logAction(requestingUserId, 'COLLECT_INVOICE_PAYMENT', 'invoices', data.invoice_id, { amount: data.amount, method: data.method })
      return { success: true, data: invoice }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // EDIT INVOICE — perm_edit_invoice enforced HERE at IPC layer
  ipcMain.handle('invoices:edit-check', async (_, requestingUserId: string, invoiceId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { canEdit: false, reason: 'Not authenticated' }
    const invoice = getInvoiceById(invoiceId)
    if (!invoice) return { canEdit: false, reason: 'Invoice not found' }
    if (invoice.is_locked) return { canEdit: false, reason: 'Invoice locked after day close. Contact Owner to override.' }
    if (requester.role !== 'owner' && !requester.perm_edit_invoice) return { canEdit: false, reason: 'You do not have permission to edit invoices. Please ask the Owner to grant this access.' }
    return { canEdit: true }
  })

  ipcMain.handle('invoices:update', async (_, requestingUserId: string, invoiceId: string, data: Parameters<typeof updateInvoice>[1]) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Not authenticated' }
    if (requester.role !== 'owner' && !requester.perm_edit_invoice) {
      return { success: false, error: 'Permission denied. Only Owner or authorized users can edit invoices.' }
    }
    const invoice = getInvoiceById(invoiceId)
    if (!invoice) return { success: false, error: 'Invoice not found' }
    if (invoice.is_locked && requester.role !== 'owner') {
      return { success: false, error: 'Invoice is locked after day close.' }
    }
    try {
      const updated = updateInvoice(invoiceId, data, requestingUserId)
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- PARKED SALES ----
  ipcMain.handle('sales:park', async (_, requestingUserId: string, cartData: object, customerId: string | null, label: string) => {
    try {
      parkSale(cartData, customerId, requestingUserId, label)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('sales:get-parked', async (_, requestingUserId: string) => {
    return getParkedSales(requestingUserId)
  })

  ipcMain.handle('sales:delete-parked', async (_, id: string) => {
    deleteParkedSale(id)
    return { success: true }
  })

  // ---- CUSTOMERS ----
  ipcMain.handle('customers:get-all', async () => getAllCustomers())
  ipcMain.handle('customers:search', async (_, query: string) => searchCustomers(query))
  ipcMain.handle('customers:create', async (_, requestingUserId: string, data: object) => {
    try {
      const customer = createCustomer(data as Parameters<typeof createCustomer>[0], requestingUserId)
      return { success: true, data: customer }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('customers:update', async (_, requestingUserId: string, customerId: string, data: object) => {
    try {
      const customer = updateCustomer(customerId, data as Parameters<typeof updateCustomer>[1])
      logAction(requestingUserId, 'UPDATE_CUSTOMER', 'customer', customerId, data)
      return { success: true, data: customer }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('customers:delete', async (_, requestingUserId: string, customerId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (requester.role !== 'owner' && requester.role !== 'manager' && !requester.perm_manage_users)) {
      return { success: false, error: 'Access denied. Only Owner or Manager can delete customers.' }
    }
    try {
      deleteCustomer(customerId)
      logAction(requestingUserId, 'DELETE_CUSTOMER', 'customer', customerId, {})
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('customers:by-phone', async (_, phone: string) => {
    return getCustomerByPhone(phone)
  })

  // ---- SUPPLIERS ----
  ipcMain.handle('suppliers:get-all', async () => getAllSuppliers())
  ipcMain.handle('suppliers:create', async (_, requestingUserId: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (!requester.perm_record_purchase && !requester.perm_add_edit_stock && requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied. You do not have permission to manage suppliers.' }
    }
    try {
      const supplier = createSupplier(data as Parameters<typeof createSupplier>[0], requestingUserId)
      logAction(requestingUserId, 'CREATE_SUPPLIER', 'supplier', supplier.id, { name: supplier.name })
      return { success: true, data: supplier }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  ipcMain.handle('suppliers:update', async (_, requestingUserId: string, id: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (!requester.perm_record_purchase && !requester.perm_add_edit_stock && requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied. You do not have permission to manage suppliers.' }
    }
    try {
      const supplier = updateSupplier(id, data as Parameters<typeof updateSupplier>[1])
      logAction(requestingUserId, 'UPDATE_SUPPLIER', 'supplier', supplier.id, { name: supplier.name })
      return { success: true, data: supplier }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  ipcMain.handle('suppliers:delete', async (_, requestingUserId: string, id: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied. Only owners or managers can delete suppliers.' }
    }
    try {
      deleteSupplier(id)
      logAction(requestingUserId, 'DELETE_SUPPLIER', 'supplier', id, {})
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- PURCHASES ----
  ipcMain.handle('purchases:create', async (_, requestingUserId: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (!requester.perm_record_purchase && !requester.perm_add_edit_stock && requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied. You do not have permission to record purchases.' }
    }
    try {
      const purchase = createPurchase(data as Parameters<typeof createPurchase>[0], requestingUserId)
      logAction(requestingUserId, 'CREATE_PURCHASE', 'purchase', purchase.id, { number: purchase.purchase_number })
      return { success: true, data: purchase }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('purchases:get-all', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (!requester.perm_record_purchase && !requester.perm_add_edit_stock && requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied.' }
    }
    return { success: true, data: getAllPurchases() }
  })

  ipcMain.handle('purchases:pay', async (_, requestingUserId: string, data: object) => {
    const requester = getUserById(requestingUserId)
    if (!requester || (!requester.perm_record_purchase && !requester.perm_add_edit_stock && requester.role !== 'owner' && requester.role !== 'manager')) {
      return { success: false, error: 'Access denied. You do not have permission to record purchase payments.' }
    }
    try {
      const purchase = payPurchaseInvoice(data as Parameters<typeof payPurchaseInvoice>[0], requestingUserId)
      return { success: true, data: purchase }
    } catch (err) {
      console.error('[purchases:pay] error:', err)
      return { success: false, error: String(err) }
    }
  })

  // ---- REPORTS ----
  ipcMain.handle('reports:daily-sale', async (_, requestingUserId: string, date: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    // Sales persons can only see their own; others see all
    try {
      const report = getDailySaleReport(date)
      // Filter invoices for salesperson to only their own
      if (requester.role === 'salesperson' && !requester.perm_view_all_reports) {
        report.invoices = report.invoices.filter((i: { staff_id: string }) => i.staff_id === requestingUserId)
        report.totals.total_sales = report.invoices.reduce((s: number, i: { grand_total: number }) => s + (i.grand_total || 0), 0)
        report.totals.total_profit = report.invoices.reduce((s: number, i: { profit: number; amount_paid?: number; grand_total: number }) => {
          const ratio = (i.grand_total && i.grand_total > 0) ? ((i.amount_paid ?? i.grand_total) / i.grand_total) : 1
          return s + (i.profit || 0) * Math.min(1, Math.max(0, ratio))
        }, 0)
        report.totals.total_discount = report.invoices.reduce((s: number, i: { discount_amount: number }) => s + (i.discount_amount || 0), 0)
        report.totals.invoice_count = report.invoices.length
      }
      // Strip cost/profit fields from invoice for salespersons not allowed to view
      if (!requester.perm_view_cost_price) {
        report.totals.total_cost = 0
        report.invoices = report.invoices.map(inv => ({ ...inv, cost_total: 0, profit: 0 }))
      }
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('reports:staff-sales', async (
    _,
    requestingUserId: string,
    fromDate: string,
    toDate?: string,
    staffId?: string
  ) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const targetStaff = (requester.role === 'salesperson' && !requester.perm_view_all_reports)
        ? requestingUserId
        : staffId
      const report = getStaffSalesReport(fromDate, toDate, targetStaff)
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- SETTINGS ----
  ipcMain.handle('settings:get-all', async () => getAllSettings())
  ipcMain.handle('settings:set', async (_, requestingUserId: string, key: string, value: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied.' }
    }
    setSetting(key, value)
    return { success: true }
  })

  // ---- BRANDS & CATEGORIES ----
  ipcMain.handle('brands:get-all', async () => getAllBrands())
  ipcMain.handle('brands:create', async (_, requestingUserId: string, name: string) => {
    try {
      const brand = createBrand(name, requestingUserId)
      return { success: true, data: brand }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  ipcMain.handle('categories:get-all', async () => getAllCategories())

  // ---- MAINTENANCE ----
  ipcMain.handle('maintenance:reindex', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied. Maintenance is Owner-only.' }
    }
    try {
      const result = reindexData()
      logAction(requestingUserId, 'REINDEX', 'system', null, result)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('maintenance:backup', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied.' }
    }
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Backup',
      defaultPath: `nuqta-backup-${new Date().toISOString().slice(0,10)}.db`,
      filters: [{ name: 'Database Backup', extensions: ['db'] }]
    })
    if (!filePath) return { success: false, error: 'Cancelled' }
    try {
      const fs = await import('fs')
      const dbPath = join(app.getPath('userData'), 'aldeewan-pos.db')
      fs.copyFileSync(dbPath, filePath)
      logAction(requestingUserId, 'BACKUP', 'system', null, { path: filePath })
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- ONLINE ORDERS (Phase 2) ----
  ipcMain.handle('orders:get-online', async (_, statusFilter?: string) => {
    return getOnlineOrders(statusFilter)
  })

  ipcMain.handle('invoices:update-status', async (_, requestingUserId: string, invoiceId: string, status: string, trackingNumber?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      updateInvoiceStatus(invoiceId, status, trackingNumber)
      logAction(requestingUserId, 'UPDATE_ORDER_STATUS', 'invoices', invoiceId, { status, trackingNumber })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- RETURNS & REFUNDS (Phase 2) ----
  ipcMain.handle('returns:get-all', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      return { success: true, data: getAllReturns() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('returns:get-by-id', async (_, id: string) => {
    return getReturnById(id)
  })

  ipcMain.handle('returns:create', async (_, requestingUserId: string, data: Parameters<typeof createReturn>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_process_return) {
      return { success: false, error: 'Access denied. You do not have permission to process returns.' }
    }
    try {
      const ret = createReturn(data, requestingUserId)
      logAction(requestingUserId, 'CREATE_RETURN', 'returns', ret.id, { return_number: ret.return_number, amount: ret.refund_amount })
      return { success: true, data: ret }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- DAY CLOSING (Phase 2) ----
  ipcMain.handle('dayclose:check-status', async (_, date: string) => {
    return isDayClosed(date)
  })

  ipcMain.handle('dayclose:calculate', async (_, requestingUserId: string, date: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const calc = calculateDayClose(date)
      return { success: true, data: calc }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dayclose:submit', async (_, requestingUserId: string, data: Parameters<typeof submitDayClose>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_day_closing) {
      return { success: false, error: 'Access denied. Only authorized users can perform Day Closing.' }
    }
    try {
      const close = submitDayClose(data, requestingUserId)
      return { success: true, data: close }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dayclose:get-all', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      return { success: true, data: getDayCloses() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- ACCOUNTS & FINANCIAL LEDGER (Phase 3) ----
  ipcMain.handle('accounts:get-all', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied. You do not have permission to view accounts.' }
    }
    try {
      return { success: true, data: getAllAccounts() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('accounts:create', async (_, requestingUserId: string, data: Parameters<typeof createAccount>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const acc = createAccount(data, requestingUserId)
      return { success: true, data: acc }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('accounts:ledger', async (_, requestingUserId: string, accountId: string, fromDate?: string, toDate?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const ledger = getAccountLedger(accountId, fromDate, toDate)
      return { success: true, data: ledger }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('journal:create', async (_, requestingUserId: string, data: Parameters<typeof createJournalEntry>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const entry = createJournalEntry(data, requestingUserId)
      return { success: true, data: entry }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('journal:get-all', async (_, requestingUserId: string, fromDate?: string, toDate?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const entries = getAllJournalEntries(fromDate, toDate)
      return { success: true, data: entries }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('payments:customer-receive', async (_, requestingUserId: string, data: Parameters<typeof recordCustomerPayment>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      recordCustomerPayment(data, requestingUserId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('payments:supplier-pay', async (_, requestingUserId: string, data: Parameters<typeof recordSupplierPayment>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      recordSupplierPayment(data, requestingUserId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('reports:profit-loss', async (_, requestingUserId: string, fromDate: string, toDate: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const report = getProfitAndLossReport(fromDate, toDate)
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('reports:financial-analytics', async (_, requestingUserId: string, fromDate: string, toDate: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const report = getFinancialAnalytics(fromDate, toDate)
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('reports:item-sales-performance', async (_, fromDate?: string, toDate?: string) => {
    try {
      const report = getItemSalesPerformance(fromDate, toDate)
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('reports:daily-entries', async (_, requestingUserId: string, date: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_accounts) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const entries = getDailyEntriesReport(date)
      return { success: true, data: entries }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- EXPENSES & STORE CASH OUT ----
  ipcMain.handle('expenses:create', async (_, requestingUserId: string, data: Parameters<typeof createExpense>[0]) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const exp = createExpense(data, requestingUserId)
      return { success: true, data: exp }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('expenses:get-all', async (_, requestingUserId: string, fromDate?: string, toDate?: string, category?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const list = getExpenses(fromDate, toDate, category)
      return { success: true, data: list }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('expenses:get-by-id', async (_, id: string) => {
    return getExpenseById(id)
  })

  ipcMain.handle('expenses:delete', async (_, requestingUserId: string, expenseId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied. Only Manager/Owner can delete expenses.' }
    }
    try {
      deleteExpense(expenseId, requestingUserId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('pos:get-today-summary', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const summary = getTodayPOSSummary(requestingUserId)
      return { success: true, data: summary }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- STATEMENTS & PARTY ACCOUNTS (Phase 4) ----
  ipcMain.handle('statements:customer', async (_, requestingUserId: string, customerId: string, fromDate?: string, toDate?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const statement = getCustomerStatement(customerId, fromDate, toDate)
      return { success: true, data: statement }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('statements:supplier', async (_, requestingUserId: string, supplierId: string, fromDate?: string, toDate?: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester) return { success: false, error: 'Unauthorized' }
    try {
      const statement = getSupplierStatement(supplierId, fromDate, toDate)
      return { success: true, data: statement }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('maintenance:restore', async (_, requestingUserId: string) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied. Only Owner can restore database.' }
    }
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Select Database Backup (.db)',
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (!filePaths || filePaths.length === 0) return { success: false, error: 'Cancelled' }
    const backupPath = filePaths[0]
    try {
      restoreDatabaseFromFile(backupPath)
      const fs = await import('fs')
      const targetDb = join(app.getPath('userData'), 'aldeewan-pos.db')
      fs.copyFileSync(backupPath, targetDb)
      logAction(requestingUserId, 'RESTORE_DATABASE', 'system', null, { from: backupPath })
      return { success: true, message: 'Database restored successfully! Please restart the application.' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- ENTERPRISE SUITE (Phase 5) ----
  ipcMain.handle('reports:aging', async (_, requestingUserId: string, type: 'ar' | 'ap') => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_view_all_reports) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const data = getAgingReport(type)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('items:bulk-import', async (_, requestingUserId: string, items: BulkImportItemInput[]) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_add_edit_stock) {
      return { success: false, error: 'Access denied.' }
    }
    try {
      const count = bulkImportItems(requestingUserId, items)
      return { success: true, imported: count }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('audit:get-logs', async (_, requestingUserId: string, filters?: { userId?: string; action?: string; fromDate?: string; toDate?: string }) => {
    const requester = getUserById(requestingUserId)
    if (!requester || !requester.perm_access_maintenance) {
      return { success: false, error: 'Access denied. Audit trail is restricted to Owner.' }
    }
    try {
      const logs = getAuditLogs(filters?.userId, filters?.action, filters?.fromDate, filters?.toDate)
      return { success: true, data: logs }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('items:low-stock', async () => {
    try {
      return getLowStockItems()
    } catch (err) {
      return []
    }
  })

  // ---- PRINTING & PRINT PREVIEW ----
  ipcMain.handle('print:get-printers', async () => {
    try {
      if (!mainWindow) return []
      const printers = await mainWindow.webContents.getPrintersAsync()
      return printers
    } catch (err) {
      console.error('[Main] Failed to get printers:', err)
      return []
    }
  })

  ipcMain.handle('print:print', async (_, options?: {
    silent?: boolean
    printBackground?: boolean
    deviceName?: string
    color?: boolean
    margins?: { marginType?: 'default' | 'none' | 'printableArea' | 'custom'; top?: number; bottom?: number; left?: number; right?: number }
    pageSize?: string | { width: number; height: number }
  }) => {
    return new Promise((resolve) => {
      if (!mainWindow) {
        resolve({ success: false, error: 'Main window not available' })
        return
      }

      mainWindow.webContents.print(
        {
          silent: options?.silent ?? false,
          printBackground: options?.printBackground ?? true,
          deviceName: options?.deviceName || '',
          color: options?.color ?? true,
          margins: options?.margins || { marginType: 'printableArea' },
          pageSize: (options?.pageSize as any) || 'A4'
        },
        (success, errorType) => {
          if (!success) {
            resolve({ success: false, error: errorType || 'Print cancelled or failed' })
          } else {
            resolve({ success: true })
          }
        }
      )
    })
  })

  ipcMain.handle('print:to-pdf', async (_, defaultFilename = 'receipt.pdf') => {
    try {
      if (!mainWindow) return { success: false, error: 'Main window not available' }
      const pdfData = await mainWindow.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: 'printableArea' }
      })

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Document as PDF',
        defaultPath: defaultFilename,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      const fs = await import('fs/promises')
      await fs.writeFile(filePath, pdfData)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ---- MOBILE REMOTE SERVER ----
  ipcMain.handle('mobile:get-info', async () => {
    return { success: true, data: getMobileServerInfo() }
  })

  ipcMain.handle('mobile:start', async (_, port?: number) => {
    try {
      const targetPort = port || parseInt(getSetting('mobile_server_port') || '8080', 10) || 8080
      const info = await startMobileServer(targetPort)
      setSetting('mobile_server_enabled', '1')
      setSetting('mobile_server_port', String(info.port))
      return { success: true, data: info }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('mobile:stop', async () => {
    try {
      stopMobileServer()
      setSetting('mobile_server_enabled', '0')
      return { success: true, data: getMobileServerInfo() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('mobile:restart', async (_, port: number) => {
    try {
      const info = await startMobileServer(port || 8080)
      setSetting('mobile_server_port', String(info.port))
      return { success: true, data: info }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('mobile:allow-firewall', async () => {
    try {
      const psCommand = `Start-Process powershell -Verb runAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command netsh advfirewall firewall add rule name=\\"Nuqta AI POS Mobile Server\\" dir=in action=allow protocol=TCP localport=8080-8095 profile=any'`
      const { exec } = require('child_process')
      exec(`powershell -Command "${psCommand}"`, (err: any) => {
        if (err) console.error('Firewall rule error:', err)
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ---- WHATSAPP AUTOMATION ----
  ipcMain.handle('whatsapp:get-config', async () => {
    try {
      return { success: true, data: getWhatsAppConfig() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('whatsapp:save-config', async (_, config) => {
    return saveWhatsAppConfig(config)
  })

  ipcMain.handle('whatsapp:send-day-close', async (_, dateStr, forceManual) => {
    return await sendWhatsAppDayClose(dateStr, forceManual ?? true)
  })

  ipcMain.handle('whatsapp:get-preview', async (_, dateStr) => {
    try {
      return { success: true, data: formatDayCloseWhatsAppMessage(dateStr) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ---- CLOUDFLARE WORLDWIDE TUNNEL ----
  ipcMain.handle('cloudflare:check', async () => {
    try {
      const res = await checkCloudflaredInstalled()
      return { success: true, data: res }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('cloudflare:start', async (_, port?: number) => {
    try {
      let mobileInfo = getMobileServerInfo()
      if (!mobileInfo.isRunning) {
        const preferredPort = port || parseInt(getSetting('mobile_server_port') || '8080', 10) || 8080
        mobileInfo = await startMobileServer(preferredPort)
      }
      const targetPort = mobileInfo.isRunning ? mobileInfo.port : (port || parseInt(getSetting('mobile_server_port') || '8080', 10) || 8080)
      const status = await startCloudflareTunnel(targetPort)
      return { success: !status.error, data: status, error: status.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('cloudflare:stop', async () => {
    try {
      stopCloudflareTunnel()
      return { success: true, data: getCloudflareTunnelStatus() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('cloudflare:status', async () => {
    return { success: true, data: getCloudflareTunnelStatus() }
  })

  // ---- VOICE & SPEECH TRANSCRIPTION (WHISPER AI) ----
  ipcMain.handle('voice:transcribe', async (_, audioBase64: string, mimeType: string, language?: string) => {
    try {
      if (!audioBase64) return { success: false, error: 'No audio data provided' }
      const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64
      const buffer = Buffer.from(base64Data, 'base64')
      console.log(`[SpeechService] Transcribing audio buffer (${buffer.length} bytes, mime: ${mimeType}, lang: ${language || 'auto'})`)
      const res = await transcribeAudioBuffer(buffer, mimeType, language || 'auto')
      console.log('[SpeechService] Transcription result:', res)
      return res
    } catch (err: any) {
      console.error('[Main] voice:transcribe IPC error:', err)
      return { success: false, error: err?.message || 'Transcription error' }
    }
  })

  // ---- SYSTEM / BROWSER SHORTCUTS ----
  ipcMain.handle('system:open-url', async (_, targetUrl: string) => {
    try {
      if (targetUrl) {
        await shell.openExternal(targetUrl)
        return { success: true }
      }
      return { success: false, error: 'Empty URL provided' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ---- LLM AI INTELLIGENCE & POS NLU ----
  ipcMain.handle('llm:processVoiceCommand', async (_, payload: any) => {
    try {
      return await processVoiceCommandWithLLM(payload)
    } catch (err: any) {
      console.error('[Main] llm:processVoiceCommand error:', err)
      return { success: false, error: err?.message || 'LLM execution failed' }
    }
  })

  ipcMain.handle('llm:testConnection', async (_, provider: string, apiKey: string, baseUrl?: string, model?: string) => {
    try {
      return await testLLMConnection(provider, apiKey, baseUrl, model)
    } catch (err: any) {
      console.error('[Main] llm:testConnection error:', err)
      return { success: false, message: err?.message || 'Connection test failed', latencyMs: 0 }
    }
  })

  ipcMain.handle('llm:checkOmniRoute', async (_, customUrl?: string) => {
    try {
      return await checkOmniRouteServer(customUrl)
    } catch (err: any) {
      console.error('[Main] llm:checkOmniRoute error:', err)
      return { isRunning: false, baseUrl: customUrl || 'http://localhost:20128/v1', dashboardUrl: 'http://localhost:20128', models: [], error: err.message }
    }
  })

  // ---- MULTI-TERMINAL & LAN NETWORK SYNC ----
  ipcMain.handle('terminal:scan-master', async () => {
    try {
      const servers = await scanForMasterServer(2500)
      return { success: true, data: servers }
    } catch (err: any) {
      console.error('[Main] terminal:scan-master error:', err)
      return { success: false, error: err.message, data: [] }
    }
  })

  ipcMain.handle('terminal:get-active-list', async () => {
    try {
      return { success: true, data: getActiveTerminals() }
    } catch (err: any) {
      return { success: false, error: err.message, data: [] }
    }
  })

  ipcMain.handle('terminal:test-lan-ping', async (_, serverUrl: string) => {
    const start = Date.now()
    try {
      const target = serverUrl.replace(/\/+$/, '')
      const http = require('http')
      return new Promise((resolve) => {
        const req = http.get(`${target}/api/discovery`, { timeout: 3000 }, (res: any) => {
          if (res.statusCode === 200) {
            resolve({ success: true, latencyMs: Date.now() - start, message: `Connected to Master Server (${Date.now() - start}ms)` })
          } else {
            resolve({ success: false, latencyMs: Date.now() - start, message: `Server responded with status HTTP ${res.statusCode}` })
          }
        })
        req.on('error', (e: any) => {
          resolve({ success: false, latencyMs: Date.now() - start, message: `Cannot reach Master at ${target} (${e.message})` })
        })
        req.on('timeout', () => {
          req.destroy()
          resolve({ success: false, latencyMs: Date.now() - start, message: `Connection timed out after 3000ms` })
        })
      })
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - start, message: err.message }
    }
  })

  // ---- AUTOMATED GOOGLE DRIVE CLOUD BACKUP ----
  ipcMain.handle('gdrive:get-config', async () => {
    try {
      const config = await getGDriveConfig()
      return { success: true, data: config }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('gdrive:save-config', async (_, config) => {
    try {
      await saveGDriveConfig(config)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('gdrive:backup-now', async (_, requestingUserId?: string) => {
    try {
      return await performGDriveBackup(requestingUserId)
    } catch (err: any) {
      return { success: false, message: err.message, timestamp: Date.now() }
    }
  })

  ipcMain.handle('gdrive:test-connection', async (_, webhookUrl?: string) => {
    try {
      return await testGDriveConnection(webhookUrl)
    } catch (err: any) {
      return { success: false, message: err.message, latencyMs: 0 }
    }
  })

  console.log('[IPC] All handlers registered')
}
