import React, { useState, useEffect, useMemo } from 'react'
import {
  Clock, Search, Filter, RefreshCw, DollarSign, User, Phone,
  CheckCircle2, Printer, Send, CreditCard, ChevronRight, Eye,
  AlertCircle, ArrowRight, Wallet, ShoppingCart, MessageCircle, RotateCcw, Edit3
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { Invoice, User as AppUser } from '../../types'
import { ReceiptPreviewModal } from '../../components/common/ReceiptPreviewModal'
import { EditInvoiceModal } from '../../components/common/EditInvoiceModal'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function PendingInvoicesPage() {
  const navigate = useNavigate()
  const { currentUser, isOwner, canEditInvoice } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'instore' | 'whatsapp' | 'socialmedia'>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)

  // Payment Collection Modal State
  const [payModal, setPayModal] = useState<Invoice | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'bank'>('cash')
  const [payNotes, setPayNotes] = useState<string>('')
  const [payBankProvider, setPayBankProvider] = useState<'JazzCash' | 'EasyPaisa' | 'Other Bank'>('JazzCash')
  const [payOtherBank, setPayOtherBank] = useState<string>('')
  const [payBankRef, setPayBankRef] = useState<string>('')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string>('')

  // Receipt Modal State
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null)

  const loadPendingInvoices = async () => {
    setLoading(true)
    try {
      if (window.api && typeof window.api.getPendingInvoices === 'function') {
        const data = await window.api.getPendingInvoices(currentUser?.id, search)
        setInvoices(data || [])
      } else {
        // Fallback to range search for pending
        const all = await window.api.getInvoicesByRange('2020-01-01', new Date().toISOString().slice(0, 10))
        const pendingList = (all || []).filter(i => (i.status === 'pending' || (i.balance_due && i.balance_due > 0)) && i.status !== 'voided' && i.status !== 'refunded')
        setInvoices(pendingList)
      }
    } catch (err) {
      console.error('Error fetching pending invoices:', err)
      toast.error('Failed to load pending invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingInvoices()
  }, [search])

  // Filter by channel
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (channelFilter !== 'all' && inv.source !== channelFilter) return false
      return true
    })
  }, [invoices, channelFilter])

  // Financial summary metrics
  const totalPendingInvoices = filteredInvoices.length
  const totalPendingBalance = filteredInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
  const totalCollectedAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)
  const totalGrandAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0)

  // Open Payment Modal
  const handleOpenPayModal = (inv: Invoice) => {
    setPayModal(inv)
    setPayAmount(inv.balance_due ? String(inv.balance_due) : String(inv.grand_total))
    setPayMethod('cash')
    setPayNotes('')
    setPayBankProvider('JazzCash')
    setPayOtherBank('')
    setPayBankRef('')
    setPayError('')
  }

  // Submit Payment Collection
  const handleCollectPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!payModal || !currentUser) return

    const amt = parseFloat(payAmount)
    if (isNaN(amt) || amt <= 0) {
      setPayError('Please enter a valid payment amount (greater than 0).')
      return
    }
    if (amt > payModal.balance_due) {
      setPayError(`Payment cannot exceed pending balance of ${fmt(payModal.balance_due)}.`)
      return
    }

    setPayLoading(true)
    setPayError('')

    try {
      const bankDetails = payMethod === 'bank'
        ? (payBankProvider === 'Other Bank' ? (payOtherBank || 'Other Bank') : payBankProvider) + (payBankRef ? ` (Ref: ${payBankRef})` : '')
        : ''
      const finalNote = [bankDetails, payNotes].filter(Boolean).join(' | ')

      const result = await window.api.recordInvoicePayment(currentUser.id, {
        invoice_id: payModal.id,
        amount: amt,
        method: payMethod,
        notes: finalNote || undefined,
        reference: payBankRef || undefined
      })

      if (result.success && result.data) {
        const updatedInv = result.data
        const remaining = updatedInv.balance_due
        if (remaining <= 0) {
          toast.success(`Invoice ${updatedInv.invoice_number} is now FULLY PAID!`, { icon: '🎉', duration: 4000 })
        } else {
          toast.success(`Collected ${fmt(amt)} for ${updatedInv.invoice_number}. Remaining: ${fmt(remaining)}`, { duration: 4000 })
        }

        setPayModal(null)
        loadPendingInvoices()
        setReceiptInvoice(updatedInv)
      } else {
        setPayError(result.error || 'Failed to record payment.')
      }
    } catch (err) {
      console.error(err)
      setPayError(String(err))
    } finally {
      setPayLoading(false)
    }
  }

  // Send WhatsApp Reminder
  const handleSendWhatsAppReminder = (inv: Invoice) => {
    const phone = inv.customer_phone || inv.customer_whatsapp || inv.online_customer_contact || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')

    const itemList = (inv.items || [])
      .map((it, idx) => `${idx + 1}. ${it.item_name || 'Item'} x${it.qty} = Rs. ${it.line_total.toLocaleString()}`)
      .join('\n')

    const message =
      `*PAYMENT REMINDER* 🛍️\n` +
      `----------------------------------------\n` +
      `Invoice #: *${inv.invoice_number}*\n` +
      `Date: ${inv.date}\n` +
      `Customer: *${inv.customer_name || 'Valued Customer'}*\n\n` +
      (itemList ? `*Purchased Items:*\n${itemList}\n\n` : '') +
      `Total Bill: *Rs. ${inv.grand_total.toLocaleString()}*\n` +
      `Amount Paid: *Rs. ${(inv.amount_paid || 0).toLocaleString()}*\n` +
      `*PENDING BALANCE DUE: Rs. ${(inv.balance_due || 0).toLocaleString()}*\n` +
      `----------------------------------------\n` +
      `Please settle the outstanding balance at your earliest convenience.\n` +
      `Thank you for your purchase!`

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`

    window.open(url, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.12)', color: '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <h3 className="page-header-title">Pending Invoices & Dues</h3>
            <div className="page-header-subtitle">
              Manage partially paid and pending customer bills, collect remaining amounts, and print receipts
            </div>
          </div>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadPendingInvoices} title="Refresh pending list">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/pos')} style={{ gap: 6 }}>
            <ShoppingCart size={14} /> POS Terminal <span className="hotkey" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>F1</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div style={{
        padding: '12px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        {/* Card 1: Pending Invoices Count */}
        <div style={{
          background: 'var(--color-surface-2)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Pending Invoices
            </span>
            <Clock size={15} style={{ color: '#D97706' }} />
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#D97706' }}>
            {totalPendingInvoices}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Unsettled balance bills
          </div>
        </div>

        {/* Card 2: Total Pending Dues */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid rgba(245, 158, 11, 0.35)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
              Total Pending Dues
            </span>
            <Wallet size={15} style={{ color: '#D97706' }} />
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#D97706' }}>
            {fmt(totalPendingBalance)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#B45309', marginTop: 2 }}>
            To be collected from customers
          </div>
        </div>

        {/* Card 3: Collected Amount */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid rgba(16, 185, 129, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
              Partial Collected
            </span>
            <CheckCircle2 size={15} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
            {fmt(totalCollectedAmount)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#047857', marginTop: 2 }}>
            Cash/Bank already received
          </div>
        </div>

        {/* Card 4: Total Grand Value */}
        <div style={{
          background: 'var(--color-surface-2)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total Value of Bills
            </span>
            <DollarSign size={15} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
            {fmt(totalGrandAmount)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Cumulative sales value
          </div>
        </div>
      </div>

      {/* Search & Channel Filter Bar */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by invoice #, customer name, or phone number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Channel Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Channel:</span>
          <div className="btn-group">
            {(['all', 'instore', 'whatsapp', 'socialmedia'] as const).map(ch => (
              <button
                key={ch}
                type="button"
                className={`btn btn-sm ${channelFilter === ch ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setChannelFilter(ch)}
                style={{ fontSize: '0.75rem' }}
              >
                {ch === 'all' ? 'All Channels' : ch === 'instore' ? '🏪 In-Store' : ch === 'whatsapp' ? '💬 WhatsApp' : '📱 Social'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: 'var(--color-primary)' }} />
            Loading pending invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="empty-state" style={{ padding: 60, textAlign: 'center' }}>
            <CheckCircle2 size={48} style={{ color: '#10B981', margin: '0 auto 12px', display: 'block' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {search ? 'No Matching Pending Invoices' : '🎉 All Invoices Settled!'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: 460, margin: '6px auto 16px' }}>
              {search
                ? `No pending invoice matches "${search}". Try searching with a different invoice number or customer name.`
                : 'There are currently no outstanding or pending invoice balances in the system.'}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/pos')} style={{ margin: '0 auto' }}>
              <ShoppingCart size={15} /> Go to POS Terminal
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Invoice #</th>
                  <th style={{ width: 120 }}>Date & Time</th>
                  <th>Customer</th>
                  <th style={{ width: 120 }}>Contact</th>
                  <th style={{ width: 100 }}>Channel</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Total (Rs.)</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Paid (Rs.)</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Pending (Rs.)</th>
                  <th style={{ width: 220, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const custName = inv.customer_name || 'Walk-in Customer'
                  const custPhone = inv.customer_phone || inv.customer_whatsapp || inv.online_customer_contact || ''
                  const pendingAmt = inv.balance_due || 0
                  const paidAmt = inv.amount_paid || 0

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* Invoice Number */}
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: 'var(--color-primary)',
                          background: 'var(--color-primary-10)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-primary-20)',
                          fontSize: '0.8125rem'
                        }}>
                          {inv.invoice_number}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        <div>{inv.date}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                          {inv.datetime_created ? inv.datetime_created.slice(11, 16) : ''}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                          {custName}
                        </div>
                        {inv.staff_name && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                            Cashier: {inv.staff_name}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {custPhone ? (
                          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                            {custPhone}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Channel */}
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: '0.6875rem', textTransform: 'capitalize' }}>
                          {inv.source === 'whatsapp' ? '💬 WhatsApp' : inv.source === 'socialmedia' ? '📱 Social' : '🏬 In-Store'}
                        </span>
                      </td>

                      {/* Total */}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {fmt(inv.grand_total)}
                      </td>

                      {/* Paid */}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#16A34A' }}>
                        {fmt(paidAmt)}
                      </td>

                      {/* Pending Balance */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 900,
                          fontSize: '0.875rem',
                          color: '#D97706',
                          background: 'rgba(245, 158, 11, 0.12)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {fmt(pendingAmt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {/* Pay Remaining Balance */}
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleOpenPayModal(inv)}
                            style={{ fontWeight: 700, padding: '4px 8px', fontSize: '0.75rem', gap: 4 }}
                            title="Collect remaining or partial payment"
                          >
                            <DollarSign size={13} /> Pay Balance
                          </button>

                          {/* Print Receipt */}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setReceiptInvoice(inv)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="View and print POS thermal receipt"
                          >
                            <Printer size={13} />
                          </button>

                          {/* Edit Invoice (Owner / Authorized) */}
                          {(isOwner || canEditInvoice) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditInvoice(inv)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              title="Edit / Correct this invoice"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}

                          {/* WhatsApp Reminder */}
                          {custPhone && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSendWhatsAppReminder(inv)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#16A34A' }}
                              title="Send WhatsApp payment reminder"
                            >
                              <Send size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* COLLECT PAYMENT MODAL */}
      {/* ============================================================ */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)} style={{ zIndex: 1050 }}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ background: 'var(--color-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.15)', color: '#D97706',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Wallet size={18} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 800 }}>
                    Collect Balance — {payModal.invoice_number}
                  </span>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    Customer: <strong>{payModal.customer_name || 'Walk-in'}</strong> · Total Bill: {fmt(payModal.grand_total)}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}>✕</button>
            </div>

            <form onSubmit={handleCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
              {/* Financial summary strip */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                background: 'var(--color-surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Total Bill</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{fmt(payModal.grand_total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Already Paid</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: '#16A34A' }}>{fmt(payModal.amount_paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#D97706', fontWeight: 700 }}>Pending Balance</div>
                  <div style={{ fontWeight: 900, fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: '#D97706' }}>{fmt(payModal.balance_due)}</div>
                </div>
              </div>

              {/* Payment Amount Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                    Payment Amount to Collect (Rs.)*
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setPayAmount(String(payModal.balance_due))}
                      style={{ fontSize: '0.6875rem', padding: '2px 6px' }}
                    >
                      Full Balance ({fmt(payModal.balance_due)})
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={payModal.balance_due}
                  className="form-input form-input-lg"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Enter amount..."
                  autoFocus
                  required
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    border: '2px solid var(--color-warning)'
                  }}
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>
                  Payment Method*
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'cash', label: '💵 Cash Register' },
                    { id: 'bank', label: '🏦 Bank / Wallet' },
                    { id: 'card', label: '💳 Card' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`btn ${payMethod === m.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setPayMethod(m.id as 'cash' | 'card' | 'bank')}
                      style={{ fontWeight: 700 }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Provider Options if Bank */}
              {payMethod === 'bank' && (
                <div style={{
                  padding: '10px 12px', background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {(['JazzCash', 'EasyPaisa', 'Other Bank'] as const).map(bp => (
                      <button
                        key={bp}
                        type="button"
                        className={`btn btn-xs ${payBankProvider === bp ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPayBankProvider(bp)}
                        style={{ fontSize: '0.6875rem' }}
                      >
                        {bp === 'JazzCash' ? '🟠 JazzCash' : bp === 'EasyPaisa' ? '🟢 EasyPaisa' : '🏦 Other Bank'}
                      </button>
                    ))}
                  </div>

                  {payBankProvider === 'Other Bank' && (
                    <input
                      className="form-input form-input-sm"
                      placeholder="Bank Name (e.g. Meezan, HBL, Allied)"
                      value={payOtherBank}
                      onChange={e => setPayOtherBank(e.target.value)}
                    />
                  )}

                  <input
                    className="form-input form-input-sm"
                    placeholder="Transaction Reference / Sender Phone"
                    value={payBankRef}
                    onChange={e => setPayBankRef(e.target.value)}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                  Payment Notes (Optional)
                </label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  placeholder="e.g. Paid in shop by customer"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>

              {payError && (
                <div style={{
                  padding: '8px 12px', background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600
                }}>
                  {payError}
                </div>
              )}

              <div style={{
                padding: '12px 16px', background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', margin: '0 -20px -20px -20px'
              }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayModal(null)} disabled={payLoading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-warning"
                  disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0}
                  style={{ fontWeight: 800, minWidth: 160 }}
                >
                  {payLoading ? 'Collecting...' : `Collect ${fmt(parseFloat(payAmount) || 0)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FULL RECEIPT PREVIEW MODAL */}
      {/* ============================================================ */}
      {receiptInvoice && (
        <ReceiptPreviewModal
          invoiceNumber={receiptInvoice.invoice_number}
          total={receiptInvoice.grand_total}
          subtotal={receiptInvoice.subtotal}
          discountAmount={receiptInvoice.discount_amount}
          historyItems={receiptInvoice.items}
          customerName={receiptInvoice.customer_name}
          customerPhone={receiptInvoice.customer_phone || receiptInvoice.customer_whatsapp || receiptInvoice.online_customer_contact}
          userName={currentUser?.name}
          staffName={receiptInvoice.staff_name || currentUser?.name}
          paymentMethod={receiptInvoice.payment_method}
          paymentDetails={receiptInvoice.notes}
          amountPaid={receiptInvoice.amount_paid}
          balanceDue={receiptInvoice.balance_due}
          dateStr={receiptInvoice.date}
          timeStr={receiptInvoice.datetime_created ? receiptInvoice.datetime_created.slice(11, 19) : undefined}
          status={receiptInvoice.status}
          onClose={() => setReceiptInvoice(null)}
        />
      )}

      {/* ============================================================ */}
      {/* EDIT INVOICE MODAL */}
      {/* ============================================================ */}
      {editInvoice && (
        <EditInvoiceModal
          invoice={editInvoice}
          onSaved={() => {
            setEditInvoice(null)
            loadPendingInvoices()
          }}
          onClose={() => setEditInvoice(null)}
        />
      )}
    </div>
  )
}
