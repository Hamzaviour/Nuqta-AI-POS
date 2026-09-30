import http from 'http'
import os from 'os'
import fs from 'fs'
import path from 'path'
import {
  verifyLogin, getAllUsers, calculateDayClose, submitDayClose, isDayClosed,
  getTodayPOSSummary, getInvoicesByDate, getInvoicesByDateRange, getInvoiceById, getSetting,
  getUserById, logAction,
  getAllItems, searchItems, getLowStockItems, getItemById, getItemByBarcode,
  getAllReturns, getReturnById,
  getOnlineOrders, updateInvoiceStatus,
  getProfitAndLossReport, getFinancialAnalytics, getItemSalesPerformance,
  getAllCategories, getAllBrands, getAllSettings,
  createInvoice, getAllCustomers, searchCustomers, createCustomer,
  parkSale, getParkedSales, deleteParkedSale
} from '../database/db'
import { formatDayCloseWhatsAppMessage, sendWhatsAppDayClose, getWhatsAppConfig } from './whatsappScheduler'
import {
  executeRpcCommand,
  addEventSubscriber,
  getActiveTerminals,
  registerTerminalHeartbeat
} from './rpcDispatcher'
import {
  startMasterDiscoveryBeacon,
  stopMasterDiscoveryBeacon
} from './lanDiscovery'

export interface MobileServerInfo {
  isRunning: boolean
  port: number
  localIps: string[]
  primaryUrl: string
  allUrls: string[]
}

let serverInstance: http.Server | null = null
let currentPort = 8080
const activeSessions = new Set<string>()

/**
 * Locate and return the Nuqta brand mark
 */
function getBrandLogoBuffer(): { buffer: Buffer; mimeType: string } | null {
  const possiblePaths = [
    path.join(__dirname, '../../src/assets/brand/nuqta-mark.png'),
    path.join(__dirname, '../../resources/logo.png'),
    path.join(__dirname, '../../resources/icon-square.png'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(process.cwd(), 'src/assets/brand/nuqta-mark.png'),
    path.join(process.cwd(), 'resources/icon-square.png'),
    path.join(process.cwd(), 'resources/icon.png')
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return { buffer: fs.readFileSync(p), mimeType: 'image/png' }
      } catch (_) {}
    }
  }
  return null
}

/**
 * Get all available local IPv4 network addresses
 */
export function getLocalIpAddresses(): string[] {
  const primaryIps: string[] = []
  const otherIps: string[] = []
  const virtualIps: string[] = []
  const ifaces = os.networkInterfaces()

  for (const name of Object.keys(ifaces)) {
    const isVirtual = /vEthernet|WSL|Virtual|Hyper-V|VMware|Loopback|Default Switch/i.test(name)
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (isVirtual) {
          virtualIps.push(iface.address)
        } else if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
          primaryIps.push(iface.address)
        } else {
          otherIps.push(iface.address)
        }
      }
    }
  }

  const sorted = [...primaryIps, ...otherIps, ...virtualIps]
  if (sorted.length === 0) sorted.push('127.0.0.1')
  return Array.from(new Set(sorted))
}

/**
 * Get Mobile Companion Server info and access URLs
 */
export function getMobileServerInfo(): MobileServerInfo {
  const localIps = getLocalIpAddresses()
  const port = currentPort
  const isRunning = !!serverInstance && serverInstance.listening
  const primaryIp = localIps[0] || '127.0.0.1'
  const primaryUrl = `http://${primaryIp}:${port}`
  const allUrls = localIps.map(ip => `http://${ip}:${port}`)

  return {
    isRunning,
    port,
    localIps,
    primaryUrl,
    allUrls
  }
}

/**
 * Start the Mobile Web Companion Server
 */
export function startMobileServer(port: number = 8080): Promise<MobileServerInfo> {
  return new Promise((resolve) => {
    currentPort = port

    if (serverInstance) {
      serverInstance.close()
      serverInstance = null
    }

    serverInstance = http.createServer((req, res) => {
      handleRequest(req, res)
    })

    serverInstance.listen(port, '0.0.0.0', () => {
      const addr = serverInstance?.address()
      if (addr && typeof addr === 'object') {
        currentPort = addr.port
      } else {
        currentPort = port
      }
      const info = getMobileServerInfo()
      console.log(`[Master POS Server] Server active and listening at ${info.primaryUrl}`)
      startMasterDiscoveryBeacon(currentPort)
      resolve(info)
    })

    serverInstance.on('error', (err: any) => {
      console.error('[Master POS Server] Server error:', err)
      if (err.code === 'EADDRINUSE') {
        console.log(`[Master POS Server] Port ${port} in use, trying ${port + 1}...`)
        resolve(startMobileServer(port + 1))
      }
    })
  })
}

/**
 * Stop the Mobile Web Server
 */
export function stopMobileServer(): void {
  stopMasterDiscoveryBeacon()
  if (serverInstance) {
    serverInstance.close()
    serverInstance = null
    console.log('[Master POS Server] Server stopped')
  }
}

