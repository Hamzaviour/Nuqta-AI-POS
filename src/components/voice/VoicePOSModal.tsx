import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, Check, AlertTriangle,
  X, CheckCircle, RefreshCw, ShoppingCart, User, CreditCard,
  Banknote, ArrowRight, Shield, Play, Pause, CornerDownLeft,
  Activity, Radio, AlertCircle, Cpu, Send, Square, Settings, Tag,
  Minus, Plus, Trash2, Maximize2, Minimize2
} from 'lucide-react'
import type { Item, Customer, CartItem, VoiceParsedCommand, VoiceMessage } from '../../types'
import { parseVoiceCommand, speechSynthesizer, VoicePOSContext } from '../../services/voicePosAgent'
import { encodeWAV, downsampleBuffer } from '../../services/wavEncoder'
import toast from 'react-hot-toast'

// Modern symmetrical 16-bar frequency wave multipliers
const WAVE_MULTIPLIERS = [0.25, 0.45, 0.7, 0.95, 1.3, 1.6, 1.9, 2.2, 2.2, 1.9, 1.6, 1.3, 0.95, 0.7, 0.45, 0.25]

// Low-latency procedural audio earcons (zero external asset dependencies)
function playEarcon(type: 'start' | 'success' | 'error', muted: boolean) {
  if (muted) return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime

    if (type === 'start') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.08)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.05) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.1) // G5
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(280, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.1)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {
    // Ignore audio context autoplay restriction
  }
}

