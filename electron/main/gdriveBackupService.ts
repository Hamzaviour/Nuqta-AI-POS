import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import dns from 'dns'
import { app } from 'electron'
import { getSetting, setSetting, logAction } from '../database/db'

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

let schedulerTimer: NodeJS.Timeout | null = null
let isBackingUp = false

/**
 * Check if the machine has active internet/Wi-Fi connection
 */
export function checkInternetAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup('www.google.com', (err) => {
      if (!err) {
        resolve(true)
      } else {
        // Fallback to checking googleapis.com or cloudflare
        dns.lookup('cloudflare.com', (err2) => {
          resolve(!err2)
        })
      }
    })
  })
}

/**
 * Get current Google Drive auto-backup configuration and status
 */
export async function getGDriveConfig(): Promise<GDriveConfig> {
  const enabled = getSetting('gdrive_backup_enabled') === '1'
  const webhookUrl = getSetting('gdrive_webhook_url') || ''
  const folderName = getSetting('gdrive_folder_name') || 'POS Backups'
  const frequencyDays = parseInt(getSetting('gdrive_frequency_days') || '7', 10) || 7
  const rawLastTime = getSetting('gdrive_last_backup_time')
  const lastBackupTime = rawLastTime ? parseInt(rawLastTime, 10) : null
  const lastStatus = (getSetting('gdrive_last_status') || 'idle') as GDriveConfig['lastStatus']
  const lastMessage = getSetting('gdrive_last_message') || null

  const isOnline = await checkInternetAccess()

  let nextBackupTime: number | null = null
  if (lastBackupTime) {
    nextBackupTime = lastBackupTime + frequencyDays * 24 * 60 * 60 * 1000
  } else if (enabled) {
    nextBackupTime = Date.now() // Overdue / immediate
  }

  return {
    enabled,
    webhookUrl,
    folderName,
    frequencyDays,
    lastBackupTime,
    lastStatus,
    lastMessage,
    nextBackupTime,
    isOnline
  }
}

/**
 * Save Google Drive backup configuration
 */
export async function saveGDriveConfig(config: Partial<GDriveConfig>): Promise<void> {
  if (config.enabled !== undefined) {
    setSetting('gdrive_backup_enabled', config.enabled ? '1' : '0')
  }
  if (config.webhookUrl !== undefined) {
    setSetting('gdrive_webhook_url', config.webhookUrl.trim())
  }
  if (config.folderName !== undefined) {
    setSetting('gdrive_folder_name', config.folderName.trim())
  }
  if (config.frequencyDays !== undefined) {
    setSetting('gdrive_frequency_days', String(config.frequencyDays))
  }

  // Restart scheduler with new config
  startGDriveScheduler()
}

/**
 * Perform a Google Drive backup upload now
 */
export async function performGDriveBackup(requestingUserId?: string): Promise<{ success: boolean; message: string; timestamp: number }> {
  if (isBackingUp) {
    return { success: false, message: 'A backup upload is already in progress.', timestamp: Date.now() }
  }

  const webhookUrl = getSetting('gdrive_webhook_url') || ''
  if (!webhookUrl) {
    return { success: false, message: 'Google Drive Webhook URL is not configured. Please set up your Google Apps Script URL in settings.', timestamp: Date.now() }
  }

  // Check Wi-Fi / Internet access first
  const hasInternet = await checkInternetAccess()
  if (!hasInternet) {
    return { success: false, message: 'No internet connection detected. The system will automatically upload to Google Drive as soon as Wi-Fi/Internet is available.', timestamp: Date.now() }
  }

  isBackingUp = true
  setSetting('gdrive_last_status', 'running')
  const startTime = Date.now()

  try {
    const dbPath = path.join(app.getPath('userData'), 'aldeewan-pos.db')
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found on disk.')
    }

    const fileBuffer = fs.readFileSync(dbPath)
    const base64Data = fileBuffer.toString('base64')
    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2)
    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `pos-backup-${dateStr}-${Date.now().toString().slice(-4)}.db`
    const folderName = getSetting('gdrive_folder_name') || 'POS Backups'

    const payload = JSON.stringify({
      filename: fileName,
      fileData: base64Data,
      mimeType: 'application/x-sqlite3',
      folderName,
      fileSizeBytes: fileBuffer.length,
      createdAt: new Date().toISOString(),
      storeName: 'POS System'
    })

    console.log(`[GDrive Backup] Uploading snapshot (${fileSizeMB} MB) to Google Drive...`)

    const uploadRes = await uploadToWebhook(webhookUrl, payload)

    const finishTime = Date.now()
    setSetting('gdrive_last_backup_time', String(finishTime))
    setSetting('gdrive_last_status', 'success')
    const msg = `Successfully uploaded backup snapshot (${fileSizeMB} MB) to Google Drive folder "${folderName}".`
    setSetting('gdrive_last_message', msg)

    if (requestingUserId) {
      logAction(requestingUserId, 'GDRIVE_BACKUP', 'system', null, { fileName, sizeMB: fileSizeMB, durationMs: finishTime - startTime })
    }

    console.log(`[GDrive Backup] Backup complete in ${finishTime - startTime}ms:`, msg)
    isBackingUp = false
    return { success: true, message: msg, timestamp: finishTime }
  } catch (err: any) {
    const finishTime = Date.now()
    const errMsg = err.message || 'Google Drive upload failed'
    console.error('[GDrive Backup] Upload failed:', err)
    setSetting('gdrive_last_status', 'failed')
    setSetting('gdrive_last_message', errMsg)
    isBackingUp = false
    return { success: false, message: errMsg, timestamp: finishTime }
  }
}

