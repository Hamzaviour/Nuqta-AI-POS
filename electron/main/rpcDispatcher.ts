import http from 'http'
import {
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
  getCustomerStatement, getSupplierStatement,
  getAgingReport, bulkImportItems, getAuditLogs, getLowStockItems,
  createExpense, getExpenseById, getExpenses, deleteExpense, getTodayPOSSummary,
  BulkImportItemInput, getItemSalesPerformance, getFinancialAnalytics
} from '../database/db'

export interface TerminalSession {
  terminalId: string
  terminalName: string
  ip: string
  os: string
  lastPing: number
  isMaster?: boolean
}

// Active satellite terminal heartbeats
const connectedTerminals = new Map<string, TerminalSession>()

// Connected Server-Sent Events (SSE) clients for real-time live sync
const eventSubscribers = new Set<http.ServerResponse>()

/**
 * Register or update a terminal heartbeat
 */
export function registerTerminalHeartbeat(info: {
  terminalId: string
  terminalName: string
  ip: string
  os?: string
  isMaster?: boolean
}): void {
  connectedTerminals.set(info.terminalId, {
    terminalId: info.terminalId,
    terminalName: info.terminalName || `Terminal ${info.terminalId}`,
    ip: info.ip,
    os: info.os || 'Unknown',
    lastPing: Date.now(),
    isMaster: !!info.isMaster
  })
}

/**
 * Get all active connected terminals (active within last 30s)
 */
export function getActiveTerminals(): TerminalSession[] {
  const now = Date.now()
  const active: TerminalSession[] = []
  for (const [id, session] of connectedTerminals.entries()) {
    if (now - session.lastPing < 45000) {
      active.push(session)
    } else {
      connectedTerminals.delete(id)
    }
  }
  return active
}

/**
 * Subscribe a client HTTP response to real-time sync event broadcasts
 */
export function addEventSubscriber(res: http.ServerResponse): () => void {
  eventSubscribers.add(res)
  return () => {
    eventSubscribers.delete(res)
  }
}

/**
 * Broadcast a real-time event to all connected satellite terminals
 */
export function broadcastSyncEvent(event: {
  type: string
  action: string
  data?: any
  terminalId?: string
}): void {
  const payload = `data: ${JSON.stringify({ ...event, timestamp: Date.now() })}\n\n`
  for (const client of eventSubscribers) {
    try {
      client.write(payload)
    } catch (e) {
      eventSubscribers.delete(client)
    }
  }
}

/**
 * Universal RPC Dispatcher — maps IPC channel / RPC action to DB handlers
 */
