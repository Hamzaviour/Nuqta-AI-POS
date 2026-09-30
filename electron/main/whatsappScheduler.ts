import { shell, Notification } from 'electron'
import { getSetting, setSetting, calculateDayClose, isDayClosed } from '../database/db'

export interface WhatsAppConfig {
  ownerPhone: string
  autoCloseTime: string // "22:00"
  autoCloseEnabled: boolean
  sendOnDayClose: boolean
  lastSentDate?: string
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  ownerPhone: '',
  autoCloseTime: '22:00',
  autoCloseEnabled: true,
  sendOnDayClose: true
}

let schedulerTimer: NodeJS.Timeout | null = null
let lastSentDate: string = ''

/**
 * Get current WhatsApp configuration from database settings
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  try {
    const ownerPhone = getSetting('owner_whatsapp_number') || ''
    const autoCloseTime = getSetting('whatsapp_auto_close_time') || '22:00'
    const autoCloseEnabled = getSetting('whatsapp_auto_close_enabled') !== '0'
    const sendOnDayClose = getSetting('whatsapp_send_on_day_close') !== '0'
    const savedLastSent = getSetting('whatsapp_last_sent_date') || ''

    return {
      ownerPhone,
      autoCloseTime,
      autoCloseEnabled,
      sendOnDayClose,
      lastSentDate: savedLastSent || lastSentDate
    }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Error getting config:', err)
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * Save WhatsApp configuration into database settings
 */
