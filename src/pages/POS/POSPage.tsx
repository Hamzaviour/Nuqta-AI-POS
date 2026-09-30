import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard,
  Banknote, Smartphone, Printer, Package, Tag, AlertCircle, Edit2,
  X, CheckCircle, Pause, Play, RefreshCw, ChevronDown,
  Store, Share2, Globe, MessageCircle, Sparkles, Check, Boxes, Layers, Filter,
  ChevronLeft, ChevronRight, History, Copy, Clock, Calendar, FileText, Eye, ArrowLeft, ArrowRight,
  DollarSign, Receipt, Wallet, ArrowDownRight, ArrowUpRight, TrendingDown, RotateCcw,
  Mic
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHotkeys } from '../../contexts/HotkeyContext'
import type { Item, CartItem, Customer, Invoice, InvoiceItem, Expense, CreateExpenseInput, POSSummary } from '../../types'
import { ReceiptPreviewModal } from '../../components/common/ReceiptPreviewModal'
import { VoicePOSModal } from '../../components/voice/VoicePOSModal'
import defaultInvoiceLogo from '../../assets/brand/nuqta-receipt.png'
import defaultWhatsAppQR from '../../assets/whatsapp_qr.png'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'

// Branded WhatsApp icon
const WhatsAppBrandIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.886-9.888 9.886m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

let cartItemCounter = 0
const genCartId = () => `ci-${++cartItemCounter}`

let sessionSequence = 1
export interface POSSession {
  id: string
  label: string
  isHeld: boolean
  cart: CartItem[]
  customer: Customer | null
  source: 'instore' | 'whatsapp' | 'socialmedia'
  invoiceDiscount: number
  paymentMethod: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial'
  bankProvider: 'JazzCash' | 'EasyPaisa' | 'Other Bank'
  otherBankName: string
  bankRef: string
  amountTendered: string
  notes: string
  onlineContact: string
  createdAt: number
}

