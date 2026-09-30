/**
 * Nuqta AI POS — Production-Grade Voice POS Agent
 * 
 * Multi-Language Natural Language Understanding (English, Roman Urdu, & Urdu Script),
 * Robust Phonetic & Fuzzy Product Matching, Conversational Context Memory,
 * Flexible Number Parsing, Price Updates, and Confirmation Gate.
 */

import type { Item, Customer, CartItem, VoiceIntent, VoiceParsedCommand, VoiceItemEntity } from '../types'

// ============================================================
// URDU SCRIPT DIGITS & CHARACTER NORMALIZATION
// ============================================================

const URDU_TO_LATIN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
}

/**
 * Normalize Arabic/Urdu Unicode characters and digits to standard form
 */
export function normalizeUrduCharacters(text: string): string {
  if (!text) return ''
  return text
    // Normalize Eastern Arabic / Urdu digits
    .replace(/[۰-۹٠-٩]/g, d => URDU_TO_LATIN_DIGITS[d] || d)
    // Normalize common Arabic/Urdu character variants
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ہ')
    .replace(/ؤ/g, 'و')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel/diacritics
    .trim()
}

// ============================================================
// NUMBER NORMALIZER (ENGLISH, ROMAN URDU, & URDU SCRIPT)
// ============================================================

const WORD_TO_NUMBER: Record<string, number> = {
  // English digits & teens
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'million': 1000000,

  // Roman Urdu numbers
  'sifar': 0, 'aik': 1, 'ek': 1, 'do': 2, 'teen': 3, 'tin': 3,
  'char': 4, 'chaar': 4, 'panch': 5, 'paanch': 5, 'che': 6, 'chhay': 6, 'chhe': 6,
  'saat': 7, 'sat': 7, 'aath': 8, 'ath': 8, 'nau': 9, 'no': 9,
  'dus': 10, 'das': 10, 'gyarah': 11, 'barah': 12, 'terah': 13,
  'chaudah': 14, 'pandrah': 15, 'pandra': 15, 'solah': 16, 'satrah': 17, 'atharah': 18,
  'unnees': 19, 'unnis': 19, 'bees': 20, 'bis': 20, 'ikkees': 21,
  'baees': 22, 'teees': 23, 'chobees': 24, 'pachees': 25, 'chhabees': 26,
  'sattaees': 27, 'atthaees': 28, 'untees': 29, 'tees': 30,
  'paintees': 35, 'chalees': 40, 'paintalees': 45, 'pachaas': 50, 'pachas': 50,
  'saath': 60, 'sath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90,
  'sau': 100, 'so': 100, 'hazar': 1000, 'hazaar': 1000, 'lakh': 100000, 'laakh': 100000,
  'crore': 10000000, 'cror': 10000000,

  // Urdu Script Numbers
  'صفر': 0, 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7, 'آٹھ': 8, 'نو': 9, 'دس': 10,
  'گیارہ': 11, 'بارہ': 12, 'تیرہ': 13, 'چودہ': 14, 'پندرہ': 15, 'سولہ': 16, 'سترہ': 17, 'اٹھارہ': 18, 'انیس': 19,
  'بیس': 20, 'اکیس': 21, 'بائیس': 22, 'تیئیس': 23, 'چوبیس': 24, 'پچیس': 25, 'چھبیس': 26, 'ستائیس': 27, 'اٹھائیس': 28, 'انتیس': 29,
  'تیس': 30, 'پینتیس': 35, 'چالیس': 40, 'پینتالیس': 45, 'پچاس': 50, 'ساٹھ': 60, 'ستر': 70, 'اسی': 80, 'نوے': 90,
  'سو': 100, 'سیکڑہ': 100, 'ہزار': 1000, 'لاکھ': 100000, 'کروڑ': 10000000
}

/**
 * Parse verbal numbers in English, Roman Urdu, or Urdu Script into a numeric value
 */
export function parseSpokenNumber(text: string): number | null {
  if (!text) return null
  let cleaned = normalizeUrduCharacters(text).toLowerCase().trim()

  // 1. Direct digits / float check (e.g. "850", "2.5", "1,500", "2k")
  const kMatch = cleaned.match(/^([\d.]+)\s*k$/i)
  if (kMatch) {
    const v = parseFloat(kMatch[1])
    return isNaN(v) ? null : Math.round(v * 1000)
  }

  const numericDirect = cleaned.replace(/,/g, '')
  if (/^\d+(\.\d+)?$/.test(numericDirect)) {
    const parsed = parseFloat(numericDirect)
    return isNaN(parsed) ? null : parsed
  }

  // 2. Common compound Urdu colloquial expressions (Roman + Urdu script)
  if (/\b(dhai|dhaiy|dhaye)\s*(hazar|hazaar)\b/i.test(cleaned) || /ڈھائی\s*ہزار|ڈھایی\s*ہزار/.test(cleaned)) return 2500
  if (/\b(derh|dedh)\s*(hazar|hazaar)\b/i.test(cleaned) || /ڈیڑھ\s*ہزار/.test(cleaned)) return 1500
  if (/\b(sadhe|saadhe)\s*teen\s*(hazar|hazaar)\b/i.test(cleaned) || /ساڑھے\s*تین\s*ہزار/.test(cleaned)) return 3500
  if (/\b(sadhe|saadhe)\s*char\s*(hazar|hazaar)\b/i.test(cleaned) || /ساڑھے\s*چار\s*ہزار/.test(cleaned)) return 4500
  if (/\b(sadhe|saadhe)\s*(panch|paanch)\s*(hazar|hazaar)\b/i.test(cleaned) || /ساڑھے\s*پانچ\s*ہزار/.test(cleaned)) return 5500
  if (/\b(dhai|dhaiy|dhaye)\s*(sau|so)\b/i.test(cleaned) || /ڈھائی\s*سو|ڈھایی\s*سو/.test(cleaned)) return 250
  if (/\b(derh|dedh)\s*(sau|so)\b/i.test(cleaned) || /ڈیڑھ\s*سو/.test(cleaned)) return 150
  if (/\b(sawa)\s*(sau|so)\b/i.test(cleaned) || /سوا\s*سو/.test(cleaned)) return 125

  // Common Urdu hundreds: "pandrah sau" (1500), "barah sau" (1200), etc.
  if (/\b(pandrah|pandra)\s*(sau|so)\b/i.test(cleaned) || /پندرہ\s*سو/.test(cleaned)) return 1500
  if (/\b(barah)\s*(sau|so)\b/i.test(cleaned) || /بارہ\s*سو/.test(cleaned)) return 1200
  if (/\b(terah)\s*(sau|so)\b/i.test(cleaned) || /تیرہ\s*سو/.test(cleaned)) return 1300
  if (/\b(chaudah)\s*(sau|so)\b/i.test(cleaned) || /چودہ\s*سو/.test(cleaned)) return 1400
  if (/\b(solah)\s*(sau|so)\b/i.test(cleaned) || /سولہ\s*سو/.test(cleaned)) return 1600
  if (/\b(satrah)\s*(sau|so)\b/i.test(cleaned) || /سترہ\s*سو/.test(cleaned)) return 1700
  if (/\b(atharah)\s*(sau|so)\b/i.test(cleaned) || /اٹھارہ\s*سو/.test(cleaned)) return 1800
  if (/\b(unnees|unnis)\s*(sau|so)\b/i.test(cleaned) || /انیس\s*سو/.test(cleaned)) return 1900
  if (/\b(bees|bis)\s*(sau|so)\b/i.test(cleaned) || /بیس\s*سو/.test(cleaned)) return 2000

  // 3. Multiplier phrases (e.g. "2.5 thousand" or "2 hazar" or "2 ہزار")
  const multMatch = cleaned.match(/^([\d.]+)\s*(thousand|k|hazar|hazaar|lakh|laakh|hundred|sau|so|ہزار|لاکھ|سو)$/i)
  if (multMatch) {
    const num = parseFloat(multMatch[1])
    const unit = multMatch[2].toLowerCase()
    if (!isNaN(num)) {
      if (['thousand', 'k', 'hazar', 'hazaar', 'ہزار'].includes(unit)) return Math.round(num * 1000)
      if (['hundred', 'sau', 'so', 'سو'].includes(unit)) return Math.round(num * 100)
      if (['lakh', 'laakh', 'لاکھ'].includes(unit)) return Math.round(num * 100000)
    }
  }

  // 4. Token-by-token evaluation
  const rawTokens = cleaned.split(/[\s-]+/).filter(Boolean)
  const tokens: number[] = []

  for (const t of rawTokens) {
    if (WORD_TO_NUMBER[t] !== undefined) {
      tokens.push(WORD_TO_NUMBER[t])
    } else if (/^\d+$/.test(t)) {
      tokens.push(parseInt(t, 10))
    }
  }

  if (tokens.length === 0) return null

  let total = 0
  let current = 0

  for (let i = 0; i < tokens.length; i++) {
    const val = tokens[i]
    if (val === 10000000 || val === 1000000 || val === 100000 || val === 1000) {
      current = (current === 0 ? 1 : current) * val
      total += current
      current = 0
    } else if (val === 100) {
      current = (current === 0 ? 1 : current) * 100
    } else {
      current += val
    }
  }

  total += current
  return total > 0 ? total : null
}

