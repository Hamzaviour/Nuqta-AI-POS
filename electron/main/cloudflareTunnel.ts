import { spawn, exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

export interface CloudflareCheckResult {
  isInstalled: boolean
  executablePath?: string
  version?: string
  downloadUrl: string
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  platformLabel: string
  brewCommand?: string
}

export interface CloudflareStatus {
  isRunning: boolean
  publicUrl: string | null
  port: number | null
  error: string | null
  executablePath?: string
}

let tunnelProcess: ChildProcess | null = null
let currentPublicUrl: string | null = null
let currentPort: number | null = null
let currentError: string | null = null

/**
 * Get enriched PATH environment containing common installation directories
 * (Essential for macOS Electron where GUI app doesn't inherit full shell PATH)
 */
function getEnrichedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const home = process.env.HOME || ''

  if (process.platform === 'darwin') {
    const extraPaths = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      path.join(home, 'bin'),
      path.join(home, '.local', 'bin'),
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ]
    env.PATH = `${extraPaths.join(':')}:${env.PATH || ''}`
  } else if (process.platform === 'linux') {
    const extraPaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      path.join(home, '.local', 'bin'),
      path.join(home, 'bin')
    ]
    env.PATH = `${extraPaths.join(':')}:${env.PATH || ''}`
  }
  return env
}

/**
 * Common locations where cloudflared might be installed across operating systems
 */
const COMMON_WINDOWS_PATHS = [
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  path.join(process.env.LOCALAPPDATA || '', 'cloudflared', 'cloudflared.exe'),
  path.join(process.env.USERPROFILE || '', 'cloudflared.exe'),
  path.join(process.env.USERPROFILE || '', 'bin', 'cloudflared.exe')
]

const COMMON_MACOS_PATHS = [
  '/opt/homebrew/bin/cloudflared', // Apple Silicon Homebrew
  '/usr/local/bin/cloudflared',    // Intel Homebrew / Standard
  '/usr/bin/cloudflared',
  '/usr/sbin/cloudflared',
  path.join(process.env.HOME || '', 'bin', 'cloudflared'),
  path.join(process.env.HOME || '', '.local', 'bin', 'cloudflared'),
  path.join(process.env.HOME || '', 'go', 'bin', 'cloudflared'),
  path.join(process.env.HOME || '', 'Library', 'Cloudflare', 'cloudflared')
]

const COMMON_LINUX_PATHS = [
  '/usr/local/bin/cloudflared',
  '/usr/bin/cloudflared',
  '/bin/cloudflared',
  path.join(process.env.HOME || '', '.local', 'bin', 'cloudflared'),
  path.join(process.env.HOME || '', 'bin', 'cloudflared')
]

/**
 * Determine official download URL and platform metadata
 */
function getPlatformDownloadInfo(): {
  downloadUrl: string
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  platformLabel: string
  brewCommand?: string
} {
  const platform = (process.platform as 'win32' | 'darwin' | 'linux') || 'win32'
  const arch = process.arch

  if (platform === 'darwin') {
    const isArm = arch === 'arm64'
    return {
      platform: 'darwin',
      arch,
      platformLabel: `macOS (${isArm ? 'Apple Silicon M1/M2/M3/M4' : 'Intel'})`,
      downloadUrl: isArm
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
      brewCommand: 'brew install cloudflared'
    }
  }

  if (platform === 'linux') {
    const isArm = arch === 'arm64'
    return {
      platform: 'linux',
      arch,
      platformLabel: `Linux (${arch})`,
      downloadUrl: isArm
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb'
    }
  }

  // Windows Default
  return {
    platform: 'win32',
    arch,
    platformLabel: 'Windows (64-bit)',
    downloadUrl: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi'
  }
}

/**
 * Check if cloudflared is installed on the system (in PATH or standard directories)
 */
export async function checkCloudflaredInstalled(): Promise<CloudflareCheckResult> {
  const platformInfo = getPlatformDownloadInfo()
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  const env = getEnrichedEnv()

  // 1. Test if `cloudflared` is discoverable in PATH
  const lookupCmd = isWin ? 'where cloudflared' : 'which cloudflared'
  const fromPath = await new Promise<string | null>((resolve) => {
    exec(lookupCmd, { env }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const firstLine = stdout.trim().split(/\r?\n/)[0]
        resolve(firstLine.trim())
      } else {
        resolve(null)
      }
    })
  })

  if (fromPath && fs.existsSync(fromPath)) {
    const version = await getVersionString(fromPath)
    return {
      isInstalled: true,
      executablePath: fromPath,
      version: version || 'Installed',
      ...platformInfo
    }
  }

  // 2. Check known standard paths for the current platform
  const candidatePaths = isWin
    ? COMMON_WINDOWS_PATHS
    : isMac
    ? COMMON_MACOS_PATHS
    : COMMON_LINUX_PATHS

  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      const version = await getVersionString(p)
      return {
        isInstalled: true,
        executablePath: p,
        version: version || 'Installed',
        ...platformInfo
      }
    }
  }

  return {
    isInstalled: false,
    ...platformInfo
  }
}

