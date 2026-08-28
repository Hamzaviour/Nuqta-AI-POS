import React, { useEffect, useState } from 'react'
import { FileText, Search, Calendar, Eye, Filter, User as UserIcon, Tag, CreditCard, RefreshCw, Printer, Banknote, Edit3 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Invoice, User } from '../../types'
import { ReceiptPreviewModal } from '../../components/common/ReceiptPreviewModal'
import { EditInvoiceModal } from '../../components/common/EditInvoiceModal'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function SalesPage() {
  const { currentUser, canVoidInvoice, canViewProfit } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [datePreset, setDatePreset]   = useState<'today' | '7d' | 'month' | 'custom'>('today')
  const [invoices, setInvoices]       = useState<Invoice[]>([])
  const [users, setUsers]             = useState<User[]>([])
  const [loading, setLoading]         = useState(false)
  const [fromDate, setFromDate]       = useState(todayStr)
  const [toDate, setToDate]           = useState(todayStr)
  const [staffFilter, setStaffFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected]       = useState<Invoice | null>(null)
  const [payModal, setPayModal]       = useState<Invoice | null>(null)
  const [payAmount, setPayAmount]     = useState('')
  const [payMethod, setPayMethod]     = useState<'cash' | 'card' | 'bank'>('cash')
  const [payNotes, setPayNotes]       = useState('')
  const [payLoading, setPayLoading]   = useState(false)
  const [payError, setPayError]       = useState('')

  const loadUsers = async () => {
    if (!currentUser) return
    const res = await window.api.getAllUsers(currentUser.id)
    if (res.success && res.data) {
      setUsers(res.data)
    }
  }

  const load = async () => {
    setLoading(true)
    let start = fromDate
    let end = toDate

    if (datePreset === 'today') {
      start = todayStr
      end = todayStr
    } else if (datePreset === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    } else if (datePreset === 'month') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      end = todayStr
    }

    const result = await window.api.getInvoicesByRange(
      start,
      end,
      staffFilter,
      sourceFilter,
      paymentFilter,
      searchQuery
    )
    setInvoices(result)
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    load()
  }, [datePreset, fromDate, toDate, staffFilter, sourceFilter, paymentFilter, searchQuery])

  const statusColor = (s: string) => ({
    completed: 'var(--color-success)',
    voided: 'var(--color-danger)',
    refunded: '#DC2626',
    pending: 'var(--color-warning)'
  }[s] || 'inherit')

  const activeInvoices = invoices.filter(i => i.status !== 'voided' && i.status !== 'refunded')
  const totalSales    = activeInvoices.reduce((s, i) => s + i.grand_total, 0)
  const totalDiscount = activeInvoices.reduce((s, i) => s + i.discount_amount, 0)
  const totalProfit   = activeInvoices.reduce((s, i) => s + i.profit, 0)
  const realizedProfit = activeInvoices.reduce((s, i) => s + (i.profit * (i.grand_total > 0 ? (i.amount_paid / i.grand_total) : 1)), 0)
  const pendingCreditProfit = Math.max(0, totalProfit - realizedProfit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header" style={{ padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 className="page-header-title">Sales History & Filter</h3>
            <div className="page-header-subtitle">Filter by staff member, channel source, payment method, or search query</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        {/* Date Presets */}
        <div className="btn-group">
          {(['today', '7d', 'month', 'custom'] as const).map(p => (
            <button
              key={p}
              className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDatePreset(p)}
            >
              {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : p === 'month' ? 'This Month' : 'Custom Period'}
            </button>
          ))}
        </div>

        {/* Date Range if Custom */}
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="date"
              className="form-input form-input-sm"
              style={{ width: 135 }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>to</span>
            <input
              type="date"
              className="form-input form-input-sm"
              style={{ width: 135 }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 180, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search invoice #, customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>

        {/* Staff Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserIcon size={14} style={{ color: 'var(--color-text-muted)' }} />
          <select
            className="form-input"
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="all">All Staff</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>

        {/* Source Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={14} style={{ color: 'var(--color-text-muted)' }} />
          <select
            className="form-input"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="all">All Sources</option>
            <option value="instore">🏪 In-Store</option>
            <option value="whatsapp">💬 WhatsApp</option>
            <option value="socialmedia">📱 Social Media</option>
            <option value="other">📦 Other</option>
          </select>
        </div>

        {/* Payment Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CreditCard size={14} style={{ color: 'var(--color-text-muted)' }} />
          <select
            className="form-input"
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="all">All Payments</option>
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Card</option>
            <option value="bank">🏦 Bank / Wallet</option>
            <option value="split">⚡ Split</option>
            <option value="credit">📄 Credit</option>
          </select>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh sales">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary KPI Bar */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--color-surface-2)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Filtered Sales: </span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>
            {activeInvoices.length} Active Bills
            {invoices.length > activeInvoices.length && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 4 }}>
                ({invoices.length - activeInvoices.length} refunded/voided)
              </span>
            )}
          </strong>
        </div>
        <div style={{ fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Total Net Sales: </span>
          <strong style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>{fmt(totalSales)}</strong>
        </div>
        <div style={{ fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Total Discounts: </span>
          <strong style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>{fmt(totalDiscount)}</strong>
        </div>
        {canViewProfit && (
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>🔒 Invoiced Profit: </span>
            <strong style={{ color: totalProfit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', fontFamily: 'var(--font-mono)' }}>
              {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)}
            </strong>
            {pendingCreditProfit > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                (Realized: <strong style={{ color: 'var(--color-primary)' }}>{fmt(realizedProfit)}</strong> · <span style={{ color: 'var(--color-warning)' }}>{fmt(pendingCreditProfit)} pending credit</span>)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading sales...</div>
        ) : invoices.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <FileText size={36} style={{ opacity: 0.3 }} />
            <p>No sales matching the selected filters</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Source</th>
                <th>Staff</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                {canViewProfit && <th style={{ textAlign: 'right' }}>🔒 Profit</th>}
                <th>Payment</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const isInactive = inv.status === 'voided' || inv.status === 'refunded'
                return (
                  <tr key={inv.id} style={{ opacity: isInactive ? 0.6 : 1, background: isInactive ? 'rgba(0,0,0,0.02)' : undefined }}>
                    <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{inv.invoice_number}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.date}</td>
                    <td>{inv.customer_name || 'Walk-in'}</td>
                    <td>
                      <span className={`badge ${
                        inv.source === 'whatsapp' ? 'badge-success' :
                        inv.source === 'socialmedia' ? 'badge-primary' : 'badge-neutral'
                      }`} style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {inv.source === 'whatsapp' ? 'WhatsApp' : inv.source === 'socialmedia' ? 'Social' : inv.source === 'instore' ? 'In-Store' : inv.source}
                      </span>
                    </td>
                    <td><strong style={{ color: 'var(--color-text-primary)' }}>{inv.staff_name}</strong></td>
                    <td className="col-currency" style={{
                      color: isInactive ? 'var(--color-text-muted)' : 'var(--color-primary)',
                      textDecoration: isInactive ? 'line-through' : 'none',
                      fontWeight: 700
                    }}>
                      {fmt(inv.grand_total)}
                    </td>
                    <td className="col-currency" style={{ color: inv.discount_amount > 0 ? 'var(--color-warning)' : 'inherit', textDecoration: isInactive ? 'line-through' : 'none' }}>
                      {inv.discount_amount > 0 ? `- ${fmt(inv.discount_amount)}` : '—'}
                    </td>
                    {canViewProfit && (
                      <td className="col-currency" style={{
                        color: isInactive ? 'var(--color-text-muted)' : (inv.profit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'),
                        textDecoration: isInactive ? 'line-through' : 'none',
                        fontWeight: 600
                      }}>
                        {inv.profit !== 0 ? `${inv.profit >= 0 ? '+' : ''}${fmt(inv.profit)}` : '—'}
                      </td>
                    )}
                    <td><span className="badge badge-neutral">{inv.payment_method}</span></td>
                    <td>
                      <span className="badge" style={{ background: `${statusColor(inv.status)}20`, color: statusColor(inv.status) }}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelected(inv)} title="View details">
                        <Eye size={14} />
                      </button>
                      {inv.status === 'pending' && inv.balance_due > 0 && (
                        <button
                          className="btn btn-warning btn-sm btn-icon"
                          onClick={() => {
                            setPayModal(inv)
                            setPayAmount(inv.balance_due.toString())
                            setPayNotes('')
                            setPayError('')
                          }}
                          title={`Collect Rs. ${inv.balance_due.toLocaleString()}`}
                        >
                          <Banknote size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <InvoiceDetailModal
          invoice={selected}
          onSaved={() => {
            load()
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Banknote size={18} style={{ color: 'var(--color-warning)' }} />
              <span className="modal-title">Collect Payment</span>
              <span className="badge" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontWeight: 700 }}>
                Pending
              </span>
              <button className="modal-close" onClick={() => setPayModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Invoice</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{payModal.invoice_number}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Grand Total</div>
                    <div style={{ fontWeight: 600 }}>{fmt(payModal.grand_total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Already Paid</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmt(payModal.amount_paid)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Balance Due</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{fmt(payModal.balance_due)}</div>
                  </div>
                </div>
              </div>

              {payModal.customer_name && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Customer: <strong style={{ color: 'var(--color-text-primary)' }}>{payModal.customer_name}</strong>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    min="0"
                    step="1"
                    style={{ fontWeight: 700, fontSize: '1.125rem' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPayAmount(payModal.balance_due.toString())}>
                      Full ({fmt(payModal.balance_due)})
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPayAmount('')}>
                      Custom
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>
                    Payment Method
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['cash', 'card', 'bank'] as const).map(m => (
                      <button
                        key={m}
                        className={`btn ${payMethod === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => setPayMethod(m)}
                        style={{ flex: 1 }}
                      >
                        {m === 'cash' ? '💵 Cash' : m === 'card' ? '💳 Card' : '🏦 Bank'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Collected via WhatsApp"
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                  />
                </div>

                {payError && (
                  <div style={{ padding: '8px 12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 6, fontSize: '0.8125rem' }}>
                    {payError}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPayModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={async () => {
                  const amt = parseFloat(payAmount)
                  if (!amt || amt <= 0) { setPayError('Enter a valid amount'); return }
                  if (!currentUser) return
                  setPayLoading(true)
                  setPayError('')
                  const result = await window.api.recordInvoicePayment(currentUser.id, {
                    invoice_id: payModal.id,
                    amount: amt,
                    method: payMethod,
                    notes: payNotes || undefined
                  })
                  setPayLoading(false)
                  if (result.success) {
                    setPayModal(null)
                    load()
                    loadUsers()
                  } else {
                    setPayError(result.error || 'Failed to collect payment')
                  }
                }}
                disabled={payLoading}
              >
                {payLoading ? 'Collecting...' : `Collect ${fmt(parseFloat(payAmount) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceDetailModal({
  invoice,
  onSaved,
  onClose
}: {
  invoice: Invoice
  onSaved?: (updated: Invoice) => void
  onClose: () => void
}) {
  const { currentUser, isOwner, canEditInvoice, canVoidInvoice, canViewCostPrice, canViewProfit } = useAuth()
  const [full, setFull]           = useState<Invoice | null>(null)
  const [voidModal, setVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [showEditModal, setShowEditModal]       = useState(false)

  useEffect(() => {
    window.api.getInvoiceById(invoice.id).then(setFull)
  }, [invoice.id])

  const handleVoid = async () => {
    if (!voidReason.trim()) { alert('Reason required'); return }
    const result = await window.api.voidInvoice(currentUser!.id, invoice.id, voidReason)
    if (result.success) { onClose() }
    else alert(result.error)
  }

  const currentStatus = full?.status || invoice.status

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <FileText size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title">Invoice: {invoice.invoice_number}</span>
            <span className="badge" style={{
              background: currentStatus === 'completed' ? 'var(--color-success-bg)' : currentStatus === 'refunded' ? '#FEE2E2' : 'var(--color-danger-bg)',
              color: currentStatus === 'completed' ? 'var(--color-success)' : currentStatus === 'refunded' ? '#DC2626' : 'var(--color-danger)',
              fontWeight: 700
            }}>
              {currentStatus.toUpperCase()}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {(isOwner || canEditInvoice) && currentStatus !== 'voided' && currentStatus !== 'refunded' && (
                <button className="btn btn-warning btn-sm" onClick={() => setShowEditModal(true)}>
                  <Edit3 size={14} /> Edit Invoice
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setShowPrintPreview(true)}>
                <Printer size={14} /> Print Preview
              </button>
              {canVoidInvoice && currentStatus === 'completed' && !invoice.is_locked && (
                <button className="btn btn-danger btn-sm" onClick={() => setVoidModal(true)}>Void Invoice</button>
              )}
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="grid-3" style={{ marginBottom: 16, gap: 12 }}>
              {[
                { label: 'Date', value: invoice.date },
                { label: 'Customer', value: invoice.customer_name || 'Walk-in' },
                { label: 'Staff', value: invoice.staff_name || '—' },
                { label: 'Source', value: invoice.source },
                { label: 'Payment', value: invoice.payment_method },
                { label: 'Grand Total', value: `Rs. ${invoice.grand_total.toLocaleString()}` },
                ...(canViewCostPrice ? [{ label: '🔒 Cost', value: `Rs. ${invoice.cost_total.toLocaleString()}` }] : []),
                ...(canViewProfit ? [{ label: '🔒 Profit', value: `Rs. ${invoice.profit.toLocaleString()}` }] : []),
              ].map(row => (
                <div key={row.label} style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{row.value}</div>
                </div>
              ))}
            </div>

            {full?.items && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Disc%</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {full.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.item_name} <span className="text-xs text-muted">({item.part_number})</span></td>
                      <td className="col-number">{item.qty}</td>
                      <td className="col-currency">{fmt(item.unit_price)}</td>
                      <td className="col-number">{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</td>
                      <td className="col-currency" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {voidModal && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-danger-bg)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>Void this invoice?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Reason for void (required)" value={voidReason} onChange={e => setVoidReason(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-danger" onClick={handleVoid}>Confirm Void</button>
                <button className="btn btn-secondary" onClick={() => setVoidModal(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Live Print Preview Modal */}
      {showPrintPreview && (
        <ReceiptPreviewModal
          invoiceNumber={invoice.invoice_number}
          total={invoice.grand_total}
          subtotal={invoice.subtotal}
          discountAmount={invoice.discount_amount}
          historyItems={full?.items || invoice.items || []}
          customerName={invoice.customer_name || undefined}
          customerPhone={invoice.customer_phone || invoice.customer_whatsapp || invoice.online_customer_contact || undefined}
          staffName={invoice.staff_name || undefined}
          paymentMethod={invoice.payment_method}
          paymentDetails={invoice.notes || invoice.payment_method || ''}
          amountPaid={invoice.amount_paid}
          balanceDue={invoice.balance_due}
          dateStr={invoice.date}
          timeStr={invoice.datetime_created ? invoice.datetime_created.slice(11, 19) : undefined}
          status={invoice.status}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && (
        <EditInvoiceModal
          invoice={full || invoice}
          onSaved={(updated) => {
            setFull(updated)
            setShowEditModal(false)
            onSaved?.(updated)
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