export async function executeRpcCommand(
  channel: string,
  args: any[] = [],
  terminalId?: string
): Promise<any> {
  const isWrite = isWriteAction(channel)

  try {
    let result: any = null

    switch (channel) {
      // ---- AUTH ----
      case 'auth:login': {
        const [username, pin] = args
        const user = verifyLogin(username, pin)
        if (user) {
          logAction(user.id, 'LOGIN', 'user', user.id, { username, terminalId: terminalId || 'local' })
        }
        result = { success: !!user, user }
        break
      }

      case 'auth:get-all-users-for-login': {
        const users = getAllUsers()
        result = users
          .filter((u: { is_active: number }) => u.is_active)
          .map((u: { id: string; name: string; username: string; role: string }) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role
          }))
        break
      }

      // ---- USERS ----
      case 'users:get-all': {
        const [requestingUserId] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users) {
          result = { success: false, error: 'Access denied.' }
        } else {
          result = { success: true, data: getAllUsers() }
        }
        break
      }

      case 'users:create': {
        const [requestingUserId, userData] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users) {
          result = { success: false, error: 'Access denied.' }
        } else {
          const user = createUser(userData)
          logAction(requestingUserId, 'CREATE_USER', 'user', user.id, { name: user.name })
          result = { success: true, data: user }
        }
        break
      }

      case 'users:update-permissions': {
        const [requestingUserId, targetUserId, perms] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users) {
          result = { success: false, error: 'Access denied.' }
        } else {
          updateUserPermissions(targetUserId, perms)
          logAction(requestingUserId, 'UPDATE_PERMISSIONS', 'user', targetUserId, perms)
          result = { success: true }
        }
        break
      }

      case 'users:update-profile': {
        const [requestingUserId, targetUserId, data] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users) {
          result = { success: false, error: 'Access denied.' }
        } else {
          const updated = updateUser(targetUserId, data)
          logAction(requestingUserId, 'UPDATE_USER_PROFILE', 'user', targetUserId, data)
          result = { success: true, data: updated }
        }
        break
      }

      case 'users:reset-pin': {
        const [requestingUserId, targetUserId, newPin] = args
        const requester = getUserById(requestingUserId)
        if (!requester) {
          result = { success: false, error: 'Unauthorized' }
        } else if (requestingUserId !== targetUserId && !requester.perm_manage_users) {
          result = { success: false, error: 'Access denied.' }
        } else {
          resetUserPin(targetUserId, newPin)
          logAction(requestingUserId, 'RESET_PIN', 'user', targetUserId, {})
          result = { success: true }
        }
        break
      }

      case 'users:toggle-active': {
        const [requestingUserId, targetUserId, isActive] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users || requestingUserId === targetUserId) {
          result = { success: false, error: 'Access denied.' }
        } else {
          toggleUserActive(targetUserId, isActive)
          result = { success: true }
        }
        break
      }

      case 'users:delete': {
        const [requestingUserId, targetUserId] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_manage_users || requestingUserId === targetUserId) {
          result = { success: false, error: 'Access denied.' }
        } else {
          deleteUser(targetUserId)
          logAction(requestingUserId, 'DELETE_USER', 'user', targetUserId, {})
          result = { success: true }
        }
        break
      }

      // ---- ITEMS & STOCK ----
      case 'items:search': {
        const [query] = args
        result = searchItems(query)
        break
      }

      case 'items:by-barcode': {
        const [barcode] = args
        result = getItemByBarcode(barcode)
        break
      }

      case 'items:get-all': {
        result = getAllItems()
        break
      }

      case 'items:get-by-id': {
        const [id] = args
        result = getItemById(id)
        break
      }

      case 'items:create': {
        const [requestingUserId, data] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_add_edit_stock) {
          result = { success: false, error: 'Access denied.' }
        } else {
          const item = createItem(data, requestingUserId)
          logAction(requestingUserId, 'CREATE_ITEM', 'item', (item as any).id, {})
          result = { success: true, data: item }
        }
        break
      }

      case 'items:update': {
        const [requestingUserId, itemId, data] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_add_edit_stock) {
          result = { success: false, error: 'Access denied.' }
        } else {
          updateItem(itemId, data)
          logAction(requestingUserId, 'UPDATE_ITEM', 'item', itemId, data)
          result = { success: true }
        }
        break
      }

      case 'items:quantity-report': {
        result = getQuantityReport()
        break
      }

      case 'items:transaction-history': {
        const [itemId] = args
        result = getTransactionHistory(itemId)
        break
      }

      case 'items:low-stock': {
        result = getLowStockItems()
        break
      }

      case 'items:bulk-import': {
        const [requestingUserId, items] = args
        const requester = getUserById(requestingUserId)
        if (!requester || !requester.perm_add_edit_stock) {
          result = { success: false, error: 'Access denied.' }
        } else {
          result = bulkImportItems(requestingUserId, items as BulkImportItemInput[])
        }
        break
      }

      // ---- INVOICES & SALES ----
      case 'invoices:create': {
        const [requestingUserId, data] = args
        // If created from satellite terminal, tag invoice with terminal_id
        if (terminalId && typeof data === 'object') {
          data.terminal_id = terminalId
        }
        const invoice = createInvoice(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_INVOICE', 'invoice', invoice.id, {
          invoice_number: invoice.invoice_number,
          total: invoice.grand_total,
          terminal_id: terminalId || 'T-01'
        })
        result = { success: true, data: invoice }
        break
      }

      case 'invoices:get-by-id': {
        const [id] = args
        result = getInvoiceById(id)
        break
      }

      case 'invoices:get-by-date': {
        const [date] = args
        result = getInvoicesByDate(date)
        break
      }

      case 'invoices:get-by-range': {
        const [from, to, staffId, source, paymentMethod, search] = args
        result = getInvoicesByDateRange(from, to, staffId, source, paymentMethod, search)
        break
      }

      case 'invoices:get-pending': {
        const [search] = args
        result = getPendingInvoices(search)
        break
      }

      case 'invoices:update': {
        const [requestingUserId, invoiceId, data] = args
        updateInvoice(invoiceId, data, requestingUserId)
        logAction(requestingUserId, 'UPDATE_INVOICE', 'invoice', invoiceId, data)
        result = { success: true }
        break
      }

      case 'invoices:void': {
        const [requestingUserId, invoiceId, reason] = args
        voidInvoice(invoiceId, requestingUserId, reason)
        logAction(requestingUserId, 'VOID_INVOICE', 'invoice', invoiceId, { reason })
        result = { success: true }
        break
      }

      case 'invoices:pay-balance': {
        const [requestingUserId, data] = args
        result = recordInvoicePayment(requestingUserId, data)
        break
      }

      case 'invoices:update-status': {
        const [requestingUserId, invoiceId, status, tracking] = args
        updateInvoiceStatus(invoiceId, status, tracking)
        logAction(requestingUserId, 'UPDATE_INVOICE_STATUS', 'invoice', invoiceId, { status, tracking })
        result = { success: true }
        break
      }

      // ---- PARKED SALES ----
      case 'sales:park': {
        const [requestingUserId, cartData, customerId, label] = args
        const id = parkSale(cartData, customerId, label, requestingUserId)
        result = { success: true, data: { id } }
        break
      }

      case 'sales:get-parked': {
        const [requestingUserId] = args
        result = getParkedSales(requestingUserId)
        break
      }

      case 'sales:delete-parked': {
        const [id] = args
        deleteParkedSale(id)
        result = { success: true }
        break
      }

      // ---- CUSTOMERS ----
      case 'customers:get-all': {
        result = getAllCustomers()
        break
      }

      case 'customers:search': {
        const [query] = args
        result = searchCustomers(query)
        break
      }

      case 'customers:create': {
        const [requestingUserId, data] = args
        const customer = createCustomer(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_CUSTOMER', 'customer', customer.id, { name: customer.name })
        result = { success: true, data: customer }
        break
      }

      case 'customers:update': {
        const [requestingUserId, customerId, data] = args
        updateCustomer(customerId, data)
        logAction(requestingUserId, 'UPDATE_CUSTOMER', 'customer', customerId, data)
        result = { success: true }
        break
      }

      case 'customers:delete': {
        const [requestingUserId, customerId] = args
        deleteCustomer(customerId)
        logAction(requestingUserId, 'DELETE_CUSTOMER', 'customer', customerId, {})
        result = { success: true }
        break
      }

      case 'customers:by-phone': {
        const [phone] = args
        result = getCustomerByPhone(phone)
        break
      }

      // ---- SUPPLIERS ----
      case 'suppliers:get-all': {
        result = getAllSuppliers()
        break
      }

      case 'suppliers:create': {
        const [requestingUserId, data] = args
        const supplier = createSupplier(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_SUPPLIER', 'supplier', supplier.id, { name: supplier.name })
        result = { success: true, data: supplier }
        break
      }

      case 'suppliers:update': {
        const [requestingUserId, id, data] = args
        const supplier = updateSupplier(id, data)
        logAction(requestingUserId, 'UPDATE_SUPPLIER', 'supplier', supplier.id, { name: supplier.name })
        result = { success: true, data: supplier }
        break
      }

      case 'suppliers:delete': {
        const [requestingUserId, id] = args
        deleteSupplier(id)
        logAction(requestingUserId, 'DELETE_SUPPLIER', 'supplier', id, {})
        result = { success: true }
        break
      }

      // ---- PURCHASES ----
      case 'purchases:create': {
        const [requestingUserId, data] = args
        const purchase = createPurchase(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_PURCHASE', 'purchase', purchase.id, { number: purchase.purchase_number })
        result = { success: true, data: purchase }
        break
      }

      case 'purchases:get-all': {
        result = getAllPurchases()
        break
      }

      case 'purchases:pay': {
        const [requestingUserId, data] = args
        result = payPurchaseInvoice(data, requestingUserId)
        break
      }

      // ---- EXPENSES ----
      case 'expenses:create': {
        const [requestingUserId, data] = args
        const expense = createExpense(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_EXPENSE', 'expense', expense.id, { amount: expense.amount })
        result = { success: true, data: expense }
        break
      }

      case 'expenses:get-all': {
        const [from, to, category] = args
        result = getExpenses(from, to, category)
        break
      }

      case 'expenses:get-by-id': {
        const [id] = args
        result = getExpenseById(id)
        break
      }

      case 'expenses:delete': {
        const [requestingUserId, expenseId] = args
        deleteExpense(expenseId, requestingUserId)
        logAction(requestingUserId, 'DELETE_EXPENSE', 'expense', expenseId, {})
        result = { success: true }
        break
      }

      case 'pos:get-today-summary': {
        const [requestingUserId] = args
        result = getTodayPOSSummary(requestingUserId)
        break
      }

      // ---- RETURNS ----
      case 'returns:create': {
        const [requestingUserId, data] = args
        const ret = createReturn(data, requestingUserId)
        logAction(requestingUserId, 'CREATE_RETURN', 'return', ret.id, { return_number: ret.return_number })
        result = { success: true, data: ret }
        break
      }

      case 'returns:get-all': {
        result = getAllReturns()
        break
      }

      case 'returns:get-by-id': {
        const [id] = args
        result = getReturnById(id)
        break
      }

      // ---- DAY CLOSE ----
      case 'dayclose:calculate': {
        const [date] = args
        result = calculateDayClose(date)
        break
      }

      case 'dayclose:submit': {
        const [requestingUserId, data] = args
        const dc = submitDayClose(data, requestingUserId)
        logAction(requestingUserId, 'SUBMIT_DAY_CLOSE', 'day_close', dc.id, { date: dc.date })
        result = { success: true, data: dc }
        break
      }

      case 'dayclose:get-all': {
        result = getDayCloses()
        break
      }

      case 'dayclose:check-status': {
        const [date] = args
        result = isDayClosed(date)
        break
      }

      // ---- REPORTS & ANALYTICS ----
      case 'reports:daily-sale': {
        const [date] = args
        result = getDailySaleReport(date)
        break
      }

      case 'reports:staff-sales': {
        const [fromDate, toDate, staffId] = args
        result = getStaffSalesReport(fromDate, toDate, staffId)
        break
      }

      case 'reports:profit-loss': {
        const [fromDate, toDate] = args
        result = getProfitAndLossReport(fromDate, toDate)
        break
      }

      case 'reports:financial-analytics': {
        const [fromDate, toDate] = args
        result = getFinancialAnalytics(fromDate, toDate)
        break
      }

      case 'reports:item-sales-performance': {
        const [fromDate, toDate] = args
        result = getItemSalesPerformance(fromDate, toDate)
        break
      }

      case 'reports:daily-entries': {
        const [date] = args
        result = getDailyEntriesReport(date)
        break
      }

      case 'reports:aging': {
        const [type] = args
        result = getAgingReport(type)
        break
      }

      case 'audit:get-logs': {
        const [requestingUserId, filters] = args
        result = getAuditLogs(requestingUserId, filters)
        break
      }

      // ---- SETTINGS ----
      case 'settings:get-all': {
        result = getAllSettings()
        break
      }

      case 'settings:set': {
        const [requestingUserId, key, value] = args
        setSetting(key, value)
        logAction(requestingUserId, 'SET_SETTING', 'setting', key, { value: key.includes('key') ? '***' : value })
        result = { success: true }
        break
      }

      // ---- BRANDS & CATEGORIES ----
      case 'brands:get-all': {
        result = getAllBrands()
        break
      }

      case 'brands:create': {
        const [requestingUserId, name] = args
        const brand = createBrand(name, requestingUserId)
        result = { success: true, data: brand }
        break
      }

      case 'categories:get-all': {
        result = getAllCategories()
        break
      }

      // ---- ACCOUNTS & FINANCIAL LEDGER ----
      case 'accounts:get-all': {
        result = getAllAccounts()
        break
      }

      case 'accounts:create': {
        const [requestingUserId, data] = args
        result = createAccount(data, requestingUserId)
        break
      }

      case 'accounts:ledger': {
        const [accountId, fromDate, toDate] = args
        result = getAccountLedger(accountId, fromDate, toDate)
        break
      }

      case 'journal:create': {
        const [requestingUserId, data] = args
        result = createJournalEntry(data, requestingUserId)
        break
      }

      case 'journal:get-all': {
        const [fromDate, toDate] = args
        result = getAllJournalEntries(fromDate, toDate)
        break
      }

      case 'payments:customer-receive': {
        const [requestingUserId, data] = args
        result = recordCustomerPayment(data, requestingUserId)
        break
      }

      case 'payments:supplier-pay': {
        const [requestingUserId, data] = args
        result = recordSupplierPayment(data, requestingUserId)
        break
      }

      case 'statements:customer': {
        const [customerId, fromDate, toDate] = args
        result = getCustomerStatement(customerId, fromDate, toDate)
        break
      }

      case 'statements:supplier': {
        const [supplierId, fromDate, toDate] = args
        result = getSupplierStatement(supplierId, fromDate, toDate)
        break
      }

      // ---- ONLINE ORDERS ----
      case 'orders:get-online': {
        const [statusFilter] = args
        result = getOnlineOrders(statusFilter)
        break
      }

      // ---- MAINTENANCE ----
      case 'maintenance:reindex': {
        result = reindexData()
        break
      }

      default:
        return { success: false, error: `Unknown RPC action: ${channel}` }
    }

    // Broadcast write event to all active satellite terminals (Win/Mac)
    if (isWrite) {
      broadcastSyncEvent({
        type: 'SYNC_EVENT',
        action: channel,
        data: result,
        terminalId
      })
    }

    return result
  } catch (err: any) {
    console.error(`[RPCDispatcher] Error executing ${channel}:`, err)
    return { success: false, error: err.message || String(err) }
  }
}

/**
 * Determine if an action mutates data and warrants an SSE broadcast
 */
function isWriteAction(channel: string): boolean {
  return (
    channel.includes(':create') ||
    channel.includes(':update') ||
    channel.includes(':delete') ||
    channel.includes(':void') ||
    channel.includes(':pay') ||
    channel.includes(':set') ||
    channel.includes(':submit') ||
    channel.includes(':reset') ||
    channel.includes(':toggle') ||
    channel.includes(':import')
  )
}