export function saveWhatsAppConfig(config: Partial<WhatsAppConfig>): { success: boolean; error?: string } {
  try {
    if (config.ownerPhone !== undefined) {
      // Clean phone number: remove spaces, dashes, parentheses
      const clean = config.ownerPhone.replace(/[^\d+]/g, '')
      setSetting('owner_whatsapp_number', clean)
    }
    if (config.autoCloseTime !== undefined) {
      setSetting('whatsapp_auto_close_time', config.autoCloseTime)
    }
    if (config.autoCloseEnabled !== undefined) {
      setSetting('whatsapp_auto_close_enabled', config.autoCloseEnabled ? '1' : '0')
    }
    if (config.sendOnDayClose !== undefined) {
      setSetting('whatsapp_send_on_day_close', config.sendOnDayClose ? '1' : '0')
    }
    return { success: true }
  } catch (err: any) {
    console.error('[WhatsApp Scheduler] Error saving config:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

const fmtCurrency = (n: number) =>
  `Rs. ${Math.round(n).toLocaleString('en-PK')}`

/**
 * Generate a clean, beautifully formatted WhatsApp summary message
 */
export function formatDayCloseWhatsAppMessage(dateStr?: string): { message: string; date: string; phone: string; whatsappUrl: string } {
  const date = dateStr || new Date().toISOString().slice(0, 10)
  const calc = calculateDayClose(date)
  const isClosed = isDayClosed(date)
  const config = getWhatsAppConfig()

  // Format date nicely (e.g., 24 Aug 2026)
  const dateObj = new Date(date + 'T12:00:00')
  const formattedDate = dateObj.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  // Format time of generation
  const nowTime = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  const cleanPhone = (config.ownerPhone || '').replace(/[^\d]/g, '')

  const lines = [
    `📊 *NUQTA AI POS — DAILY CLOSING REPORT*`,
    `🏪 *Branch:* Main Wholesale Outlet`,
    `📅 *Date:* ${formattedDate} (${nowTime})`,
    `🔒 *Status:* ${isClosed ? '✅ Closed & Locked' : '⏳ Open / Provisional'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Gross Sales:* ${fmtCurrency(calc.total_sales)}`,
    `🏷️ *Discounts Given:* ${fmtCurrency(calc.total_discounts)}`,
    `🔄 *Returns / Refunds:* ${fmtCurrency(calc.total_returns)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💳 *PAYMENT METHOD BREAKDOWN*`,
    `💵 Physical Cash Collected: ${fmtCurrency(calc.cash_sales)}`,
    `📱 JazzCash: ${fmtCurrency(calc.jazzcash_sales || 0)}`,
    `📲 EasyPaisa: ${fmtCurrency(calc.easypaisa_sales || 0)}`,
    `🏦 Bank Transfers: ${fmtCurrency(calc.other_bank_sales || 0)}`,
    `💳 Card Swipes: ${fmtCurrency(calc.card_sales)}`,
    `✨ *Total Collected:* ${fmtCurrency(calc.total_collected || 0)}`,
    (calc.total_unpaid || 0) > 0 ? `⚠️ *Unpaid / Credit Due:* ${fmtCurrency(calc.total_unpaid || 0)}` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📉 *Operating Expenses:* ${fmtCurrency(calc.total_expenses || 0)}`,
    `📈 *Net Profit Recognized:* ${fmtCurrency(calc.total_profit)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏦 *DRAWER RECONCILIATION*`,
    `🎯 Expected Drawer Cash: ${fmtCurrency(calc.expected_cash)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Generated automatically by Nuqta AI POS_`
  ].filter(Boolean)

  const message = lines.join('\n')

  // Generate WhatsApp Click-to-Send URL
  const whatsappUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`

  return {
    message,
    date,
    phone: config.ownerPhone,
    whatsappUrl
  }
}

/**
 * Dispatch WhatsApp notification to owner
 */
export async function sendWhatsAppDayClose(dateStr?: string, forceManual: boolean = false): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const config = getWhatsAppConfig()
    const { message, whatsappUrl, phone } = formatDayCloseWhatsAppMessage(dateStr)

    if (!phone && !forceManual) {
      return { success: false, url: whatsappUrl, error: 'No owner WhatsApp number configured in Maintenance.' }
    }

    // Open WhatsApp Web or WhatsApp Desktop URL
    await shell.openExternal(whatsappUrl)

    // Show desktop notification
    if (Notification.isSupported()) {
      new Notification({
        title: '📱 WhatsApp Day Close Dispatched',
        body: `Day close summary for ${dateStr || 'today'} prepared for ${phone || 'Owner'}.`
      }).show()
    }

    const today = (dateStr || new Date().toISOString().slice(0, 10))
    lastSentDate = today
    setSetting('whatsapp_last_sent_date', today)

    return { success: true, url: whatsappUrl }
  } catch (err: any) {
    console.error('[WhatsApp Scheduler] Dispatch failed:', err)
    return { success: false, url: '', error: err?.message || String(err) }
  }
}

/**
 * Initialize Background Automated WhatsApp Scheduler (runs once every 60 seconds)
 */
export function startWhatsAppScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
  }

  console.log('[WhatsApp Scheduler] Starting automated daily check...')

  // Check every 60 seconds
  schedulerTimer = setInterval(() => {
    try {
      const config = getWhatsAppConfig()
      if (!config.autoCloseEnabled || !config.ownerPhone) return

      const now = new Date()
      const currentHours = String(now.getHours()).padStart(2, '0')
      const currentMinutes = String(now.getMinutes()).padStart(2, '0')
      const currentTimeStr = `${currentHours}:${currentMinutes}`
      const todayStr = now.toISOString().slice(0, 10)

      // Target time configured by owner (e.g. "22:00")
      const targetTime = config.autoCloseTime || '22:00'

      // Check if current minute matches target time and hasn't been sent yet today
      if (currentTimeStr === targetTime && config.lastSentDate !== todayStr && lastSentDate !== todayStr) {
        console.log(`[WhatsApp Scheduler] Scheduled time reached (${targetTime}). Sending Day Close Summary for ${todayStr}...`)
        sendWhatsAppDayClose(todayStr, false)
      }
    } catch (err) {
      console.error('[WhatsApp Scheduler] Background check error:', err)
    }
  }, 60000)
}

/**
 * Stop Background Scheduler on App Exit
 */
export function stopWhatsAppScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
