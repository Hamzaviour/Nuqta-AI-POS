import React, { useState, useEffect } from 'react'
import {
  ShoppingBag, Plus, Search, CheckCircle, Trash2, RefreshCw, Truck,
  DollarSign, Eye, X, FileText, AlertTriangle, Building, CreditCard, Wallet,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Supplier, Item, Purchase } from '../../types'
import { QuickAddSupplierModal } from '../Stock/StockPage'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface PurchaseLineItem {
  id: string
  item: Item | null
  item_search: string
  qty: number
  cost_price: number
  line_total: number
}

// ============================================================
// REUSABLE PAY STOCK INVOICE MODAL
// ============================================================
export function PayStockInvoiceModal({
  invoice,
  onPaid,
  onClose
}: {
  invoice: Purchase
  onPaid: (updated: Purchase) => void
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [payMode, setPayMode] = useState<'drawer' | 'outside' | 'split'>('drawer')
  const [payAmount, setPayAmount]         = useState(invoice.balance_due.toString())
  // Split mode amounts
  const [splitDrawer, setSplitDrawer]     = useState('')
  const [splitBank, setSplitBank]         = useState('')
  const [reference, setReference]         = useState('')
  const [notes, setNotes]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)

  const numAmount     = parseFloat(payAmount) || 0
  const numDrawer     = parseFloat(splitDrawer) || 0
  const numBank       = parseFloat(splitBank) || 0
  const splitTotal    = numDrawer + numBank

  // Auto-fill the other split field when one is entered
  const handleDrawerChange = (v: string) => {
    setSplitDrawer(v)
    const d = parseFloat(v) || 0
    const remaining = Math.max(0, invoice.balance_due - d)
    setSplitBank(remaining > 0 ? remaining.toFixed(0) : '')
  }
  const handleBankChange = (v: string) => {
    setSplitBank(v)
    const b = parseFloat(v) || 0
    const remaining = Math.max(0, invoice.balance_due - b)
    setSplitDrawer(remaining > 0 ? remaining.toFixed(0) : '')
  }

  const callPayApi = async (amount: number, source: 'drawer' | 'outside', ref?: string, note?: string) => {
    if (typeof window.api?.payPurchaseInvoice === 'function') {
      return window.api.payPurchaseInvoice(currentUser!.id, {
        purchase_id: invoice.id,
        amount,
        payment_source: source,
        reference: ref || undefined,
        notes: note || undefined
      })
    } else if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
      return (window as any).electron.ipcRenderer.invoke('purchases:pay', currentUser!.id, {
        purchase_id: invoice.id,
        amount,
        payment_source: source,
        reference: ref || undefined,
        notes: note || undefined
      })
    }
    throw new Error('Payment API not available. Please restart the app.')
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) { toast.error('You must be logged in to record payment'); return }

    if (payMode === 'split') {
      if (numDrawer <= 0 && numBank <= 0) {
        toast.error('Enter amounts for Cash Drawer and/or Bank payment.')
        return
      }
      if (splitTotal > invoice.balance_due + 0.01) {
        toast.error(`Split total (${fmt(splitTotal)}) exceeds remaining balance (${fmt(invoice.balance_due)})`)
        return
      }
    } else {
      if (numAmount <= 0) { toast.error('Payment amount must be greater than 0'); return }
      if (numAmount > invoice.balance_due + 0.01) {
        toast.error(`Payment cannot exceed remaining balance of ${fmt(invoice.balance_due)}`)
        return
      }
    }

    setSubmitting(true)
    try {
      let finalUpdated: Purchase | undefined

      if (payMode === 'split') {
        // Two sequential API calls
        const refNote = reference.trim() || undefined
        const noteText = notes.trim() || undefined

        if (numDrawer > 0) {
          const r1 = await callPayApi(numDrawer, 'drawer', refNote, noteText ? `[Cash] ${noteText}` : '[Cash portion of split payment]')
          if (!r1?.success) {
            toast.error(r1?.error || 'Failed to record cash drawer payment')
            return
          }
          finalUpdated = r1.data
        }
        if (numBank > 0) {
          const r2 = await callPayApi(numBank, 'outside', refNote, noteText ? `[Bank] ${noteText}` : '[Bank portion of split payment]')
          if (!r2?.success) {
            toast.error(r2?.error || 'Failed to record bank payment (cash portion may already be saved)')
            return
          }
          finalUpdated = r2.data
        }

        if (finalUpdated) {
          toast.success(
            `Split payment recorded: ${fmt(numDrawer)} (Cash Drawer) + ${fmt(numBank)} (Bank) = ${fmt(splitTotal)} for ${invoice.purchase_number}`,
            { duration: 4500 }
          )
          onPaid(finalUpdated)
          onClose()
        }
      } else {
        const res = await callPayApi(numAmount, payMode === 'drawer' ? 'drawer' : 'outside', reference.trim() || undefined, notes.trim() || undefined)
        if (res?.success && res.data) {
          toast.success(`Payment of ${fmt(numAmount)} recorded for invoice ${invoice.purchase_number}!`, { duration: 3500 })
          onPaid(res.data)
          onClose()
        } else {
          toast.error(res?.error || 'Failed to record payment')
        }
      }
    } catch (err) {
      console.error('Pay purchase invoice error:', err)
      toast.error(String(err) || 'Failed to process payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <span className="modal-title">Pay Stock Invoice</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {invoice.purchase_number} · Supplier: {invoice.supplier_name || 'No Specific Supplier'}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handlePay}>
          <div className="modal-body">
            {/* Financial Status Banner */}
            <div className="grid-3" style={{ gap: 10, marginBottom: 16, background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Bill</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{fmt(invoice.total_cost)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Already Paid</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-success)' }}>{fmt(invoice.amount_paid)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Pending Balance</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-danger)' }}>{fmt(invoice.balance_due)}</div>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="form-group">
              <label className="form-label">Payment Source *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { key: 'drawer', label: '🏪 Cash Drawer', desc: 'From shop cash in hand' },
                  { key: 'outside', label: '💳 Bank / Outside', desc: 'External funds / bank' },
                  { key: 'split', label: '⚡ Split Payment', desc: 'Cash + Bank combined' },
                ].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPayMode(m.key as typeof payMode)}
                    style={{
                      padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                      border: payMode === m.key ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      background: payMode === m.key ? 'var(--color-primary-10)' : 'var(--color-surface)',
                      color: payMode === m.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      boxShadow: payMode === m.key ? '0 0 0 3px var(--color-primary-20)' : 'none',
                      transition: 'all 0.15s ease', textAlign: 'center', fontWeight: 700, fontSize: '0.8125rem'
                    }}
                  >
                    <div>{m.label}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: 2, color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Single Payment Amount (Drawer or Outside) */}
            {(payMode === 'drawer' || payMode === 'outside') && (
              <div className="form-group">
                <label className="form-label">Payment Amount (Rs.) *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    className="form-input form-input-lg"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    min={1}
                    max={invoice.balance_due}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setPayAmount(invoice.balance_due.toString())}
                  >
                    Pay Full ({fmt(invoice.balance_due)})
                  </button>
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {payMode === 'drawer'
                    ? '🏪 Will be deducted from shop cash drawer and reflected in Day Close.'
                    : '💳 Paid from external funds / bank — does NOT affect cash drawer balance.'}
                </div>
              </div>
            )}

            {/* Split Payment Inputs */}
            {payMode === 'split' && (
              <div style={{
                padding: '14px', background: 'var(--color-surface-2)',
                borderRadius: 10, border: '1.5px solid var(--color-primary-20)',
                marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  ⚡ Split: Cash Drawer + Bank / Outside
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      🏪 Cash Drawer Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={splitDrawer}
                      onChange={e => handleDrawerChange(e.target.value)}
                      placeholder="0"
                      min={0}
                      max={invoice.balance_due}
                      autoFocus
                      style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}
                    />
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 3 }}>Deducted from shop cash</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      💳 Bank / Outside Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={splitBank}
                      onChange={e => handleBankChange(e.target.value)}
                      placeholder="0"
                      min={0}
                      max={invoice.balance_due}
                      style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}
                    />
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 3 }}>External funds / bank transfer</div>
                  </div>
                </div>
                {/* Split summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Combined Total: <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(splitTotal)}</strong>
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 700,
                    color: splitTotal > invoice.balance_due + 0.01
                      ? 'var(--color-danger)'
                      : splitTotal === invoice.balance_due
                        ? 'var(--color-success)'
                        : 'var(--color-warning)'
                  }}>
                    {splitTotal > invoice.balance_due + 0.01
                      ? '⚠ Exceeds balance!'
                      : splitTotal === invoice.balance_due
                        ? '✓ Fully covers balance'
                        : splitTotal > 0
                          ? `${fmt(invoice.balance_due - splitTotal)} remaining after this`
                          : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Reference & Notes */}
            <div className="grid-2" style={{ gap: 12, marginTop: payMode === 'split' ? 12 : 0 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Ref / Slip #</label>
                <input
                  className="form-input form-input-sm"
                  placeholder="e.g. Cheque #, Slip #, Cash..."
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes</label>
                <input
                  className="form-input form-input-sm"
                  placeholder="Optional remarks..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={submitting || (payMode === 'split' ? splitTotal <= 0 : numAmount <= 0)}
            >
              <CheckCircle size={15} />
              {submitting
                ? 'Processing Payment...'
                : payMode === 'split'
                  ? `Confirm Split Payment — ${fmt(splitTotal)}`
                  : `Confirm Payment of ${fmt(numAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


export default function PurchasesPage() {
  const { canRecordPurchase } = useAuth()
  const [tab, setTab] = useState<'list' | 'new'>('list')

  if (!canRecordPurchase) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="empty-state">
          <ShoppingBag size={48} style={{ opacity: 0.3 }} />
          <h3>Access Denied</h3>
          <p>You do not have permission to access purchases.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h3 className="page-header-title">Purchases & Stock Invoices</h3>
          <div className="page-header-subtitle">Record supplier purchases, stock batches, and settle pending supplier bills</div>
        </div>
        <div className="page-header-actions">
          {tab === 'list' ? (
            <button className="btn btn-primary" onClick={() => setTab('new')}>
              <Plus size={15} /> Record Stock Purchase
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setTab('list')}>
              ← Back to Purchases List
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'list' ? <PurchasesList onNew={() => setTab('new')} /> : <NewPurchase onSaved={() => setTab('list')} />}
      </div>
    </div>
  )
}

// ============================================================
// PURCHASES LIST
// ============================================================
function PurchasesList({ onNew }: { onNew: () => void }) {
  const { currentUser } = useAuth()
  const [purchases, setPurchases]     = useState<Purchase[]>([])
  const [loading, setLoading]         = useState(true)
  const [query, setQuery]             = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'drawer' | 'outside'>('all')
  const [viewInvoice, setViewInvoice] = useState<Purchase | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Purchase | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await window.api.getAllPurchases(currentUser!.id)
    if (res.success && res.data) setPurchases(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = purchases.filter(p => {
    const q = query.toLowerCase()
    const matchQuery =
      p.purchase_number.toLowerCase().includes(q) ||
      (p.supplier_name || '').toLowerCase().includes(q) ||
      (p.invoice_ref || '').toLowerCase().includes(q)

    const matchStatus = statusFilter === 'all' || p.payment_status === statusFilter
    const matchSource = sourceFilter === 'all' || (p.payment_source || 'drawer') === sourceFilter

    return matchQuery && matchStatus && matchSource
  })

  const totalPurchasesCost = filtered.reduce((s, p) => s + (p.total_cost || 0), 0)
  const totalPaid = filtered.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const totalPending = filtered.reduce((s, p) => s + (p.balance_due || 0), 0)

  return (
    <div className="page-body">
      {/* Summary KPI Cards */}
      <div className="grid-3" style={{ gap: 16, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-title">Total Stock Invoiced</div>
          <div className="kpi-value text-primary">{fmt(totalPurchasesCost)}</div>
          <div className="kpi-subtitle">{filtered.length} purchase invoices</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Total Amount Paid</div>
          <div className="kpi-value text-success">{fmt(totalPaid)}</div>
          <div className="kpi-subtitle">Settled supplier bills</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Pending / Accounts Payable</div>
          <div className="kpi-value text-danger">{fmt(totalPending)}</div>
          <div className="kpi-subtitle">Owed to suppliers</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search PO#, supplier name, bill ref..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div className="btn-group">
          {(['all', 'paid', 'partial', 'unpaid'] as const).map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All Status' : s === 'paid' ? 'Paid' : s === 'partial' ? 'Partial' : 'Pending / Unpaid'}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          className="form-select form-select-sm"
          style={{ width: 170 }}
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}
        >
          <option value="all">All Payment Sources</option>
          <option value="drawer">🏪 Shop Drawer Cash</option>
          <option value="outside">💳 Outside / Bank</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading purchase invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <ShoppingBag size={36} style={{ opacity: 0.3 }} />
            <p>No purchase records found for the selected filters</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Stock Invoice #</th>
                <th>Date</th>
                <th>Supplier / Mill</th>
                <th>Supplier Bill #</th>
                <th style={{ textAlign: 'right' }}>Total Bill</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th>Payment Status</th>
                <th>Payment Source</th>
                <th>Staff</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      {p.purchase_number}
                    </span>
                  </td>
                  <td>{p.date}</td>
                  <td>
                    <strong>{p.supplier_name || '—'}</strong>
                  </td>
                  <td>{p.invoice_ref || '—'}</td>
                  <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(p.total_cost)}</td>
                  <td className="col-currency text-success" style={{ fontWeight: 600 }}>{fmt(p.amount_paid)}</td>
                  <td className="col-currency" style={{ color: p.balance_due > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: p.balance_due > 0 ? 800 : 400 }}>
                    {fmt(p.balance_due)}
                  </td>
                  <td>
                    {p.payment_status === 'paid' && <span className="badge badge-success">Paid</span>}
                    {p.payment_status === 'partial' && <span className="badge badge-warning">Partial</span>}
                    {p.payment_status === 'unpaid' && <span className="badge badge-danger">Pending / Unpaid</span>}
                  </td>
                  <td>
                    {(p.payment_source || 'drawer') === 'drawer' ? (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        🏪 Shop Drawer
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#C084FC', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        💳 Outside / Bank
                      </span>
                    )}
                  </td>
                  <td className="text-muted text-xs">{p.created_by_name || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {p.balance_due > 0 && (
                        <button
                          className="btn btn-primary btn-xs"
                          style={{ padding: '2px 8px', fontSize: '0.725rem' }}
                          onClick={() => setPayingInvoice(p)}
                          title="Record payment towards this stock invoice"
                        >
                          <CreditCard size={12} /> Pay Bill
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-xs btn-icon"
                        onClick={() => setViewInvoice(p)}
                        title="View invoice details & items"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pay Invoice Modal */}
      {payingInvoice && (
        <PayStockInvoiceModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onPaid={(updated) => {
            setPurchases(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            if (viewInvoice && viewInvoice.id === updated.id) {
              setViewInvoice(prev => prev ? { ...prev, ...updated } : null)
            }
          }}
        />
      )}

      {/* Invoice Detail Modal */}
      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <span className="modal-title">Stock Invoice {viewInvoice.purchase_number}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Date: {viewInvoice.date}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setViewInvoice(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Supplier / Mill</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{viewInvoice.supplier_name || 'No Specific Supplier'}</div>
                  {viewInvoice.invoice_ref && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Bill Ref: {viewInvoice.invoice_ref}</div>
                  )}
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Status</div>
                  <div style={{ marginTop: 4 }}>
                    {viewInvoice.payment_status === 'paid' && <span className="badge badge-success">Fully Paid</span>}
                    {viewInvoice.payment_status === 'partial' && <span className="badge badge-warning">Partial Payment</span>}
                    {viewInvoice.payment_status === 'unpaid' && <span className="badge badge-danger">Pending / Unpaid</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Source: {(viewInvoice.payment_source || 'drawer') === 'drawer' ? 'Shop Drawer (Cash in Hand)' : 'Outside / Bank / Personal Funds'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Financials</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>{fmt(viewInvoice.total_cost)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>Paid: {fmt(viewInvoice.amount_paid)}</div>
                  {viewInvoice.balance_due > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700 }}>Pending: {fmt(viewInvoice.balance_due)}</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8 }}>Stock Items In This Invoice</h4>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th>Part / SKU</th>
                      <th style={{ textAlign: 'center' }}>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Cost Price</th>
                      <th style={{ textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewInvoice.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td><strong>{it.item_name || 'Product'}</strong></td>
                        <td><span className="font-mono">{it.part_number || '—'}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(it.cost_price)}</td>
                        <td className="col-currency" style={{ fontWeight: 700 }}>{fmt(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewInvoice.notes && (
                <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: 10, borderRadius: 6 }}>
                  <strong>Notes:</strong> {viewInvoice.notes}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {viewInvoice.balance_due > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const toPay = viewInvoice
                      setViewInvoice(null)
                      setPayingInvoice(toPay)
                    }}
                  >
                    <CreditCard size={15} /> Pay Remaining Bill ({fmt(viewInvoice.balance_due)})
                  </button>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setViewInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// NEW PURCHASE FORM
// ============================================================
function NewPurchase({ onSaved }: { onSaved: () => void }) {
  const { currentUser } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [allItems, setAllItems]   = useState<Item[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [invoiceRef, setInvoiceRef] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('unpaid')
  const [paymentSource, setPaymentSource] = useState<'drawer' | 'outside'>('drawer')
  const [amountPaid, setAmountPaid]     = useState('')
  const [notes, setNotes]               = useState('')
  const [lines, setLines]               = useState<PurchaseLineItem[]>([newLine()])
  const [saving, setSaving]             = useState(false)

  function newLine(): PurchaseLineItem {
    return { id: Math.random().toString(), item: null, item_search: '', qty: 1, cost_price: 0, line_total: 0 }
  }

  const loadData = () => {
    Promise.all([window.api.getAllSuppliers(), window.api.getAllItems()])
      .then(([sups, items]) => { setSuppliers(sups); setAllItems(items) })
  }

  useEffect(() => { loadData() }, [])

  const updateLine = (id: string, field: string, value: unknown) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'qty' || field === 'cost_price') {
        updated.line_total = (Number(updated.qty) || 0) * (Number(updated.cost_price) || 0)
      }
      if (field === 'item' && value) {
        const item = value as Item
        updated.item_search = item.name
        updated.cost_price = item.cost_price
        updated.line_total = (Number(updated.qty) || 1) * item.cost_price
      }
      return updated
    }))
  }

  const totalCost = lines.reduce((s, l) => s + l.line_total, 0)
  const paidAmount = paymentStatus === 'unpaid'
    ? 0
    : (paymentStatus === 'paid' ? totalCost : (parseFloat(amountPaid) || 0))
  const balance = Math.max(0, totalCost - paidAmount)

  const handleSave = async () => {
    const validLines = lines.filter(l => l.item && l.qty > 0 && l.cost_price > 0)
    if (validLines.length === 0) {
      toast.error('Please add at least one product with quantity and cost price')
      return
    }

    setSaving(true)
    const result = await window.api.createPurchase(currentUser!.id, {
      supplier_id: supplierId || undefined,
      invoice_ref: invoiceRef || undefined,
      total_cost: totalCost,
      amount_paid: paidAmount,
      balance_due: balance,
      payment_status: paymentStatus,
      payment_source: paymentSource,
      notes: notes || undefined,
      items: validLines.map(l => ({
        item_id: l.item!.id,
        qty: l.qty,
        cost_price: l.cost_price,
        line_total: l.line_total
      }))
    })

    if (result.success && result.data) {
      toast.success(`Stock Invoice ${(result.data as Purchase).purchase_number} generated & stock updated!`)
      onSaved()
    } else {
      toast.error(result.error || 'Failed to save purchase')
    }
    setSaving(false)
  }

  return (
    <div className="page-body">
      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onSaved={(s) => {
            setSuppliers(prev => [s, ...prev.filter(x => x.id !== s.id)])
            setSupplierId(s.id)
            setShowAddSupplierModal(false)
          }}
        />
      )}
      <div style={{ maxWidth: 960 }}>
        {/* Supplier & Invoice Header */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <ShoppingBag size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">Supplier & Bill Information</span>
          </div>
          <div className="card-body">
            <div className="grid-3" style={{ gap: 16 }}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Supplier / Mill</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-primary"
                    style={{ padding: '0 4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => setShowAddSupplierModal(true)}
                  >
                    <Plus size={11} /> + New Supplier
                  </button>
                </div>
                <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">No specific supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier Bill / Invoice #</label>
                <input className="form-input" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="e.g. INV-2024-001" />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select className="form-select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as typeof paymentStatus)}>
                  <option value="paid">🟢 Fully Paid</option>
                  <option value="partial">🟡 Partial Payment</option>
                  <option value="unpaid">🔴 Pending / Unpaid (Payable)</option>
                </select>
              </div>
            </div>

            {/* Payment Source & Options */}
            {paymentStatus !== 'unpaid' && (
              <div style={{
                marginTop: 14,
                padding: '12px 14px',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Paid From:</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="pay_source"
                    checked={paymentSource === 'drawer'}
                    onChange={() => setPaymentSource('drawer')}
                  />
                  <span>🏪 Shop Drawer (Cash in Hand)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="pay_source"
                    checked={paymentSource === 'outside'}
                    onChange={() => setPaymentSource('outside')}
                  />
                  <span>💳 Outside Funds / Bank / Personal Funds</span>
                </label>
              </div>
            )}

            {paymentStatus === 'unpaid' && (
              <div style={{
                marginTop: 14,
                padding: '10px 14px',
                background: 'var(--color-danger-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <AlertTriangle size={15} />
                <span>This bill will be saved as <strong>PENDING</strong>. Total bill amount will be added to the supplier's balance and reflected in Reports & AP Aging.</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Purchased Items & Stock Inflow</span>
            <button className="btn btn-primary btn-sm ml-auto" onClick={() => setLines(prev => [...prev, newLine()])}>
              <Plus size={13} /> Add Item Row
            </button>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Item (Part #)</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Cost Price (Rs.)</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Line Total</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id}>
                    <td>
                      <select
                        className="form-select"
                        value={line.item?.id || ''}
                        onChange={e => {
                          const item = allItems.find(i => i.id === e.target.value) || null
                          updateLine(line.id, 'item', item)
                        }}
                      >
                        <option value="">-- Select item --</option>
                        {allItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.part_number})</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ textAlign: 'center' }}
                        value={line.qty}
                        onChange={e => updateLine(line.id, 'qty', parseInt(e.target.value) || 1)}
                        min={1}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ textAlign: 'right' }}
                        value={line.cost_price || ''}
                        onChange={e => updateLine(line.id, 'cost_price', parseFloat(e.target.value) || 0)}
                        min={0}
                      />
                    </td>
                    <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(line.line_total)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals & Save */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {paymentStatus === 'partial' && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>Amount Paid Now (Rs.)</div>
                  <input
                    type="number"
                    className="form-input form-input-lg"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="Enter partial amount..."
                  />
                  {balance > 0 && (
                    <div style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                      Remaining Pending Balance: {fmt(balance)}
                    </div>
                  )}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>Notes / Remarks</div>
                <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Summer stock shipment, 15 days credit..." />
              </div>

              <div style={{ textAlign: 'right', minWidth: 240, marginLeft: 'auto' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Total Stock Bill</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                  {fmt(totalCost)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 16 }}>
                  Stock quantities will update immediately
                </div>
                <button className="btn btn-success btn-lg btn-full" onClick={handleSave} disabled={saving || totalCost <= 0}>
                  <CheckCircle size={16} />
                  {saving ? 'Generating Invoice...' : 'Generate Stock Invoice & Add Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
