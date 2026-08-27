import { getSetting, setSetting } from '../database/db'
import https from 'https'
import http from 'http'
import { URL } from 'url'

// Groq API key can be set in settings or via environment variable
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || ''

export interface LLMInventoryItem {
  id: string
  name: string
  part_number?: string // SKU
  barcode?: string
  retail_price: number
  quantity_on_hand?: number
  category_name?: string
  brand_name?: string
}

export interface LLMCartItem {
  id: string
  item_id: string
  name: string
  part_number?: string
  qty: number
  unit_price: number
  line_total: number
}

export interface LLMCustomer {
  id: string
  name: string
  phone?: string
  current_balance?: number
}

export interface LLMVoicePayload {
  transcript: string
  catalog: LLMInventoryItem[]
  cart: LLMCartItem[]
  customers: LLMCustomer[]
  canEditPrice: boolean
}

export interface LLMPOSResult {
  intent:
    | 'ADD_ITEM'
    | 'ADD_MULTI'
    | 'SET_PRICE'
    | 'UPDATE_QTY'
    | 'REMOVE_ITEM'
    | 'SET_CUSTOMER'
    | 'CREATE_CUSTOMER'
    | 'SET_DISCOUNT'
    | 'SET_PAYMENT'
    | 'CLEAR_CART'
    | 'HOLD_BILL'
    | 'CONFIRM_PROCEED'
    | 'REVIEW_INVOICE'
    | 'CHECK_STOCK'
    | 'CANCEL_DISCARD'
    | 'UNKNOWN'
  items?: Array<{
    item_id?: string
    sku?: string
    name?: string
    quantity: number
    unit_price?: number
  }>
  target_cart_row?: number // row number 1, 2, 3... if user said "item no 1", "row 2", "pehli item"
  target_cart_item_id?: string
  target_cart_sku?: string
  new_quantity?: number
  quantity_delta?: number // e.g. +2 (2 aur dalo) or -1 (1 kam kardo)
  new_price?: number
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  discount_amount?: number
  discount_pct?: number
  payment_method?: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial'
  bank_provider?: 'JazzCash' | 'EasyPaisa' | 'Other Bank'
  amount_paid?: number
  spoken_response?: string
  language?: 'en' | 'ur'
}

/**
 * Execute HTTP/HTTPS POST request to an OpenAI-compatible chat completions endpoint
 */
