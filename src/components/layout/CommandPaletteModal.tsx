import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ShoppingCart, LayoutDashboard, Package, FileText,
  Users, BarChart3, Store, Lock, Wrench, MessageSquare,
  Clock, ArrowRight, Tag, Phone
} from 'lucide-react'
import type { Item, Customer } from '../../types'

interface NavOption {
  type: 'nav'
  id: string
  label: string
  path: string
  icon: React.ElementType
  hotkey?: string
  section: string
}

const NAV_COMMANDS: NavOption[] = [
  { type: 'nav', id: 'nav-pos', label: 'POS Terminal', path: '/pos', icon: ShoppingCart, hotkey: 'F1', section: 'Navigation' },
  { type: 'nav', id: 'nav-dash', label: 'Dashboard Overview', path: '/dashboard', icon: LayoutDashboard, section: 'Navigation' },
  { type: 'nav', id: 'nav-stock', label: 'Stock & Inventory Catalog', path: '/stock', icon: Package, section: 'Navigation' },
  { type: 'nav', id: 'nav-sales', label: 'Sales History & Records', path: '/sales', icon: FileText, hotkey: 'F4', section: 'Navigation' },
  { type: 'nav', id: 'nav-cust', label: 'Customer Accounts & Directory', path: '/customers', icon: Users, section: 'Navigation' },
  { type: 'nav', id: 'nav-pend', label: 'Pending Invoices', path: '/pending-invoices', icon: Clock, section: 'Navigation' },
  { type: 'nav', id: 'nav-ord', label: 'Online & WhatsApp Orders', path: '/orders', icon: MessageSquare, section: 'Navigation' },
  { type: 'nav', id: 'nav-rep', label: 'Financial Reports & Analytics', path: '/reports', icon: BarChart3, section: 'Navigation' },
  { type: 'nav', id: 'nav-acc', label: 'Accounts & Expense Ledger', path: '/accounts', icon: Store, section: 'Navigation' },
  { type: 'nav', id: 'nav-close', label: 'Day Closing Reconciliation', path: '/day-close', icon: Lock, section: 'Navigation' },
  { type: 'nav', id: 'nav-maint', label: 'System Administration & Setup', path: '/maintenance', icon: Wrench, section: 'Navigation' },
]

export function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search items and customers dynamically when user types
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setItems([])
      setCustomers([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (window.api?.searchItems) {
          const res = await window.api.searchItems(q)
          if (Array.isArray(res)) setItems(res.slice(0, 5))
        }
      } catch {}

      try {
        if (window.api?.searchCustomers) {
          const res = await window.api.searchCustomers(q)
          if (Array.isArray(res)) setCustomers(res.slice(0, 4))
        }
      } catch {}
    }, 150)

    return () => clearTimeout(timer)
  }, [query])

  // Filter navigation links
  const filteredNav = NAV_COMMANDS.filter(c =>
    !query.trim() || c.label.toLowerCase().includes(query.toLowerCase())
  )

  // Unified list of active results
  type ResultItem =
    | { kind: 'nav'; data: NavOption }
    | { kind: 'item'; data: Item }
    | { kind: 'customer'; data: Customer }

  const results: ResultItem[] = [
    ...filteredNav.map(n => ({ kind: 'nav' as const, data: n })),
    ...items.map(i => ({ kind: 'item' as const, data: i })),
    ...customers.map(c => ({ kind: 'customer' as const, data: c })),
  ]

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results.length])

  // Handle selection
  const handleSelect = (res: ResultItem) => {
    onClose()
    if (res.kind === 'nav') {
      navigate(res.data.path)
    } else if (res.kind === 'item') {
      navigate('/stock')
    } else if (res.kind === 'customer') {
      navigate('/customers')
    }
  }

  // Keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    }
  }

  return (
    <div className="cmd-palette-backdrop" onClick={onClose}>
      <div className="cmd-palette-window" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="cmd-palette-input-box">
          <Search size={18} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmd-palette-input"
            placeholder="Type a command, page, product, or customer..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="cmd-palette-item-kbd">ESC to exit</kbd>
        </div>

        {/* Results List */}
        <div className="cmd-palette-results">
          {results.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem' }}>
              No matches found for "{query}"
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex

              if (res.kind === 'nav') {
                const Icon = res.data.icon
                return (
                  <div
                    key={res.data.id}
                    className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Icon size={16} style={{ color: isSelected ? '#FF6B81' : 'rgba(255,255,255,0.5)' }} />
                    <span style={{ fontWeight: 600 }}>{res.data.label}</span>
                    {res.data.hotkey && (
                      <kbd className="cmd-palette-item-kbd">{res.data.hotkey}</kbd>
                    )}
                    <ArrowRight size={13} style={{ marginLeft: res.data.hotkey ? 6 : 'auto', opacity: 0.35 }} />
                  </div>
                )
              }

              if (res.kind === 'item') {
                return (
                  <div
                    key={`item-${res.data.id}`}
                    className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Tag size={15} style={{ color: '#10B981' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{res.data.name}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)' }}>
                        Barcode: {res.data.barcode || 'N/A'} • Stock: {res.data.quantity_on_hand ?? 0}
                      </span>
                    </div>
                    <span style={{ marginLeft: 'auto', color: '#34D399', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      Rs. {Number(res.data.retail_price || 0).toLocaleString()}
                    </span>
                  </div>
                )
              }

              if (res.kind === 'customer') {
                return (
                  <div
                    key={`cust-${res.data.id}`}
                    className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Phone size={15} style={{ color: '#38BDF8' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{res.data.name}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)' }}>
                        {res.data.phone || 'No phone'} • Balance: Rs. {Number(res.data.balance || 0).toLocaleString()}
                      </span>
                    </div>
                    <span className="cmd-palette-item-kbd" style={{ marginLeft: 'auto' }}>Customer</span>
                  </div>
                )
              }

              return null
            })
          )}
        </div>

        {/* Footer info */}
        <div className="cmd-palette-footer">
          <span>Use <kbd className="cmd-palette-item-kbd">↑</kbd> <kbd className="cmd-palette-item-kbd">↓</kbd> to navigate</span>
          <span>Press <kbd className="cmd-palette-item-kbd">↵ Enter</kbd> to select</span>
        </div>
      </div>
    </div>
  )
}