// ============================================================
// NATURAL LANGUAGE UNDERSTANDING (NLU) PARSER
// ============================================================

export interface VoicePOSContext {
  lastReferencedItem?: Item | null
  lastReferencedCustomer?: Customer | null
  currentCart: CartItem[]
  pendingDisambiguation?: {
    type: 'product' | 'customer'
    options: Array<{ id: string; label: string; sublabel?: string; data: any }>
    originalCommand: string
  } | null
  confirmationGate?: {
    type: 'price_override' | 'clear_cart' | 'hold_bill' | 'checkout'
    data: any
    prompt: string
  } | null
}

/**
 * Standardize transcript while preserving Urdu script & alphanumeric characters
 */
function normalizeTranscript(raw: string): string {
  const urduNormalized = normalizeUrduCharacters(raw)
  return urduNormalized
    .toLowerCase()
    .replace(/[?!:;۔]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect language of utterance: 'en' | 'ur' | 'mixed'
 */
export function detectLanguage(text: string): 'en' | 'ur' | 'mixed' {
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'

  const urduMarkers = [
    'kardo', 'karo', 'dalo', 'daldo', 'nikal', 'hata', 'lagao', 'chahiye',
    'bhai', 'rupay', 'ka', 'ki', 'ke', 'aur', 'phir', 'sath', 'aik', 'do',
    'teen', 'char', 'panch', 'dus', 'sau', 'hazar', 'gahak', 'udhaar', 'mein', 'me', 'banao', 'kam'
  ]
  const words = text.toLowerCase().split(/\s+/)
  const urduCount = words.filter(w => urduMarkers.includes(w)).length
  if (urduCount >= 2) return 'ur'
  if (urduCount === 1) return 'mixed'
  return 'en'
}

/**
 * Split a compound sentence into individual item phrases
 */
function splitCompoundItems(text: string): string[] {
  const unified = text
    .replace(/\s+(and|aur|phir|also|plus|\+|اور|ساتھ|پھر|اور\s+ساتھ)\s+/gi, ' ### ')
    .replace(/[،,]\s*/g, ' ### ')

  return unified
    .split('###')
    .map(s => s.replace(/[.,?!:;۔]/g, ' ').trim())
    .filter(s => s.length > 1)
}

export function cleanSKUString(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/^(sku|code|item code|article|part number|no|number|ایس کے یو|کوڈ|آرٹیکل|نمبر)[-\s:]*/i, '')
    .trim()
}

/**
 * Extract target row number (1-based index) if user refers to "item no 1", "item 1", "row 2", "pehli item", "doosra item", etc.
 */
export function extractRowNumberFromCommand(text: string, cartLength: number = 0): number | null {
  if (!text) return null
  const norm = normalizeTranscript(text).toLowerCase()

  // 1. Ordinals in English & Roman Urdu & Urdu
  if (/\b(first item|1st item|item 1st|pehla item|pehli item|pehla|pehli|پہلا|پہلی|پہلا آئٹم|پہلی آئٹم)\b/i.test(norm)) return 1
  if (/\b(second item|2nd item|item 2nd|doosra item|doosri item|dusra item|dusri item|doosra|doosri|dusra|dusri|دوسرا|دوسری|دوسرا آئٹم|دوسری آئٹم)\b/i.test(norm)) return 2
  if (/\b(third item|3rd item|item 3rd|teesra item|teesri item|teesra|teesri|تیسرا|تیسری|تیسرا آئٹم|تیسری آئٹم)\b/i.test(norm)) return 3
  if (/\b(fourth item|4th item|chotha item|chothi item|chotha|chothi|چوتھا|چوتھی|چوتھا آئٹم)\b/i.test(norm)) return 4
  if (/\b(fifth item|5th item|panchwa item|panchwi item|پانچواں|پانچویں|پانچواں آئٹم)\b/i.test(norm)) return 5
  if (/\b(last item|aakhri item|akhri item|aakhri|akhri|آخری|آخری آئٹم)\b/i.test(norm)) return cartLength > 0 ? cartLength : 1

  // 2. Direct "item no 1", "item number 1", "item 1", "row 1", "sr 1", "line 1", "آئٹم نمبر 1"
  const m = norm.match(/\b(?:item|row|line|sr|s\s*no|serial|no|number|آئٹم|رو|نمبر)\s*(?:no\.?|number|نمبر)?\s*#?\s*([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chay|saat|aath|nau|das)\b/i)
  if (m && m[1]) {
    const num = parseSpokenNumber(m[1])
    if (num && num > 0) return num
  }

  // 3. Reverse order: "1 number item", "2 number item", "1 number ki price"
  const m2 = norm.match(/\b([0-9]+)\s*(?:number|no|نمبر)\s*(?:item|row|ki|ka|ke|ko|آئٹم|رو)?\b/i)
  if (m2 && m2[1]) {
    const num = parseInt(m2[1], 10)
    if (num > 0 && num <= 50) return num
  }

  return null
}

/**
 * Parse an individual item segment (e.g. "2 SKU 101 at 1500" or "SKU 101 add kardo")
 */
export function parseItemSegment(segment: string, catalog?: Item[]): {
  product_query: string
  quantity: number
  unit_price?: number
  discount_pct?: number
} {
  let text = normalizeUrduCharacters(segment)
    .replace(/[?!:;۔,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let unit_price: number | undefined

  // 1. Check for suffix price phrases: "[number] mein/rupay/rate/price/روپے/میں"
  const suffixPriceRegex = /([\d,]+|[a-z\u0600-\u06FF\s]+?)\s*(?:rupay\s+ki|rupay\s+ka|rupay|rupees|rs|pkr|rate|price|qeemat|keemat|mein|me|روپے\s+میں|روپے\s+کی|روپے\s+کا|روپے|میں|ریٹ|قیمت)(?:\s*(?:each|har aik|per piece|per unit|فی عدد|فی پیس|ka|ki|ke))?(?=\s+(?:add|dalo|daldo|kardo|kar do|karo|chahiye|شامل|ڈالو|کر دو)|$)/i
  const suffixMatch = text.match(suffixPriceRegex)
  if (suffixMatch) {
    const candidatePrice = parseSpokenNumber(suffixMatch[1].trim())
    if (candidatePrice && candidatePrice > 0) {
      unit_price = candidatePrice
      text = text.replace(suffixMatch[0], ' ').trim()
    }
  }

  // 2. Check for prefix price phrases: "at/rate/price/qeemat/for/@/قیمت/ریٹ [number]"
  if (!unit_price) {
    const prefixPriceRegex = /\b(?:at|@|for|rate|price|qeemat|keemat|قیمت|ریٹ|کے\s+حساب\s+سے)\s+([\d,]+|[a-z\u0600-\u06FF\s]+?)(?:\s*(?:each|har aik|per piece|per unit|rupay|rupees|rs|روپے|فی عدد|فی پیس))?(?=\s+(?:add|dalo|daldo|kardo|kar do|karo|chahiye|شامل|ڈالو|کر دو)|$)/i
    const prefixMatch = text.match(prefixPriceRegex)
    if (prefixMatch) {
      const candidatePrice = parseSpokenNumber(prefixMatch[1].trim())
      if (candidatePrice && candidatePrice > 0) {
        unit_price = candidatePrice
        text = text.replace(prefixMatch[0], ' ').trim()
      }
    }
  }

  let quantity = 1
  let product_query = ''

  // 3. Check for explicit SKU pattern: e.g. "sku 101", "code 502", "article 104", "ایس کے یو 101"
  const explicitSkuMatch = text.match(/\b(?:sku|code|item code|article|part number|no|number|ایس کے یو|کوڈ|آرٹیکل|نمبر)\s*([a-z0-9-]+)\b/i)

  if (explicitSkuMatch) {
    product_query = explicitSkuMatch[1].trim()
    const remaining = text.replace(explicitSkuMatch[0], ' ')
      .replace(/\b(add|insert|put|please|bhai|dalo|daldo|daal do|kardo|kar do|karo|chahiye|in cart|cart me|into cart|pieces?|pcs|piece|danay|dana|adad|suit|suits|ke|ki|ka|ko)\b/gi, ' ')
      .trim()
    
    const tokens = remaining.split(/\s+/).filter(Boolean)
    for (const tok of tokens) {
      const qNum = parseSpokenNumber(tok)
      if (qNum && qNum > 0 && qNum <= 100) {
        quantity = qNum
        break
      }
    }
  } else {
    // Check if any token matches a known catalog SKU
    const knownSkus = catalog ? catalog.map(i => cleanSKUString(i.part_number || '')).filter(Boolean) : []
    const tokens = text.split(/\s+/).filter(Boolean)
    let matchedSkuToken: string | null = null
    let foundQty: number | null = null

    if (knownSkus.length > 0) {
      for (let i = 0; i < tokens.length; i++) {
        const tok = cleanSKUString(tokens[i])
        if (tok && knownSkus.includes(tok)) {
          matchedSkuToken = tok
          // Look before or after for quantity
          for (let j = 0; j < tokens.length; j++) {
            if (i === j) continue
            const qNum = parseSpokenNumber(tokens[j])
            if (qNum && qNum > 0 && qNum <= 100) {
              foundQty = qNum
              break
            }
          }
          break
        }
      }
    }

    if (matchedSkuToken) {
      product_query = matchedSkuToken
      if (foundQty) quantity = foundQty
    } else {
      // General product name: e.g. "3 Zellbury" or "Zellbury 2 piece"
      const words = text.split(/\s+/).filter(Boolean)
      if (words.length >= 2) {
        const firstNum = parseSpokenNumber(words[0])
        if (firstNum && firstNum > 0 && firstNum <= 50) {
          quantity = firstNum
          words.shift()
          text = words.join(' ')
        }
      }

      product_query = text
        .replace(/\b(add|insert|put|please|bhai|dalo|daldo|daal do|kardo|kar do|karo|chahiye|in cart|cart me|into cart|pieces?|pcs|piece|danay|dana|adad|suit|suits|ke|ki|ka|ko)\b/gi, ' ')
        .replace(/(کارٹ میں|ڈال دو|ڈالو|ایڈ کرو|شامل کرو|پلیز|بھائی|عدد|پیس|سوٹ)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  return { product_query, quantity, unit_price }
}

// ============================================================
// FUZZY & PHONETIC STRING SIMILARITY
// ============================================================

function normalizeSearchToken(token: string): string {
  let t = token.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y'
  else if (t.endsWith('es') && t.length > 4) t = t.slice(0, -2)
  else if (t.endsWith('s') && t.length > 3) t = t.slice(0, -1)

  t = t
    .replace(/lon/g, 'lawn')
    .replace(/kutan|koton/g, 'cotton')
    .replace(/soot/g, 'suit')
    .replace(/kurti|kurtis/g, 'kurta')
    .replace(/blek/g, 'black')
    .replace(/shart/g, 'shirt')
    .replace(/detaal/g, 'dettol')

  return t
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

export function matchProductInCatalog(query: string, catalog: Item[]): {
  exactMatch: Item | null
  candidateItems: Item[]
  confidence: number
} {
  if (!query || !catalog || catalog.length === 0) {
    return { exactMatch: null, candidateItems: [], confidence: 0 }
  }

  const activeCatalog = catalog.filter(i => i.is_active !== 0)
  if (activeCatalog.length === 0) return { exactMatch: null, candidateItems: [], confidence: 0 }

  const rawQ = query.trim().toLowerCase()
  const cleanQ = cleanSKUString(rawQ)
  const normQ = cleanQ.replace(/[^a-z0-9]/g, '')
  const qTokens = rawQ.split(/\s+/).filter(Boolean)
  const normQTokens = qTokens.map(normalizeSearchToken).filter(Boolean)

  if (!rawQ) {
    return { exactMatch: null, candidateItems: [], confidence: 0 }
  }

  // 1. Direct SKU (part_number) exact or normalized match
  const bySKU = activeCatalog.find(i => {
    if (!i.part_number) return false
    const itemPart = i.part_number.trim().toLowerCase()
    const cleanItemPart = cleanSKUString(itemPart)
    const normItemPart = cleanItemPart.replace(/[^a-z0-9]/g, '')
    return (
      itemPart === rawQ ||
      itemPart === cleanQ ||
      cleanItemPart === cleanQ ||
      (normItemPart && normItemPart === normQ)
    )
  })
  if (bySKU) {
    return { exactMatch: bySKU, candidateItems: [bySKU], confidence: 1.0 }
  }

  // 2. Direct Barcode exact match
  const byBarcode = activeCatalog.find(i =>
    i.barcode && (i.barcode.toLowerCase() === rawQ || i.barcode.toLowerCase() === cleanQ || i.barcode.replace(/[^a-z0-9]/g, '') === normQ)
  )
  if (byBarcode) {
    return { exactMatch: byBarcode, candidateItems: [byBarcode], confidence: 1.0 }
  }

  // 3. Exact Name Match
  const byExactName = activeCatalog.find(i =>
    i.name.toLowerCase().trim() === rawQ ||
    i.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normQ
  )
  if (byExactName) {
    return { exactMatch: byExactName, candidateItems: [byExactName], confidence: 0.98 }
  }

  // 3. Multi-tier predictive scoring with token & phonetic fuzzy matching
  const scored = activeCatalog.map(item => {
    const name = (item.name || '').toLowerCase()
    const part = (item.part_number || '').toLowerCase()
    const barcode = (item.barcode || '').toLowerCase()
    const brand = (item.brand_name || '').toLowerCase()
    const cat = (item.category_name || '').toLowerCase()
    const variant = (item.size_variant || '').toLowerCase()

    const normName = name.replace(/[^a-z0-9]/g, '')
    const normPart = part.replace(/[^a-z0-9]/g, '')
    const normBarcode = barcode.replace(/[^a-z0-9]/g, '')
    const normBrand = brand.replace(/[^a-z0-9]/g, '')
    const normCat = cat.replace(/[^a-z0-9]/g, '')

    const itemTokens = `${name} ${brand} ${cat} ${variant}`.split(/\s+/).map(normalizeSearchToken).filter(Boolean)
    const haystack = `${name} ${part} ${barcode} ${brand} ${cat} ${variant}`
    const normHaystack = `${normName} ${normPart} ${normBarcode} ${normBrand} ${normCat}`

    let score = 0

    if (barcode && (barcode.startsWith(rawQ) || (normBarcode && normBarcode.startsWith(normQ)))) score += 450
    else if (barcode && (barcode.includes(rawQ) || (normBarcode && normBarcode.includes(normQ)))) score += 250

    if (part && (part.startsWith(rawQ) || (normPart && normPart.startsWith(normQ)))) score += 400
    else if (part && (part.includes(rawQ) || (normPart && normPart.includes(normQ)))) score += 240

    if (name.startsWith(rawQ) || normName.startsWith(normQ)) score += 360
    else if (name.includes(rawQ) || normName.includes(normQ)) score += 260

    if (brand && (brand.includes(rawQ) || (normBrand && normBrand.includes(normQ)))) score += 120
    if (cat && (cat.includes(rawQ) || (normCat && normCat.includes(normQ)))) score += 120
    if (variant && variant.includes(rawQ)) score += 100

    let matchedTokens = 0
    for (const qTok of normQTokens) {
      if (!qTok) continue

      if (haystack.includes(qTok) || (normHaystack && normHaystack.includes(qTok))) {
        matchedTokens++
        score += 100
        continue
      }

      let bestDist = 99
      for (const iTok of itemTokens) {
        if (Math.abs(iTok.length - qTok.length) > 2) continue
        const dist = levenshtein(qTok, iTok)
        if (dist < bestDist) bestDist = dist
      }

      if (bestDist <= 1 && qTok.length >= 3) {
        matchedTokens++
        score += 75
      } else if (bestDist <= 2 && qTok.length >= 5) {
        matchedTokens++
        score += 55
      }
    }

    if (normQTokens.length > 0 && matchedTokens === normQTokens.length) {
      score += 200
    }

    if ((item.quantity_on_hand ?? 0) > 0) {
      score += 15
    }

    return { item, score, matchedTokens }
  })

  const matches = scored
    .filter(s => s.score >= 120)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item)

  if (matches.length === 1) {
    return { exactMatch: matches[0], candidateItems: matches, confidence: 0.95 }
  }

  if (matches.length > 1) {
    const topScore = scored.find(s => s.item.id === matches[0].id)?.score || 0
    const secondScore = scored.find(s => s.item.id === matches[1].id)?.score || 0

    if (topScore >= secondScore + 180 || topScore >= 450) {
      return { exactMatch: matches[0], candidateItems: matches.slice(0, 5), confidence: 0.92 }
    }

    return {
      exactMatch: null,
      candidateItems: matches.slice(0, 5),
      confidence: 0.78
    }
  }

  return { exactMatch: null, candidateItems: [], confidence: 0 }
}

export function matchCustomerInList(query: string, customers: Customer[]): {
  exactMatch: Customer | null
  candidateCustomers: Customer[]
  confidence: number
} {
  if (!query || customers.length === 0) {
    return { exactMatch: null, candidateCustomers: [], confidence: 0 }
  }

  const q = normalizeUrduCharacters(query).toLowerCase().replace(/[^a-z0-9\s\u0600-\u06FF]/g, '').trim()
  const qPhone = query.replace(/[^\d]/g, '')

  if (qPhone.length >= 7) {
    const byPhone = customers.find(c =>
      (c.phone && c.phone.replace(/[^\d]/g, '').includes(qPhone)) ||
      (c.whatsapp && c.whatsapp.replace(/[^\d]/g, '').includes(qPhone))
    )
    if (byPhone) return { exactMatch: byPhone, candidateCustomers: [byPhone], confidence: 1.0 }
  }

  const byName = customers.find(c => c.name.toLowerCase().trim() === q)
  if (byName) return { exactMatch: byName, candidateCustomers: [byName], confidence: 0.98 }

  const matches = customers.filter(c => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
  if (matches.length === 1) {
    return { exactMatch: matches[0], candidateCustomers: matches, confidence: 0.92 }
  }
  if (matches.length > 1) {
    return { exactMatch: null, candidateCustomers: matches.slice(0, 5), confidence: 0.75 }
  }

  return { exactMatch: null, candidateCustomers: [], confidence: 0 }
}

// ============================================================
// MAIN VOICE POS COMMAND PARSER & DISPATCHER
// ============================================================

export async function parseVoiceCommand(
  rawTranscript: string,
  catalog: Item[],
  customers: Customer[],
  context: VoicePOSContext,
  canEditPrice: boolean = true
): Promise<VoiceParsedCommand> {
  const norm = normalizeTranscript(rawTranscript)
  const lang = detectLanguage(rawTranscript)

  // -------------------------------------------------------------
  // 0. LLM CLOUD / LOCAL AI INTELLIGENCE PIPELINE (PRIMARY NLU)
  // -------------------------------------------------------------
  if (typeof window !== 'undefined' && window.api?.processVoiceWithLLM) {
    try {
      const llmRes = await window.api.processVoiceWithLLM({
        transcript: rawTranscript,
        catalog: catalog.map(i => ({
          id: i.id,
          name: i.name,
          part_number: i.part_number,
          barcode: i.barcode,
          retail_price: i.retail_price,
          cost_price: i.cost_price,
          quantity_on_hand: i.quantity_on_hand
        })),
        cart: context.currentCart.map(c => ({
          id: c.id,
          item_id: c.item_id,
          name: c.item.name,
          part_number: c.item.part_number,
          qty: c.qty,
          unit_price: c.unit_price,
          line_total: c.line_total
        })),
        customers: customers.map(cu => ({
          id: cu.id,
          name: cu.name,
          phone: cu.phone,
          current_balance: cu.current_balance
        })),
        canEditPrice
      })

      let fallbackMeta: any = undefined

      if (llmRes && llmRes.success && llmRes.result && llmRes.result.intent && llmRes.result.intent !== 'UNKNOWN') {
        const r = llmRes.result
        console.log('[VoicePOSAgent] Successfully parsed via LLM:', r)

        const meta = {
          provider: llmRes.provider || 'Groq Cloud',
          model: llmRes.model || 'openai/gpt-oss-120b',
          latencyMs: llmRes.latencyMs || 0,
          raw_json: r,
          isFallback: llmRes.isFallback
        }

        // Resolve items for ADD_ITEM / ADD_MULTI
        if (r.intent === 'ADD_ITEM' || r.intent === 'ADD_MULTI') {
          const resolvedItems: VoiceItemEntity[] = []
          if (r.items && Array.isArray(r.items) && r.items.length > 0) {
            for (const it of r.items) {
              let matched = catalog.find(i => i.id === it.item_id)
              
              // 1. Direct SKU match
              if (!matched && it.sku) {
                matched = catalog.find(i => i.part_number && cleanSKUString(i.part_number) === cleanSKUString(it.sku!))
              }

              // 2. Disentangle Quantity if concatenated in SKU (e.g. it.sku = "2 101" or "2101" or "2-101")
              let extractedQtyFromSku: number | undefined
              if (!matched && it.sku) {
                for (const catItem of catalog) {
                  if (catItem.part_number) {
                    const cleanP = cleanSKUString(catItem.part_number)
                    const cleanS = cleanSKUString(it.sku!)
                    if (cleanS.endsWith(cleanP) && cleanS.length > cleanP.length) {
                      const prefixStr = cleanS.slice(0, cleanS.length - cleanP.length)
                      const prefixNum = parseInt(prefixStr, 10)
                      if (prefixNum > 0 && prefixNum <= 100) {
                        matched = catItem
                        extractedQtyFromSku = prefixNum
                        break
                      }
                    }
                  }
                }
              }

              // 3. Match by product name
              if (!matched && it.name) {
                matched = matchProductInCatalog(it.name, catalog).exactMatch || undefined
              }

              // 4. Robust Quantity extraction
              let qty = 1
              if (extractedQtyFromSku) {
                qty = extractedQtyFromSku
              } else if (it.quantity !== undefined && it.quantity !== null) {
                qty = typeof it.quantity === 'number' ? it.quantity : (parseSpokenNumber(String(it.quantity)) || parseInt(String(it.quantity), 10) || 1)
              } else if ((r as any).quantity !== undefined && (r as any).quantity !== null) {
                qty = typeof (r as any).quantity === 'number' ? (r as any).quantity : (parseSpokenNumber(String((r as any).quantity)) || parseInt(String((r as any).quantity), 10) || 1)
              }
              qty = Math.max(1, qty)

              if (matched) {
                const stock = matched.quantity_on_hand ?? 999
                const isShortage = qty > stock
                const customPrice = (it.unit_price && it.unit_price > 0 && it.unit_price !== matched.retail_price) ? it.unit_price : undefined
                const isPriceMismatch = customPrice !== undefined && !canEditPrice
                const costPrice = matched.cost_price || 0
                const effectivePrice = customPrice !== undefined ? customPrice : matched.retail_price
                const isBelowCost = effectivePrice !== undefined && costPrice > 0 && effectivePrice < costPrice

                resolvedItems.push({
                  product_query: it.sku || it.name || matched.name,
                  quantity: qty,
                  unit_price: customPrice,
                  matched_item: matched,
                  stock_shortage: isShortage,
                  available_stock: stock,
                  price_mismatch: isPriceMismatch,
                  below_cost_price: isBelowCost,
                  cost_price: costPrice,
                  confidence: 0.99
                })
              } else if (it.sku || it.name) {
                resolvedItems.push({
                  product_query: it.sku || it.name || 'Unknown Item',
                  quantity: qty,
                  confidence: 0.5
                })
              }
            }
          }

          if (resolvedItems.length > 0) {
            let matchedCust: Customer | undefined = undefined
            if (r.customer_id) {
              matchedCust = customers.find(c => c.id === r.customer_id)
            }
            if (!matchedCust && r.customer_name) {
              matchedCust = matchCustomerInList(r.customer_name, customers).exactMatch || undefined
            }

            return {
              intent: resolvedItems.length > 1 ? 'ADD_MULTI' : 'ADD_ITEM',
              language: r.language || lang,
              transcript: rawTranscript,
              raw_command: norm,
              items: resolvedItems,
              customer_name: r.customer_name,
              customer_phone: r.customer_phone,
              matched_customer: matchedCust,
              discount_amount: r.discount_amount,
              discount_pct: r.discount_pct,
              payment_method: r.payment_method,
              bank_provider: r.bank_provider,
              amount_paid: r.amount_paid,
              spoken_response: r.spoken_response,
              confidence: 0.99,
              llm_meta: meta
            }
          }
        }

        // CHECK_STOCK (Inventory / Stock Query)
        if (r.intent === 'CHECK_STOCK') {
          let matchedItem: Item | undefined = undefined
          const q = r.items?.[0]?.sku || r.items?.[0]?.name || r.target_cart_sku || ''
          if (r.items?.[0]?.item_id) {
            matchedItem = catalog.find(i => i.id === r.items![0].item_id)
          }
          if (!matchedItem && q) {
            matchedItem = catalog.find(i => i.part_number && cleanSKUString(i.part_number) === cleanSKUString(q)) ||
                          matchProductInCatalog(q, catalog).exactMatch || undefined
          }
          if (!matchedItem && context.lastReferencedItem) {
            matchedItem = context.lastReferencedItem
          }
          if (!matchedItem && context.currentCart.length > 0) {
            matchedItem = context.currentCart[context.currentCart.length - 1].item
          }

          return {
            intent: 'CHECK_STOCK',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            product_query: q || matchedItem?.name || '',
            items: matchedItem ? [{
              product_query: matchedItem.name,
              quantity: 1,
              matched_item: matchedItem,
              available_stock: matchedItem.quantity_on_hand ?? 0,
              unit_price: matchedItem.retail_price,
              confidence: 0.99
            }] : undefined,
            spoken_response: r.spoken_response,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // SET_PRICE
        if (r.intent === 'SET_PRICE') {
          const rowNum = r.target_cart_row || extractRowNumberFromCommand(norm, context.currentCart.length) || undefined
          return {
            intent: 'SET_PRICE',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            unit_price: r.new_price,
            target_cart_row: rowNum,
            product_query: r.target_cart_sku || r.items?.[0]?.sku || r.items?.[0]?.name,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // UPDATE_QTY
        if (r.intent === 'UPDATE_QTY') {
          const rowNum = r.target_cart_row || extractRowNumberFromCommand(norm, context.currentCart.length) || undefined
          return {
            intent: 'UPDATE_QTY',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            quantity: r.new_quantity !== undefined ? r.new_quantity : (r.quantity_delta !== undefined ? r.quantity_delta : 1),
            target_cart_row: rowNum,
            product_query: r.target_cart_sku || r.items?.[0]?.sku || r.items?.[0]?.name,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // REMOVE_ITEM
        if (r.intent === 'REMOVE_ITEM') {
          const rowNum = r.target_cart_row || extractRowNumberFromCommand(norm, context.currentCart.length) || undefined
          return {
            intent: 'REMOVE_ITEM',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            target_cart_row: rowNum,
            product_query: r.target_cart_sku || r.items?.[0]?.sku || r.items?.[0]?.name,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // SET_CUSTOMER
        if (r.intent === 'SET_CUSTOMER') {
          let matchedCust = customers.find(c => c.id === r.customer_id)
          if (!matchedCust && r.customer_name) {
            matchedCust = matchCustomerInList(r.customer_name, customers).exactMatch || undefined
          }
          return {
            intent: 'SET_CUSTOMER',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            customer_name: r.customer_name || matchedCust?.name,
            matched_customer: matchedCust || undefined,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // CREATE_CUSTOMER
        if (r.intent === 'CREATE_CUSTOMER') {
          return {
            intent: 'CREATE_CUSTOMER',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // SET_DISCOUNT
        if (r.intent === 'SET_DISCOUNT') {
          return {
            intent: 'SET_DISCOUNT',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            discount_amount: r.discount_amount,
            discount_pct: r.discount_pct,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // SET_PAYMENT
        if (r.intent === 'SET_PAYMENT') {
          return {
            intent: 'SET_PAYMENT',
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            payment_method: r.payment_method || 'cash',
            bank_provider: r.bank_provider,
            amount_paid: r.amount_paid,
            confidence: 0.99,
            llm_meta: meta
          }
        }

        // CLEAR_CART, HOLD_BILL, CONFIRM_PROCEED, CANCEL_DISCARD, REVIEW_INVOICE
        if (['CLEAR_CART', 'HOLD_BILL', 'CONFIRM_PROCEED', 'CANCEL_DISCARD', 'REVIEW_INVOICE'].includes(r.intent)) {
          return {
            intent: r.intent as any,
            language: r.language || lang,
            transcript: rawTranscript,
            raw_command: norm,
            confidence: 0.99,
            llm_meta: meta
          }
        }
      } else if (llmRes && !llmRes.success) {
        fallbackMeta = {
          provider: llmRes.provider || 'AI Gateway',
          model: llmRes.model || '',
          latencyMs: llmRes.latencyMs || 0,
          isFallback: true,
          error: llmRes.error
        }
      }
    } catch (llmErr: any) {
      console.warn('[VoicePOSAgent] LLM processing error, falling back to local rules:', llmErr)
    }
  }

  // -------------------------------------------------------------
  // 1. LOCAL CONFIRMATION & NAVIGATION SHORTCUTS (FALLBACK)
  // -------------------------------------------------------------

  // PROCEED / COMPLETE SALE
  if (/^(proceed|complete sale|save invoice|done|confirm|finish|bill finalize|proceed karo|done kardo|bill mukammal karo|bill banao|sale mukammal karo|بل بناؤ|بل بناو|پروسیڈ|مکمل کرو|سیو کرو|فائنل کرو|ڈن|ہو گیا)\b/i.test(norm)) {
    return {
      intent: 'CONFIRM_PROCEED',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.98
    }
  }

  // CANCEL / DISCARD
  if (/^(cancel|discard|abort|stop|cancel kardo|khatam karo|chhor do|back|کینسل|منسوخ|روک دو|چھوڑ دو)\b/i.test(norm)) {
    return {
      intent: 'CANCEL_DISCARD',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.98
    }
  }

  // CLEAR CART / NEW SALE
  if (/\b(clear cart|empty cart|reset cart|new sale|start new sale|cart khali|naya bill|nai sale|کارٹ خالی|نیا بل)\b/i.test(norm)) {
    return {
      intent: 'CLEAR_CART',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.95
    }
  }

  // HOLD BILL / RESUME BILL
  if (/\b(hold this bill|hold bill|hold invoice|bill hold|hold kardo|ہولڈ|روک لو)\b/i.test(norm)) {
    return {
      intent: 'HOLD_BILL',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.95
    }
  }
  if (/\b(resume bill|unhold bill|resume invoice|held bill wapas|wapas kholo|واپس کھولو)\b/i.test(norm)) {
    return {
      intent: 'RESUME_BILL',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.95
    }
  }

  // REVIEW INVOICE / SHOW BILL
  if (/\b(review invoice|show invoice|show bill|view bill|bill dikhao|invoice check|bill check|بل دکھاؤ|انوائس چیک)\b/i.test(norm)) {
    return {
      intent: 'REVIEW_INVOICE',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      confidence: 0.95
    }
  }

  // CHECK STOCK / INVENTORY AVAILABILITY QUERY
  if (/\b(stock|available|kitni hai|kitna hai|kitne hain|kitna pada|kitni pari|mojood hai|dastiyab|in stock|اسٹاک|دستیاب|کتنا ہے|کتنی ہے)\b/i.test(norm) && !norm.startsWith('add') && !norm.includes('kardo') && !norm.includes('dalo')) {
    let cleanProd = norm
      .replace(/\b(what is|check|tell me|is|the|stock|available|quantity|qty|on hand|kitni|kitna|kitne|hai|hain|pada|pari|mojood|dastiyab|of|for|ka|ki|ke|in|اسٹاک|کتنا|کتنی|ہے|ہیں|دستیاب|کا|کی|کے)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    let matchedItem: Item | undefined
    if (cleanProd) {
      matchedItem = catalog.find(i => i.part_number && cleanSKUString(i.part_number) === cleanSKUString(cleanProd)) ||
                    matchProductInCatalog(cleanProd, catalog).exactMatch || undefined
    }
    if (!matchedItem && context.lastReferencedItem) {
      matchedItem = context.lastReferencedItem
    }
    if (!matchedItem && context.currentCart.length > 0) {
      matchedItem = context.currentCart[context.currentCart.length - 1].item
    }

    return {
      intent: 'CHECK_STOCK',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      product_query: cleanProd || matchedItem?.name || '',
      items: matchedItem ? [{
        product_query: matchedItem.name,
        quantity: 1,
        matched_item: matchedItem,
        available_stock: matchedItem.quantity_on_hand ?? 0,
        unit_price: matchedItem.retail_price,
        confidence: 0.95
      }] : undefined,
      confidence: 0.95
    }
  }

  // -------------------------------------------------------------
  // 2. DISAMBIGUATION NUMBER SELECTION
  // -------------------------------------------------------------
  if (context.pendingDisambiguation && context.pendingDisambiguation.options.length > 0) {
    const num = parseSpokenNumber(norm)
    if (num && num >= 1 && num <= context.pendingDisambiguation.options.length) {
      const selected = context.pendingDisambiguation.options[num - 1]
      if (context.pendingDisambiguation.type === 'product') {
        const itemObj = selected.data as Item
        return {
          intent: 'ADD_ITEM',
          language: lang,
          transcript: rawTranscript,
          raw_command: norm,
          items: [{
            product_query: itemObj.name,
            quantity: 1,
            unit_price: itemObj.retail_price,
            matched_item: itemObj,
            confidence: 0.98
          }],
          confidence: 0.98
        }
      } else if (context.pendingDisambiguation.type === 'customer') {
        const custObj = selected.data as Customer
        return {
          intent: 'SET_CUSTOMER',
          language: lang,
          transcript: rawTranscript,
          raw_command: norm,
          customer_name: custObj.name,
          matched_customer: custObj,
          confidence: 0.98
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. SET / UPDATE ITEM PRICE (e.g. "Change Coke price to 200", "Item no 1 ki price 1800 kardo", "Coke ka rate 180 karo", "Price 1500 kardo")
  // -------------------------------------------------------------
  const isPriceUpdate = /\b(price|rate|qeemat|keemat|قیمت|ریٹ)\b/i.test(norm) ||
    /\b([\d,]+|[a-z\u0600-\u06FF\s]+?)\s*(?:rupay\s+ka\s+lagao|rupay\s+kardo|rupay\s+karo|me\s+kardo|روپے\s+کا\s+لگاؤ|روپے\s+کر\s+دو)\b/i.test(norm)

  if (isPriceUpdate && !norm.startsWith('add') && !norm.startsWith('give discount') && !norm.includes('discount') && !norm.includes('ڈسکاؤنٹ')) {
    // Extract price number from sentence
    const priceNum = parseSpokenNumber(norm.replace(/[^0-9a-z\u0600-\u06FF\s]/gi, '').split(/\s+/).filter(w => parseSpokenNumber(w) !== null).pop() || '')
    const targetRow = extractRowNumberFromCommand(norm, context.currentCart.length)
    
    if (priceNum && priceNum > 0) {
      // Extract target product name
      const cleanProd = norm
        .replace(/\b(change|update|set|make|badlo|tabdeel karo|kardo|kar do|karo|lagao|the|price|rate|qeemat|keemat|of|for|ko|ka|ki|ke|to|at|me|mein|pe|par|rupay|rupees|rs|pkr|item|row|no|number|line|sr)\b/gi, ' ')
        .replace(/(بدلو|تبدیل کرو|لگاؤ|کرو|کر دو|قیمت|ریٹ|کا|کی|کے|کو|میں|پر|روپے|آئٹم|نمبر|رو)/g, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        intent: 'SET_PRICE',
        language: lang,
        transcript: rawTranscript,
        raw_command: norm,
        target_cart_row: targetRow || undefined,
        product_query: cleanProd,
        unit_price: priceNum,
        confidence: 0.95
      }
    }
  }

  // -------------------------------------------------------------
  // 4. QUANTITY MODIFICATION (INCREASE / DECREASE / SET QTY)
  // -------------------------------------------------------------

  // A. Relative Add More / Increase (e.g. "Item no 1 mai 1 aur add krdo", "Add 2 more Coke", "Coke 2 aur dalo", "2 aur dalo", "ایک اور ڈالو")
  if (/\b(add\s+([\d\w\u0600-\u06FF]+)\s+more|([\d\w\u0600-\u06FF]+)\s+more|aur\s+([\d\w\u0600-\u06FF]+)|([\d\w\u0600-\u06FF]+)\s+aur|aur\s+add|ایک\s*اور|اور\s*ڈالو|مزید\s*ڈالو)\b/i.test(norm)) {
    const num = parseSpokenNumber(norm.replace(/[^0-9a-z\u0600-\u06FF\s]/gi, '').split(/\s+/).filter(w => parseSpokenNumber(w) !== null).pop() || '') || 1
    const targetRow = extractRowNumberFromCommand(norm, context.currentCart.length)
    const cleanProd = norm
      .replace(/\b(add|more|aur|dalo|daldo|daal do|kardo|kar do|karo|chahiye|pieces?|pcs|piece|item|row|no|number|line|sr)\b/gi, ' ')
      .replace(/(اور|ڈالو|مزید|ڈال دو|پیس|عدد|آئٹم|نمبر|رو)/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      intent: 'UPDATE_QTY',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      target_cart_row: targetRow || undefined,
      product_query: cleanProd || context.lastReferencedItem?.name || '',
      quantity: num,
      confidence: 0.94
    }
  }

  // B. Relative Decrease (e.g. "Item no 1 1 kam kardo", "Coke 1 kam kardo", "Decrease Coke by 1", "1 kam karo", "ایک کم کرو")
  if (/\b(decrease|reduce|kam\s+kardo|kam\s+karo|kam\s+kar do|kam|کم\s*کرو|کم\s*کر دو)\b/i.test(norm)) {
    const num = parseSpokenNumber(norm.replace(/[^0-9a-z\u0600-\u06FF\s]/gi, '').split(/\s+/).filter(w => parseSpokenNumber(w) !== null).pop() || '') || 1
    const targetRow = extractRowNumberFromCommand(norm, context.currentCart.length)
    const cleanProd = norm
      .replace(/\b(decrease|reduce|by|from|kam|kardo|kar do|karo|pieces?|pcs|item|row|no|number|line|sr)\b/gi, ' ')
      .replace(/(کم|کرو|کر دو|پیس|عدد|آئٹم|نمبر|رو)/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      intent: 'UPDATE_QTY',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      target_cart_row: targetRow || undefined,
      product_query: cleanProd || context.lastReferencedItem?.name || '',
      quantity: -num,
      confidence: 0.94
    }
  }

  // C. Absolute Set Quantity (e.g. "Item no 1 quantity 5 kardo", "Coke 4 kar do", "Make Coke 3", "Quantity 3 kardo", "کوک چار کر دو")
  const isAbsQty = /\b(quantity|qty|pieces|pcs|tadad|تعداد)\b/i.test(norm) ||
    /^[a-z\u0600-\u06FF\s]+\s+(\d+|[a-z\u0600-\u06FF]+)\s*(?:kardo|kar do|karo|krdo|kr do|کر دو|کرو)$/i.test(norm)

  if (isAbsQty && !norm.includes('price') && !norm.includes('rate') && !norm.includes('rupay') && !norm.includes('rupees') && !norm.includes('discount')) {
    const num = parseSpokenNumber(norm.replace(/[^0-9a-z\u0600-\u06FF\s]/gi, '').split(/\s+/).filter(w => parseSpokenNumber(w) !== null).pop() || '')
    const targetRow = extractRowNumberFromCommand(norm, context.currentCart.length)
    if (num && num > 0 && num < 500) {
      const cleanProd = norm
        .replace(/\b(change|update|set|make|badlo|kardo|kar do|karo|krdo|kr do|the|quantity|qty|tadad|of|for|ko|ka|ki|ke|to|pieces?|pcs|item|row|no|number|line|sr)\b/gi, ' ')
        .replace(/(تعداد|کر دو|کرو|کا|کی|کے|کو|پیس|عدد|آئٹم|نمبر|رو)/g, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        intent: 'UPDATE_QTY',
        language: lang,
        transcript: rawTranscript,
        raw_command: norm,
        target_cart_row: targetRow || undefined,
        product_query: cleanProd || context.lastReferencedItem?.name || '',
        quantity: num,
        confidence: 0.95
      }
    }
  }

  // -------------------------------------------------------------
  // 5. REMOVE ITEM FROM CART (e.g. "Item no 1 ko delete krdo", "Row 1 nikal do", "Remove Coke from cart", "Coke nikal do", "کوک نکال دو")
  // -------------------------------------------------------------
  if (/\b(remove|delete|nikal\s+do|nikal\s+dein|hata\s+do|hata\s+dein|khatam\s+karo|delete\s+kardo|delete\s+krdo|نکال دو|ہٹا دو|ڈیلیٹ)\b/i.test(norm)) {
    const targetRow = extractRowNumberFromCommand(norm, context.currentCart.length)
    const cleanProd = norm
      .replace(/\b(remove|delete|from|cart|in|nikal|hata|do|dein|khatam|kardo|kar do|karo|krdo|item|last|aakhri|row|no|number|line|sr|ko)\b/gi, ' ')
      .replace(/(کارٹ|سے|نکال|ہٹا|دو|دیں|آخری|آئٹم|ڈیلیٹ|کو|رو|نمبر)/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      intent: 'REMOVE_ITEM',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      target_cart_row: targetRow || undefined,
      product_query: cleanProd || context.lastReferencedItem?.name || '',
      confidence: 0.95
    }
  }

  // -------------------------------------------------------------
  // 6. CUSTOMER MANAGEMENT INTENTS (ADD / SET / CREATE)
  // -------------------------------------------------------------
  const isCustIntent = /\b(customer|gahak|client|naya customer|new customer|add customer|create customer)\b/i.test(norm) ||
    /گاہک|کسٹمر|نیا کسٹمر/.test(norm)

  if (isCustIntent) {
    const isExplicitNew = /\b(add|create|new|naya|banao)\b/i.test(norm) || /نیا|بناؤ|ایڈ|شامل/.test(norm)

    // Extract phone number (e.g. 03001234567 or +92300... or 0321...)
    let phoneStr: string | undefined
    const phoneMatch = norm.match(/(?:phone|number|no|mobile|cell|فون|نمبر|موبائل)\s*([0-9\s-]{7,15})/i) ||
      norm.match(/\b(03\d{2}[-\s]?\d{7}|03\d{9}|\+92\d{10})\b/)
    if (phoneMatch) {
      phoneStr = phoneMatch[1].replace(/[\s-]/g, '')
    }

    // Extract customer name by stripping verbs & filler keywords
    let rawCustName = norm
      .replace(/\b(add|create|new|naya|banao|customer|gahak|client|is|hai|ka naam|ko|set|use|karo|kar do|lagao|phone|number|no|mobile|cell)\b/gi, ' ')
      .replace(/(نیا|بناؤ|کسٹمر|گاہک|کا نام|ہے|سیٹ|کرو|کر دو|لگاؤ|فون|نمبر|موبائل)/g, ' ')
    
    if (phoneStr) {
      rawCustName = rawCustName.replace(new RegExp(phoneStr, 'g'), ' ')
    }
    rawCustName = rawCustName.replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim()

    if (rawCustName.length >= 2) {
      // If user explicitly asked to create / add a new customer
      if (isExplicitNew) {
        return {
          intent: 'CREATE_CUSTOMER',
          language: lang,
          transcript: rawTranscript,
          raw_command: norm,
          customer_name: rawCustName,
          customer_phone: phoneStr,
          confidence: 0.96
        }
      }

      // Check if customer exists in list
      const custLookup = matchCustomerInList(rawCustName, customers)

      if (custLookup.exactMatch) {
        return {
          intent: 'SET_CUSTOMER',
          language: lang,
          transcript: rawTranscript,
          raw_command: norm,
          customer_name: custLookup.exactMatch.name,
          customer_phone: phoneStr || custLookup.exactMatch.phone,
          matched_customer: custLookup.exactMatch,
          confidence: custLookup.confidence
        }
      }

      if (custLookup.candidateCustomers.length > 1) {
        return {
          intent: 'SET_CUSTOMER',
          language: lang,
          transcript: rawTranscript,
          raw_command: norm,
          customer_name: rawCustName,
          candidate_customers: custLookup.candidateCustomers,
          needs_disambiguation: true,
          disambiguation_type: 'customer',
          ambiguous_options: custLookup.candidateCustomers.map((c, idx) => ({
            id: c.id,
            label: `${idx + 1}. ${c.name}`,
            sublabel: `Phone: ${c.phone || 'N/A'} | Balance Due: Rs. ${c.current_balance || 0}`,
            data: c
          })),
          confidence: 0.75
        }
      }

      // If customer not found in existing list, create them directly
      return {
        intent: 'CREATE_CUSTOMER',
        language: lang,
        transcript: rawTranscript,
        raw_command: norm,
        customer_name: rawCustName,
        customer_phone: phoneStr,
        confidence: 0.90
      }
    }
  }

  // -------------------------------------------------------------
  // 7. DISCOUNT INTENTS
  // -------------------------------------------------------------
  const isDiscount = /\b(discount|chhoot|riayat|chhut|% off|percent off|ڈسکاؤنٹ|چھوٹ|رعایت|فیصد)\b/i.test(norm)
  if (isDiscount) {
    const isPercent = norm.includes('percent') || norm.includes('%') || norm.includes('feesad') || norm.includes('فیصد')
    const cleanedText = norm.replace(/\b(give|apply|add|set|discount|chhoot|riayat|chhut|off|rupees|rs|pkr|percent|feesad|rupay|ka|ki|ke|do|lagao|ڈسکاؤنٹ|چھوٹ|رعایت|روپے|فیصد|دو|لگاؤ)\b/gi, '')
    const num = parseSpokenNumber(cleanedText)

    if (num !== null && num >= 0) {
      return {
        intent: 'SET_DISCOUNT',
        language: lang,
        transcript: rawTranscript,
        raw_command: norm,
        discount_amount: isPercent ? undefined : num,
        discount_pct: isPercent ? num : undefined,
        confidence: 0.95
      }
    }
  }

  // -------------------------------------------------------------
  // 8. PAYMENT & CASH RECEIVED INTENTS (CASH, BANK, JAZZCASH, EASYPAISA, CARD, CREDIT)
  // -------------------------------------------------------------
  if (/\b(payment is cash|pay cash|cash payment|cash me|paid cash|customer paid|received|wasool hue|cash wasool|payment cash|cash kardo|cash karo|cash pe|cash per|کیش|نقد|وصول ہوئے)\b/i.test(norm) && !norm.includes('jazzcash') && !norm.includes('easypaisa')) {
    const amt = parseSpokenNumber(norm.replace(/\b(payment|is|cash|pay|customer|paid|received|wasool|hue|rs|rupay|rupees|kardo|karo|pe|per|کیش|نقد|روپے|وصول|ہوئے|دیے|کردو|کرو|پر)\b/gi, ''))
    return {
      intent: 'SET_PAYMENT',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      payment_method: 'cash',
      amount_paid: amt && amt > 0 ? amt : undefined,
      confidence: 0.96
    }
  }

  if (/\b(jazzcash|jazz cash|easypaisa|easy paisa|bank transfer|bank payment|online payment|bank se|bank kardo|bank karo|bank pe|bank per|card payment|credit card|debit card|جاز کیش|ایزی پیسہ|بینک|کارڈ)\b/i.test(norm) || norm === 'bank' || norm === 'بینک') {
    let method: 'bank' | 'card' = 'bank'
    let provider: 'JazzCash' | 'EasyPaisa' | 'Other Bank' = 'Other Bank'

    if (norm.includes('jazzcash') || norm.includes('jazz cash') || norm.includes('جاز کیش')) {
      provider = 'JazzCash'
    } else if (norm.includes('easypaisa') || norm.includes('easy paisa') || norm.includes('ایزی پیسہ')) {
      provider = 'EasyPaisa'
    } else if (norm.includes('card') || norm.includes('کارڈ')) {
      method = 'card'
    }

    return {
      intent: 'SET_PAYMENT',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      payment_method: method,
      bank_provider: provider,
      confidence: 0.96
    }
  }

  if (/\b(on credit|put on credit|udhaar|udhar|pay later|khata me|khata mein|baad me dega|udhar kardo|ادھار|کھاتہ)\b/i.test(norm) || norm === 'udhar' || norm === 'khata') {
    return {
      intent: 'SET_PAYMENT',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      payment_method: 'credit',
      confidence: 0.96
    }
  }

  // -------------------------------------------------------------
  // 9. MULTI-ITEM & SINGLE-ITEM ADDITION INTENTS
  // -------------------------------------------------------------
  const itemSegments = splitCompoundItems(norm)
  const parsedItemEntities: VoiceItemEntity[] = []

  let overallConfidence = 0.92
  let hasDisambiguation = false
  let disambigOptions: Array<{ id: string; label: string; sublabel?: string; data: any }> = []

  for (const seg of itemSegments) {
    const parsed = parseItemSegment(seg, catalog)
    if (!parsed.product_query || parsed.product_query.length < 2) continue

    const match = matchProductInCatalog(parsed.product_query, catalog)

    if (match.exactMatch) {
      const item = match.exactMatch
      const available = item.quantity_on_hand ?? 0
      const stockShortage = parsed.quantity > available
      const priceMismatch = parsed.unit_price !== undefined && parsed.unit_price !== item.retail_price
      const costPrice = item.cost_price || 0
      const effectivePrice = parsed.unit_price !== undefined ? parsed.unit_price : item.retail_price
      const isBelowCost = effectivePrice !== undefined && costPrice > 0 && effectivePrice < costPrice

      parsedItemEntities.push({
        product_query: parsed.product_query,
        quantity: parsed.quantity,
        unit_price: parsed.unit_price || item.retail_price,
        matched_item: item,
        candidate_items: [item],
        stock_shortage: stockShortage,
        available_stock: available,
        price_mismatch: priceMismatch,
        below_cost_price: isBelowCost,
        cost_price: costPrice,
        catalog_price: item.retail_price,
        confidence: match.confidence
      })
    } else if (match.candidateItems.length > 1) {
      hasDisambiguation = true
      disambigOptions = match.candidateItems.map((ci, idx) => ({
        id: ci.id,
        label: `${idx + 1}. ${ci.name}`,
        sublabel: `Price: Rs. ${ci.retail_price} | Stock: ${ci.quantity_on_hand ?? 0}`,
        data: ci
      }))
      parsedItemEntities.push({
        product_query: parsed.product_query,
        quantity: parsed.quantity,
        unit_price: parsed.unit_price,
        candidate_items: match.candidateItems,
        confidence: match.confidence
      })
      overallConfidence = Math.min(overallConfidence, 0.75)
    } else {
      parsedItemEntities.push({
        product_query: parsed.product_query,
        quantity: parsed.quantity,
        unit_price: parsed.unit_price,
        confidence: 0
      })
      overallConfidence = 0.5
    }
  }

  if (parsedItemEntities.length > 0) {
    return {
      intent: parsedItemEntities.length > 1 ? 'ADD_MULTI' : 'ADD_ITEM',
      language: lang,
      transcript: rawTranscript,
      raw_command: norm,
      items: parsedItemEntities,
      needs_disambiguation: hasDisambiguation,
      disambiguation_type: hasDisambiguation ? 'product' : undefined,
      ambiguous_options: hasDisambiguation ? disambigOptions : undefined,
      confidence: overallConfidence
    }
  }

  return {
    intent: 'UNKNOWN',
    language: lang,
    transcript: rawTranscript,
    raw_command: norm,
    confidence: 0.2
  }
}

// ============================================================
// SPEECH SYNTHESIS ENGINE (AUDIO FEEDBACK)
// ============================================================

export class SpeechSynthesizer {
  private isMuted: boolean = false

  setMuted(muted: boolean): void {
    this.isMuted = muted
    if (muted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  speak(text: string, language: 'en' | 'ur' = 'ur'): void {
    if (this.isMuted || !text || !('speechSynthesis' in window)) return

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.02
      utterance.pitch = 1.0
      utterance.lang = 'ur-PK'

      // Pick best matching voice for natural Roman Urdu speech
      const voices = window.speechSynthesis.getVoices()
      if (voices && voices.length > 0) {
        const urduVoice = voices.find(v => v.lang.startsWith('ur') || v.lang.includes('PK') || v.name.toLowerCase().includes('urdu') || v.name.toLowerCase().includes('pakistan'))
        const desiVoice = voices.find(v => v.lang.includes('IN') || v.lang.startsWith('hi') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('hindi'))
        const standardVoice = voices.find(v => v.lang.startsWith('en'))
        utterance.voice = urduVoice || desiVoice || standardVoice || voices[0]
      }

      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('Speech synthesis error:', e)
    }
  }
}

export const speechSynthesizer = new SpeechSynthesizer()