/**
 * Upload payload to Google Apps Script Webhook endpoint (following redirects)
 */
function uploadToWebhook(urlStr: string, jsonPayload: string, maxRedirects: number = 5): Promise<any> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while uploading to Google Drive.'))
    }

    const parsedUrl = new URL(urlStr)
    const isHttps = parsedUrl.protocol === 'https:'
    const client = isHttps ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonPayload)
      },
      timeout: 120000 // 2 minutes timeout for large database uploads
    }

    const req = client.request(options, (res) => {
      // Handle Google 302/307 Redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, urlStr).toString()
        }
        return resolve(uploadToWebhook(redirectUrl, jsonPayload, maxRedirects - 1))
      }

      let responseBody = ''
      res.on('data', (chunk) => (responseBody += chunk))
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(responseBody)
            resolve(json)
          } catch (_) {
            resolve({ raw: responseBody })
          }
        } else {
          reject(new Error(`Google Drive returned HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error(`Network error uploading to Google Drive: ${err.message}`))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Google Drive upload timed out after 2 minutes.'))
    })

    req.write(jsonPayload)
    req.end()
  })
}

/**
 * Test Google Drive connection with a lightweight ping
 */
export async function testGDriveConnection(webhookUrl?: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const targetUrl = webhookUrl?.trim() || getSetting('gdrive_webhook_url') || ''
  if (!targetUrl) {
    return { success: false, message: 'Please enter a Google Drive Webhook URL to test.', latencyMs: 0 }
  }

  const isOnline = await checkInternetAccess()
  if (!isOnline) {
    return { success: false, message: 'No internet connection detected on this PC.', latencyMs: 0 }
  }

  const start = Date.now()
  try {
    const testPayload = JSON.stringify({
      isTestPing: true,
      timestamp: Date.now(),
      storeName: 'POS System Test'
    })

    await uploadToWebhook(targetUrl, testPayload)
    const latencyMs = Date.now() - start
    return { success: true, message: `Connected to Google Drive Webhook successfully (${latencyMs}ms)!`, latencyMs }
  } catch (err: any) {
    return { success: false, message: `Google Drive test failed: ${err.message}`, latencyMs: Date.now() - start }
  }
}

/**
 * Start the background Wi-Fi & Weekly Google Drive auto-backup scheduler
 */
export function startGDriveScheduler(): void {
  stopGDriveScheduler()

  const checkSchedule = async () => {
    try {
      const enabled = getSetting('gdrive_backup_enabled') === '1'
      const webhookUrl = getSetting('gdrive_webhook_url')
      if (!enabled || !webhookUrl) return

      const frequencyDays = parseInt(getSetting('gdrive_frequency_days') || '7', 10) || 7
      const rawLastTime = getSetting('gdrive_last_backup_time')
      const lastBackupTime = rawLastTime ? parseInt(rawLastTime, 10) : 0
      const now = Date.now()
      const intervalMs = frequencyDays * 24 * 60 * 60 * 1000

      // Check if backup is due
      const isDue = now - lastBackupTime >= intervalMs

      if (isDue && !isBackingUp) {
        const hasInternet = await checkInternetAccess()
        if (hasInternet) {
          console.log('[GDrive Scheduler] Weekly backup is due and Wi-Fi/Internet is online. Triggering auto-backup...')
          await performGDriveBackup('system_scheduler')
        } else {
          console.log('[GDrive Scheduler] Weekly backup is due but system is currently offline. Will auto-retry once Wi-Fi is connected.')
        }
      }
    } catch (e) {
      console.warn('[GDrive Scheduler] Error during periodic check:', e)
    }
  }

  // Check every 15 minutes
  schedulerTimer = setInterval(checkSchedule, 15 * 60 * 1000)
  // Run initial check 10 seconds after startup
  setTimeout(checkSchedule, 10000)
}

/**
 * Stop Google Drive scheduler
 */
export function stopGDriveScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
