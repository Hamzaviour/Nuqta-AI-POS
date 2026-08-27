import http from 'http'
import os from 'os'
import {
  verifyLogin, getAllUsers, calculateDayClose, submitDayClose, isDayClosed,
  getTodayPOSSummary, getInvoicesByDate, getInvoicesByDateRange, getInvoiceById, getSetting,
  getUserById, logAction,
  getAllItems, searchItems, getLowStockItems,
  getAllReturns, getReturnById,
  getOnlineOrders, updateInvoiceStatus,
  getProfitAndLossReport, getFinancialAnalytics, getItemSalesPerformance,
  getAllCategories, getAllBrands, getAllSettings
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
      const info = getMobileServerInfo()
      console.log(`[Master POS Server] Server active and listening at ${info.primaryUrl}`)
      startMasterDiscoveryBeacon(port)
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

  // ---- MULTI-TERMINAL & LAN REAL-TIME SYNC APIS ----

  // 0. Auto-Discovery Ping
  if (pathname === '/api/discovery') {
    setCorsAndHeaders(res)
    res.writeHead(200)
    res.end(JSON.stringify({
      app: 'al-deewan-pos-master',
      name: 'Al-Deewan Master Terminal 1',
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
  if (pathname === '/' || pathname === '/app' || pathname === '/index.html' || pathname === '/dashboard') {
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
      const storeName = getSetting('store_name') || 'Al-Deewan Clothing & Garments'
      const logo = getSetting('receipt_header_logo') || ''
      const phone = getSetting('store_phone') || ''
      const address = getSetting('store_address') || ''
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: { storeName, logo, phone, address } }))
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

    // Find user by PIN
    const users = getAllUsers()
    let matchingUser = null
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

    res.writeHead(200)
    res.end(JSON.stringify({
      success: true,
      token,
      user: {
        id: matchingUser.id,
        name: matchingUser.name,
        username: matchingUser.username,
        role: matchingUser.role,
        canDayClose: matchingUser.perm_day_closing || matchingUser.role === 'owner',
        isOwner: matchingUser.role === 'owner'
      }
    }))
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
// MOBILE SINGLE-PAGE WEB APP (HTML/CSS/JS) — BRIGHT / LIGHT THEME
// -------------------------------------------------------------
function renderMobileAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Al-Deewan POS — Mobile Remote Executive Portal</title>
  <meta name="theme-color" content="#FFFFFF">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
      --primary: #059669;
      --primary-glow: rgba(16, 185, 129, 0.2);
      --primary-gradient: linear-gradient(135deg, #10B981 0%, #059669 100%);
      --accent: #4F46E5;
      --accent-glow: rgba(99, 102, 241, 0.2);
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
        radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 40%);
      background-attachment: fixed;
      touch-action: manipulation;
    }

    /* HEADER */
    .app-header {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--card-border);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      z-index: 50;
      height: 56px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }
    .logo-container { display: flex; align-items: center; gap: 9px; }
    .logo-badge {
      background: var(--primary-gradient);
      color: #fff;
      font-weight: 800;
      font-size: 13px;
      padding: 6px 9px;
      border-radius: 9px;
      box-shadow: 0 2px 8px var(--primary-glow);
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-logo-img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid var(--card-border);
      display: none;
    }
    .logo-title { font-size: 14.5px; font-weight: 800; letter-spacing: -0.3px; color: var(--text); line-height: 1.1; }
    .logo-subtitle { font-size: 10px; color: var(--text-muted); font-weight: 500; }
    .header-actions { display: flex; align-items: center; gap: 6px; }
    .status-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .status-pill.closed { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
    .status-pill.open { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
    .status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .icon-btn {
      background: #F1F5F9;
      border: 1px solid var(--card-border);
      color: var(--text);
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .icon-btn:active { transform: scale(0.92); background: #E2E8F0; }

    /* VIEWPORT CONTAINER */
    .app-viewport {
      flex: 1 1 auto;
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
      max-width: 620px;
      margin: 0 auto;
      padding: 12px 14px calc(72px + env(safe-area-inset-bottom, 0px)) 14px;
      box-sizing: border-box;
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* PIN KEYPAD SCREEN */
    #screen-pin {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px 14px;
      margin: auto auto;
      min-height: auto;
      text-align: center;
    }
    .pin-title { font-size: 20px; font-weight: 800; margin-bottom: 4px; color: var(--text); }
    .pin-desc { font-size: 12.5px; color: var(--text-muted); margin-bottom: 20px; max-width: 270px; line-height: 1.4; }
    .pin-dots { display: flex; gap: 14px; margin-bottom: 22px; }
    .pin-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #CBD5E1;
      background: #FFFFFF;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pin-dot.filled {
      background: var(--primary);
      border-color: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
      transform: scale(1.12);
    }
    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 70px);
      gap: 12px;
      touch-action: manipulation;
    }
    .key-btn {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 24px;
      font-weight: 700;
      font-family: var(--font-mono);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      touch-action: manipulation;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .key-btn:active {
      transform: scale(0.92);
      background: #ECFDF5;
      color: var(--primary);
      border-color: #A7F3D0;
    }

    /* DATE FILTER CHIPS */
    .date-filter-bar {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 6px;
      margin-bottom: 12px;
      scrollbar-width: none;
    }
    .date-filter-bar::-webkit-scrollbar { display: none; }
    .date-chip {
      padding: 6px 12px;
      border-radius: 20px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .date-chip.active {
      background: var(--primary-gradient);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px var(--primary-glow);
    }
    .date-input-custom {
      padding: 5px 8px;
      border-radius: 12px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 11px;
      outline: none;
    }

    /* STAT HERO CARD */
    .stat-hero {
      background: linear-gradient(135deg, #ECFDF5 0%, #EEF2FF 100%);
      border: 1px solid #A7F3D0;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);
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

    /* SEARCH BAR */
    .search-bar {
      width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-family: inherit;
      font-size: 12.5px;
      margin-bottom: 10px;
      outline: none;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .search-bar:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }

    /* INVOICE & ITEM CARDS */
    .list-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 12px 13px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .list-card:active {
      transform: scale(0.98);
      background: #F8FAFC;
      border-color: var(--primary);
    }

    /* BADGES (Bright Pastels) */
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

    /* MODAL / DRAWER */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }
    .modal-sheet {
      background: #FFFFFF;
      border: 1px solid var(--card-border);
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
      width: 100%;
      max-width: 600px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
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
      padding: 10px 14px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary { background: var(--primary-gradient); color: #fff; box-shadow: 0 2px 8px var(--primary-glow); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-secondary { background: #F1F5F9; border: 1px solid var(--card-border); color: var(--text); }
    .btn-whatsapp { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #fff; }

    /* BOTTOM NAV (7 TABS HORIZONTAL SCROLL) */
    .bottom-nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 56px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 6px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      z-index: 50;
      flex-shrink: 0;
      overflow-x: auto;
      scrollbar-width: none;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
    }
    .bottom-nav::-webkit-scrollbar { display: none; }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 9px;
      border: none;
      background: transparent;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .nav-item.active {
      color: var(--primary);
      background: #ECFDF5;
    }
    .nav-icon { font-size: 16px; line-height: 1; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header class="app-header">
    <div class="logo-container">
      <img id="brand-logo-img" class="brand-logo-img" alt="Store Logo" />
      <div id="brand-logo-badge" class="logo-badge">AD</div>
      <div>
        <div class="logo-title" id="header-store-name">Al-Deewan POS</div>
        <div class="logo-subtitle">Executive Mobile Operations</div>
      </div>
    </div>
    <div class="header-actions">
      <div id="header-status" class="status-pill open">
        <span class="status-dot"></span>
        <span id="header-status-text">Terminal 1 (Live)</span>
      </div>
      <button class="icon-btn" onclick="refreshCurrentTab()" title="Refresh Data">🔄</button>
      <button class="icon-btn" onclick="logout()" title="Lock Screen">🔒</button>
    </div>
  </header>

  <!-- VIEWPORT SCROLL WRAPPER -->
  <main id="app-viewport" class="app-viewport">

    <!-- SCREEN 1: PIN LOCK -->
    <div id="screen-pin">
      <div class="pin-title">Owner Security Access</div>
      <div class="pin-desc">Enter your 4-digit Owner/Manager PIN to access the store management hub</div>
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
        <button type="button" class="key-btn" onclick="pressKey(event, 'clr')" style="font-size: 13px; font-weight: 800; color: #F87171; font-family: var(--font);">CLR</button>
        <button type="button" class="key-btn" onclick="pressKey(event, '0')">0</button>
        <button type="button" class="key-btn" onclick="pressKey(event, 'back')" style="font-size: 18px;">⌫</button>
      </div>
      <div id="pin-error" style="color: #F87171; font-size: 12.5px; font-weight: 700; margin-top: 16px; min-height: 18px;"></div>
    </div>

    <!-- SCREEN 2: 📊 DASHBOARD -->
    <div id="screen-dashboard" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" id="dash-chip-today" onclick="setDateFilter('today')">📅 Today</button>
        <button class="date-chip" id="dash-chip-yesterday" onclick="setDateFilter('yesterday')">⚡ Yesterday</button>
        <div style="display: inline-flex; align-items: center; gap: 5px; margin-left: 2px;">
          <input type="date" id="dash-custom-date" class="date-input-custom" onchange="setDateFilter('custom')">
        </div>
      </div>

      <div class="stat-hero">
        <div class="stat-hero-lbl">Gross Invoiced Sales</div>
        <div class="stat-hero-val" id="dash-gross-sales">Rs. 0</div>
        <div class="stat-hero-sub">
          <span id="dash-invoices-count">0 Invoices Issued</span>
          <span id="dash-date" style="font-family: var(--font-mono); font-weight: 700; color: #A7F3D0;">--</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>💰 Money & Payment Breakdown</span>
          <span style="font-size: 9.5px; color: var(--primary);">REAL-TIME</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box" style="border-left: 3px solid #10B981;">
            <div class="stat-box-lbl">💵 Cash in Drawer</div>
            <div class="stat-box-val" style="color: #34D399;" id="dash-drawer-cash">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #6366F1;">
            <div class="stat-box-lbl">📱 JazzCash Wallet</div>
            <div class="stat-box-val" style="color: #818CF8;" id="dash-jazzcash">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #38BDF8;">
            <div class="stat-box-lbl">📱 EasyPaisa Wallet</div>
            <div class="stat-box-val" style="color: #38BDF8;" id="dash-easypaisa">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #F59E0B;">
            <div class="stat-box-lbl">🏦 Bank & Card</div>
            <div class="stat-box-val" style="color: #FBBF24;" id="dash-otherbank">Rs. 0</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>📈 Profit & Financial Health</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box" style="border-left: 3px solid #10B981;">
            <div class="stat-box-lbl">✨ Net Profit (Realized)</div>
            <div class="stat-box-val" style="color: #34D399;" id="dash-net-profit">Rs. 0</div>
          </div>
          <div class="stat-box" style="border-left: 3px solid #EF4444;">
            <div class="stat-box-lbl">📉 Operating Expenses</div>
            <div class="stat-box-val" style="color: #F87171;" id="dash-expenses">Rs. 0</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-lbl">🔄 Customer Returns</div>
            <div class="stat-box-val" style="color: #FBBF24;" id="dash-returns">Rs. 0</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-lbl">⏳ Khata / Unpaid</div>
            <div class="stat-box-val" style="color: #94A3B8;" id="dash-unpaid">Rs. 0</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SCREEN 3: 📦 STOCK / INVENTORY -->
    <div id="screen-stock" class="main-container" style="display: none;">
      <input type="text" id="stock-search-input" class="search-bar" placeholder="🔍 Search stock by item name, barcode, part #..." oninput="handleStockSearch()" />
      
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

    <!-- SCREEN 4: 🛒 SALES & INVOICES -->
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

    <!-- SCREEN 5: 🔄 CUSTOMER RETURNS -->
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

    <!-- SCREEN 6: 🚚 ONLINE & DELIVERY ORDERS -->
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

    <!-- SCREEN 7: 📈 REPORTS & FINANCIAL ANALYTICS -->
    <div id="screen-reports" class="main-container" style="display: none;">
      <div class="date-filter-bar">
        <button class="date-chip active" id="rep-chip-month" onclick="setReportRange('month')">This Month</button>
        <button class="date-chip" id="rep-chip-7days" onclick="setReportRange('7days')">Last 7 Days</button>
        <button class="date-chip" id="rep-chip-today" onclick="setReportRange('today')">Today</button>
      </div>

      <!-- Profit & Loss Card -->
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

      <!-- Top Selling Products Leaderboard -->
      <div class="card">
        <div class="card-title">
          <span>🏆 Top Selling Products</span>
        </div>
        <div id="rep-top-items-container">
          <!-- Top items injected here -->
        </div>
      </div>
    </div>

    <!-- SCREEN 8: 🔒 DAY CLOSE RECONCILIATION -->
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

  <!-- INVOICE RECEIPT MODAL DRAWER -->
  <div id="invoice-modal" class="modal-backdrop" style="display: none;" onclick="closeInvoiceModal(event)">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="sheet-header">
        <div>
          <div style="font-weight: 800; color: var(--text); font-size: 14px;" id="modal-inv-num">Invoice #</div>
          <div style="font-size: 10.5px; color: var(--text-muted);" id="modal-inv-date">Date & Time</div>
        </div>
        <button class="icon-btn" onclick="closeInvoiceModal()">✕</button>
      </div>
      <div class="sheet-body">
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: var(--text-muted);">CUSTOMER:</div>
          <strong id="modal-inv-customer" style="font-size: 13px; color: var(--text);">Walk-in Customer</strong>
        </div>
        <div id="modal-inv-items" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Item rows injected here -->
        </div>
        <div style="border-top: 1px solid var(--card-border); margin-top: 12px; padding-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Grand Total:</span>
            <strong id="modal-inv-total" style="font-family: var(--font-mono); font-size: 15px; color: var(--primary);">Rs. 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Amount Paid:</span>
            <span id="modal-inv-paid" style="font-family: var(--font-mono); color: var(--text);">Rs. 0</span>
          </div>
        </div>
      </div>
      <div class="sheet-footer">
        <button class="btn btn-whatsapp" style="flex: 1;" onclick="shareInvoiceCustomerWhatsApp()">
          📲 Send Bill on WhatsApp
        </button>
      </div>
    </div>
  </div>

  <!-- FIXED BOTTOM NAVIGATION BAR -->
  <nav class="bottom-nav" id="bottom-nav" style="display: none;">
    <button class="nav-item active" id="nav-dashboard" onclick="switchTab('dashboard')">
      <span class="nav-icon">📊</span>
      <span>Dashboard</span>
    </button>
    <button class="nav-item" id="nav-stock" onclick="switchTab('stock')">
      <span class="nav-icon">📦</span>
      <span>Stock</span>
    </button>
    <button class="nav-item" id="nav-sales" onclick="switchTab('sales')">
      <span class="nav-icon">🛒</span>
      <span>Sales</span>
    </button>
    <button class="nav-item" id="nav-returns" onclick="switchTab('returns')">
      <span class="nav-icon">🔄</span>
      <span>Returns</span>
    </button>
    <button class="nav-item" id="nav-orders" onclick="switchTab('orders')">
      <span class="nav-icon">🚚</span>
      <span>Orders</span>
    </button>
    <button class="nav-item" id="nav-reports" onclick="switchTab('reports')">
      <span class="nav-icon">📈</span>
      <span>Reports</span>
    </button>
    <button class="nav-item" id="nav-dayclose" onclick="switchTab('dayclose')">
      <span class="nav-icon">🔒</span>
      <span>Day Close</span>
    </button>
  </nav>

  <!-- JAVASCRIPT APP LOGIC -->
  <script>
    let enteredPin = '';
    let authToken = localStorage.getItem('aldeewan_mobile_token') || '';
    let currentUser = null;
    let currentTab = 'dashboard';
    let selectedDashboardDate = new Date().toISOString().slice(0, 10);
    let allStockItems = [];
    let selectedStockCategory = '';
    let lowStockOnlyFilter = false;
    let allInvoices = [];
    let activeRangeFilter = 'today';
    let allReturns = [];
    let allOrders = [];
    let selectedInvoiceForModal = null;
    let expectedCashAmount = 0;

    function fmt(num) {
      const val = Number(num) || 0;
      return 'Rs. ' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // Auto-login or show PIN screen
    window.addEventListener('DOMContentLoaded', () => {
      loadStoreInfo();
      if (authToken) {
        unlockApp();
      } else {
        showPinScreen();
      }
    });

    async function loadStoreInfo() {
      try {
        const res = await fetch('/api/store-info');
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.storeName) {
            document.getElementById('header-store-name').innerText = json.data.storeName;
          }
          if (json.data.logo) {
            const img = document.getElementById('brand-logo-img');
            img.src = json.data.logo;
            img.style.display = 'block';
            document.getElementById('brand-logo-badge').style.display = 'none';
          }
        }
      } catch (_) {}
    }

    function showPinScreen() {
      document.getElementById('screen-pin').style.display = 'flex';
      ['dashboard', 'stock', 'sales', 'returns', 'orders', 'reports', 'dayclose'].forEach(s => {
        const el = document.getElementById('screen-' + s);
        if (el) el.style.display = 'none';
      });
      document.getElementById('bottom-nav').style.display = 'none';
      enteredPin = '';
      updatePinDots();
    }

    function unlockApp() {
      document.getElementById('screen-pin').style.display = 'none';
      document.getElementById('bottom-nav').style.display = 'flex';
      switchTab('dashboard');
    }

    function pressKey(e, key) {
      if (e) e.preventDefault();
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
      localStorage.removeItem('aldeewan_mobile_token');
      showPinScreen();
    }

    function switchTab(tab) {
      currentTab = tab;
      ['dashboard', 'stock', 'sales', 'returns', 'orders', 'reports', 'dayclose'].forEach(s => {
        const screen = document.getElementById('screen-' + s);
        const nav = document.getElementById('nav-' + s);
        if (screen) screen.style.display = (s === tab) ? 'block' : 'none';
        if (nav) nav.classList.toggle('active', s === tab);
      });

      refreshCurrentTab();
    }

    function refreshCurrentTab() {
      if (currentTab === 'dashboard') loadDashboard();
      else if (currentTab === 'stock') loadStock();
      else if (currentTab === 'sales') loadSales();
      else if (currentTab === 'returns') loadReturns();
      else if (currentTab === 'orders') loadOrders();
      else if (currentTab === 'reports') loadReports();
      else if (currentTab === 'dayclose') loadDayClosePreview();
    }

    /* 📊 DASHBOARD */
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

    /* 📦 STOCK / INVENTORY */
    async function loadStock() {
      try {
        const res = await fetch('/api/stock');
        const json = await res.json();
        if (json.success && json.data) {
          allStockItems = json.data;
          renderStockCategoryChips(json.categories || []);
          renderStockList();
        }
      } catch (e) {
        console.error('Stock load error:', e);
      }
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
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No items match the search filter.</div>';
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
        html += '    <span>' + (it.part_number || it.barcode || 'SKU') + '</span>';
        html += '    <span class="badge ' + badgeClass + '">' + badgeText + '</span>';
        html += '  </div>';
        html += '</div>';
      });

      container.innerHTML = html;
    }

    /* 🛒 SALES / INVOICES */
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
      } catch (e) {
        console.error('Sales load error:', e);
      }
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
        html += '<div class="list-card" onclick="openInvoiceModal(\\'' + inv.id + '\\')">';
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

    async function openInvoiceModal(invId) {
      try {
        const res = await fetch('/api/invoices/' + invId);
        const json = await res.json();
        if (json.success && json.data) {
          selectedInvoiceForModal = json.data;
          const inv = json.data;
          document.getElementById('modal-inv-num').innerText = inv.invoice_number;
          document.getElementById('modal-inv-date').innerText = (inv.date || '') + ' ' + (inv.datetime_created ? inv.datetime_created.slice(11,16) : '');
          document.getElementById('modal-inv-customer').innerText = inv.customer_name || 'Walk-in Customer';
          document.getElementById('modal-inv-total').innerText = fmt(inv.grand_total);
          document.getElementById('modal-inv-paid').innerText = fmt(inv.amount_paid);

          const itemsContainer = document.getElementById('modal-inv-items');
          let itemsHtml = '';
          if (inv.items) {
            inv.items.forEach(it => {
              itemsHtml += '<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--card-border); font-size: 12px;">';
              itemsHtml += '  <div><strong style="color: var(--text);">' + it.item_name + '</strong> <span style="color: var(--text-muted);">(' + it.qty + 'x)</span></div>';
              itemsHtml += '  <div style="font-family: var(--font-mono); color: var(--text);">' + fmt(it.line_total) + '</div>';
              itemsHtml += '</div>';
            });
          }
          itemsContainer.innerHTML = itemsHtml;
          document.getElementById('invoice-modal').style.display = 'flex';
        }
      } catch (e) {}
    }

    function closeInvoiceModal() {
      document.getElementById('invoice-modal').style.display = 'none';
      selectedInvoiceForModal = null;
    }

    function shareInvoiceCustomerWhatsApp() {
      if (!selectedInvoiceForModal) return;
      const inv = selectedInvoiceForModal;
      let text = '🧾 *AL-DEEWAN POS — RECEIPT*\\n' +
                 'Invoice #: *' + inv.invoice_number + '*\\n' +
                 'Date: ' + inv.date + '\\n' +
                 'Customer: ' + (inv.customer_name || 'Valued Customer') + '\\n' +
                 '━━━━━━━━━━━━━━━━━━━━\\n';
      if (inv.items) {
        inv.items.forEach(it => {
          text += '• ' + it.item_name + ' (' + it.qty + 'x) = ' + fmt(it.line_total) + '\\n';
        });
      }
      text += '━━━━━━━━━━━━━━━━━━━━\\n' +
              '*Total Amount:* ' + fmt(inv.grand_total) + '\\n' +
              '*Amount Paid:* ' + fmt(inv.amount_paid) + '\\n\\n' +
              '_Thank you for shopping with us!_';

      const phone = (inv.customer_phone || '').replace(/[^0-9]/g, '');
      const url = phone 
        ? 'https://api.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(text)
        : 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
    }

    /* 🔄 RETURNS */
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
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px 10px;">No returns recorded yet.</div>';
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

    /* 🚚 ONLINE ORDERS */
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

    /* 📈 REPORTS */
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

    /* 🔒 DAY CLOSE */
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
        diffEl.style.color = '#34D399';
      } else if (diff > 0) {
        diffEl.innerText = '+' + fmt(diff) + ' (Over Cash)';
        diffEl.style.color = '#38BDF8';
      } else {
        diffEl.innerText = fmt(diff) + ' (Short Cash)';
        diffEl.style.color = '#F87171';
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
