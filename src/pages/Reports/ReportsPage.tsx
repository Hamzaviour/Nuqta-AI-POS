import React, { useState, useEffect } from 'react'
import {
  BarChart3, FileText, Users, Calendar, RefreshCw, Download, Clock, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Filter, Search,
  ShoppingBag, Truck, Receipt, Wallet, CreditCard, ChevronRight, Eye,
  Building, AlertTriangle, CheckCircle2, PieChart, Sparkles, Edit3, Activity
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import type {
  DailySaleReport, StaffSalesReport, AgingReportSummary, User,
  ProfitAndLossReport, Expense, Purchase, Invoice, Return, Supplier
} from '../../types'
import { PayStockInvoiceModal } from '../Purchases/PurchasesPage'
import { EditInvoiceModal } from '../../components/common/EditInvoiceModal'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function ReportsPage() {
  const { canViewAllReports, canViewProfit, canViewCostPrice } = useAuth()
  const [tab, setTab] = useState<
    'transactions' | 'daily' | 'staff' | 'purchases' | 'expenses' | 'profit-loss' | 'financial-analytics'
  >('transactions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <BarChart3 size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Reports & Financial Analytics</h3>
          <div className="page-header-subtitle">
            Live transaction summary, daily sales, staff performance, stock invoices, and operating expenses
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px', flexShrink: 0,
        overflowX: 'auto'
      }}>
        {[
          { key: 'transactions', label: 'Transaction Summary', icon: Receipt },
          { key: 'daily', label: 'Daily Sales Report', icon: FileText },
          { key: 'staff', label: 'Staff Performance', icon: Users },
          { key: 'purchases', label: 'Stock & Purchase Invoices', icon: Truck },
          { key: 'expenses', label: 'Expense Report', icon: Wallet },
          { key: 'profit-loss', label: 'Profit & Loss Statement', icon: TrendingUp },
          { key: 'financial-analytics', label: 'Financial Analytics & Charts', icon: Activity },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              padding: '12px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              fontSize: '0.8125rem', transition: 'all 0.15s', marginBottom: -1,
              fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'transactions' && <TransactionSummaryTab />}
        {tab === 'daily' && <DailySaleReportTab />}
        {tab === 'staff' && <StaffSalesReportTab />}
        {tab === 'purchases' && <StockPurchasesReportTab />}
        {tab === 'expenses' && <ExpenseReportTab />}
        {tab === 'profit-loss' && <ProfitLossReportTab />}
        {tab === 'financial-analytics' && <FinancialAnalyticsTab />}
      </div>
    </div>
  )
}

