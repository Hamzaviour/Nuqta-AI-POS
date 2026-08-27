import React, { useEffect, useState, useMemo } from 'react'
import {
  Users, MessageSquare, Search, Plus, Edit2, Trash2,
  CheckCircle, RefreshCw, Send, Phone, UserCheck,
  Filter, Download, Copy, ExternalLink, Sparkles, MessageCircle, X
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Customer } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// Built-in Pakistani WhatsApp Campaign Templates
const CAMPAIGN_TEMPLATES = [
  {
    id: 'eid',
    title: '🌙 Eid Mubarak & Festive Greetings',
    badge: 'Festive',
    text: `🌙 *Assalam-o-Alaikum {customer_name}!*

*Al-Deewan Brand* wishes you and your family a blessed and joyous *Eid Mubarak*! ✨

May this festive occasion bring peace, prosperity, and happiness to your home. We look forward to serving you with our finest festive clothing collections.

📍 *Al-Deewan Brand* — Lahore, Pakistan
📞 Contact / WhatsApp: {whatsapp_hotline}`
  },
  {
    id: 'sale',
    title: '🔥 Mega Clearance & Seasonal Sale (Up to 50% Off)',
    badge: 'Promotion',
    text: `🔥 *MEGA SALE ALERT — AL-DEEWAN BRAND!* 🔥

Dear *{customer_name}*,

Enjoy up to *50% OFF* on our premium wholesale & retail clothing collection! 🛍️
Exclusive discounts on unstitched, ready-to-wear, and festive wear.

⚡ *Limited Time Offer!* Visit our outlet or place your order directly on WhatsApp before stock runs out!

📍 *Al-Deewan Brand* — Lahore
📞 WhatsApp: {whatsapp_hotline}`
  },
  {
    id: 'new_arrival',
    title: '✨ New Arrivals & Summer/Winter Fresh Collection',
    badge: 'New Stock',
    text: `✨ *FRESH ARRIVALS AT AL-DEEWAN BRAND!* ✨

Assalam-o-Alaikum *{customer_name}*,

Our brand new designer clothing collection has just arrived!
👗 Premium Quality Fabrics
🎨 Trendy Cuts & Elegant Embroidery
💰 Best Wholesale & Retail Rates in Town

Visit us today or reply to this message to see the complete digital catalog!

📍 *Al-Deewan Brand* — Lahore
📞 WhatsApp: {whatsapp_hotline}`
  },
  {
    id: 'vip',
    title: '🎁 Exclusive VIP Customer Special Discount',
    badge: 'Loyalty',
    text: `⭐ *Exclusive VIP Treat for {customer_name}!* ⭐

As one of our most valued customers at *Al-Deewan Brand*, we are giving you an exclusive *Extra 10% Discount* on your next purchase!

Show this message at the checkout counter or send us your order on WhatsApp.

📍 *Al-Deewan Brand*
📞 WhatsApp: {whatsapp_hotline}`
  },
  {
    id: 'balance',
    title: '💳 Friendly Balance & Payment Reminder',
    badge: 'Accounts',
    text: `Dear *{customer_name}*,

Assalam-o-Alaikum. This is a gentle reminder from *Al-Deewan Brand* regarding your outstanding account balance of *Rs. {balance}*.

Kindly arrange the payment at your earliest convenience. If you have already cleared this, please share the transaction receipt with us.

Thank you for your valued partnership!

📍 *Al-Deewan Brand Accounts*
📞 WhatsApp: {whatsapp_hotline}`
  },
  {
    id: 'custom',
    title: '✍️ Custom Message / Free Text',
    badge: 'Custom',
    text: `Assalam-o-Alaikum *{customer_name}*,

We have an exciting update for you from *Al-Deewan Brand*!

Feel free to visit our store or contact us on WhatsApp for any inquiries.

📍 *Al-Deewan Brand*
📞 WhatsApp: {whatsapp_hotline}`
  }
]

