import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Users, AlertTriangle, ArrowRight, BarChart3, Banknote, RefreshCw,
  FileText, MessageSquare, RotateCcw, Barcode as BarcodeIcon, ShoppingBag,
  Lock, Store, Wrench, Clock, Sparkles, CheckCircle2, PieChart, Activity,
  Zap, Award, Flame
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import type { StaffSalesReport, Invoice } from '../../types'

const fmt = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function DashboardPage() {
  const { currentUser, can, canViewProfit, canViewCostPrice, canViewAllReports } = useAuth()
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)

  const [dailyReport, setDailyReport]       = useState<{
    total_sales: number; total_profit: number; total_discount: number; invoice_count: number
  } | null>(null)
  const [staffReport, setStaffReport]       = useState<StaffSalesReport[]>([])
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [todayInvoices, setTodayInvoices]   = useState<Invoice[]>([])
  const [weeklyTrend, setWeeklyTrend]       = useState<Array<{ date: string; displayDate: string; sales: number; profit: number; count: number }>>([])
  const [hourlySales, setHourlySales]       = useState<Array<{ hour: string; sales: number; count: number }>>([])
  const [paymentMix, setPaymentMix]         = useState<Array<{ name: string; amount: number; pct: number }>>([])
  const [lowStock, setLowStock]             = useState<{ name: string; qty: number; reorder: number }[]>([])
  const [loading, setLoading]               = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const d7 = new Date()
      d7.setDate(d7.getDate() - 6)
      const d7Str = d7.toISOString().slice(0, 10)

      const staffFilter = canViewAllReports ? undefined : currentUser!.id

      const [daily, staff, items, invoicesToday, weeklyInvoices] = await Promise.all([
        window.api.getDailySaleReport(currentUser!.id, today),
        canViewAllReports ? window.api.getStaffSalesReport(currentUser!.id, today) : Promise.resolve({ success: true, data: [] }),
        window.api.getAllItems(),
        window.api.getInvoicesByDate(today),
        window.api.getInvoicesByRange(d7Str, today, staffFilter)
      ])

      if (daily.success && daily.data) setDailyReport(daily.data.totals)
      if (staff.success && staff.data) setStaffReport(staff.data)
      
      const allToday = Array.isArray(invoicesToday) ? invoicesToday : []
      // Filter for salesperson if not allowed to view all
      const userTodayInvoices = canViewAllReports ? allToday : allToday.filter(inv => inv.staff_id === currentUser!.id)
      setTodayInvoices(userTodayInvoices)
      setRecentInvoices(userTodayInvoices.slice(0, 8))

      // 1. Process 7-day trend
      const allWeekly = Array.isArray(weeklyInvoices) ? weeklyInvoices : []
      const dayMap: Record<string, { date: string; displayDate: string; sales: number; profit: number; count: number }> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dStr = d.toISOString().slice(0, 10)
        const displayDate = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' })
        dayMap[dStr] = { date: dStr, displayDate, sales: 0, profit: 0, count: 0 }
      }
      for (const inv of allWeekly) {
        if (inv.status === 'voided' || inv.status === 'parked') continue
        const d = inv.date
        if (dayMap[d]) {
          dayMap[d].sales += Number(inv.grand_total) || 0
          dayMap[d].profit += Number(inv.profit) || 0
          dayMap[d].count += 1
        }
      }
      setWeeklyTrend(Object.values(dayMap))

      // 2. Process hourly sales today
      const hoursMap: Record<number, { hour: string; sales: number; count: number }> = {}
      for (let h = 9; h <= 23; h++) {
        const label = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
        hoursMap[h] = { hour: label, sales: 0, count: 0 }
      }
      for (const inv of userTodayInvoices) {
        if (inv.status === 'voided' || inv.status === 'parked') continue
        const timeStr = inv.datetime_created || ''
        let hour = 12
        if (timeStr.includes(':')) {
          const parts = timeStr.split(' ')[1] || timeStr
          hour = parseInt(parts.split(':')[0], 10) || 12
        }
        if (hoursMap[hour]) {
          hoursMap[hour].sales += Number(inv.grand_total) || 0
          hoursMap[hour].count += 1
        } else {
          const label = `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'am' : 'pm'}`
          hoursMap[hour] = { hour: label, sales: Number(inv.grand_total) || 0, count: 1 }
        }
      }
      setHourlySales(Object.keys(hoursMap).map(Number).sort((a, b) => a - b).filter(h => h >= 9 && h <= 23).map(h => hoursMap[h]))

      // 3. Process payment method mix today
      const pmMap: Record<string, number> = {}
      let totalRevToday = 0
      for (const inv of userTodayInvoices) {
        if (inv.status === 'voided' || inv.status === 'parked') continue
        const pm = (inv.payment_method || 'cash').toLowerCase()
        const name = pm.includes('jazzcash') ? 'JazzCash' :
                     pm.includes('easypaisa') ? 'EasyPaisa' :
                     pm.includes('bank') ? 'Bank Transfer' :
                     pm.includes('card') ? 'Card' :
                     pm.includes('credit') ? 'Khata / Credit' : 'Cash'
        const amt = Number(inv.grand_total) || 0
        pmMap[name] = (pmMap[name] || 0) + amt
        totalRevToday += amt
      }
      const mix = Object.entries(pmMap).map(([name, amount]) => ({
        name,
        amount,
        pct: totalRevToday > 0 ? (amount / totalRevToday) * 100 : 0
      }))
      setPaymentMix(mix)

      // 4. Low stock items
      if (Array.isArray(items) && items.length > 0) {
        const low = items
          .filter(i => i.quantity_on_hand <= i.reorder_level || i.quantity_on_hand <= 5)
          .map(i => ({ name: i.name, qty: i.quantity_on_hand, reorder: i.reorder_level }))
          .slice(0, 8)
        setLowStock(low)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [today, currentUser])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const isOwner = currentUser?.role === 'owner'
  const canStock = isOwner || can('add_edit_stock')
  const canBarcode = isOwner || can('barcode')
  const canOrders = isOwner || can('orders')
  const canSales = isOwner || can('sales')
  const canReturns = isOwner || can('process_return')
  const canPurchases = isOwner || can('record_purchase')
  const canDayClose = isOwner || can('day_closing')
  const canAccounts = isOwner || can('view_accounts')
  const canReports = isOwner || can('view_all_reports')
  const canCustomers = isOwner || can('customers')
  const canPos = isOwner || can('pos')

  return (
    <div className="page-body" style={{ width: '100%', padding: '24px 32px' }}>
      {/* Header & Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>
              {greeting()}, {currentUser?.name}
            </h2>
            <span style={{
              background: 'rgba(196, 30, 58, 0.1)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(196, 30, 58, 0.25)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {currentUser?.role}
            </span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: '0.875rem' }}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Enterprise POS Overview
          </p>
        </div>

        {/* Quick Action Ribbon */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-md"
            onClick={loadData}
            title="Refresh Live Data"
            style={{ padding: '0 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {canPos && (
            <button className="btn btn-primary btn-md" onClick={() => navigate('/pos')} style={{ fontWeight: 700 }}>
              <ShoppingCart size={16} /> POS Terminal
              <span className="hotkey" style={{ marginLeft: 4, background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none' }}>F1</span>
            </button>
          )}
          {canSales && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/sales')}>
              <FileText size={16} /> Sales History
            </button>
          )}
          {canOrders && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/orders')}>
              <MessageSquare size={16} /> Online Orders
            </button>
          )}
          {canReturns && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/returns')}>
              <RotateCcw size={16} /> Returns
            </button>
          )}
          {canStock && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/stock')}>
              <Package size={16} /> Stock
            </button>
          )}
          {canReports && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/reports')}>
              <BarChart3 size={16} /> Reports
            </button>
          )}
        </div>
      </motion.div>

      {/* KPI Stats Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}
        >
          <StatCard
            label="Today's Net Sales"
            value={fmt(dailyReport?.total_sales || 0)}
            icon={<Banknote size={24} />}
            color="var(--color-primary)"
            colorBg="var(--color-primary-10)"
            sub={`${dailyReport?.invoice_count || 0} bills completed today`}
          />
          {canViewProfit && (
            <StatCard
              label="Today's Profit"
              value={fmt(dailyReport?.total_profit || 0)}
              icon={(dailyReport?.total_profit || 0) >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              color={(dailyReport?.total_profit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
              colorBg={(dailyReport?.total_profit || 0) >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)'}
              sub={(dailyReport?.total_sales || 0) > 0
                ? `${(((dailyReport?.total_profit || 0) / (dailyReport?.total_sales || 1)) * 100).toFixed(1)}% profit margin`
                : 'No sales recorded yet'}
            />
          )}
          {(isOwner || can('apply_discount')) && (
            <StatCard
              label="Discounts Given"
              value={fmt(dailyReport?.total_discount || 0)}
              icon={<TrendingDown size={24} />}
              color="#F59E0B"
              colorBg="rgba(245, 158, 11, 0.1)"
              sub="Total concessions applied"
            />
          )}
          <StatCard
            label="Low Stock Alerts"
            value={lowStock.length.toString()}
            icon={<AlertTriangle size={24} />}
            color={lowStock.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
            colorBg={lowStock.length > 0 ? 'var(--color-danger-bg)' : 'var(--color-success-bg)'}
            sub={lowStock.length > 0 ? `${lowStock.length} items below reorder level` : 'All inventory levels optimal'}
          />
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* VISUAL CHARTS & ANALYTICS SECTION */}
      {/* ============================================================ */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24, marginBottom: 28 }}>
          {/* Chart 1: 7-Day Sales & Profit Trend */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="card"
            style={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
                  {canViewAllReports ? '7-Day Store Revenue Velocity' : 'My 7-Day Sales Trend'}
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Daily sales performance tracking across the last 7 days
                </div>
              </div>
              <span className="badge badge-primary text-xs">Last 7 Days</span>
            </div>

            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashGradSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="dashGradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            background: 'rgba(17, 24, 39, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
                            fontSize: '0.8125rem'
                          }}>
                            <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                              {label}
                            </div>
                            {payload.map((entry: any, index: number) => (
                              <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '3px 0' }}>
                                <span style={{ color: entry.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                                  {entry.name}:
                                </span>
                                <span style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                                  {fmt(entry.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area type="monotone" dataKey="sales" name="Sales Revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#dashGradSales)" />
                  {canViewProfit && <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#dashGradProfit)" />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 2: Today's Hourly Activity Velocity */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="card"
            style={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: '#F59E0B' }} />
                  Today's Peak Hours & Hourly Sales
                </h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Real-time sales velocity breakdown across store business hours
                </div>
              </div>
              <span className="badge badge-warning text-xs">Today's Timeline</span>
            </div>

            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySales} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const it = payload[0].payload
                        return (
                          <div style={{
                            background: 'rgba(17, 24, 39, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
                            fontSize: '0.8125rem'
                          }}>
                            <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                              Hour: {label}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '3px 0' }}>
                              <span style={{ color: '#F59E0B' }}>Sales Generated:</span>
                              <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{fmt(it.sales)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '3px 0' }}>
                              <span style={{ color: 'var(--color-text-secondary)' }}>Invoices Generated:</span>
                              <strong style={{ color: '#FFFFFF' }}>{it.count} bills</strong>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="sales" name="Sales" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 3: Today's Payment Methods Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
            className="card"
            style={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChart size={16} style={{ color: '#10B981' }} />
                Today's Payment Breakdown
              </h4>
              <span className="badge badge-success text-xs">Payment Mix</span>
            </div>

            {paymentMix.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No payment transactions recorded today
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', height: 200 }}>
                <div style={{ width: '55%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={paymentMix}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {paymentMix.map((entry, index) => {
                          const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
                          return <Cell key={`pm-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        })}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const it = payload[0].payload
                            return (
                              <div style={{
                                background: 'rgba(17, 24, 39, 0.95)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: '0.8125rem'
                              }}>
                                <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 4 }}>{it.name}</div>
                                <div><strong style={{ color: '#10B981' }}>{fmt(it.amount)}</strong> ({it.pct.toFixed(0)}%)</div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.775rem' }}>
                  {paymentMix.map((pm, idx) => {
                    const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          {pm.name}
                        </span>
                        <strong>{pm.pct.toFixed(0)}%</strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Chart 4: Staff Contribution (Manager/Owner) OR Personal Pace Card (Salesperson) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="card"
            style={{ padding: '20px 24px' }}
          >
            {canViewAllReports ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} style={{ color: '#8B5CF6' }} />
                    Today's Staff Sales Share
                  </h4>
                  <span className="badge text-xs" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#C084FC' }}>Team Mix</span>
                </div>

                {staffReport.filter(s => s.total_sales > 0).length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No staff sales recorded today
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: 200 }}>
                    <div style={{ width: '55%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={staffReport.filter(s => s.total_sales > 0)}
                            dataKey="total_sales"
                            nameKey="user_name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                          >
                            {staffReport.filter(s => s.total_sales > 0).map((entry, index) => {
                              const PIE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899']
                              return <Cell key={`staff-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            })}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const it = payload[0].payload
                                return (
                                  <div style={{
                                    background: 'rgba(17, 24, 39, 0.95)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    fontSize: '0.8125rem'
                                  }}>
                                    <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 4 }}>{it.user_name}</div>
                                    <div><strong style={{ color: '#8B5CF6' }}>{fmt(it.total_sales)}</strong> ({it.invoice_count} bills)</div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.775rem' }}>
                      {staffReport.filter(s => s.total_sales > 0).map((s, idx) => {
                        const PIE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899']
                        const totalStaffSales = staffReport.reduce((acc, r) => acc + r.total_sales, 0)
                        const pct = totalStaffSales > 0 ? (s.total_sales / totalStaffSales) * 100 : 0
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                              {s.user_name}
                            </span>
                            <strong>{pct.toFixed(0)}%</strong>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
                    My Sales Metrics Today
                  </h4>
                  <span className="badge badge-primary text-xs">Personal Summary</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Average Bill Value
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                      {fmt(todayInvoices.length > 0 ? (todayInvoices.reduce((s, inv) => s + (inv.grand_total || 0), 0) / todayInvoices.length) : 0)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      Per customer basket
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Bills Completed
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 4 }}>
                      {todayInvoices.length} Bills
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      Generated today
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Main 2-Column Split Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: 24
      }}>
        {/* Left Column: Staff Performance OR Recent Sales Activity */}
        {canViewAllReports ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="card"
          >
            <div className="card-header">
              <Users size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Staff Sales Performance Today</span>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => navigate('/reports')}>
                Full Report <ArrowRight size={13} />
              </button>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 380 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Total Sales</th>
                    <th style={{ textAlign: 'right' }}>Bills</th>
                    {canViewProfit && <th style={{ textAlign: 'right' }}>Net Profit</th>}
                  </tr>
                </thead>
                <tbody>
                  {staffReport.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                        No sales recorded yet today.
                      </td>
                    </tr>
                  ) : (
                    staffReport.map(s => (
                      <tr key={s.user_id}>
                        <td style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.user_name}</td>
                        <td><span className="badge badge-neutral">{s.role}</span></td>
                        <td className="col-currency">{fmt(s.total_sales)}</td>
                        <td className="col-number">{s.invoice_count}</td>
                        {canViewProfit && (
                          <td className="col-currency" style={{ color: s.total_profit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                            {fmt(s.total_profit)}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                  {staffReport.length > 0 && (
                    <tr style={{ background: 'var(--color-surface-2)', fontWeight: 800 }}>
                      <td colSpan={2}><strong>Total</strong></td>
                      <td className="col-currency" style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                        {fmt(staffReport.reduce((s, r) => s + r.total_sales, 0))}
                      </td>
                      <td className="col-number">
                        {staffReport.reduce((s, r) => s + r.invoice_count, 0)}
                      </td>
                      {canViewProfit && (
                        <td className="col-currency" style={{ color: 'var(--color-profit)', fontSize: '0.95rem' }}>
                          {fmt(staffReport.reduce((s, r) => s + r.total_profit, 0))}
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="card"
          >
            <div className="card-header">
              <Clock size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Today's Recent Invoices</span>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => navigate('/sales')}>
                All Sales <ArrowRight size={13} />
              </button>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 380 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Time</th>
                    <th>Payment</th>
                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                        No invoices generated yet today.
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{inv.invoice_number}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {inv.datetime_created ? inv.datetime_created.slice(11, 16) : '—'}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                            {inv.payment_method}
                          </span>
                        </td>
                        <td className="col-currency" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {fmt(inv.grand_total)}
                        </td>
                        <td>
                          <span className={`badge ${inv.status === 'completed' ? 'badge-success' : inv.status === 'refunded' ? 'badge-danger' : 'badge-neutral'}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Right Column: Low Stock Alerts Table */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="card"
        >
          <div className="card-header">
            <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
            <span className="card-title">Low Stock Inventory Alerts</span>
            {canStock && (
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => navigate('/stock')}>
                View Stock Catalog <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div style={{ overflow: 'auto', maxHeight: 380 }}>
            {lowStock.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <CheckCircle2 size={36} style={{ color: 'var(--color-success)', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                  All items are well stocked!
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  No inventory items have dropped below their reorder threshold.
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th style={{ textAlign: 'right' }}>Quantity Left</th>
                    <th style={{ textAlign: 'right' }}>Reorder Mark</th>
                    <th style={{ textAlign: 'center' }}>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td className="col-number" style={{ color: item.qty <= 0 ? 'var(--color-danger)' : '#D97706', fontWeight: 800 }}>
                        {item.qty} pcs
                      </td>
                      <td className="col-number text-muted">{item.reorder} pcs</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${item.qty <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                          {item.qty <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, colorBg, sub }: {
  label: string; value: string; icon: React.ReactNode
  color: string; colorBg: string; sub?: string
}) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-color-bg': colorBg } as React.CSSProperties}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  )
}

