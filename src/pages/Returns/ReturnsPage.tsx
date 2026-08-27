import React, { useState, useEffect } from 'react'
import {
  RotateCcw, Plus, Search, Calendar, CheckCircle2, AlertCircle,
  FileText, ArrowLeft, RefreshCw, Eye
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Return, Invoice, InvoiceItem } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface ReturnLineSelection {
  item_id: string
  item_name: string
  part_number: string
  qty_sold: number
  qty_to_return: number
  unit_price: number
  line_total: number
  restocked: boolean
  selected: boolean
}

export default function ReturnsPage() {
  const { currentUser, canProcessReturn } = useAuth()
  const [tab, setTab] = useState<'history' | 'new'>('history')
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null)

  const loadReturns = async () => {
    setLoading(true)
    const res = await window.api.getAllReturns(currentUser!.id)
    if (res.success && res.data) {
      setReturns(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadReturns()
  }, [])

  if (!canProcessReturn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <RotateCcw size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <h3>Access Denied</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            You do not have permission to process returns and refunds.
            Contact the Owner to enable <code>perm_process_return</code>.
          </p>
        </div>
      </div>
    )
  }

  const filtered = returns.filter(r =>
    r.return_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.invoice_number && r.invoice_number.toLowerCase().includes(search.toLowerCase())) ||
    (r.customer_name && r.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    r.reason.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header">
        <RotateCcw size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Returns & Refunds</h3>
          <div className="page-header-subtitle">Process customer returns, restock inventory & issue refunds</div>
        </div>
        <div className="page-header-actions">
          {tab === 'history' ? (
            <button className="btn btn-primary" onClick={() => setTab('new')}>
              <Plus size={15} /> New Return
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setTab('history')}>
              <ArrowLeft size={15} /> Back to History
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', padding: '0 24px', flexShrink: 0
      }}>
        {[{ key: 'history', label: 'Return History' }, { key: 'new', label: 'Process Return' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              fontSize: '0.875rem', marginBottom: -1, fontFamily: 'var(--font-sans)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'history' && (
          <ReturnHistoryView
            returns={filtered}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            onSelectReturn={setSelectedReturn}
            onRefresh={loadReturns}
          />
        )}
        {tab === 'new' && (
          <NewReturnForm
            onSaved={() => {
              loadReturns()
              setTab('history')
            }}
          />
        )}
      </div>

      {selectedReturn && (
        <ReturnDetailModal ret={selectedReturn} onClose={() => setSelectedReturn(null)} />
      )}
    </div>
  )
}