export default function CustomersPage() {
  const { currentUser, can } = useAuth()
  const [activeTab, setActiveTab] = useState<'directory' | 'broadcast'>('directory')

  // Customers data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [storeSettings, setStoreSettings] = useState<Record<string, string>>({})

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [directMsgCustomer, setDirectMsgCustomer] = useState<Customer | null>(null)
  const [directMsgText, setDirectMsgText] = useState('')

  // WhatsApp Broadcast state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('eid')
  const [customMessage, setCustomMessage] = useState<string>(CAMPAIGN_TEMPLATES[0].text)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set())
  const [sentCustomerIds, setSentCustomerIds] = useState<Set<string>>(new Set())

  const loadData = async () => {
    setLoading(true)
    const [custs, settings] = await Promise.all([
      window.api.getAllCustomers(),
      window.api.getAllSettings()
    ])
    setCustomers(custs || [])
    setStoreSettings(settings as unknown as Record<string, string> || {})
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Initialize all customers as selected for broadcast
  useEffect(() => {
    if (customers.length > 0 && selectedCustomerIds.size === 0) {
      const valid = customers.filter(c => c.id && (c.phone || c.whatsapp)).map(c => c.id)
      setSelectedCustomerIds(new Set(valid))
    }
  }, [customers])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery) ||
        (c.whatsapp || '').includes(searchQuery) ||
        (c.address || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === 'all' || c.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [customers, searchQuery, typeFilter])

  // KPI Calculations
  const totalCustomers = customers.length
  const totalReceivables = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0)
  const whatsappCount = customers.filter(c => !!(c.phone || c.whatsapp)).length
  const regularCount = customers.filter(c => c.type === 'regular').length

  // WhatsApp Message Generator Helper
  const generateMessageForCustomer = (template: string, customer: Customer) => {
    const storeName = storeSettings['company_name'] || 'Al-Deewan Brand'
    const hotline = storeSettings['whatsapp_number'] || storeSettings['company_phone'] || '+92 300 1234567'

    return template
      .replace(/{customer_name}/g, customer.name || 'Valued Customer')
      .replace(/{store_name}/g, storeName)
      .replace(/{phone}/g, customer.phone || '')
      .replace(/{balance}/g, customer.balance ? customer.balance.toLocaleString() : '0')
      .replace(/{whatsapp_hotline}/g, hotline)
  }

  // Handle WhatsApp single click send
  const sendWhatsAppToCustomer = (customer: Customer, text?: string) => {
    const rawPhone = customer.whatsapp || customer.phone || ''
    const cleanPhone = rawPhone.replace(/[\s\-\(\)\.]/g, '').replace(/^0/, '92').replace(/^\+/, '')

    if (!cleanPhone || cleanPhone.length < 9) {
      toast.error(`Invalid phone number for ${customer.name}`)
      return
    }

    const messageToSend = text || generateMessageForCustomer(customMessage, customer)
    const encoded = encodeURIComponent(messageToSend)
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`
    window.open(url, '_blank')

    setSentCustomerIds(prev => new Set([...prev, customer.id]))
    toast.success(`Opening WhatsApp for ${customer.name}...`)
  }

  // Select / Deselect template
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId)
    const found = CAMPAIGN_TEMPLATES.find(t => t.id === tmplId)
    if (found) {
      setCustomMessage(found.text)
    }
  }

  // Toggle customer in broadcast
  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all / Deselect all
  const selectAllEligible = () => {
    const all = customers.filter(c => c.id && (c.phone || c.whatsapp)).map(c => c.id)
    setSelectedCustomerIds(new Set(all))
  }

  const deselectAll = () => {
    setSelectedCustomerIds(new Set())
  }

  // Export CSV
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      toast.error('No customer data to export')
      return
    }
    const headers = ['Name', 'Phone', 'WhatsApp', 'Type', 'Address', 'Balance (PKR)', 'Notes', 'Created At']
    const rows = filteredCustomers.map(c => [
      `"${c.name}"`,
      `"${c.phone || ''}"`,
      `"${c.whatsapp || ''}"`,
      `"${c.type}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.balance || 0,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${c.created_at}"`
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aldeewan-customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Customer CSV exported successfully!')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <Users size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Customers & WhatsApp Marketing</h3>
          <div className="page-header-subtitle">CRM Directory, customer ledgers & 1-click WhatsApp broadcast campaigns</div>
        </div>

        {/* Tab Switcher */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('directory')}
          >
            <Users size={14} /> Customer Directory ({customers.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'broadcast' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => setActiveTab('broadcast')}
          >
            <MessageSquare size={14} /> WhatsApp Campaigns ({whatsappCount})
          </button>
        </div>
      </div>

      {/* KPI Summary Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '12px 24px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        <div style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>{totalCustomers}</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL RECEIVABLES / BALANCE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(totalReceivables)}</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>WHATSAPP NUMBERS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>{whatsappCount}</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>REGULAR CLIENTS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-info)' }}>{regularCount}</div>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeTab === 'directory' ? (
          /* ============================================================ */
          /* TAB 1: CUSTOMER CRM DIRECTORY */
          /* ============================================================ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ flex: 1, minWidth: 260 }}>
                <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
                <input
                  className="form-input"
                  placeholder="Search by customer name, phone number, address..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
                <select
                  className="form-select"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{ width: 140 }}
                >
                  <option value="all">All Types</option>
                  <option value="regular">Regular</option>
                  <option value="walkin">Walk-in</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                <Download size={14} /> Export CSV
              </button>

              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> Add Customer
              </button>
            </div>

            {/* Customers Table */}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone / WhatsApp</th>
                    <th>Type</th>
                    <th>City / Address</th>
                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                    <th>Date Added</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                        Loading customer records...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                        <Users size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                        No customer records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const hasPhone = !!(c.phone || c.whatsapp)
                      return (
                        <tr key={c.id || c.name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: c.balance > 0 ? 'var(--color-danger-bg)' : 'var(--color-primary-10)',
                                color: c.balance > 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0
                              }}>
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                {c.notes && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{c.notes}</div>}
                              </div>
                            </div>
                          </td>

                          <td>
                            {hasPhone ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                  {c.phone || c.whatsapp}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => sendWhatsAppToCustomer(c)}
                                  className="btn btn-ghost btn-sm btn-icon"
                                  title="Send WhatsApp Message"
                                  style={{ color: '#25D366' }}
                                >
                                  <MessageCircle size={15} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>

                          <td>
                            <span className={`badge ${
                              c.type === 'regular' ? 'badge-info' :
                              c.type === 'online' ? 'badge-primary' : 'badge-secondary'
                            }`}>
                              {c.type.toUpperCase()}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '0.75rem', color: c.address ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                              {c.address || '—'}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right', fontWeight: 700, color: c.balance > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                            {fmt(c.balance || 0)}
                          </td>

                          <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {c.created_at ? c.created_at.slice(0, 10) : '—'}
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              {hasPhone && (
                                <button
                                  className="btn btn-ghost btn-sm btn-icon"
                                  title="Compose WhatsApp Message"
                                  onClick={() => {
                                    setDirectMsgCustomer(c)
                                    setDirectMsgText(generateMessageForCustomer(customMessage, c))
                                  }}
                                  style={{ color: '#25D366' }}
                                >
                                  <MessageSquare size={14} />
                                </button>
                              )}
                              <button
                                className="btn btn-ghost btn-sm btn-icon"
                                title="Edit Customer"
                                onClick={() => setEditingCustomer(c)}
                              >
                                <Edit2 size={14} />
                              </button>
                              {c.id && (
                                <button
                                  className="btn btn-ghost btn-sm btn-icon text-danger"
                                  title="Delete Customer"
                                  onClick={async () => {
                                    if (window.confirm(`Delete customer "${c.name}"?`)) {
                                      const res = await window.api.deleteCustomer(currentUser!.id, c.id)
                                      if (res.success) {
                                        toast.success('Customer deleted')
                                        loadData()
                                      } else {
                                        toast.error(res.error || 'Failed to delete')
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* TAB 2: WHATSAPP BROADCAST MARKETING & TEMPLATES */
          /* ============================================================ */
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Left Column: Templates & Message Customizer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Campaign Templates */}
              <div className="card">
                <div className="card-header">
                  <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
                  <span className="card-title">1. Select Campaign Template</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                  {CAMPAIGN_TEMPLATES.map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: selectedTemplateId === tmpl.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: selectedTemplateId === tmpl.id ? 'var(--color-primary-10)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.1s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{tmpl.title}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{tmpl.badge}</div>
                      </div>
                      {selectedTemplateId === tmpl.id && (
                        <CheckCircle size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Editor */}
              <div className="card">
                <div className="card-header">
                  <MessageSquare size={16} style={{ color: '#25D366' }} />
                  <span className="card-title">2. Message Editor & Tags</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', width: '100%', marginBottom: 2 }}>
                      Click to insert dynamic placeholder:
                    </span>
                    {[
                      { tag: '{customer_name}', label: 'Customer Name' },
                      { tag: '{store_name}', label: 'Store Name' },
                      { tag: '{balance}', label: 'Balance Due' },
                      { tag: '{whatsapp_hotline}', label: 'WhatsApp Hotline' }
                    ].map(pill => (
                      <button
                        key={pill.tag}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                        onClick={() => setCustomMessage(prev => prev + ' ' + pill.tag)}
                      >
                        +{pill.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="form-input"
                    rows={8}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.5 }}
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                  />

                  <div style={{
                    padding: 10,
                    background: '#E7FCE8',
                    border: '1px solid #86EFAC',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    color: '#166534'
                  }}>
                    💡 Messages format automatically with *bold*, _italic_, and emojis on WhatsApp.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Audience Selector & Sequential Broadcast Launcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={16} style={{ color: '#25D366' }} />
                    <span className="card-title">
                      3. Audience & Broadcast Queue ({selectedCustomerIds.size} selected)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={selectAllEligible}>
                      Select All
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={deselectAll}>
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Broadcast Progress Ribbon */}
                <div style={{
                  padding: '12px 20px',
                  background: 'var(--color-surface-2)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Broadcast Progress: {sentCustomerIds.size} / {selectedCustomerIds.size} Sent
                    </div>
                    <div style={{
                      width: 200, height: 6, background: 'var(--color-border)',
                      borderRadius: 3, marginTop: 4, overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${selectedCustomerIds.size > 0 ? (sentCustomerIds.size / selectedCustomerIds.size) * 100 : 0}%`,
                        height: '100%', background: '#25D366', transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const textList = customers
                        .filter(c => selectedCustomerIds.has(c.id) && (c.phone || c.whatsapp))
                        .map(c => `${c.name} (${c.phone || c.whatsapp}):\n${generateMessageForCustomer(customMessage, c)}\n`)
                        .join('\n---\n')
                      navigator.clipboard.writeText(textList)
                      toast.success('All customized broadcast messages copied to clipboard!')
                    }}
                  >
                    <Copy size={13} /> Copy All Messages
                  </button>
                </div>

                {/* Queue List */}
                <div style={{ maxHeight: 520, overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.size === customers.filter(c => c.phone || c.whatsapp).length && customers.length > 0}
                            onChange={e => e.target.checked ? selectAllEligible() : deselectAll()}
                          />
                        </th>
                        <th>Customer</th>
                        <th>Phone / WhatsApp</th>
                        <th>Message Preview</th>
                        <th style={{ textAlign: 'center' }}>Send Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.filter(c => c.phone || c.whatsapp).map(c => {
                        const isSelected = selectedCustomerIds.has(c.id)
                        const isSent = sentCustomerIds.has(c.id)
                        const preview = generateMessageForCustomer(customMessage, c)

                        return (
                          <tr key={c.id} style={{ opacity: isSelected ? 1 : 0.4 }}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCustomerSelection(c.id)}
                              />
                            </td>

                            <td>
                              <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{c.name}</div>
                              <span className="badge badge-secondary" style={{ fontSize: '0.625rem' }}>{c.type}</span>
                            </td>

                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {c.whatsapp || c.phone}
                            </td>

                            <td style={{ maxWidth: 260 }}>
                              <div style={{
                                fontSize: '0.6875rem',
                                color: 'var(--color-text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {preview}
                              </div>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <button
                                className={`btn btn-sm ${isSent ? 'btn-secondary' : 'btn-success'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => sendWhatsAppToCustomer(c)}
                              >
                                {isSent ? (
                                  <>
                                    <CheckCircle size={12} style={{ color: 'var(--color-success)' }} /> Resend
                                  </>
                                ) : (
                                  <>
                                    <Send size={12} /> Send on WhatsApp
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* ADD CUSTOMER MODAL (With Phone Duplicate Validation) */}
      {/* ============================================================ */}
      {showAddModal && (
        <CustomerFormModal
          title="Add New Customer"
          existingCustomers={customers}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            const res = await window.api.createCustomer(currentUser!.id, data)
            if (res.success && res.data) {
              toast.success(`Customer "${res.data.name}" added successfully!`)
              setShowAddModal(false)
              loadData()
            } else {
              toast.error(res.error || 'Failed to create customer')
            }
          }}
        />
      )}

      {/* ============================================================ */}
      {/* EDIT CUSTOMER MODAL */}
      {/* ============================================================ */}
      {editingCustomer && (
        <CustomerFormModal
          title="Edit Customer"
          initialData={editingCustomer}
          existingCustomers={customers.filter(c => c.id !== editingCustomer.id)}
          onClose={() => setEditingCustomer(null)}
          onSave={async (data) => {
            const res = await window.api.updateCustomer(currentUser!.id, editingCustomer.id, data)
            if (res.success && res.data) {
              toast.success(`Customer "${res.data.name}" updated!`)
              setEditingCustomer(null)
              loadData()
            } else {
              toast.error(res.error || 'Failed to update customer')
            }
          }}
        />
      )}

      {/* ============================================================ */}
      {/* DIRECT SINGLE WHATSAPP MESSAGE MODAL */}
      {/* ============================================================ */}
      {directMsgCustomer && (
        <div className="modal-overlay" onClick={() => setDirectMsgCustomer(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <MessageCircle size={18} style={{ color: '#25D366' }} />
              <span className="modal-title">WhatsApp to {directMsgCustomer.name}</span>
              <button className="modal-close" onClick={() => setDirectMsgCustomer(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Sending to: <strong>{directMsgCustomer.phone || directMsgCustomer.whatsapp}</strong>
              </div>

              <div className="form-group">
                <label className="form-label">Message Text</label>
                <textarea
                  className="form-input"
                  rows={8}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.5 }}
                  value={directMsgText}
                  onChange={e => setDirectMsgText(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDirectMsgCustomer(null)}>Cancel</button>
              <button
                className="btn btn-success"
                onClick={() => {
                  sendWhatsAppToCustomer(directMsgCustomer, directMsgText)
                  setDirectMsgCustomer(null)
                }}
              >
                <Send size={14} /> Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CUSTOMER FORM MODAL COMPONENT (with Instant Phone Validation)
// ============================================================
function CustomerFormModal({
  title,
  initialData,
  existingCustomers,
  onClose,
  onSave
}: {
  title: string
  initialData?: Customer
  existingCustomers: Customer[]
  onClose: () => void
  onSave: (data: Partial<Customer>) => Promise<void>
}) {
  const [name, setName] = useState(initialData?.name || '')
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || initialData?.phone || '')
  const [address, setAddress] = useState(initialData?.address || '')
  const [type, setType] = useState<string>(initialData?.type || 'regular')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [saving, setSaving] = useState(false)

  const normalize = (p?: string) => (p || '').replace(/[\s\-\(\)\.]/g, '')
  const cleanedPhone = normalize(phone)

  const matchedCustomer = cleanedPhone.length >= 7 ? existingCustomers.find(c => {
    const cp = normalize(c.phone)
    const cw = normalize(c.whatsapp)
    const last7 = cleanedPhone.slice(-7)
    return (cp && (cp === cleanedPhone || cp.endsWith(last7))) ||
           (cw && (cw === cleanedPhone || cw.endsWith(last7)))
  }) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }

    if (matchedCustomer && !initialData) {
      toast.error(`Phone number ${phone} is already registered to "${matchedCustomer.name}".`)
      return
    }

    setSaving(true)
    await onSave({
      name: name.trim(),
      phone: phone.trim(),
      whatsapp: (whatsapp || phone).trim(),
      address: address.trim(),
      type: type as any,
      notes: notes.trim()
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <Users size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title">{title}</span>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Haji Usman Clothing"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Customer Type</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                  <option value="regular">Regular Client</option>
                  <option value="walkin">Walk-in Customer</option>
                  <option value="online">Online / WhatsApp Order</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. 0300 1234567"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value)
                    if (!whatsapp) setWhatsapp(e.target.value)
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Contact #</label>
                <input
                  className="form-input"
                  placeholder="e.g. +92 300 1234567"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                />
              </div>
            </div>

            {/* Duplicate phone warning badge */}
            {matchedCustomer && !initialData && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger)',
                borderRadius: 8,
                fontSize: '0.75rem',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>⚠️ A customer with this phone number already exists: <strong>{matchedCustomer.name}</strong> ({matchedCustomer.phone || matchedCustomer.whatsapp}).</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Address / City</label>
              <input
                className="form-input"
                placeholder="e.g. Shop #45, Azam Cloth Market, Lahore"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes / Preferences</label>
              <input
                className="form-input"
                placeholder="e.g. Wholesale buyer, preferred lawn volume collections"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <CheckCircle size={14} /> {saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
