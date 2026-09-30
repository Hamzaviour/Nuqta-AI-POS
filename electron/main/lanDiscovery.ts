import dgram from 'dgram'
import http from 'http'
import { getLocalIpAddresses } from './mobileServer'

const DISCOVERY_PORT = 41234
let broadcastTimer: NodeJS.Timeout | null = null
let broadcastSocket: dgram.Socket | null = null

/**
 * Start UDP Broadcast beacon on Master Server
 */
export function startMasterDiscoveryBeacon(serverPort: number = 8080): void {
  stopMasterDiscoveryBeacon()

  try {
    broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    broadcastSocket.bind(() => {
      broadcastSocket?.setBroadcast(true)
      console.log(`[LAN Discovery] Master UDP Beacon active on port ${DISCOVERY_PORT}`)

      const sendBeacon = () => {
        const localIps = getLocalIpAddresses()
        const message = Buffer.from(
          JSON.stringify({
            app: 'al-deewan-pos-master',
            port: serverPort,
            ips: localIps,
            name: 'Master Terminal 1',
            timestamp: Date.now()
          })
        )

        // Broadcast to LAN subnet
        broadcastSocket?.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
          if (err) {
            // Ignore broadcast send errors (e.g. network interface changes)
          }
        })
      }

      sendBeacon()
      broadcastTimer = setInterval(sendBeacon, 3000)
    })

    broadcastSocket.on('error', (err) => {
      console.warn('[LAN Discovery] Socket warning:', err.message)
    })
  } catch (err) {
    console.warn('[LAN Discovery] Failed to bind discovery socket:', err)
  }
}

/**
 * Stop Master UDP Beacon
 */
export function stopMasterDiscoveryBeacon(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer)
    broadcastTimer = null
  }
  if (broadcastSocket) {
    try {
      broadcastSocket.close()
    } catch (_) {}
    broadcastSocket = null
  }
}

export interface DiscoveredMaster {
  ip: string
  port: number
  url: string
  name: string
  latencyMs: number
}

/**
 * Scan for Master Server on Local Network (UDP listener + HTTP subnet probe)
 */
export function scanForMasterServer(timeoutMs: number = 3000): Promise<DiscoveredMaster[]> {
  return new Promise((resolve) => {
    const discovered = new Map<string, DiscoveredMaster>()
    let isFinished = false

    // 1. Listen for UDP broadcast
    let listenerSocket: dgram.Socket | null = null
    try {
      listenerSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      listenerSocket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString())
          if (data.app === 'al-deewan-pos-master') {
            const masterUrl = `http://${rinfo.address}:${data.port || 8080}`
            if (!discovered.has(masterUrl)) {
              discovered.set(masterUrl, {
                ip: rinfo.address,
                port: data.port || 8080,
                url: masterUrl,
                name: data.name || 'Master Server',
                latencyMs: 1
              })
            }
          }
        } catch (_) {}
      })

      listenerSocket.bind(DISCOVERY_PORT, () => {
        // Listening
      })
    } catch (_) {}

    // 2. HTTP Subnet Probe on local interfaces
    const localIps = getLocalIpAddresses()
    const probePromises: Promise<void>[] = []

    for (const myIp of localIps) {
      if (myIp === '127.0.0.1') continue
      const prefix = myIp.split('.').slice(0, 3).join('.')
      // Test common gateway/server IPs: .1, .100, .101, .105, .108, .110, .2, .3, .4, .5
      const candidateHostIds = [1, 2, 3, 4, 5, 10, 20, 50, 100, 101, 102, 105, 108, 110, 150, 200]
      for (const hostId of candidateHostIds) {
        const targetIp = `${prefix}.${hostId}`
        probePromises.push(
          new Promise<void>((resProbe) => {
            const reqStart = Date.now()
            const req = http.get(
              `http://${targetIp}:8080/api/discovery`,
              { timeout: 900 },
              (res) => {
                if (res.statusCode === 200) {
                  let body = ''
                  res.on('data', (c) => (body += c))
                  res.on('end', () => {
                    try {
                      const data = JSON.parse(body)
                      if (data.app === 'al-deewan-pos-master') {
                        const url = `http://${targetIp}:8080`
                        discovered.set(url, {
                          ip: targetIp,
                          port: 8080,
                          url,
                          name: data.name || 'Master Server',
                          latencyMs: Date.now() - reqStart
                        })
                      }
                    } catch (_) {}
                    resProbe()
                  })
                } else {
                  resProbe()
                }
              }
            )
            req.on('error', () => resProbe())
            req.on('timeout', () => {
              req.destroy()
              resProbe()
            })
          })
        )
      }
    }

    // Finish when timeout expires
    setTimeout(() => {
      if (isFinished) return
      isFinished = true
      if (listenerSocket) {
        try {
          listenerSocket.close()
        } catch (_) {}
      }
      resolve(Array.from(discovered.values()))
    }, timeoutMs)
  })
}