// ============================================================
// RETURN HISTORY VIEW
// ============================================================
function ReturnHistoryView({
  returns, loading, search, onSearchChange, onSelectReturn, onRefresh
}: {
  returns: Return[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onSelectReturn: (r: Return) => void
  onRefresh: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12, alignItems: 'center'
      }}>
        <div className="search-input-wrap" style={{ maxWidth: 320 }}>
          <Search size={14} className="search-icon" />
          <input
            className="form-input search-input"
            placeholder="Search return #, invoice #, reason..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading returns...</div>
        ) : returns.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <RotateCcw size={40} style={{ opacity: 0.2 }} />
            <h3>No Returns Recorded</h3>
            <p>Customer product returns will appear here.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Date</th>
                <th>Invoice Ref</th>
                <th>Customer</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Refund Amount</th>
                <th>Refund Method</th>
                <th>Processed By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {returns.map(ret => (
                <tr key={ret.id}>
                  <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{ret.return_number}</span></td>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{ret.date}</td>
                  <td>
                    {ret.invoice_number ? (
                      <span className="font-mono text-xs">{ret.invoice_number}</span>
                    ) : '—'}
                  </td>
                  <td>{ret.customer_name || 'Walk-in'}</td>
                  <td>
                    <span className="badge badge-neutral">{ret.reason}</span>
                  </td>
                  <td className="col-currency" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                    - {fmt(ret.refund_amount)}
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                      {ret.refund_method}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {ret.processed_by_name || 'Staff'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => onSelectReturn(ret)}
                      title="View Return Details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// NEW RETURN FORM
// ============================================================
function NewReturnForm({ onSaved }: { onSaved: () => void }) {
  const { currentUser } = useAuth()
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null)
  const [searching, setSearching] = useState(false)
  const [items, setItems] = useState<ReturnLineSelection[]>([])
  const [reason, setReason] = useState('Defective / Damaged')
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank' | 'storecredit'>('cash')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLookupInvoice = async () => {
    if (!invoiceQuery.trim()) return
    setSearching(true)
    // Query invoice list or search
    const allInvoices = await window.api.getInvoicesByRange('2024-01-01', new Date().toISOString().slice(0, 10))
    const match = allInvoices.find(i =>
      i.invoice_number.toLowerCase() === invoiceQuery.trim().toLowerCase()
    )

    if (match) {
      if (match.status === 'refunded') {
        toast.error(`Invoice "${match.invoice_number}" has ALREADY BEEN REFUNDED and cannot be refunded again.`, { duration: 4000 })
        setFoundInvoice(null)
        setItems([])
        setSearching(false)
        return
      }
      if (match.status === 'voided') {
        toast.error(`Invoice "${match.invoice_number}" is VOIDED and cannot be refunded.`, { duration: 4000 })
        setFoundInvoice(null)
        setItems([])
        setSearching(false)
        return
      }

      const full = await window.api.getInvoiceById(match.id)
      if (full) {
        setFoundInvoice(full)
        setItems((full.items || []).map(i => ({
          item_id: i.item_id,
          item_name: i.item_name || 'Item',
          part_number: i.part_number || '',
          qty_sold: i.qty,
          qty_to_return: 1,
          unit_price: i.unit_price,
          line_total: i.unit_price,
          restocked: true,
          selected: false
        })))
      }
    } else {
      toast.error(`Invoice "${invoiceQuery}" not found`)
    }
    setSearching(false)
  }

  const toggleItem = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.item_id !== itemId) return item
      const selected = !item.selected
      return { ...item, selected }
    }))
  }

  const updateQty = (itemId: string, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.item_id !== itemId) return item
      const validQty = Math.max(1, Math.min(qty, item.qty_sold))
      return {
        ...item,
        qty_to_return: validQty,
        line_total: validQty * item.unit_price
      }
    }))
  }

  const toggleRestock = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.item_id === itemId ? { ...item, restocked: !item.restocked } : item
    ))
  }

  const selectedLines = items.filter(i => i.selected)
  const totalRefund = selectedLines.reduce((s, i) => s + i.line_total, 0)

  const handleSubmitReturn = async () => {
    if (selectedLines.length === 0) {
      toast.error('Select at least one item to return')
      return
    }

    setSubmitting(true)
    const result = await window.api.createReturn(currentUser!.id, {
      invoice_id: foundInvoice?.id,
      reason,
      refund_method: refundMethod,
      refund_amount: totalRefund,
      notes: notes || undefined,
      items: selectedLines.map(i => ({
        item_id: i.item_id,
        qty: i.qty_to_return,
        unit_price: i.unit_price,
        line_total: i.line_total,
        restocked: i.restocked
      }))
    })

    if (result.success && result.data) {
      toast.success(`Return ${result.data.return_number} processed. Stock updated.`)
      onSaved()
    } else {
      toast.error(result.error || 'Failed to process return')
    }
    setSubmitting(false)
  }

  return (
    <div className="page-body" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 48 }}>
      {/* 1. Invoice Lookup */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <FileText size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">1. Search Original Invoice</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input form-input-lg"
              placeholder="Enter Invoice # (e.g. AD-240818-0001)"
              value={invoiceQuery}
              onChange={e => setInvoiceQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookupInvoice()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-lg" onClick={handleLookupInvoice} disabled={searching}>
              <Search size={16} /> {searching ? 'Searching...' : 'Lookup Invoice'}
            </button>
          </div>

          {foundInvoice && (
            <div style={{
              marginTop: 16, padding: 14, background: 'var(--color-surface-2)',
              borderRadius: 8, display: 'flex', gap: 24, flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>INVOICE #</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{foundInvoice.invoice_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>DATE</div>
                <div>{foundInvoice.date}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>CUSTOMER</div>
                <div style={{ fontWeight: 600 }}>{foundInvoice.customer_name || 'Walk-in'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>ORIGINAL TOTAL</div>
                <div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{fmt(foundInvoice.grand_total)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Select Items to Return */}
      {foundInvoice && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <RotateCcw size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">2. Select Items to Return</span>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Item</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Qty Sold</th>
                    <th style={{ textAlign: 'center', width: 120 }}>Qty to Return</th>
                    <th style={{ textAlign: 'right', width: 120 }}>Unit Price</th>
                    <th style={{ textAlign: 'right', width: 120 }}>Refund Total</th>
                    <th style={{ textAlign: 'center', width: 120 }}>Restock?</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.item_id}
                      style={{ background: item.selected ? 'var(--color-primary-10)' : undefined }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItem(item.item_id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.part_number}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty_sold}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          max={item.qty_sold}
                          value={item.qty_to_return}
                          onChange={e => updateQty(item.item_id, parseInt(e.target.value) || 1)}
                          disabled={!item.selected}
                          style={{ width: 70, textAlign: 'center', margin: '0 auto' }}
                        />
                      </td>
                      <td className="col-currency">{fmt(item.unit_price)}</td>
                      <td className="col-currency" style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                        {item.selected ? fmt(item.line_total) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8125rem' }}>
                          <input
                            type="checkbox"
                            checked={item.restocked}
                            onChange={() => toggleRestock(item.item_id)}
                            disabled={!item.selected}
                          />
                          <span>Add to Stock</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Reason & Refund Details */}
          <div className="card">
            <div className="card-header">
              <CheckCircle2 size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">3. Reason & Refund Details</span>
            </div>
            <div className="card-body">
              <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Return Reason</label>
                  <select className="form-select" value={reason} onChange={e => setReason(e.target.value)}>
                    <option value="Defective / Damaged">Defective / Damaged</option>
                    <option value="Wrong Size / Fitting">Wrong Size / Fitting</option>
                    <option value="Customer Mind Change">Customer Mind Change</option>
                    <option value="Color Difference">Color Difference</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Refund Method</label>
                  <select className="form-select" value={refundMethod} onChange={e => setRefundMethod(e.target.value as typeof refundMethod)}>
                    <option value="cash">Cash Refund</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="storecredit">Store Credit</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <input className="form-input" placeholder="Additional details..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 16, borderTop: '1px solid var(--color-border)'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>TOTAL REFUND AMOUNT</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                    {fmt(totalRefund)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {selectedLines.filter(i => i.restocked).length} item(s) will be returned to inventory
                  </div>
                </div>

                <button
                  className="btn btn-danger btn-lg"
                  onClick={handleSubmitReturn}
                  disabled={submitting || selectedLines.length === 0}
                >
                  <RotateCcw size={16} />
                  {submitting ? 'Processing...' : 'Complete Return & Restock'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// RETURN DETAIL MODAL
// ============================================================
function ReturnDetailModal({ ret, onClose }: { ret: Return; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <RotateCcw size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Return: {ret.return_number}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Date', value: ret.date },
              { label: 'Invoice #', value: ret.invoice_number || '—' },
              { label: 'Customer', value: ret.customer_name || 'Walk-in' },
              { label: 'Reason', value: ret.reason },
              { label: 'Refund Method', value: ret.refund_method },
              { label: 'Refund Amount', value: fmt(ret.refund_amount), color: 'var(--color-danger)' },
            ].map(r => (
              <div key={r.label} style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{r.label}</div>
                <div style={{ fontWeight: 700, color: r.color || 'inherit' }}>{r.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>Returned Items:</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Restocked</th>
              </tr>
            </thead>
            <tbody>
              {(ret.items || []).map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.part_number}</div>
                  </td>
                  <td className="col-number">{item.qty}</td>
                  <td className="col-currency">{fmt(item.unit_price)}</td>
                  <td className="col-currency" style={{ fontWeight: 700 }}>{fmt(item.line_total)}</td>
                  <td>
                    <span className={`badge ${item.restocked ? 'badge-success' : 'badge-neutral'}`}>
                      {item.restocked ? '✓ Restocked' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
