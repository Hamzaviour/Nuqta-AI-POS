import { getSetting } from '../database/db'
import https from 'https'
import http from 'http'
import { URL } from 'url'

// Groq API key can be set in settings or via environment variable
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || ''

// Common Whisper silence hallucinations when receiving quiet room noise
const SILENCE_HALLUCINATIONS = [
  'thank you', 'thank you.', 'thank you!', 'thank you so much', 'thank you very much',
  'thanks for watching', 'thanks for watching!', 'thanks for watching.',
  'you', 'you.', 'you!', 'bye', 'bye.', 'bye!', 'goodbye',
  'subtitles by', 'subtitled by', 'watching', 'please subscribe', 'subscribe',
  'shukriya', 'shukriya.', 'شکریہ', 'آپ کا شکریہ'
]

function isWhisperSilenceHallucination(text: string): boolean {
  const norm = text.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/gi, '').trim()
  return SILENCE_HALLUCINATIONS.some(h => norm === h.replace(/[^a-z0-9\u0600-\u06FF\s]/gi, '').trim())
}

/**
 * Transcribe recorded audio buffer using high-performance Whisper AI (Groq or OpenAI)
 */
export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  mimeType: string = 'audio/wav',
  language: string = 'auto'
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    if (!audioBuffer || audioBuffer.length < 1200) {
      return { success: false, error: 'Audio recording was too short' }
    }

    const userApiKey = getSetting('voice_stt_api_key') || ''
    const apiKey = userApiKey.trim() || DEFAULT_GROQ_KEY
    const isGroq = !apiKey.startsWith('sk-proj-') && !apiKey.startsWith('sk-none-')

    // Determine target API endpoint
    const endpoint = isGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions'

    const modelName = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1'

    // Determine file extension and content type
    let ext = 'wav'
    let cleanMime = 'audio/wav'

    if (mimeType.includes('webm')) {
      ext = 'webm'
      cleanMime = 'audio/webm'
    } else if (mimeType.includes('wav')) {
      ext = 'wav'
      cleanMime = 'audio/wav'
    } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      ext = 'm4a'
      cleanMime = 'audio/m4a'
    } else if (mimeType.includes('ogg')) {
      ext = 'ogg'
      cleanMime = 'audio/ogg'
    } else if (mimeType.includes('mp3')) {
      ext = 'mp3'
      cleanMime = 'audio/mp3'
    }

    const boundary = '----VoicePOSBoundary' + Math.random().toString(36).substring(2)
    const crlf = '\r\n'

    // Build multipart/form-data payload
    const postDataHeader: Buffer[] = []

    // 1. Model field
    postDataHeader.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="model"${crlf}${crlf}` +
      `${modelName}${crlf}`
    ))

    // 2. Language field (if specified)
    const targetLang = language === 'ur' ? 'ur' : language === 'en' ? 'en' : ''
    if (targetLang) {
      postDataHeader.push(Buffer.from(
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="language"${crlf}${crlf}` +
        `${targetLang}${crlf}`
      ))
    }

    // 3. Prompt context for POS domain terminology
    const posPrompt = 'POS, clothing, lawn, suit, kurta, cotton, dettol, surf excel, lux, discount, cash, jazzcash, easypaisa, rupay, proceed, dalo, bill'
    postDataHeader.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="prompt"${crlf}${crlf}` +
      `${posPrompt}${crlf}`
    ))

    // 4. File field header
    postDataHeader.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="file"; filename="speech.${ext}"${crlf}` +
      `Content-Type: ${cleanMime}${crlf}${crlf}`
    ))

    const footer = Buffer.from(`${crlf}--${boundary}--${crlf}`)
    const fullBody = Buffer.concat([...postDataHeader, audioBuffer, footer])

    const parsedUrl = new URL(endpoint)
    const options: https.RequestOptions = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + (parsedUrl.search || ''),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'User-Agent': 'POS-Voice-Engine/1.0'
      },
      timeout: 12000
    }

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseText = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { responseText += chunk })
        res.on('end', () => {
          try {
            const data = JSON.parse(responseText)
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const rawText = (data.text || '').trim()
              if (!rawText || isWhisperSilenceHallucination(rawText)) {
                console.log('[SpeechService] Filtered silence hallucination:', rawText)
                resolve({ success: false, error: 'No speech detected' })
              } else {
                console.log('[SpeechService] Transcribed text:', rawText)
                resolve({ success: true, text: rawText })
              }
            } else {
              const errMsg = data.error?.message || responseText
              console.warn('[SpeechService] API response error:', res.statusCode, errMsg)
              resolve({ success: false, error: errMsg })
            }
          } catch (parseErr) {
            console.warn('[SpeechService] Parse error on response:', responseText)
            resolve({ success: false, error: `Invalid response from speech API (Status ${res.statusCode}): ${responseText}` })
          }
        })
      })

      req.on('error', (err) => {
        console.warn('[SpeechService] Network request error:', err)
        resolve({ success: false, error: `Network error connecting to speech API: ${err.message}` })
      })

      req.on('timeout', () => {
        req.destroy()
        resolve({ success: false, error: 'Speech transcription timed out (12s)' })
      })

      req.write(fullBody)
      req.end()
    })
  } catch (err: any) {
    console.error('[SpeechService] Transcribe exception:', err)
    return { success: false, error: err?.message || 'Unknown transcription error' }
  }
}