// ============================================================
// 1. TRANSACTIONS SUMMARY & MASTER REGISTER TAB
// ============================================================
function TransactionSummaryTab() {
  const { currentUser, isOwner, canEditInvoice, canViewProfit, canViewCostPrice } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'custom'>('today')
  const [fromDate, setFromDate]   = useState(todayStr)
  const [toDate, setToDate]       = useState(todayStr)
  const [loading, setLoading]     = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'return' | 'expense' | 'purchase' | 'credit-sale' | 'pending-purchase'>('all')
  const [query, setQuery]         = useState('')

  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [returns, setReturns]     = useState<Return[]>([])
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])

  // Modal inspection states
  const [inspectSale, setInspectSale]           = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice]           = useState<Invoice | null>(null)
  const [inspectPurchase, setInspectPurchase]   = useState<Purchase | null>(null)
  const [inspectExpense, setInspectExpense]     = useState<Expense | null>(null)
  const [inspectReturn, setInspectReturn]       = useState<Return | null>(null)
  const [payingPurchase, setPayingPurchase]     = useState<Purchase | null>(null)

  const loadData = async () => {
    setLoading(true)
    let start = fromDate
    let end = toDate

    if (dateRange === 'today') {
      start = todayStr
      end = todayStr
    } else if (dateRange === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    } else if (dateRange === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    }

    try {
      const [invList, expList, purList, retList] = await Promise.all([
        window.api.getInvoicesByRange(start, end),
        window.api.getExpenses(currentUser!.id, start, end),
        window.api.getAllPurchases(currentUser!.id),
        window.api.getAllReturns(currentUser!.id)
      ])

      setInvoices(invList || [])
      setExpenses(expList.data || [])
      setPurchases((purList.data || []).filter(p => p.date >= start && p.date <= end))
      setReturns((retList.data || []).filter(r => r.date >= start && r.date <= end && r.status === 'approved'))
    } catch (err) {
      toast.error('Failed to load transaction data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [dateRange, fromDate, toDate])

  // ==========================================
  // COMPREHENSIVE FINANCIAL & INVOICE ANALYTICS
  // ==========================================
  const completedInvoices = invoices.filter(i => i.status === 'completed')
  const activeInvoices    = invoices.filter(i => i.status !== 'voided' && i.status !== 'refunded')
  const voidedInvoices    = invoices.filter(i => i.status === 'voided')
  const refundedInvoices  = invoices.filter(i => i.status === 'refunded')

  // Sales Invoices Breakdown
  const totalSalesRevenue     = activeInvoices.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalSalesCash        = activeInvoices.filter(i => i.payment_method === 'cash').reduce((s, i) => s + (i.amount_paid || 0), 0)
  const totalSalesCardBank    = activeInvoices.filter(i => i.payment_method === 'card' || i.payment_method === 'bank').reduce((s, i) => s + (i.amount_paid || 0), 0)
  const totalSalesCredit      = activeInvoices.reduce((s, i) => s + (i.balance_due || 0), 0) // Accounts Receivable
  const totalDiscountsGiven   = activeInvoices.reduce((s, i) => s + (i.discount_amount || 0), 0)
  const totalSalesProfit      = activeInvoices.reduce((s, i) => s + (i.profit || 0), 0)
  const totalSalesCost        = activeInvoices.reduce((s, i) => s + (i.cost_total || 0), 0)
  const avgSaleValue          = activeInvoices.length > 0 ? totalSalesRevenue / activeInvoices.length : 0

  // Stock Invoices Breakdown
  const totalPurchasesCost       = purchases.reduce((s, p) => s + (p.total_cost || 0), 0)
  const purchasesPaidFromDrawer  = purchases.filter(p => (p.payment_source || 'drawer') === 'drawer').reduce((s, p) => s + (p.amount_paid || 0), 0)
  const purchasesPaidFromOutside = purchases.filter(p => (p.payment_source || 'drawer') === 'outside').reduce((s, p) => s + (p.amount_paid || 0), 0)
  const purchasesPending         = purchases.reduce((s, p) => s + (p.balance_due || 0), 0) // Accounts Payable
  const paidPurchasesCount       = purchases.filter(p => p.payment_status === 'paid').length
  const pendingPurchasesCount    = purchases.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'partial').length

  // Expenses & Refunds Breakdown
  const totalExpensesAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalRefundsAmount  = returns.reduce((s, r) => s + (r.refund_amount || 0), 0)

  // Net Cash Flow (Drawer cash in hand) = Cash Sales - Expenses - Stock paid from drawer - Cash Refunds
  const netDrawerCashFlow = totalSalesCash - totalExpensesAmount - purchasesPaidFromDrawer - totalRefundsAmount

  // Unified Transaction Structure
  interface UnifiedTx {
    id: string
    date: string
    time?: string
    type: 'sale' | 'return' | 'expense' | 'purchase'
    typeLabel: string
    refNumber: string
    party: string
    description: string
    inflow: number
    outflow: number
    paymentMethod: string
    status: string
    badgeClass: string
    rawSale?: Invoice
    rawPurchase?: Purchase
    rawExpense?: Expense
    rawReturn?: Return
    isCredit?: boolean
    isPendingPayable?: boolean
  }

  const unifiedList: UnifiedTx[] = [
    ...invoices.map(i => ({
      id: `inv-${i.id}`,
      date: i.date,
      time: i.datetime_created?.slice(11, 16),
      type: 'sale' as const,
      typeLabel: i.source === 'whatsapp' || i.source === 'socialmedia' ? `📱 Online Sale [${i.source}]` : '🛒 POS Sale',
      refNumber: i.invoice_number,
      party: i.customer_name || 'Walk-in Customer',
      description: `${(i.items || []).length || 1} items sold${i.discount_amount > 0 ? ` · Disc: ${fmt(i.discount_amount)}` : ''}`,
      inflow: i.grand_total,
      outflow: 0,
      paymentMethod: i.payment_method || 'cash',
      status: i.status === 'completed' ? (i.balance_due > 0 ? 'Credit / Partial' : 'Completed') : i.status,
      badgeClass: i.status === 'completed' ? (i.balance_due > 0 ? 'badge-warning' : 'badge-success') : (i.status === 'refunded' ? 'badge-danger' : 'badge-danger'),
      rawSale: i,
      isCredit: (i.balance_due || 0) > 0
    })),
    ...returns.map(r => ({
      id: `ret-${r.id}`,
      date: r.date,
      time: r.created_at?.slice(11, 16),
      type: 'return' as const,
      typeLabel: '🔄 Customer Refund',
      refNumber: r.return_number,
      party: r.customer_name || 'Customer Return',
      description: r.reason || 'Item return refund',
      inflow: 0,
      outflow: r.refund_amount,
      paymentMethod: r.refund_method || 'cash',
      status: 'Approved',
      badgeClass: 'badge-danger',
      rawReturn: r
    })),
    ...expenses.map(e => ({
      id: `exp-${e.id}`,
      date: e.date,
      time: e.datetime_created?.slice(11, 16),
      type: 'expense' as const,
      typeLabel: `💸 Expense [${e.category}]`,
      refNumber: e.expense_number,
      party: e.payee || e.category,
      description: e.description,
      inflow: 0,
      outflow: e.amount,
      paymentMethod: e.payment_method,
      status: 'Paid',
      badgeClass: 'badge-warning',
      rawExpense: e
    })),
    ...purchases.map(p => ({
      id: `pur-${p.id}`,
      date: p.date,
      time: p.created_at?.slice(11, 16),
      type: 'purchase' as const,
      typeLabel: '📦 Stock Invoice',
      refNumber: p.purchase_number,
      party: p.supplier_name || 'Supplier Purchase',
      description: p.invoice_ref ? `Bill #${p.invoice_ref}` : 'Stock Inflow',
      inflow: 0,
      outflow: p.amount_paid,
      paymentMethod: (p.payment_source || 'drawer') === 'drawer' ? 'Shop Drawer' : 'Outside / Bank',
      status: p.payment_status === 'paid' ? 'Paid' : (p.payment_status === 'partial' ? 'Partial' : 'Pending'),
      badgeClass: p.payment_status === 'paid' ? 'badge-primary' : (p.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'),
      rawPurchase: p,
      isPendingPayable: (p.balance_due || 0) > 0
    }))
  ].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (b.time || '').localeCompare(a.time || '')
  })

  const filteredTx = unifiedList.filter(t => {
    const q = query.toLowerCase()
    const matchesQuery =
      t.refNumber.toLowerCase().includes(q) ||
      t.party.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.typeLabel.toLowerCase().includes(q)

    if (!matchesQuery) return false

    if (typeFilter === 'all') return true
    if (typeFilter === 'credit-sale') return t.type === 'sale' && t.isCredit
    if (typeFilter === 'pending-purchase') return t.type === 'purchase' && t.isPendingPayable
    return t.type === typeFilter
  })

  const openSaleDetail = async (inv: Invoice) => {
    const full = await window.api.getInvoiceById(inv.id)
    setInspectSale(full || inv)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Filter Header */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        {/* Preset buttons */}
        <div className="btn-group">
          {(['today', '7d', '30d', 'custom'] as const).map(r => (
            <button
              key={r}
              className={`btn btn-sm ${dateRange === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDateRange(r)}
            >
              {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Custom Period'}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        <button className="btn btn-ghost btn-sm" onClick={loadData} title="Refresh All Data">
          <RefreshCw size={14} />
        </button>

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {filteredTx.length} total transaction activities
        </span>
      </div>

      {/* Content Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* TOP LEVEL FINANCIAL HERO METRICS */}
        <div className="grid-4" style={{ gap: 14, marginBottom: 18 }}>
          <div className="kpi-card">
            <div className="kpi-title">Gross Sales Invoiced</div>
            <div className="kpi-value text-success">{fmt(totalSalesRevenue)}</div>
            <div className="kpi-subtitle">{activeInvoices.length} active sales · Avg {fmt(avgSaleValue)}</div>
          </div>

          <div className="kpi-card" style={{ borderColor: netDrawerCashFlow >= 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)' }}>
            <div className="kpi-title">Net Drawer Cash Flow</div>
            <div className={`kpi-value ${netDrawerCashFlow >= 0 ? 'text-success' : 'text-danger'}`}>
              {fmt(netDrawerCashFlow)}
            </div>
            <div className="kpi-subtitle">Cash in hand balance impact</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title">Stock Invoices (Total Bill)</div>
            <div className="kpi-value text-primary">{fmt(totalPurchasesCost)}</div>
            <div className="kpi-subtitle">
              Paid: {fmt(purchasesPaidFromDrawer + purchasesPaidFromOutside)} · {purchases.length} POs
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title">Total Operating Expenses</div>
            <div className="kpi-value text-warning">{fmt(totalExpensesAmount)}</div>
            <div className="kpi-subtitle">{expenses.length} expense payouts</div>
          </div>
        </div>

        {/* 3-PILLAR DEEP-DIVE INVOICES ANALYTICS GRID */}
        <div className="grid-3" style={{ gap: 16, marginBottom: 20 }}>
          {/* Pillar 1: Sales & Customer Invoices */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={16} style={{ color: 'var(--color-success)' }} />
                <strong style={{ fontSize: '0.9rem' }}>Sales Invoices Analytics</strong>
              </div>
              <span className="badge badge-success">{invoices.length} Total Invoices</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Cash Collected:</span>
                <strong className="text-success">{fmt(totalSalesCash)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Card & Online Bank:</span>
                <strong style={{ color: '#60A5FA' }}>{fmt(totalSalesCardBank)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Customer Credit (AR Due):</span>
                <strong className="text-danger">{fmt(totalSalesCredit)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Discounts Given:</span>
                <span className="text-warning">{fmt(totalDiscountsGiven)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
                <span className="text-muted">Invoice Status:</span>
                <span>
                  <strong className="text-success">{completedInvoices.length} Paid</strong> ·{' '}
                  <strong className="text-danger">{voidedInvoices.length} Void</strong> ·{' '}
                  <strong className="text-danger">{refundedInvoices.length} Refund</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Pillar 2: Stock & Supplier Purchases */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={16} style={{ color: 'var(--color-primary)' }} />
                <strong style={{ fontSize: '0.9rem' }}>Stock Invoices Analytics</strong>
              </div>
              <span className="badge badge-primary">{purchases.length} Stock Bills</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Total Stock Cost:</span>
                <strong className="text-primary">{fmt(totalPurchasesCost)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Paid from Shop Drawer:</span>
                <strong style={{ color: '#60A5FA' }}>{fmt(purchasesPaidFromDrawer)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Paid from Outside / Bank:</span>
                <strong style={{ color: '#C084FC' }}>{fmt(purchasesPaidFromOutside)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Pending Supplier Debt (AP):</span>
                <strong className="text-danger">{fmt(purchasesPending)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
                <span className="text-muted">Settlement Status:</span>
                <span>
                  <strong className="text-success">{paidPurchasesCount} Paid</strong> ·{' '}
                  <strong className="text-danger">{pendingPurchasesCount} Pending</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Pillar 3: Operating Expenses & Refunds */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={16} style={{ color: 'var(--color-warning)' }} />
                <strong style={{ fontSize: '0.9rem' }}>Operating Expenses & Refunds</strong>
              </div>
              <span className="badge badge-warning">{expenses.length + returns.length} Entries</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Operating Expenses:</span>
                <strong className="text-danger">- {fmt(totalExpensesAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Customer Return Refunds:</span>
                <strong className="text-danger">- {fmt(totalRefundsAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                <span className="text-muted">Total Financial Outflow:</span>
                <strong className="text-danger">- {fmt(totalExpensesAmount + totalRefundsAmount + purchasesPaidFromDrawer)}</strong>
              </div>
              {canViewProfit && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 4 }}>
                  <span className="text-muted">Estimated Sales Profit:</span>
                  <strong className="text-success">{fmt(totalSalesProfit)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
                <span className="text-muted">Approved Returns:</span>
                <span><strong className="text-danger">{returns.length}</strong> items refunded</span>
              </div>
            </div>
          </div>
        </div>

        {/* TRANSACTION LEDGER FILTER BAR */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input form-input-sm"
              style={{ paddingLeft: 32 }}
              placeholder="Search reference #, customer, supplier, description..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="btn-group" style={{ flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All Activities' },
              { key: 'sale', label: '🛒 Sales Invoices' },
              { key: 'purchase', label: '📦 Stock Invoices' },
              { key: 'expense', label: '💸 Expenses' },
              { key: 'return', label: '🔄 Refunds' },
              { key: 'credit-sale', label: '👥 Customer Credit Due' },
              { key: 'pending-purchase', label: '⏳ Pending Supplier Bills' }
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-xs ${typeFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTypeFilter(f.key as typeof typeFilter)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Master Transaction Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading transactions...</div>
          ) : filteredTx.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Receipt size={32} style={{ opacity: 0.3 }} />
              <p>No transactions found for the selected filter and period</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Activity Type</th>
                  <th>Reference #</th>
                  <th>Customer / Supplier / Payee</th>
                  <th>Description</th>
                  <th>Payment Method / Source</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Inflow (+)</th>
                  <th style={{ textAlign: 'right' }}>Outflow (-)</th>
                  <th style={{ textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.date}</div>
                      {t.time && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t.time}</div>}
                    </td>
                    <td>
                      <span className={`badge ${t.badgeClass}`}>{t.typeLabel}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t.refNumber}
                      </span>
                    </td>
                    <td><strong>{t.party}</strong></td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{t.description}</td>
                    <td>
                      <span className="badge" style={{ textTransform: 'capitalize' }}>
                        {t.paymentMethod}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.badgeClass}`}>{t.status}</span>
                    </td>
                    <td className="col-currency text-success" style={{ fontWeight: t.inflow > 0 ? 800 : 400 }}>
                      {t.inflow > 0 ? `+ ${fmt(t.inflow)}` : '—'}
                    </td>
                    <td className="col-currency text-danger" style={{ fontWeight: t.outflow > 0 ? 800 : 400 }}>
                      {t.outflow > 0 ? `- ${fmt(t.outflow)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {t.type === 'purchase' && t.rawPurchase && t.rawPurchase.balance_due > 0 && (
                          <button
                            className="btn btn-primary btn-xs"
                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                            onClick={() => setPayingPurchase(t.rawPurchase!)}
                            title="Pay this stock invoice"
                          >
                            <CreditCard size={11} /> Pay
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-xs btn-icon"
                          onClick={() => {
                            if (t.type === 'sale' && t.rawSale) openSaleDetail(t.rawSale)
                            if (t.type === 'purchase' && t.rawPurchase) setInspectPurchase(t.rawPurchase)
                            if (t.type === 'expense' && t.rawExpense) setInspectExpense(t.rawExpense)
                            if (t.type === 'return' && t.rawReturn) setInspectReturn(t.rawReturn)
                          }}
                          title="Inspect full invoice breakdown"
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
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. SALES INVOICE INSPECTION MODAL                    */}
      {/* ---------------------------------------------------- */}
      {inspectSale && (
        <div className="modal-overlay" onClick={() => setInspectSale(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Receipt size={18} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <span className="modal-title">Sales Invoice {inspectSale.invoice_number}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Date: {inspectSale.date} · Cashier: {inspectSale.staff_name || 'Staff'} · Source: {inspectSale.source}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setInspectSale(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Customer</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{inspectSale.customer_name || 'Walk-in Customer'}</div>
                  {inspectSale.online_customer_contact && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Contact: {inspectSale.online_customer_contact}</div>
                  )}
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Details</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: 2, textTransform: 'capitalize' }}>{inspectSale.payment_method}</div>
                  <div style={{ marginTop: 4 }}>
                    {inspectSale.status === 'completed' && <span className="badge badge-success">Completed</span>}
                    {inspectSale.status === 'refunded' && <span className="badge badge-danger">Refunded</span>}
                    {inspectSale.status === 'voided' && <span className="badge badge-danger">Voided</span>}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Financials</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-success)' }}>{fmt(inspectSale.grand_total)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Paid: {fmt(inspectSale.amount_paid)}</div>
                  {inspectSale.balance_due > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700 }}>Due: {fmt(inspectSale.balance_due)}</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Products Sold In This Invoice:</h5>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th>Part / SKU</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th style={{ textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspectSale.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td><strong>{it.item_name || 'Product'}</strong></td>
                        <td><span className="font-mono">{it.part_number || '—'}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>{it.discount_pct ? `${it.discount_pct}%` : '—'}</td>
                        <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {inspectSale.notes && (
                <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: 10, borderRadius: 6 }}>
                  <strong>Notes:</strong> {inspectSale.notes}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(isOwner || canEditInvoice) && inspectSale.status !== 'voided' && inspectSale.status !== 'refunded' && (
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    style={{ fontWeight: 700 }}
                    onClick={() => {
                      const toEdit = inspectSale
                      setInspectSale(null)
                      setEditInvoice(toEdit)
                    }}
                  >
                    <Edit3 size={14} /> ✏️ Edit / Correct Invoice
                  </button>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setInspectSale(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT INVOICE MODAL */}
      {editInvoice && (
        <EditInvoiceModal
          invoice={editInvoice}
          onSaved={(_updated) => {
            setEditInvoice(null)
            loadData()
          }}
          onClose={() => setEditInvoice(null)}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. STOCK INVOICE INSPECTION MODAL                   */}
      {/* ---------------------------------------------------- */}
      {inspectPurchase && (
        <div className="modal-overlay" onClick={() => setInspectPurchase(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Truck size={18} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <span className="modal-title">Stock Purchase Invoice {inspectPurchase.purchase_number}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Date: {inspectPurchase.date}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setInspectPurchase(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Supplier / Mill</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{inspectPurchase.supplier_name || 'No Specific Supplier'}</div>
                  {inspectPurchase.invoice_ref && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Supplier Bill #: {inspectPurchase.invoice_ref}</div>
                  )}
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Status & Source</div>
                  <div style={{ marginTop: 4 }}>
                    {inspectPurchase.payment_status === 'paid' && <span className="badge badge-success">Fully Paid</span>}
                    {inspectPurchase.payment_status === 'partial' && <span className="badge badge-warning">Partial Payment</span>}
                    {inspectPurchase.payment_status === 'unpaid' && <span className="badge badge-danger">Pending / Unpaid</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Source: {(inspectPurchase.payment_source || 'drawer') === 'drawer' ? '🏪 Shop Drawer Cash' : '💳 Outside Funds / Bank'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Financials</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary)' }}>{fmt(inspectPurchase.total_cost)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>Paid: {fmt(inspectPurchase.amount_paid)}</div>
                  {inspectPurchase.balance_due > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700 }}>Pending: {fmt(inspectPurchase.balance_due)}</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Stock Items In This Invoice:</h5>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Part / SKU</th>
                      <th style={{ textAlign: 'center' }}>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Cost Price</th>
                      <th style={{ textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspectPurchase.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td><strong>{it.item_name || 'Product'}</strong></td>
                        <td><span className="font-mono">{it.part_number || '—'}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(it.cost_price)}</td>
                        <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {inspectPurchase.balance_due > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const toPay = inspectPurchase
                      setInspectPurchase(null)
                      setPayingPurchase(toPay)
                    }}
                  >
                    <CreditCard size={15} /> Pay Bill ({fmt(inspectPurchase.balance_due)})
                  </button>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setInspectPurchase(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. EXPENSE INSPECTION MODAL                          */}
      {/* ---------------------------------------------------- */}
      {inspectExpense && (
        <div className="modal-overlay" onClick={() => setInspectExpense(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Wallet size={18} style={{ color: 'var(--color-warning)' }} />
                <span className="modal-title">Expense {inspectExpense.expense_number}</span>
              </div>
              <button className="modal-close" onClick={() => setInspectExpense(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><strong>Date:</strong> {inspectExpense.date}</div>
                <div><strong>Category:</strong> <span className="badge badge-warning">{inspectExpense.category}</span></div>
                <div><strong>Amount:</strong> <span style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(inspectExpense.amount)}</span></div>
                <div><strong>Payment Method:</strong> {inspectExpense.payment_method}</div>
                <div><strong>Payee:</strong> {inspectExpense.payee || '—'}</div>
                <div><strong>Recorded By:</strong> {inspectExpense.staff_name || 'Staff'}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Description:</strong> {inspectExpense.description}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setInspectExpense(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. RETURN INSPECTION MODAL                           */}
      {/* ---------------------------------------------------- */}
      {inspectReturn && (
        <div className="modal-overlay" onClick={() => setInspectReturn(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Receipt size={18} style={{ color: 'var(--color-danger)' }} />
                <span className="modal-title">Customer Refund {inspectReturn.return_number}</span>
              </div>
              <button className="modal-close" onClick={() => setInspectReturn(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><strong>Date:</strong> {inspectReturn.date}</div>
                <div><strong>Customer:</strong> {inspectReturn.customer_name || '—'}</div>
                <div><strong>Refund Amount:</strong> <span style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(inspectReturn.refund_amount)}</span></div>
                <div><strong>Refund Method:</strong> {inspectReturn.refund_method}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong>Reason:</strong> {inspectReturn.reason}</div>
              </div>

              {(inspectReturn.items || []).length > 0 && (
                <div>
                  <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Returned Items:</h5>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ textAlign: 'center' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Refund</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectReturn.items!.map((it, idx) => (
                          <tr key={idx}>
                            <td>{it.item_name || 'Product'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.qty}</td>
                            <td className="col-currency">{fmt(it.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setInspectReturn(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Stock Invoice Modal */}
      {payingPurchase && (
        <PayStockInvoiceModal
          invoice={payingPurchase}
          onClose={() => setPayingPurchase(null)}
          onPaid={(updated) => {
            setPurchases(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            loadData()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// HELPER: TIMEZONE-SAFE LOCAL DATE GENERATION & PRESETS
// ============================================================
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getReportDateRange(preset: 'today' | '7d' | 'month' | '30d' | '90d' | 'custom', customFrom: string, customTo: string) {
  const now = new Date()
  const today = formatLocalDate(now)
  if (preset === 'today') return { start: today, end: today }
  if (preset === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return { start: formatLocalDate(d), end: today }
  }
  if (preset === 'month') {
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return { start: startOfMonth, end: today }
  }
  if (preset === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return { start: formatLocalDate(d), end: today }
  }
  if (preset === '90d') {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return { start: formatLocalDate(d), end: today }
  }
  return { start: customFrom, end: customTo }
}

// ============================================================
// 2. PROFIT & LOSS REPORT TAB
// ============================================================
function ProfitLossReportTab() {
  const { currentUser } = useAuth()
  const todayStr = formatLocalDate(new Date())
  const monthStartStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [datePreset, setDatePreset] = useState<'today' | '7d' | 'month' | '30d' | '90d' | 'custom'>('month')
  const [fromDate, setFromDate]     = useState(monthStartStr)
  const [toDate, setToDate]         = useState(todayStr)
  const [report, setReport]         = useState<ProfitAndLossReport | null>(null)
  const [loading, setLoading]       = useState(false)

  const load = async () => {
    setLoading(true)
    const { start, end } = getReportDateRange(datePreset, fromDate, toDate)

    const res = await window.api.getProfitAndLossReport(currentUser!.id, start, end)
    if (res.success && res.data) {
      setReport(res.data)
    } else {
      toast.error(res.error || 'Failed to load Profit & Loss report')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [datePreset, fromDate, toDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Filter */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <div className="btn-group">
          {(['today', '7d', 'month', '30d', '90d', 'custom'] as const).map(p => (
            <button
              key={p}
              className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDatePreset(p)}
            >
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === 'month' ? 'This Month' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : 'Custom'}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        <button className="btn btn-primary btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh Statement
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Computing Financial Statement...</div>
        ) : !report ? (
          <div className="empty-state" style={{ padding: 48 }}>No P&L data available</div>
        ) : (
          <div style={{ maxWidth: 840, margin: '0 auto' }}>
            {/* Net Profit Hero Card */}
            <div style={{
              background: report.net_profit >= 0
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.25) 100%)',
              border: `1.5px solid ${report.net_profit >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              borderRadius: 'var(--radius-xl)',
              padding: '24px 28px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: report.net_profit >= 0 ? '#34D399' : '#F87171' }}>
                  {report.net_profit >= 0 ? 'NET OPERATING PROFIT' : 'NET OPERATING LOSS'}
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff', marginTop: 4, lineHeight: 1.1 }}>
                  {fmt(report.net_profit)}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                  Net Margin: {report.net_margin_pct?.toFixed(1) || '0.0'}% · Period: {report.from_date} to {report.to_date}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Gross Margin</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F1C40F' }}>
                  {report.gross_margin_pct?.toFixed(1) || '0.0'}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  Gross Profit: {fmt(report.gross_profit)}
                </div>
              </div>
            </div>

            {/* Detailed Statement Breakdown */}
            <div className="card" style={{ padding: '24px 28px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                Income & Expense Statement
              </h4>

              {/* 1. REVENUE */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                  1. Sales Revenue
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span>Gross Invoiced Sales</span>
                  <span style={{ fontWeight: 700 }}>{fmt(report.gross_sales || report.total_revenue)}</span>
                </div>
                {report.total_returns > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: 'var(--color-danger)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <span>Less: Approved Customer Returns / Refunds (-)</span>
                    <span style={{ fontWeight: 700 }}>- {fmt(report.total_returns)}</span>
                  </div>
                )}
                {report.total_discounts > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <span>Discounts Given (already factored)</span>
                    <span>{fmt(report.total_discounts)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-primary)', background: 'var(--color-surface-2)', borderRadius: 6, marginTop: 6, paddingLeft: 8, paddingRight: 8 }}>
                  <span>Net Sales Revenue</span>
                  <span className="text-success">{fmt(report.total_revenue)}</span>
                </div>
              </div>

              {/* 2. COGS */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                  2. Cost of Goods Sold (COGS)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span>Product Purchase / Cost of Sold Inventory</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>- {fmt(report.cost_of_goods_sold)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-primary)', background: 'var(--color-surface-2)', borderRadius: 6, marginTop: 6, paddingLeft: 8, paddingRight: 8 }}>
                  <span>Gross Profit</span>
                  <span className="text-primary">{fmt(report.gross_profit)}</span>
                </div>
              </div>

              {/* 3. OPERATING EXPENSES */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                  3. Operating Expenses
                </div>
                {(report.operating_expenses || []).length === 0 ? (
                  <div style={{ padding: '8px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    No operating expenses recorded for this period
                  </div>
                ) : (
                  (report.operating_expenses || []).map((exp, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <span>{exp.account_name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>- {fmt(exp.amount)}</span>
                    </div>
                  ))
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 800, fontSize: '1rem', color: 'var(--color-danger)', background: 'var(--color-surface-2)', borderRadius: 6, marginTop: 6, paddingLeft: 8, paddingRight: 8 }}>
                  <span>Total Operating Expenses</span>
                  <span>- {fmt(report.total_expenses)}</span>
                </div>
              </div>

              {/* FINAL NET PROFIT LINE */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '16px 12px', fontWeight: 900, fontSize: '1.25rem',
                background: report.net_profit >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                border: `1.5px solid ${report.net_profit >= 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                color: report.net_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                borderRadius: 'var(--radius-md)'
              }}>
                <span>FINAL NET {report.net_profit >= 0 ? 'PROFIT' : 'LOSS'}</span>
                <span>{fmt(report.net_profit)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// FINANCIAL ANALYTICS & VISUALIZATIONS TAB
// ============================================================
function FinancialAnalyticsTab() {
  const { currentUser, canViewProfit, canViewCostPrice } = useAuth()
  const todayStr = formatLocalDate(new Date())
  const monthStartStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const [datePreset, setDatePreset] = useState<'today' | '7d' | 'month' | '30d' | '90d' | 'custom'>('month')
  const [fromDate, setFromDate]     = useState(monthStartStr)
  const [toDate, setToDate]         = useState(todayStr)
  const [analytics, setAnalytics]   = useState<any | null>(null)
  const [loading, setLoading]       = useState(true)

  const loadData = async () => {
    setLoading(true)
    const { start, end } = getReportDateRange(datePreset, fromDate, toDate)

    try {
      const res = await window.api.getFinancialAnalytics(currentUser!.id, start, end)
      if (res.success && res.data) {
        setAnalytics(res.data)
      } else {
        toast.error(res.error || 'Failed to load financial analytics')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error fetching analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [datePreset, fromDate, toDate])

  const exportCSV = () => {
    if (!analytics || !analytics.dailyTimeline || analytics.dailyTimeline.length === 0) {
      toast.error('No analytics data to export')
      return
    }

    const headers = ['Date', 'Invoices', 'Gross Revenue (PKR)', 'COGS (PKR)', 'Operating Expenses (PKR)', 'Net Profit (PKR)', 'Net Margin %']
    const rows = analytics.dailyTimeline.map((d: any) => [
      d.date,
      d.invoices_count,
      d.revenue,
      d.cogs,
      d.expenses,
      d.net_profit,
      d.revenue > 0 ? ((d.net_profit / d.revenue) * 100).toFixed(1) : '0.0'
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `AlDeewan_Financial_Analytics_${fromDate}_to_${toDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Financial analytics exported to CSV')
  }

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B']

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
          fontSize: '0.8125rem',
          minWidth: 180
        }}>
          <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
            {label}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, margin: '4px 0' }}>
              <span style={{ color: entry.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                {entry.name}:
              </span>
              <span style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                {typeof entry.value === 'number' ? fmt(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const kpis = analytics?.kpis || {
    gross_revenue: 0, cogs: 0, gross_profit: 0, gross_margin_pct: 0,
    operating_expenses: 0, net_profit: 0, net_margin_pct: 0, invoices_count: 0, average_order_value: 0
  }

  const waterfallData = [
    { name: 'Gross Revenue', amount: kpis.gross_revenue, fill: '#10B981' },
    { name: 'COGS (Cost)', amount: kpis.cogs, fill: '#EF4444' },
    { name: 'Gross Profit', amount: kpis.gross_profit, fill: '#3B82F6' },
    { name: 'Expenses', amount: kpis.operating_expenses, fill: '#F59E0B' },
    { name: 'Net Profit', amount: kpis.net_profit, fill: kpis.net_profit >= 0 ? '#10B981' : '#EF4444' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Filter & Action Bar */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <div className="btn-group">
          {(['today', '7d', 'month', '30d', '90d', 'custom'] as const).map(p => (
            <button
              key={p}
              className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDatePreset(p)}
            >
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === 'month' ? 'This Month' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : 'Custom'}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        <button className="btn btn-primary btn-sm" onClick={loadData}>
          <RefreshCw size={13} /> Refresh Analytics
        </button>

        <button className="btn btn-secondary btn-sm" onClick={exportCSV} style={{ marginLeft: 'auto' }}>
          <Download size={13} /> Export CSV Report
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Activity size={36} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
            <div>Generating Financial Analytics & Chart Visualizations...</div>
          </div>
        ) : !analytics ? (
          <div className="empty-state" style={{ padding: 60 }}>No financial data found for this period</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI Cards Grid */}
            <div className="grid-4" style={{ gap: 14 }}>
              {/* Gross Revenue */}
              <div className="kpi-card" style={{ borderTop: '3px solid #10B981' }}>
                <div className="kpi-title">Gross Revenue (Sales)</div>
                <div className="kpi-value text-success" style={{ fontWeight: 900 }}>{fmt(kpis.gross_revenue)}</div>
                <div className="kpi-subtitle">{kpis.invoices_count} total completed sales</div>
              </div>

              {/* COGS */}
              {canViewCostPrice && (
                <div className="kpi-card" style={{ borderTop: '3px solid #EF4444' }}>
                  <div className="kpi-title">Cost of Goods Sold (COGS)</div>
                  <div className="kpi-value text-danger" style={{ fontWeight: 800 }}>- {fmt(kpis.cogs)}</div>
                  <div className="kpi-subtitle">Inventory wholesale cost</div>
                </div>
              )}

              {/* Gross Profit & Margin */}
              {canViewProfit && (
                <div className="kpi-card" style={{ borderTop: '3px solid #3B82F6' }}>
                  <div className="kpi-title">Gross Profit & Margin</div>
                  <div className="kpi-value text-primary" style={{ fontWeight: 800 }}>{fmt(kpis.gross_profit)}</div>
                  <div className="kpi-subtitle">Gross Margin: <strong style={{ color: '#3B82F6' }}>{kpis.gross_margin_pct.toFixed(1)}%</strong></div>
                </div>
              )}

              {/* Operating Expenses */}
              <div className="kpi-card" style={{ borderTop: '3px solid #F59E0B' }}>
                <div className="kpi-title">Operating Expenses</div>
                <div className="kpi-value text-warning" style={{ fontWeight: 800 }}>- {fmt(kpis.operating_expenses)}</div>
                <div className="kpi-subtitle">Store utilities, rent, salaries, misc</div>
              </div>

              {/* Net Profit & Margin */}
              {canViewProfit && (
                <div className="kpi-card" style={{
                  gridColumn: 'span 2',
                  background: kpis.net_profit >= 0
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.2) 100%)',
                  border: `1.5px solid ${kpis.net_profit >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                }}>
                  <div className="kpi-title" style={{ color: kpis.net_profit >= 0 ? '#34D399' : '#F87171', fontWeight: 800 }}>
                    NET OPERATING PROFIT
                  </div>
                  <div className="kpi-value" style={{ fontSize: '2rem', fontWeight: 900, color: kpis.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                    {fmt(kpis.net_profit)}
                  </div>
                  <div className="kpi-subtitle">
                    Net Margin: <strong>{kpis.net_margin_pct.toFixed(1)}%</strong> · Average Order Value (AOV): <strong>{fmt(kpis.average_order_value)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Row 1: Financial Trend Timeline Chart */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                    Daily Financial Revenue, Cost & Net Profit Timeline
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Tracking daily gross revenue, inventory cost, operating expenses, and retained profit
                  </div>
                </div>
              </div>

              {analytics.dailyTimeline.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No timeline records in this date range</div>
              ) : (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.dailyTimeline} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: '0.8rem' }} />
                      <Area type="monotone" dataKey="revenue" name="Gross Revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradRev)" />
                      {canViewProfit && <Area type="monotone" dataKey="net_profit" name="Net Profit" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#gradProfit)" />}
                      {canViewCostPrice && <Area type="monotone" dataKey="cogs" name="COGS (Cost)" stroke="#EF4444" strokeWidth={1.5} fillOpacity={1} fill="url(#gradCogs)" />}
                      <Area type="monotone" dataKey="expenses" name="Operating Expenses" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill="url(#gradExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Row 2: Cashflow Waterfall + Payment Methods Donut */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Financial Cashflow Waterfall */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                  Financial Flow & Capital Breakdown
                </h4>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                      <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar dataKey="amount" name="Amount (PKR)" radius={[6, 6, 0, 0]}>
                        {waterfallData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods Split */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <PieChart size={16} style={{ color: 'var(--color-primary)' }} />
                  Revenue by Payment Method
                </h4>
                {analytics.paymentMethods.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No payment transactions</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: 260 }}>
                    <div style={{ width: '55%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analytics.paymentMethods}
                            dataKey="amount"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {analytics.paymentMethods.map((entry: any, index: number) => (
                              <Cell key={`pm-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomChartTooltip />} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.775rem' }}>
                      {analytics.paymentMethods.map((pm: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                            {pm.name}
                          </span>
                          <strong>{pm.pct.toFixed(0)}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Expense Category Breakdown Donut + List */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Wallet size={16} style={{ color: 'var(--color-warning)' }} />
                Operating Expense Distribution by Category
              </h4>
              {analytics.expenseCategories.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)' }}>No operating expenses recorded for this period</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {analytics.expenseCategories.map((exp: any, idx: number) => (
                    <div key={idx} style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '12px 14px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {exp.name}
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 4 }}>
                        {fmt(exp.amount)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {exp.count} entries · {exp.pct.toFixed(1)}% of expenses
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Daily Performance Data Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>Daily Financial Performance Breakdown</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{analytics.dailyTimeline.length} recorded active business days</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Gross Revenue</th>
                    {canViewCostPrice && <th style={{ textAlign: 'right' }}>🔒 COGS (Cost)</th>}
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    {canViewProfit && <th style={{ textAlign: 'right' }}>🔒 Net Profit</th>}
                    {canViewProfit && <th style={{ textAlign: 'center' }}>Net Margin</th>}
                  </tr>
                </thead>
                <tbody>
                  {analytics.dailyTimeline.map((d: any) => (
                    <tr key={d.date}>
                      <td><strong>{d.date}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{d.invoices_count}</td>
                      <td className="col-currency text-success" style={{ fontWeight: 800 }}>{fmt(d.revenue)}</td>
                      {canViewCostPrice && <td className="col-currency text-danger">{fmt(d.cogs)}</td>}
                      <td className="col-currency text-warning">{fmt(d.expenses)}</td>
                      {canViewProfit && (
                        <td className="col-currency" style={{ color: d.net_profit >= 0 ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                          {fmt(d.net_profit)}
                        </td>
                      )}
                      {canViewProfit && (
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${d.net_profit >= 0 ? 'badge-success' : 'badge-danger'}`}>
                            {d.revenue > 0 ? `${((d.net_profit / d.revenue) * 100).toFixed(1)}%` : '0.0%'}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 3. EXPENSE REPORT TAB
// ============================================================
function ExpenseReportTab() {
  const { currentUser } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [datePreset, setDatePreset] = useState<'today' | '7d' | 'month' | 'custom'>('month')
  const [fromDate, setFromDate]     = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate]         = useState(todayStr)
  const [category, setCategory]     = useState('all')
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [loading, setLoading]       = useState(true)

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

    const res = await window.api.getExpenses(currentUser!.id, start, end, category)
    if (res.success && res.data) setExpenses(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [datePreset, fromDate, toDate, category])

  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  // Category breakdown
  const categoryTotals: Record<string, number> = {}
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Filter Bar */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
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

        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        <select className="form-select form-select-sm" style={{ width: 180 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="Tea & Refreshments">Tea & Refreshments</option>
          <option value="Salaries / Wages">Salaries / Wages</option>
          <option value="Shop Rent">Shop Rent</option>
          <option value="Electricity & Utilities">Electricity & Utilities</option>
          <option value="Delivery & Freight">Delivery & Freight</option>
          <option value="Shop Maintenance">Shop Maintenance</option>
          <option value="Packaging & Bags">Packaging & Bags</option>
          <option value="General & Misc">General & Misc</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh"><RefreshCw size={14} /></button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Total Expenses:</span>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(totalExpense)}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Category distribution pill strip */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {Object.entries(categoryTotals).map(([cat, amt]) => (
            <div key={cat} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 14px', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--color-text-secondary)', marginRight: 6 }}>{cat}:</span>
              <strong style={{ color: 'var(--color-danger)' }}>{fmt(amt)}</strong>
            </div>
          ))}
        </div>

        {/* Expenses table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Wallet size={32} style={{ opacity: 0.3 }} />
              <p>No operational expenses recorded for this period</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense #</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Payee</th>
                  <th>Payment Method</th>
                  <th>Staff</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td><span className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{e.expense_number}</span></td>
                    <td>{e.date}</td>
                    <td><span className="badge badge-warning">{e.category}</span></td>
                    <td>{e.description}</td>
                    <td><strong>{e.payee || '—'}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{e.payment_method}</td>
                    <td className="text-muted text-xs">{e.staff_name || '—'}</td>
                    <td className="col-currency text-danger" style={{ fontWeight: 800 }}>{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 4. STOCK & PURCHASE INVOICES REPORT TAB
// ============================================================
function StockPurchasesReportTab() {
  const { currentUser } = useAuth()
  const [purchases, setPurchases]       = useState<Purchase[]>([])
  const [suppliers, setSuppliers]       = useState<Supplier[]>([])
  const [loading, setLoading]           = useState(true)
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [payingPurchase, setPayingPurchase]     = useState<Purchase | null>(null)

  const load = async () => {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      window.api.getAllPurchases(currentUser!.id),
      window.api.getAllSuppliers()
    ])
    if (pRes.success && pRes.data) setPurchases(pRes.data)
    if (sRes) setSuppliers(sRes)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = purchases.filter(p => {
    const matchSup = supplierFilter === 'all' || p.supplier_id === supplierFilter
    const matchStat = statusFilter === 'all' || p.payment_status === statusFilter
    const matchSrc = sourceFilter === 'all' || (p.payment_source || 'drawer') === sourceFilter
    return matchSup && matchStat && matchSrc
  })

  const totalPurchases = filtered.reduce((s, p) => s + (p.total_cost || 0), 0)
  const totalPaid = filtered.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const totalPending = filtered.reduce((s, p) => s + (p.balance_due || 0), 0)
  const totalDrawer = filtered.filter(p => (p.payment_source || 'drawer') === 'drawer').reduce((s, p) => s + (p.amount_paid || 0), 0)
  const totalOutside = filtered.filter(p => (p.payment_source || 'drawer') === 'outside').reduce((s, p) => s + (p.amount_paid || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filters Bar */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <select className="form-select form-select-sm" style={{ width: 190 }} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
          <option value="all">All Suppliers / Mills</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select className="form-select form-select-sm" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Payment Status</option>
          <option value="paid">🟢 Fully Paid</option>
          <option value="partial">🟡 Partial Paid</option>
          <option value="unpaid">🔴 Pending / Unpaid</option>
        </select>

        <select className="form-select form-select-sm" style={{ width: 170 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">All Payment Sources</option>
          <option value="drawer">🏪 Shop Drawer Cash</option>
          <option value="outside">💳 Outside / Bank Funds</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* KPI Row */}
        <div className="grid-4" style={{ gap: 14, marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-title">Total Stock Invoiced</div>
            <div className="kpi-value text-primary">{fmt(totalPurchases)}</div>
            <div className="kpi-subtitle">{filtered.length} total purchase orders</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Paid from Shop Drawer</div>
            <div className="kpi-value text-success">{fmt(totalDrawer)}</div>
            <div className="kpi-subtitle">Reduced shop cash</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Paid from Outside Funds</div>
            <div className="kpi-value" style={{ color: '#C084FC' }}>{fmt(totalOutside)}</div>
            <div className="kpi-subtitle">External / bank capital</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Pending / Accounts Payable</div>
            <div className="kpi-value text-danger">{fmt(totalPending)}</div>
            <div className="kpi-subtitle">Owed to suppliers</div>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading purchase invoices...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Truck size={32} style={{ opacity: 0.3 }} />
              <p>No purchase records found matching filters</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO / Invoice #</th>
                  <th>Date</th>
                  <th>Supplier / Mill</th>
                  <th>Supplier Bill #</th>
                  <th style={{ textAlign: 'right' }}>Total Bill</th>
                  <th style={{ textAlign: 'right' }}>Paid Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th>Status</th>
                  <th>Payment Source</th>
                  <th>Staff</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><span className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{p.purchase_number}</span></td>
                    <td>{p.date}</td>
                    <td><strong>{p.supplier_name || '—'}</strong></td>
                    <td>{p.invoice_ref || '—'}</td>
                    <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(p.total_cost)}</td>
                    <td className="col-currency text-success" style={{ fontWeight: 700 }}>{fmt(p.amount_paid)}</td>
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
                            onClick={() => setPayingPurchase(p)}
                            title="Record payment towards this stock invoice"
                          >
                            <CreditCard size={12} /> Pay Bill
                          </button>
                        )}
                        <button className="btn btn-ghost btn-xs btn-icon" onClick={() => setSelectedPurchase(p)}>
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
      </div>

      {/* Pay Invoice Modal */}
      {payingPurchase && (
        <PayStockInvoiceModal
          invoice={payingPurchase}
          onClose={() => setPayingPurchase(null)}
          onPaid={(updated) => {
            setPurchases(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            if (selectedPurchase && selectedPurchase.id === updated.id) {
              setSelectedPurchase(prev => prev ? { ...prev, ...updated } : null)
            }
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedPurchase && (
        <div className="modal-overlay" onClick={() => setSelectedPurchase(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Stock Invoice {selectedPurchase.purchase_number}</span>
              <button className="modal-close" onClick={() => setSelectedPurchase(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><strong>Supplier:</strong> {selectedPurchase.supplier_name || '—'}</div>
                <div><strong>Bill Ref:</strong> {selectedPurchase.invoice_ref || '—'}</div>
                <div><strong>Total Bill:</strong> {fmt(selectedPurchase.total_cost)}</div>
                <div><strong>Paid:</strong> {fmt(selectedPurchase.amount_paid)}</div>
                <div><strong>Balance Due:</strong> {fmt(selectedPurchase.balance_due)}</div>
                <div><strong>Payment Source:</strong> {(selectedPurchase.payment_source || 'drawer') === 'drawer' ? 'Shop Drawer' : 'Outside Funds'}</div>
              </div>

              <h5 style={{ fontWeight: 700, marginBottom: 6 }}>Item Lines:</h5>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Cost</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPurchase.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.item_name || 'Product'}</td>
                        <td style={{ textAlign: 'center' }}>{it.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(it.cost_price)}</td>
                        <td className="col-currency" style={{ fontWeight: 700 }}>{fmt(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedPurchase.balance_due > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const toPay = selectedPurchase
                      setSelectedPurchase(null)
                      setPayingPurchase(toPay)
                    }}
                  >
                    <CreditCard size={15} /> Pay Bill ({fmt(selectedPurchase.balance_due)})
                  </button>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedPurchase(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 5. DAILY SALES REPORT TAB
// ============================================================
function DailySaleReportTab() {
  const { currentUser, canViewProfit, canViewCostPrice } = useAuth()
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<DailySaleReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const result = await window.api.getDailySaleReport(currentUser!.id, date)
    if (result.success && result.data) {
      setReport(result.data)
    } else {
      toast.error(result.error || 'Failed to load report')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [date])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filters */}
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0
      }}>
        <Calendar size={15} style={{ color: 'var(--color-text-muted)' }} />
        <input type="date" className="form-input" style={{ maxWidth: 160 }} value={date} onChange={e => setDate(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={load}><RefreshCw size={13} /> Load</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : !report ? (
          <div className="empty-state" style={{ padding: 40 }}>No report data</div>
        ) : (
          <div>
            {/* KPI Banner */}
            <div className="grid-4" style={{ gap: 14, marginBottom: 20 }}>
              <div className="kpi-card">
                <div className="kpi-title">Total Daily Sales</div>
                <div className="kpi-value text-primary">{fmt(report.totals.total_sales)}</div>
                <div className="kpi-subtitle">{report.totals.invoice_count} active invoices</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Total Discounts Given</div>
                <div className="kpi-value text-warning">{fmt(report.totals.total_discount)}</div>
                <div className="kpi-subtitle">Customer promotions</div>
              </div>
              {canViewCostPrice && (
                <div className="kpi-card">
                  <div className="kpi-title">🔒 Total Cost</div>
                  <div className="kpi-value text-danger">{fmt(report.totals.total_cost)}</div>
                  <div className="kpi-subtitle">Internal wholesale cost</div>
                </div>
              )}
              {canViewProfit && (
                <div className="kpi-card">
                  <div className="kpi-title">🔒 Gross Profit</div>
                  <div className="kpi-value text-success">{fmt(report.totals.total_profit)}</div>
                  <div className="kpi-subtitle">Net sales - cost</div>
                </div>
              )}
            </div>

            {/* Invoices List */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Staff</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.invoices || []).map(inv => (
                    <tr key={inv.id}>
                      <td><span className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{inv.invoice_number}</span></td>
                      <td>{inv.datetime_created ? inv.datetime_created.slice(11, 16) : '—'}</td>
                      <td>{inv.customer_name || 'Walk-in'}</td>
                      <td className="text-muted text-xs">{inv.staff_name || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{inv.payment_method}</td>
                      <td className="col-currency" style={{ fontWeight: 800 }}>{fmt(inv.grand_total)}</td>
                      <td className="col-currency text-success">{fmt(inv.amount_paid)}</td>
                      <td>
                        {inv.status === 'completed' && <span className="badge badge-success">Completed</span>}
                        {inv.status === 'refunded' && <span className="badge badge-danger">Refunded</span>}
                        {inv.status === 'voided' && <span className="badge badge-danger">Voided</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 6. STAFF PERFORMANCE REPORT TAB
// ============================================================
function StaffSalesReportTab() {
  const { currentUser, canViewProfit, canViewCostPrice } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [datePreset, setDatePreset] = useState<'today' | '7d' | 'month' | 'custom'>('month')
  const [fromDate, setFromDate]     = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate]         = useState(todayStr)
  const [rows, setRows]             = useState<StaffSalesReport[]>([])
  const [loading, setLoading]       = useState(false)

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

    const result = await window.api.getStaffSalesReport(currentUser!.id, start, end)
    if (result.success && result.data) setRows(result.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [datePreset, fromDate, toDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
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

        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        <button className="btn btn-primary btn-sm" onClick={load}><RefreshCw size={13} /> Load Performance</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Total Sales</th>
                  <th style={{ textAlign: 'right' }}>Discounts</th>
                  {canViewProfit && <th style={{ textAlign: 'right' }}>🔒 Profit Generated</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.user_id}>
                    <td><strong>{r.user_name}</strong></td>
                    <td><span className="badge badge-primary">{r.role}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.invoice_count}</td>
                    <td className="col-currency text-primary" style={{ fontWeight: 800 }}>{fmt(r.total_sales)}</td>
                    <td className="col-currency text-warning">{fmt(r.total_discounts)}</td>
                    {canViewProfit && <td className="col-currency text-success" style={{ fontWeight: 800 }}>{fmt(r.total_profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 7. AGING REPORT TAB (AR / AP)
// ============================================================
function AgingReportTab({ type }: { type: 'ar' | 'ap' }) {
  const { currentUser } = useAuth()
  const [data, setData] = useState<AgingReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const result = await window.api.getAgingReport(currentUser!.id, type)
    if (result.success && result.data) setData(result.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [type])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
          {type === 'ar' ? 'Customer Accounts Receivable (Credit Debt)' : 'Supplier Accounts Payable (Pending Bills)'}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {!data ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading aging analysis...</div>
        ) : (
          <div>
            <div className="grid-5" style={{ gap: 12, marginBottom: 20 }}>
              <div className="kpi-card"><div className="kpi-title">Current</div><div className="kpi-value text-success">{fmt(data.total_current)}</div></div>
              <div className="kpi-card"><div className="kpi-title">1 - 30 Days</div><div className="kpi-value text-primary">{fmt(data.total_30)}</div></div>
              <div className="kpi-card"><div className="kpi-title">31 - 60 Days</div><div className="kpi-value text-warning">{fmt(data.total_60)}</div></div>
              <div className="kpi-card"><div className="kpi-title">61 - 90+ Days</div><div className="kpi-value text-danger">{fmt(data.total_90)}</div></div>
              <div className="kpi-card"><div className="kpi-title">Total Outstanding</div><div className="kpi-value text-danger" style={{ fontWeight: 900 }}>{fmt(data.grand_total)}</div></div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{type === 'ar' ? 'Customer Name' : 'Supplier Name'}</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'right' }}>Current</th>
                    <th style={{ textAlign: 'right' }}>1-30 Days</th>
                    <th style={{ textAlign: 'right' }}>31-60 Days</th>
                    <th style={{ textAlign: 'right' }}>61-90+ Days</th>
                    <th style={{ textAlign: 'right' }}>Total Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows || []).map(r => (
                    <tr key={r.party_id}>
                      <td><strong>{r.party_name}</strong></td>
                      <td>{r.phone || '—'}</td>
                      <td className="col-currency">{fmt(r.current)}</td>
                      <td className="col-currency">{fmt(r.days_30)}</td>
                      <td className="col-currency">{fmt(r.days_60)}</td>
                      <td className="col-currency text-danger">{fmt(r.days_90)}</td>
                      <td className="col-currency text-danger" style={{ fontWeight: 800 }}>{fmt(r.total_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