interface VoicePOSModalProps {
  isOpen: boolean
  onClose: () => void
  catalog: Item[]
  customers: Customer[]
  currentCart: CartItem[]
  currentCustomer: Customer | null
  currentDiscount: number
  currentPaymentMethod: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial'
  currentBankProvider: 'JazzCash' | 'EasyPaisa' | 'Other Bank'
  canEditPrice: boolean
  onAddToCart: (item: Item, qty?: number, price?: number) => void
  onUpdateQty: (cartItemId: string, qty: number) => void
  onUpdatePrice: (cartItemId: string, newPrice: number) => void
  onRemoveFromCart: (cartItemId: string) => void
  onSetCustomer: (customer: Customer | null) => void
  onCreateCustomer?: (data: { name: string; phone?: string }) => Promise<Customer | null>
  onSetDiscount: (amount: number, isPercent?: boolean) => void
  onSetPaymentMethod: (method: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial', provider?: 'JazzCash' | 'EasyPaisa' | 'Other Bank') => void
  onSetAmountTendered: (amount: string) => void
  onClearCart: () => void
  onHoldBill: () => void
  onCommitSale: () => Promise<boolean>
}

export function VoicePOSModal({
  isOpen,
  onClose,
  catalog,
  customers,
  currentCart,
  currentCustomer,
  currentDiscount,
  currentPaymentMethod,
  currentBankProvider,
  canEditPrice,
  onAddToCart,
  onUpdateQty,
  onUpdatePrice,
  onRemoveFromCart,
  onSetCustomer,
  onCreateCustomer,
  onSetDiscount,
  onSetPaymentMethod,
  onSetAmountTendered,
  onClearCart,
  onHoldBill,
  onCommitSale
}: VoicePOSModalProps) {
  // Master recording state: 'idle' | 'recording' | 'transcribing'
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [isCompactMode, setIsCompactMode] = useState(true)
  const [activeLanguage, setActiveLanguage] = useState<'auto' | 'en' | 'ur'>('auto')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [recordDuration, setRecordDuration] = useState<number>(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [context, setContext] = useState<VoicePOSContext>({
    currentCart,
    lastReferencedItem: null,
    lastReferencedCustomer: currentCustomer,
    pendingDisambiguation: null,
    confirmationGate: null
  })
  const [manualInput, setManualInput] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)

  // Always start with compact floating capsule when Voice Invoice is opened, ensure speech synthesizer is silent
  useEffect(() => {
    if (isOpen) {
      setIsCompactMode(true)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isOpen])

  // Refs — Web Audio & PCM samples stream
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pcmBuffersRef = useRef<Float32Array[]>([])
  const animFrameRef = useRef<number | null>(null)
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isRecordingRef = useRef(false)
  const isProcessingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Financial calculations
  const subtotal = currentCart.reduce((s, i) => s + i.unit_price * i.qty, 0)
  const lineDiscounts = currentCart.reduce((s, i) => s + (i.unit_price * i.qty * i.discount_pct / 100), 0)
  const totalDiscount = lineDiscounts + currentDiscount
  const grandTotal = Math.max(0, subtotal - totalDiscount)

  // Assistant response message logger (voice feedback / TTS disabled per requirements)
  const respond = useCallback((text: string, lang: 'en' | 'ur' = 'en', parsedCmd?: VoiceParsedCommand) => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: 'assistant',
        text,
        timestamp: Date.now(),
        language: lang,
        parsed: parsedCmd
      }
    ])
  }, [])

  // Process a text transcript through the NLU pipeline
  const processTranscript = useCallback(async (transcriptText: string) => {
    if (!transcriptText || !transcriptText.trim()) return

    const userMsgId = `user-${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: transcriptText,
        transcript: transcriptText,
        timestamp: Date.now()
      }
    ])

    setRecordState('transcribing')
    isProcessingRef.current = true

    try {
      const parsed = await parseVoiceCommand(
        transcriptText,
        catalog,
        customers,
        context,
        canEditPrice
      )

      // Internal reply helper attaching LLM metadata to assistant message
      const reply = (text: string, lang: 'en' | 'ur' = 'en') => respond(text, lang, parsed)

      // Play acoustic feedback based on parsing result
      if (parsed.intent === 'UNKNOWN') {
        playEarcon('error', isMuted)
      } else if (parsed.needs_disambiguation) {
        playEarcon('start', isMuted)
      } else {
        playEarcon('success', isMuted)
      }

      // Handle Intent
      switch (parsed.intent) {
        case 'ADD_ITEM':
        case 'ADD_MULTI': {
          if (parsed.needs_disambiguation && parsed.ambiguous_options) {
            setContext(prev => ({
              ...prev,
              pendingDisambiguation: {
                type: 'product',
                options: parsed.ambiguous_options!,
                originalCommand: transcriptText
              }
            }))
            reply(`Ek se zyada matching items mili hain. Aap konsi item chahte hain?`, 'ur')
            return
          }

          if (parsed.items && parsed.items.length > 0) {
            let addedCount = 0
            for (const it of parsed.items) {
              if (it.matched_item) {
                if (it.stock_shortage) {
                  reply(`"${it.matched_item.name}" ka stock sirf ${it.available_stock} units mojood hai.`, 'ur')
                  return
                }

                if (it.price_mismatch && !canEditPrice) {
                  reply(`Aapko "${it.matched_item.name}" ki price tabdeel karne ki ijazat nahi hai.`, 'ur')
                  return
                }

                const costPrice = it.cost_price || it.matched_item.cost_price || 0
                const requestedPrice = it.unit_price !== undefined ? it.unit_price : it.matched_item.retail_price
                if (costPrice > 0 && requestedPrice < costPrice) {
                  reply(`"${it.matched_item.name}" ki price (Rs. ${requestedPrice.toLocaleString()}) uski cost price (Rs. ${costPrice.toLocaleString()}) se kam hai, is liye yeh add nahi hosakta.`, 'ur')
                  return
                }

                onAddToCart(it.matched_item, it.quantity, it.unit_price)
                setContext(prev => ({ ...prev, lastReferencedItem: it.matched_item }))
                addedCount++
              } else {
                reply(`"${it.product_query}" inventory mein mojood nahi hai. Sirf mojooda items shamil hosakti hain.`, 'ur')
              }
            }

            if (addedCount > 0) {
              const summaryText = parsed.items
                .filter(i => i.matched_item)
                .map(i => `${i.quantity} ${i.matched_item!.name}${i.matched_item!.part_number ? ` (SKU: ${i.matched_item!.part_number})` : ''}${i.unit_price ? ` @ Rs. ${i.unit_price}` : ''}`)
                .join(', ')

              let custInfoText = ''
              // Handle compound customer linking / creation
              if (parsed.matched_customer) {
                onSetCustomer(parsed.matched_customer)
                setContext(prev => ({ ...prev, lastReferencedCustomer: parsed.matched_customer }))
                custInfoText = ` Customer: ${parsed.matched_customer.name}.`
              } else if (parsed.customer_name) {
                const found = customers.find(c => c.name.toLowerCase().trim() === parsed.customer_name!.toLowerCase().trim())
                if (found) {
                  onSetCustomer(found)
                  setContext(prev => ({ ...prev, lastReferencedCustomer: found }))
                  custInfoText = ` Customer: ${found.name}.`
                } else if (onCreateCustomer) {
                  onCreateCustomer({ name: parsed.customer_name, phone: parsed.customer_phone }).then(created => {
                    if (created) {
                      onSetCustomer(created)
                      setContext(prev => ({ ...prev, lastReferencedCustomer: created }))
                    }
                  })
                  custInfoText = ` Customer: ${parsed.customer_name}.`
                }
              }

              // Handle optional discount / payment method in compound command
              if (parsed.discount_amount !== undefined) onSetDiscount(parsed.discount_amount, false)
              else if (parsed.discount_pct !== undefined) onSetDiscount(parsed.discount_pct, true)

              if (parsed.payment_method) {
                onSetPaymentMethod(parsed.payment_method, parsed.bank_provider)
                if (parsed.amount_paid) onSetAmountTendered(String(parsed.amount_paid))
              }

              if (parsed.spoken_response) {
                reply(parsed.spoken_response, 'ur')
              } else {
                reply(`${summaryText} cart mein shamil hogaye.${custInfoText ? ` ${custInfoText}` : ''}`, 'ur')
              }
            }
          }
          break
        }

        case 'SET_PRICE': {
          if (parsed.unit_price !== undefined) {
            if (!canEditPrice) {
              reply(`Aapko price tabdeel karne ki ijazat nahi hai.`, 'ur')
              return
            }

            let targetCartItem: CartItem | undefined

            // 1. Match by row / item number (e.g. "item no 1", "row 2", "pehli item")
            if (parsed.target_cart_row && parsed.target_cart_row >= 1 && parsed.target_cart_row <= currentCart.length) {
              targetCartItem = currentCart[parsed.target_cart_row - 1]
            }

            // 2. Match by SKU or product query
            if (!targetCartItem && parsed.product_query) {
              const q = parsed.product_query.toLowerCase().trim()
              const cleanQ = q.replace(/^(sku|code|item code|article|part number|no|number|item|row|sr|line|ایس کے یو|کوڈ|آرٹیکل|نمبر|آئٹم|رو)[-\s:]*/i, '').trim()
              const normQ = cleanQ.replace(/[^a-z0-9]/g, '')
              targetCartItem = currentCart.find(c => {
                const p = (c.item.part_number || '').toLowerCase().trim()
                const normP = p.replace(/[^a-z0-9]/g, '')
                const n = (c.item.name || '').toLowerCase()
                return p === q || p === cleanQ || (normP && normP === normQ) || n.includes(q) || n.includes(cleanQ)
              })
            }

            // 3. Fallback to last cart item
            if (!targetCartItem && currentCart.length > 0) {
              targetCartItem = currentCart[currentCart.length - 1]
            }

            if (targetCartItem) {
              const costPrice = targetCartItem.cost_price || targetCartItem.item.cost_price || 0
              if (costPrice > 0 && parsed.unit_price < costPrice) {
                reply(`"${targetCartItem.item.name}" ki price (Rs. ${parsed.unit_price.toLocaleString()}) uski cost price (Rs. ${costPrice.toLocaleString()}) se kam nahi hosakti.`, 'ur')
                return
              }

              const itemIdx = currentCart.findIndex(c => c.id === targetCartItem!.id)
              const rowTag = itemIdx !== -1 ? `[Row #${itemIdx + 1}] ` : ''
              onUpdatePrice(targetCartItem.id, parsed.unit_price)
              const skuTag = targetCartItem.item.part_number ? ` (SKU: ${targetCartItem.item.part_number})` : ''
              reply(`${rowTag}"${targetCartItem.item.name}${skuTag}" ki price Rs. ${parsed.unit_price.toLocaleString()} kardi gayi hai.`, 'ur')
            } else {
              reply(`Cart mein SKU ya row item nahi mila jiski price tabdeel ki ja sake.`, 'ur')
            }
          }
          break
        }

        case 'UPDATE_QTY': {
          let targetCartItem: CartItem | undefined

          // 1. Match by row / item number (e.g. "item no 1", "row 2", "pehli item")
          if (parsed.target_cart_row && parsed.target_cart_row >= 1 && parsed.target_cart_row <= currentCart.length) {
            targetCartItem = currentCart[parsed.target_cart_row - 1]
          }

          // 2. Match by SKU or product query
          if (!targetCartItem && parsed.product_query) {
            const q = parsed.product_query.toLowerCase().trim()
            const cleanQ = q.replace(/^(sku|code|item code|article|part number|no|number|item|row|sr|line|ایس کے یو|کوڈ|آرٹیکل|نمبر|آئٹم|رو)[-\s:]*/i, '').trim()
            const normQ = cleanQ.replace(/[^a-z0-9]/g, '')
            targetCartItem = currentCart.find(c => {
              const p = (c.item.part_number || '').toLowerCase().trim()
              const normP = p.replace(/[^a-z0-9]/g, '')
              const n = (c.item.name || '').toLowerCase()
              return p === q || p === cleanQ || (normP && normP === normQ) || n.includes(q) || n.includes(cleanQ)
            })
          }

          // 3. Fallback to last cart item
          if (!targetCartItem && currentCart.length > 0) {
            targetCartItem = currentCart[currentCart.length - 1]
          }

          if (targetCartItem && parsed.quantity !== undefined) {
            let newQty = parsed.quantity
            if (parsed.raw_command.includes('aur') || parsed.raw_command.includes('more') || parsed.raw_command.includes('اور')) {
              newQty = targetCartItem.qty + Math.abs(parsed.quantity)
            } else if (parsed.raw_command.includes('kam') || parsed.raw_command.includes('decrease') || parsed.raw_command.includes('reduce') || parsed.raw_command.includes('کم')) {
              newQty = Math.max(1, targetCartItem.qty - Math.abs(parsed.quantity))
            }

            const itemIdx = currentCart.findIndex(c => c.id === targetCartItem!.id)
            const rowTag = itemIdx !== -1 ? `[Row #${itemIdx + 1}] ` : ''
            onUpdateQty(targetCartItem.id, newQty)
            const skuTag = targetCartItem.item.part_number ? ` (SKU: ${targetCartItem.item.part_number})` : ''
            reply(`${rowTag}"${targetCartItem.item.name}${skuTag}" ki quantity ${newQty} kardi gayi hai.`, 'ur')
          } else {
            reply(`Cart mein SKU ya row item nahi mila.`, 'ur')
          }
          break
        }

        case 'REMOVE_ITEM': {
          let targetCartItem: CartItem | undefined

          // 1. Match by row / item number (e.g. "item no 1", "row 2", "pehli item")
          if (parsed.target_cart_row && parsed.target_cart_row >= 1 && parsed.target_cart_row <= currentCart.length) {
            targetCartItem = currentCart[parsed.target_cart_row - 1]
          }

          // 2. Match by SKU or product query
          if (!targetCartItem && parsed.product_query) {
            const q = parsed.product_query.toLowerCase().trim()
            const cleanQ = q.replace(/^(sku|code|item code|article|part number|no|number|item|row|sr|line|ایس کے یو|کوڈ|آرٹیکل|نمبر|آئٹم|رو)[-\s:]*/i, '').trim()
            const normQ = cleanQ.replace(/[^a-z0-9]/g, '')
            targetCartItem = currentCart.find(c => {
              const p = (c.item.part_number || '').toLowerCase().trim()
              const normP = p.replace(/[^a-z0-9]/g, '')
              const n = (c.item.name || '').toLowerCase()
              return p === q || p === cleanQ || (normP && normP === normQ) || n.includes(q) || n.includes(cleanQ)
            })
          }

          // 3. Fallback to last cart item
          if (!targetCartItem && currentCart.length > 0) {
            targetCartItem = currentCart[currentCart.length - 1]
          }

          if (targetCartItem) {
            const itemIdx = currentCart.findIndex(c => c.id === targetCartItem!.id)
            const rowTag = itemIdx !== -1 ? `[Row #${itemIdx + 1}] ` : ''
            onRemoveFromCart(targetCartItem.id)
            const skuTag = targetCartItem.item.part_number ? ` (SKU: ${targetCartItem.item.part_number})` : ''
            reply(`${rowTag}"${targetCartItem.item.name}${skuTag}" cart se nikal diya gaya hai.`, 'ur')
          } else {
            reply(`Cart mein nikalne ke liye item nahi mila.`, 'ur')
          }
          break
        }

        case 'SET_CUSTOMER': {
          if (parsed.needs_disambiguation && parsed.ambiguous_options) {
            setContext(prev => ({
              ...prev,
              pendingDisambiguation: {
                type: 'customer',
                options: parsed.ambiguous_options!,
                originalCommand: transcriptText
              }
            }))
            reply(`Ek se zyada customers mile hain. Aap konsa customer chahte hain?`, 'ur')
            return
          }

          if (parsed.matched_customer) {
            onSetCustomer(parsed.matched_customer)
            setContext(prev => ({ ...prev, lastReferencedCustomer: parsed.matched_customer }))
            const dueInfo = parsed.matched_customer.current_balance
              ? ` Note: Baqaya raqam Rs. ${parsed.matched_customer.current_balance.toLocaleString()} hai.`
              : ''
            reply(`Customer "${parsed.matched_customer.name}" set kardiya gaya hai.${dueInfo}`, 'ur')
          }
          break
        }

        case 'CREATE_CUSTOMER': {
          if (parsed.customer_name) {
            if (onCreateCustomer) {
              reply(`Naya customer "${parsed.customer_name}" shamil kiya ja raha hai...`, 'ur')
              const created = await onCreateCustomer({
                name: parsed.customer_name,
                phone: parsed.customer_phone
              })
              if (created) {
                onSetCustomer(created)
                setContext(prev => ({ ...prev, lastReferencedCustomer: created }))
                reply(`Customer "${created.name}" kamyabi se ban gaya hai aur bill mein set hogaya hai.`, 'ur')
              } else {
                reply(`Customer save nahi ho saka.`, 'ur')
              }
            } else {
              reply(`Customer "${parsed.customer_name}" system mein mojood nahi hai.`, 'ur')
            }
          }
          break
        }

        case 'SET_DISCOUNT': {
          if (parsed.discount_amount !== undefined) {
            onSetDiscount(parsed.discount_amount, false)
            reply(`Rs. ${parsed.discount_amount.toLocaleString()} discount apply kardiya gaya hai.`, 'ur')
          } else if (parsed.discount_pct !== undefined) {
            onSetDiscount(parsed.discount_pct, true)
            reply(`${parsed.discount_pct}% discount apply kardiya gaya hai.`, 'ur')
          }
          break
        }

        case 'SET_PAYMENT': {
          if (parsed.payment_method) {
            onSetPaymentMethod(parsed.payment_method, parsed.bank_provider)
            if (parsed.amount_paid) {
              onSetAmountTendered(String(parsed.amount_paid))
            }
            reply(`Payment method ${parsed.payment_method.toUpperCase()}${parsed.bank_provider ? ` (${parsed.bank_provider})` : ''} set kardiya gaya hai.`, 'ur')
          }
          break
        }

        case 'CLEAR_CART': {
          onClearCart()
          reply(`Cart mukammal khali kardiya gaya hai.`, 'ur')
          break
        }

        case 'HOLD_BILL': {
          onHoldBill()
          reply(`Maujooda bill hold kardiya gaya hai.`, 'ur')
          break
        }

        case 'CONFIRM_PROCEED': {
          if (currentCart.length === 0) {
            reply(`Cart khali hai. Pehle items shamil karein.`, 'ur')
            return
          }
          setIsCommitting(true)
          reply(`Sale complete ki ja rahi hai...`, 'ur')
          const success = await onCommitSale()
          setIsCommitting(false)
          if (success) {
            reply(`Sale kamyabi se complete hogayi! Invoice generate kardiya gaya hai.`, 'ur')
            onClose()
          }
          break
        }

        case 'CANCEL_DISCARD': {
          reply(`Voice command cancel kardiya gaya hai.`, 'ur')
          onClose()
          break
        }

        case 'REVIEW_INVOICE': {
          const itemCount = currentCart.reduce((s, i) => s + i.qty, 0)
          reply(`Bill summary: Total ${itemCount} items, Subtotal Rs. ${subtotal.toLocaleString()}, Grand Total Rs. ${grandTotal.toLocaleString()} hai. Sale complete karne ke liye Proceed bolein.`, 'ur')
          break
        }

        case 'CHECK_STOCK': {
          if (parsed.items && parsed.items[0]?.matched_item) {
            const item = parsed.items[0].matched_item
            const stock = item.quantity_on_hand ?? 0
            const price = item.retail_price
            const sku = item.part_number ? ` (SKU: ${item.part_number})` : ''
            if (parsed.spoken_response) {
              reply(parsed.spoken_response, 'ur')
            } else {
              reply(`"${item.name}${sku}" ka total stock ${stock} units mojood hai. Retail price Rs. ${price.toLocaleString()} hai.`, 'ur')
            }
          } else {
            reply(`"${parsed.product_query || 'Item'}" inventory mein nahi mila.`, 'ur')
          }
          break
        }

        default: {
          reply(`Main samajh nahi saka "${transcriptText}". Baraye meherbani dobara bolein ya SKU batayein.`, 'ur')
          break
        }
      }
    } catch (err: any) {
      playEarcon('error', isMuted)
      console.error('Voice processing error:', err)
      respond(`Voice processing mein masla aya. Baraye meherbani dobara bolein.`, 'ur')
    } finally {
      setRecordState('idle')
      isProcessingRef.current = false
    }
  }, [
    catalog, customers, context, canEditPrice, currentCart, subtotal, grandTotal,
    onAddToCart, onUpdateQty, onUpdatePrice, onRemoveFromCart, onSetCustomer, onCreateCustomer,
    onSetDiscount, onSetPaymentMethod, onSetAmountTendered, onClearCart, onHoldBill, onCommitSale,
    onClose, respond, isMuted
  ])

  // Safe ref for processTranscript
  const processTranscriptRef = useRef(processTranscript)
  useEffect(() => {
    processTranscriptRef.current = processTranscript
  }, [processTranscript])

  // Scroll message feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, interimTranscript])

  // Sync context when cart/customer changes from parent
  useEffect(() => {
    setContext(prev => ({
      ...prev,
      currentCart,
      lastReferencedCustomer: currentCustomer
    }))
  }, [currentCart, currentCustomer])

  // Helper: Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Finalize PCM samples buffer into a compliant 16kHz WAV Blob and send to Whisper
  const finalizeAudioAndTranscribe = useCallback(async () => {
    const buffers = pcmBuffersRef.current
    pcmBuffersRef.current = []

    if (!buffers || buffers.length === 0) {
      setRecordState('idle')
      return
    }

    let totalLength = 0
    for (const b of buffers) totalLength += b.length

    if (totalLength < 3200) {
      setRecordState('idle')
      return
    }

    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const b of buffers) {
      merged.set(b, offset)
      offset += b.length
    }

    const sampleRate = audioContextRef.current?.sampleRate || 44100
    const downsampled = downsampleBuffer(merged, sampleRate, 16000)
    const wavBlob = encodeWAV(downsampled, 16000)

    try {
      setRecordState('transcribing')
      isProcessingRef.current = true
      setInterimTranscript('Transcribing speech...')

      const base64Data = await blobToBase64(wavBlob)
      if (window.api?.transcribeAudio) {
        const res = await window.api.transcribeAudio(base64Data, 'audio/wav', activeLanguage)
        if (res && res.success && res.text && res.text.trim()) {
          const trimmed = res.text.trim()
          setInterimTranscript('')
          setMicError(null)
          processTranscriptRef.current(trimmed)
        } else if (res && !res.success) {
          // If no speech detected or filtered silence hallucination, silently reset without annoying popup
          if (res.error === 'No speech detected' || res.error?.includes('short')) {
            setInterimTranscript('')
            setRecordState('idle')
          } else {
            const errText = res.error || 'Failed to transcribe audio'
            playEarcon('error', isMuted)
            setMicError(`Voice Recognition note: ${errText}`)
            setInterimTranscript('')
            setRecordState('idle')
          }
        } else {
          setInterimTranscript('')
          setRecordState('idle')
        }
      }
    } catch (err: any) {
      playEarcon('error', isMuted)
      console.warn('Audio transcription dispatch error:', err)
      setMicError(`Transcription dispatch error: ${err.message}`)
      setInterimTranscript('')
      setRecordState('idle')
    } finally {
      isProcessingRef.current = false
    }
  }, [activeLanguage, isMuted])

  // ─── Manual Start Recording ───
  const startRecording = useCallback(() => {
    if (recordState === 'transcribing') return
    playEarcon('start', isMuted)
    pcmBuffersRef.current = []
    isRecordingRef.current = true
    setRecordState('recording')
    setRecordDuration(0)
    setMicError(null)
    setInterimTranscript('Listening... Speak now (Click Stop or press Spacebar when finished)')

    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    durationTimerRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1)
    }, 1000)
  }, [recordState, isMuted])

  // ─── Manual Stop Recording ───
  const stopRecordingAndTranscribe = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }

    isRecordingRef.current = false
    finalizeAudioAndTranscribe()
  }, [finalizeAudioAndTranscribe])

  // Keyboard shortcut: Spacebar toggles recording when not in manual input box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && isOpen) {
        e.preventDefault()
        if (recordState === 'recording') {
          stopRecordingAndTranscribe()
        } else if (recordState === 'idle') {
          startRecording()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, recordState, startRecording, stopRecordingAndTranscribe])

  // ============================================================
  // PURE WEB AUDIO HARDWARE ENGINE (16kHz PCM WAV CAPTURE)
  // ============================================================
  useEffect(() => {
    if (!isOpen) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }
      setAudioLevel(0)
      setRecordState('idle')
      isRecordingRef.current = false
      return
    }

    let isMounted = true

    navigator.mediaDevices?.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
      .then(stream => {
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        mediaStreamRef.current = stream

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          audioContextRef.current = ctx
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.3
          source.connect(analyser)
          analyserRef.current = analyser

          const processor = ctx.createScriptProcessor(4096, 1, 1)
          processor.onaudioprocess = (e) => {
            if (!isMounted) return
            const channelData = e.inputBuffer.getChannelData(0)
            if (isRecordingRef.current) {
              pcmBuffersRef.current.push(new Float32Array(channelData))
            }
          }
          source.connect(processor)
          processor.connect(ctx.destination)
          processorRef.current = processor

          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          const updateMeter = () => {
            if (!analyserRef.current || !isMounted) return
            analyserRef.current.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const avg = sum / dataArray.length
            const level = Math.min(100, Math.round((avg / 128) * 100))
            setAudioLevel(level)

            animFrameRef.current = requestAnimationFrame(updateMeter)
          }
          updateMeter()
        }
      })
      .catch(err => {
        console.warn('Microphone stream error:', err)
        setMicError(`Microphone access error: ${err.message || 'Permission denied or no microphone found'}`)
      })

    return () => {
      isMounted = false
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isOpen, finalizeAudioAndTranscribe])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) {
      processTranscript(manualInput.trim())
      setManualInput('')
    }
  }

  const handleSelectDisambig = (item: any) => {
    setContext(prev => ({ ...prev, pendingDisambiguation: null }))
    if (context.pendingDisambiguation?.type === 'product') {
      onAddToCart(item as Item, 1)
      respond(`Added ${item.name} to cart.`)
    } else if (context.pendingDisambiguation?.type === 'customer') {
      onSetCustomer(item as Customer)
      respond(`Customer set to ${item.name}.`)
    }
  }

  if (!isOpen) return null

  // ─── Compact Floating Capsule Mode (Initial Default on Open) ───
  if (isCompactMode) {
    return (
      <>
        <style>{`
          @keyframes voiceCapsuleEnter {
            0% {
              opacity: 0;
              transform: translate(-50%, 35px) scale(0.92);
            }
            100% {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
          }
          @keyframes voiceCardZoomIn {
            0% {
              opacity: 0;
              transform: scale(0.68) translateY(120px);
            }
            70% {
              opacity: 1;
              transform: scale(1.015) translateY(-4px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          @keyframes voiceOverlayFadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}</style>
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
          width: 'min(780px, 94vw)',
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 20,
          padding: '10px 16px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(16, 185, 129, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'voiceCapsuleEnter 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {/* Mic Action Button */}
          {recordState === 'recording' ? (
            <button
              type="button"
              onClick={stopRecordingAndTranscribe}
              className="btn btn-danger btn-sm"
              style={{ padding: '8px 14px', gap: 6, fontWeight: 700, borderRadius: 12, flexShrink: 0 }}
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={recordState === 'transcribing'}
              className="btn btn-primary btn-sm"
              style={{ padding: '8px 14px', gap: 6, fontWeight: 700, borderRadius: 12, flexShrink: 0 }}
            >
              <Mic size={14} /> Speak
            </button>
          )}

          {/* Symmetrical Waveform */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 18, width: 80, flexShrink: 0 }}>
            {WAVE_MULTIPLIERS.map((multiplier, idx) => {
              const barHeight = Math.max(3, Math.min(18, Math.round((audioLevel / 100) * 18 * multiplier)))
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: barHeight,
                    background: recordState === 'recording'
                      ? 'linear-gradient(to top, #ef4444, #f87171)'
                      : (audioLevel > 5 ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)'),
                    borderRadius: 1.5,
                    transition: 'height 0.08s ease'
                  }}
                />
              )
            })}
          </div>

          {/* Status or Latest Spoken Command (Clickable to Zoom) */}
          <div
            onClick={() => setIsCompactMode(false)}
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
            title="Click to Zoom into full card view"
          >
            {recordState === 'transcribing' ? (
              <span style={{ color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} className="animate-spin" /> Transcribing speech...
              </span>
            ) : recordState === 'recording' ? (
              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                Listening ({recordDuration}s)...
              </span>
            ) : (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {interimTranscript || (messages.length > 0 ? messages[messages.length - 1].text : 'Press Spacebar or click Speak')}
              </span>
            )}
          </div>

          {/* Cart Summary Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0
          }}>
            <span style={{ color: 'var(--color-primary)' }}>{currentCart.reduce((s, i) => s + i.qty, 0)} items</span>
            <span style={{ color: 'var(--color-text-muted)' }}>•</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {grandTotal.toLocaleString()}</span>
          </div>

          {/* Quick Complete Sale button */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              if (currentCart.length === 0) {
                toast.error('Cart is empty. Add items first.')
                return
              }
              setIsCommitting(true)
              const ok = await onCommitSale()
              setIsCommitting(false)
              if (ok) onClose()
            }}
            disabled={isCommitting || currentCart.length === 0}
            style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 10, flexShrink: 0 }}
          >
            {isCommitting ? 'Saving...' : 'Complete'}
          </button>

          {/* Zoom to Card Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsCompactMode(false)}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              gap: 6,
              fontWeight: 700,
              fontSize: '0.75rem',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0
            }}
            title="Zoom into Full Voice Invoice Card"
          >
            <Maximize2 size={13} />
            <span>Zoom Card</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0
            }}
            title="Close Voice Assistant (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </>
    )
  }

  // ─── Full Studio Modal Mode (Zoomed Card View) ───
  return (
    <div className="modal-overlay" style={{
      zIndex: 1100,
      backdropFilter: 'blur(8px)',
      background: 'rgba(7, 11, 20, 0.85)',
      animation: 'voiceOverlayFadeIn 0.22s ease-out forwards'
    }}>
      <div className="modal" style={{
        maxWidth: 960, width: '95%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
        animation: 'voiceCardZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: recordState === 'recording' ? 'var(--color-danger)' : (audioLevel > 5 ? 'var(--color-primary-gradient)' : 'rgba(16, 185, 129, 0.18)'),
              color: recordState === 'recording' || audioLevel > 5 ? '#fff' : 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recordState === 'recording' ? '0 0 20px rgba(239, 68, 68, 0.6)' : (audioLevel > 5 ? '0 0 16px rgba(16, 185, 129, 0.4)' : 'none'),
              transition: 'all 0.15s ease'
            }}>
              <Mic size={20} className={recordState === 'recording' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.2px' }}>Voice POS Assistant</h3>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                  background: recordState === 'transcribing' ? 'rgba(99,102,241,0.18)' : (recordState === 'recording' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.12)'),
                  color: recordState === 'transcribing' ? '#818cf8' : (recordState === 'recording' ? '#ef4444' : 'var(--color-primary)'),
                  border: `1px solid ${recordState === 'transcribing' ? 'rgba(99, 102, 241, 0.35)' : (recordState === 'recording' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.25)')}`,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: recordState === 'transcribing' ? '#818cf8' : (recordState === 'recording' ? '#ef4444' : 'var(--color-primary)'),
                    animation: recordState === 'recording' ? 'ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite' : (recordState === 'transcribing' ? 'pulse 1.5s infinite' : 'none')
                  }} />
                  {recordState === 'transcribing' ? 'Transcribing...' : (recordState === 'recording' ? `Recording (${recordDuration}s)` : 'Ready')}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                Push-to-talk speech recognition • Press Spacebar or click Speak
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Language switch */}
            <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 8, padding: 2, border: '1px solid var(--color-border)' }}>
              {(['auto', 'en', 'ur'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setActiveLanguage(l)}
                  style={{
                    padding: '4px 10px', fontSize: '0.6875rem', fontWeight: activeLanguage === l ? 700 : 500,
                    background: activeLanguage === l ? 'var(--color-primary)' : 'transparent',
                    color: activeLanguage === l ? '#fff' : 'var(--color-text-secondary)',
                    border: 'none', borderRadius: 6, cursor: 'pointer'
                  }}
                >
                  {l === 'auto' ? 'Auto (EN/UR)' : l === 'en' ? 'English' : 'Urdu (اردو)'}
                </button>
              ))}
            </div>

            {/* Audio chimes mute toggle */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const nextMuted = !isMuted
                setIsMuted(nextMuted)
                speechSynthesizer.setMuted(nextMuted)
              }}
              style={{ padding: '6px 10px' }}
              title={isMuted ? 'Unmute audio chimes' : 'Mute audio chimes'}
            >
              {isMuted ? <VolumeX size={14} style={{ color: 'var(--color-danger)' }} /> : <Volume2 size={14} style={{ color: 'var(--color-primary)' }} />}
            </button>

            {/* Minimize back to Floating Capsule */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCompactMode(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
              title="Minimize back to Floating Capsule at bottom"
            >
              <Minimize2 size={13} />
              <span>Capsule</span>
            </button>

            <button className="modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRIMARY VOICE CONTROLLER & EQUALIZER BAR */}
        <div style={{
          background: 'var(--color-surface)',
          padding: '12px 22px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          {/* Big Speak/Stop Button with Keyboard Prompt */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {recordState === 'recording' ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={stopRecordingAndTranscribe}
                style={{ fontWeight: 700, padding: '8px 18px', gap: 8, fontSize: '0.8125rem' }}
              >
                <Square size={14} fill="currentColor" /> Stop &amp; Transcribe (Space)
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={startRecording}
                disabled={recordState === 'transcribing'}
                style={{ fontWeight: 700, padding: '8px 18px', gap: 8, fontSize: '0.8125rem' }}
              >
                <Mic size={15} /> Start Speaking (Space)
              </button>
            )}

            {/* Dynamic Symmetrical Audio Waveform Visualizer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 8, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: 2.5, alignItems: 'center', height: 20, width: 104 }}>
                {WAVE_MULTIPLIERS.map((multiplier, idx) => {
                  const barHeight = Math.max(3, Math.min(20, Math.round((audioLevel / 100) * 20 * multiplier)))
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: barHeight,
                        background: recordState === 'recording'
                          ? 'linear-gradient(to top, #ef4444, #f87171)'
                          : (audioLevel > 5 ? 'linear-gradient(to top, #10B981, #6366F1)' : 'rgba(255,255,255,0.12)'),
                        borderRadius: 1.5,
                        transition: 'height 0.08s ease'
                      }}
                    />
                  )
                })}
              </div>
              <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: audioLevel > 5 ? 'var(--color-primary)' : 'var(--color-text-muted)', minWidth: 26, textAlign: 'right' }}>
                {audioLevel}%
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Speak item names, SKU numbers, quantities, or prices
          </div>
        </div>

        {/* Error / Diagnostic Note (if any) */}
        {micError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
            padding: '8px 20px',
            fontSize: '0.75rem',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{micError}</div>
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => setMicError(null)}
              style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* MODAL BODY (TWO COLUMN: DIALOG & INVOICE REVIEW) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 400 }}>

          {/* LEFT: CONVERSATIONAL STREAM & TRANSCRIPTS */}
          <div style={{
            flex: 1.1, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)'
          }}>
            {/* Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(16,185,129,0.1)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Mic size={20} />
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Speech Recognition Ready</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Click <strong>Start Speaking</strong> or press <strong>Spacebar</strong> to issue voice commands:</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16, textAlign: 'left' }}>
                    <button
                      type="button"
                      onClick={() => processTranscript("3 Zellbury with price 7000 and customer name Hamza")}
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.6875rem' }}>Full Bill 1-Shot</div>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>"3 Zellbury price 7000 customer Hamza"</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => processTranscript("Yeh item kitni available hai?")}
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.6875rem' }}>Stock Inquiry</div>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>"Yeh item kitni available hai?"</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => processTranscript("2 SKU 101 2500 mein add kardo")}
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.6875rem' }}>Add by SKU</div>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>"2 SKU 101 2500 mein add kardo"</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => processTranscript("Proceed")}
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.6875rem' }}>Checkout &amp; Finalize</div>
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>"Paid cash", "Proceed"</div>
                    </button>
                  </div>
                </div>
              )}

              {messages.map(msg => {
                const llmMeta = msg.parsed?.llm_meta
                const matchConfidence = msg.parsed
                  ? ((msg.parsed.confidence && msg.parsed.confidence <= 1)
                    ? Math.round(msg.parsed.confidence * 100)
                    : (msg.parsed.confidence ?? (msg.parsed.intent !== 'UNKNOWN' ? 98 : 45)))
                  : null

                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      background: msg.sender === 'user' ? 'var(--color-primary-gradient)' : 'var(--color-surface-2)',
                      color: msg.sender === 'user' ? '#fff' : 'var(--color-text)',
                      padding: '10px 14px',
                      borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--color-border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      fontSize: '0.875rem',
                      lineHeight: 1.4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                      <div style={{ fontSize: '0.6875rem', opacity: msg.sender === 'user' ? 0.85 : 0.7, fontWeight: 700 }}>
                        {msg.sender === 'user' ? 'Spoken Command' : 'Voice Assistant'}
                      </div>

                      {msg.sender === 'assistant' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Confidence Score Pill */}
                          {matchConfidence !== null && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                              background: matchConfidence >= 90 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: matchConfidence >= 90 ? 'var(--color-primary)' : '#f59e0b',
                              border: `1px solid ${matchConfidence >= 90 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                            }}>
                              {matchConfidence}% match
                            </span>
                          )}

                          {llmMeta && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                              background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)'
                            }}>
                              {llmMeta.latencyMs ? `${llmMeta.latencyMs}ms` : 'Matched'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>{msg.text}</div>
                  </div>
                )
              })}

              {/* Live Reasoning Thinking Bubble */}
              {recordState === 'transcribing' && (
                <div style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '0.8125rem',
                  color: '#818cf8',
                  animation: 'pulse 1.2s infinite ease-in-out'
                }}>
                  <Sparkles size={14} className="animate-spin" />
                  <span>Analyzing speech with live catalog context...</span>
                </div>
              )}

              {/* Interim Live Speech Bubble */}
              {interimTranscript && (
                <div style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: 'var(--color-primary)',
                  padding: '8px 14px',
                  borderRadius: 12,
                  border: '1px dashed var(--color-primary)',
                  fontSize: '0.8125rem',
                  fontStyle: 'italic',
                  animation: 'pulse 1.5s infinite'
                }}>
                  {interimTranscript}
                </div>
              )}

              {/* Disambiguation Picker Card */}
              {context.pendingDisambiguation && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: 12, padding: 14, marginTop: 6
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#818cf8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> Select {context.pendingDisambiguation.type === 'product' ? 'Product' : 'Customer'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {context.pendingDisambiguation.options.map(opt => (
                      <button
                        key={opt.id}
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectDisambig(opt.data)}
                        style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.75rem' }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{opt.label}</div>
                          {opt.sublabel && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.sublabel}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Manual text backup input */}
            <form onSubmit={handleManualSubmit} style={{
              padding: '12px 16px', background: 'var(--color-surface-2)',
              borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center'
            }}>
              <input
                type="text"
                className="form-input"
                placeholder="Speak naturally or type SKU command here (e.g. 2 SKU 101 2500 mein add kardo)..."
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                style={{ flex: 1, fontSize: '0.8125rem' }}
              />

              <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '8px 14px', fontWeight: 700 }}>
                <Send size={13} /> Send
              </button>
            </form>
          </div>

          {/* RIGHT: REAL-TIME VOICE INVOICE REVIEW TABLE */}
          <div style={{
            flex: 0.9, display: 'flex', flexDirection: 'column',
            background: 'var(--color-surface-2)', padding: 18, overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)' }}>
                Live Invoice Review
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {currentCart.reduce((s, i) => s + i.qty, 0)} items
              </div>
            </div>

            {/* Customer Pill */}
            <div style={{
              background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--color-border)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10
            }}>
              <User size={16} style={{ color: 'var(--color-primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  {currentCustomer ? currentCustomer.name : 'Walk-in Customer'}
                </div>
              </div>
              {currentCustomer?.current_balance ? (
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-danger)', fontWeight: 700 }}>
                  Due: Rs. {currentCustomer.current_balance.toLocaleString()}
                </div>
              ) : null}
            </div>

            {/* Items Table with Inline Stepper & Row Remove */}
            <div style={{
              flex: 1, background: 'var(--color-surface)', borderRadius: 10,
              border: '1px solid var(--color-border)', overflowY: 'auto', marginBottom: 12, maxHeight: 220
            }}>
              {currentCart.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  Cart is empty. Speak or type to add items.
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 34, textAlign: 'center' }}>#</th>
                      <th>Product / SKU</th>
                      <th style={{ textAlign: 'center', width: 78 }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: 26 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCart.map((c, idx) => (
                      <tr key={c.id}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 800, padding: '2px 5px',
                            borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: 'var(--color-primary)', display: 'inline-block'
                          }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.item.name}</div>
                          {c.item.part_number ? (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                              SKU: {c.item.part_number}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: 'var(--color-surface-2)', borderRadius: 6,
                            padding: '2px 4px', border: '1px solid var(--color-border)'
                          }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (c.qty > 1) onUpdateQty(c.id, c.qty - 1)
                                else onRemoveFromCart(c.id)
                              }}
                              style={{
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                padding: '0 2px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center'
                              }}
                              title="Decrease qty"
                            >
                              <Minus size={11} />
                            </button>
                            <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              {c.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(c.id, c.qty + 1)}
                              style={{
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                padding: '0 2px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center'
                              }}
                              title="Increase qty"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Rs. {c.unit_price}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                          Rs. {c.line_total}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => onRemoveFromCart(c.id)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              color: 'var(--color-text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center',
                              borderRadius: 4
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            title="Remove item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Math Breakdown */}
            <div style={{
              background: 'var(--color-surface)', padding: 14, borderRadius: 10,
              border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Discount:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-danger)', fontWeight: 600 }}>
                  - Rs. {totalDiscount.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 6, marginTop: 2 }}>
                <span style={{ fontWeight: 700 }}>Grand Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-primary)' }}>
                  Rs. {grandTotal.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                <span>Payment Method:</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  {currentPaymentMethod} {currentBankProvider ? `(${currentBankProvider})` : ''}
                </span>
              </div>
            </div>

            {/* Voice Confirmation Gate Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                style={{ flex: 1, padding: '10px 0', fontSize: '0.75rem' }}
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (currentCart.length === 0) {
                    toast.error('Cart is empty. Add items first.')
                    return
                  }
                  setIsCommitting(true)
                  const ok = await onCommitSale()
                  setIsCommitting(false)
                  if (ok) onClose()
                }}
                disabled={isCommitting || currentCart.length === 0}
                style={{ flex: 2, padding: '10px 0', fontWeight: 700, fontSize: '0.875rem' }}
              >
                {isCommitting ? 'Completing...' : 'Complete Sale (Say "Proceed")'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