const createNewSession = (customLabel?: string): POSSession => ({
  id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: customLabel || `Sale ${sessionSequence++}`,
  isHeld: false,
  cart: [],
  customer: null,
  source: 'instore',
  invoiceDiscount: 0,
  paymentMethod: 'cash',
  bankProvider: 'JazzCash',
  otherBankName: '',
  bankRef: '',
  amountTendered: '',
  notes: '',
  onlineContact: '',
  createdAt: Date.now()
})

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function POSPage() {
  const { currentUser, canViewCostPrice, canViewProfit, canVoidInvoice, discountLimit } = useAuth()

  // ---- Multi-Session Tabs State ----
  const [sessions, setSessions] = useState<POSSession[]>([createNewSession('Sale 1')])
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || '')

  const navigate = useNavigate()

  // Fallback active session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || createNewSession('Sale 1')

  // Helper to update active session
  const updateActiveSession = useCallback((updater: (prev: POSSession) => POSSession) => {
    setSessions(prevList =>
      prevList.map(s => (s.id === activeSession.id ? updater(s) : s))
    )
  }, [activeSession.id])

  // Getters for active session fields
  const cart            = activeSession.cart
  const customer        = activeSession.customer
  const source          = activeSession.source
  const invoiceDiscount = activeSession.invoiceDiscount
  const paymentMethod   = activeSession.paymentMethod
  const bankProvider    = activeSession.bankProvider
  const otherBankName   = activeSession.otherBankName
  const bankRef         = activeSession.bankRef
  const amountTendered  = activeSession.amountTendered
  const notes           = activeSession.notes
  const onlineContact   = activeSession.onlineContact

  // Setters bound to active session
  const setCart = (cartOrFn: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    updateActiveSession(s => ({
      ...s,
      cart: typeof cartOrFn === 'function' ? cartOrFn(s.cart) : cartOrFn
    }))
  }
  const setCustomer = (customer: Customer | null) => {
    updateActiveSession(s => ({
      ...s,
      customer,
      label: s.isHeld ? s.label : (customer ? customer.name : s.label)
    }))
  }
  const setSource = (source: 'instore' | 'whatsapp' | 'socialmedia') => {
    updateActiveSession(s => ({ ...s, source }))
  }
  const setInvoiceDiscount = (invoiceDiscount: number) => {
    updateActiveSession(s => ({ ...s, invoiceDiscount }))
  }
  const setPaymentMethod = (paymentMethod: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial') => {
    updateActiveSession(s => ({ ...s, paymentMethod }))
  }
  const setBankProvider = (bankProvider: 'JazzCash' | 'EasyPaisa' | 'Other Bank') => {
    updateActiveSession(s => ({ ...s, bankProvider }))
  }
  const setOtherBankName = (otherBankName: string) => {
    updateActiveSession(s => ({ ...s, otherBankName }))
  }
  const setBankRef = (bankRef: string) => {
    updateActiveSession(s => ({ ...s, bankRef }))
  }
  const setAmountTendered = (amountTendered: string) => {
    updateActiveSession(s => ({ ...s, amountTendered }))
  }
  const setNotes = (notes: string) => {
    updateActiveSession(s => ({ ...s, notes }))
  }
  const setOnlineContact = (onlineContact: string) => {
    updateActiveSession(s => ({ ...s, onlineContact }))
  }

  // ---- UI State ----
  const [selectedCartIdx, setSelectedCartIdx]     = useState<number>(0)
  const [showSearch, setShowSearch]               = useState(false)
  const [showPayment, setShowPayment]             = useState(false)
  const [showCustomer, setShowCustomer]           = useState(false)
  const [showPreviousSales, setShowPreviousSales] = useState(false)
  const [showExpense, setShowExpense]             = useState(false)
  const [showPriceEdit, setShowPriceEdit]         = useState(false)
  const [priceEditItem, setPriceEditItem]         = useState<CartItem | null>(null)
  const [showVoiceModal, setShowVoiceModal]       = useState(false)
  const [allCatalogItems, setAllCatalogItems]     = useState<Item[]>([])
  const [allCustomersList, setAllCustomersList]   = useState<Customer[]>([])
  const [settings, setSettings]                   = useState<Record<string, string>>({})
  const [posSummary, setPosSummary]               = useState<POSSummary | null>(null)
  const [showReceipt, setShowReceipt]             = useState(false)
  const [receiptData, setReceiptData]             = useState<{
    number: string
    total: number
    subtotal?: number
    discountAmount?: number
    change?: number
    items?: CartItem[]
    historyItems?: InvoiceItem[]
    customer?: Customer | { name: string; phone?: string; whatsapp?: string } | null
    customerName?: string
    customerPhone?: string
    staffName?: string
    paymentMethod: string
    paymentDetails?: string
    amountPaid?: number
    balanceDue?: number
    dateStr?: string
    timeStr?: string
    status?: string
  } | null>(null)
  const [lastInvoice, setLastInvoice]             = useState<{ number: string; total: number; change: number; paymentDetails?: string } | null>(null)
  const [processing, setProcessing]               = useState(false)

  // Load items and customers for voice agent catalog resolution
  const loadVoiceData = useCallback(async () => {
    try {
      const [items, custs] = await Promise.all([
        window.api.getAllItems(),
        window.api.getAllCustomers()
      ])
      if (Array.isArray(items)) setAllCatalogItems(items)
      if (Array.isArray(custs)) setAllCustomersList(custs)
    } catch (e) {
      console.error('Error loading voice catalog and customer data:', e)
    }
  }, [])

  useEffect(() => {
    loadVoiceData()
  }, [loadVoiceData])

  useEffect(() => {
    window.api.getAllSettings().then(s => setSettings(s as unknown as Record<string, string> || {}))
  }, [])

  const posPriceSetting = settings['pos_allow_price_edit']
  const canEditPrice =
    currentUser?.role === 'owner' ||
    posPriceSetting === '1' ||
    posPriceSetting === undefined ||
    (posPriceSetting === 'per_user' && Boolean(currentUser?.perm_edit_price))

  const showCostInPriceEdit = settings['pos_show_cost_in_price_edit'] !== '0'

  // Load POS Drawer Summary
  const loadPosSummary = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await window.api.getTodayPOSSummary(currentUser.id)
      if (res.success && res.data) {
        setPosSummary(res.data)
      }
    } catch (err) {
      console.error('Failed to load POS drawer summary', err)
    }
  }, [currentUser])

  useEffect(() => {
    loadPosSummary()
  }, [loadPosSummary])

  // Computed totals
  const subtotal       = cart.reduce((s, i) => s + i.unit_price * i.qty, 0)
  const lineDiscounts  = cart.reduce((s, i) => s + (i.unit_price * i.qty * i.discount_pct / 100), 0)
  const totalDiscount  = lineDiscounts + invoiceDiscount
  const grandTotal     = Math.max(0, subtotal - totalDiscount)
  const costTotal      = cart.reduce((s, i) => s + i.cost_price * i.qty, 0)
  const profit         = grandTotal - costTotal
  const tendered       = parseFloat(amountTendered) || 0
  const change         = Math.max(0, tendered - grandTotal)

  // ---- NAVIGATION & SESSION ACTIONS ----

  // 1. Hold current invoice & move to next
  const handleHoldAndNext = () => {
    if (cart.length === 0 && !activeSession.isHeld) {
      toast('Current invoice is empty. You can start adding items or switch tabs.', { icon: 'ℹ️' })
      return
    }

    const currentIdx = sessions.findIndex(s => s.id === activeSession.id)
    const baseLabel = customer?.name || `Sale ${currentIdx + 1}`
    const heldLabel = baseLabel.startsWith('Held ') ? baseLabel : `Held ${baseLabel}`

    setSessions(prev => {
      // Mark active as held
      const updated = prev.map(s =>
        s.id === activeSession.id ? { ...s, isHeld: true, label: heldLabel } : s
      )

      // Find an empty non-held session to jump to
      const emptyIdx = updated.findIndex(s => s.id !== activeSession.id && !s.isHeld && s.cart.length === 0)
      if (emptyIdx !== -1) {
        setActiveSessionId(updated[emptyIdx].id)
        toast.success(`Invoice held (${heldLabel}). Switched to ${updated[emptyIdx].label}.`, { duration: 2500 })
        return updated
      }

      // Otherwise create a fresh session
      const newSess = createNewSession()
      setActiveSessionId(newSess.id)
      toast.success(`Invoice held (${heldLabel}). Started new ${newSess.label}.`, { duration: 2500 })
      return [...updated, newSess]
    })
  }

  // 2. Toggle Hold status on a session
  const handleToggleHold = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSessions(prev =>
      prev.map((s, idx) => {
        if (s.id === sessionId) {
          const nextHeld = !s.isHeld
          let nextLabel = s.label
          if (nextHeld) {
            if (!nextLabel.startsWith('Held ')) {
              nextLabel = `Held ${nextLabel}`
            }
          } else {
            nextLabel = nextLabel.replace(/^Held\s+/i, '')
            if (!nextLabel.trim()) {
              nextLabel = s.customer?.name || `Sale ${idx + 1}`
            }
          }
          toast(nextHeld ? `Invoice "${nextLabel}" held` : `Invoice "${nextLabel}" unheld`, {
            icon: nextHeld ? '⏸️' : '▶️',
            duration: 2000
          })
          return { ...s, isHeld: nextHeld, label: nextLabel }
        }
        return s
      })
    )
  }

  // 3. Navigate to Previous Invoice
  const handlePrevInvoice = () => {
    if (sessions.length <= 1) return
    const currentIdx = sessions.findIndex(s => s.id === activeSession.id)
    const prevIdx = (currentIdx - 1 + sessions.length) % sessions.length
    const targetSession = sessions[prevIdx]
    setActiveSessionId(targetSession.id)
    toast(`Switched to ${targetSession.label}`, { icon: '⬅️', duration: 1500 })
  }

  // 4. Navigate to Next Invoice
  const handleNextInvoice = () => {
    if (sessions.length <= 1) return
    const currentIdx = sessions.findIndex(s => s.id === activeSession.id)
    const nextIdx = (currentIdx + 1) % sessions.length
    const targetSession = sessions[nextIdx]
    setActiveSessionId(targetSession.id)
    toast(`Switched to ${targetSession.label}`, { icon: '➡️', duration: 1500 })
  }

  // 5. Create a brand new session tab
  const handleNewInvoiceTab = () => {
    const newSess = createNewSession()
    setSessions(prev => [...prev, newSess])
    setActiveSessionId(newSess.id)
    toast.success(`Opened new ${newSess.label} tab (F3)`, { duration: 1500 })
  }

  // 6. Close a session tab
  const handleCloseSessionTab = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = sessions.find(s => s.id === sessionId)
    if (!target) return

    if (target.cart.length > 0) {
      if (!window.confirm(`Close "${target.label}"? The ${target.cart.length} item(s) in this cart will be cleared.`)) {
        return
      }
    }

    if (sessions.length === 1) {
      // Just reset the single session
      handleNewSale()
      return
    }

    const currentIdx = sessions.findIndex(s => s.id === sessionId)
    const filtered = sessions.filter(s => s.id !== sessionId)
    setSessions(filtered)

    if (activeSession.id === sessionId) {
      const nextActive = filtered[Math.min(currentIdx, filtered.length - 1)]
      setActiveSessionId(nextActive.id)
    }
  }

  // 7. Load previous completed invoice items to active POS cart
  const handleLoadInvoiceItemsToCart = async (items: InvoiceItem[], invoiceNum: string) => {
    if (!items || items.length === 0) {
      toast.error('No items found in this invoice')
      return
    }

    try {
      const allDbItems = await window.api.getAllItems()
      const itemMap = new Map(allDbItems.map(i => [i.id, i]))

      let addedCount = 0
      for (const invItem of items) {
        const itemObj = itemMap.get(invItem.item_id)
        if (itemObj) {
          addToCart(itemObj, invItem.qty)
          addedCount++
        }
      }

      setShowPreviousSales(false)
      toast.success(`Loaded ${addedCount} item(s) from invoice ${invoiceNum} into cart!`, { duration: 3000 })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load items into cart')
    }
  }

  // 8. Re-print historical receipt
  const handlePrintHistoricalReceipt = (inv: Invoice) => {
    setReceiptData({
      number: inv.invoice_number,
      total: inv.grand_total,
      subtotal: inv.subtotal,
      discountAmount: inv.discount_amount,
      historyItems: inv.items || [],
      customerName: inv.customer_name || undefined,
      customerPhone: inv.customer_phone || inv.customer_whatsapp || inv.online_customer_contact || undefined,
      staffName: inv.staff_name || currentUser?.name,
      paymentMethod: inv.payment_method,
      paymentDetails: inv.notes,
      amountPaid: inv.amount_paid,
      balanceDue: inv.balance_due,
      dateStr: inv.date,
      timeStr: inv.datetime_created ? inv.datetime_created.slice(11, 19) : undefined,
      status: inv.status
    })
    setShowReceipt(true)
  }

  // Proceed to Payment with Mandatory Customer Check for WhatsApp & Social
  const handleProceedToPayment = useCallback(() => {
    if (cart.length === 0) return
    if ((source === 'whatsapp' || source === 'socialmedia') && !customer) {
      toast.error(`Customer is compulsory for ${source === 'whatsapp' ? 'WhatsApp' : 'Social Media'} orders (no walk-in). Please select or add a customer.`, {
        icon: '👤',
        duration: 4000
      })
      setShowCustomer(true)
      return
    }
    setAmountTendered(grandTotal.toString())
    setShowPayment(true)
  }, [cart.length, source, customer, grandTotal])

  // Channel Selection with Auto-Prompt for WhatsApp & Social
  const handleSelectSource = (newSource: 'instore' | 'whatsapp' | 'socialmedia') => {
    setSource(newSource)
    if ((newSource === 'whatsapp' || newSource === 'socialmedia') && !customer) {
      toast(`Customer is compulsory for ${newSource === 'whatsapp' ? 'WhatsApp' : 'Social'} orders (no walk-in).`, {
        icon: '👤',
        duration: 3500
      })
      setShowCustomer(true)
    }
  }

  const handleOpenPriceCard = (item?: CartItem) => {
    if (!canEditPrice) {
      toast.error('Item price editing is disabled in settings or user permissions.', { icon: '🔒' })
      return
    }
    const targetItem = item || cart[selectedCartIdx] || cart[0]
    if (!targetItem) {
      toast('Cart is empty. Please add an item first.', { icon: '🛒' })
      return
    }
    setPriceEditItem(targetItem)
    setShowPriceEdit(true)
  }

  // Hotkeys & Navigation Shortcuts
  useHotkeys({
    'F10': () => setShowSearch(true),
    'F9':  () => handleHoldAndNext(),
    'F8':  () => handleHoldAndNext(),
    'F7':  () => setShowExpense(true),
    'F6':  () => { loadVoiceData(); setShowVoiceModal(true) },
    'F4':  () => setShowPreviousSales(true),
    'F3':  () => handleNewInvoiceTab(),
    'F2':  () => setShowCustomer(true),
    'F12': () => handleProceedToPayment(),
    'Escape': () => {
      setShowSearch(false)
      setShowPayment(false)
      setShowPreviousSales(false)
      setShowCustomer(false)
      setShowExpense(false)
      setShowPriceEdit(false)
      setShowVoiceModal(false)
    },
  })

  // Global function key shortcuts (F2 Customer, F10 Search, F7 Expense, F6 Voice, F4 Previous Sales, F3 New Tab, F12 Pay)
  useEffect(() => {
    const handleGlobalFKeys = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setShowCustomer(true)
      } else if (e.key === 'F10') {
        e.preventDefault()
        setShowSearch(true)
      } else if (e.key === 'F6') {
        if (currentUser?.role === 'owner') {
          e.preventDefault()
          loadVoiceData()
          setShowVoiceModal(true)
        }
      } else if (e.key === 'F7') {
        e.preventDefault()
        setShowExpense(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        setShowPreviousSales(true)
      } else if (e.key === 'F3') {
        e.preventDefault()
        handleNewInvoiceTab()
      } else if (e.key === 'F12') {
        e.preventDefault()
        handleProceedToPayment()
      }
    }
    window.addEventListener('keydown', handleGlobalFKeys, true)
    return () => window.removeEventListener('keydown', handleGlobalFKeys, true)
  }, [handleNewInvoiceTab, handleProceedToPayment, cart, selectedCartIdx, canEditPrice, loadVoiceData])

  // Full POS Keyboard Navigation: Cart navigation (Up/Down/Left/Right), Tab switching (Alt+Left/Right), Enter for Payment
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showSearch || showPayment || showCustomer || showPreviousSales || showExpense || showReceipt) return

      // Alt+Left / Alt+Right for seamless invoice switching
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'Left')) {
        e.preventDefault()
        handlePrevInvoice()
        return
      } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'Right')) {
        e.preventDefault()
        handleNextInvoice()
        return
      }

      const target = e.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

      // Enter key -> Proceed to Payment (if cart has items and not typing in an input)
      if (e.key === 'Enter' && !isInput) {
        if (cart.length > 0) {
          e.preventDefault()
          handleProceedToPayment()
        }
        return
      }

      // If cart is empty, skip cart row navigation
      if (cart.length === 0) return

      // Cart Navigation & Shortcuts (when not typing in an input)
      if (!isInput) {
        // Shift key -> Open Price & Profit Card for selected cart item
        if (e.key === 'Shift' || e.key === 'P' || e.key === 'p') {
          if (canEditPrice) {
            e.preventDefault()
            handleOpenPriceCard()
            return
          }
        }

        if (e.key === 'ArrowUp' || e.key === 'Up') {
          e.preventDefault()
          setSelectedCartIdx(prev => Math.max(0, prev - 1))
        } else if (e.key === 'ArrowDown' || e.key === 'Down') {
          e.preventDefault()
          setSelectedCartIdx(prev => Math.min(cart.length - 1, prev + 1))
        } else if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === '+' || e.key === '=') {
          e.preventDefault()
          const currentItem = cart[selectedCartIdx] || cart[0]
          if (currentItem) {
            updateCartQty(currentItem.id, currentItem.qty + 1)
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === '-' || e.key === '_') {
          e.preventDefault()
          const currentItem = cart[selectedCartIdx] || cart[0]
          if (currentItem) {
            updateCartQty(currentItem.id, currentItem.qty - 1)
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          const currentItem = cart[selectedCartIdx] || cart[0]
          if (currentItem) {
            removeFromCart(currentItem.id)
            setSelectedCartIdx(prev => Math.max(0, Math.min(cart.length - 2, prev)))
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    sessions, activeSession.id, cart, selectedCartIdx, grandTotal, customer, source, handleProceedToPayment,
    showSearch, showPayment, showCustomer, showPreviousSales, showExpense, showReceipt
  ])

  // ---- ADD ITEM TO CART (WITH STRICT STOCK VALIDATION & CUSTOM PRICE) ----
  const addToCart = useCallback((item: Item, qty = 1, customPrice?: number) => {
    const available = item.quantity_on_hand ?? 0
    if (available <= 0) {
      toast.error(`"${item.name}" is OUT OF STOCK (0 in stock)!`, { icon: '⚠️', duration: 3500 })
      return
    }

    const finalPrice = customPrice !== undefined && customPrice > 0 ? customPrice : item.retail_price
    if (item.cost_price > 0 && finalPrice < item.cost_price) {
      toast.error(`Selling price (Rs. ${finalPrice.toLocaleString()}) cannot be less than cost price (Rs. ${item.cost_price.toLocaleString()})!`, { icon: '🚫', duration: 4000 })
      return
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(c => c.item_id === item.id)
      if (existingIdx !== -1) {
        const existing = prev[existingIdx]
        const nextQty = existing.qty + qty
        if (nextQty > available) {
          toast.error(`Cannot add more "${item.name}". Only ${available} available in stock!`, { icon: '⚠️', duration: 3500 })
          return prev
        }
        setSelectedCartIdx(existingIdx)
        toast.success(`Updated: ${item.name} (${nextQty})`, { duration: 1200 })
        return prev.map((c, i) =>
          i === existingIdx
            ? {
                ...c,
                qty: nextQty,
                unit_price: customPrice !== undefined && customPrice > 0 ? customPrice : c.unit_price,
                line_total: (customPrice !== undefined && customPrice > 0 ? customPrice : c.unit_price) * nextQty * (1 - c.discount_pct / 100)
              }
            : c
        )
      }

      if (qty > available) {
        toast.error(`Cannot add ${qty} units of "${item.name}". Only ${available} in stock!`, { icon: '⚠️', duration: 3500 })
        return prev
      }

      const cartItem: CartItem = {
        id: genCartId(),
        item_id: item.id,
        item,
        qty,
        unit_price: finalPrice,
        cost_price: item.cost_price,
        discount_pct: 0,
        line_total: finalPrice * qty
      }
      setSelectedCartIdx(prev.length)
      toast.success(`Added: ${item.name}`, { duration: 1200 })
      return [...prev, cartItem]
    })
  }, [activeSession.id])

  const updateCartQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.id !== id))
      return
    }
    setCart(prev => {
      const target = prev.find(c => c.id === id)
      if (!target) return prev
      const available = target.item.quantity_on_hand ?? 0
      if (qty > available) {
        toast.error(`Cannot set quantity to ${qty}. Only ${available} in stock for "${target.item.name}"!`, { icon: '⚠️', duration: 3500 })
        return prev
      }
      return prev.map(c =>
        c.id === id
          ? { ...c, qty, line_total: c.unit_price * qty * (1 - c.discount_pct / 100) }
          : c
      )
    })
  }

  const updateCartDiscount = (id: string, discount_pct: number) => {
    const capped = Math.min(Math.max(0, discount_pct), discountLimit)
    setCart(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, discount_pct: capped, line_total: c.unit_price * c.qty * (1 - capped / 100) }
          : c
      )
    )
  }

  const updateCartUnitPrice = (id: string, newPrice: number) => {
    const validPrice = Math.max(0, isNaN(newPrice) ? 0 : newPrice)
    setCart(prev => {
      const target = prev.find(c => c.id === id)
      if (target && target.cost_price > 0 && validPrice < target.cost_price) {
        toast.error(`Selling price (Rs. ${validPrice.toLocaleString()}) cannot be less than cost price (Rs. ${target.cost_price.toLocaleString()})!`, { icon: '🚫', duration: 4000 })
        return prev
      }
      return prev.map(c =>
        c.id === id
          ? {
              ...c,
              unit_price: validPrice,
              line_total: validPrice * c.qty * (1 - c.discount_pct / 100)
            }
          : c
      )
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  // ---- NEW SALE ----
  const handleNewSale = () => {
    setCart([])
    setCustomer(null)
    setSource('instore')
    setInvoiceDiscount(0)
    setPaymentMethod('cash')
    setAmountTendered('')
    setNotes('')
    setOnlineContact('')
    setReceiptData(null)
    setLastInvoice(null)
  }

  // ---- COMPLETE SALE ----
  const handleCompleteSale = async (overrideTendered?: string | number) => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }

    if ((source === 'whatsapp' || source === 'socialmedia') && !customer) {
      toast.error(`Customer is compulsory for ${source === 'whatsapp' ? 'WhatsApp' : 'Social Media'} orders! Please select or add a customer.`, {
        icon: '👤',
        duration: 4000
      })
      setShowPayment(false)
      setShowCustomer(true)
      return
    }

    // Pre-flight check: Ensure no item is sold below cost price
    for (const c of cart) {
      if (c.cost_price > 0 && c.unit_price < c.cost_price) {
        toast.error(`"${c.item.name}" selling price (Rs. ${c.unit_price.toLocaleString()}) is less than its cost price (Rs. ${c.cost_price.toLocaleString()})! Please adjust price before checkout.`, {
          icon: '🚫',
          duration: 5000
        })
        return
      }
    }

    // Pre-flight check stock for every item in cart
    for (const c of cart) {
      const available = c.item.quantity_on_hand ?? 0
      if (available < c.qty) {
        if (available <= 0) {
          toast.error(`"${c.item.name}" is OUT OF STOCK (0 on hand). Please remove it from the cart to proceed.`, { icon: '⚠️', duration: 4500 })
        } else {
          toast.error(`"${c.item.name}" only has ${available} units in stock, but ${c.qty} are in cart.`, { icon: '⚠️', duration: 4500 })
        }
        return
      }
    }

    const rawTendered = overrideTendered !== undefined ? String(overrideTendered) : amountTendered
    const enteredTendered = parseFloat(rawTendered) || 0
    let isPartialPayment = false
    let amountPaidFinal = grandTotal
    let balanceDueFinal = 0
    let changeVal = 0

    if (paymentMethod === 'cash') {
      if (enteredTendered > 0 && enteredTendered < grandTotal) {
        // Customer paid partial cash amount (e.g. 2000 out of 9000)
        isPartialPayment = true
        amountPaidFinal = enteredTendered
        balanceDueFinal = grandTotal - enteredTendered
        changeVal = 0
      } else if (enteredTendered >= grandTotal) {
        amountPaidFinal = grandTotal
        balanceDueFinal = 0
        changeVal = enteredTendered - grandTotal
      } else {
        // entered 0 or empty in cash, full cash paid
        amountPaidFinal = grandTotal
        balanceDueFinal = 0
        changeVal = 0
      }
    } else if (paymentMethod === 'partial') {
      if (enteredTendered <= 0) {
        toast.error('Please enter the cash amount collected from the customer.')
        return
      }
      if (enteredTendered >= grandTotal) {
        amountPaidFinal = grandTotal
        balanceDueFinal = 0
        changeVal = enteredTendered - grandTotal
      } else {
        isPartialPayment = true
        amountPaidFinal = enteredTendered
        balanceDueFinal = grandTotal - enteredTendered
        changeVal = 0
      }
    } else if (paymentMethod === 'credit') {
      isPartialPayment = true
      amountPaidFinal = 0
      balanceDueFinal = grandTotal
      changeVal = 0
    } else {
      amountPaidFinal = grandTotal
      balanceDueFinal = 0
      changeVal = 0
    }

    setProcessing(true)
    try {
      const paymentChannel = paymentMethod === 'bank'
        ? (bankProvider === 'Other Bank' ? (otherBankName || 'Other Bank') : bankProvider) + (bankRef ? ` (Ref: ${bankRef})` : '')
        : (isPartialPayment || balanceDueFinal > 0)
          ? `CASH PARTIAL — Paid: Rs. ${amountPaidFinal.toLocaleString()} | Pending: Rs. ${balanceDueFinal.toLocaleString()}`
          : paymentMethod.toUpperCase()

      const finalNotes = paymentMethod === 'bank'
        ? [paymentChannel, notes].filter(Boolean).join(' | ')
        : (isPartialPayment || balanceDueFinal > 0)
          ? [`Partial payment: Rs. ${amountPaidFinal.toLocaleString()} collected. Balance: Rs. ${balanceDueFinal.toLocaleString()}`, notes].filter(Boolean).join(' | ')
          : notes

      const invoiceStatus = (isPartialPayment || balanceDueFinal > 0)
        ? 'pending'
        : ((source === 'whatsapp' || source === 'socialmedia') ? 'pending' : 'completed')

      const invoiceData = {
        customer_id: customer?.id,
        source,
        status: invoiceStatus,
        subtotal,
        discount_amount: totalDiscount,
        grand_total: grandTotal,
        amount_paid: amountPaidFinal,
        balance_due: balanceDueFinal,
        cost_total: costTotal,
        profit,
        payment_method: isPartialPayment ? 'cash' : paymentMethod,
        notes: finalNotes,
        online_customer_contact: onlineContact || undefined,
        items: cart.map(c => ({
          item_id: c.item_id,
          qty: c.qty,
          unit_price: c.unit_price,
          cost_price: c.cost_price,
          discount_pct: c.discount_pct,
          line_total: c.line_total
        }))
      }

      const result = await window.api.createInvoice(currentUser!.id, invoiceData)
      if (result.success && result.data) {
        const inv = result.data
        setLastInvoice({ number: inv.invoice_number, total: inv.grand_total, change: changeVal, paymentDetails: paymentChannel })
        setReceiptData({
          number: inv.invoice_number,
          total: inv.grand_total,
          subtotal,
          discountAmount: totalDiscount,
          change: changeVal,
          items: cart,
          customer,
          customerName: customer?.name || (source === 'whatsapp' || source === 'socialmedia' ? onlineContact : 'Walk-in Customer'),
          customerPhone: customer?.phone || customer?.whatsapp || onlineContact,
          staffName: currentUser?.name,
          paymentMethod: isPartialPayment ? 'cash' : paymentMethod,
          paymentDetails: paymentChannel,
          amountPaid: amountPaidFinal,
          balanceDue: balanceDueFinal,
          status: invoiceStatus
        })
        setShowPayment(false)
        setShowReceipt(true)
        if (balanceDueFinal > 0) {
          toast.success(`Invoice ${inv.invoice_number} saved as PENDING! Paid: ${fmt(amountPaidFinal)} · Pending: ${fmt(balanceDueFinal)}`, { duration: 5000 })
        } else if (source === 'whatsapp' || source === 'socialmedia') {
          toast.success(`Online Order ${inv.invoice_number} created (Pending in Online Orders)!`, { duration: 3500 })
        } else {
          try {
            confetti({ particleCount: 80, spread: 75, origin: { y: 0.65 } })
          } catch (_) {}
          toast.success(`Invoice ${inv.invoice_number} saved!`, { duration: 3000 })
        }
      } else {
        toast.error(result.error || 'Failed to save invoice')
      }
    } finally {
      setProcessing(false)
    }
  }

  // Handle Receipt Modal Done / Close
  const handleReceiptDone = () => {
    setShowReceipt(false)
    setReceiptData(null)
    if (sessions.length > 1) {
      // Remove finished session and switch to remaining
      const filtered = sessions.filter(s => s.id !== activeSession.id)
      setSessions(filtered)
      setActiveSessionId(filtered[0]?.id || '')
    } else {
      handleNewSale()
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* ======== LEFT PANEL: CART & MULTI-INVOICE SESSIONS ======== */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: '1px solid var(--color-border)'
      }}>
        {/* MULTI-INVOICE SESSION TABS BAR */}
        <div style={{
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto'
        }}>
          {/* Prev / Next Nav Buttons */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePrevInvoice}
              disabled={sessions.length <= 1}
              style={{ padding: '3px 6px', height: 28 }}
              title="Previous Invoice (Alt + ←)"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleNextInvoice}
              disabled={sessions.length <= 1}
              style={{ padding: '3px 6px', height: 28 }}
              title="Next Invoice (Alt + →)"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Session Tabs */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, overflowX: 'auto', padding: '2px 0' }}>
            {sessions.map((sess, idx) => {
              const isActive = sess.id === activeSession.id
              const sessQty = sess.cart.reduce((s, i) => s + i.qty, 0)
              const sessTotal = sess.cart.reduce((s, i) => s + i.line_total, 0) - sess.invoiceDiscount
              const sessGrandTotal = Math.max(0, sessTotal)

              return (
                <div
                  key={sess.id}
                  onClick={() => setActiveSessionId(sess.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive
                      ? 'var(--color-surface)'
                      : sess.isHeld
                        ? 'rgba(245, 158, 11, 0.12)'
                        : 'transparent',
                    color: isActive
                      ? 'var(--color-primary)'
                      : sess.isHeld
                        ? 'var(--color-warning)'
                        : 'var(--color-text-secondary)',
                    border: `1.5px solid ${
                      isActive
                        ? 'var(--color-primary)'
                        : sess.isHeld
                          ? 'rgba(245, 158, 11, 0.4)'
                          : 'var(--color-border)'
                    }`,
                    boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: sess.isHeld ? 'var(--color-warning)' : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)'
                  }} />

                  <span>{sess.label || `Sale ${idx + 1}`}</span>

                  {sess.isHeld && (
                    <span style={{
                      fontSize: '0.625rem',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: 'var(--color-warning)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 700
                    }}>
                      HELD
                    </span>
                  )}

                  {sess.cart.length > 0 && (
                    <span style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'var(--font-mono)',
                      background: isActive ? 'var(--color-primary-10)' : 'var(--color-surface-2)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)'
                    }}>
                      {sessQty} pcs · {fmt(sessGrandTotal)}
                    </span>
                  )}

                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={e => handleCloseSessionTab(sess.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 3
                      }}
                      title="Close invoice tab"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}

            {/* + New Invoice Tab Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleNewInvoiceTab}
              style={{
                height: 28,
                padding: '0 8px',
                fontSize: '0.6875rem',
                borderRadius: 'var(--radius-md)',
                gap: 4
              }}
              title="Open New Invoice Tab (F3)"
            >
              <Plus size={13} /> New <span className="hotkey" style={{ fontSize: '0.5rem' }}>F3</span>
            </button>
          </div>

          {/* Quick Hold & Next and Previous Sales Actions */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${activeSession.isHeld ? 'btn-secondary' : 'btn-warning'}`}
              onClick={handleHoldAndNext}
              style={{
                height: 28,
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0 10px',
                gap: 4
              }}
              title="Hold this invoice and switch to next/new invoice (F9)"
            >
              <Pause size={13} />
              Hold & Next
              <span className="hotkey" style={{ fontSize: '0.5rem', background: 'rgba(0,0,0,0.15)', color: 'inherit', border: 'none' }}>F9</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPreviousSales(true)}
              style={{
                height: 28,
                fontSize: '0.6875rem',
                padding: '0 10px',
                gap: 4,
                color: 'var(--color-primary)'
              }}
              title="View Previous Completed POS Sales & Receipts (F4)"
            >
              <History size={13} />
              Previous Sales
              <span className="hotkey" style={{ fontSize: '0.5rem' }}>F4</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/pending-invoices')}
              style={{
                height: 28,
                fontSize: '0.6875rem',
                padding: '0 10px',
                gap: 4,
                color: '#D97706',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 700
              }}
              title="View and collect pending customer invoice balances"
            >
              <Clock size={13} />
              Pending Dues
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowSearch(true)}
          >
            <Search size={15} />
            Search Item
            <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(255,255,255,0.2)', border: 'none' }}>F10</span>
          </button>

          {/* AI Voice-Controlled POS Assistant Button (Owner Only & If Voice POS Enabled) */}
          {currentUser?.role === 'owner' && settings['enable_voice_pos'] !== '0' && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                loadVoiceData()
                setShowVoiceModal(true)
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
                color: 'var(--color-primary)',
                fontWeight: 800,
                gap: 6
              }}
              title="Owner AI Voice POS Assistant (Whisper Speech Engine) — Hotkey F6"
            >
              <Mic size={15} style={{ color: 'var(--color-primary)' }} />
              Voice Invoice (Owner)
              <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-primary)', border: 'none' }}>F6</span>
            </button>
          )}

          {/* Add Store Expense Button */}
          <button
            className="btn btn-warning"
            onClick={() => setShowExpense(true)}
            style={{ gap: 6, fontWeight: 700 }}
            title="Record store or operational expense / petty cash out (F7)"
          >
            <DollarSign size={15} />
            Add Expense
            <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(0,0,0,0.15)', color: 'inherit', border: 'none' }}>F7</span>
          </button>

          {/* Live Drawer Summary Pill */}
          <div
            onClick={() => setShowPreviousSales(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-surface-2)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              userSelect: 'none'
            }}
            title="Click to view today's transactions, sales & expenses breakdown (F4)"
          >
            <Wallet size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Drawer: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>Rs. {(posSummary?.cash_in_drawer ?? 0).toLocaleString()}</strong></span>
            {posSummary && (posSummary.today_expenses > 0 || posSummary.today_sales > 0) && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', borderLeft: '1px solid var(--color-border)', paddingLeft: 8 }}>
                Sales: Rs. {posSummary.today_sales.toLocaleString()} · Exp: <span style={{ color: 'var(--color-danger)' }}>-Rs. {posSummary.today_expenses.toLocaleString()}</span>
              </span>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {activeSession.isHeld && (
              <button
                className="btn btn-warning btn-sm"
                onClick={() => handleToggleHold(activeSession.id)}
                title="Unhold this invoice"
              >
                <Play size={13} /> Unhold
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleNewSale}
              title="Clear & Start New Sale"
            >
              <RefreshCw size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Cart Grid */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <div className="empty-state-icon" style={{ width: 80, height: 80 }}>
                <ShoppingCart size={36} style={{ color: 'var(--color-primary-light)' }} />
              </div>
              <h3>Cart is Empty</h3>
              <p style={{ maxWidth: 280 }}>
                Press <span className="hotkey">F10</span> to search and add items, or scan a barcode
              </p>
            </div>
          ) : (
            <div>
              {/* Keyboard Shortcut Navigation Legend Strip */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 14px', background: 'var(--color-surface-2)',
                borderBottom: '1px solid var(--color-border)', fontSize: '0.6875rem', color: 'var(--color-text-secondary)',
                userSelect: 'none'
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span><span className="hotkey">↑</span> <span className="hotkey">↓</span> Select item</span>
                  <span><span className="hotkey">←</span> <span className="hotkey">→</span> Qty (-/+)</span>
                  {canEditPrice && <span><span className="hotkey">Shift</span> Edit Price & Profit</span>}
                  <span><span className="hotkey">Del</span> Remove</span>
                </div>
                <div>
                  <span><span className="hotkey">Enter</span> Proceed to Payment</span>
                </div>
              </div>

              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 32, textAlign: 'center' }}>#</th>
                    <th style={{ width: 110 }}>SKU</th>
                    <th>Item Name</th>
                    <th style={{ width: 105, textAlign: 'right' }}>Price (Rs.)</th>
                    <th style={{ width: 95, textAlign: 'center' }}>Qty</th>
                    <th style={{ width: 70, textAlign: 'center' }}>Disc%</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Total</th>
                    {canViewProfit && <th style={{ width: 105, textAlign: 'right' }}>Profit</th>}
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      index={idx + 1}
                      isSelected={idx === selectedCartIdx}
                      onSelectRow={() => setSelectedCartIdx(idx)}
                      maxDiscount={discountLimit}
                      canEditPrice={canEditPrice}
                      canViewProfit={canViewProfit}
                      canViewCostPrice={canViewCostPrice}
                      onOpenPriceCard={() => handleOpenPriceCard(item)}
                      onPriceChange={newPrice => updateCartUnitPrice(item.id, newPrice)}
                      onQtyChange={qty => updateCartQty(item.id, qty)}
                      onDiscountChange={pct => updateCartDiscount(item.id, pct)}
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          padding: '12px 16px'
        }}>
          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <span>Subtotal ({cart.length} items)</span>
              <span className="font-mono">{fmt(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--color-danger)' }}>
                <span>Discount</span>
                <span className="font-mono">- {fmt(totalDiscount)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '1.25rem', fontWeight: 800,
              color: 'var(--color-text-primary)',
              paddingTop: 8, borderTop: '2px solid var(--color-border)'
            }}>
              <span>Grand Total</span>
              <span className="font-mono" style={{ color: 'var(--color-primary)' }}>{fmt(grandTotal)}</span>
            </div>

            {/* Profit indicator — ONLY for permitted roles, NEVER printed */}
            {canViewProfit && cart.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: profit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                padding: '4px 8px',
                background: profit >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                borderRadius: 6,
                marginTop: 4
              }}>
                <span>🔒 Profit (internal)</span>
                <span className="font-mono font-bold">
                  {profit >= 0 ? '+' : ''}{fmt(profit)}
                  {' '}({costTotal > 0 ? ((profit / costTotal) * 100).toFixed(1) : '0'}%)
                </span>
              </div>
            )}
          </div>

          {/* Invoice discount */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Tag size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="number"
              className="form-input"
              placeholder="Invoice discount (Rs.)"
              value={invoiceDiscount || ''}
              onChange={e => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
              style={{ flex: 1, height: 32 }}
              min={0}
              max={subtotal}
            />
          </div>

          <button
            className="btn btn-success btn-xl btn-full"
            onClick={handleProceedToPayment}
            disabled={cart.length === 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <CreditCard size={18} />
            <span>Proceed to Payment — {fmt(grandTotal)}</span>
            <span className="hotkey" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none' }}>Enter</span>
          </button>
        </div>
      </div>

      {/* ======== RIGHT PANEL: CUSTOMER ======== */}
      <div style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h5 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              <User size={14} style={{ display: 'inline', marginRight: 4 }} />
              Customer
            </h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(source === 'whatsapp' || source === 'socialmedia') && !customer && (
                <span className="badge badge-danger" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
                  Required
                </span>
              )}
              <span className="hotkey" style={{ fontSize: '0.5625rem' }}>F2</span>
            </div>
          </div>
          {customer ? (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '8px 10px',
              background: 'var(--color-primary-10)',
              borderRadius: 8, border: '1px solid var(--color-primary-20)'
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0
              }}>
                {customer.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customer.name}
                </div>
                {customer.balance !== 0 && (
                  <div style={{ fontSize: '0.6875rem', color: customer.balance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    Balance: {fmt(Math.abs(customer.balance))} {customer.balance > 0 ? '(owes)' : '(credit)'}
                  </div>
                )}
              </div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => setCustomer(null)}
              ><X size={13} /></button>
            </div>
          ) : (
            <button
              className={`btn ${source !== 'instore' ? 'btn-primary' : 'btn-secondary'} btn-sm btn-full`}
              onClick={() => setShowCustomer(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: source !== 'instore' ? '0 0 0 2px rgba(47, 75, 245,0.3)' : 'none',
                fontWeight: source !== 'instore' ? 700 : 600
              }}
            >
              <User size={14} /> Select Customer
              <span className="hotkey" style={{
                fontSize: '0.5625rem',
                background: source !== 'instore' ? 'rgba(255,255,255,0.2)' : undefined,
                color: source !== 'instore' ? '#fff' : undefined,
                border: 'none'
              }}>F2</span>
            </button>
          )}
        </div>

        {/* Quick stats for the sale */}
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Sale Summary
          </div>
          {[
            { label: 'Items', value: cart.length.toString() },
            { label: 'Qty Total', value: cart.reduce((s, i) => s + i.qty, 0).toString() },
            { label: 'Subtotal', value: fmt(subtotal) },
            ...(totalDiscount > 0 ? [{ label: 'Discount', value: `- ${fmt(totalDiscount)}` }] : []),
            { label: 'Grand Total', value: fmt(grandTotal), bold: true, color: 'var(--color-primary)' },
            ...(canViewCostPrice ? [{ label: '🔒 Cost', value: fmt(costTotal), muted: true }] : []),
          ].map(row => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '0.8125rem'
            }}>
              <span style={{ color: (row as {muted?: boolean}).muted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
                {row.label}
              </span>
              <span style={{
                fontWeight: (row as {bold?: boolean}).bold ? 700 : 500,
                color: (row as {color?: string}).color || 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: (row as {bold?: boolean}).bold ? '0.9375rem' : '0.8125rem'
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* ======== BOTTOM-RIGHT CORNER: ORDER CHANNEL BUTTONS ======== */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            <span>Order Channel</span>
            <span style={{
              fontSize: '0.625rem',
              color: source === 'whatsapp' ? '#25D366' : source === 'socialmedia' ? '#7C3AED' : 'var(--color-primary)',
              fontWeight: 700
            }}>
              {source === 'whatsapp' ? 'Online WhatsApp' : source === 'socialmedia' ? 'Social Order' : 'Store POS'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            background: 'var(--color-surface)',
            padding: 3,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            gap: 4
          }}>
            <button
              type="button"
              onClick={() => handleSelectSource('instore')}
              className="btn btn-sm"
              style={{
                padding: '6px 4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: source === 'instore' ? 'var(--color-primary)' : 'transparent',
                color: source === 'instore' ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: source === 'instore' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <Store size={13} style={{ color: source === 'instore' ? '#fff' : 'var(--color-primary)' }} />
              <span>In-Store</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSource('whatsapp')}
              className="btn btn-sm"
              style={{
                padding: '6px 4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: source === 'whatsapp' ? '#25D366' : 'transparent',
                color: source === 'whatsapp' ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: source === 'whatsapp' ? '0 1px 4px rgba(37, 211, 102, 0.35)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <WhatsAppBrandIcon size={13} color={source === 'whatsapp' ? '#fff' : '#25D366'} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSource('socialmedia')}
              className="btn btn-sm"
              style={{
                padding: '6px 4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: source === 'socialmedia' ? '#7C3AED' : 'transparent',
                color: source === 'socialmedia' ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: source === 'socialmedia' ? '0 1px 4px rgba(124, 58, 237, 0.35)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <Share2 size={13} style={{ color: source === 'socialmedia' ? '#fff' : '#7C3AED' }} />
              <span>Social</span>
            </button>
          </div>

          {(source === 'whatsapp' || source === 'socialmedia') && (
            <input
              type="text"
              className="form-input form-input-sm"
              placeholder={source === 'whatsapp' ? 'WhatsApp phone number...' : 'Social handle / order reference...'}
              value={onlineContact}
              onChange={e => setOnlineContact(e.target.value)}
              style={{ fontSize: '0.75rem', marginTop: 2 }}
            />
          )}
        </div>
      </div>

      {/* ======== MODALS ======== */}
      {showSearch && (
        <ItemSearchModal
          cart={cart}
          onAddToCart={(item, qty) => addToCart(item, qty)}
          onClose={() => setShowSearch(false)}
          canViewCost={canViewCostPrice}
        />
      )}

      {showPayment && (
        <PaymentModal
          grandTotal={grandTotal}
          paymentMethod={paymentMethod}
          bankProvider={bankProvider}
          otherBankName={otherBankName}
          bankRef={bankRef}
          amountTendered={amountTendered}
          change={change}
          processing={processing}
          onMethodChange={setPaymentMethod}
          onBankProviderChange={setBankProvider}
          onOtherBankNameChange={setOtherBankName}
          onBankRefChange={setBankRef}
          onTenderedChange={setAmountTendered}
          onConfirm={handleCompleteSale}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showCustomer && (
        <CustomerSelectModal
          source={source}
          onSelect={c => { setCustomer(c); setShowCustomer(false) }}
          onClose={() => setShowCustomer(false)}
        />
      )}

      {showPreviousSales && (
        <PreviousSalesModal
          currentUserId={currentUser!.id}
          canVoid={!!canVoidInvoice}
          onClose={() => setShowPreviousSales(false)}
          onLoadInvoiceToCart={handleLoadInvoiceItemsToCart}
          onPrintReceipt={handlePrintHistoricalReceipt}
          onOpenAddExpense={() => setShowExpense(true)}
        />
      )}

      {showExpense && (
        <AddExpenseModal
          currentUserId={currentUser!.id}
          onClose={() => setShowExpense(false)}
          onSuccess={() => {
            loadPosSummary()
          }}
        />
      )}

      {showPriceEdit && priceEditItem && (
        <PriceEditProfitCard
          item={priceEditItem}
          canViewCost={canViewCostPrice}
          canViewProfit={canViewProfit}
          showCostInPriceEdit={showCostInPriceEdit}
          onSave={newPrice => updateCartUnitPrice(priceEditItem.id, newPrice)}
          onClose={() => {
            setShowPriceEdit(false)
            setPriceEditItem(null)
          }}
        />
      )}

      {showReceipt && (receiptData || lastInvoice) && (
        <ReceiptPreviewModal
          invoiceNumber={receiptData?.number || lastInvoice?.number || ''}
          total={receiptData?.total ?? lastInvoice?.total ?? 0}
          subtotal={receiptData?.subtotal}
          discountAmount={receiptData?.discountAmount}
          change={receiptData?.change ?? lastInvoice?.change}
          items={receiptData?.items || cart}
          historyItems={receiptData?.historyItems}
          customer={receiptData?.customer || customer}
          customerName={receiptData?.customerName || customer?.name}
          customerPhone={receiptData?.customerPhone || customer?.phone || customer?.whatsapp || onlineContact}
          userName={currentUser?.name}
          staffName={receiptData?.staffName || currentUser?.name}
          paymentMethod={receiptData?.paymentMethod || paymentMethod}
          paymentDetails={receiptData?.paymentDetails || lastInvoice?.paymentDetails}
          amountPaid={receiptData?.amountPaid}
          balanceDue={receiptData?.balanceDue}
          dateStr={receiptData?.dateStr}
          timeStr={receiptData?.timeStr}
          status={receiptData?.status}
          onClose={() => {
            setShowReceipt(false)
            setReceiptData(null)
          }}
          onDoneNewSale={handleReceiptDone}
        />
      )}

      {/* ======== VOICE-CONTROLLED POS ASSISTANT MODAL ======== */}
      {showVoiceModal && (
        <VoicePOSModal
          isOpen={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          catalog={allCatalogItems}
          customers={allCustomersList}
          currentCart={cart}
          currentCustomer={customer}
          currentDiscount={invoiceDiscount}
          currentPaymentMethod={paymentMethod}
          currentBankProvider={bankProvider}
          canEditPrice={canEditPrice}
          onAddToCart={(item, qty, price) => {
            addToCart(item, qty || 1, price)
          }}
          onUpdateQty={(itemId, qty) => updateCartQty(itemId, qty)}
          onUpdatePrice={(itemId, price) => updateCartUnitPrice(itemId, price)}
          onRemoveFromCart={(cartItemId) => removeFromCart(cartItemId)}
          onSetCustomer={(c) => setCustomer(c)}
          onCreateCustomer={async (data) => {
            if (!currentUser) return null
            const res = await window.api.createCustomer(currentUser.id, {
              name: data.name,
              phone: data.phone || '',
              email: '',
              address: '',
              credit_limit: 0
            })
            if (res && res.success && res.data) {
              const newCust = res.data
              setAllCustomersList(prev => [...prev, newCust])
              setCustomer(newCust)
              toast.success(`Customer "${newCust.name}" created and assigned!`, { icon: '👤', duration: 2500 })
              return newCust
            } else if (res && !res.success) {
              toast.error(`Customer creation error: ${res.error}`)
            }
            return null
          }}
          onSetDiscount={(amount, isPercent) => {
            if (isPercent) {
              const calcAmt = (subtotal * amount) / 100
              setInvoiceDiscount(calcAmt)
            } else {
              setInvoiceDiscount(amount)
            }
          }}
          onSetPaymentMethod={(method, provider) => {
            setPaymentMethod(method)
            if (provider) setBankProvider(provider)
          }}
          onSetAmountTendered={(amt) => setAmountTendered(amt)}
          onClearCart={() => handleNewSale()}
          onHoldBill={() => handleHoldAndNext()}
          onCommitSale={async () => {
            if (cart.length === 0) return false
            await handleCompleteSale()
            return true
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// QUICK PRICE & PROFIT CARD (Shift Key / Click Price)
// ============================================================
function PriceEditProfitCard({
  item,
  canViewCost,
  canViewProfit,
  showCostInPriceEdit = true,
  onSave,
  onClose
}: {
  item: CartItem
  canViewCost?: boolean
  canViewProfit?: boolean
  showCostInPriceEdit?: boolean
  onSave: (newPrice: number) => void
  onClose: () => void
}) {
  const [priceStr, setPriceStr] = useState(String(item.unit_price))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const newPrice = parseFloat(priceStr) || 0
  const isBelowCost = item.cost_price > 0 && newPrice < item.cost_price
  const lineCost = (item.cost_price || 0) * item.qty
  const typedLineTotal = (newPrice * item.qty) * (1 - item.discount_pct / 100)
  const liveProfit = typedLineTotal - lineCost
  const liveMarginPct = typedLineTotal > 0 ? (liveProfit / typedLineTotal) * 100 : 0

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error('Please enter a valid price (> 0)')
      return
    }
    if (item.cost_price > 0 && newPrice < item.cost_price) {
      toast.error(`Selling price (Rs. ${newPrice.toLocaleString()}) cannot be less than cost price (Rs. ${item.cost_price.toLocaleString()})! Price was not applied.`, {
        icon: '🚫',
        duration: 4500
      })
      return
    }
    onSave(newPrice)
    toast.success(`Unit price updated to Rs. ${newPrice.toLocaleString()}`)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        className="modal modal-md"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: 'var(--color-surface)', padding: '12px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Tag size={18} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Custom Selling Price & Profit</span>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Press <span className="hotkey" style={{ fontSize: '0.5625rem' }}>Enter</span> to apply & return to cart
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Card Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Item Info Strip */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                {item.item.name}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <span>SKU: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{item.item.part_number || item.item.barcode || '-'}</strong></span>
                <span>Qty: <strong>{item.qty}</strong></span>
                {item.discount_pct > 0 && <span>Disc: <strong>{item.discount_pct}%</strong></span>}
              </div>

              {/* Price Benchmarks */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: (canViewCost && showCostInPriceEdit) ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: 8,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px dashed var(--color-border)',
                textAlign: 'center'
              }}>
                <div style={{ background: 'var(--color-surface)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Catalog Retail</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Rs. {item.item.retail_price.toLocaleString()}</div>
                </div>

                {canViewCost && showCostInPriceEdit && (
                  <div style={{ background: 'var(--color-surface)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Cost Price</div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#64748b' }}>Rs. {item.cost_price.toLocaleString()}</div>
                  </div>
                )}

                <div style={{ background: 'var(--color-surface)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-primary-30)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)' }}>Current Price</div>
                  <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-primary)' }}>Rs. {item.unit_price.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Price Input Field */}
            <div>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                Selling Price Per Unit (Rs.)*
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '1.125rem'
                }}>Rs.</span>
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  min={item.cost_price > 0 ? item.cost_price : 0}
                  className="form-input form-input-lg"
                  value={priceStr}
                  onChange={e => setPriceStr(e.target.value)}
                  placeholder="0.00"
                  style={{
                    paddingLeft: 44,
                    fontSize: '1.375rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: isBelowCost ? '#DC2626' : 'var(--color-text-primary)',
                    border: isBelowCost ? '2px solid #DC2626' : '1px solid var(--color-border)',
                    boxShadow: isBelowCost ? '0 0 0 3px rgba(220, 38, 38, 0.15)' : 'none'
                  }}
                  required
                />
              </div>
            </div>

            {/* Below Cost Block Warning Banner */}
            {isBelowCost && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1.5px solid #DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991B1B' }}>
                  Selling Price Below Cost is Blocked!
                </div>
              </div>
            )}

            {/* Net Item Profit — subtle corner indicator (shown to every user by default) */}
            {!isBelowCost && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 4,
                opacity: 0.28,
                padding: '0 2px',
                userSelect: 'none'
              }}>
                <span style={{
                  fontSize: '0.5625rem',
                  fontFamily: 'var(--font-mono)',
                  color: liveProfit >= 0 ? '#16A34A' : '#DC2626',
                  fontWeight: 600,
                  letterSpacing: '0.02em'
                }}>
                  {liveProfit >= 0 ? 'Net Item Profit' : 'Below Cost'}: {liveProfit >= 0 ? `+Rs. ${liveProfit.toLocaleString()}` : `-Rs. ${Math.abs(liveProfit).toLocaleString()}`} ({liveMarginPct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="modal-footer" style={{
            padding: '12px 16px',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
            </button>
            <button
              type="submit"
              className={`btn ${isBelowCost ? 'btn-danger' : 'btn-primary'}`}
              disabled={isBelowCost || newPrice <= 0}
              style={{ fontWeight: 700, minWidth: 160, cursor: isBelowCost ? 'not-allowed' : 'pointer' }}
            >
              <Check size={14} /> {isBelowCost ? 'Price Below Cost (Blocked)' : 'Apply Price'} <span className="hotkey" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', marginLeft: 4 }}>Enter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// CART ROW
// ============================================================
function CartRow({
  item,
  index,
  maxDiscount,
  isSelected,
  canEditPrice,
  canViewProfit,
  canViewCostPrice,
  onSelectRow,
  onOpenPriceCard,
  onPriceChange,
  onQtyChange,
  onDiscountChange,
  onRemove
}: {
  item: CartItem
  index: number
  maxDiscount: number
  isSelected?: boolean
  canEditPrice?: boolean
  canViewProfit?: boolean
  canViewCostPrice?: boolean
  onSelectRow?: () => void
  onOpenPriceCard?: () => void
  onPriceChange: (newPrice: number) => void
  onQtyChange: (qty: number) => void
  onDiscountChange: (pct: number) => void
  onRemove: () => void
}) {
  const isBelowCost = item.cost_price > 0 && item.unit_price < item.cost_price
  const lineCost = (item.cost_price || 0) * item.qty
  const lineProfit = item.line_total - lineCost
  const marginPct = item.line_total > 0 ? (lineProfit / item.line_total) * 100 : 0

  return (
    <tr
      onClick={onSelectRow}
      style={{
        borderBottom: '1.5px solid var(--color-border)',
        background: isSelected ? 'var(--color-primary-10)' : 'transparent',
        boxShadow: isSelected ? 'inset 3.5px 0 0 var(--color-primary)' : 'none',
        transition: 'background var(--transition-fast)',
        cursor: 'pointer'
      }}
    >
      <td style={{
        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
        textAlign: 'center',
        fontWeight: isSelected ? 800 : 600,
        padding: '8px 6px'
      }}>
        {isSelected ? <span style={{ fontSize: '0.6875rem' }}>▶ {index}</span> : index}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            padding: '3px 6px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-block',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap'
          }}
        >
          {item.item.part_number || item.item.barcode || '-'}
        </span>
      </td>
      <td style={{ padding: '8px 6px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
          {item.item.name}
        </div>
        {(item.item.brand_name || item.item.category_name || item.item.size_variant) && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {[item.item.brand_name, item.item.category_name, item.item.size_variant].filter(Boolean).join(' · ')}
          </div>
        )}
      </td>

      {/* Unit Selling Price (Inline Editable Input + Shift Card) */}
      <td style={{ padding: '8px 6px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
        {canEditPrice ? (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <input
                id={`cart-price-input-${index - 1}`}
                type="number"
                step="any"
                min={item.cost_price > 0 ? item.cost_price : 0}
                value={item.unit_price === 0 ? '' : item.unit_price}
                onChange={e => {
                  const val = parseFloat(e.target.value)
                  onPriceChange(isNaN(val) ? 0 : val)
                }}
                onBlur={e => {
                  const val = parseFloat(e.target.value)
                  if (item.cost_price > 0 && (isNaN(val) || val < item.cost_price)) {
                    toast.error('Selling price cannot be less than cost price! Reverting price.', { icon: '🚫' })
                    onPriceChange(Math.max(item.cost_price, item.item.retail_price))
                  }
                }}
                onFocus={e => e.target.select()}
                style={{
                  width: 78,
                  textAlign: 'right',
                  height: 28,
                  border: isBelowCost ? '1.5px solid #DC2626' : '1px solid var(--color-border)',
                  background: isBelowCost ? '#FEF2F2' : 'var(--color-surface)',
                  color: isBelowCost ? '#DC2626' : 'var(--color-text-primary)',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  outline: 'none',
                  padding: '0 6px',
                  display: 'inline-block'
                }}
                title="Edit price (or press Shift for price & profit card)"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-icon"
                onClick={onOpenPriceCard}
                title="Open Price & Profit Card (Shift)"
                style={{ width: 22, height: 22, color: 'var(--color-primary)' }}
              >
                <Tag size={12} />
              </button>
            </div>
            {item.item.retail_price !== item.unit_price && (
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                Retail: {item.item.retail_price.toLocaleString()}
              </div>
            )}
            {isBelowCost && (
              <div style={{ fontSize: '0.625rem', color: '#DC2626', fontWeight: 800, marginTop: 1 }}>
                ▼ Below Cost
              </div>
            )}
          </div>
        ) : (
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.unit_price.toLocaleString()}</span>
            {isBelowCost && (
              <div style={{ fontSize: '0.625rem', color: '#DC2626', fontWeight: 800, marginTop: 1 }}>
                ▼ Below Cost
              </div>
            )}
          </div>
        )}
      </td>

      {/* Quantity (Inline) */}
      <td style={{ padding: '8px 6px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onQtyChange(item.qty - 1)}
          ><Minus size={12} /></button>
          <input
            type="number"
            value={item.qty}
            onChange={e => onQtyChange(parseInt(e.target.value) || 1)}
            style={{
              width: 38, textAlign: 'center',
              height: 28, border: '1px solid var(--color-border)',
              borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 600,
              fontSize: '0.875rem', outline: 'none'
            }}
            min={1}
          />
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onQtyChange(item.qty + 1)}
          ><Plus size={12} /></button>
        </div>
      </td>

      {/* Discount % (Inline) */}
      <td style={{ padding: '8px 6px' }} onClick={e => e.stopPropagation()}>
        <input
          type="number"
          value={item.discount_pct || ''}
          onChange={e => onDiscountChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          style={{
            width: 50, textAlign: 'center',
            height: 28, border: '1px solid var(--color-border)',
            borderRadius: 4, fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem', outline: 'none', display: 'block', margin: '0 auto'
          }}
          min={0} max={maxDiscount}
          title={`Max ${maxDiscount}%`}
        />
      </td>

      {/* Line Total */}
      <td className="col-currency" style={{ color: isBelowCost ? '#DC2626' : 'var(--color-primary)', fontWeight: 700, padding: '8px 6px', textAlign: 'right' }}>
        {item.line_total.toLocaleString()}
      </td>

      {/* Item Profit Column */}
      {canViewProfit && (
        <td className="col-currency" style={{ padding: '8px 6px', textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: lineProfit > 0 ? '#16A34A' : lineProfit < 0 ? '#DC2626' : 'var(--color-text-muted)'
          }}>
            {lineProfit > 0 ? `+${lineProfit.toLocaleString()}` : lineProfit.toLocaleString()}
          </div>
          {item.line_total > 0 && (
            <div style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              color: marginPct >= 0 ? '#16A34A' : '#DC2626',
              marginTop: 1
            }}>
              {marginPct.toFixed(0)}% margin
            </div>
          )}
        </td>
      )}

      {/* Remove */}
      <td style={{ padding: '8px 6px' }} onClick={e => e.stopPropagation()}>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={onRemove}
          style={{ color: 'var(--color-danger)' }}
          title="Remove item"
        ><Trash2 size={13} /></button>
      </td>
    </tr>
  )
}

// ============================================================
// ITEM SEARCH & PREDICTIVE MULTI-ADD MODAL
// ============================================================

function HighlightMatch({ text, query }: { text?: string | null; query: string }) {
  if (!text) return null
  if (!query.trim()) return <>{text}</>
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (tokens.length === 0) return <>{text}</>
  const regex = new RegExp(`(${tokens.join('|')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            style={{
              background: 'rgba(250, 204, 21, 0.45)',
              color: 'var(--color-text-primary)',
              fontWeight: 700,
              borderRadius: 2,
              padding: '0 2px'
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function ItemSearchModal({
  cart,
  onAddToCart,
  onClose,
  canViewCost
}: {
  cart: CartItem[]
  onAddToCart: (item: Item, qty?: number) => void
  onClose: () => void
  canViewCost: boolean
}) {
  const [query, setQuery] = useState('')
  const [allItems, setAllItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockOnlyFilter, setStockOnlyFilter] = useState(false)
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Load all available products initially
  const loadAllItems = async () => {
    setLoading(true)
    try {
      const items = await window.api.getAllItems()
      setAllItems(items || [])
      if (items && items.length > 0 && !selected) {
        setSelected(items[0])
      }
    } catch (err) {
      console.error('Failed to load items:', err)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllItems()
    inputRef.current?.focus()
  }, [])

  // Sync with server-side search query when user types to guarantee no items are missed
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return

    const timer = setTimeout(async () => {
      try {
        const serverResults = await window.api.searchItems(trimmed)
        if (serverResults && serverResults.length > 0) {
          setAllItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const newItems = serverResults.filter(i => !existingIds.has(i.id))
            if (newItems.length > 0) {
              return [...prev, ...newItems]
            }
            return prev
          })
        }
      } catch (err) {
        console.error('Server search error:', err)
      }
    }, 120)

    return () => clearTimeout(timer)
  }, [query])

  // Predictive search scoring algorithm with robust normalization
  const filteredAndRankedItems = React.useMemo(() => {
    const rawQ = query.trim().toLowerCase()
    const normQ = rawQ.replace(/[^a-z0-9]/g, '')
    const tokens = rawQ.split(/\s+/).filter(Boolean)

    let list = allItems

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter(item => item.category_name === categoryFilter)
    }

    // In-stock only filter
    if (stockOnlyFilter) {
      list = list.filter(item => (item.quantity_on_hand ?? 0) > 0)
    }

    if (!rawQ) {
      return list
    }

    // Predictive scoring
    const scored = list
      .map(item => {
        const name = (item.name || '').toLowerCase()
        const part = (item.part_number || '').toLowerCase()
        const barcode = (item.barcode || '').toLowerCase()
        const brand = (item.brand_name || '').toLowerCase()
        const cat = (item.category_name || '').toLowerCase()
        const variant = (item.size_variant || '').toLowerCase()
        const supplier = (item.supplier_name || '').toLowerCase()

        const normName = name.replace(/[^a-z0-9]/g, '')
        const normPart = part.replace(/[^a-z0-9]/g, '')
        const normBarcode = barcode.replace(/[^a-z0-9]/g, '')
        const normBrand = brand.replace(/[^a-z0-9]/g, '')
        const normCat = cat.replace(/[^a-z0-9]/g, '')

        let score = 0

        // 1. Barcode exact, prefix, or contains match
        if (barcode === rawQ) score += 600
        else if (barcode.startsWith(rawQ)) score += 400
        else if (barcode.includes(rawQ)) score += 200
        else if (normQ && normBarcode.includes(normQ)) score += 250

        // 2. Part number / SKU exact, prefix, or contains match (with punctuation stripping)
        if (part === rawQ) score += 550
        else if (part.startsWith(rawQ)) score += 380
        else if (part.includes(rawQ)) score += 220
        else if (normQ && normPart === normQ) score += 480
        else if (normQ && normPart.startsWith(normQ)) score += 340
        else if (normQ && normPart.includes(normQ)) score += 200

        // 3. Name exact, starts-with, or word-starts match
        if (name === rawQ) score += 500
        else if (name.startsWith(rawQ)) score += 320
        else if (normQ && normName.startsWith(normQ)) score += 280
        else {
          const nameWords = name.split(/\s+/)
          if (nameWords.some(w => w.startsWith(rawQ))) score += 220
          else if (name.includes(rawQ)) score += 150
          else if (normQ && normName.includes(normQ)) score += 140
        }

        // 4. Brand, Category, Variant, Supplier direct match
        if (brand && (brand.includes(rawQ) || (normQ && normBrand.includes(normQ)))) score += 110
        if (cat && (cat.includes(rawQ) || (normQ && normCat.includes(normQ)))) score += 110
        if (variant && variant.includes(rawQ)) score += 100
        if (supplier && supplier.includes(rawQ)) score += 90

        // 5. Multi-token matches
        const haystack = `${name} ${part} ${barcode} ${brand} ${cat} ${variant} ${supplier}`
        const normHaystack = `${normName} ${normPart} ${normBarcode} ${normBrand} ${normCat}`
        let matchedTokens = 0
        for (const t of tokens) {
          const normT = t.replace(/[^a-z0-9]/g, '')
          if (haystack.includes(t) || (normT && normHaystack.includes(normT))) {
            matchedTokens++
          }
        }

        if (tokens.length > 0 && matchedTokens === tokens.length) {
          score += 120 + (matchedTokens * 20)
        } else if (matchedTokens > 0) {
          score += (matchedTokens / tokens.length) * 80
        }

        // In-stock bonus
        if ((item.quantity_on_hand ?? 0) > 0) {
          score += 10
        }

        return { item, score }
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)

    return scored
  }, [allItems, query, categoryFilter, stockOnlyFilter])

  // Extract unique categories for quick filter chips
  const categories = React.useMemo(() => {
    const set = new Set<string>()
    allItems.forEach(i => {
      if (i.category_name) set.add(i.category_name)
    })
    return Array.from(set).sort()
  }, [allItems])

  // Synchronize selection when filtered list changes
  useEffect(() => {
    if (filteredAndRankedItems.length > 0) {
      // If currently selected is in results, keep it; otherwise select top predicted match
      if (!selected || !filteredAndRankedItems.some(i => i.id === selected.id)) {
        setSelected(filteredAndRankedItems[0])
      }
    } else {
      setSelected(null)
    }
  }, [filteredAndRankedItems])

  // In-cart quantity helper
  const getInCartQty = (itemId: string) => {
    const match = cart.find(c => c.item_id === itemId)
    return match ? match.qty : 0
  }

  // Single click: select item to view specifications, then refocus input
  const handleSelectItem = (item: Item) => {
    setSelected(item)
    // Restore keyboard focus to search input so Arrow+Enter still work after a mouse click
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  // Instant add 1 to cart
  const handleQuickAddOne = (item: Item) => {
    const available = item.quantity_on_hand ?? 0
    if (available <= 0) {
      toast.error(`"${item.name}" is OUT OF STOCK (0 in stock)!`, { icon: '⚠️', duration: 3000 })
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    const inCart = getInCartQty(item.id)
    if (inCart + 1 > available) {
      toast.error(`Cannot add more "${item.name}". Only ${available} available in stock!`, { icon: '⚠️', duration: 3200 })
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }

    onAddToCart(item, 1)
    setRecentlyAddedId(item.id)
    setTimeout(() => setRecentlyAddedId(null), 700)
    // Always return focus to search input so keyboard still works after mouse click
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  // Keyboard navigation — attached to the search input onKeyDown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    handleNavKey(e.nativeEvent)
  }

  // Core navigation logic — shared between input onKeyDown and the window listener
  const handleNavKey = (e: KeyboardEvent | React.KeyboardEvent['nativeEvent']) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredAndRankedItems.length === 0) return
      const idx = selected ? filteredAndRankedItems.findIndex(i => i.id === selected.id) : -1
      const nextIdx = Math.min(idx + 1, filteredAndRankedItems.length - 1)
      setSelected(filteredAndRankedItems[nextIdx])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredAndRankedItems.length === 0) return
      const idx = selected ? filteredAndRankedItems.findIndex(i => i.id === selected.id) : -1
      const prevIdx = Math.max(idx - 1, 0)
      setSelected(filteredAndRankedItems[prevIdx])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selected) {
        handleQuickAddOne(selected)
      } else if (filteredAndRankedItems.length > 0) {
        handleQuickAddOne(filteredAndRankedItems[0])
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      onClose()
    }
  }

  // Window-level keyboard listener: ensures navigation works after mouse clicks
  // move focus to a row button (not the search input itself — that has its own handler).
  useEffect(() => {
    const handleWindowKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Skip when typing in the search input — its own onKeyDown handles it
      if (target === inputRef.current) return
      const isOtherInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isOtherInput) return

      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        handleNavKey(e)
      }
    }
    window.addEventListener('keydown', handleWindowKey, { capture: true })
    return () => window.removeEventListener('keydown', handleWindowKey, { capture: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAndRankedItems, selected])

  const selectedInCartQty = selected ? getInCartQty(selected.id) : 0
  const selectedRemainingStock = selected ? Math.max(0, (selected.quantity_on_hand ?? 0) - selectedInCartQty) : 0
  const totalCartQty = cart.reduce((s, i) => s + i.qty, 0)
  const totalCartAmount = cart.reduce((s, i) => s + i.line_total, 0)
  const inStockCount = allItems.filter(i => (i.quantity_on_hand ?? 0) > 0).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-xl"
        onClick={e => e.stopPropagation()}
        style={{ height: '88vh', maxWidth: 1200, display: 'flex', flexDirection: 'column' }}
      >
        {/* MODAL HEADER WITH LIVE CART SUMMARY */}
        <div className="modal-header" style={{ padding: '12px 20px', background: 'var(--color-surface)', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-10)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Search size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>POS Item Search & Quick Add</span>
                <span className="hotkey" style={{ fontSize: '0.625rem' }}>F10</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Predictive item search · Click or press Enter to add item to cart
              </div>
            </div>
          </div>

          {/* Live Cart Status Banner */}
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-surface-2)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
              <ShoppingCart size={15} style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>Cart:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {cart.length} items ({totalCartQty} pcs)
              </strong>
            </div>
            <span style={{ color: 'var(--color-border)', fontWeight: 300 }}>|</span>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
              Rs. {totalCartAmount.toLocaleString()}
            </div>
          </div>

          {/* Done / Close Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={onClose}
            style={{ gap: 6, padding: '0 14px' }}
            title="Finished adding items — Return to POS (Esc)"
          >
            <Check size={14} /> Done
            <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none' }}>Esc</span>
          </button>

          <button className="modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* SEARCH & PREDICTIVE TOOLBAR */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={18}
                style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: query ? 'var(--color-primary)' : 'var(--color-text-muted)'
                }}
              />
              <input
                ref={inputRef}
                className="form-input form-input-lg"
                placeholder="Predictive search: type item name, part #, brand, or scan barcode..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ paddingLeft: 42, paddingRight: query ? 36 : 14 }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); inputRef.current?.focus() }}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
                    padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              className={`btn btn-sm ${stockOnlyFilter ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStockOnlyFilter(!stockOnlyFilter)}
              style={{ height: 46, borderRadius: 'var(--radius-lg)', padding: '0 14px' }}
              title="Show only items currently with positive stock"
            >
              <Boxes size={15} />
              In Stock Only
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadAllItems}
              disabled={loading}
              style={{ height: 46, borderRadius: 'var(--radius-lg)', padding: '0 12px' }}
              title="Reload all items from database"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>

          {/* Filter Pills / Categories */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', paddingBottom: 2 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={12} /> Filter:
            </span>
            <button
              className="btn btn-sm"
              onClick={() => setCategoryFilter('all')}
              style={{
                height: 26, fontSize: '0.6875rem', padding: '0 10px',
                borderRadius: 'var(--radius-full)',
                background: categoryFilter === 'all' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: categoryFilter === 'all' ? '#fff' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              All Items ({allItems.length})
            </button>

            {categories.map(cat => {
              const count = allItems.filter(i => i.category_name === cat).length
              const isActive = categoryFilter === cat
              return (
                <button
                  key={cat}
                  className="btn btn-sm"
                  onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
                  style={{
                    height: 26, fontSize: '0.6875rem', padding: '0 10px',
                    borderRadius: 'var(--radius-full)',
                    background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat} ({count})
                </button>
              )
            })}
          </div>

          {/* Predictive Best Match Banner */}
          {query.trim() && filteredAndRankedItems.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--color-surface)', padding: '6px 12px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary-20)',
              fontSize: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} style={{ color: '#EAB308' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Top Prediction:</span>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {filteredAndRankedItems[0].name}
                </strong>
                <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                  Rs. {filteredAndRankedItems[0].retail_price.toLocaleString()}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                  Stock: {filteredAndRankedItems[0].quantity_on_hand}
                </span>
              </div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                Showing {filteredAndRankedItems.length} matches · Press <span className="hotkey" style={{ fontSize: '0.6rem' }}>Enter</span> to add
              </span>
            </div>
          )}
        </div>

        {/* MAIN BODY: PRODUCT LIST (LEFT) & QUANTITY ACTION PANEL (RIGHT) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* PRODUCTS LIST */}
          <div
            ref={resultsContainerRef}
            style={{
              flex: 1,
              overflow: 'auto',
              borderRight: '1px solid var(--color-border)',
              background: 'var(--color-surface)'
            }}
          >
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={28} className="spin" style={{ marginBottom: 12, opacity: 0.6 }} />
                <p>Loading available products...</p>
              </div>
            ) : filteredAndRankedItems.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <Package size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 8 }} />
                <h4>No matching products found</h4>
                <p style={{ maxWidth: 320, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  No items matched your search query "{query}". Try searching by a different term or clear filters.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setQuery(''); setCategoryFilter('all'); setStockOnlyFilter(false) }}
                  style={{ marginTop: 12 }}
                >
                  Show All Available Products
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '8px 16px', background: 'var(--color-surface-2)',
                  fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                  color: 'var(--color-text-muted)', letterSpacing: '0.05em',
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <span>Available Products ({filteredAndRankedItems.length})</span>
                  <span>Click / Press Enter to add to cart</span>
                </div>

                {filteredAndRankedItems.map((item, index) => {
                  const isSelected = selected?.id === item.id
                  const isOutOfStock = (item.quantity_on_hand ?? 0) <= 0
                  const isLowStock = (item.quantity_on_hand ?? 0) > 0 && (item.quantity_on_hand ?? 0) <= item.reorder_level
                  const inCartQty = getInCartQty(item.id)
                  const isRecentlyAdded = recentlyAddedId === item.id

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onDoubleClick={() => handleQuickAddOne(item)}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--color-surface-2)',
                        background: isRecentlyAdded
                          ? 'rgba(22, 163, 74, 0.18)'
                          : isSelected
                            ? 'var(--color-primary-10)'
                            : 'transparent',
                        borderLeft: isSelected
                          ? '4px solid var(--color-primary)'
                          : '4px solid transparent',
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        opacity: isOutOfStock ? 0.65 : 1,
                        transition: 'all 0.12s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                      title={isOutOfStock ? 'Out of stock' : 'Single-click to set quantity · Double-click to add 1'}
                    >
                      {/* Left: Product Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: '0.6875rem', color: 'var(--color-text-muted)',
                            fontFamily: 'var(--font-mono)', width: 22
                          }}>
                            #{index + 1}
                          </span>
                          <span style={{
                            fontWeight: 600, fontSize: '0.875rem',
                            color: 'var(--color-text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            <HighlightMatch text={item.name} query={query} />
                          </span>

                          {/* In-Cart Pill Badge */}
                          {inCartQty > 0 && (
                            <span
                              className="badge badge-success"
                              style={{
                                fontSize: '0.625rem', padding: '2px 7px',
                                gap: 3, boxShadow: '0 1px 3px rgba(22,163,74,0.2)'
                              }}
                            >
                              <Check size={10} /> {inCartQty} in cart
                            </span>
                          )}
                        </div>

                        <div style={{
                          display: 'flex', gap: 8, alignItems: 'center',
                          fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 3
                        }}>
                          {item.part_number && (
                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                              Part: <HighlightMatch text={item.part_number} query={query} />
                            </span>
                          )}
                          {item.barcode && (
                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                              BC: <HighlightMatch text={item.barcode} query={query} />
                            </span>
                          )}
                          {item.brand_name && <span>· {item.brand_name}</span>}
                          {item.category_name && <span>· {item.category_name}</span>}
                          {item.size_variant && <span>· {item.size_variant}</span>}
                        </div>
                      </div>

                      {/* Right: Price & Stock Status & Quick +1 button */}
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                        <div>
                          <div style={{
                            fontWeight: 700, fontFamily: 'var(--font-mono)',
                            color: 'var(--color-primary)', fontSize: '0.9375rem'
                          }}>
                            Rs. {item.retail_price.toLocaleString()}
                          </div>

                          <div style={{ marginTop: 2 }}>
                            {isOutOfStock ? (
                              <span className="badge badge-danger" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
                                OUT OF STOCK (0)
                              </span>
                            ) : isLowStock ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
                                Low: {item.quantity_on_hand} pcs ⚠
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-success)', fontWeight: 600 }}>
                                Stock: {item.quantity_on_hand} pcs
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Quick +1 Button */}
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuickAddOne(item)
                          }}
                          style={{
                            padding: '4px 8px',
                            height: 30,
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: isRecentlyAdded ? 'var(--color-success)' : 'var(--color-surface-2)',
                            color: isRecentlyAdded ? '#fff' : 'var(--color-text-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                          title="Quick add 1 unit to cart"
                        >
                          <Plus size={13} /> 1
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT ACTION & QUANTITY DETAIL PANEL */}
          <div style={{
            width: 340,
            padding: '16px 20px',
            background: 'var(--color-surface)',
            overflowY: 'auto',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--color-border)', paddingBottom: 10
            }}>
              <h5 style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.875rem' }}>
                Item Quantity & Details
              </h5>
              {selected && (
                <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
                  {selectedInCartQty > 0 ? `${selectedInCartQty} in cart` : 'Not in cart'}
                </span>
              )}
            </div>

            {selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Item Card */}
                <div style={{
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 14,
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.part_number && <span>Part: {selected.part_number}</span>}
                    {selected.brand_name && <span>· {selected.brand_name}</span>}
                    {selected.category_name && <span>· {selected.category_name}</span>}
                  </div>
                </div>

                {/* Stock & Cart Summary Breakdown */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  background: 'var(--color-bg)', padding: 10, borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Stock on Hand</div>
                    <div style={{
                      fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem',
                      color: (selected.quantity_on_hand ?? 0) <= 0 ? 'var(--color-danger)' : 'var(--color-success)'
                    }}>
                      {selected.quantity_on_hand ?? 0} pcs
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>In Cart Now</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--color-primary)' }}>
                      {selectedInCartQty} pcs
                    </div>
                  </div>
                </div>

                {/* Extra Specifications */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                  {[
                    { label: 'Retail Price', value: `Rs. ${selected.retail_price.toLocaleString()}` },
                    ...(canViewCost ? [{ label: 'Cost Price', value: `Rs. ${selected.cost_price.toLocaleString()}`, muted: true }] : []),
                    ...(selected.barcode ? [{ label: 'Barcode', value: selected.barcode }] : []),
                    ...(selected.supplier_name ? [{ label: 'Supplier', value: selected.supplier_name }] : []),
                    ...(selected.size_variant ? [{ label: 'Size / Variant', value: selected.size_variant }] : []),
                    ...(selected.reorder_level ? [{ label: 'Reorder Level', value: `${selected.reorder_level} pcs` }] : [])
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '4px 0', borderBottom: '1px solid var(--color-surface-2)'
                    }}>
                      <span style={{ color: (row as {muted?: boolean}).muted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
                        {row.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 60 }}>
                <Search size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: '0.8125rem' }}>Select an item from the list to view detailed specifications.</p>
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--color-surface-2)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)'
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Total Available Products: <strong style={{ color: 'var(--color-text-primary)' }}>{allItems.length}</strong></span>
            <span>In Stock: <strong style={{ color: 'var(--color-success)' }}>{inStockCount}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Use <span className="hotkey">↑</span> <span className="hotkey">↓</span> to navigate · <span className="hotkey">Enter</span> to add
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={onClose}
              style={{ gap: 6 }}
            >
              <Check size={14} /> Finish & Back to POS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PAYMENT MODAL
// ============================================================
function PaymentModal({
  grandTotal, paymentMethod, bankProvider, otherBankName, bankRef,
  amountTendered, change, processing,
  onMethodChange, onBankProviderChange, onOtherBankNameChange, onBankRefChange,
  onTenderedChange, onConfirm, onClose
}: {
  grandTotal: number
  paymentMethod: string
  bankProvider: 'JazzCash' | 'EasyPaisa' | 'Other Bank'
  otherBankName: string
  bankRef: string
  amountTendered: string
  change: number
  processing: boolean
  onMethodChange: (m: 'cash' | 'card' | 'bank' | 'split' | 'credit' | 'partial') => void
  onBankProviderChange: (b: 'JazzCash' | 'EasyPaisa' | 'Other Bank') => void
  onOtherBankNameChange: (v: string) => void
  onBankRefChange: (v: string) => void
  onTenderedChange: (v: string) => void
  onConfirm: (tenderedValue?: string | number) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isInputActive, setIsInputActive] = useState(false)
  const methods: ('cash' | 'card' | 'bank' | 'split' | 'partial')[] = ['cash', 'card', 'bank', 'split', 'partial']

  // Keep latest references to avoid stale closures in keyboard events
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const onMethodChangeRef = useRef(onMethodChange)
  onMethodChangeRef.current = onMethodChange

  const onBankProviderChangeRef = useRef(onBankProviderChange)
  onBankProviderChangeRef.current = onBankProviderChange

  const onTenderedChangeRef = useRef(onTenderedChange)
  onTenderedChangeRef.current = onTenderedChange

  const amountTenderedRef = useRef(amountTendered)
  amountTenderedRef.current = amountTendered

  const paymentMethodRef = useRef(paymentMethod)
  paymentMethodRef.current = paymentMethod

  const grandTotalRef = useRef(grandTotal)
  grandTotalRef.current = grandTotal

  const processingRef = useRef(processing)
  processingRef.current = processing

  // Keyboard navigation inside payment modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (processingRef.current) return

      const target = e.target as HTMLElement | null
      const isInputFocused = target === inputRef.current || (target && target.tagName === 'INPUT')

      if (e.key === 'Escape') {
        e.preventDefault()
        if (isInputFocused && inputRef.current) {
          inputRef.current.blur()
          setIsInputActive(false)
        } else {
          onCloseRef.current()
        }
        return
      }

      if (e.key === 'Tab' && !isInputFocused) {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      const curMethod = paymentMethodRef.current
      const curGrandTotal = grandTotalRef.current

      // If NOT typing in an active text input: Arrow keys switch Payment Method
      if (!isInputFocused) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          const curIdx = methods.indexOf(curMethod as any)
          const nextIdx = (curIdx - 1 + methods.length) % methods.length
          const nextMethod = methods[nextIdx]
          onMethodChangeRef.current(nextMethod)
          if (nextMethod !== 'cash') {
            onTenderedChangeRef.current(curGrandTotal.toString())
          }
          return
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          const curIdx = methods.indexOf(curMethod as any)
          const nextIdx = (curIdx + 1) % methods.length
          const nextMethod = methods[nextIdx]
          onMethodChangeRef.current(nextMethod)
          if (nextMethod !== 'cash') {
            onTenderedChangeRef.current(curGrandTotal.toString())
          }
          return
        }

        // Quick numbers 1, 2, 3 to select bank provider if bank is selected
        if (curMethod === 'bank') {
          if (e.key === '1') {
            e.preventDefault()
            onBankProviderChangeRef.current('JazzCash')
            return
          } else if (e.key === '2') {
            e.preventDefault()
            onBankProviderChangeRef.current('EasyPaisa')
            return
          } else if (e.key === '3') {
            e.preventDefault()
            onBankProviderChangeRef.current('Other Bank')
            return
          }
        }

        // Enter key when on Cash: First Enter focuses amount input for custom cash, or Enter again submits
        if (e.key === 'Enter') {
          e.preventDefault()
          if (curMethod === 'cash') {
            if (inputRef.current) {
              inputRef.current.focus()
              inputRef.current.select()
              setIsInputActive(true)
            }
          } else {
            onConfirmRef.current(amountTenderedRef.current)
          }
          return
        }
      } else {
        // In amount input, hitting Enter confirms and submits sale with current input value
        if (e.key === 'Enter') {
          e.preventDefault()
          const currentVal = inputRef.current ? inputRef.current.value : amountTenderedRef.current
          onConfirmRef.current(currentVal)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ maxWidth: 470 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title">Payment & Settlement</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Amount due */}
          <div style={{
            textAlign: 'center', marginBottom: 16,
            padding: '12px 14px', background: 'var(--color-primary-10)',
            borderRadius: 12, border: '1px solid var(--color-primary-20)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Amount Due</div>
            <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              Rs. {grandTotal.toLocaleString()}
            </div>
          </div>

          {/* Payment method selector */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                1. Select Payment Method
              </label>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Use <span className="hotkey">←</span> <span className="hotkey">→</span> to switch
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { key: 'cash', label: '💵 Cash' },
                { key: 'card', label: '💳 Card' },
                { key: 'bank', label: '🏦 Bank / Wallet' },
                { key: 'split', label: '⚡ Split' },
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  className={`btn ${paymentMethod === m.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    onMethodChange(m.key as 'cash' | 'card' | 'bank' | 'split')
                    if (m.key !== 'cash') {
                      onTenderedChange(grandTotal.toString())
                    }
                  }}
                  style={{
                    fontWeight: 700,
                    justifyContent: 'center',
                    border: paymentMethod === m.key ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    boxShadow: paymentMethod === m.key ? '0 0 0 3px var(--color-primary-20)' : 'none',
                    transform: paymentMethod === m.key ? 'scale(1.02)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {m.label}
                </button>
              ))}
              {/* Partial Payment — full-width row */}
              <button
                type="button"
                className={`btn ${paymentMethod === 'partial' ? 'btn-warning' : 'btn-secondary'}`}
                onClick={() => {
                  onMethodChange('partial' as any)
                  onTenderedChange('')
                }}
                style={{
                  gridColumn: '1 / -1',
                  fontWeight: 700,
                  justifyContent: 'center',
                  border: paymentMethod === 'partial' ? '2.5px solid var(--color-warning)' : '1px solid var(--color-border)',
                  boxShadow: paymentMethod === 'partial' ? '0 0 0 3px rgba(245,158,11,0.25)' : 'none',
                  transform: paymentMethod === 'partial' ? 'scale(1.01)' : 'none',
                  background: paymentMethod === 'partial' ? 'rgba(245,158,11,0.15)' : undefined,
                  color: paymentMethod === 'partial' ? 'var(--color-warning)' : undefined,
                  transition: 'all 0.15s ease'
                }}
              >
                💰 Partial Payment (Collect Now, Rest Pending)
              </button>
            </div>
          </div>

          {/* Bank / Online Sub-Providers (JazzCash, EasyPaisa, Other Bank) */}
          {paymentMethod === 'bank' && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              padding: '12px 14px', background: 'var(--color-surface-2)',
              borderRadius: 10, border: '1px solid var(--color-border)',
              marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  2. Select Bank Provider
                </div>
                <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                  Press <span className="hotkey">1</span> <span className="hotkey">2</span> <span className="hotkey">3</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  { key: 'JazzCash', label: '🟠 1: JazzCash', color: '#E11D48' },
                  { key: 'EasyPaisa', label: '🟢 2: EasyPaisa', color: '#059669' },
                  { key: 'Other Bank', label: '🏦 3: Other Bank', color: '#2563EB' },
                ].map(b => (
                  <button
                    key={b.key}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: bankProvider === b.key ? b.color : 'var(--color-surface)',
                      color: bankProvider === b.key ? '#fff' : 'var(--color-text-primary)',
                      border: `1.5px solid ${bankProvider === b.key ? b.color : 'var(--color-border)'}`,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '6px 4px'
                    }}
                    onClick={() => onBankProviderChange(b.key as typeof bankProvider)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {bankProvider === 'Other Bank' && (
                <input
                  className="form-input"
                  placeholder="Bank Name (e.g. Meezan, HBL, Allied, Alfalah)"
                  value={otherBankName}
                  onChange={e => onOtherBankNameChange(e.target.value)}
                  style={{ fontSize: '0.8125rem' }}
                />
              )}

              <input
                className="form-input"
                placeholder="Transaction ID / Sender Number (Optional)"
                value={bankRef}
                onChange={e => onBankRefChange(e.target.value)}
                style={{ fontSize: '0.8125rem' }}
              />

              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                ✓ Rs. {grandTotal.toLocaleString()} will be recorded via <strong>{bankProvider === 'Other Bank' && otherBankName ? otherBankName : bankProvider}</strong>
              </div>
            </div>
          )}

          {/* Amount tendered for cash */}
          {paymentMethod === 'cash' && (() => {
            const enteredCash = parseFloat(amountTendered) || 0
            const isPartialCash = enteredCash > 0 && enteredCash < grandTotal
            const pendingCash = isPartialCash ? grandTotal - enteredCash : 0

            return (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                    2. Cash Tendered (Received)
                  </label>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    Hit <span className="hotkey">Enter</span> to edit / submit
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="number"
                  className="form-input form-input-lg"
                  value={amountTendered}
                  onFocus={e => {
                    setIsInputActive(true)
                    e.target.select()
                  }}
                  onBlur={() => setIsInputActive(false)}
                  onChange={e => onTenderedChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      onConfirm((e.target as HTMLInputElement).value)
                    }
                  }}
                  placeholder={grandTotal.toString()}
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    border: isPartialCash ? '2px solid var(--color-warning)' : isInputActive ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    boxShadow: isPartialCash ? '0 0 0 3px rgba(245,158,11,0.2)' : isInputActive ? '0 0 0 3px var(--color-primary-20)' : 'none'
                  }}
                />
                {change > 0 && !isPartialCash && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: 'var(--color-success-bg)',
                    borderRadius: 8, border: '1px solid #86EFAC', marginTop: 8
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Change to Return</span>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1.125rem', color: 'var(--color-success)' }}>
                      Rs. {change.toLocaleString()}
                    </span>
                  </div>
                )}
                {isPartialCash && (
                  <>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8
                    }}>
                      <div style={{
                        flex: 1, padding: '8px 12px', background: 'var(--color-success-bg)',
                        borderRadius: 8, border: '1px solid #86EFAC', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: 700 }}>COLLECTED NOW</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                          Rs. {enteredCash.toLocaleString()}
                        </div>
                      </div>
                      <div style={{
                        flex: 1, padding: '8px 12px', background: 'rgba(245, 158, 11, 0.12)',
                        borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.4)', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.65rem', color: '#B45309', fontWeight: 700 }}>PENDING BALANCE DUE</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)' }}>
                          Rs. {pendingCash.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#B45309', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} />
                      <span>Invoice will be saved as <strong>Pending</strong>. Remaining dues can be paid in <strong>Pending Invoices</strong>.</span>
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {paymentMethod === 'card' && (
            <div style={{
              padding: '12px 14px', background: 'var(--color-surface-2)',
              borderRadius: 8, border: '1px solid var(--color-border)',
              marginBottom: 14, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Card Payment</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Total of <strong>Rs. {grandTotal.toLocaleString()}</strong> will be charged to the card terminal. Hit <span className="hotkey">Enter</span> to complete sale.
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'split' && (
            <div style={{
              padding: '12px 14px', background: 'var(--color-surface-2)',
              borderRadius: 8, border: '1px solid var(--color-border)',
              marginBottom: 14, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <RefreshCw size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Split Payment</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Total of <strong>Rs. {grandTotal.toLocaleString()}</strong> settled across split channels. Hit <span className="hotkey">Enter</span> to complete sale.
                </div>
              </div>
            </div>
          )}

          {/* Partial Payment UI */}
          {paymentMethod === 'partial' && (() => {
            const partialCollected = parseFloat(amountTendered) || 0
            const pendingBalance = Math.max(0, grandTotal - partialCollected)
            return (
              <div style={{
                padding: '14px', background: 'rgba(245,158,11,0.08)',
                borderRadius: 10, border: '1.5px solid rgba(245,158,11,0.35)',
                marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet size={14} /> Partial Payment — Cash Collected Now
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Cash Collected from Customer (Rs.)
                  </label>
                  <input
                    ref={inputRef}
                    type="number"
                    className="form-input form-input-lg"
                    value={amountTendered}
                    onFocus={e => {
                      setIsInputActive(true)
                      e.target.select()
                    }}
                    onBlur={() => setIsInputActive(false)}
                    onChange={e => onTenderedChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.stopPropagation()
                        onConfirm((e.target as HTMLInputElement).value)
                      }
                    }}
                    placeholder="Enter amount received..."
                    autoFocus
                    style={{
                      fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                      border: '2px solid var(--color-warning)',
                      boxShadow: '0 0 0 3px rgba(245,158,11,0.2)'
                    }}
                  />
                </div>
                {partialCollected > 0 && pendingBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{
                      flex: 1, padding: '8px 12px', background: 'var(--color-success-bg)',
                      borderRadius: 8, border: '1px solid #86EFAC', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: 600 }}>COLLECTED NOW</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                        Rs. {partialCollected.toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      flex: 1, padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
                      borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-danger)', fontWeight: 600 }}>PENDING BALANCE</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                        Rs. {pendingBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-warning)' }} />
                  <span>Invoice will be saved as <strong>Pending</strong>. Settle remaining in <strong>Pending Invoices</strong>.</span>
                </div>
              </div>
            )
          })()}
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
          </button>
          <button
            className="btn btn-success btn-lg"
            onClick={() => onConfirm(inputRef.current ? inputRef.current.value : amountTendered)}
            disabled={processing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {processing ? '⏳ Processing...' : (() => {
              const enteredCash = parseFloat(amountTendered) || 0
              const isPartial = paymentMethod === 'partial' || (paymentMethod === 'cash' && enteredCash > 0 && enteredCash < grandTotal)
              const pending = isPartial ? Math.max(0, grandTotal - enteredCash) : 0

              return (
                <>
                  <CheckCircle size={16} />
                  {isPartial ? `Save Partial (Rs. ${pending.toLocaleString()} Pending)` : 'Complete Sale'}
                  <span className="hotkey" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', marginLeft: 4 }}>Enter</span>
                </>
              )
            })()}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CUSTOMER SELECT & ADD MODAL
// ============================================================
function CustomerSelectModal({ onSelect, onClose, source }: {
  onSelect: (c: Customer) => void
  onClose: () => void
  source?: string
}) {
  const { currentUser } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [mode, setMode] = useState<'add' | 'search'>('add')
  const [query, setQuery] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('regular')
  const [newNotes, setNewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getAllCustomers().then(list => setCustomers(list || []))
  }, [])

  // Escape or Tab closes customer modal and returns to POS cart
  useEffect(() => {
    const handleModalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleModalKey)
    return () => window.removeEventListener('keydown', handleModalKey)
  }, [onClose])

  useEffect(() => {
    if (mode === 'add') {
      setTimeout(() => phoneInputRef.current?.focus(), 50)
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [mode])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.phone || '').includes(query) ||
    (c.whatsapp || '').includes(query)
  )

  const normalize = (p?: string) => (p || '').replace(/[\s\-\(\)\.]/g, '')
  const cleanedNewPhone = normalize(newPhone)

  const existingPhoneMatch = cleanedNewPhone.length >= 7 ? customers.find(c => {
    const cp = normalize(c.phone)
    const cw = normalize(c.whatsapp)
    const last7 = cleanedNewPhone.slice(-7)
    return (cp && (cp === cleanedNewPhone || cp.endsWith(last7))) ||
           (cw && (cw === cleanedNewPhone || cw.endsWith(last7)))
  }) : null

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (existingPhoneMatch) {
        toast.success(`Customer "${existingPhoneMatch.name}" selected!`)
        onSelect(existingPhoneMatch)
      } else {
        nameInputRef.current?.focus()
      }
    } else if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (existingPhoneMatch) {
      toast.success(`Customer "${existingPhoneMatch.name}" with phone ${newPhone} is already registered. Auto-selected!`)
      onSelect(existingPhoneMatch)
      return
    }

    if (!newName.trim()) {
      toast.error('Please enter customer full name')
      nameInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      const result = await window.api.createCustomer(currentUser!.id, {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        whatsapp: newPhone.trim() || undefined,
        type: newType,
        notes: newNotes.trim() || undefined
      })
      if (result.success && result.data) {
        toast.success(`Customer "${result.data.name}" added and assigned to sale!`, { duration: 2500 })
        onSelect(result.data)
      } else {
        toast.error(result.error || 'Failed to add customer')
      }
    } catch (err) {
      toast.error('Error saving customer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        className="modal modal-md"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header (Fixed) */}
        <div className="modal-header" style={{ background: 'var(--color-surface)', flexShrink: 0, padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-10)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <User size={18} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Customer Details</span>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Assign customer to active sale invoice
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Compulsory Notice Banner for WhatsApp & Social (Fixed) */}
        {(source === 'whatsapp' || source === 'socialmedia') && (
          <div style={{
            flexShrink: 0,
            margin: '10px 16px 0',
            padding: '8px 12px',
            background: source === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'rgba(124,58,237,0.12)',
            border: `1px solid ${source === 'whatsapp' ? 'rgba(37,211,102,0.35)' : 'rgba(124,58,237,0.35)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: source === 'whatsapp' ? '#15803D' : '#6D28D9',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>
              Customer details are <strong>compulsory</strong> for {source === 'whatsapp' ? 'WhatsApp' : 'Social'} orders (no walk-in customer allowed).
            </span>
          </div>
        )}

        {/* Tab Toggle Navigation (Fixed) */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          padding: '0 16px'
        }}>
          <button
            type="button"
            onClick={() => setMode('add')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: mode === 'add' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: mode === 'add' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: mode === 'add' ? 700 : 500,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={14} /> Add Customer Details
          </button>

          <button
            type="button"
            onClick={() => setMode('search')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: mode === 'search' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: mode === 'search' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: mode === 'search' ? 700 : 500,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Search size={14} /> Search Database ({customers.length})
          </button>
        </div>

        {/* MODE: ADD NEW CUSTOMER DETAILS */}
        {mode === 'add' && (
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Scrollable Form Body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 1. Phone / WhatsApp Number First */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                    1. Phone / WhatsApp Number
                  </label>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    Auto-checks existing records
                  </span>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  className="form-input form-input-lg"
                  placeholder="e.g. 0300 1234567..."
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                  autoFocus
                />
              </div>

              {/* Live Phone Duplicate Check Banner */}
              {existingPhoneMatch && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1.5px solid var(--color-primary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      ℹ️ Existing Customer: {existingPhoneMatch.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Phone: {existingPhoneMatch.phone || existingPhoneMatch.whatsapp} · Type: {existingPhoneMatch.type}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      toast.success(`Selected "${existingPhoneMatch.name}"`)
                      onSelect(existingPhoneMatch)
                    }}
                    style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                  >
                    ⚡ Select Existing
                  </button>
                </div>
              )}

              {/* 2. Customer Full Name Second & Type Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    2. Customer Full Name*
                  </label>
                  <input
                    ref={nameInputRef}
                    className="form-input"
                    placeholder="Enter full name..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ fontWeight: 600 }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer Type</label>
                  <select className="form-select" value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="regular">Regular Customer</option>
                    <option value="walkin">Walk-in</option>
                    <option value="online">Online / WhatsApp</option>
                  </select>
                </div>
              </div>

              {/* Quick Recent Customers Strip */}
              {customers.length > 0 && !existingPhoneMatch && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 2 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Or Quick Pick From Registered Customers:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
                    {customers.slice(0, 8).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => onSelect(c)}
                        style={{ fontSize: '0.725rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}
                      >
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Modal Footer — Always Visible! */}
            <div className="modal-footer" style={{
              flexShrink: 0,
              padding: '12px 16px',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSelect({ id: '', name: 'Cash Customer (Walk-in)', type: 'walkin', balance: 0, created_at: '' })}
                style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
              >
                🚶 Walk-in Cash Sale
              </button>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={submitting || !newName.trim()}
                  style={{ fontWeight: 700, minWidth: 150 }}
                >
                  {existingPhoneMatch ? '⚡ Select Existing' : '➕ Add & Assign Customer'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* MODE: SEARCH EXISTING CUSTOMERS */}
        {mode === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  ref={searchInputRef}
                  className="form-input"
                  placeholder="Search customer name, mobile, or WhatsApp..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ paddingLeft: 32 }}
                />
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div
                onClick={() => onSelect({ id: '', name: 'Cash Customer (Walk-in)', type: 'walkin', balance: 0, created_at: '' })}
                style={{
                  padding: '10px 20px', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-surface-2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--color-primary-10)'
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>C</div>
                <div>
                  <div style={{ fontWeight: 600 }}>Cash Customer (Walk-in)</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Default · No account</div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  No customer found matching "{query}".
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-primary btn-xs" onClick={() => { setNewPhone(query); setMode('add') }}>
                      <Plus size={12} /> Add as New Customer
                    </button>
                  </div>
                </div>
              ) : (
                filtered.filter(c => c.id).map(c => (
                  <div
                    key={c.id}
                    onClick={() => onSelect(c)}
                    style={{ padding: '10px 20px', cursor: 'pointer', borderBottom: '1px solid var(--color-surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E2E2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                      {c.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                        {c.phone || c.whatsapp || 'No Phone'} · {c.type}
                      </div>
                    </div>
                    {c.balance !== 0 && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: c.balance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {c.balance > 0 ? 'Owes' : 'Credit'}: Rs.{Math.abs(c.balance).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Search mode footer */}
            <div className="modal-footer" style={{
              flexShrink: 0,
              padding: '10px 16px',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Close <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { setNewPhone(query); setMode('add') }}
              >
                <Plus size={13} /> Add New Customer Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// RECORD STORE EXPENSE MODAL (Petty Cash & Store Outflows)
// ============================================================
// ============================================================
// RECORD STORE EXPENSE MODAL (Petty Cash & Store Outflows)
// ============================================================
function AddExpenseModal({
  currentUserId,
  onClose,
  onSuccess
}: {
  currentUserId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [category, setCategory] = useState('Tea & Refreshments')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank'>('cash')
  const [payee, setPayee] = useState('')
  const [description, setDescription] = useState('Tea & Refreshments')
  const [submitting, setSubmitting] = useState(false)

  const amountInputRef = useRef<HTMLInputElement>(null)
  const payeeInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLInputElement>(null)

  const quickCategories = [
    { key: '1', label: '☕ Tea & Refreshments', val: 'Tea & Refreshments' },
    { key: '2', label: '🥪 Staff Meal / Food', val: 'Staff Meal' },
    { key: '3', label: '🚗 Delivery / Freight', val: 'Delivery & Freight' },
    { key: '4', label: '💡 Utilities / Bills', val: 'Utilities' },
    { key: '5', label: '🧹 Shop Supplies', val: 'Shop Supplies' },
    { key: '6', label: '📦 Packaging & Bags', val: 'Packaging & Bags' },
    { key: '7', label: '🛠️ Repairs & Maint.', val: 'Shop Maintenance' },
    { key: '8', label: '🏢 Shop Rent', val: 'Rent' },
    { key: '9', label: '🏷️ Miscellaneous', val: 'Miscellaneous' }
  ]

  const numAmount = parseFloat(amount) || 0

  // Focus and select amount input on mount
  useEffect(() => {
    setTimeout(() => {
      amountInputRef.current?.focus()
      amountInputRef.current?.select()
    }, 40)
  }, [])

  const handleSelectCategory = (catVal: string) => {
    setCategory(catVal)
    // Pre-populate description if empty or matches previous category
    if (!description.trim() || quickCategories.some(c => c.val === description)) {
      setDescription(catVal)
    }
  }

  const handleRecordExpense = async () => {
    if (submitting) return
    if (numAmount <= 0) {
      toast.error('Please enter a valid expense amount (greater than 0)')
      amountInputRef.current?.focus()
      return
    }
    const finalDesc = description.trim() || category
    if (!finalDesc) {
      toast.error('Please enter a brief description/reason')
      descInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      const res = await window.api.createExpense(currentUserId, {
        category,
        amount: numAmount,
        payment_method: paymentMethod,
        payee: payee.trim() || undefined,
        description: finalDesc
      })

      if (res.success && res.data) {
        toast.success(`Expense ${res.data.expense_number} of Rs. ${numAmount.toLocaleString()} recorded!`, { duration: 3500 })
        onSuccess()
        onClose()
      } else {
        toast.error(res.error || 'Failed to record expense')
      }
    } catch (err) {
      console.error(err)
      toast.error(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleRecordExpense()
  }

  // Global Keyboard Shortcuts for Add Expense Modal
  useEffect(() => {
    const handleModalKey = (e: KeyboardEvent) => {
      // 1. Dismiss and return to cart
      if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'F7') {
        e.preventDefault()
        onClose()
        return
      }

      // 2. Ctrl+Enter: Instant submit from anywhere
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRecordExpense()
        return
      }

      // 3. Alt+1 to Alt+9: Quick category selection
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        if (quickCategories[idx]) {
          handleSelectCategory(quickCategories[idx].val)
          toast(`Category: ${quickCategories[idx].val}`, { icon: '🏷️', duration: 1500 })
        }
        return
      }

      // 4. Alt+C (Cash), Alt+B (Bank), Alt+R (Card)
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setPaymentMethod('cash')
        toast('Paid From: Cash Drawer', { icon: '💵', duration: 1500 })
        return
      }
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setPaymentMethod('bank')
        toast('Paid From: Bank / Mobile', { icon: '📱', duration: 1500 })
        return
      }
      if (e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        setPaymentMethod('card')
        toast('Paid From: Card / Other', { icon: '💳', duration: 1500 })
        return
      }
    }

    window.addEventListener('keydown', handleModalKey)
    return () => window.removeEventListener('keydown', handleModalKey)
  }, [onClose, category, amount, description, paymentMethod, payee, numAmount, submitting])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header" style={{ background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: '#F59E0B22', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Record Store Expense</span>
                <span className="hotkey" style={{ fontSize: '0.6rem' }}>F7</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Deduct from cash drawer & update Day Close · <span className="hotkey" style={{ fontSize: '0.5625rem' }}>Enter</span> to save
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          {/* Quick category chips with Alt+1..9 shortcut numbers */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                1. Expense Category*
              </label>
              <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                Shortcuts: <span className="hotkey">Alt+1</span> to <span className="hotkey">Alt+9</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {quickCategories.map(cat => (
                <button
                  key={cat.val}
                  type="button"
                  onClick={() => handleSelectCategory(cat.val)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.72rem',
                    fontWeight: category === cat.val ? 700 : 500,
                    border: `1.5px solid ${category === cat.val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: category === cat.val ? 'var(--color-primary-10)' : 'var(--color-surface)',
                    color: category === cat.val ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4
                  }}
                  title={`Select ${cat.val} (Alt+${cat.key})`}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
                  <span className="hotkey" style={{
                    fontSize: '0.5625rem',
                    background: category === cat.val ? 'var(--color-primary)' : 'var(--color-surface-2)',
                    color: category === cat.val ? '#fff' : 'var(--color-text-muted)',
                    border: 'none',
                    padding: '1px 4px'
                  }}>
                    {cat.key}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount input with Enter navigation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                2. Amount (Rs.)*
              </label>
              <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                Press <span className="hotkey">Enter</span> to proceed/save
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontSize: '1.25rem'
              }}>
                Rs.
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="any"
                min="1"
                className="form-input form-input-lg"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (description.trim()) {
                      handleRecordExpense()
                    } else {
                      descInputRef.current?.focus()
                    }
                  }
                }}
                style={{ paddingLeft: 52, fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}
                required
              />
            </div>
          </div>

          {/* Payment Method Selector with Alt+C, Alt+B, Alt+R */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700 }}>
                3. Paid From / Method*
              </label>
              <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                <span className="hotkey">Alt+C</span> Cash · <span className="hotkey">Alt+B</span> Bank · <span className="hotkey">Alt+R</span> Card
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { id: 'cash', label: '💵 Cash Drawer', desc: 'Deducts from POS register', hotkey: 'Alt+C' },
                { id: 'bank', label: '📱 Bank / Mobile', desc: 'JazzCash/Bank', hotkey: 'Alt+B' },
                { id: 'card', label: '💳 Card / Other', desc: 'Paid via card', hotkey: 'Alt+R' }
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as 'cash' | 'card' | 'bank')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paymentMethod === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: paymentMethod === m.id ? 'var(--color-primary-10)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color: paymentMethod === m.id ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paid To & Description */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Paid To (Optional)</label>
              <input
                ref={payeeInputRef}
                className="form-input"
                placeholder="Tea boy, Rider, Vendor..."
                value={payee}
                onChange={e => setPayee(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    descInputRef.current?.focus()
                  }
                }}
                style={{ fontSize: '0.8125rem' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Description / Reason*</label>
              <input
                ref={descInputRef}
                className="form-input"
                placeholder="Reason for expense..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRecordExpense()
                  }
                }}
                style={{ fontSize: '0.8125rem' }}
                required
              />
            </div>
          </div>

          {/* Impact Banner */}
          <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: paymentMethod === 'cash' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface-2)',
            border: `1px solid ${paymentMethod === 'cash' ? 'rgba(245, 158, 11, 0.3)' : 'var(--color-border)'}`,
            fontSize: '0.6875rem',
            color: 'var(--color-text-secondary)'
          }}>
            {paymentMethod === 'cash' ? (
              <span>
                ⚠️ <strong>Cash Drawer Impact:</strong> Rs. {numAmount.toLocaleString()} will be deducted from today's expected physical cash and reflected in Day Close.
              </span>
            ) : (
              <span>
                ℹ️ <strong>Accounting Impact:</strong> This expense will be posted to the double-entry general ledger and reflected in Profit & Loss.
              </span>
            )}
          </div>

          {/* Actions with full shortcuts */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
              Press <span className="hotkey">Enter</span> or <span className="hotkey">Ctrl+Enter</span> to save
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Tab / Esc</span>
              </button>
              <button type="submit" className="btn btn-warning" disabled={submitting || numAmount <= 0} style={{ minWidth: 160, fontWeight: 700 }}>
                {submitting ? 'Recording...' : `Record Expense — Rs. ${numAmount.toLocaleString()}`}
                <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(0,0,0,0.15)', color: 'inherit', border: 'none', marginLeft: 4 }}>
                  Enter
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// PREVIOUS POS SALES & TRANSACTIONS MODAL
// ============================================================
function PreviousSalesModal({
  currentUserId,
  canVoid,
  onClose,
  onLoadInvoiceToCart,
  onPrintReceipt,
  onOpenAddExpense
}: {
  currentUserId: string
  canVoid: boolean
  onClose: () => void
  onLoadInvoiceToCart: (items: InvoiceItem[], invoiceNumber: string) => void
  onPrintReceipt: (invoice: Invoice) => void
  onOpenAddExpense?: () => void
}) {
  const [viewTab, setViewTab] = useState<'sales' | 'expenses'>('sales')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showVoidPrompt, setShowVoidPrompt] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  // Tab, Escape, or F4 immediately closes previous sales modal and returns to POS cart
  useEffect(() => {
    const handleModalKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'F4') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleModalKey)
    return () => window.removeEventListener('keydown', handleModalKey)
  }, [onClose])

  const computeDateRange = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (preset === 'today') {
      return { from: todayStr, to: todayStr }
    } else if (preset === 'yesterday') {
      const y = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10)
      return { from: y, to: y }
    } else if (preset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return { from: d.toISOString().slice(0, 10), to: todayStr }
    } else if (preset === 'month') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return { from: d.toISOString().slice(0, 10), to: todayStr }
    } else {
      return { from: '2020-01-01', to: todayStr }
    }
  }

  const loadData = async () => {
    setLoading(true)
    const { from, to } = computeDateRange(datePreset)

    // 1. Invoices Fetch
    try {
      const invData = await window.api.getInvoicesByRange(
        from,
        to,
        undefined,
        sourceFilter !== 'all' ? sourceFilter : undefined,
        paymentFilter !== 'all' ? paymentFilter : undefined,
        searchQuery.trim() || undefined
      )
      const list = invData || []
      setInvoices(list)
      if (list.length > 0) {
        if (!selectedInvoice || !list.some(i => i.id === selectedInvoice.id)) {
          fetchInvoiceDetails(list[0].id)
        }
      } else {
        setSelectedInvoice(null)
      }
    } catch (invErr) {
      console.error('[POS History] Failed to load invoices:', invErr)
      setInvoices([])
    }

    // 2. Expenses Fetch
    try {
      if (currentUserId) {
        const expRes = await window.api.getExpenses(currentUserId, from, to)
        if (expRes && expRes.success && expRes.data) {
          setExpenses(expRes.data)
          if (expRes.data.length > 0) {
            if (!selectedExpense || !expRes.data.some(e => e.id === selectedExpense.id)) {
              setSelectedExpense(expRes.data[0])
            }
          } else {
            setSelectedExpense(null)
          }
        } else {
          setExpenses([])
        }
      }
    } catch (expErr) {
      console.warn('[POS History] Failed to load expenses:', expErr)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [datePreset, paymentFilter, sourceFilter])

  const fetchInvoiceDetails = async (invoiceId: string) => {
    setLoadingDetails(true)
    try {
      const full = await window.api.getInvoiceById(invoiceId)
      if (full) {
        setSelectedInvoice(full)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadData()
  }

  const handleVoidInvoice = async () => {
    if (!selectedInvoice) return
    if (!voidReason.trim()) {
      toast.error('Please enter a void reason')
      return
    }

    try {
      const res = await window.api.voidInvoice(currentUserId, selectedInvoice.id, voidReason.trim())
      if (res && (res as { success?: boolean }).success === false) {
        toast.error((res as { error?: string }).error || 'Failed to void invoice')
      } else {
        toast.success(`Invoice ${selectedInvoice.invoice_number} has been voided`)
        setShowVoidPrompt(false)
        setVoidReason('')
        loadData()
      }
    } catch (err) {
      console.error(err)
      toast.error(String(err))
    }
  }

  const handleDeleteExpense = async (expId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return
    try {
      const res = await window.api.deleteExpense(currentUserId, expId)
      if (res.success) {
        toast.success('Expense deleted')
        loadData()
      } else {
        toast.error(res.error || 'Failed to delete expense')
      }
    } catch (err) {
      toast.error(String(err))
    }
  }

  // Summary statistics
  const totalSalesAmount = invoices.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalSalesCount = invoices.length

  const totalExpenseAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const cashExpenseAmount = expenses.filter(e => (e.payment_method || '').toLowerCase() === 'cash').reduce((s, e) => s + (e.amount || 0), 0)

  // Filtered expenses based on search query
  const filteredExpenses = expenses.filter(e => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      e.expense_number.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.payee && e.payee.toLowerCase().includes(q)) ||
      e.description.toLowerCase().includes(q) ||
      (e.staff_name && e.staff_name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-xl"
        onClick={e => e.stopPropagation()}
        style={{ height: '88vh', maxWidth: 1250, display: 'flex', flexDirection: 'column' }}
      >
        {/* HEADER */}
        <div className="modal-header" style={{ padding: '12px 20px', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-10)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <History size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="modal-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>POS Transactions & History</span>
                <span className="hotkey" style={{ fontSize: '0.625rem' }}>F4</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                View sales receipts, track petty cash expenses, and inspect drawer reconciliation
              </div>
            </div>

            {/* Sub-Tab Navigation Toggle */}
            <div style={{
              display: 'inline-flex',
              background: 'var(--color-surface-2)',
              padding: 3,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              marginLeft: 16,
              gap: 3
            }}>
              <button
                type="button"
                onClick={() => setViewTab('sales')}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: viewTab === 'sales' ? 700 : 500,
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  background: viewTab === 'sales' ? 'var(--color-primary)' : 'transparent',
                  color: viewTab === 'sales' ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FileText size={13} />
                <span>Sales & Invoices ({totalSalesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewTab('expenses')}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: viewTab === 'expenses' ? 700 : 500,
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  background: viewTab === 'expenses' ? '#D97706' : 'transparent',
                  color: viewTab === 'expenses' ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <DollarSign size={13} />
                <span>Expenses & Cash Out ({expenses.length})</span>
              </button>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {viewTab === 'sales' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--color-surface-2)', padding: '5px 12px',
                borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                fontSize: '0.8125rem'
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Sales: <strong>{totalSalesCount}</strong></span>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  Rs. {totalSalesAmount.toLocaleString()}
                </span>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--color-surface-2)', padding: '5px 12px',
                borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                fontSize: '0.8125rem'
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Total Expenses:</span>
                <span style={{ color: '#D97706', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  Rs. {totalExpenseAmount.toLocaleString()}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  (Cash Out: Rs. {cashExpenseAmount.toLocaleString()})
                </span>
              </div>
            )}

            {onOpenAddExpense && (
              <button
                className="btn btn-warning btn-sm"
                onClick={() => {
                  onClose()
                  onOpenAddExpense()
                }}
                style={{ height: 32, gap: 5 }}
              >
                <Plus size={14} /> Add Expense
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh data"
              style={{ height: 32 }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>

            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* FILTERS TOOLBAR */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 240 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="form-input form-input-sm"
                placeholder={viewTab === 'sales' ? "Search Invoice #, customer name, contact..." : "Search Expense #, category, payee, description..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, width: '100%', height: 32 }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ height: 32, padding: '0 12px' }}>
              Search
            </button>
          </form>

          {/* Date Presets */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            {(['today', 'yesterday', 'week', 'month', 'all'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setDatePreset(p)}
                className="btn btn-sm"
                style={{
                  height: 26, fontSize: '0.6875rem', padding: '0 8px',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  background: datePreset === p ? 'var(--color-primary)' : 'transparent',
                  color: datePreset === p ? '#fff' : 'var(--color-text-secondary)',
                  border: 'none', fontWeight: datePreset === p ? 700 : 500
                }}
              >
                {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : 'All'}
              </button>
            ))}
          </div>

          {viewTab === 'sales' && (
            <>
              {/* Payment Filter */}
              <select
                className="form-select form-select-sm"
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                style={{ height: 32, fontSize: '0.75rem', width: 110 }}
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank / Mobile</option>
                <option value="credit">Credit / Khata</option>
              </select>

              {/* Channel Filter */}
              <select
                className="form-select form-select-sm"
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                style={{ height: 32, fontSize: '0.75rem', width: 110 }}
              >
                <option value="all">All Channels</option>
                <option value="instore">In-Store</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="socialmedia">Social Media</option>
              </select>
            </>
          )}
        </div>

        {/* BODY (SPLIT VIEW) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ================= VIEW 1: SALES & INVOICES ================= */}
          {viewTab === 'sales' && (
            <>
              {/* LEFT: Invoices List */}
              <div style={{
                width: '42%',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-surface)',
                overflowY: 'auto'
              }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading past invoices...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <FileText size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontWeight: 600 }}>No invoices found</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Try selecting a different date range or clearing your search filters
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {invoices.map(inv => {
                      const isSelected = selectedInvoice?.id === inv.id
                      const isVoided = inv.status === 'voided'
                      const isRefunded = inv.status === 'refunded'
                      const isPending = inv.status === 'pending'
                      const itemsCount = inv.items?.length || 0

                      return (
                        <div
                          key={inv.id}
                          onClick={() => fetchInvoiceDetails(inv.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border)',
                            background: isSelected ? 'var(--color-primary-10)' : 'transparent',
                            borderLeft: isSelected ? '4px solid var(--color-primary)' : '4px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.875rem',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)'
                            }}>
                              {inv.invoice_number}
                            </span>
                            <span style={{
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.9375rem',
                              color: isVoided || isRefunded ? 'var(--color-text-muted)' : 'var(--color-success)',
                              textDecoration: isVoided || isRefunded ? 'line-through' : 'none'
                            }}>
                              Rs. {inv.grand_total.toLocaleString()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                            <span style={{ fontWeight: 500 }}>{inv.customer_name || 'Walk-in Customer'}</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                              {inv.datetime_created ? inv.datetime_created.slice(11, 16) : ''} · {inv.date}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`badge ${
                              inv.payment_method === 'cash' ? 'badge-success' :
                              inv.payment_method === 'card' ? 'badge-primary' :
                              inv.payment_method === 'bank' ? 'badge-info' : 'badge-warning'
                            }`} style={{ fontSize: '0.625rem', textTransform: 'capitalize' }}>
                              {inv.payment_method}
                            </span>

                            <span className="badge badge-secondary" style={{ fontSize: '0.625rem', textTransform: 'capitalize' }}>
                              {inv.source === 'whatsapp' ? '💬 WhatsApp' : inv.source === 'socialmedia' ? '📱 Social' : '🏬 In-Store'}
                            </span>

                            {isVoided && (
                              <span className="badge badge-danger" style={{ fontSize: '0.625rem' }}>VOIDED</span>
                            )}
                            {isRefunded && (
                              <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '0.625rem', fontWeight: 700 }}>REFUNDED</span>
                            )}
                            {isPending && (
                              <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>PENDING</span>
                            )}

                            {itemsCount > 0 && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                                {itemsCount} item{itemsCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: Invoice Details & Actions */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg)',
                overflowY: 'auto'
              }}>
                {loadingDetails ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading invoice details...
                  </div>
                ) : !selectedInvoice ? (
                  <div className="empty-state" style={{ padding: 60 }}>
                    <Eye size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <h4>Select an invoice to inspect</h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      Click on any invoice in the left column to view its items, payment summary, and actions.
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Invoice Header Card */}
                    <div style={{
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 20px',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 16
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '1.25rem' }}>
                            {selectedInvoice.invoice_number}
                          </h3>
                          {selectedInvoice.status === 'voided' ? (
                            <span className="badge badge-danger">VOIDED</span>
                          ) : selectedInvoice.status === 'refunded' ? (
                            <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626', fontWeight: 700 }}>REFUNDED</span>
                          ) : (
                            <span className="badge badge-success">COMPLETED</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Date: <strong>{selectedInvoice.date}</strong> at <strong>{selectedInvoice.datetime_created?.slice(11, 16) || ''}</strong>
                          {selectedInvoice.staff_name && ` · Staff: ${selectedInvoice.staff_name}`}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          className={`btn ${selectedInvoice.status === 'refunded' ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => onPrintReceipt(selectedInvoice)}
                          style={{ gap: 6 }}
                        >
                          <Printer size={15} />
                          {selectedInvoice.status === 'refunded' ? 'Re-Print (Refunded Copy)' : 'Re-Print Receipt'}
                        </button>

                        <button
                          className="btn btn-secondary"
                          onClick={() => onLoadInvoiceToCart(selectedInvoice.items || [], selectedInvoice.invoice_number)}
                          style={{ gap: 6 }}
                          title="Copy items from this invoice into the active POS cart"
                        >
                          <Copy size={15} />
                          Load to Cart
                        </button>

                        {canVoid && selectedInvoice.status !== 'voided' && selectedInvoice.status !== 'refunded' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setShowVoidPrompt(!showVoidPrompt)}
                            style={{ height: 36 }}
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Refunded Banner in Previous Sales */}
                    {selectedInvoice.status === 'refunded' && (
                      <div style={{
                        background: '#FEE2E2',
                        border: '1.5px solid #DC2626',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}>
                        <RotateCcw size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.875rem' }}>
                            This Invoice Has Been Refunded & Returned
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: 2 }}>
                            A refund has already been recorded for this transaction. It is permanently locked from voiding or duplicate refunding.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Void reason prompt box */}
                    {showVoidPrompt && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid var(--color-danger)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6, fontSize: '0.875rem' }}>
                          ⚠️ Void Invoice {selectedInvoice.invoice_number}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                          Voiding this invoice will restore inventory quantities and log an audit trail event.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="form-input form-input-sm"
                            placeholder="Reason for voiding (required)..."
                            value={voidReason}
                            onChange={e => setVoidReason(e.target.value)}
                            style={{ flex: 1 }}
                            autoFocus
                          />
                          <button className="btn btn-danger btn-sm" onClick={handleVoidInvoice}>
                            Confirm Void
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowVoidPrompt(false)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Invoice Customer & Financials Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Customer Details
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                          {selectedInvoice.customer_name || 'Walk-in Customer'}
                        </div>
                        {selectedInvoice.online_customer_contact && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            Contact: {selectedInvoice.online_customer_contact}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Channel: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedInvoice.source}</span>
                        </div>
                      </div>

                      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Payment Summary
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Method:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {selectedInvoice.payment_method}
                            {selectedInvoice.notes && ` (${selectedInvoice.notes})`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Discount:</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                            - Rs. {selectedInvoice.discount_amount.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 4, marginTop: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Grand Total:</span>
                          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                            Rs. {selectedInvoice.grand_total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Items Table */}
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 16px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.8125rem' }}>
                        Line Items ({selectedInvoice.items?.length || 0})
                      </div>

                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: 36, textAlign: 'center' }}>#</th>
                            <th style={{ width: 120 }}>SKU</th>
                            <th>Item Description</th>
                            <th style={{ width: 100, textAlign: 'right' }}>Unit Price</th>
                            <th style={{ width: 60, textAlign: 'center' }}>Qty</th>
                            <th style={{ width: 70, textAlign: 'center' }}>Disc%</th>
                            <th style={{ width: 110, textAlign: 'right' }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                            selectedInvoice.items.map((item, idx) => (
                              <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                                <td>
                                  <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'var(--color-surface-2)',
                                    border: '1px solid var(--color-border)',
                                    padding: '2px 6px',
                                    borderRadius: 'var(--radius-sm)'
                                  }}>
                                    {item.part_number || '-'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{item.item_name || 'Item'}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>Rs. {item.unit_price.toLocaleString()}</td>
                                <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.qty}</td>
                                <td style={{ textAlign: 'center', color: item.discount_pct > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                  {item.discount_pct > 0 ? `${item.discount_pct}%` : '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                                  Rs. {item.line_total.toLocaleString()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>
                                No line item details found for this invoice.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================= VIEW 2: EXPENSES & CASH OUT ================= */}
          {viewTab === 'expenses' && (
            <>
              {/* LEFT: Expenses List */}
              <div style={{
                width: '45%',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-surface)',
                overflowY: 'auto'
              }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading expenses...
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <DollarSign size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontWeight: 600 }}>No expense records found</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      No expenses were recorded for the selected date range.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredExpenses.map(exp => {
                      const isSelected = selectedExpense?.id === exp.id
                      const isCash = (exp.payment_method || '').toLowerCase() === 'cash'

                      return (
                        <div
                          key={exp.id}
                          onClick={() => setSelectedExpense(exp)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border)',
                            background: isSelected ? 'var(--color-primary-10)' : 'transparent',
                            borderLeft: isSelected ? '4px solid #D97706' : '4px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.8125rem',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)'
                            }}>
                              {exp.expense_number}
                            </span>
                            <span style={{
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.9375rem',
                              color: '#D97706'
                            }}>
                              - Rs. {exp.amount.toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
                            {exp.description}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>
                                {exp.category}
                              </span>
                              <span className={`badge ${isCash ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.625rem', textTransform: 'capitalize' }}>
                                {isCash ? '💵 Cash Drawer' : `📱 ${exp.payment_method}`}
                              </span>
                            </div>
                            <span>{exp.datetime_created ? exp.datetime_created.slice(11, 16) : ''} · {exp.date}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: Expense Details */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg)',
                overflowY: 'auto'
              }}>
                {!selectedExpense ? (
                  <div className="empty-state" style={{ padding: 60 }}>
                    <DollarSign size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <h4>Select an expense to view voucher</h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      Click any expense voucher in the left column to view accounting breakdown.
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Expense Voucher Header */}
                    <div style={{
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '18px 20px',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 16
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '1.25rem' }}>
                            {selectedExpense.expense_number}
                          </h3>
                          <span className="badge badge-warning">{selectedExpense.category}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Recorded on <strong>{selectedExpense.date}</strong> at <strong>{selectedExpense.datetime_created?.slice(11, 16) || ''}</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Expense Amount</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', fontFamily: 'var(--font-mono)' }}>
                          Rs. {selectedExpense.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Expense Detail Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Payee & Reason
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                          {selectedExpense.description}
                        </div>
                        {selectedExpense.payee && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                            Paid to: <strong>{selectedExpense.payee}</strong>
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Authorized by: <strong>{selectedExpense.staff_name || 'Staff'}</strong>
                        </div>
                      </div>

                      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Payment & Accounting Info
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Payment Source:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {selectedExpense.payment_method === 'cash' ? '💵 Cash Register Drawer' : `📱 ${selectedExpense.payment_method}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Ledger Account:</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {selectedExpense.account_name || selectedExpense.category}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 4, marginTop: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Day Close Impact:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: selectedExpense.payment_method === 'cash' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                            {selectedExpense.payment_method === 'cash' ? '- Deducted from Cash Drawer' : 'Non-cash outlay'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteExpense(selectedExpense.id)}
                        style={{ gap: 6 }}
                      >
                        <Trash2 size={14} /> Delete Expense Record
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
