/**
 * Multi-Terminal Network Sync Adapter
 * Seamlessly routes IPC vs LAN RPC calls depending on whether this system
 * is configured as Master Node (Main Windows PC) or Satellite Client (Win / Mac)
 */

export interface TerminalConfig {
  mode: 'master' | 'client'
  terminalId: string
  terminalName: string
  masterUrl: string
  autoDiscover: boolean
}

const STORAGE_KEY = 'aldeewan_terminal_config'

/**
 * Get current terminal identity and network mode
 */
export function getTerminalConfig(): TerminalConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        mode: parsed.mode || 'master',
        terminalId: parsed.terminalId || 'T-01',
        terminalName: parsed.terminalName || 'Main Counter (Master)',
        masterUrl: parsed.masterUrl || 'http://127.0.0.1:8080',
        autoDiscover: parsed.autoDiscover ?? true
      }
    }
  } catch (_) {}

  return {
    mode: 'master',
    terminalId: 'T-01',
    terminalName: 'Main Counter (Master)',
    masterUrl: 'http://127.0.0.1:8080',
    autoDiscover: true
  }
}

/**
 * Save terminal identity and network mode
 */
export function saveTerminalConfig(cfg: Partial<TerminalConfig>): TerminalConfig {
  const current = getTerminalConfig()
  const updated = { ...current, ...cfg }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('aldeewan:terminal-config-changed', { detail: updated }))
  return updated
}

// -------------------------------------------------------------
// REAL-TIME SYNCHRONIZATION EVENT STREAM & HEARTBEAT
// -------------------------------------------------------------
let eventSourceInstance: EventSource | null = null
let heartbeatTimer: any = null

export function initTerminalSync(): void {
  const config = getTerminalConfig()

  // Clean previous connections
  if (eventSourceInstance) {
    eventSourceInstance.close()
    eventSourceInstance = null
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  // Only satellite clients need to connect back to Master SSE stream
  if (config.mode === 'client' && config.masterUrl) {
    const sseUrl = `${config.masterUrl.replace(/\/+$/, '')}/api/events`
    try {
      eventSourceInstance = new EventSource(sseUrl)
      eventSourceInstance.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          window.dispatchEvent(new CustomEvent('aldeewan:sync-event', { detail: data }))
        } catch (_) {}
      }

      eventSourceInstance.onerror = () => {
        // Auto reconnect handled by browser EventSource
      }
    } catch (_) {}

    // Send satellite terminal heartbeat every 10s
    const sendHeartbeat = async () => {
      try {
        await fetch(`${config.masterUrl.replace(/\/+$/, '')}/api/terminals/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminalId: config.terminalId,
            terminalName: config.terminalName,
            os: navigator.userAgent.includes('Mac') ? 'macOS' : 'Windows'
          })
        })
      } catch (_) {}
    }

    sendHeartbeat()
    heartbeatTimer = setInterval(sendHeartbeat, 10000)
  }
}

/**
 * Execute RPC Call over LAN (for Satellite Client) or local Electron IPC (for Master)
 */
export async function callRpc<T = any>(action: string, args: any[] = []): Promise<T> {
  const config = getTerminalConfig()

  // 1. If running on Master, use local IPC directly
  if (config.mode === 'master' || !config.masterUrl) {
    // Map action to window.api if available
    const api = (window as any).api
    if (api) {
      // Find matching method name
      return await executeLocalApi(action, args)
    }
  }

  // 2. If running as Satellite Client, send high-speed LAN HTTP POST
  const endpoint = `${config.masterUrl.replace(/\/+$/, '')}/api/rpc`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        args,
        terminalId: config.terminalId,
        terminalName: config.terminalName,
        os: navigator.userAgent.includes('Mac') ? 'macOS' : 'Windows'
      })
    })

    if (!res.ok) {
      throw new Error(`Master Server HTTP ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()
    return data as T
  } catch (err: any) {
    console.error(`[LAN RPC] Error calling ${action} on Master at ${endpoint}:`, err)
    throw new Error(`Master Connection Error (${err.message})`)
  }
}

/**
 * Helper to dispatch local IPC calls
 */
async function executeLocalApi(channel: string, args: any[]): Promise<any> {
  const api = (window as any).api
  if (!api) return null

  // Fast mapping for common actions
  switch (channel) {
    case 'auth:login': return api.login(args[0], args[1])
    case 'auth:get-all-users-for-login': return api.getUsersForLogin()
    case 'items:get-all': return api.getAllItems()
    case 'items:search': return api.searchItems(args[0])
    case 'items:by-barcode': return api.getItemByBarcode(args[0])
    case 'invoices:create': return api.createInvoice(args[0], args[1])
    case 'invoices:get-by-id': return api.getInvoiceById(args[0])
    case 'invoices:get-by-date': return api.getInvoicesByDate(args[0])
    case 'invoices:get-by-range': return api.getInvoicesByRange(args[0], args[1], args[2], args[3], args[4], args[5])
    case 'customers:get-all': return api.getAllCustomers()
    case 'settings:get-all': return api.getAllSettings()
    default:
      // Fallback
      return null
  }
}