/**
 * Helper to fetch version string from binary
 */
function getVersionString(exePath: string): Promise<string> {
  return new Promise((resolve) => {
    exec(`"${exePath}" --version`, { env: getEnrichedEnv() }, (err, stdout) => {
      if (!err && stdout) {
        resolve(stdout.trim().split(/\r?\n/)[0])
      } else {
        resolve('')
      }
    })
  })
}

/**
 * Get current tunnel status
 */
export function getCloudflareTunnelStatus(): CloudflareStatus {
  return {
    isRunning: !!tunnelProcess && !!currentPublicUrl,
    publicUrl: currentPublicUrl,
    port: currentPort,
    error: currentError
  }
}

/**
 * Start a Cloudflare Tunnel for the specified local port
 */
export async function startCloudflareTunnel(port: number = 8080): Promise<CloudflareStatus> {
  if (tunnelProcess && currentPublicUrl && currentPort === port) {
    return getCloudflareTunnelStatus()
  }

  stopCloudflareTunnel()

  const check = await checkCloudflaredInstalled()
  if (!check.isInstalled || !check.executablePath) {
    currentError = `Cloudflare Tunnel (cloudflared) is not installed on this ${check.platformLabel || 'system'}.`
    return {
      isRunning: false,
      publicUrl: null,
      port,
      error: currentError
    }
  }

  currentPort = port
  currentError = null
  currentPublicUrl = null

  return new Promise((resolve) => {
    const exe = check.executablePath!
    const args = ['tunnel', '--url', `http://localhost:${port}`]

    console.log(`[Cloudflare] Launching: "${exe}" ${args.join(' ')}`)

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (!currentPublicUrl) {
          currentError = 'Timed out waiting for Cloudflare public URL. Check internet connection.'
        }
        resolve(getCloudflareTunnelStatus())
      }
    }, 25000)

    try {
      tunnelProcess = spawn(exe, args, {
        env: getEnrichedEnv(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (err: any) {
      clearTimeout(timeout)
      currentError = `Failed to spawn cloudflared: ${err.message}`
      resolve(getCloudflareTunnelStatus())
      return
    }

    const processOutput = (data: Buffer) => {
      const text = data.toString()
      console.log(`[Cloudflare Log] ${text.trim()}`)

      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i)
      if (match && match[0]) {
        currentPublicUrl = match[0]
        console.log(`[Cloudflare] ✅ Public Tunnel Established: ${currentPublicUrl}`)

        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(getCloudflareTunnelStatus())
        }
      }
    }

    if (tunnelProcess.stdout) {
      tunnelProcess.stdout.on('data', processOutput)
    }
    if (tunnelProcess.stderr) {
      tunnelProcess.stderr.on('data', processOutput)
    }

    tunnelProcess.on('error', (err) => {
      console.error('[Cloudflare] Process error:', err)
      currentError = err.message
      tunnelProcess = null
      currentPublicUrl = null
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve(getCloudflareTunnelStatus())
      }
    })

    tunnelProcess.on('exit', (code, signal) => {
      console.log(`[Cloudflare] Process exited with code ${code}, signal ${signal}`)
      tunnelProcess = null
      currentPublicUrl = null
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        if (!currentError) currentError = `Process exited unexpectedly with code ${code}`
        resolve(getCloudflareTunnelStatus())
      }
    })
  })
}

/**
 * Stop running Cloudflare Tunnel
 */
export function stopCloudflareTunnel(): void {
  if (tunnelProcess) {
    console.log('[Cloudflare] Stopping active tunnel...')
    try {
      if (process.platform === 'win32' && tunnelProcess.pid) {
        exec(`taskkill /pid ${tunnelProcess.pid} /T /F`, () => {})
      } else if (tunnelProcess.pid) {
        tunnelProcess.kill('SIGTERM')
        const pid = tunnelProcess.pid
        setTimeout(() => {
          try {
            process.kill(pid, 0)
            process.kill(pid, 'SIGKILL')
          } catch (_) {}
        }, 1000)
      }
    } catch (_) {}
    tunnelProcess = null
  }
  currentPublicUrl = null
  currentError = null
}
