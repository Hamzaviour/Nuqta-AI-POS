import React, { useState, useEffect } from 'react'
import {
  Edit3, Trash2, Plus, Minus, CheckCircle, X, Search,
  DollarSign, User, AlertTriangle, ShieldCheck, Tag
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Invoice, InvoiceItem, Item, Customer, UpdateInvoiceInput } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface EditableItemRow {
  item_id: string
  name: string
  part_number: string
  qty: number
  unit_price: number
  cost_price: number
  discount_pct: number
}

interface EditInvoiceModalProps {
  invoice: Invoice
  onSaved: (updated: Invoice) => void
  onClose: () => void
}

export function EditInvoiceModal({ invoice, onSaved, onClose }: EditInvoiceModalProps) {
  const { currentUser, isOwner, canViewCostPrice, canViewProfit } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState<EditableItemRow[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [customerId, setCustomerId] = useState<string>(invoice.customer_id || '')
  const [paymentMethod, setPaymentMethod] = useState<Invoice['payment_method']>(invoice.payment_method || 'cash')
  const [discountAmount, setDiscountAmount] = useState<string>(String(invoice.discount_amount || 0))
  const [amountPaid, setAmountPaid] = useState<string>(String(invoice.amount_paid || 0))
  const [notes, setNotes] = useState<string>(invoice.notes || '')
  const [selectedAddItem, setSelectedAddItem] = useState<string>('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [fullInv, catalogItems, custList] = await Promise.all([
          window.api.getInvoiceById(invoice.id),
          window.api.getAllItems(),
          window.api.getAllCustomers()
        ])

        if (fullInv && fullInv.items) {
          setItems(
            fullInv.items.map(it => ({
              item_id: it.item_id,
              name: it.item_name || 'Product',
              part_number: it.part_number || '',
              qty: it.qty,
              unit_price: it.unit_price,
              cost_price: it.cost_price || 0,
              discount_pct: it.discount_pct || 0
            }))
          )
          setCustomerId(fullInv.customer_id || '')
          setPaymentMethod(fullInv.payment_method || 'cash')
          setDiscountAmount(String(fullInv.discount_amount || 0))
          setAmountPaid(String(fullInv.amount_paid || 0))
          setNotes(fullInv.notes || '')
        }
        setAllItems(catalogItems || [])
        setCustomers(custList || [])
      } catch (err) {
        toast.error('Failed to load invoice details')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [invoice.id])

  // Calculations
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const lineDiscounts = items.reduce((s, i) => s + (i.qty * i.unit_price * (i.discount_pct || 0) / 100), 0)
  const invDiscount = parseFloat(discountAmount) || 0
  const totalDiscount = lineDiscounts + invDiscount
  const grandTotal = Math.max(0, subtotal - totalDiscount)
  const costTotal = items.reduce((s, i) => s + (i.qty * i.cost_price), 0)
  const profit = grandTotal - costTotal
  const paidVal = parseFloat(amountPaid) || 0
  const balanceDue = Math.max(0, grandTotal - paidVal)

  // Item modifications
  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty <= 0) return
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, qty: newQty } : it))
  }

  const handlePriceChange = (index: number, newPrice: number) => {
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, unit_price: Math.max(0, newPrice) } : it))
  }

  const handleDiscountPctChange = (index: number, newDisc: number) => {
    setItems(prev => prev.map((it, idx) => idx === index ? { ...it, discount_pct: Math.min(100, Math.max(0, newDisc)) } : it))
  }

  const handleDeleteItem = (index: number) => {
    if (items.length === 1) {
      toast.error('An invoice must have at least one product. Void the invoice instead if you want to cancel it.')
      return
    }
    setItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleAddNewItem = () => {
    if (!selectedAddItem) return
    const prod = allItems.find(p => p.id === selectedAddItem)
    if (!prod) return

    // Check if already in list
    const existingIndex = items.findIndex(it => it.item_id === prod.id)
    if (existingIndex >= 0) {
      handleQtyChange(existingIndex, items[existingIndex].qty + 1)
      toast.success(`Increased quantity for ${prod.name}`)
    } else {
      setItems(prev => [
        ...prev,
        {
          item_id: prod.id,
          name: prod.name,
          part_number: prod.part_number,
          qty: 1,
          unit_price: prod.retail_price,
          cost_price: prod.cost_price || 0,
          discount_pct: 0
        }
      ])
      toast.success(`Added ${prod.name}`)
    }
    setSelectedAddItem('')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error('Invoice must contain at least one item')
      return
    }

    if (!currentUser) return
    setSaving(true)

    const payload: UpdateInvoiceInput = {
      customer_id: customerId || null,
      payment_method: paymentMethod,
      discount_amount: invDiscount,
      amount_paid: paidVal,
      notes: notes.trim() || null,
      items: items.map(it => ({
        item_id: it.item_id,
        qty: it.qty,
        unit_price: it.unit_price,
        cost_price: it.cost_price,
        discount_pct: it.discount_pct,
        line_total: Math.max(0, (it.qty * it.unit_price) - (it.qty * it.unit_price * (it.discount_pct / 100)))
      }))
    }

    const res = await window.api.updateInvoice(currentUser.id, invoice.id, payload)
    setSaving(false)

    if (res.success && res.data) {
      toast.success(`Invoice ${invoice.invoice_number} updated and saved successfully!`, { duration: 4500 })
      onSaved(res.data)
      onClose()
    } else {
      toast.error(res.error || 'Failed to update invoice')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal modal-xl"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 950, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Edit3 size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <span className="modal-title">Edit Invoice: {invoice.invoice_number}</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Owner Correction Mode · Stock & Account figures will be automatically reconciled upon saving
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading invoice details...
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Top Banner Notice */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 8, color: '#A16207', fontSize: '0.8125rem'
              }}>
                <ShieldCheck size={16} />
                <span>
                  <strong>Owner Authorization:</strong> Any changes made to item quantities, prices, or discounts will update inventory stock counts and financial reports automatically.
                </span>
              </div>

              {/* Items Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Products in this Invoice ({items.length})</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-select form-select-sm"
                      value={selectedAddItem}
                      onChange={e => setSelectedAddItem(e.target.value)}
                      style={{ width: 260, fontSize: '0.8125rem' }}
                    >
                      <option value="">+ Add product from catalog...</option>
                      {allItems.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} ({prod.part_number}) — Rs. {prod.retail_price}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddNewItem}
                      disabled={!selectedAddItem}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item Name / SKU</th>
                        <th style={{ width: 130, textAlign: 'center' }}>Qty</th>
                        <th style={{ width: 130, textAlign: 'right' }}>Unit Price (Rs.)</th>
                        {(isOwner || canViewCostPrice) && <th style={{ width: 110, textAlign: 'right' }}>Cost (Rs.)</th>}
                        <th style={{ width: 100, textAlign: 'center' }}>Disc %</th>
                        <th style={{ width: 130, textAlign: 'right' }}>Line Total</th>
                        <th style={{ width: 50, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const lineGross = it.qty * it.unit_price
                        const lineDisc = lineGross * (it.discount_pct / 100)
                        const lineTotal = Math.max(0, lineGross - lineDisc)

                        return (
                          <tr key={idx}>
                            <td style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{it.name}</div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {it.part_number}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => handleQtyChange(idx, it.qty - 1)}
                                  disabled={it.qty <= 1}
                                  style={{ padding: '2px 6px' }}
                                >
                                  <Minus size={11} />
                                </button>
                                <input
                                  type="number"
                                  className="form-input form-input-sm"
                                  value={it.qty}
                                  min={1}
                                  onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 1)}
                                  style={{ width: 52, textAlign: 'center', padding: '4px', fontWeight: 700 }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => handleQtyChange(idx, it.qty + 1)}
                                  style={{ padding: '2px 6px' }}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                value={it.unit_price}
                                min={0}
                                onChange={e => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}
                              />
                            </td>
                            {(isOwner || canViewCostPrice) && (
                              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {fmt(it.cost_price)}
                              </td>
                            )}
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                value={it.discount_pct || ''}
                                min={0}
                                max={100}
                                placeholder="0%"
                                onChange={e => handleDiscountPctChange(idx, parseFloat(e.target.value) || 0)}
                                style={{ textAlign: 'center', padding: '4px 4px' }}
                              />
                            </td>
                            <td className="col-currency" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                              {fmt(lineTotal)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-danger"
                                onClick={() => handleDeleteItem(idx)}
                                title="Remove item"
                                style={{ padding: '4px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Customer, Payment, & Notes Settings */}
              <div className="grid-3" style={{ gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer</label>
                  <select
                    className="form-select form-select-sm"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || c.whatsapp || 'No contact'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Method</label>
                  <select
                    className="form-select form-select-sm"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="bank">📱 Bank / Digital (JazzCash / EasyPaisa)</option>
                    <option value="credit">📑 Credit</option>
                    <option value="split">🔄 Split</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Amount Paid (Rs.)</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-primary"
                      style={{ padding: '0 4px', fontSize: '0.6875rem' }}
                      onClick={() => setAmountPaid(String(grandTotal))}
                    >
                      Full ({fmt(grandTotal)})
                    </button>
                  </div>
                  <input
                    type="number"
                    className="form-input form-input-sm"
                    value={amountPaid}
                    min={0}
                    onChange={e => setAmountPaid(e.target.value)}
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Overall Bill Discount (Rs.)</label>
                  <input
                    type="number"
                    className="form-input form-input-sm"
                    value={discountAmount}
                    min={0}
                    onChange={e => setDiscountAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Correction Reason / Notes</label>
                  <input
                    className="form-input form-input-sm"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Corrected quantity from 3 to 2"
                  />
                </div>
              </div>

              {/* Financial Calculation Summary Strip */}
              <div style={{
                padding: '12px 16px', background: 'var(--color-surface-2)',
                borderRadius: 10, border: '1.5px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Subtotal</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(subtotal)}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Discounts</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                    - {fmt(totalDiscount)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>New Grand Total</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                    {fmt(grandTotal)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Paid Amount</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                    {fmt(paidVal)}
                  </div>
                </div>

                {balanceDue > 0 && (
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Remaining Due</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                      {fmt(balanceDue)}
                    </div>
                  </div>
                )}

                {(isOwner || canViewProfit) && (
                  <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 12 }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>🔒 Net Margin</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                      {fmt(profit)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || items.length === 0}
                style={{ fontWeight: 700 }}
              >
                <CheckCircle size={15} />
                {saving ? 'Updating & Saving...' : 'Save & Update Invoice'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
