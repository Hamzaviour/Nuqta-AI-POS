import React, { useState, useEffect } from 'react'
import {
  Lock, Unlock, DollarSign, Calendar, AlertTriangle, CheckCircle2,
  FileText, Users, Calculator, RefreshCw, Eye, ShieldAlert,
  Smartphone, MessageSquare, Send, Copy, ExternalLink
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { DayCloseCalculation, DayClose, MobileServerInfo } from '../../types'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function DayClosePage() {
  const { currentUser, canDayClose } = useAuth()
  const [tab, setTab] = useState<'today' | 'history'>('today')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [calc, setCalc] = useState<DayCloseCalculation | null>(null)
  const [history, setHistory] = useState<DayClose[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [mobileInfo, setMobileInfo] = useState<MobileServerInfo | null>(null)
  const [sendingWa, setSendingWa] = useState(false)

  // Currency Denomination counts
  const [denominations, setDenominations] = useState<{ [val: number]: number }>({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  })
  const [looseCash, setLooseCash] = useState('')

  const [historyPreset, setHistoryPreset] = useState<'all' | 'today' | '7d' | 'month' | 'custom'>('all')
  const [historyFrom, setHistoryFrom]     = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [historyTo, setHistoryTo]         = useState(new Date().toISOString().slice(0, 10))

  const loadCalculation = async () => {
    setLoading(true)
    const res = await window.api.calculateDayClose(currentUser!.id, date)
    if (res.success && res.data) {
      setCalc(res.data)
    }
    setLoading(false)
  }

  const loadHistory = async () => {
    const res = await window.api.getDayCloses(currentUser!.id)
    if (res.success && res.data) {
      setHistory(res.data)
    }
  }

  const loadMobileInfo = async () => {
    try {
      const res = await window.api.getMobileServerInfo()
      if (res.success && res.data) {
        setMobileInfo(res.data)
      }
    } catch (_) {}
  }

  useEffect(() => {
    loadMobileInfo()
  }, [])

  const handleSendWhatsApp = async (targetDate?: string) => {
    setSendingWa(true)
    const d = targetDate || date
    const res = await window.api.sendWhatsAppDayClose(d, true)
    if (res.success) {
      toast.success(`WhatsApp Day Close summary prepared for ${d}!`)
    } else {
      toast.error(res.error || 'Failed to dispatch WhatsApp message')
    }
    setSendingWa(false)
  }

  useEffect(() => {
    if (tab === 'today') loadCalculation()
    else loadHistory()
  }, [date, tab])

  // Filtered history calculations
  const todayStr = new Date().toISOString().slice(0, 10)
  const filteredHistory = history.filter(dc => {
    if (historyPreset === 'all') return true
    let start = historyFrom
    let end = historyTo
    if (historyPreset === 'today') {
      start = todayStr
      end = todayStr
    } else if (historyPreset === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    } else if (historyPreset === 'month') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      end = todayStr
    }
    return dc.date >= start && dc.date <= end
  })

  const historyTotalSales    = filteredHistory.reduce((s, dc) => s + (dc.total_sales || 0), 0)
  const historyExpectedCash  = filteredHistory.reduce((s, dc) => s + (dc.expected_cash || 0), 0)
  const historyCountedCash   = filteredHistory.reduce((s, dc) => s + (dc.counted_cash || 0), 0)
  const historyNetVariance   = filteredHistory.reduce((s, dc) => s + (dc.variance || 0), 0)

  if (!canDayClose) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <Lock size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <h3>Access Denied</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            You do not have permission to access Day Closing & Cash Reconciliation.
            Contact the Owner to enable <code>perm_day_closing</code>.
          </p>
        </div>
      </div>
    )
  }

  // Denominations math
  const countedTotal = Object.entries(denominations).reduce((sum, [val, count]) => {
    return sum + (parseInt(val) * (count || 0))
  }, 0) + (parseFloat(looseCash) || 0)

  const variance = calc ? countedTotal - calc.expected_cash : 0

  const handleDenomChange = (value: number, count: number) => {
    setDenominations(prev => ({ ...prev, [value]: Math.max(0, count) }))
  }

  const handleSubmitClose = async () => {
    if (!calc) return
    if (calc.is_already_closed) {
      toast.error('Day is already closed and locked.')
      return
    }

    if (variance !== 0) {
      const confirm = window.confirm(`There is a cash variance of ${fmt(variance)}. Are you sure you want to proceed with closing?`)
      if (!confirm) return
    }

    setSubmitting(true)
    const result = await window.api.submitDayClose(currentUser!.id, {
      date: calc.date,
      total_sales: calc.total_sales,
      total_discounts: calc.total_discounts,
      total_returns: calc.total_returns,
      total_profit: calc.total_profit,
      cash_sales: calc.cash_sales,
      card_sales: calc.card_sales,
      bank_sales: calc.bank_sales,
      expected_cash: calc.expected_cash,
      counted_cash: countedTotal,
      staff_breakdown: calc.staff_breakdown,
      notes: notes || undefined
    })

    if (result.success) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        })
      } catch (_) {}
      toast.success(`Day close for ${date} signed & locked successfully!`)
      loadCalculation()
    } else {
      toast.error(result.error || 'Failed to submit Day Close')
    }
    setSubmitting(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header">
        <Lock size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Day Closing & Cash Reconciliation</h3>
          <div className="page-header-subtitle">Reconcile cash drawer, lock daily invoices & audit sales</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', padding: '0 24px', flexShrink: 0
      }}>
        {[{ key: 'today', label: 'Close Register & Reconcile' }, { key: 'history', label: 'Past Day Closings' }].map(t => (
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
        {tab === 'today' && (
          <div className="page-body" style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Date Selector & Lock Banner */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
              <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadCalculation}>
                <RefreshCw size={13} /> Refresh
              </button>

              {calc?.is_already_closed && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                  background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                  borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem'
                }}>
                  <Lock size={15} /> DAY CLOSED & INVOICES LOCKED
                </div>
              )}

              {/* WhatsApp Share Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSendWhatsApp(date)}
                disabled={sendingWa}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', borderColor: 'rgba(37, 211, 102, 0.3)' }}
              >
                <MessageSquare size={14} />
                {sendingWa ? 'Sending...' : '📱 WhatsApp Report'}
              </button>

              {/* Mobile Remote Info Pill */}
              {mobileInfo?.primaryUrl && (
                <a
                  href={mobileInfo.primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--color-primary)' }}
                  title="Open Mobile Companion on this PC or scan from phone"
                >
                  <Smartphone size={14} /> 📱 Mobile Remote Portal
                </a>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Calculating daily figures...</div>
            ) : calc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. PRIMARY SUMMARY: Where Your Money Is (Simple & Clear) */}
                <div className="card" style={{ padding: '18px 20px', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        💰 Daily Money Reconciliation (Where Today's Money Is)
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Exact breakdown of physical cash collected in drawer and money in all digital accounts for {calc.date}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                      borderRadius: 10, background: 'var(--color-surface-2)', border: '1.5px solid var(--color-primary-30)'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total Money Accounted For:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                        {fmt((calc.expected_cash || 0) + (calc.bank_sales || 0) + (calc.card_sales || 0))}
                      </span>
                    </div>
                  </div>

                  {/* 5 Location Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12
                  }}>
                    {/* 1. In Cash Drawer */}
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1.5px solid rgba(34, 197, 94, 0.35)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
                            💵 In Drawer
                          </span>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 4, background: '#16A34A', color: '#fff', fontWeight: 700 }}>
                            Physical Cash
                          </span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803D', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.expected_cash)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#166534', marginTop: 8, borderTop: '1px dashed rgba(34, 197, 94, 0.3)', paddingTop: 6 }}>
                        Sales: {fmt(calc.cash_sales)} {calc.cash_expenses ? ` - Exp: ${fmt(calc.cash_expenses)}` : ''} {calc.total_returns ? ` - Ret: ${fmt(calc.total_returns)}` : ''}
                      </div>
                    </div>

                    {/* 2. In JazzCash */}
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'rgba(225, 29, 72, 0.08)',
                      border: '1.5px solid rgba(225, 29, 72, 0.3)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#BE123C', textTransform: 'uppercase' }}>
                            🟠 In JazzCash
                          </span>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 4, background: '#E11D48', color: '#fff', fontWeight: 700 }}>
                            Mobile Wallet
                          </span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#BE123C', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.jazzcash_sales || 0)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#9F1239', marginTop: 8, borderTop: '1px dashed rgba(225, 29, 72, 0.3)', paddingTop: 6 }}>
                        Check JazzCash Account
                      </div>
                    </div>

                    {/* 3. In EasyPaisa */}
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'rgba(5, 150, 105, 0.08)',
                      border: '1.5px solid rgba(5, 150, 105, 0.3)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                            🟢 In EasyPaisa
                          </span>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 4, background: '#059669', color: '#fff', fontWeight: 700 }}>
                            Mobile Wallet
                          </span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.easypaisa_sales || 0)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#065F46', marginTop: 8, borderTop: '1px dashed rgba(5, 150, 105, 0.3)', paddingTop: 6 }}>
                        Check EasyPaisa Account
                      </div>
                    </div>

                    {/* 4. In Other Bank Accounts */}
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'rgba(37, 99, 235, 0.08)',
                      border: '1.5px solid rgba(37, 99, 235, 0.3)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' }}>
                            🏦 In Bank Accounts
                          </span>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 4, background: '#2563EB', color: '#fff', fontWeight: 700 }}>
                            Bank Transfer
                          </span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1D4ED8', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.other_bank_sales || 0)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#1E40AF', marginTop: 8, borderTop: '1px dashed rgba(37, 99, 235, 0.3)', paddingTop: 6 }}>
                        Direct Bank Deposits (Meezan, HBL, etc.)
                      </div>
                    </div>

                    {/* 5. Card POS Terminal */}
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'rgba(124, 58, 237, 0.08)',
                      border: '1.5px solid rgba(124, 58, 237, 0.3)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase' }}>
                            💳 Card Terminal
                          </span>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 4, background: '#7C3AED', color: '#fff', fontWeight: 700 }}>
                            POS Machine
                          </span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#6D28D9', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.card_sales || 0)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#5B21B6', marginTop: 8, borderTop: '1px dashed rgba(124, 58, 237, 0.3)', paddingTop: 6 }}>
                        Card Machine Settlements
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-Column: Left (Financial Overview & Staff) | Right (Cash Drawer Verification Tool) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                  {/* Left: Key Stats & Staff Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Summary Metric Cards */}
                    <div className="grid-3" style={{ gap: 12 }}>
                      <div className="card card-body" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Invoiced Sales</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.total_sales)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{calc.invoice_count} Bills Issued</div>
                      </div>

                      <div className="card card-body" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Unpaid / Credit Balance</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706', fontFamily: 'var(--font-mono)' }}>
                          {fmt(calc.total_unpaid || 0)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Pending Customer Balances</div>
                      </div>

                      <div className="card card-body" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Today's Net Profit</div>
                        <div style={{
                          fontSize: '1.25rem', fontWeight: 800,
                          color: (calc.total_profit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {fmt(calc.total_profit || 0)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Recognized Profit on Paid Cash</div>
                      </div>
                    </div>

                    {/* Staff Performance Breakdown */}
                    <div className="card">
                      <div className="card-header">
                        <Users size={16} style={{ color: 'var(--color-primary)' }} />
                        <span className="card-title">Staff Sales Breakdown by Payment Type</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th style={{ textAlign: 'center' }}>Bills</th>
                            <th style={{ textAlign: 'right' }}>Cash</th>
                            <th style={{ textAlign: 'right' }}>Card</th>
                            <th style={{ textAlign: 'right' }}>Bank/Wallet</th>
                            <th style={{ textAlign: 'right' }}>Total Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calc.staff_breakdown.map(staff => (
                            <tr key={staff.user_id}>
                              <td style={{ fontWeight: 600 }}>{staff.name}</td>
                              <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{staff.invoices}</td>
                              <td className="col-currency">{fmt(staff.cash)}</td>
                              <td className="col-currency" style={{ color: '#2563EB' }}>{fmt(staff.card || 0)}</td>
                              <td className="col-currency" style={{ color: '#059669' }}>{fmt(staff.bank || 0)}</td>
                              <td className="col-currency" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                                {fmt(staff.sales)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Cash Drawer Count Tool */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card">
                      <div className="card-header">
                        <Calculator size={16} style={{ color: 'var(--color-primary)' }} />
                        <span className="card-title">Physical Cash Counter (Denominations)</span>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[5000, 1000, 500, 100, 50, 20, 10].map(denom => (
                            <div
                              key={denom}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 10px', background: 'var(--color-surface-2)', borderRadius: 8
                              }}
                            >
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: 70 }}>
                                Rs. {denom}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>x</span>
                                <input
                                  type="number"
                                  className="form-input"
                                  min={0}
                                  value={denominations[denom] || ''}
                                  placeholder="0"
                                  onChange={e => handleDenomChange(denom, parseInt(e.target.value) || 0)}
                                  style={{ width: 75, textAlign: 'center', padding: '4px 8px' }}
                                  disabled={calc.is_already_closed}
                                />
                              </div>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: 90, textAlign: 'right' }}>
                                {fmt(denom * (denominations[denom] || 0))}
                              </span>
                            </div>
                          ))}

                          {/* Loose change */}
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 10px', background: 'var(--color-surface-2)', borderRadius: 8
                          }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Coins / Loose:</span>
                            <input
                              type="number"
                              className="form-input"
                              min={0}
                              value={looseCash}
                              placeholder="0"
                              onChange={e => setLooseCash(e.target.value)}
                              style={{ width: 100, textAlign: 'right', padding: '4px 8px' }}
                              disabled={calc.is_already_closed}
                            />
                          </div>
                        </div>

                        {/* Counted Total vs Variance Box */}
                        <div style={{
                          marginTop: 16, padding: 14, background: 'var(--color-surface-2)',
                          borderRadius: 10, border: '1px solid var(--color-border)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Counted Cash Total:</span>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1.125rem' }}>
                              {fmt(countedTotal)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Variance (Over / Short):</span>
                            <span style={{
                              fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1.125rem',
                              color: variance === 0 ? 'var(--color-success)' : variance > 0 ? '#2563EB' : 'var(--color-danger)'
                            }}>
                              {variance >= 0 ? '+' : ''}{fmt(variance)}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <label className="form-label">Closing Notes</label>
                          <input
                            className="form-input"
                            placeholder="e.g. Counter balanced, Rs. 50 surplus"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            disabled={calc.is_already_closed}
                          />
                        </div>

                        {!calc.is_already_closed && (
                          <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={handleSubmitClose}
                            disabled={submitting}
                            style={{ marginTop: 16 }}
                          >
                            <Lock size={16} />
                            {submitting ? 'Locking...' : 'Sign & Lock Day Closing'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-full"
                          onClick={() => handleSendWhatsApp(calc.date)}
                          disabled={sendingWa}
                          style={{
                            marginTop: 10, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: 8, color: '#16a34a',
                            borderColor: 'rgba(37, 211, 102, 0.3)'
                          }}
                        >
                          <Send size={15} />
                          {sendingWa ? 'Dispatching...' : '📱 Send Summary to Owner WhatsApp'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Filter Bar */}
            <div style={{
              padding: '12px 20px', background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
            }}>
              {/* Presets */}
              <div className="btn-group">
                {(['all', 'today', '7d', 'month', 'custom'] as const).map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${historyPreset === p ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setHistoryPreset(p)}
                  >
                    {p === 'all' ? 'All Past Closes' : p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : p === 'month' ? 'This Month' : 'Custom Period'}
                  </button>
                ))}
              </div>

              {historyPreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" className="form-input form-input-sm" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>to</span>
                  <input type="date" className="form-input form-input-sm" value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
                </div>
              )}

              <button className="btn btn-ghost btn-sm" onClick={loadHistory} title="Refresh History">
                <RefreshCw size={14} />
              </button>

              <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {filteredHistory.length} day closing records
              </span>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Summary KPIs */}
              <div className="grid-4" style={{ gap: 14, marginBottom: 18 }}>
                <div className="kpi-card">
                  <div className="kpi-title">Closed Sales Total</div>
                  <div className="kpi-value text-primary">{fmt(historyTotalSales)}</div>
                  <div className="kpi-subtitle">{filteredHistory.length} closed days</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-title">Expected Drawer Cash</div>
                  <div className="kpi-value" style={{ color: '#60A5FA' }}>{fmt(historyExpectedCash)}</div>
                  <div className="kpi-subtitle">Total expected in cash drawer</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-title">Counted Drawer Cash</div>
                  <div className="kpi-value text-success">{fmt(historyCountedCash)}</div>
                  <div className="kpi-subtitle">Physical cash verified</div>
                </div>

                <div className="kpi-card" style={{ borderColor: historyNetVariance === 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)' }}>
                  <div className="kpi-title">Net Cash Variance</div>
                  <div className={`kpi-value ${historyNetVariance === 0 ? 'text-success' : historyNetVariance > 0 ? 'text-primary' : 'text-danger'}`}>
                    {historyNetVariance >= 0 ? '+' : ''}{fmt(historyNetVariance)}
                  </div>
                  <div className="kpi-subtitle">Cumulative over / short</div>
                </div>
              </div>

              {/* Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {filteredHistory.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <Calendar size={32} style={{ opacity: 0.3 }} />
                    <p>No day close records found for the selected period</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Total Sales</th>
                        <th style={{ textAlign: 'right' }}>Cash</th>
                        <th style={{ textAlign: 'right' }}>Card</th>
                        <th style={{ textAlign: 'right' }}>Bank/Wallet</th>
                        <th style={{ textAlign: 'right' }}>Expected Cash</th>
                        <th style={{ textAlign: 'right' }}>Counted Cash</th>
                        <th style={{ textAlign: 'right' }}>Variance</th>
                        <th>Signed By</th>
                        <th>Signed At</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'center' }}>WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(dc => (
                        <tr key={dc.id}>
                          <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{dc.date}</span></td>
                          <td className="col-currency" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{fmt(dc.total_sales)}</td>
                          <td className="col-currency">{fmt(dc.cash_sales || 0)}</td>
                          <td className="col-currency" style={{ color: '#2563EB' }}>{fmt(dc.card_sales || 0)}</td>
                          <td className="col-currency" style={{ color: '#059669' }}>{fmt(dc.bank_sales || 0)}</td>
                          <td className="col-currency">{fmt(dc.expected_cash)}</td>
                          <td className="col-currency" style={{ fontWeight: 700 }}>{fmt(dc.counted_cash)}</td>
                          <td className="col-currency" style={{
                            color: dc.variance === 0 ? 'var(--color-success)' : dc.variance > 0 ? '#2563EB' : 'var(--color-danger)',
                            fontWeight: 700
                          }}>
                            {dc.variance >= 0 ? '+' : ''}{fmt(dc.variance)}
                          </td>
                          <td><strong>{dc.signed_by_name || 'Owner'}</strong></td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{dc.signed_at}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{dc.notes || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSendWhatsApp(dc.date)}
                              style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#16a34a' }}
                              title="Send Day Close report for this date on WhatsApp"
                            >
                              <MessageSquare size={13} /> Share
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