function sendChatCompletionRequest(
  endpointUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.1
): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(endpointUrl)
      const isHttps = parsedUrl.protocol === 'https:'
      const transport = isHttps ? https : http

      // Check if any message mentions JSON
      const hasJsonKeyword = messages.some(m => /json/i.test(m.content))
      
      const payloadObj: any = {
        model,
        messages,
        temperature
      }
      if (hasJsonKeyword) {
        payloadObj.response_format = { type: 'json_object' }
      }

      const postData = JSON.stringify(payloadObj)

      const options: https.RequestOptions = {
        method: 'POST',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        headers: {
          'Authorization': `Bearer ${apiKey || 'any'}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Al-Deewan-POS-LLM-Engine/1.0'
        },
        timeout: 15000
      }

      const req = transport.request(options, (res) => {
        let responseText = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { responseText += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseText)
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const content = parsed.choices?.[0]?.message?.content
              if (content) {
                // Remove markdown code fences if model returned ```json ... ```
                const cleanJson = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                const jsonResult = JSON.parse(cleanJson)
                resolve({ success: true, data: jsonResult })
              } else {
                resolve({ success: false, error: 'Empty content from LLM response' })
              }
            } else {
              const errMsg = parsed.error?.message || responseText
              resolve({ success: false, error: `API error (Status ${res.statusCode}): ${errMsg}` })
            }
          } catch (e: any) {
            resolve({ success: false, error: `Parse error on LLM response: ${e.message}. Raw: ${responseText.slice(0, 200)}` })
          }
        })
      })

      req.on('error', (err) => {
        resolve({ success: false, error: `Network error: ${err.message}` })
      })

      req.on('timeout', () => {
        req.destroy()
        resolve({ success: false, error: 'LLM request timed out (15s)' })
      })

      req.write(postData)
      req.end()
    } catch (err: any) {
      resolve({ success: false, error: `Request creation failed: ${err.message}` })
    }
  })
}

/**
 * Check if local or remote OmniRoute server is reachable and fetch available models
 */
export async function checkOmniRouteServer(
  customBaseUrl?: string
): Promise<{
  isRunning: boolean
  baseUrl: string
  dashboardUrl: string
  models: string[]
  error?: string
}> {
  let base = (customBaseUrl || getSetting('voice_llm_base_url') || 'http://localhost:20128/v1').trim()
  base = base.replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) {
    base = base.replace(/\/chat\/completions$/, '')
  }
  if (!base.endsWith('/v1')) {
    base = base + '/v1'
  }

  const modelsUrl = `${base}/models`
  const dashboardUrl = base.replace(/\/v1$/, '')

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(modelsUrl)
      const isHttps = parsedUrl.protocol === 'https:'
      const transport = isHttps ? https : http

      const options: https.RequestOptions = {
        method: 'GET',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        headers: {
          'Authorization': 'Bearer any',
          'User-Agent': 'Al-Deewan-POS-LLM-Engine/1.0'
        },
        timeout: 3000
      }

      const req = transport.request(options, (res) => {
        let responseText = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { responseText += chunk })
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(responseText)
              const modelList: string[] = []
              if (Array.isArray(parsed.data)) {
                parsed.data.forEach((m: any) => {
                  if (m.id) modelList.push(m.id)
                })
              }
              resolve({
                isRunning: true,
                baseUrl: base,
                dashboardUrl,
                models: modelList
              })
            } else {
              resolve({
                isRunning: false,
                baseUrl: base,
                dashboardUrl,
                models: [],
                error: `OmniRoute returned status ${res.statusCode}: ${responseText.slice(0, 100)}`
              })
            }
          } catch (err: any) {
            resolve({
              isRunning: false,
              baseUrl: base,
              dashboardUrl,
              models: [],
              error: `Invalid response from OmniRoute: ${err.message}`
            })
          }
        })
      })

      req.on('error', (err) => {
        resolve({
          isRunning: false,
          baseUrl: base,
          dashboardUrl,
          models: [],
          error: `Could not connect to OmniRoute at ${base} (${err.message}). Make sure OmniRoute is started on port 20128.`
        })
      })

      req.on('timeout', () => {
        req.destroy()
        resolve({
          isRunning: false,
          baseUrl: base,
          dashboardUrl,
          models: [],
          error: `Connection to OmniRoute at ${base} timed out (3s).`
        })
      })

      req.end()
    } catch (e: any) {
      resolve({
        isRunning: false,
        baseUrl: base,
        dashboardUrl,
        models: [],
        error: e.message
      })
    }
  })
}

/**
 * Resolve provider config from database settings
 */
export function getLLMConfig(): {
  provider: 'groq' | 'omniroute' | 'openai' | 'custom'
  apiKey: string
  endpoint: string
  model: string
} {
  const provider = (getSetting('voice_llm_provider') || 'groq').toLowerCase() as 'groq' | 'omniroute' | 'openai' | 'custom'
  let apiKey = getSetting('voice_llm_api_key') || getSetting('voice_stt_api_key') || ''
  let customBaseUrl = getSetting('voice_llm_base_url') || ''
  let model = getSetting('voice_llm_model') || ''

  if (provider === 'groq') {
    apiKey = apiKey.trim() || DEFAULT_GROQ_KEY
    return {
      provider: 'groq',
      apiKey,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: model.trim() || 'openai/gpt-oss-120b'
    }
  }

  if (provider === 'omniroute') {
    let base = customBaseUrl.trim() || 'http://localhost:20128/v1'
    if (!base.endsWith('/chat/completions')) {
      base = base.replace(/\/+$/, '') + '/chat/completions'
    }
    return {
      provider: 'omniroute',
      apiKey: apiKey.trim() || 'any',
      endpoint: base,
      model: model.trim() || 'openrouter/z-ai/glm-5.2:free-high'
    }
  }

  if (provider === 'openai') {
    return {
      provider: 'openai',
      apiKey: apiKey.trim(),
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: model.trim() || 'gpt-4o-mini'
    }
  }

  // Custom provider
  let base = customBaseUrl.trim() || 'http://localhost:20128/v1'
  if (!base.endsWith('/chat/completions')) {
    base = base.replace(/\/+$/, '') + '/chat/completions'
  }
  return {
    provider: 'custom',
    apiKey: apiKey.trim() || 'any',
    endpoint: base,
    model: model.trim() || 'default'
  }
}

/**
 * Process a voice transcript using LLM Intelligence with real stock context
 */
export async function processVoiceCommandWithLLM(
  payload: LLMVoicePayload
): Promise<{
  success: boolean
  result?: LLMPOSResult
  provider?: string
  model?: string
  latencyMs?: number
  isFallback?: boolean
  error?: string
}> {
  const startTime = Date.now()
  try {
    const config = getLLMConfig()
    if (!config.apiKey && config.provider !== 'groq' && config.provider !== 'omniroute') {
      return {
        success: false,
        error: `No API key configured for provider "${config.provider}"`,
        provider: config.provider,
        model: config.model,
        latencyMs: 0
      }
    }

    // Prepare compact catalog representation (limit to top 150 active items to stay fast and within context)
    const compactCatalog = payload.catalog.slice(0, 150).map(i => ({
      id: i.id,
      name: i.name,
      sku: i.part_number || '',
      price: i.retail_price,
      cost_price: (i as any).cost_price ?? 0,
      stock: i.quantity_on_hand ?? 0
    }))

    const compactCart = payload.cart.map((c, idx) => ({
      row: idx + 1,
      cart_item_id: c.id,
      item_id: c.item_id,
      name: c.name,
      sku: c.part_number || '',
      qty: c.qty,
      unit_price: c.unit_price,
      line_total: c.line_total
    }))

    const compactCustomers = payload.customers.slice(0, 60).map(cu => ({
      id: cu.id,
      name: cu.name,
      phone: cu.phone || '',
      balance: cu.current_balance || 0
    }))

    const systemPrompt = `You are the AI Intelligence Engine for Al-Deewan POS System (a clothing & retail shop in Pakistan).
The cashier/owner speaks or types commands in English, Urdu (اردو), or Roman Urdu (e.g. "2 SKU 101 add kardo", "101 ki price 1800 kardo", "Ali customer banao 03001234567", "Proceed").

Your job:
Analyze the user utterance, match against the given Inventory Catalog, Current Cart, and Customers list, and return ONLY a valid JSON object matching this schema.

AVAILABLE INVENTORY (SKU / Part Number is primary):
${JSON.stringify(compactCatalog)}

CURRENT ACTIVE CART:
${JSON.stringify(compactCart)}

CUSTOMERS LIST:
${JSON.stringify(compactCustomers)}

SCHEMA:
{
  "intent": "ADD_ITEM" | "ADD_MULTI" | "SET_PRICE" | "UPDATE_QTY" | "REMOVE_ITEM" | "SET_CUSTOMER" | "CREATE_CUSTOMER" | "SET_DISCOUNT" | "SET_PAYMENT" | "CLEAR_CART" | "HOLD_BILL" | "CONFIRM_PROCEED" | "REVIEW_INVOICE" | "CHECK_STOCK" | "CANCEL_DISCARD" | "UNKNOWN",
  "items": [
    {
      "item_id": "id from inventory",
      "sku": "sku code",
      "name": "item name",
      "quantity": 1,
      "unit_price": 2500 // custom unit price if specified by user, otherwise omit
    }
  ],
  "target_cart_row": 1, // integer row number (1, 2, 3...) if user refers to "item no 1", "item 1", "row 2", "pehli item"
  "target_cart_item_id": "cart_item_id from cart if modifying/removing",
  "target_cart_sku": "sku of item in cart",
  "new_quantity": 5, // absolute qty if user said "make qty 5"
  "quantity_delta": 2, // positive (+2 for "2 aur dalo") or negative (-1 for "1 kam kardo")
  "new_price": 1800, // if changing price
  "customer_id": "id if matching existing customer",
  "customer_name": "customer name",
  "customer_phone": "mobile number",
  "discount_amount": 100, // if flat discount Rs.
  "discount_pct": 10, // if percentage discount %
  "payment_method": "cash" | "card" | "bank" | "split" | "credit" | "partial",
  "bank_provider": "JazzCash" | "EasyPaisa" | "Other Bank",
  "amount_paid": 5000,
  "spoken_response": "ALWAYS in natural Roman Urdu (e.g. '3 Zellbury cart mein shamil hogaye aur customer Hamza set hogaya.')",
  "language": "ur"
}

RULES:
1. QUANTITY vs SKU EXTRACTION (CRITICAL):
   - ALWAYS look up AVAILABLE INVENTORY to identify the exact SKU codes (e.g. "101", "502", "786").
   - When user says numbers before or after an item/SKU:
     * "2 SKU 101" or "2 101 add kardo" -> quantity: 2, sku: "101". (Do NOT combine numbers into "2101"!).
     * "SKU 101 ke 3 add kardo" or "101 ke 3 piece" -> quantity: 3, sku: "101".
     * "3 Zellbury 7000 mein" -> quantity: 3, name: "Zellbury", unit_price: 7000.
     * "teen 101" or "do 502" -> quantity: 3 (or 2), sku: "101" (or "502").
     * "101 add kardo" -> quantity: 1, sku: "101".
   - The "quantity" field inside the items array MUST be an integer number (e.g. 1, 2, 3, 5).
2. CRITICAL RESPONSE LANGUAGE: The "spoken_response" MUST ALWAYS BE IN NATURAL ROMAN URDU (English alphabet Urdu, e.g. "Item cart mein shamil hogayi hai", "Zellbury ka stock 15 units mojood hai", "Price 1800 kardi gayi hai"). Never output pure English or Arabic/Urdu script for spoken_response.
3. If the user asks about stock availability or quantity (e.g. "yeh item kitni available hai", "stock kitna hai", "SKU 101 kitna pada hai", "Zellbury kitni available hai", "is Zellbury in stock?", "yeh kitna hai"), set intent = "CHECK_STOCK", populate items[0] with the matched product from AVAILABLE INVENTORY, and provide a Roman Urdu "spoken_response" stating the stock on hand and price (e.g. "Zellbury (SKU: 101) ka total stock 15 units available hai. Price Rs. 2,500 hai.").
4. COMPOUND FULL BILL COMMANDS: If the user gives a full bill command in one sentence (e.g. "3 zellbury krdo with price 7000 and customer name is hamza" or "2 SKU 101 2500 customer Ali cash paid"), set intent = "ADD_ITEM", set items (qty: 3, unit_price: 7000 / 2500), and populate "customer_name": "hamza" (and "customer_id" if matching an existing customer in CUSTOMERS LIST). If customer is NOT mentioned, leave customer fields null/undefined so POS automatically uses Walk-in Customer.
5. If the user refers to an item by its row / Sr / item number (e.g. "item no 1 ki price 1800 kardo", "item no 1 ko delete kardo", "item no 1 mai 1 aur add krdo", "row 2", "pehli item", "dusri item", "aakhri item"), set "target_cart_row" to the corresponding row number in CURRENT ACTIVE CART (1 for row 1, 2 for row 2, etc.).
6. For relative quantity changes (e.g. "2 aur dalo", "2 more", "1 aur add krdo"), set "quantity_delta": 2 (or 1). For reductions ("1 kam karo"), set "quantity_delta": -1.
7. For custom prices in add command (e.g. "2 SKU 101 2500 mein add kardo"), set items[0].unit_price = 2500.
8. COST PRICE CONSTRAINT: Items must not be sold below their cost_price. If a custom price requested by the user is less than the item's cost_price, the POS system blocks addition.
9. Return ONLY valid JSON format. No markdown backticks, no markdown text outside JSON.`

    const userPrompt = `User Spoken Command: "${payload.transcript}"`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    console.log(`[LLMService] Dispatching command to ${config.provider} (${config.model}): "${payload.transcript}"`)

    let res = await sendChatCompletionRequest(
      config.endpoint,
      config.apiKey,
      config.model,
      messages,
      0.1
    )

    let usedProvider = config.provider
    let usedModel = config.model
    let isFallback = false

    // If primary provider failed (e.g. OmniRoute 429 rate limit or offline), auto-fallback to Groq openai/gpt-oss-120b
    if (!res.success && config.provider !== 'groq') {
      console.warn(`[LLMService] Primary provider ${config.provider} (${config.model}) failed (${res.error}). Attempting Groq fallback...`)
      const groqRes = await sendChatCompletionRequest(
        'https://api.groq.com/openai/v1/chat/completions',
        DEFAULT_GROQ_KEY,
        'openai/gpt-oss-120b',
        messages,
        0.1
      )
      if (groqRes.success && groqRes.data) {
        res = groqRes
        usedProvider = 'groq'
        usedModel = 'openai/gpt-oss-120b (Auto-Fallback)'
        isFallback = true
      }
    }

    const latencyMs = Date.now() - startTime

    if (res.success && res.data) {
      console.log(`[LLMService] Successfully parsed with ${usedProvider} (${usedModel}) in ${latencyMs}ms:`, JSON.stringify(res.data))
      return {
        success: true,
        result: res.data as LLMPOSResult,
        provider: usedProvider,
        model: usedModel,
        latencyMs,
        isFallback
      }
    } else {
      console.warn('[LLMService] LLM call failed:', res.error)
      return {
        success: false,
        error: res.error || 'LLM execution failed',
        provider: config.provider,
        model: config.model,
        latencyMs
      }
    }
  } catch (err: any) {
    console.error('[LLMService] Exception during LLM processing:', err)
    return {
      success: false,
      error: err.message || 'Unknown LLM error',
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Test connection to an LLM provider endpoint
 */
export async function testLLMConnection(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const startTime = Date.now()
  try {
    let endpoint = 'https://api.groq.com/openai/v1/chat/completions'
    let targetModel = model?.trim() || 'openai/gpt-oss-120b'
    let key = apiKey?.trim() || (provider === 'groq' ? DEFAULT_GROQ_KEY : provider === 'omniroute' ? 'any' : '')

    if (provider === 'omniroute') {
      let b = baseUrl?.trim() || 'http://localhost:20128/v1'
      if (!b.endsWith('/chat/completions')) b = b.replace(/\/+$/, '') + '/chat/completions'
      endpoint = b
      targetModel = model?.trim() || 'openrouter/z-ai/glm-5.2:free-high'
    } else if (provider === 'openai') {
      endpoint = 'https://api.openai.com/v1/chat/completions'
      targetModel = model?.trim() || 'gpt-4o-mini'
    } else if (provider === 'custom') {
      let b = baseUrl?.trim() || 'http://localhost:20128/v1'
      if (!b.endsWith('/chat/completions')) b = b.replace(/\/+$/, '') + '/chat/completions'
      endpoint = b
      targetModel = model?.trim() || 'default'
    }

    if (!key && provider !== 'groq' && provider !== 'omniroute') {
      return { success: false, message: 'Please provide an API key.', latencyMs: 0 }
    }

    const messages = [
      { role: 'system', content: 'You are a test assistant. Respond in valid JSON format: {"status": "ok", "message": "connected"}' },
      { role: 'user', content: 'Respond with status ok JSON' }
    ]

    const res = await sendChatCompletionRequest(endpoint, key, targetModel, messages, 0.1)
    const latency = Date.now() - startTime

    if (res.success) {
      return {
        success: true,
        message: `Successfully connected to ${provider.toUpperCase()} (${targetModel}) in ${latency}ms!`,
        latencyMs: latency
      }
    } else {
      return {
        success: false,
        message: res.error || 'Connection test failed',
        latencyMs: latency
      }
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Exception during connection test',
      latencyMs: Date.now() - startTime
    }
  }
}
