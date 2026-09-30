import React, { useState, useEffect } from 'react'
import {
  Store, BookOpen, Plus, Search, Calendar, FileText, ArrowUpRight,
  ArrowDownLeft, DollarSign, RefreshCw, Eye, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Users, Truck
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Account, JournalEntry, LedgerRow, ProfitAndLossReport,
  DailyEntryRow, Customer, Supplier, PartyStatementReport
} from '../../types'
import { QuickAddSupplierModal } from '../Stock/StockPage'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function AccountsPage() {
  const { currentUser, can } = useAuth()
  const [tab, setTab] = useState<'chart' | 'ledger' | 'journal' | 'custpay' | 'suppay' | 'pnl' | 'statements'>('chart')

  if (!currentUser || !can('view_accounts')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <Store size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <h3>Access Denied</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            You do not have permission to view Financial Accounts and Ledgers.
            Contact the Owner to enable <code>perm_view_accounts</code>.
          </p>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'chart', label: 'Chart of Accounts' },
    { key: 'ledger', label: 'Account Ledger' },
    { key: 'journal', label: 'Journal Entries' },
    { key: 'custpay', label: 'Customer Payments' },
    { key: 'suppay', label: 'Supplier Payments' },
    { key: 'statements', label: 'Party Statements' },
    { key: 'pnl', label: 'Trading P&L' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header">
        <Store size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Accounts & Financial Ledger</h3>
          <div className="page-header-subtitle">Double-entry accounting, customer/supplier balances & P&L statements</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', padding: '0 24px', flexShrink: 0,
        overflowX: 'auto'
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              padding: '12px 18px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              fontSize: '0.8125rem', marginBottom: -1, whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'chart' && <ChartOfAccountsView />}
        {tab === 'ledger' && <AccountLedgerView />}
        {tab === 'journal' && <JournalEntriesView />}
        {tab === 'custpay' && <CustomerPaymentsView />}
        {tab === 'suppay' && <SupplierPaymentsView />}
        {tab === 'statements' && <PartyStatementsView />}
        {tab === 'pnl' && <ProfitAndLossView />}
      </div>
    </div>
  )
}

