import React, { useState, useEffect } from 'react'
import { useStoreName } from '../../hooks/useStoreName'
import {
  MessageSquare, Search, Filter, Truck, CheckCircle2, Clock,
  AlertCircle, ExternalLink, RefreshCw, Send, User, Phone, MapPin, Package, RotateCcw
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Invoice } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function OrdersPage() {
  const storeName = useStoreName()
  const { currentUser, can } = useAuth()
  const [orders, setOrders] = useState<Invoice[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'dispatched' | 'completed' | 'refunded'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Invoice | null>(null)
  const [trackingModal, setTrackingModal] = useState<Invoice | null>(null)
  const [trackingInput, setTrackingInput] = useState('')
  const [returnOrder, setReturnOrder] = useState<Invoice | null>(null)

  const loadOrders = async () => {
    setLoading(true)
    const data = await window.api.getOnlineOrders(statusFilter)
    setOrders(data)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const handleUpdateStatus = async (invoiceId: string, newStatus: string, trackingNumber?: string) => {
    const result = await window.api.updateInvoiceStatus(currentUser!.id, invoiceId, newStatus, trackingNumber)
    if (result.success) {
      toast.success(`Order status updated to "${newStatus}"`)
      loadOrders()
      if (selectedOrder?.id === invoiceId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as typeof prev.status, tracking_number: trackingNumber || prev.tracking_number } : null)
      }
    } else {
      toast.error(result.error || 'Failed to update status')
    }
  }

  const handleSendWhatsApp = (order: Invoice) => {
    const phone = (order as unknown as { customer_phone?: string }).customer_phone || order.online_customer_contact || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')

    const itemList = (order.items || [])
      .map(i => `• ${i.item_name || 'Item'} (${i.part_number || ''}) x${i.qty} = Rs. ${i.line_total.toLocaleString()}`)
      .join('\n')

    const message = `*${storeName} — Order Details* 👗\n` +
      `Invoice #: *${order.invoice_number}*\n` +
      `Date: ${order.date}\n` +
      `Status: *${order.status.toUpperCase()}*\n` +
      (order.tracking_number ? `Tracking #: *${order.tracking_number}*\n` : '') +
      `\n*Items:*\n${itemList}\n\n` +
      `Subtotal: Rs. ${order.subtotal.toLocaleString()}\n` +
      (order.discount_amount > 0 ? `Discount: -Rs. ${order.discount_amount.toLocaleString()}\n` : '') +
      `*Total Amount: Rs. ${order.grand_total.toLocaleString()}*\n\n` +
      `Thank you for shopping with ${storeName}!`

    const encoded = encodeURIComponent(message)
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`

    window.open(url, '_blank')
  }

  const filtered = orders.filter(o =>
    o.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (o.online_customer_contact && o.online_customer_contact.includes(search)) ||
    (o.tracking_number && o.tracking_number.toLowerCase().includes(search.toLowerCase()))
  )

  const statusConfig = {
    pending: { label: 'Pending', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: Clock },
    confirmed: { label: 'Confirmed', color: '#2563EB', bg: '#EFF6FF', icon: CheckCircle2 },
    dispatched: { label: 'Dispatched', color: '#7C3AED', bg: '#F5F3FF', icon: Truck },
    completed: { label: 'Delivered', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle2 },
    refunded: { label: 'Refunded', color: '#DC2626', bg: '#FEE2E2', icon: RotateCcw },
    voided: { label: 'Cancelled', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', icon: AlertCircle }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <MessageSquare size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Online & WhatsApp Orders</h3>
          <div className="page-header-subtitle">Manage orders from social media, WhatsApp & phone channels</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={loadOrders}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', padding: '12px 24px',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexShrink: 0
      }}>
        {/* Status Pill Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8, flexWrap: 'wrap' }}>
          {(['all', 'pending', 'confirmed', 'dispatched', 'completed', 'refunded'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: statusFilter === tab ? '#fff' : 'transparent',
                color: statusFilter === tab ? (tab === 'refunded' ? '#DC2626' : 'var(--color-primary)') : 'var(--color-text-secondary)',
                fontWeight: statusFilter === tab ? 700 : 500,
                fontSize: '0.8125rem', cursor: 'pointer',
                boxShadow: statusFilter === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab !== 'all' && (
                <span style={{
                  marginLeft: 6, padding: '1px 6px', borderRadius: 10,
                  fontSize: '0.6875rem', background: 'var(--color-surface-2)',
                  color: tab === 'refunded' ? '#DC2626' : 'var(--color-text-muted)',
                  fontWeight: 700
                }}>
                  {orders.filter(o => o.status === tab).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div className="search-input-wrap" style={{ maxWidth: 280 }}>
          <Search size={14} className="search-icon" />
          <input
            className="form-input search-input"
            placeholder="Search invoice, customer, tracking..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main split view: List on left, Detail on right */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Orders Table */}
        <div style={{ flex: 1, overflow: 'auto', borderRight: '1px solid var(--color-border)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <MessageSquare size={40} style={{ opacity: 0.2 }} />
              <h3>No Online Orders Found</h3>
              <p>Online & WhatsApp sales recorded from POS will appear here for order processing.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th>Tracking #</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const cfg = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
                  const isSelected = selectedOrder?.id === order.id
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--color-primary-10)' : undefined
                      }}
                    >
                      <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{order.invoice_number}</span></td>
                      <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {order.date}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customer_name || 'Online Customer'}</div>
                        {order.online_customer_contact && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{order.online_customer_contact}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {order.source === 'whatsapp' ? '💬 WhatsApp' : '📱 Social Media'}
                        </span>
                      </td>
                      <td className="col-currency" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        {fmt(order.grand_total)}
                      </td>
                      <td>
                        <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontWeight: 700 }}>
                          <cfg.icon size={11} style={{ marginRight: 4 }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td>
                        {order.tracking_number ? (
                          <span className="font-mono text-xs" style={{ color: '#7C3AED', fontWeight: 600 }}>
                            {order.tracking_number}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleSendWhatsApp(order)}
                            title="Share on WhatsApp"
                            style={{ color: '#16A34A' }}
                          >
                            <Send size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => { setTrackingModal(order); setTrackingInput(order.tracking_number || '') }}
                            title="Update Tracking"
                          >
                            <Truck size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected Order Quick Action Drawer */}
        {selectedOrder ? (
          <div style={{
            width: 380, background: 'var(--color-surface)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
            overflowY: 'auto'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Order Details</div>
                <div style={{ fontWeight: 800, fontSize: '1.125rem', fontFamily: 'var(--font-mono)' }}>
                  {selectedOrder.invoice_number}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Customer Info Card */}
              <div style={{ background: 'var(--color-surface-2)', padding: 14, borderRadius: 10 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Customer Information
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <User size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 600 }}>{selectedOrder.customer_name || 'Walk-in / Online'}</span>
                </div>
                {selectedOrder.online_customer_contact && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <Phone size={13} />
                    <span>{selectedOrder.online_customer_contact}</span>
                  </div>
                )}
              </div>

              {/* Status Alert if Refunded or Voided */}
              {selectedOrder.status === 'refunded' && (
                <div style={{
                  background: '#FEE2E2',
                  border: '1.5px solid #DC2626',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}>
                  <RotateCcw size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.875rem' }}>
                      Order Already Refunded
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: 2 }}>
                      A return/refund has been processed for this order. It is locked and cannot be refunded again.
                    </div>
                  </div>
                </div>
              )}

              {/* Status Pipeline Buttons */}
              {selectedOrder.status !== 'refunded' && selectedOrder.status !== 'voided' ? (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                    Pipeline Stage
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      className={`btn btn-sm ${selectedOrder.status === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'pending')}
                    >
                      <Clock size={13} /> Pending
                    </button>
                    <button
                      className={`btn btn-sm ${selectedOrder.status === 'confirmed' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                    >
                      <CheckCircle2 size={13} /> Confirmed
                    </button>
                    <button
                      className={`btn btn-sm ${selectedOrder.status === 'dispatched' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setTrackingModal(selectedOrder); setTrackingInput(selectedOrder.tracking_number || '') }}
                    >
                      <Truck size={13} /> Dispatched
                    </button>
                    <button
                      className={`btn btn-sm ${selectedOrder.status === 'completed' ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                    >
                      <CheckCircle2 size={13} /> Delivered
                    </button>
                  </div>
                </div>
              ) : null}

              {/* WhatsApp Invoice Direct Share */}
              <button
                className="btn btn-success btn-full"
                onClick={() => handleSendWhatsApp(selectedOrder)}
                style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
              >
                <Send size={15} /> Send Invoice to WhatsApp
              </button>

              {/* Refund / Return Action (Only available if NOT refunded and NOT voided) */}
              {can('process_return') && selectedOrder.status !== 'refunded' && selectedOrder.status !== 'voided' && (
                <button
                  className="btn btn-secondary btn-full"
                  onClick={() => setReturnOrder(selectedOrder)}
                  style={{ display: 'flex', gap: 8, justifyContent: 'center', color: 'var(--color-danger)' }}
                >
                  <RotateCcw size={15} /> Process Return / Refund
                </button>
              )}

              {/* Items List */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                  Items Ordered ({(selectedOrder.items || []).length})
                </div>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {(selectedOrder.items || []).map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '8px 12px', borderBottom: '1px solid var(--color-border)',
                        display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                          {item.part_number} · Qty: {item.qty}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {fmt(item.line_total)}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    padding: '10px 12px', background: 'var(--color-surface-2)',
                    display: 'flex', justifyContent: 'space-between', fontWeight: 700
                  }}>
                    <span>Grand Total</span>
                    <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                      {fmt(selectedOrder.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Courier Tracking Modal */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Truck size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="modal-title">Courier Tracking Details</span>
              <button className="modal-close" onClick={() => setTrackingModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                Enter the Courier Tracking Number (e.g. TCS, Leopards, Trax, PostEx) for order <strong>{trackingModal.invoice_number}</strong>:
              </p>
              <div className="form-group">
                <label className="form-label">Tracking Number / Consignment #</label>
                <input
                  className="form-input form-input-lg"
                  placeholder="e.g. TCS-789012345"
                  value={trackingInput}
                  onChange={e => setTrackingInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTrackingModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleUpdateStatus(trackingModal.id, 'dispatched', trackingInput)
                  setTrackingModal(null)
                }}
              >
                Save & Mark Dispatched
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Refund Modal */}
      {returnOrder && (
        <ReturnOrderModal
          order={returnOrder}
          onClose={() => setReturnOrder(null)}
          onCompleted={() => {
            setReturnOrder(null)
            setSelectedOrder(null)
            loadOrders()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// RETURN / REFUND ONLINE ORDER MODAL
// ============================================================
function ReturnOrderModal({
  order, onClose, onCompleted
}: {
  order: Invoice
  onClose: () => void
  onCompleted: () => void
}) {
  const { currentUser } = useAuth()
  const [returnQty, setReturnQty] = useState<{ [itemId: string]: number }>({})
  const [reason, setReason] = useState<'wrong_size' | 'defective' | 'customer_change_mind' | 'not_as_described' | 'exchange' | 'other'>('wrong_size')
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank' | 'storecredit'>('cash')
  const [restock, setRestock] = useState(true)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  // Initialize return quantities
  useEffect(() => {
    const map: { [id: string]: number } = {}
    ;(order.items || []).forEach(item => {
      map[item.id] = item.qty
    })
    setReturnQty(map)
  }, [order])

  const totalRefundAmount = (order.items || []).reduce((sum, item) => {
    const q = returnQty[item.id] || 0
    return sum + (item.unit_price * q)
  }, 0)

  const handleProcessReturn = async () => {
    const itemsToReturn = (order.items || [])
      .filter(item => (returnQty[item.id] || 0) > 0)
      .map(item => ({
        invoice_item_id: item.id,
        item_id: item.item_id,
        qty: returnQty[item.id],
        unit_price: item.unit_price,
        line_total: item.unit_price * returnQty[item.id],
        restocked: restock
      }))

    if (itemsToReturn.length === 0) {
      toast.error('Please specify at least 1 item to return')
      return
    }

    setProcessing(true)
    const result = await window.api.createReturn(currentUser!.id, {
      invoice_id: order.id,
      customer_id: order.customer_id || null,
      refund_amount: totalRefundAmount,
      refund_method: refundMethod,
      reason,
      restock_items: restock,
      notes,
      items: itemsToReturn
    })

    if (result.success) {
      toast.success(`Refund of ${fmt(totalRefundAmount)} processed successfully!`)
      onCompleted()
    } else {
      toast.error(result.error || 'Failed to process return')
    }
    setProcessing(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <RotateCcw size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Process Return & Refund — {order.invoice_number}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Select Items to Return & Quantities
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Return Qty</th>
                    <th style={{ textAlign: 'right' }}>Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map(item => {
                    const q = returnQty[item.id] || 0
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                            Ordered: {item.qty}
                          </div>
                        </td>
                        <td className="col-currency">{fmt(item.unit_price)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            max={item.qty}
                            className="form-input"
                            value={q}
                            onChange={e => {
                              const val = Math.max(0, Math.min(item.qty, parseInt(e.target.value) || 0))
                              setReturnQty(prev => ({ ...prev, [item.id]: val }))
                            }}
                            style={{ width: 60, textAlign: 'center', padding: '4px 6px', margin: '0 auto' }}
                          />
                        </td>
                        <td className="col-currency font-bold" style={{ color: 'var(--color-primary)' }}>
                          {fmt(item.unit_price * q)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Return Reason</label>
              <select
                className="form-select"
                value={reason}
                onChange={e => setReason(e.target.value as typeof reason)}
              >
                <option value="wrong_size">Wrong Size</option>
                <option value="defective">Defective / Damaged Fabric</option>
                <option value="customer_change_mind">Customer Changed Mind</option>
                <option value="not_as_described">Not as Described in Post</option>
                <option value="exchange">Exchange with Other Item</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Refund Method</label>
              <select
                className="form-select"
                value={refundMethod}
                onChange={e => setRefundMethod(e.target.value as typeof refundMethod)}
              >
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank Transfer</option>
                <option value="storecredit">Store Credit</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface-2)', padding: '10px 14px', borderRadius: 8 }}>
            <input
              type="checkbox"
              id="restock-toggle"
              checked={restock}
              onChange={e => setRestock(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="restock-toggle" style={{ fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
              Automatically restock returned items back to active inventory
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Courier return package received by Hassan"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'var(--color-danger-bg)', borderRadius: 8
          }}>
            <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>Total Refund Amount:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
              {fmt(totalRefundAmount)}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={handleProcessReturn}
            disabled={processing || totalRefundAmount === 0}
          >
            <RotateCcw size={15} /> {processing ? 'Processing...' : 'Confirm Return & Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}