// -------------------------------------------------------------
// REQUEST ROUTING & API DISPATCH
// -------------------------------------------------------------
function setCorsAndHeaders(res: http.ServerResponse, contentType: string = 'application/json') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Content-Type', contentType)
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    setCorsAndHeaders(res)
    res.writeHead(200)
    res.end()
    return
  }

  // 0. Static Brand Logo Asset
  if (pathname === '/api/logo' || pathname === '/logo.png') {
    const logo = getBrandLogoBuffer()
    if (logo) {
      res.setHeader('Content-Type', logo.mimeType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.writeHead(200)
      res.end(logo.buffer)
      return
    }
    res.writeHead(404)
    res.end('Logo not found')
    return
  }

  // ---- MULTI-TERMINAL & LAN REAL-TIME SYNC APIS ----

  // 0. Auto-Discovery Ping
  if (pathname === '/api/discovery') {
    setCorsAndHeaders(res)
    res.writeHead(200)
    res.end(JSON.stringify({
      app: 'al-deewan-pos-master',
      name: 'Nuqta Master Terminal 1',
      port: currentPort,
      ips: getLocalIpAddresses(),
      timestamp: Date.now()
    }))
    return
  }

  // 0.1 Universal JSON-RPC Endpoint (Supports Win / Mac Satellite Terminals)
  if (pathname === '/api/rpc' && req.method === 'POST') {
    setCorsAndHeaders(res)
    const body = await parseJsonBody(req)
    const { action, args, terminalId, terminalName, os } = body
    if (terminalId) {
      registerTerminalHeartbeat({
        terminalId,
        terminalName: terminalName || `Terminal ${terminalId}`,
        ip: req.socket.remoteAddress || 'unknown',
        os: os || 'Client'
      })
    }
    const result = await executeRpcCommand(action, args || [], terminalId)
    res.writeHead(200)
    res.end(JSON.stringify(result))
    return
  }

  // 0.2 Real-Time Server-Sent Events (SSE) Live Synchronization Stream
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Subscribed to Master POS Real-Time Events' })}\n\n`)
    const unsubscribe = addEventSubscriber(res)
    req.on('close', () => {
      unsubscribe()
    })
    return
  }

  // 0.3 Active Terminals List
  if (pathname === '/api/terminals' && req.method === 'GET') {
    setCorsAndHeaders(res)
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: getActiveTerminals() }))
    return
  }

  // 0.4 Satellite Heartbeat Ping
  if (pathname === '/api/terminals/heartbeat' && req.method === 'POST') {
    setCorsAndHeaders(res)
    const body = await parseJsonBody(req)
    registerTerminalHeartbeat({
      terminalId: body.terminalId || 'T-02',
      terminalName: body.terminalName || 'Satellite Terminal',
      ip: req.socket.remoteAddress || 'unknown',
      os: body.os || 'Unknown'
    })
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, timestamp: Date.now() }))
    return
  }

  // Serve Single-Page Mobile Web App for root routes
  if (pathname === '/' || pathname === '/app' || pathname === '/index.html' || pathname === '/pos' || pathname === '/dashboard') {
    setCorsAndHeaders(res, 'text/html; charset=utf-8')
    res.writeHead(200)
    res.end(renderMobileAppHtml())
    return
  }

  // ---- REST API ENDPOINTS ----

  // 1. Health & Server Info
  if (pathname === '/api/info') {
    setCorsAndHeaders(res)
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: getMobileServerInfo() }))
    return
  }

  // 1.1 Store Branding & Info
  if (pathname === '/api/store-info') {
    setCorsAndHeaders(res)
    try {
      const storeName = getSetting('store_name') || getSetting('company_name') || 'My Store'
      const phone = getSetting('store_phone') || ''
      const address = getSetting('store_address') || ''
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: { storeName, logo: '/api/logo', phone, address } }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 2. Auth: Login with PIN
  if (pathname === '/api/auth' && req.method === 'POST') {
    setCorsAndHeaders(res)
    const body = await parseJsonBody(req)
    const pin = String(body.pin || '').trim()

    const users = getAllUsers()
    let matchingUser: any = null
    for (const u of users) {
      if (u.is_active) {
        const verified = verifyLogin(u.username, pin)
        if (verified) {
          matchingUser = verified
          break
        }
      }
    }

    if (!matchingUser) {
      res.writeHead(401)
      res.end(JSON.stringify({ success: false, error: 'Invalid PIN. Please try again.' }))
      return
    }

    const token = `session_${Date.now()}_${matchingUser.id}`
    activeSessions.add(token)

    const isOwner = matchingUser.role === 'owner'
    const isSalesStaff = matchingUser.role === 'salesperson' || matchingUser.role === 'manager'

    res.writeHead(200)
    res.end(JSON.stringify({
      success: true,
      token,
      user: {
        id: matchingUser.id,
        name: matchingUser.name,
        username: matchingUser.username,
        role: matchingUser.role,
        isOwner,
        isSalesStaff,
        canDayClose: matchingUser.perm_day_closing || isOwner,
        permDiscount: matchingUser.perm_apply_discount || isOwner,
        permDiscountLimit: matchingUser.perm_discount_limit || (isOwner ? 100 : 10)
      }
    }))
    return
  }

  // 2.1 POS Fast Initial Boot Data (Items, Categories, Brands, Customers)
  if (pathname === '/api/pos/init') {
    setCorsAndHeaders(res)
    try {
      const items = getAllItems()
      const categories = getAllCategories()
      const brands = getAllBrands()
      const customers = getAllCustomers()
      const storeName = getSetting('store_name') || getSetting('company_name') || 'My Store'
      const phone = getSetting('store_phone') || ''
      const address = getSetting('store_address') || ''

      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: {
          items,
          categories,
          brands,
          customers,
          storeInfo: { storeName, logo: '/api/logo', phone, address }
        }
      }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 2.2 POS Create Sale / Invoice
  if ((pathname === '/api/pos/create-sale' || pathname === '/api/invoices/create') && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      const staffId = body.staffId || body.userId || 'usr-owner'
      const invoiceData = body.invoice || body

      if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
        res.writeHead(400)
        res.end(JSON.stringify({ success: false, error: 'Cart is empty. Please add items to checkout.' }))
        return
      }

      // Calculate costs and line totals safely
      let costTotal = 0
      const processedItems = []
      for (const it of invoiceData.items) {
        const dbItem = getItemById(it.item_id)
        const unitCost = Number(dbItem?.cost_price || it.cost_price || 0)
        const qty = Number(it.qty) || 1
        const unitPrice = Number(it.unit_price) || Number(dbItem?.retail_price || 0)
        const discountPct = Number(it.discount_pct) || 0
        const lineTotal = Math.max(0, (qty * unitPrice) - (qty * unitPrice * (discountPct / 100)))

        costTotal += (unitCost * qty)
        processedItems.push({
          item_id: it.item_id,
          qty,
          unit_price: unitPrice,
          cost_price: unitCost,
          discount_pct: discountPct,
          line_total: lineTotal
        })
      }

      const subtotal = Number(invoiceData.subtotal) || processedItems.reduce((s, i) => s + i.line_total, 0)
      const discountAmount = Number(invoiceData.discount_amount) || 0
      const grandTotal = Math.max(0, subtotal - discountAmount)
      const amountPaid = invoiceData.amount_paid !== undefined ? Number(invoiceData.amount_paid) : grandTotal
      const balanceDue = Math.max(0, grandTotal - amountPaid)
      const profit = Math.max(0, grandTotal - costTotal)

      const payload = {
        customer_id: invoiceData.customer_id || null,
        source: invoiceData.source || 'instore',
        status: invoiceData.status || (balanceDue > 0 ? 'pending' : 'completed'),
        subtotal,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        cost_total: costTotal,
        profit,
        payment_method: invoiceData.payment_method || 'cash',
        notes: invoiceData.notes || 'Created via Mobile POS Portal',
        online_customer_contact: invoiceData.online_customer_contact || null,
        items: processedItems
      }

      const created = createInvoice(payload, staffId)
      logAction(staffId, 'CREATE_INVOICE_MOBILE', 'invoices', created.id, {
        number: created.invoice_number,
        grand_total: created.grand_total,
        items_count: processedItems.length
      })

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: created }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 2.3 Customers List & Search
  if (pathname === '/api/customers' && req.method === 'GET') {
    setCorsAndHeaders(res)
    try {
      const q = url.searchParams.get('q') || url.searchParams.get('search') || ''
      const customers = q ? searchCustomers(q) : getAllCustomers()
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: customers }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 2.4 Create Customer
  if (pathname === '/api/customers/create' && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      const userId = body.userId || 'usr-owner'
      const customer = createCustomer({
        name: String(body.name || '').trim(),
        phone: String(body.phone || '').trim(),
        whatsapp: String(body.whatsapp || body.phone || '').trim(),
        address: String(body.address || '').trim(),
        type: String(body.type || 'walkin'),
        notes: String(body.notes || '')
      }, userId)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: customer }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 2.5 Park / Retrieve Sales
  if (pathname === '/api/pos/park' && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      const staffId = body.staffId || body.userId || 'usr-owner'
      parkSale(body.cartData || {}, body.customerId || null, staffId, body.label || 'Mobile Parked Ticket')
      res.writeHead(200)
      res.end(JSON.stringify({ success: true }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  if (pathname === '/api/pos/parked' && req.method === 'GET') {
    setCorsAndHeaders(res)
    try {
      const staffId = url.searchParams.get('userId') || 'usr-owner'
      const parked = getParkedSales(staffId)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: parked }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  if (pathname === '/api/pos/delete-parked' && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      if (body.id) deleteParkedSale(body.id)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 3. Live Dashboard Overview (Today, Yesterday, Custom Date)
  if (pathname === '/api/dashboard') {
    setCorsAndHeaders(res)
    try {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const range = url.searchParams.get('range') || ''
      const customDate = url.searchParams.get('date') || ''

      let targetDate = todayStr
      if (range === 'today') {
        targetDate = todayStr
      } else if (range === 'yesterday') {
        const y = new Date()
        y.setDate(now.getDate() - 1)
        targetDate = y.toISOString().slice(0, 10)
      } else if (customDate) {
        targetDate = customDate
      }

      const summary = getTodayPOSSummary()
      const dayCalc = calculateDayClose(targetDate)
      const isClosed = isDayClosed(targetDate)

      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: {
          date: targetDate,
          is_closed: isClosed,
          summary,
          day_calc: dayCalc
        }
      }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 4. Invoices / Sales List
  if (pathname === '/api/invoices' || pathname === '/api/sales') {
    setCorsAndHeaders(res)
    try {
      const range = url.searchParams.get('range') || ''
      const customDate = url.searchParams.get('date') || ''
      const customFrom = url.searchParams.get('from') || ''
      const customTo = url.searchParams.get('to') || ''
      const search = (url.searchParams.get('search') || '').toLowerCase().trim()

      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)

      let from = todayStr
      let to = todayStr

      if (range === 'today') {
        from = todayStr
        to = todayStr
      } else if (range === 'yesterday') {
        const y = new Date()
        y.setDate(now.getDate() - 1)
        from = y.toISOString().slice(0, 10)
        to = from
      } else if (range === '7days') {
        const d7 = new Date()
        d7.setDate(now.getDate() - 6)
        from = d7.toISOString().slice(0, 10)
        to = todayStr
      } else if (range === 'month') {
        from = `${todayStr.slice(0, 7)}-01`
        to = todayStr
      } else if (customFrom && customTo) {
        from = customFrom
        to = customTo
      } else if (customDate) {
        from = customDate
        to = customDate
      }

      const invoices = getInvoicesByDateRange(from, to, undefined, undefined, undefined, search)

      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: invoices,
        from,
        to,
        count: invoices.length
      }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 5. Single Invoice Detail
  if (pathname.startsWith('/api/invoices/')) {
    setCorsAndHeaders(res)
    const id = pathname.replace('/api/invoices/', '')
    const inv = getInvoiceById(id)
    if (!inv) {
      res.writeHead(404)
      res.end(JSON.stringify({ success: false, error: 'Invoice not found' }))
      return
    }
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: inv }))
    return
  }

  // 6. Stock & Inventory List
  if (pathname === '/api/stock' || pathname === '/api/items') {
    setCorsAndHeaders(res)
    try {
      const search = (url.searchParams.get('search') || '').trim()
      const categoryId = url.searchParams.get('category') || ''
      const lowStockOnly = url.searchParams.get('low_stock') === 'true'

      let items = search ? searchItems(search) : getAllItems()
      if (categoryId) {
        items = items.filter((i: any) => i.category_id === categoryId)
      }
      if (lowStockOnly) {
        items = items.filter((i: any) => (i.quantity_on_hand || 0) <= (i.reorder_level || 5))
      }
      const categories = getAllCategories()
      const brands = getAllBrands()

      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: items,
        total: items.length,
        categories,
        brands
      }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 7. Customer Returns List
  if (pathname === '/api/returns') {
    setCorsAndHeaders(res)
    try {
      const returns = getAllReturns()
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: returns }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 8. Online / Remote Delivery Orders
  if (pathname === '/api/orders') {
    setCorsAndHeaders(res)
    try {
      const statusFilter = url.searchParams.get('status') || undefined
      const orders = getOnlineOrders(statusFilter)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: orders }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 8.1 Update Order Status
  if (pathname === '/api/orders/update-status' && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      const { invoiceId, status, trackingNumber, userId } = body
      updateInvoiceStatus(invoiceId, status, trackingNumber)
      if (userId) {
        logAction(userId, 'UPDATE_ORDER_STATUS_MOBILE', 'invoices', invoiceId, { status, trackingNumber })
      }
      res.writeHead(200)
      res.end(JSON.stringify({ success: true }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 9. Reports: Profit & Loss Statement
  if (pathname === '/api/reports/pnl') {
    setCorsAndHeaders(res)
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const from = url.searchParams.get('from') || `${todayStr.slice(0, 7)}-01`
      const to = url.searchParams.get('to') || todayStr
      const report = getProfitAndLossReport(from, to)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: report, from, to }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 9.1 Reports: Financial Analytics Timeline
  if (pathname === '/api/reports/analytics') {
    setCorsAndHeaders(res)
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const from = url.searchParams.get('from') || `${todayStr.slice(0, 7)}-01`
      const to = url.searchParams.get('to') || todayStr
      const report = getFinancialAnalytics(from, to)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: report, from, to }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 9.2 Reports: Item Sales Performance
  if (pathname === '/api/reports/items-performance') {
    setCorsAndHeaders(res)
    try {
      const from = url.searchParams.get('from') || undefined
      const to = url.searchParams.get('to') || undefined
      const report = getItemSalesPerformance(from, to)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: report }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 10. Day Close Preview
  if (pathname === '/api/day-close/preview') {
    setCorsAndHeaders(res)
    try {
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
      const calc = calculateDayClose(date)
      const isClosed = isDayClosed(date)
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: { ...calc, is_closed: isClosed } }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 11. Submit Day Close Remotely
  if (pathname === '/api/day-close/submit' && req.method === 'POST') {
    setCorsAndHeaders(res)
    try {
      const body = await parseJsonBody(req)
      const date = body.date || new Date().toISOString().slice(0, 10)
      const countedCash = Number(body.counted_cash) || 0
      const notes = String(body.notes || 'Submitted remotely via Mobile Companion')
      const userId = body.user_id || 'usr-owner'

      const calc = calculateDayClose(date)
      const result = submitDayClose({
        date,
        total_sales: calc.total_sales,
        total_discounts: calc.total_discounts,
        total_returns: calc.total_returns,
        total_profit: calc.total_profit,
        cash_sales: calc.cash_sales,
        card_sales: calc.card_sales,
        bank_sales: calc.bank_sales,
        expected_cash: calc.expected_cash,
        counted_cash: countedCash,
        staff_breakdown: calc.staff_breakdown,
        notes
      }, userId)

      // Send WhatsApp summary if configured
      const waConfig = getWhatsAppConfig()
      let waUrl = ''
      if (waConfig.sendOnDayClose && waConfig.ownerPhone) {
        const waRes = formatDayCloseWhatsAppMessage(date)
        waUrl = waRes.whatsappUrl
      }

      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: result, whatsappUrl: waUrl }))
    } catch (err: any) {
      res.writeHead(500)
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // 12. WhatsApp Day Close Preview & Trigger
  if (pathname === '/api/whatsapp/preview') {
    setCorsAndHeaders(res)
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const formatted = formatDayCloseWhatsAppMessage(date)
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: formatted }))
    return
  }

  if (pathname === '/api/whatsapp/trigger' && req.method === 'POST') {
    setCorsAndHeaders(res)
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const result = await sendWhatsAppDayClose(date, true)
    res.writeHead(200)
    res.end(JSON.stringify(result))
    return
  }

  // 404 for unknown routes
  setCorsAndHeaders(res)
  res.writeHead(404)
  res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }))
}

// -------------------------------------------------------------
// MOBILE SINGLE-PAGE WEB APP (HTML/CSS/JS) — LUXURY LIGHT/BRIGHT THEME
// -------------------------------------------------------------
function renderMobileAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Nuqta AI POS — Mobile Portal</title>
  <meta name="theme-color" content="#FFFFFF">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02);
      --card-shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.08);
      --primary: #2F4BF5;
      --primary-dark: #1E30C4;
      --primary-light: #EEF1FF;
      --primary-glow: rgba(47, 75, 245, 0.25);
      --primary-gradient: linear-gradient(135deg, #5B78FF 0%, #2F4BF5 100%);
      --accent: #F59E0B;
      --accent-gradient: linear-gradient(135deg, #FFC857 0%, #FF9A1F 100%);
      --danger: #DC2626;
      --warning: #D97706;
      --info: #0284C7;
      --text: #0F172A;
      --text-muted: #64748B;
      --surface-2: #F1F5F9;
      --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      -webkit-tap-highlight-color: transparent; 
      touch-action: manipulation;
    }
    
    html, body {
      height: 100%;
      height: 100dvh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: var(--bg);
      -webkit-text-size-adjust: 100%;
      overscroll-behavior: none;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }
    body {
      display: flex;
      flex-direction: column;
      color: var(--text);
      font-family: var(--font);
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.04) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.04) 0%, transparent 40%);
      background-attachment: fixed;
    }

    /* HEADER */
    .app-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--card-border);
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      z-index: 60;
      height: 56px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
    }
    .logo-container { display: flex; align-items: center; gap: 9px; }
    .brand-logo-img {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      object-fit: contain;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .logo-title { font-size: 14px; font-weight: 800; letter-spacing: -0.3px; color: var(--text); line-height: 1.1; }
    .logo-subtitle { font-size: 10px; color: var(--text-muted); font-weight: 600; }
    .header-actions { display: flex; align-items: center; gap: 6px; }
    .status-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 5px;
      background: #ECFDF5;
      color: #059669;
      border: 1px solid #A7F3D0;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .icon-btn {
      background: #F8FAFC;
      border: 1px solid var(--card-border);
      color: var(--text);
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.12s;
    }
    .icon-btn:active { transform: scale(0.92); background: #E2E8F0; }

    /* VIEWPORT CONTAINER */
    .app-viewport {
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
    }

    .main-container {
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      padding: 10px 12px calc(62px + env(safe-area-inset-bottom, 0px)) 12px;
      box-sizing: border-box;
      animation: fadeIn 0.15s ease-out;
    }
    #screen-pos.has-cart-bar {
      padding-bottom: calc(118px + env(safe-area-inset-bottom, 0px));
    }
    @media (min-width: 821px) {
      #screen-pos.has-cart-bar {
        padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px));
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* PIN KEYPAD SCREEN */
    #screen-pin {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px 14px;
      margin: 0 auto;
      text-align: center;
      width: 100%;
      max-width: 380px;
      box-sizing: border-box;
    }
    .login-brand-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    }
    .login-logo {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      object-fit: contain;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      margin-bottom: 12px;
    }
    .pin-title { font-size: 21px; font-weight: 800; color: var(--text); letter-spacing: -0.4px; }
    .pin-desc { font-size: 12.5px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }
    .pin-dots { display: flex; gap: 14px; margin: 22px 0 26px 0; }
    .pin-dot {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      border: 2px solid #CBD5E1;
      background: #FFFFFF;
      transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pin-dot.filled {
      background: var(--primary);
      border-color: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
      transform: scale(1.15);
    }
    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 76px);
      gap: 14px;
      touch-action: manipulation;
    }
    .key-btn {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 25px;
      font-weight: 700;
      font-family: var(--font-mono);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.08s;
    }
    .key-btn:active {
      transform: scale(0.92);
      background: #ECFDF5;
      color: var(--primary);
      border-color: #A7F3D0;
    }

    /* POS REGISTER LAYOUT */
    .pos-layout {
      display: flex;
      gap: 14px;
      width: 100%;
    }
    .pos-catalog-area {
      flex: 1;
      min-width: 0;
    }
    .pos-cart-panel {
      width: 360px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 14px;
      box-shadow: var(--card-shadow);
      max-height: calc(100vh - 150px);
      position: sticky;
      top: 10px;
    }
    @media (max-width: 820px) {
      .pos-cart-panel { display: none; }
    }

    /* CATEGORY & FILTER CHIPS */
    .date-filter-bar {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 6px;
      margin-bottom: 10px;
      scrollbar-width: none;
    }
    .date-filter-bar::-webkit-scrollbar { display: none; }
    .date-chip {
      padding: 6px 13px;
      border-radius: 20px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }
    .date-chip.active {
      background: var(--primary-gradient);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px var(--primary-glow);
    }

    /* SEARCH BAR */
    .search-bar {
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      margin-bottom: 10px;
      outline: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-bar:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }

    /* ITEM GRID & CARDS */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    @media (max-width: 480px) {
      .items-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
    }
    .pos-item-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 11px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.12s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      position: relative;
      overflow: hidden;
      min-height: 105px;
    }
    .pos-item-card:active {
      transform: scale(0.96);
      background: #ECFDF5;
      border-color: var(--primary);
    }
    .pos-item-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.25;
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .pos-item-variant {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent);
      background: #EEF2FF;
      padding: 2px 6px;
      border-radius: 5px;
      display: inline-block;
      margin-bottom: 6px;
      width: fit-content;
    }
    .pos-item-price {
      font-size: 15px;
      font-weight: 800;
      color: var(--primary);
      font-family: var(--font-mono);
    }
    .pos-item-stock {
      font-size: 9.5px;
      font-weight: 700;
      color: var(--text-muted);
    }
    .pos-item-stock.out { color: var(--danger); font-weight: 800; }

    /* CART & SUMMARY */
    .cart-item-card {
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 10px 11px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .cart-item-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .cart-item-info {
      flex: 1;
      min-width: 0;
    }
    .cart-item-name {
      font-size: 13px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cart-item-price-edit {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }
    .cart-price-input {
      width: 76px;
      height: 26px;
      padding: 2px 6px;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      background: #F8FAFC;
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 12px;
      color: var(--primary-dark);
      text-align: right;
      outline: none;
      transition: all 0.15s;
      -moz-appearance: textfield;
    }
    .cart-price-input::-webkit-outer-spin-button,
    .cart-price-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .cart-price-input:focus {
      border-color: var(--primary);
      background: #FFFFFF;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
    .cart-item-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cart-item-total {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 13.5px;
      color: var(--text);
      min-width: 65px;
      text-align: right;
    }
    .cart-item-del {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      border: 1px solid #FEE2E2;
      background: #FEF2F2;
      color: #DC2626;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.08s;
    }
    .cart-item-del:active { transform: scale(0.9); }
    .cart-item-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-2);
      border-radius: 8px;
      padding: 3px 8px;
    }
    .cart-qty-ctrl {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .qty-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .qty-btn:active { transform: scale(0.88); background: #ECFDF5; color: var(--primary); }
    .qty-val {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 12.5px;
      min-width: 20px;
      text-align: center;
    }

    /* FLOATING BOTTOM CART BAR ON MOBILE */
    .floating-cart-bar {
      position: fixed;
      bottom: calc(62px + env(safe-area-inset-bottom, 0px));
      left: 10px;
      right: 10px;
      background: #0F172A;
      color: #FFFFFF;
      padding: 10px 14px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
      z-index: 45;
      cursor: pointer;
      animation: slideUp 0.18s ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (min-width: 821px) {
      .floating-cart-bar { display: none !important; }
    }

    /* BADGES */
    .badge {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .badge-success { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
    .badge-warning { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; }
    .badge-danger { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .badge-info { background: #F0F9FF; color: #075985; border: 1px solid #BAE6FD; }
    .badge-indigo { background: #EEF2FF; color: #3730A3; border: 1px solid #C7D2FE; }

    /* STAT HERO CARD */
    .stat-hero {
      background: linear-gradient(135deg, #ECFDF5 0%, #EEF2FF 100%);
      border: 1px solid #A7F3D0;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.06);
    }
    .stat-hero-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #065F46; }
    .stat-hero-val { font-size: 28px; font-weight: 800; color: #064E3B; font-family: var(--font-mono); margin: 4px 0; }
    .stat-hero-sub { display: flex; justify-content: space-between; font-size: 11px; color: #047857; font-weight: 600; }

    /* CARDS & GRIDS */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 13px 14px;
      margin-bottom: 12px;
      box-shadow: var(--card-shadow);
    }
    .card-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 9px;
    }
    .stat-box {
      background: #F8FAFC;
      border: 1px solid var(--card-border);
      border-radius: 11px;
      padding: 10px 12px;
    }
    .stat-box-lbl { font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; }
    .stat-box-val { font-size: 16px; font-weight: 800; color: var(--text); font-family: var(--font-mono); }

    /* LIST CARD */
    .list-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 12px 13px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.12s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }
    .list-card:active {
      transform: scale(0.98);
      background: #F8FAFC;
      border-color: var(--primary);
    }

    /* MODAL / BOTTOM SHEET */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.15s ease-out;
    }
    .modal-sheet {
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      border-top-left-radius: 22px;
      border-top-right-radius: 22px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--card-shadow-lg);
      animation: slideSheet 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideSheet {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .sheet-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sheet-body {
      padding: 14px 16px;
      overflow-y: auto;
      flex: 1;
    }
    .sheet-footer {
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--card-border);
      background: #F8FAFC;
      display: flex;
      gap: 8px;
    }

    /* BUTTONS */
    .btn {
      padding: 11px 16px;
      border-radius: 12px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: none;
      transition: transform 0.08s;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: var(--primary-gradient); color: #fff; box-shadow: 0 3px 10px var(--primary-glow); }
    .btn-secondary { background: #F1F5F9; border: 1px solid var(--card-border); color: var(--text); }
    .btn-whatsapp { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #fff; box-shadow: 0 3px 10px rgba(37, 211, 102, 0.25); }
    .btn-danger { background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; }

    /* METHOD SELECTOR CHIPS */
    .pay-methods-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .pay-chip {
      padding: 10px 6px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
      background: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      cursor: pointer;
    }
    .pay-chip.active {
      background: #ECFDF5;
      border-color: var(--primary);
      color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }

    /* FIXED BOTTOM NAVIGATION BAR */
    .bottom-nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 56px;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2px;
      padding: 0 4px calc(env(safe-area-inset-bottom, 0px));
      z-index: 50;
      overflow-x: auto;
      scrollbar-width: none;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
    }
    .bottom-nav::-webkit-scrollbar { display: none; }
    .nav-item {
      flex: 1 1 0;
      min-width: 44px;
      max-width: 70px;
      height: 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px 2px;
      border-radius: 10px;
      border: none;
      background: transparent;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.12s;
    }
    .nav-item.active {
      color: var(--primary);
      background: #ECFDF5;
    }
    .nav-icon { font-size: 16px; line-height: 1; }
    .nav-title { font-size: 9.5px; font-weight: 700; white-space: nowrap; }

    /* When only staff tabs are active (POS + Dashboard) */
    .bottom-nav.staff-mode .nav-item {
      max-width: 130px;
      margin: 0 10px;
      height: 46px;
    }

    /* THERMAL RECEIPT PRINT STYLES */
    @media print {
      body * { visibility: hidden; }
      #printable-receipt, #printable-receipt * { visibility: visible; }
      #printable-receipt {
        position: absolute;
        left: 0; top: 0;
        width: 100%;
        max-width: 80mm;
        margin: 0 auto;
        padding: 4mm;
        font-family: monospace;
        font-size: 12px;
        color: #000;
        background: #fff;
      }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header class="app-header">
    <div class="logo-container">
      <img id="brand-logo-img" class="brand-logo-img" src="/api/logo" alt="Nuqta" />
      <div>
        <div class="logo-title" id="header-store-name">Nuqta AI POS</div>
        <div class="logo-subtitle" id="header-user-role">Mobile Register Portal</div>
      </div>
    </div>
    <div class="header-actions">
      <div id="header-status" class="status-pill">
        <span class="status-dot"></span>
        <span id="header-status-text">Online</span>
      </div>
      <button class="icon-btn" onclick="refreshCurrentTab()" title="Refresh Data">🔄</button>
      <button class="icon-btn" onclick="logout()" title="Lock Screen">🔒</button>
    </div>
  </header>

  <!-- VIEWPORT SCROLL WRAPPER -->
  <main id="app-viewport" class="app-viewport">

    <!-- SCREEN 1: PIN LOCK / LOGIN -->
    <div id="screen-pin">
      <div class="login-brand-box">
        <img class="login-logo" src="/api/logo" alt="Nuqta" />
        <div class="pin-title">Nuqta AI POS Portal</div>
        <div class="pin-desc">Enter your 4-digit Staff or Owner PIN to start billing and access live store controls</div>
      </div>
      <div class="pin-dots">
        <div class="pin-dot" id="dot-0"></div>
        <div class="pin-dot" id="dot-1"></div>
        <div class="pin-dot" id="dot-2"></div>
        <div class="pin-dot" id="dot-3"></div>
      </div>
      <div class="keypad">
        <button type="button" class="key-btn" onclick="pressKey(event, '1')">1</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '2')">2</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '3')">3</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '4')">4</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '5')">5</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '6')">6</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '7')">7</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '8')">8</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '9')">9</button>
        <button type="button" class="key-btn" onclick="pressKey(event, 'clr')" style="font-size: 13px; font-weight: 800; color: #DC2626; font-family: var(--font);">CLR</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '0')">0</button>
        <button type="button" class="key-btn" onclick="pressKey(event, 'back')" style="font-size: 18px;">⌫</button>
      </div>
      <div id="pin-error" style="color: #DC2626; font-size: 12.5px; font-weight: 700; margin-top: 14px; min-height: 18px;"></div>
    </div>

    <!-- SCREEN 2: ⚡ POS REGISTER (FAST BILLING) -->
    <div id="screen-pos" class="main-container" style="display: none;">
      
      <!-- Top Action & Search Bar -->
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <input type="text" id="pos-search-input" class="search-bar" style="margin: 0;" placeholder="🔍 Search item name, barcode, SKU..." oninput="handlePosSearch()" />
        <button class="btn btn-secondary" style="flex-shrink: 0; padding: 0 12px; font-size: 12px;" onclick="openParkedTicketsModal()" title="Held / Parked Tickets">
          ⏳ <span id="parked-badge" style="font-weight: 800; color: var(--primary); margin-left: 2px;">0</span>
        </button>
      </div>

      <!-- Categories Pills -->
      <div class="date-filter-bar" id="pos-category-chips">
        <button class="date-chip active" onclick="filterPosCategory('')">All Items</button>
      </div>

      <!-- POS Dual Layout (Catalog Grid + Tablet Cart) -->
      <div class="pos-layout">
        <div class="pos-catalog-area">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 8px;">
            <span id="pos-items-count-label">Loading products...</span>
            <span style="color: var(--primary);">Tap item to add</span>
          </div>

          <div class="items-grid" id="pos-items-container">
            <!-- Catalog Cards Injected Here -->
          </div>
        </div>

        <!-- Tablet / Desktop Sidebar Cart -->
        <div class="pos-cart-panel" id="pos-sidebar-cart">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 14px; color: var(--text);">🛍️ Current Cart</strong>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; color: var(--danger);" onclick="clearCart()">Clear</button>
          </div>

          <!-- Customer Bar -->
          <div style="background: var(--surface-2); padding: 8px 10px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="color: var(--text-muted);">Customer:</span> <strong id="sidebar-customer-name">Walk-in Customer</strong>
            </div>
            <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px;" onclick="openCustomerModal()">Edit</button>
          </div>

          <!-- Cart Items Scroll Area -->
          <div id="sidebar-cart-items" style="flex: 1; overflow-y: auto; max-height: 260px;">
            <!-- Cart rows -->
          </div>

          <!-- Cart Financials -->
          <div style="border-top: 1px solid var(--card-border); margin-top: 10px; padding-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Subtotal:</span>
              <strong id="sidebar-cart-subtotal" style="font-family: var(--font-mono);">Rs. 0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Discount (Rs):</span>
              <input type="number" id="sidebar-cart-discount" style="width: 70px; height: 24px; padding: 2px 6px; font-family: var(--font-mono); font-size: 11px; text-align: right; border: 1px solid var(--card-border); border-radius: 6px;" value="0" oninput="updateCartDiscount(this.value)" />
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--card-border);">
              <strong>Grand Total:</strong>
              <strong id="sidebar-cart-grandtotal" style="font-family: var(--font-mono); color: var(--primary);">Rs. 0</strong>
            </div>
          </div>

          <div style="display: flex; gap: 6px; margin-top: 12px;">
            <button class="btn btn-secondary" style="flex: 1; padding: 9px;" onclick="parkCurrentSale()">⏳ Park</button>
            <button class="btn btn-primary" style="flex: 2; padding: 9px;" onclick="openCheckoutModal()">Pay & Checkout ➔</button>
          </div>
        </div>
      </div>

      <!-- Floating Sticky Cart Bar for Mobile -->
      <div id="mobile-floating-cart" class="floating-cart-bar" style="display: none;" onclick="openCartDrawer()">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: var(--primary); color: #fff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 12px;" id="floating-cart-qty">0 Items</span>
          <span style="font-weight: 700; font-size: 13px;">View Cart</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 16px; font-weight: 800; color: #34D399;" id="floating-cart-total">Rs. 0</div>
      </div>
    </div>

    <!-- SCREEN 3: 📊 DASHBOARD -->
    <div id="screen-dashboard" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" id="dash-chip-today" onclick="setDateFilter('today')">📅 Today</button>
        <button class="date-chip" id="dash-chip-yesterday" onclick="setDateFilter('yesterday')">⚡ Yesterday</button>
        <div style="display: inline-flex; align-items: center; gap: 5px; margin-left: 2px;">
          <input type="date" id="dash-custom-date" class="search-bar" style="margin: 0; padding: 5px 8px; font-size: 11px; width: auto;" onchange="setDateFilter('custom')">
        </div>
      </div>

      <div class="stat-hero">
        <div class="stat-hero-lbl">Gross Invoiced Sales</div>
        <div class="stat-hero-val" id="dash-gross-sales">Rs. 0</div>
        <div class="stat-hero-sub">
          <span id="dash-invoices-count">0 Invoices Issued</span>
          <span id="dash-date" style="font-family: var(--font-mono); font-weight: 700; color: #059669;">--</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>💰 Payment Method Breakdown</span>
          <span class="badge badge-success">LIVE</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box" style="border-left: 3px solid #10B981;">
            <div class="stat-box-lbl">💵 Cash in Drawer</div>
            <div class="stat-box-val" style="color: #059669;" id="dash-drawer-cash">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #6366F1;">
            <div class="stat-box-lbl">📱 JazzCash Wallet</div>
            <div class="stat-box-val" style="color: #4F46E5;" id="dash-jazzcash">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #38BDF8;">
            <div class="stat-box-lbl">📱 EasyPaisa Wallet</div>
            <div class="stat-box-val" style="color: #0284C7;" id="dash-easypaisa">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #F59E0B;">
            <div class="stat-box-lbl">🏦 Bank & Card</div>
            <div class="stat-box-val" style="color: #D97706;" id="dash-otherbank">Rs. 0</div>
          </div>
        </div>
      </div>

      <!-- Owner-only Financial Insights in Dashboard -->
      <div class="card" id="dash-owner-profit-card" style="display: none;">
        <div class="card-title">
          <span>📈 Profit & Financial Health</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box" style="border-left: 3px solid #10B981;">
            <div class="stat-box-lbl">✨ Net Profit</div>
            <div class="stat-box-val" style="color: #059669;" id="dash-net-profit">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #DC2626;">
            <div class="stat-box-lbl">📉 Operating Expenses</div>
            <div class="stat-box-val" style="color: #DC2626;" id="dash-expenses">Rs. 0</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-lbl">🔄 Customer Returns</div>
            <div class="stat-box-val" style="color: #D97706;" id="dash-returns">Rs. 0</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-lbl">⏳ Khata / Unpaid</div>
            <div class="stat-box-val" style="color: #64748B;" id="dash-unpaid">Rs. 0</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SCREEN 4: 📦 STOCK / INVENTORY (OWNER ONLY) -->
    <div id="screen-stock" class="main-container" style="display: none;">
      <input type="text" id="stock-search-input" class="search-bar" placeholder="🔍 Search stock by item name, barcode, SKU..." oninput="handleStockSearch()" />
      
      <div class="date-filter-bar" id="stock-category-chips">
        <button class="date-chip active" onclick="filterStockCategory('')">All Items</button>
        <button class="date-chip" onclick="toggleLowStockOnly()" id="chip-low-stock">⚠️ Low Stock Only</button>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 8px;">
        <span id="stock-count-label">Loading products...</span>
      </div>

      <div id="stock-list-container">
        <!-- Stock items injected here -->
      </div>
    </div>

    <!-- SCREEN 5: 🛒 SALES & INVOICES (OWNER ONLY) -->
    <div id="screen-sales" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" id="inv-range-today" onclick="setInvoiceRangeFilter('today')">Today</button>
        <button class="date-chip" id="inv-range-yesterday" onclick="setInvoiceRangeFilter('yesterday')">Yesterday</button>
        <button class="date-chip" id="inv-range-7days" onclick="setInvoiceRangeFilter('7days')">7 Days</button>
        <button class="date-chip" id="inv-range-month" onclick="setInvoiceRangeFilter('month')">Month</button>
      </div>
      
      <input type="text" id="inv-search-input" class="search-bar" placeholder="🔍 Search by Invoice #, Customer name..." oninput="handleInvoiceSearch()" />

      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 8px;">
        <span id="sales-count-label">Loading sales...</span>
      </div>

      <div id="sales-list-container">
        <!-- Invoices injected here -->
      </div>
    </div>

    <!-- SCREEN 6: 🔄 CUSTOMER RETURNS (OWNER ONLY) -->
    <div id="screen-returns" class="main-container" style="display: none;">
      <div class="card" style="background: linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%); border: 1px solid #FECACA;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">TOTAL RETURNS PROCESSED</div>
            <div style="font-size: 22px; font-weight: 800; color: #DC2626; font-family: var(--font-mono);" id="returns-total-amount">Rs. 0</div>
          </div>
          <span class="badge badge-danger" id="returns-count-badge">0 Returns</span>
        </div>
      </div>

      <div id="returns-list-container">
        <!-- Returns injected here -->
      </div>
    </div>

    <!-- SCREEN 7: 🚚 ONLINE ORDERS (OWNER ONLY) -->
    <div id="screen-orders" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" onclick="filterOrderStatus('')" id="order-chip-all">All Orders</button>
        <button class="date-chip" onclick="filterOrderStatus('pending')" id="order-chip-pending">Pending</button>
        <button class="date-chip" onclick="filterOrderStatus('confirmed')" id="order-chip-confirmed">Confirmed</button>
        <button class="date-chip" onclick="filterOrderStatus('dispatched')" id="order-chip-dispatched">Dispatched</button>
      </div>

      <div id="orders-list-container">
        <!-- Orders injected here -->
      </div>
    </div>

    <!-- SCREEN 8: 📈 REPORTS (OWNER ONLY) -->
    <div id="screen-reports" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" id="rep-chip-month" onclick="setReportRange('month')">This Month</button>
        <button class="date-chip" id="rep-chip-7days" onclick="setReportRange('7days')">Last 7 Days</button>
        <button class="date-chip" id="rep-chip-today" onclick="setReportRange('today')">Today</button>
      </div>

      <div class="card" style="border: 1px solid #A7F3D0; background: linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%);">
        <div class="card-title">
          <span>📊 Executive Profit & Loss</span>
          <span class="badge badge-success" id="rep-margin-badge">0% Margin</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Total Revenue:</span>
            <strong id="rep-revenue" style="font-family: var(--font-mono); color: var(--text);">Rs. 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Cost of Goods (COGS):</span>
            <span id="rep-cogs" style="font-family: var(--font-mono); color: #DC2626;">-Rs. 0</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--card-border); padding-top: 6px;">
            <span style="color: var(--text-muted);">Gross Profit:</span>
            <strong id="rep-gross-profit" style="font-family: var(--font-mono); color: #059669;">Rs. 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Operating Expenses:</span>
            <span id="rep-expenses" style="font-family: var(--font-mono); color: #DC2626;">-Rs. 0</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--card-border); padding-top: 8px; font-size: 15px;">
            <strong>Net Store Profit:</strong>
            <strong id="rep-net-profit" style="font-family: var(--font-mono); color: var(--primary);">Rs. 0</strong>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>🏆 Top Selling Products</span>
        </div>
        <div id="rep-top-items-container">
          <!-- Top items injected here -->
        </div>
      </div>
    </div>

    <!-- SCREEN 9: 🔒 DAY CLOSE (OWNER ONLY) -->
    <div id="screen-dayclose" class="main-container" style="display: none;">
      <div class="card" style="border: 1px solid #C7D2FE; background: linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%);">
        <div class="card-title">
          <span>🔒 Cash Reconciliation</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10.5px; color: var(--text-muted);">EXPECTED DRAWER CASH</div>
            <div style="font-size: 24px; font-weight: 800; color: #059669; font-family: var(--font-mono);" id="close-expected-cash">Rs. 0</div>
          </div>
          <div>
            <div style="font-size: 10.5px; color: var(--text-muted);">COUNTED CASH</div>
            <div style="font-size: 24px; font-weight: 800; color: #4F46E5; font-family: var(--font-mono);" id="close-counted-cash">Rs. 0</div>
          </div>
        </div>

        <div style="background: var(--surface-2); padding: 10px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700;">Discrepancy:</span>
          <span style="font-size: 12px; font-weight: 800; font-family: var(--font-mono);" id="close-diff-val">Rs. 0 (Balanced)</span>
        </div>

        <!-- DENOMINATIONS -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 5,000</label>
            <input type="number" id="d-5000" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 1,000</label>
            <input type="number" id="d-1000" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 500</label>
            <input type="number" id="d-500" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 100</label>
            <input type="number" id="d-100" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 50</label>
            <input type="number" id="d-50" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-muted);">Rs. 20</label>
            <input type="number" id="d-20" class="search-bar" style="margin: 0; padding: 6px;" placeholder="0" oninput="calcCounted()" />
          </div>
        </div>

        <input type="text" id="close-notes" class="search-bar" placeholder="Closing notes / comments..." />

        <button class="btn btn-primary" id="btn-submit-dayclose" style="width: 100%;" onclick="submitDayCloseRemote()">
          🔒 Sign & Lock Day Close
        </button>

        <button class="btn btn-whatsapp" style="width: 100%; margin-top: 8px;" onclick="shareWhatsApp()">
          📲 Send WhatsApp Day Close Summary
        </button>
      </div>
    </div>

  </main>

  <!-- MODAL 1: MOBILE CART DRAWER (SLIDE UP) -->
  <div id="cart-drawer-modal" class="modal-backdrop" style="display: none;" onclick="closeCartDrawer(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="font-size: 15px; color: var(--text);">🛍️ Shopping Cart</strong>
          <span class="badge badge-success" id="cart-drawer-count-badge">0 Items</span>
        </div>
        <button class="icon-btn" onclick="closeCartDrawer()">✕</button>
      </div>

      <div class="sheet-body">
        <!-- Customer Banner -->
        <div style="background: var(--surface-2); padding: 9px 12px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">CUSTOMER:</div>
            <strong id="drawer-customer-name" style="font-size: 13px; color: var(--text);">Walk-in Customer</strong>
          </div>
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="openCustomerModal()">Change</button>
        </div>

        <!-- Items Container -->
        <div id="drawer-cart-items" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          <!-- Injected Items -->
        </div>

        <!-- Order Discount Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--card-border);">
          <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Bill Discount (Rs.):</span>
          <input type="number" id="drawer-cart-discount" class="search-bar" style="margin: 0; width: 90px; text-align: right; padding: 4px 8px; font-family: var(--font-mono); font-size: 12px;" value="0" oninput="updateCartDiscount(this.value)" />
        </div>

        <!-- Grand Total Row -->
        <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; padding: 10px 0; border-top: 1px dashed var(--card-border);">
          <span>Grand Total:</span>
          <span id="drawer-cart-grandtotal" style="font-family: var(--font-mono); color: var(--primary);">Rs. 0</span>
        </div>
      </div>

      <div class="sheet-footer">
        <button class="btn btn-secondary" style="flex: 1;" onclick="parkCurrentSale()">⏳ Park</button>
        <button class="btn btn-primary" style="flex: 2;" onclick="openCheckoutModal()">Proceed to Pay ➔</button>
      </div>
    </div>
  </div>

  <!-- MODAL 2: CHECKOUT & PAYMENT MODAL -->
  <div id="checkout-modal" class="modal-backdrop" style="display: none;" onclick="closeCheckoutModal(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <strong style="font-size: 15px; color: var(--text);">💳 Payment & Checkout</strong>
        <button class="icon-btn" onclick="closeCheckoutModal()">✕</button>
      </div>

      <div class="sheet-body">
        <div style="background: linear-gradient(135deg, #ECFDF5 0%, #EEF2FF 100%); border: 1px solid #A7F3D0; border-radius: 14px; padding: 14px; text-align: center; margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #065F46; text-transform: uppercase;">Total Payable Amount</div>
          <div style="font-size: 30px; font-weight: 800; color: var(--primary); font-family: var(--font-mono);" id="checkout-payable-amount">Rs. 0</div>
        </div>

        <!-- Payment Method Chips -->
        <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 6px;">SELECT PAYMENT METHOD:</label>
        <div class="pay-methods-grid">
          <div class="pay-chip active" id="pay-method-cash" onclick="setPayMethod('cash')">💵 Cash</div>
          <div class="pay-chip" id="pay-method-card" onclick="setPayMethod('card')">💳 Card</div>
          <div class="pay-chip" id="pay-method-bank" onclick="setPayMethod('bank')">🏦 Bank / Online</div>
          <div class="pay-chip" id="pay-method-split" onclick="setPayMethod('split')">🔀 Split</div>
          <div class="pay-chip" id="pay-method-credit" onclick="setPayMethod('credit')">📋 Credit (Khata)</div>
        </div>

        <!-- Cash Received & Change Due Calculator -->
        <div id="cash-calculator-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted);">CASH RECEIVED (RS):</label>
            <span style="font-size: 11px; font-weight: 700; color: var(--primary); cursor: pointer;" onclick="setExactCash()">Exact Cash</span>
          </div>
          <input type="number" id="checkout-cash-tendered" class="search-bar" style="font-family: var(--font-mono); font-size: 18px; font-weight: 800; text-align: center; color: var(--text);" placeholder="0" oninput="calcChangeDue()" />

          <!-- Quick Amount Buttons -->
          <div style="display: flex; gap: 6px; margin-bottom: 12px;">
            <button class="date-chip" style="flex: 1;" onclick="addQuickCash(500)">+500</button>
            <button class="date-chip" style="flex: 1;" onclick="addQuickCash(1000)">+1,000</button>
            <button class="date-chip" style="flex: 1;" onclick="addQuickCash(2000)">+2,000</button>
            <button class="date-chip" style="flex: 1;" onclick="addQuickCash(5000)">+5,000</button>
          </div>

          <div style="background: var(--surface-2); padding: 10px 14px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700;">Change Return:</span>
            <strong id="checkout-change-due" style="font-size: 18px; font-family: var(--font-mono); color: #059669;">Rs. 0</strong>
          </div>
        </div>

        <!-- Notes input -->
        <input type="text" id="checkout-notes" class="search-bar" style="margin-top: 12px;" placeholder="Optional invoice notes..." />
      </div>

      <div class="sheet-footer">
        <button class="btn btn-secondary" onclick="closeCheckoutModal()">Back</button>
        <button class="btn btn-primary" id="btn-complete-checkout" style="flex: 1;" onclick="submitCompleteSale()">
          ⚡ Complete Sale & Generate Bill
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL 3: COMPLETED INVOICE RECEIPT MODAL -->
  <div id="invoice-modal" class="modal-backdrop" style="display: none;" onclick="closeInvoiceModal(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="/api/logo" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;" alt="Logo" />
          <div>
            <div style="font-weight: 800; color: var(--text); font-size: 13.5px;" id="modal-inv-num">Invoice #</div>
            <div style="font-size: 10px; color: var(--text-muted);" id="modal-inv-date">Date & Time</div>
          </div>
        </div>
        <button class="icon-btn" onclick="closeInvoiceModal()">✕</button>
      </div>

      <div class="sheet-body" id="printable-receipt">
        <div style="text-align: center; border-bottom: 1px dashed var(--card-border); padding-bottom: 10px; margin-bottom: 10px;">
          <div style="font-size: 16px; font-weight: 800; color: var(--text);" id="modal-receipt-store-name">Nuqta AI POS</div>
          <div style="font-size: 11px; color: var(--text-muted);" id="modal-receipt-store-address">Clothing & Garments</div>
        </div>

        <div style="margin-bottom: 10px; font-size: 11.5px;">
          <div style="color: var(--text-muted);">Customer: <strong id="modal-inv-customer" style="color: var(--text);">Walk-in Customer</strong></div>
          <div style="color: var(--text-muted);">Cashier: <span id="modal-inv-cashier">Staff</span></div>
        </div>

        <div id="modal-inv-items" style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--card-border); padding-top: 8px;">
          <!-- Item rows injected here -->
        </div>

        <div style="border-top: 1px solid var(--card-border); margin-top: 10px; padding-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Subtotal:</span>
            <span id="modal-inv-subtotal" style="font-family: var(--font-mono);">Rs. 0</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Discount:</span>
            <span id="modal-inv-discount" style="font-family: var(--font-mono); color: var(--danger);">-Rs. 0</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 1px dashed var(--card-border); padding-top: 4px;">
            <span>Grand Total:</span>
            <span id="modal-inv-total" style="font-family: var(--font-mono); color: var(--primary);">Rs. 0</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Amount Paid (<span id="modal-inv-method">CASH</span>):</span>
            <span id="modal-inv-paid" style="font-family: var(--font-mono);">Rs. 0</span>
          </div>
        </div>

        <div style="text-align: center; font-size: 10.5px; color: var(--text-muted); margin-top: 14px;">
          *** Thank you for shopping with us! ***
        </div>
      </div>

      <div class="sheet-footer">
        <button class="btn btn-secondary" onclick="printReceipt()">🖨️ Print</button>
        <button class="btn btn-whatsapp" style="flex: 1;" onclick="shareInvoiceCustomerWhatsApp()">📲 WhatsApp Bill</button>
        <button class="btn btn-primary" onclick="resetForNewSale()">✨ New Sale</button>
      </div>
    </div>
  </div>

  <!-- MODAL 4: CUSTOMER PICKER & CREATOR -->
  <div id="customer-modal" class="modal-backdrop" style="display: none;" onclick="closeCustomerModal(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <strong style="font-size: 14px; color: var(--text);">👤 Select or Add Customer</strong>
        <button class="icon-btn" onclick="closeCustomerModal()">✕</button>
      </div>
      <div class="sheet-body">
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <input type="text" id="cust-search-input" class="search-bar" style="margin: 0;" placeholder="🔍 Search customer by name or phone..." oninput="handleCustomerSearch()" />
          <button class="btn btn-primary" style="padding: 0 12px; font-size: 12px;" onclick="toggleAddCustomerForm()">+ New</button>
        </div>

        <!-- Add Customer Inline Form -->
        <div id="add-cust-form" style="display: none; background: var(--surface-2); padding: 12px; border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--card-border);">
          <strong style="font-size: 12.5px; display: block; margin-bottom: 8px;">Create New Customer</strong>
          <input type="text" id="new-cust-name" class="search-bar" placeholder="Customer Name *" />
          <input type="text" id="new-cust-phone" class="search-bar" placeholder="Phone / WhatsApp Number *" />
          <input type="text" id="new-cust-address" class="search-bar" placeholder="Address (optional)" />
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="toggleAddCustomerForm()">Cancel</button>
            <button class="btn btn-primary" style="flex: 2;" onclick="submitNewCustomer()">Save Customer</button>
          </div>
        </div>

        <div id="cust-list-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto;">
          <!-- Customers injected -->
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 5: PARKED TICKETS LIST -->
  <div id="parked-modal" class="modal-backdrop" style="display: none;" onclick="closeParkedModal(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <strong style="font-size: 14px; color: var(--text);">⏳ Held / Parked Tickets</strong>
        <button class="icon-btn" onclick="closeParkedModal()">✕</button>
      </div>
      <div class="sheet-body" id="parked-list-container">
        <!-- Parked tickets list -->
      </div>
    </div>
  </div>

  <!-- FIXED BOTTOM NAVIGATION BAR (ROLE-BASED) -->
  <nav class="bottom-nav" id="bottom-nav" style="display: none;">
    <!-- POS REGISTER (AVAILABLE TO ALL STAFF & OWNER) -->
    <button class="nav-item active" id="nav-pos" onclick="switchTab('pos')">
      <span class="nav-icon">⚡</span>
      <span class="nav-title">POS</span>
    </button>
    
    <!-- DASHBOARD (AVAILABLE TO ALL STAFF & OWNER) -->
    <button class="nav-item" id="nav-dashboard" onclick="switchTab('dashboard')">
      <span class="nav-icon">📊</span>
      <span class="nav-title">Dashboard</span>
    </button>

    <!-- OWNER-ONLY TABS -->
    <button class="nav-item owner-only-tab" id="nav-stock" onclick="switchTab('stock')">
      <span class="nav-icon">📦</span>
      <span class="nav-title">Stock</span>
    </button>
    <button class="nav-item owner-only-tab" id="nav-sales" onclick="switchTab('sales')">
      <span class="nav-icon">🛒</span>
      <span class="nav-title">Sales</span>
    </button>
    <button class="nav-item owner-only-tab" id="nav-returns" onclick="switchTab('returns')">
      <span class="nav-icon">🔄</span>
      <span class="nav-title">Returns</span>
    </button>
    <button class="nav-item owner-only-tab" id="nav-orders" onclick="switchTab('orders')">
      <span class="nav-icon">🚚</span>
      <span class="nav-title">Orders</span>
    </button>
    <button class="nav-item owner-only-tab" id="nav-reports" onclick="switchTab('reports')">
      <span class="nav-icon">📈</span>
      <span class="nav-title">Reports</span>
    </button>
    <button class="nav-item owner-only-tab" id="nav-dayclose" onclick="switchTab('dayclose')">
      <span class="nav-icon">🔒</span>
      <span class="nav-title">Day Close</span>
    </button>
  </nav>

  <!-- JAVASCRIPT APP LOGIC -->
  <script>
    let enteredPin = '';
    let authToken = localStorage.getItem('aldeewan_mobile_token') || '';
    let currentUser = null;
    let currentTab = 'pos';
    let selectedDashboardDate = new Date().toISOString().slice(0, 10);
    
    // POS State
    let allPosItems = [];
    let allCategories = [];
    let allCustomers = [];
    let activePosCategory = '';
    let currentCart = [];
    let selectedCustomer = { id: null, name: 'Walk-in Customer', phone: '' };
    let cartDiscountAmount = 0;
    let selectedPaymentMethod = 'cash';
    let parkedTicketsList = [];

    // Management State
    let allStockItems = [];
    let selectedStockCategory = '';
    let lowStockOnlyFilter = false;
    let allInvoices = [];
    let activeRangeFilter = 'today';
    let allReturns = [];
    let allOrders = [];
    let selectedInvoiceForModal = null;
    let expectedCashAmount = 0;
    let storeMeta = { storeName: 'Nuqta AI POS', phone: '', address: '' };

    function fmt(num) {
      const val = Number(num) || 0;
      return 'Rs. ' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function haptic() {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(25);
      }
    }

    // On Load
    window.addEventListener('DOMContentLoaded', () => {
      loadStoreInfo();
      if (authToken) {
        try {
          const savedUser = JSON.parse(localStorage.getItem('aldeewan_mobile_user') || 'null');
          if (savedUser) {
            currentUser = savedUser;
            unlockApp();
            return;
          }
        } catch (_) {}
      }
      showPinScreen();
    });

    async function loadStoreInfo() {
      try {
        const res = await fetch('/api/store-info');
        const json = await res.json();
        if (json.success && json.data) {
          storeMeta = json.data;
          if (json.data.storeName) {
            document.getElementById('header-store-name').innerText = json.data.storeName;
            document.getElementById('modal-receipt-store-name').innerText = json.data.storeName;
          }
          if (json.data.address) {
            document.getElementById('modal-receipt-store-address').innerText = json.data.address;
          }
        }
      } catch (_) {}
    }

    function showPinScreen() {
      document.getElementById('screen-pin').style.display = 'flex';
      ['pos', 'dashboard', 'stock', 'sales', 'returns', 'orders', 'reports', 'dayclose'].forEach(s => {
        const el = document.getElementById('screen-' + s);
        if (el) el.style.display = 'none';
      });
      document.getElementById('bottom-nav').style.display = 'none';
      enteredPin = '';
      updatePinDots();
    }

    function unlockApp() {
      document.getElementById('screen-pin').style.display = 'none';
      const bottomNav = document.getElementById('bottom-nav');
      bottomNav.style.display = 'flex';

      // Apply Role-Based Navigation & Permissions
      const isOwner = currentUser && (currentUser.isOwner || currentUser.role === 'owner');
      bottomNav.classList.toggle('staff-mode', !isOwner);
      
      // Update Header Subtitle
      document.getElementById('header-user-role').innerText = currentUser 
        ? (currentUser.name + ' (' + (isOwner ? 'Owner' : 'Sales Staff') + ')')
        : 'Register Portal';

      // Show/Hide Owner-only Tabs in Bottom Bar
      const ownerTabs = document.querySelectorAll('.owner-only-tab');
      ownerTabs.forEach(t => {
        t.style.display = isOwner ? 'flex' : 'none';
      });

      // Show/Hide Owner-only Cards in Dashboard
      const profitCard = document.getElementById('dash-owner-profit-card');
      if (profitCard) profitCard.style.display = isOwner ? 'block' : 'none';

      // Initial tab: Sales staff always starts in POS Register
      switchTab('pos');
      loadPosInit();
    }

    function pressKey(e, key) {
      if (e) e.preventDefault();
      haptic();
      if (key === 'clr') {
        enteredPin = '';
      } else if (key === 'back') {
        enteredPin = enteredPin.slice(0, -1);
      } else if (enteredPin.length < 4) {
        enteredPin += key;
      }
      updatePinDots();
      if (enteredPin.length === 4) {
        submitPinAuth();
      }
    }

    function updatePinDots() {
      for (let i = 0; i < 4; i++) {
        const d = document.getElementById('dot-' + i);
        if (d) d.classList.toggle('filled', i < enteredPin.length);
      }
    }

    async function submitPinAuth() {
      const errEl = document.getElementById('pin-error');
      errEl.innerText = '';
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: enteredPin })
        });
        const json = await res.json();
        if (json.success && json.token) {
          authToken = json.token;
          currentUser = json.user;
          localStorage.setItem('aldeewan_mobile_token', authToken);
          localStorage.setItem('aldeewan_mobile_user', JSON.stringify(currentUser));
          unlockApp();
        } else {
          errEl.innerText = json.error || 'Invalid PIN';
          enteredPin = '';
          updatePinDots();
        }
      } catch (err) {
        errEl.innerText = 'Network error reaching server';
        enteredPin = '';
        updatePinDots();
      }
    }

    function logout() {
      authToken = '';
      currentUser = null;
      localStorage.removeItem('aldeewan_mobile_token');
      localStorage.removeItem('aldeewan_mobile_user');
      showPinScreen();
    }

    function switchTab(tab) {
      const isOwner = currentUser && (currentUser.isOwner || currentUser.role === 'owner');
      
      // Enforce role permission: sales staff can only access pos and dashboard
      if (!isOwner && tab !== 'pos' && tab !== 'dashboard') {
        tab = 'pos';
      }

      currentTab = tab;
      ['pos', 'dashboard', 'stock', 'sales', 'returns', 'orders', 'reports', 'dayclose'].forEach(s => {
        const screen = document.getElementById('screen-' + s);
        const nav = document.getElementById('nav-' + s);
        if (screen) screen.style.display = (s === tab) ? 'block' : 'none';
        if (nav) nav.classList.toggle('active', s === tab);
      });

      refreshCurrentTab();
    }

    function refreshCurrentTab() {
      if (currentTab === 'pos') loadPosInit();
      else if (currentTab === 'dashboard') loadDashboard();
      else if (currentTab === 'stock') loadStock();
      else if (currentTab === 'sales') loadSales();
      else if (currentTab === 'returns') loadReturns();
      else if (currentTab === 'orders') loadOrders();
      else if (currentTab === 'reports') loadReports();
      else if (currentTab === 'dayclose') loadDayClosePreview();
    }

    // -------------------------------------------------------------
    // ⚡ POS REGISTER ENGINE
    // -------------------------------------------------------------
    async function loadPosInit() {
      try {
        const res = await fetch('/api/pos/init');
        const json = await res.json();
        if (json.success && json.data) {
          allPosItems = json.data.items || [];
          allCategories = json.data.categories || [];
          allCustomers = json.data.customers || [];
          renderPosCategoryChips();
          renderPosItems();
          loadParkedTicketsCount();
        }
      } catch (e) {
        console.error('POS init error:', e);
      }
    }

    function renderPosCategoryChips() {
      const container = document.getElementById('pos-category-chips');
      let html = '<button class="date-chip ' + (activePosCategory === '' ? 'active' : '') + '" onclick="filterPosCategory(\\'\\')">All Items</button>';
      allCategories.forEach(c => {
        html += '<button class="date-chip ' + (activePosCategory === c.id ? 'active' : '') + '" onclick="filterPosCategory(\\'' + c.id + '\\')">' + c.name + '</button>';
      });
      container.innerHTML = html;
    }

    function filterPosCategory(catId) {
      activePosCategory = catId;
      renderPosCategoryChips();
      renderPosItems();
    }

    function handlePosSearch() {
      renderPosItems();
    }

    function renderPosItems() {
      const q = (document.getElementById('pos-search-input').value || '').toLowerCase().trim();
      let list = allPosItems;

      if (activePosCategory) {
        list = list.filter(i => i.category_id === activePosCategory);
      }
      if (q) {
        list = list.filter(i => 
          (i.name || '').toLowerCase().includes(q) || 
          (i.barcode || '').toLowerCase().includes(q) || 
          (i.part_number || '').toLowerCase().includes(q) ||
          (i.size_variant || '').toLowerCase().includes(q)
        );
      }

      document.getElementById('pos-items-count-label').innerText = list.length + ' Items Available';

      const container = document.getElementById('pos-items-container');
      if (list.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 10px;">No items match the search query.</div>';
        return;
      }

      let html = '';
      list.slice(0, 100).forEach(it => {
        const qty = Number(it.quantity_on_hand) || 0;
        const isOut = qty <= 0;
        const stockText = isOut ? 'Out of Stock' : qty + ' in stock';

        html += '<div class="pos-item-card" onclick="addToCart(\\'' + it.id + '\\')">';
        html += '  <div>';
        html += '    <div class="pos-item-title">' + it.name + '</div>';
        if (it.size_variant) {
          html += '  <div class="pos-item-variant">' + it.size_variant + '</div>';
        }
        html += '  </div>';
        html += '  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px;">';
        html += '    <div class="pos-item-price">' + fmt(it.retail_price) + '</div>';
        html += '    <div class="pos-item-stock ' + (isOut ? 'out' : '') + '">' + stockText + '</div>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    function addToCart(itemId) {
      haptic();
      const it = allPosItems.find(i => i.id === itemId);
      if (!it) return;

      const existing = currentCart.find(c => c.item_id === itemId);
      const currentQtyInCart = existing ? existing.qty : 0;
      const stockOnHand = Number(it.quantity_on_hand) || 0;

      if (currentQtyInCart + 1 > stockOnHand) {
        alert('Cannot add more units. Only ' + stockOnHand + ' available in stock for ' + it.name);
        return;
      }

      if (existing) {
        existing.qty += 1;
        existing.line_total = existing.qty * existing.unit_price;
      } else {
        currentCart.push({
          item_id: it.id,
          name: it.name,
          size_variant: it.size_variant || '',
          unit_price: Number(it.retail_price) || 0,
          cost_price: Number(it.cost_price) || 0,
          qty: 1,
          discount_pct: 0,
          line_total: Number(it.retail_price) || 0,
          stock_on_hand: stockOnHand
        });
      }

      renderCart();
    }

    function updateCartItemQty(itemId, delta) {
      haptic();
      const item = currentCart.find(c => c.item_id === itemId);
      if (!item) return;

      const newQty = item.qty + delta;
      if (newQty <= 0) {
        currentCart = currentCart.filter(c => c.item_id !== itemId);
      } else if (newQty > item.stock_on_hand) {
        alert('Stock limit reached. Only ' + item.stock_on_hand + ' available.');
        return;
      } else {
        item.qty = newQty;
        item.line_total = item.qty * item.unit_price;
      }
      renderCart();
    }

    function removeCartItem(itemId) {
      haptic();
      currentCart = currentCart.filter(c => c.item_id !== itemId);
      renderCart();
    }

    function clearCart() {
      if (currentCart.length > 0 && confirm('Are you sure you want to clear the entire cart?')) {
        currentCart = [];
        cartDiscountAmount = 0;
        selectedCustomer = { id: null, name: 'Walk-in Customer', phone: '' };
        renderCart();
      }
    }

    function updateCartDiscount(val) {
      cartDiscountAmount = Math.max(0, Number(val) || 0);
      renderCartTotalsOnly();
    }

    function updateCartItemPrice(itemId, newPrice) {
      const item = currentCart.find(c => c.item_id === itemId);
      if (!item) return;
      const p = Math.max(0, Number(newPrice) || 0);
      item.unit_price = p;
      item.line_total = item.qty * item.unit_price;
      renderCart();
    }

    function updateCartItemPriceLive(itemId, newPrice) {
      const item = currentCart.find(c => c.item_id === itemId);
      if (!item) return;
      const p = Math.max(0, Number(newPrice) || 0);
      item.unit_price = p;
      item.line_total = item.qty * item.unit_price;
      renderCartTotalsOnly();
    }

    function renderCart() {
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      const totalItemsCount = currentCart.reduce((s, i) => s + i.qty, 0);

      // Render Floating Cart Bar
      const floatBar = document.getElementById('mobile-floating-cart');
      const posScreen = document.getElementById('screen-pos');
      if (currentCart.length > 0) {
        floatBar.style.display = 'flex';
        if (posScreen) posScreen.classList.add('has-cart-bar');
        document.getElementById('floating-cart-qty').innerText = totalItemsCount + (totalItemsCount === 1 ? ' Item' : ' Items');
        document.getElementById('floating-cart-total').innerText = fmt(grandTotal);
      } else {
        floatBar.style.display = 'none';
        if (posScreen) posScreen.classList.remove('has-cart-bar');
      }

      // Render Tablet Sidebar Cart
      renderCartItemsInto('sidebar-cart-items');
      document.getElementById('sidebar-customer-name').innerText = selectedCustomer.name;
      document.getElementById('sidebar-cart-subtotal').innerText = fmt(subtotal);
      document.getElementById('sidebar-cart-grandtotal').innerText = fmt(grandTotal);

      // Render Mobile Drawer Cart if open
      renderCartItemsInto('drawer-cart-items');
      document.getElementById('drawer-customer-name').innerText = selectedCustomer.name;
      document.getElementById('cart-drawer-count-badge').innerText = totalItemsCount + ' Items';
      document.getElementById('drawer-cart-grandtotal').innerText = fmt(grandTotal);
    }

    function renderCartTotalsOnly() {
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      
      document.getElementById('sidebar-cart-grandtotal').innerText = fmt(grandTotal);
      document.getElementById('drawer-cart-grandtotal').innerText = fmt(grandTotal);
      document.getElementById('floating-cart-total').innerText = fmt(grandTotal);
    }

    function renderCartItemsInto(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (currentCart.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 12px;">Cart is empty. Tap products to add.</div>';
        return;
      }

      let html = '';
      currentCart.forEach(it => {
        html += '<div class="cart-item-card">';
        html += '  <div class="cart-item-top">';
        html += '    <div class="cart-item-info">';
        html += '      <div class="cart-item-name">' + it.name + '</div>';
        html += '      <div class="cart-item-price-edit">';
        html += '        <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700;">Rs.</span>';
        html += '        <input type="number" class="cart-price-input" value="' + it.unit_price + '" min="0" step="1" onchange="updateCartItemPrice(\\'' + it.item_id + '\\', this.value)" oninput="updateCartItemPriceLive(\\'' + it.item_id + '\\', this.value)" onfocus="this.select()" title="Tap to edit selling price" />';
        if (it.size_variant) {
          html += '      <span class="pos-item-variant" style="margin: 0; font-size: 9px; padding: 1px 5px;">' + it.size_variant + '</span>';
        }
        html += '      </div>';
        html += '    </div>';
        html += '    <div class="cart-item-right">';
        html += '      <div class="cart-item-total">' + fmt(it.line_total) + '</div>';
        html += '      <button class="cart-item-del" onclick="removeCartItem(\\'' + it.item_id + '\\')" title="Remove item">🗑️</button>';
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="cart-item-bottom">';
        html += '    <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">Quantity:</span>';
        html += '    <div class="cart-qty-ctrl">';
        html += '      <button class="qty-btn" onclick="updateCartItemQty(\\'' + it.item_id + '\\', -1)">−</button>';
        html += '      <span class="qty-val">' + it.qty + '</span>';
        html += '      <button class="qty-btn" onclick="updateCartItemQty(\\'' + it.item_id + '\\', 1)">+</button>';
        html += '    </div>';
        html += '    <span style="font-size: 10px; color: var(--text-muted); font-weight: 600;">(Stock: ' + it.stock_on_hand + ')</span>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    // -------------------------------------------------------------
    // 💳 CHECKOUT & PAYMENT MODAL
    // -------------------------------------------------------------
    function openCartDrawer() {
      haptic();
      document.getElementById('cart-drawer-modal').style.display = 'flex';
      renderCart();
    }

    function closeCartDrawer(e) {
      if (e && e.target !== e.currentTarget) return;
      document.getElementById('cart-drawer-modal').style.display = 'none';
    }

    function openCheckoutModal() {
      if (currentCart.length === 0) {
        alert('Cart is empty. Please add items to proceed.');
        return;
      }
      haptic();
      closeCartDrawer();
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      
      document.getElementById('checkout-payable-amount').innerText = fmt(grandTotal);
      document.getElementById('checkout-cash-tendered').value = grandTotal;
      selectedPaymentMethod = 'cash';
      setPayMethod('cash');
      calcChangeDue();

      document.getElementById('checkout-modal').style.display = 'flex';
    }

    function closeCheckoutModal(e) {
      if (e && e.target !== e.currentTarget) return;
      document.getElementById('checkout-modal').style.display = 'none';
    }

    function setPayMethod(m) {
      selectedPaymentMethod = m;
      ['cash', 'card', 'bank', 'split', 'credit'].forEach(method => {
        const el = document.getElementById('pay-method-' + method);
        if (el) el.classList.toggle('active', method === m);
      });

      const cashBox = document.getElementById('cash-calculator-box');
      if (cashBox) cashBox.style.display = (m === 'cash' || m === 'split') ? 'block' : 'none';
      calcChangeDue();
    }

    function setExactCash() {
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      document.getElementById('checkout-cash-tendered').value = grandTotal;
      calcChangeDue();
    }

    function addQuickCash(amount) {
      const cur = Number(document.getElementById('checkout-cash-tendered').value) || 0;
      document.getElementById('checkout-cash-tendered').value = cur + amount;
      calcChangeDue();
    }

    function calcChangeDue() {
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      const tendered = Number(document.getElementById('checkout-cash-tendered').value) || 0;
      const change = tendered - grandTotal;

      const changeEl = document.getElementById('checkout-change-due');
      if (change >= 0) {
        changeEl.innerText = fmt(change);
        changeEl.style.color = '#059669';
      } else {
        changeEl.innerText = '-' + fmt(Math.abs(change)) + ' (Due)';
        changeEl.style.color = '#DC2626';
      }
    }

    async function submitCompleteSale() {
      const subtotal = currentCart.reduce((s, i) => s + i.line_total, 0);
      const grandTotal = Math.max(0, subtotal - cartDiscountAmount);
      const tendered = Number(document.getElementById('checkout-cash-tendered').value) || 0;
      const notes = document.getElementById('checkout-notes').value || '';

      const amountPaid = selectedPaymentMethod === 'credit' ? 0 : (selectedPaymentMethod === 'cash' ? Math.min(grandTotal, tendered) : grandTotal);
      const balanceDue = Math.max(0, grandTotal - amountPaid);

      const btn = document.getElementById('btn-complete-checkout');
      btn.innerText = 'Processing Sale...';
      btn.disabled = true;

      try {
        const payload = {
          staffId: currentUser ? currentUser.id : 'usr-owner',
          customer_id: selectedCustomer.id || null,
          source: 'instore',
          subtotal,
          discount_amount: cartDiscountAmount,
          grand_total: grandTotal,
          amount_paid: amountPaid,
          balance_due: balanceDue,
          payment_method: selectedPaymentMethod,
          notes,
          items: currentCart.map(c => ({
            item_id: c.item_id,
            qty: c.qty,
            unit_price: c.unit_price,
            cost_price: c.cost_price,
            discount_pct: c.discount_pct || 0,
            line_total: c.line_total
          }))
        };

        const res = await fetch('/api/pos/create-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success && json.data) {
          closeCheckoutModal();
          selectedInvoiceForModal = json.data;
          displayCompletedReceipt(json.data);
          // Refresh item stock
          loadPosInit();
        } else {
          alert('Error completing sale: ' + (json.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error communicating with POS server');
      } finally {
        btn.innerText = '⚡ Complete Sale & Generate Bill';
        btn.disabled = false;
      }
    }

    function displayCompletedReceipt(inv) {
      document.getElementById('modal-inv-num').innerText = inv.invoice_number;
      document.getElementById('modal-inv-date').innerText = (inv.date || '') + ' ' + (inv.datetime_created ? inv.datetime_created.slice(11, 16) : '');
      document.getElementById('modal-inv-customer').innerText = selectedCustomer.name || 'Walk-in Customer';
      document.getElementById('modal-inv-cashier').innerText = currentUser ? currentUser.name : 'Staff';
      document.getElementById('modal-inv-subtotal').innerText = fmt(inv.subtotal);
      document.getElementById('modal-inv-discount').innerText = '-' + fmt(inv.discount_amount);
      document.getElementById('modal-inv-total').innerText = fmt(inv.grand_total);
      document.getElementById('modal-inv-paid').innerText = fmt(inv.amount_paid);
      document.getElementById('modal-inv-method').innerText = (inv.payment_method || 'CASH').toUpperCase();

      const itemsContainer = document.getElementById('modal-inv-items');
      let itemsHtml = '';
      if (inv.items) {
        inv.items.forEach(it => {
          itemsHtml += '<div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">';
          itemsHtml += '  <div><strong>' + (it.item_name || 'Item') + '</strong> <span style="color: var(--text-muted);">(' + it.qty + 'x)</span></div>';
          itemsHtml += '  <div style="font-family: var(--font-mono); font-weight: 700;">' + fmt(it.line_total) + '</div>';
          itemsHtml += '</div>';
        });
      }
      itemsContainer.innerHTML = itemsHtml;
      document.getElementById('invoice-modal').style.display = 'flex';
    }

    function resetForNewSale() {
      currentCart = [];
      cartDiscountAmount = 0;
      selectedCustomer = { id: null, name: 'Walk-in Customer', phone: '' };
      closeInvoiceModal();
      renderCart();
    }

    function printReceipt() {
      window.print();
    }

    function shareInvoiceCustomerWhatsApp() {
      if (!selectedInvoiceForModal) return;
      const inv = selectedInvoiceForModal;
      let text = '🧾 *' + storeMeta.storeName.toUpperCase() + ' — INVOICE*\\n' +
                 'Invoice #: *' + inv.invoice_number + '*\\n' +
                 'Date: ' + inv.date + '\\n' +
                 'Customer: ' + (selectedCustomer.name || 'Valued Customer') + '\\n' +
                 '━━━━━━━━━━━━━━━━━━━━\\n';
      if (inv.items) {
        inv.items.forEach(it => {
          text += '• ' + (it.item_name || 'Item') + ' (' + it.qty + 'x) = ' + fmt(it.line_total) + '\\n';
        });
      }
      text += '━━━━━━━━━━━━━━━━━━━━\\n' +
              '*Total Amount:* ' + fmt(inv.grand_total) + '\\n' +
              '*Amount Paid:* ' + fmt(inv.amount_paid) + '\\n\\n' +
              '_Thank you for shopping at ' + storeMeta.storeName + '!_';

      const phone = (selectedCustomer.phone || '').replace(/[^0-9]/g, '');
      const url = phone 
        ? 'https://api.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(text)
        : 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
    }

    // -------------------------------------------------------------
    // 👤 CUSTOMER SELECTION & QUICK CREATION
    // -------------------------------------------------------------
    function openCustomerModal() {
      document.getElementById('customer-modal').style.display = 'flex';
      renderCustomerList();
    }

    function closeCustomerModal(e) {
      if (e && e.target !== e.currentTarget) return;
      document.getElementById('customer-modal').style.display = 'none';
      document.getElementById('add-cust-form').style.display = 'none';
    }

    function toggleAddCustomerForm() {
      const f = document.getElementById('add-cust-form');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    }

    function handleCustomerSearch() {
      renderCustomerList();
    }

    function renderCustomerList() {
      const q = (document.getElementById('cust-search-input').value || '').toLowerCase().trim();
      let list = allCustomers;
      if (q) {
        list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
      }

      const container = document.getElementById('cust-list-container');
      let html = '<div class="list-card" onclick="selectCustomer(null, \\'Walk-in Customer\\', \\'\\')">';
      html += '  <div style="font-weight: 800; font-size: 13px;">Walk-in Customer (Default)</div>';
      html += '</div>';

      list.forEach(c => {
        html += '<div class="list-card" onclick="selectCustomer(\\'' + c.id + '\\', \\'' + c.name.replace(/'/g, "\\'") + '\\', \\'' + (c.phone || '') + '\\')">';
        html += '  <div style="display: flex; justify-content: space-between;">';
        html += '    <strong style="font-size: 13px; color: var(--text);">' + c.name + '</strong>';
        html += '    <span style="font-size: 11px; color: var(--text-muted);">' + (c.phone || '') + '</span>';
        html += '  </div>';
        if (c.balance) {
          html += '  <div style="font-size: 10.5px; color: ' + (c.balance > 0 ? 'var(--danger)' : 'var(--primary)') + '; font-family: var(--font-mono);">';
          html += '    Balance: ' + fmt(c.balance);
          html += '  </div>';
        }
        html += '</div>';
      });

      container.innerHTML = html;
    }

    function selectCustomer(id, name, phone) {
      haptic();
      selectedCustomer = { id, name, phone };
      renderCart();
      closeCustomerModal();
    }

    async function submitNewCustomer() {
      const name = document.getElementById('new-cust-name').value.trim();
      const phone = document.getElementById('new-cust-phone').value.trim();
      const address = document.getElementById('new-cust-address').value.trim();

      if (!name) {
        alert('Please enter customer name');
        return;
      }

      try {
        const res = await fetch('/api/customers/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, address, userId: currentUser?.id })
        });
        const json = await res.json();
        if (json.success && json.data) {
          allCustomers.unshift(json.data);
          selectCustomer(json.data.id, json.data.name, json.data.phone);
        } else {
          alert('Failed to create customer: ' + (json.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error saving customer');
      }
    }

    // -------------------------------------------------------------
    // ⏳ PARKED SALES / HELD TICKETS
    // -------------------------------------------------------------
    async function parkCurrentSale() {
      if (currentCart.length === 0) {
        alert('Cart is empty.');
        return;
      }
      const label = prompt('Enter a note / reference name for this ticket:', selectedCustomer.name || 'Parked Ticket');
      if (label === null) return;

      try {
        const res = await fetch('/api/pos/park', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartData: { items: currentCart, discount: cartDiscountAmount },
            customerId: selectedCustomer.id,
            staffId: currentUser ? currentUser.id : 'usr-owner',
            label: label || 'Mobile Ticket'
          })
        });
        const json = await res.json();
        if (json.success) {
          alert('✅ Cart parked successfully!');
          currentCart = [];
          cartDiscountAmount = 0;
          selectedCustomer = { id: null, name: 'Walk-in Customer', phone: '' };
          renderCart();
          closeCartDrawer();
          loadParkedTicketsCount();
        }
      } catch (e) {
        alert('Error parking sale');
      }
    }

    async function loadParkedTicketsCount() {
      try {
        const res = await fetch('/api/pos/parked?userId=' + (currentUser ? currentUser.id : 'usr-owner'));
        const json = await res.json();
        if (json.success && json.data) {
          parkedTicketsList = json.data;
          document.getElementById('parked-badge').innerText = parkedTicketsList.length;
        }
      } catch (_) {}
    }

    function openParkedTicketsModal() {
      loadParkedTicketsCount();
      document.getElementById('parked-modal').style.display = 'flex';
      renderParkedList();
    }

    function closeParkedModal(e) {
      if (e && e.target !== e.currentTarget) return;
      document.getElementById('parked-modal').style.display = 'none';
    }

    function renderParkedList() {
      const container = document.getElementById('parked-list-container');
      if (parkedTicketsList.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No parked tickets held currently.</div>';
        return;
      }

      let html = '';
      parkedTicketsList.forEach(p => {
        let cart = { items: [] };
        try { cart = JSON.parse(p.cart_data || '{}'); } catch (_) {}
        const itemsCount = cart.items ? cart.items.length : 0;
        const total = cart.items ? cart.items.reduce((s, i) => s + (i.line_total || 0), 0) : 0;

        html += '<div class="list-card">';
        html += '  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
        html += '    <strong style="font-size: 13.5px; color: var(--text);">' + p.label + '</strong>';
        html += '    <span style="font-family: var(--font-mono); font-weight: 800; color: var(--primary);">' + fmt(total) + '</span>';
        html += '  </div>';
        html += '  <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">';
        html += '    <span>' + itemsCount + ' items • ' + (p.created_at || '') + '</span>';
        html += '  </div>';
        html += '  <div style="display: flex; gap: 6px;">';
        html += '    <button class="btn btn-primary" style="flex: 1; padding: 6px; font-size: 11px;" onclick="recallParkedTicket(\\'' + p.id + '\\')">Recall to Cart</button>';
        html += '    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 11px;" onclick="deleteParkedTicket(\\'' + p.id + '\\')">Discard</button>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    async function recallParkedTicket(ticketId) {
      const ticket = parkedTicketsList.find(p => p.id === ticketId);
      if (!ticket) return;

      try {
        const cart = JSON.parse(ticket.cart_data || '{}');
        currentCart = cart.items || [];
        cartDiscountAmount = cart.discount || 0;
        if (ticket.customer_id) {
          const cust = allCustomers.find(c => c.id === ticket.customer_id);
          selectedCustomer = cust ? { id: cust.id, name: cust.name, phone: cust.phone || '' } : { id: ticket.customer_id, name: ticket.customer_name || 'Customer', phone: '' };
        }
        await fetch('/api/pos/delete-parked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ticketId })
        });
        closeParkedModal();
        renderCart();
        loadParkedTicketsCount();
        alert('Ticket recalled into active cart!');
      } catch (e) {
        alert('Failed to recall ticket');
      }
    }

    async function deleteParkedTicket(ticketId) {
      if (!confirm('Discard this held ticket?')) return;
      try {
        await fetch('/api/pos/delete-parked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ticketId })
        });
        loadParkedTicketsCount();
        renderParkedList();
      } catch (_) {}
    }

    // -------------------------------------------------------------
    // 📊 DASHBOARD ENGINE
    // -------------------------------------------------------------
    function setDateFilter(type) {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const chipToday = document.getElementById('dash-chip-today');
      const chipYest = document.getElementById('dash-chip-yesterday');
      const customInput = document.getElementById('dash-custom-date');

      if (chipToday) chipToday.classList.remove('active');
      if (chipYest) chipYest.classList.remove('active');

      if (type === 'today') {
        selectedDashboardDate = todayStr;
        if (chipToday) chipToday.classList.add('active');
        if (customInput) customInput.value = '';
      } else if (type === 'yesterday') {
        const y = new Date();
        y.setDate(today.getDate() - 1);
        selectedDashboardDate = y.toISOString().slice(0, 10);
        if (chipYest) chipYest.classList.add('active');
        if (customInput) customInput.value = '';
      } else if (type === 'custom') {
        selectedDashboardDate = customInput ? customInput.value : todayStr;
      }
      loadDashboard();
    }

    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard?date=' + selectedDashboardDate);
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const c = d.day_calc || {};

          document.getElementById('dash-gross-sales').innerText = fmt(c.total_sales || 0);
          document.getElementById('dash-invoices-count').innerText = (c.invoice_count || 0) + ' Bills Issued';
          document.getElementById('dash-date').innerText = d.date;

          document.getElementById('dash-drawer-cash').innerText = fmt(c.expected_cash || 0);
          document.getElementById('dash-jazzcash').innerText = fmt(c.jazzcash_sales || 0);
          document.getElementById('dash-easypaisa').innerText = fmt(c.easypaisa_sales || 0);
          document.getElementById('dash-otherbank').innerText = fmt((c.card_sales || 0) + (c.other_bank_sales || 0));

          document.getElementById('dash-net-profit').innerText = fmt(c.total_profit || 0);
          document.getElementById('dash-expenses').innerText = fmt(c.total_expenses || 0);
          document.getElementById('dash-returns').innerText = fmt(c.total_returns || 0);
          document.getElementById('dash-unpaid').innerText = fmt(c.total_unpaid || 0);
        }
      } catch (e) {
        console.error('Dashboard load error:', e);
      }
    }

    // -------------------------------------------------------------
    // 📦 STOCK & INVENTORY (OWNER)
    // -------------------------------------------------------------
    async function loadStock() {
      try {
        const res = await fetch('/api/stock');
        const json = await res.json();
        if (json.success && json.data) {
          allStockItems = json.data;
          renderStockCategoryChips(json.categories || []);
          renderStockList();
        }
      } catch (e) {}
    }

    function renderStockCategoryChips(categories) {
      const container = document.getElementById('stock-category-chips');
      let html = '<button class="date-chip ' + (selectedStockCategory === '' ? 'active' : '') + '" onclick="filterStockCategory(\\'\\')">All Items</button>';
      html += '<button class="date-chip ' + (lowStockOnlyFilter ? 'active' : '') + '" onclick="toggleLowStockOnly()" id="chip-low-stock">⚠️ Low Stock</button>';
      categories.forEach(cat => {
        html += '<button class="date-chip ' + (selectedStockCategory === cat.id ? 'active' : '') + '" onclick="filterStockCategory(\\'' + cat.id + '\\')">' + cat.name + '</button>';
      });
      container.innerHTML = html;
    }

    function filterStockCategory(catId) {
      selectedStockCategory = catId;
      renderStockList();
    }

    function toggleLowStockOnly() {
      lowStockOnlyFilter = !lowStockOnlyFilter;
      renderStockList();
    }

    function handleStockSearch() {
      renderStockList();
    }

    function renderStockList() {
      const q = (document.getElementById('stock-search-input').value || '').toLowerCase().trim();
      let list = allStockItems;

      if (selectedStockCategory) {
        list = list.filter(i => i.category_id === selectedStockCategory);
      }
      if (lowStockOnlyFilter) {
        list = list.filter(i => (i.quantity_on_hand || 0) <= (i.reorder_level || 5));
      }
      if (q) {
        list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.barcode || '').toLowerCase().includes(q) || (i.part_number || '').toLowerCase().includes(q));
      }

      document.getElementById('stock-count-label').innerText = list.length + ' Products Available';

      const container = document.getElementById('stock-list-container');
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No items match the filter.</div>';
        return;
      }

      let html = '';
      list.slice(0, 80).forEach(it => {
        const qty = Number(it.quantity_on_hand) || 0;
        const isLow = qty <= (it.reorder_level || 5);
        const badgeClass = qty <= 0 ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success';
        const badgeText = qty <= 0 ? 'Out of Stock' : isLow ? 'Low Stock: ' + qty : 'In Stock: ' + qty;

        html += '<div class="list-card">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
        html += '    <div style="font-weight: 800; font-size: 13.5px; color: var(--text);">' + it.name + '</div>';
        html += '    <div style="font-weight: 800; font-size: 14.5px; color: var(--primary); font-family: var(--font-mono);">' + fmt(it.retail_price) + '</div>';
        html += '  </div>';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">';
        html += '    <span>' + (it.part_number || it.barcode || 'SKU') + (it.size_variant ? ' • ' + it.size_variant : '') + '</span>';
        html += '    <span class="badge ' + badgeClass + '">' + badgeText + '</span>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    // -------------------------------------------------------------
    // 🛒 SALES & INVOICES (OWNER)
    // -------------------------------------------------------------
    function setInvoiceRangeFilter(range) {
      activeRangeFilter = range;
      ['today', 'yesterday', '7days', 'month'].forEach(r => {
        const el = document.getElementById('inv-range-' + r);
        if (el) el.classList.toggle('active', r === range);
      });
      loadSales();
    }

    async function loadSales() {
      try {
        const res = await fetch('/api/sales?range=' + activeRangeFilter);
        const json = await res.json();
        if (json.success && json.data) {
          allInvoices = json.data;
          renderSalesList();
        }
      } catch (e) {}
    }

    function handleInvoiceSearch() {
      renderSalesList();
    }

    function renderSalesList() {
      const q = (document.getElementById('inv-search-input').value || '').toLowerCase().trim();
      let list = allInvoices;
      if (q) {
        list = list.filter(i => (i.invoice_number || '').toLowerCase().includes(q) || (i.customer_name || '').toLowerCase().includes(q));
      }

      document.getElementById('sales-count-label').innerText = list.length + ' Invoices Found';

      const container = document.getElementById('sales-list-container');
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No sales recorded for this period.</div>';
        return;
      }

      let html = '';
      list.forEach(inv => {
        html += '<div class="list-card" onclick="openInvoiceModalById(\\'' + inv.id + '\\')">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
        html += '    <span style="font-weight: 800; font-size: 12px; color: #0284C7; font-family: var(--font-mono);">' + inv.invoice_number + '</span>';
        html += '    <span style="font-weight: 800; font-size: 15px; color: var(--text); font-family: var(--font-mono);">' + fmt(inv.grand_total) + '</span>';
        html += '  </div>';
        html += '  <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">';
        html += '    <span>' + (inv.customer_name || 'Walk-in Customer') + ' • ' + (inv.date || '') + '</span>';
        html += '    <span class="badge badge-success">' + (inv.payment_method || 'cash').toUpperCase() + '</span>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    async function openInvoiceModalById(invId) {
      try {
        const res = await fetch('/api/invoices/' + invId);
        const json = await res.json();
        if (json.success && json.data) {
          selectedInvoiceForModal = json.data;
          selectedCustomer = { id: json.data.customer_id, name: json.data.customer_name || 'Walk-in Customer', phone: json.data.customer_phone || '' };
          displayCompletedReceipt(json.data);
        }
      } catch (e) {}
    }

    function closeInvoiceModal(e) {
      if (e && e.target !== e.currentTarget) return;
      document.getElementById('invoice-modal').style.display = 'none';
    }

    // -------------------------------------------------------------
    // 🔄 RETURNS (OWNER)
    // -------------------------------------------------------------
    async function loadReturns() {
      try {
        const res = await fetch('/api/returns');
        const json = await res.json();
        if (json.success && json.data) {
          allReturns = json.data;
          renderReturnsList();
        }
      } catch (e) {}
    }

    function renderReturnsList() {
      const container = document.getElementById('returns-list-container');
      const totalRefunds = allReturns.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0);
      document.getElementById('returns-total-amount').innerText = fmt(totalRefunds);
      document.getElementById('returns-count-badge').innerText = allReturns.length + ' Returns';

      if (allReturns.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No returns recorded.</div>';
        return;
      }

      let html = '';
      allReturns.forEach(r => {
        html += '<div class="list-card">';
        html += '  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
        html += '    <span style="font-weight: 800; font-size: 12.5px; color: #DC2626; font-family: var(--font-mono);">' + r.return_number + '</span>';
        html += '    <span style="font-weight: 800; font-size: 14.5px; color: #DC2626; font-family: var(--font-mono);">-' + fmt(r.refund_amount) + '</span>';
        html += '  </div>';
        html += '  <div style="font-size: 11px; color: var(--text-muted);">';
        html += '    <span>Reason: ' + (r.reason || 'Customer Return') + ' • ' + (r.date || '') + '</span>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    // -------------------------------------------------------------
    // 🚚 ONLINE ORDERS (OWNER)
    // -------------------------------------------------------------
    async function loadOrders() {
      try {
        const res = await fetch('/api/orders');
        const json = await res.json();
        if (json.success && json.data) {
          allOrders = json.data;
          renderOrdersList('');
        }
      } catch (e) {}
    }

    function filterOrderStatus(st) {
      ['all', 'pending', 'confirmed', 'dispatched'].forEach(s => {
        const el = document.getElementById('order-chip-' + s);
        if (el) el.classList.toggle('active', (st === '' && s === 'all') || st === s);
      });
      renderOrdersList(st);
    }

    function renderOrdersList(statusFilter) {
      let list = allOrders;
      if (statusFilter) {
        list = list.filter(o => o.status === statusFilter);
      }

      const container = document.getElementById('orders-list-container');
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No online orders matching this filter.</div>';
        return;
      }

      let html = '';
      list.forEach(o => {
        html += '<div class="list-card">';
        html += '  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
        html += '    <strong style="font-size: 13px; color: var(--text);">' + (o.customer_name || 'Online Customer') + '</strong>';
        html += '    <span class="badge badge-info">' + (o.status || 'pending').toUpperCase() + '</span>';
        html += '  </div>';
        html += '  <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">';
        html += '    <span>' + o.invoice_number + ' • ' + fmt(o.grand_total) + '</span>';
        html += '  </div>';
        html += '  <div style="display: flex; gap: 6px;">';
        if (o.status === 'pending') {
          html += '    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 10px;" onclick="updateOrderStatus(\\'' + o.id + '\\', \\'confirmed\\')">Confirm Order</button>';
        } else if (o.status === 'confirmed') {
          html += '    <button class="btn btn-primary" style="padding: 5px 10px; font-size: 10px;" onclick="updateOrderStatus(\\'' + o.id + '\\', \\'dispatched\\')">Mark Dispatched</button>';
        } else if (o.status === 'dispatched') {
          html += '    <button class="btn btn-primary" style="padding: 5px 10px; font-size: 10px;" onclick="updateOrderStatus(\\'' + o.id + '\\', \\'completed\\')">Mark Delivered</button>';
        }
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    async function updateOrderStatus(id, newStatus) {
      try {
        await fetch('/api/orders/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId: id, status: newStatus, userId: currentUser?.id })
        });
        loadOrders();
      } catch (e) {}
    }

    // -------------------------------------------------------------
    // 📈 REPORTS (OWNER)
    // -------------------------------------------------------------
    function setReportRange(r) {
      ['month', '7days', 'today'].forEach(k => {
        const el = document.getElementById('rep-chip-' + k);
        if (el) el.classList.toggle('active', k === r);
      });
      loadReports(r);
    }

    async function loadReports(range) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        let from = todayStr;
        if (range === 'month' || !range) from = todayStr.slice(0, 7) + '-01';
        else if (range === '7days') {
          const d7 = new Date();
          d7.setDate(new Date().getDate() - 6);
          from = d7.toISOString().slice(0, 10);
        }

        const res = await fetch('/api/reports/pnl?from=' + from + '&to=' + todayStr);
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          document.getElementById('rep-revenue').innerText = fmt(p.gross_sales || p.total_revenue || 0);
          document.getElementById('rep-cogs').innerText = '-' + fmt(p.cost_of_goods_sold || 0);
          document.getElementById('rep-gross-profit').innerText = fmt(p.gross_profit || 0);
          document.getElementById('rep-expenses').innerText = '-' + fmt(p.total_expenses || 0);
          document.getElementById('rep-net-profit').innerText = fmt(p.net_profit || 0);
          document.getElementById('rep-margin-badge').innerText = (p.net_margin_pct || 0).toFixed(1) + '% Net Margin';
        }

        const perfRes = await fetch('/api/reports/items-performance?from=' + from + '&to=' + todayStr);
        const perfJson = await perfRes.json();
        if (perfJson.success && perfJson.data) {
          const itemsContainer = document.getElementById('rep-top-items-container');
          let topHtml = '';
          perfJson.data.slice(0, 6).forEach((it, idx) => {
            topHtml += '<div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--card-border); font-size: 12px;">';
            topHtml += '  <div><strong style="color: var(--text);">#' + (idx + 1) + ' ' + it.item_name + '</strong> <span style="color: var(--text-muted);">(' + it.total_qty_sold + ' sold)</span></div>';
            topHtml += '  <div style="font-family: var(--font-mono); color: #059669; font-weight: 700;">' + fmt(it.total_revenue) + '</div>';
            topHtml += '</div>';
          });
          itemsContainer.innerHTML = topHtml || '<div style="color: var(--text-muted); padding: 10px;">No sales data.</div>';
        }
      } catch (e) {}
    }

    // -------------------------------------------------------------
    // 🔒 DAY CLOSE (OWNER)
    // -------------------------------------------------------------
    async function loadDayClosePreview() {
      try {
        const res = await fetch('/api/day-close/preview?date=' + selectedDashboardDate);
        const json = await res.json();
        if (json.success && json.data) {
          const c = json.data;
          expectedCashAmount = c.expected_cash || 0;
          document.getElementById('close-expected-cash').innerText = fmt(expectedCashAmount);
          calcCounted();

          const btn = document.getElementById('btn-submit-dayclose');
          if (c.is_closed) {
            btn.innerText = '✅ Day Already Closed & Locked';
            btn.style.background = '#475569';
            btn.disabled = true;
          } else {
            btn.innerText = '🔒 Sign & Lock Day Close';
            btn.style.background = '';
            btn.disabled = false;
          }
        }
      } catch (e) {}
    }

    function calcCounted() {
      const d5000 = (Number(document.getElementById('d-5000').value) || 0) * 5000;
      const d1000 = (Number(document.getElementById('d-1000').value) || 0) * 1000;
      const d500  = (Number(document.getElementById('d-500').value) || 0) * 500;
      const d100  = (Number(document.getElementById('d-100').value) || 0) * 100;
      const d50   = (Number(document.getElementById('d-50').value) || 0) * 50;
      const d20   = (Number(document.getElementById('d-20').value) || 0) * 20;

      const totalCounted = d5000 + d1000 + d500 + d100 + d50 + d20;
      document.getElementById('close-counted-cash').innerText = fmt(totalCounted);

      const diff = totalCounted - expectedCashAmount;
      const diffEl = document.getElementById('close-diff-val');
      if (diff === 0) {
        diffEl.innerText = 'Rs. 0 (Balanced)';
        diffEl.style.color = '#059669';
      } else if (diff > 0) {
        diffEl.innerText = '+' + fmt(diff) + ' (Over Cash)';
        diffEl.style.color = '#0284C7';
      } else {
        diffEl.innerText = fmt(diff) + ' (Short Cash)';
        diffEl.style.color = '#DC2626';
      }
      return totalCounted;
    }

    async function submitDayCloseRemote() {
      const counted = calcCounted();
      const notes = document.getElementById('close-notes').value;

      if (!confirm('Are you sure you want to CLOSE THE DAY and LOCK all invoices for ' + selectedDashboardDate + '?')) {
        return;
      }

      const btn = document.getElementById('btn-submit-dayclose');
      btn.innerText = 'Locking Day...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/day-close/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDashboardDate,
            counted_cash: counted,
            notes: notes || 'Submitted from Mobile Companion',
            user_id: currentUser ? currentUser.id : 'usr-owner'
          })
        });
        const json = await res.json();
        if (json.success) {
          alert('✅ Day Close successfully signed & locked!');
          loadDashboard();
          loadDayClosePreview();
          if (json.whatsappUrl) {
            window.open(json.whatsappUrl, '_blank');
          }
        } else {
          alert('Error: ' + (json.error || 'Failed to submit Day Close'));
          btn.innerText = '🔒 Sign & Lock Day Close';
          btn.disabled = false;
        }
      } catch (err) {
        alert('Network error submitting Day Close');
        btn.innerText = '🔒 Sign & Lock Day Close';
        btn.disabled = false;
      }
    }

    async function shareWhatsApp() {
      try {
        const res = await fetch('/api/whatsapp/preview?date=' + selectedDashboardDate);
        const json = await res.json();
        if (json.success && json.data && json.data.whatsappUrl) {
          window.open(json.data.whatsappUrl, '_blank');
        } else {
          alert('Could not generate WhatsApp summary.');
        }
      } catch (err) {
        alert('Error sharing on WhatsApp');
      }
    }
  </script>
</body>
</html>`;
}