// ============================================================
// 1. CHART OF ACCOUNTS VIEW
// ============================================================
function ChartOfAccountsView() {
  const { currentUser } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<'asset' | 'liability' | 'equity' | 'income' | 'expense'>('expense')
  const [balance, setBalance] = useState('')

  const loadAccounts = async () => {
    setLoading(true)
    const res = await window.api.getAllAccounts(currentUser!.id)
    if (res.success && res.data) {
      setAccounts(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleCreate = async () => {
    if (!name || !code) {
      toast.error('Account Name and Code are required')
      return
    }
    const res = await window.api.createAccount(currentUser!.id, {
      name,
      account_code: code,
      type,
      balance: parseFloat(balance) || 0
    })
    if (res.success) {
      toast.success('Account created successfully')
      setShowModal(false)
      setName('')
      setCode('')
      setBalance('')
      loadAccounts()
    } else {
      toast.error(res.error || 'Failed to create account')
    }
  }

  const grouped = {
    asset: accounts.filter(a => a.type === 'asset'),
    liability: accounts.filter(a => a.type === 'liability'),
    equity: accounts.filter(a => a.type === 'equity'),
    income: accounts.filter(a => a.type === 'income'),
    expense: accounts.filter(a => a.type === 'expense'),
  }

  const typeTitles = {
    asset: 'Assets (Resources Owned)',
    liability: 'Liabilities (Debts & Payables)',
    equity: 'Equity & Capital',
    income: 'Income & Revenue',
    expense: 'Operating Expenses',
  }

  return (
    <div className="page-body" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h4 style={{ fontWeight: 800 }}>Chart of Accounts</h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Overview of standard ledger accounts and running balances
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Add Custom Account
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading accounts...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {(['asset', 'liability', 'income', 'expense', 'equity'] as const).map(t => {
            const accList = grouped[t]
            if (accList.length === 0) return null
            const total = accList.reduce((s, a) => s + a.balance, 0)
            return (
              <div key={t} className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="card-title">{typeTitles[t]}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                    Total: {fmt(total)}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Code</th>
                      <th>Account Name</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Current Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accList.map(a => (
                      <tr key={a.id}>
                        <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{a.account_code}</span></td>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{a.type}</span>
                        </td>
                        <td className="col-currency" style={{ fontWeight: 700 }}>
                          {fmt(a.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Plus size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="modal-title">New General Ledger Account</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Code *</label>
                <input className="form-input" placeholder="e.g. 6005" value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input className="form-input" placeholder="e.g. Marketing & Advertising" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type *</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value as typeof type)}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance (Optional)</label>
                <input className="form-input" type="number" placeholder="0" value={balance} onChange={e => setBalance(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 2. ACCOUNT LEDGER VIEW
// ============================================================
function AccountLedgerView() {
  const { currentUser } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.getAllAccounts(currentUser!.id).then(res => {
      if (res.success && res.data && res.data.length > 0) {
        setAccounts(res.data)
        setSelectedAccountId(res.data[0].id)
      }
    })
  }, [])

  const loadLedger = async () => {
    if (!selectedAccountId) return
    setLoading(true)
    const res = await window.api.getAccountLedger(currentUser!.id, selectedAccountId, fromDate, toDate)
    if (res.success && res.data) {
      setLedger(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLedger()
  }, [selectedAccountId, fromDate, toDate])

  const currentAcc = accounts.find(a => a.id === selectedAccountId)
  const totalDebit = ledger.reduce((s, r) => s + r.debit, 0)
  const totalCredit = ledger.reduce((s, r) => s + r.credit, 0)
  const finalBalance = ledger.length > 0 ? ledger[ledger.length - 1].running_balance : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Controls Bar */}
      <div style={{
        padding: '12px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0
      }}>
        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <select
            className="form-select"
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.account_code} — {a.name} ({a.type})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>From:</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>To:</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadLedger}>
          <RefreshCw size={13} /> Refresh
        </button>

        <div style={{ flex: 1 }} />

        {currentAcc && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>CLOSING BALANCE</div>
              <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {fmt(finalBalance)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading ledger...</div>
        ) : ledger.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <BookOpen size={40} style={{ opacity: 0.2 }} />
            <h3>No Transactions in Selected Period</h3>
            <p>Transactions posted to this account will appear here with running balance.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry #</th>
                <th>Description</th>
                <th>Ref</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(row => (
                <tr key={row.id}>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{row.date}</td>
                  <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{row.entry_number}</span></td>
                  <td>{row.description}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{row.reference || '—'}</td>
                  <td className="col-currency" style={{ color: row.debit > 0 ? 'inherit' : 'var(--color-text-muted)' }}>
                    {row.debit > 0 ? fmt(row.debit) : '—'}
                  </td>
                  <td className="col-currency" style={{ color: row.credit > 0 ? 'inherit' : 'var(--color-text-muted)' }}>
                    {row.credit > 0 ? fmt(row.credit) : '—'}
                  </td>
                  <td className="col-currency" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {fmt(row.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-surface-2)', fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: 'right' }}>Period Totals:</td>
                <td className="col-currency">{fmt(totalDebit)}</td>
                <td className="col-currency">{fmt(totalCredit)}</td>
                <td className="col-currency" style={{ color: 'var(--color-primary)' }}>{fmt(finalBalance)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 3. JOURNAL ENTRIES VIEW
// ============================================================
function JournalEntriesView() {
  const { currentUser } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // New JV Form
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<{ account_id: string; debit: string; credit: string; description: string }[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ])

  const loadData = async () => {
    setLoading(true)
    const [accRes, jRes] = await Promise.all([
      window.api.getAllAccounts(currentUser!.id),
      window.api.getAllJournalEntries(currentUser!.id)
    ])
    if (accRes.success && accRes.data) setAccounts(accRes.data)
    if (jRes.success && jRes.data) setEntries(jRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddLine = () => {
    setLines(prev => [...prev, { account_id: '', debit: '', credit: '', description: '' }])
  }

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const handleLineChange = (idx: number, field: string, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const handleCreateJV = async () => {
    if (!description.trim()) {
      toast.error('Description is required')
      return
    }
    if (!isBalanced) {
      toast.error('Journal entry is out of balance. Debits must equal Credits.')
      return
    }
    if (lines.some(l => !l.account_id)) {
      toast.error('Please select an account for each line')
      return
    }

    const payload = {
      date: entryDate,
      description,
      reference,
      lines: lines.map(l => ({
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || undefined
      }))
    }

    const res = await window.api.createJournalEntry(currentUser!.id, payload)
    if (res.success) {
      toast.success('Journal entry posted successfully')
      setShowModal(false)
      setDescription('')
      setReference('')
      setLines([
        { account_id: '', debit: '', credit: '', description: '' },
        { account_id: '', debit: '', credit: '', description: '' },
      ])
      loadData()
    } else {
      toast.error(res.error || 'Failed to create journal entry')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h4 style={{ fontWeight: 800 }}>General Journal Entries</h4>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Journal Entry (JV)
        </button>
      </div>

      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <FileText size={40} style={{ opacity: 0.2 }} />
            <h3>No Journal Entries</h3>
            <p>Create double-entry journal vouchers to adjust accounts or record expenses.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
            {entries.map(entry => (
              <div key={entry.id} className="card">
                <div style={{
                  padding: '10px 16px', background: 'var(--color-surface-2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="font-mono text-xs" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                      {entry.entry_number}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{entry.date}</span>
                    <span style={{ fontWeight: 600 }}>{entry.description}</span>
                    {entry.reference && (
                      <span className="badge badge-neutral">Ref: {entry.reference}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Posted by {entry.created_by_name || 'Staff'}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Code</th>
                      <th>Account</th>
                      <th>Line Note</th>
                      <th style={{ textAlign: 'right', width: 140 }}>Debit</th>
                      <th style={{ textAlign: 'right', width: 140 }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.lines || []).map(line => (
                      <tr key={line.id}>
                        <td><span className="font-mono text-xs">{line.account_code}</span></td>
                        <td style={{ fontWeight: 600 }}>{line.account_name}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{line.description || '—'}</td>
                        <td className="col-currency">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                        <td className="col-currency">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New JV Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Plus size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="modal-title">New Double-Entry Journal Voucher</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Entry Date *</label>
                  <input type="date" className="form-input" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Narration *</label>
                  <input className="form-input" placeholder="e.g. Monthly shop rent payment" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference # (Optional)</label>
                  <input className="form-input" placeholder="e.g. CHQ-9900" value={reference} onChange={e => setReference(e.target.value)} />
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>Voucher Lines:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1.5 }}
                      value={line.account_id}
                      onChange={e => handleLineChange(idx, 'account_id', e.target.value)}
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.account_code} - {a.name} ({a.type})</option>
                      ))}
                    </select>
                    <input
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="Line memo..."
                      value={line.description}
                      onChange={e => handleLineChange(idx, 'description', e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 110, textAlign: 'right' }}
                      placeholder="Debit"
                      value={line.debit}
                      onChange={e => handleLineChange(idx, 'debit', e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 110, textAlign: 'right' }}
                      placeholder="Credit"
                      value={line.credit}
                      onChange={e => handleLineChange(idx, 'credit', e.target.value)}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={lines.length <= 2}
                      style={{ color: 'var(--color-danger)' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handleAddLine}>
                <Plus size={13} /> Add Line
              </button>

              {/* Balance Summary Box */}
              <div style={{
                marginTop: 16, padding: 12, background: 'var(--color-surface-2)',
                borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    Total Debits: <strong>{fmt(totalDebit)}</strong> | Total Credits: <strong>{fmt(totalCredit)}</strong>
                  </span>
                </div>
                <div>
                  {isBalanced ? (
                    <span className="badge badge-success">✓ Balanced</span>
                  ) : (
                    <span className="badge badge-danger">Out of Balance ({fmt(Math.abs(totalDebit - totalCredit))})</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateJV} disabled={!isBalanced}>
                Post Journal Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 4. CUSTOMER PAYMENTS (RECEIPT VOUCHER)
// ============================================================
function CustomerPaymentsView() {
  const { currentUser } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCustomers = async () => {
    const data = await window.api.getAllCustomers()
    setCustomers(data)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  const handleSubmitPayment = async () => {
    if (!selectedCustomerId) {
      toast.error('Select a customer')
      return
    }
    const payAmount = parseFloat(amount)
    if (!payAmount || payAmount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    setSubmitting(true)
    const res = await window.api.recordCustomerPayment(currentUser!.id, {
      customer_id: selectedCustomerId,
      amount: payAmount,
      method,
      reference,
      notes
    })

    if (res.success) {
      toast.success(`Payment of ${fmt(payAmount)} received from ${selectedCustomer?.name}`)
      setAmount('')
      setReference('')
      setNotes('')
      loadCustomers()
    } else {
      toast.error(res.error || 'Failed to record payment')
    }
    setSubmitting(false)
  }

  return (
    <div className="page-body" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <ArrowDownLeft size={18} style={{ color: 'var(--color-success)' }} />
          <span className="card-title">Customer Payment Receipt (Cash Inflow)</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Record payments received from wholesale/credit customers. This automatically updates Accounts Receivable and posts to Cash / Bank.
          </p>

          <div className="form-group">
            <label className="form-label">Select Customer *</label>
            <select
              className="form-select form-input-lg"
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
            >
              <option value="">-- Choose Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} — Current Balance: {fmt(c.current_balance ?? c.balance ?? 0)}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer && (
            <div style={{
              padding: 14, background: 'var(--color-surface-2)',
              borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>CURRENT DUE BALANCE</div>
                <div style={{
                  fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: (selectedCustomer.current_balance ?? selectedCustomer.balance ?? 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'
                }}>
                  {fmt(selectedCustomer.current_balance ?? selectedCustomer.balance ?? 0)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>CREDIT LIMIT</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(selectedCustomer.credit_limit ?? 0)}</div>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount Received (PKR) *</label>
              <input
                type="number"
                className="form-input form-input-lg"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select className="form-select form-input-lg" value={method} onChange={e => setMethod(e.target.value as typeof method)}>
                <option value="cash">Cash (1001 Cash in Hand)</option>
                <option value="bank">Bank Transfer (1002 Bank Account)</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Cheque / Transaction Ref</label>
              <input className="form-input" placeholder="e.g. TR-998811" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="e.g. Partial settlement for bill #AD-240818-001" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <button
            className="btn btn-success btn-lg btn-full"
            onClick={handleSubmitPayment}
            disabled={submitting || !selectedCustomerId || !amount}
          >
            <ArrowDownLeft size={16} />
            {submitting ? 'Recording...' : 'Record Payment Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 5. SUPPLIER PAYMENTS (PAYMENT VOUCHER)
// ============================================================
function SupplierPaymentsView() {
  const { currentUser } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadSuppliers = async () => {
    const data = await window.api.getAllSuppliers()
    setSuppliers(data)
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  const handleSubmitPayment = async () => {
    if (!selectedSupplierId) {
      toast.error('Select a supplier')
      return
    }
    const payAmount = parseFloat(amount)
    if (!payAmount || payAmount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    setSubmitting(true)
    const res = await window.api.recordSupplierPayment(currentUser!.id, {
      supplier_id: selectedSupplierId,
      amount: payAmount,
      method,
      reference,
      notes
    })

    if (res.success) {
      toast.success(`Payment of ${fmt(payAmount)} to ${selectedSupplier?.name} recorded`)
      setAmount('')
      setReference('')
      setNotes('')
      loadSuppliers()
    } else {
      toast.error(res.error || 'Failed to record supplier payment')
    }
    setSubmitting(false)
  }

  return (
    <div className="page-body" style={{ maxWidth: 800, margin: '0 auto' }}>
      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onSaved={(s) => {
            setSuppliers(prev => [s, ...prev.filter(x => x.id !== s.id)])
            setSelectedSupplierId(s.id)
            setShowAddSupplierModal(false)
          }}
        />
      )}
      <div className="card">
        <div className="card-header">
          <ArrowUpRight size={18} style={{ color: 'var(--color-danger)' }} />
          <span className="card-title">Supplier Payment Voucher (Cash Outflow)</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Record payments to fabric mills and suppliers. This automatically decreases Accounts Payable and credits Cash / Bank.
          </p>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0 }}>Select Supplier *</label>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                style={{ padding: '0 4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                onClick={() => setShowAddSupplierModal(true)}
              >
                <Plus size={11} /> + New Supplier
              </button>
            </div>
            <select
              className="form-select form-input-lg"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — Current Payable: {fmt(s.current_balance ?? s.balance ?? 0)}
                </option>
              ))}
            </select>
          </div>

          {selectedSupplier && (
            <div style={{
              padding: 14, background: 'var(--color-surface-2)',
              borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>PAYABLE BALANCE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                  {fmt(selectedSupplier.current_balance ?? selectedSupplier.balance ?? 0)}
                </div>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Amount Paid (PKR) *</label>
              <input
                type="number"
                className="form-input form-input-lg"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select className="form-select form-input-lg" value={method} onChange={e => setMethod(e.target.value as typeof method)}>
                <option value="cash">Cash (1001 Cash in Hand)</option>
                <option value="bank">Bank Transfer (1002 Bank Account)</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Cheque / Transaction Ref</label>
              <input className="form-input" placeholder="e.g. CHQ-5544" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="e.g. Bill #PO-1002 payment" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <button
            className="btn btn-danger btn-lg btn-full"
            onClick={handleSubmitPayment}
            disabled={submitting || !selectedSupplierId || !amount}
          >
            <ArrowUpRight size={16} />
            {submitting ? 'Recording...' : 'Record Payment Voucher'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 6. TRADING, PROFIT & LOSS STATEMENT
// ============================================================
function ProfitAndLossView() {
  const { currentUser } = useAuth()
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<ProfitAndLossReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPnL = async () => {
    setLoading(true)
    const res = await window.api.getProfitAndLossReport(currentUser!.id, fromDate, toDate)
    if (res.success && res.data) {
      setReport(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPnL()
  }, [fromDate, toDate])

  return (
    <div className="page-body" style={{ maxWidth: 850, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, background: 'var(--color-surface)', padding: '12px 18px',
        borderRadius: 10, border: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Period:</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>to</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadPnL}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Calculating Profit & Loss...</div>
      ) : report ? (
        <div className="card">
          <div className="card-header" style={{ textAlign: 'center', display: 'block', padding: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>MY STORE</h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Trading, Profit & Loss Statement ({report.from_date} to {report.to_date})
            </div>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Trading Account (Gross Profit) */}
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                1. Trading Income
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span>Sales Revenue (Turnover)</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(report.total_revenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <span>Less: Cost of Goods Sold (COGS)</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>- {fmt(report.cost_of_goods_sold)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                background: 'var(--color-surface-2)', borderRadius: 8, marginTop: 8, fontWeight: 800
              }}>
                <span>Gross Profit</span>
                <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontSize: '1.125rem' }}>
                  {fmt(report.gross_profit)}
                </span>
              </div>
            </div>

            {/* 2. Operating Expenses */}
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                2. Operating Expenses
              </div>
              {report.operating_expenses.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                  No operating expense vouchers posted in this period.
                </div>
              ) : (
                report.operating_expenses.map(exp => (
                  <div key={exp.account_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span>{exp.account_name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(exp.amount)}</span>
                  </div>
                ))
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                background: 'var(--color-surface-2)', borderRadius: 8, marginTop: 8, fontWeight: 700
              }}>
                <span>Total Operating Expenses</span>
                <span style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                  - {fmt(report.total_expenses)}
                </span>
              </div>
            </div>

            {/* 3. Net Profit / Loss */}
            <div style={{
              padding: 16, background: report.net_profit >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{
                  fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase',
                  color: report.net_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  Net Profit / (Loss) for Period
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Gross Profit ({fmt(report.gross_profit)}) - Total Expenses ({fmt(report.total_expenses)})
                </div>
              </div>
              <div style={{
                fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
                color: report.net_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {fmt(report.net_profit)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// 7. PARTY STATEMENTS (CUSTOMER & SUPPLIER LEDGERS)
// ============================================================
function PartyStatementsView() {
  const { currentUser } = useAuth()
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [statement, setStatement] = useState<PartyStatementReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      window.api.getAllCustomers(),
      window.api.getAllSuppliers()
    ]).then(([cList, sList]) => {
      setCustomers(cList)
      setSuppliers(sList)
      if (partyType === 'customer' && cList.length > 0) setSelectedId(cList[0].id)
      else if (partyType === 'supplier' && sList.length > 0) setSelectedId(sList[0].id)
    })
  }, [partyType])

  const loadStatement = async () => {
    if (!selectedId) return
    setLoading(true)
    if (partyType === 'customer') {
      const res = await window.api.getCustomerStatement(currentUser!.id, selectedId, fromDate, toDate)
      if (res.success && res.data) setStatement(res.data)
    } else {
      const res = await window.api.getSupplierStatement(currentUser!.id, selectedId, fromDate, toDate)
      if (res.success && res.data) setStatement(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStatement()
  }, [selectedId, fromDate, toDate, partyType])

  const handlePrint = async () => {
    if (window.api && typeof window.api.print === 'function') {
      try {
        await window.api.print({ silent: false, printBackground: true, pageSize: 'A4' })
      } catch {
        window.print()
      }
    } else {
      window.print()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Controls Bar */}
      <div className="no-print" style={{
        padding: '12px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--color-surface-2)', padding: 3, borderRadius: 8 }}>
          <button
            onClick={() => { setPartyType('customer'); if (customers.length > 0) setSelectedId(customers[0].id) }}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 6,
              background: partyType === 'customer' ? '#fff' : 'transparent',
              color: partyType === 'customer' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: partyType === 'customer' ? 700 : 500, fontSize: '0.8125rem', cursor: 'pointer'
            }}
          >
            Customer Statement
          </button>
          <button
            onClick={() => { setPartyType('supplier'); if (suppliers.length > 0) setSelectedId(suppliers[0].id) }}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 6,
              background: partyType === 'supplier' ? '#fff' : 'transparent',
              color: partyType === 'supplier' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: partyType === 'supplier' ? 700 : 500, fontSize: '0.8125rem', cursor: 'pointer'
            }}
          >
            Supplier Statement
          </button>
        </div>

        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <select
            className="form-select"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {partyType === 'customer' ? (
              customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            ) : (
              suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
            )}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>From:</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>To:</span>
          <input type="date" className="form-input" style={{ width: 140 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadStatement}>
          <RefreshCw size={13} /> Refresh
        </button>

        <div style={{ flex: 1 }} />

        <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={!statement}>
          Print Statement
        </button>
      </div>

      {/* Statement Sheet */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading statement...</div>
        ) : statement ? (
          <div className="card" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ padding: 24, borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--color-primary)' }}>MY STORE</h2>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    Wholesale & Retail
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    STATEMENT OF ACCOUNT
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{statement.from_date} to {statement.to_date}</div>
                </div>
              </div>

              <div style={{
                marginTop: 20, padding: 14, background: 'var(--color-surface-2)',
                borderRadius: 8, display: 'flex', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {statement.party_type === 'customer' ? 'Customer Account' : 'Supplier Account'}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{statement.party_name}</div>
                  {statement.party_phone && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Contact: {statement.party_phone}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {statement.party_type === 'customer' ? 'Net Due Balance' : 'Net Payable Balance'}
                  </div>
                  <div style={{
                    fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
                    color: statement.closing_balance > 0 ? 'var(--color-danger)' : 'var(--color-success)'
                  }}>
                    {fmt(statement.closing_balance)}
                  </div>
                </div>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref #</th>
                  <th>Transaction Description</th>
                  <th style={{ textAlign: 'right' }}>{statement.party_type === 'customer' ? 'Billed (Debit)' : 'Paid (Debit)'}</th>
                  <th style={{ textAlign: 'right' }}>{statement.party_type === 'customer' ? 'Received (Credit)' : 'Purchased (Credit)'}</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)' }}>
                      No transactions recorded for this period.
                    </td>
                  </tr>
                ) : (
                  statement.rows.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td><span className="font-mono text-xs" style={{ fontWeight: 700 }}>{row.ref_number}</span></td>
                      <td>{row.description}</td>
                      <td className="col-currency">{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                      <td className="col-currency">{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                      <td className="col-currency" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {fmt(row.running_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--color-surface-2)', fontWeight: 800 }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>Totals:</td>
                  <td className="col-currency">{fmt(statement.total_debit)}</td>
                  <td className="col-currency">{fmt(statement.total_credit)}</td>
                  <td className="col-currency" style={{ color: 'var(--color-primary)' }}>{fmt(statement.closing_balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
