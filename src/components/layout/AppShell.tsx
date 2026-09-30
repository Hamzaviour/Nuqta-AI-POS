import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingCart, FileText, Package, ShoppingBag,
  BarChart3, LogOut, RefreshCw, Wrench,
  Store, User as UserIcon, MessageSquare, RotateCcw, Lock, Barcode as BarcodeIcon,
  Users, Clock, ChevronLeft, ChevronRight, Printer, Maximize2, Minimize2, Search
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHotkeys } from '../../contexts/HotkeyContext'
import { CommandPaletteModal } from './CommandPaletteModal'
import logoImg from '../../assets/logo.png'

interface NavItemDef {
  path: string
  label: string
  icon: React.ElementType
  hotkey?: string
  perm?: string
  badgeKey?: 'pending' | 'orders' | 'low_stock'
}

interface NavGroup {
  label: string
  items: NavItemDef[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Counter & Sales',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pos', label: 'POS Terminal', icon: ShoppingCart, hotkey: 'F1', perm: 'pos' },
      { path: '/pending-invoices', label: 'Pending Invoices', icon: Clock, perm: 'sales', badgeKey: 'pending' },
      { path: '/orders', label: 'Online Orders', icon: MessageSquare, perm: 'orders', badgeKey: 'orders' },
      { path: '/sales', label: 'Sales History', icon: FileText, hotkey: 'F4', perm: 'sales' },
      { path: '/returns', label: 'Returns & Refunds', icon: RotateCcw, perm: 'process_return' },
    ]
  },
  {
    label: 'Inventory & Catalog',
    items: [
      { path: '/stock', label: 'Stock & Products', icon: Package, perm: 'add_edit_stock', badgeKey: 'low_stock' },
      { path: '/barcode', label: 'Barcode Tags', icon: BarcodeIcon, perm: 'barcode' },
      { path: '/purchases', label: 'Purchases', icon: ShoppingBag, perm: 'record_purchase' },
    ]
  },
  {
    label: 'Finance & Management',
    items: [
      { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'view_all_reports' },
      { path: '/accounts', label: 'Accounts & Expense', icon: Store, perm: 'view_accounts' },
      { path: '/customers', label: 'Customer Accounts', icon: Users, perm: 'customers' },
      { path: '/day-close', label: 'Day Closing', icon: Lock, perm: 'day_closing' },
      { path: '/maintenance', label: 'System Maintenance', icon: Wrench, perm: 'access_maintenance' },
    ]
  }
]

const ROUTE_INFO: Record<string, { title: string; section: string }> = {
  '/dashboard': { title: 'Dashboard Overview', section: 'Counter' },
  '/pos': { title: 'POS Terminal', section: 'Counter' },
  '/pending-invoices': { title: 'Pending Invoices', section: 'Counter' },
  '/orders': { title: 'Online & WhatsApp Orders', section: 'Counter' },
  '/sales': { title: 'Sales History & Records', section: 'Sales' },
  '/returns': { title: 'Returns & Refunds', section: 'Sales' },
  '/stock': { title: 'Stock & Inventory Catalog', section: 'Inventory' },
  '/barcode': { title: 'Barcode Label Generator', section: 'Inventory' },
  '/purchases': { title: 'Supplier Purchases', section: 'Inventory' },
  '/day-close': { title: 'Day Closing Reconciliation', section: 'Finance' },
  '/accounts': { title: 'Accounts & Expense Ledger', section: 'Finance' },
  '/reports': { title: 'Financial Reports & Analytics', section: 'Finance' },
  '/customers': { title: 'Customer Directory & Ledgers', section: 'CRM' },
  '/maintenance': { title: 'System Administration & Setup', section: 'System' }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, logout, can } = useAuth()
  const [time, setTime] = useState(new Date())
  const [showChangeUser, setShowChangeUser] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement)
  const [hoveredNavItem, setHoveredNavItem] = useState<{ label: string; hotkey?: string; top: number } | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pos_sidebar_collapsed') === 'true'
  })

  // Synchronize fullscreen state with browser / Electron events
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  // Live badge counts
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [ordersCount, setOrdersCount] = useState<number>(0)
  const [lowStockCount, setLowStockCount] = useState<number>(0)

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('pos_sidebar_collapsed', String(next))
      return next
    })
  }

  // Poll live badge counts periodically
  const fetchBadgeCounts = async () => {
    try {
      if (window.api?.getPendingInvoices) {
        const pList = await window.api.getPendingInvoices()
        if (Array.isArray(pList)) {
          setPendingCount(pList.filter((i: any) => i.status === 'pending').length)
        }
      }
    } catch {}

    try {
      if (window.api?.getOnlineOrders) {
        const oList = await window.api.getOnlineOrders('pending')
        if (Array.isArray(oList)) {
          setOrdersCount(oList.length)
        }
      }
    } catch {}

    try {
      if (window.api?.getLowStockItems) {
        const lList = await window.api.getLowStockItems()
        if (Array.isArray(lList)) {
          setLowStockCount(lList.length)
        }
      }
    } catch {}
  }

  useEffect(() => {
    fetchBadgeCounts()
    const badgeTimer = setInterval(fetchBadgeCounts, 25000)
    return () => clearInterval(badgeTimer)
  }, [location.pathname])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useHotkeys({
    'F1': () => { if (location.pathname !== '/pos') navigate('/pos') },
    'F4': () => { if (location.pathname !== '/pos') navigate('/sales') },
    'Ctrl+B': () => toggleCollapse(),
    'Ctrl+K': () => setShowCommandPalette(prev => !prev),
    'F11': () => toggleFullscreen(),
    'Ctrl+F12': () => setShowChangeUser(true),
    'Ctrl+Shift+L': () => setShowLogoutConfirm(true),
    'Ctrl+Q': () => setShowLogoutConfirm(true),
  }, { priority: 0 })

  if (!currentUser) return null

  const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner'
      case 'manager': return 'Manager'
      default: return 'Sales Staff'
    }
  }

  const roleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner': return { bg: 'rgba(196,30,58,0.2)', color: '#FF758F', border: 'rgba(196,30,58,0.4)' }
      case 'manager': return { bg: 'rgba(2,132,199,0.2)', color: '#38BDF8', border: 'rgba(2,132,199,0.4)' }
      default: return { bg: 'rgba(16,185,129,0.2)', color: '#34D399', border: 'rgba(16,185,129,0.4)' }
    }
  }

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const isVisible = (perm?: string) => {
    if (currentUser.role === 'owner') return true
    if (!perm) return true
    return can(perm as any)
  }

  const currentRouteInfo = ROUTE_INFO[location.pathname] || { title: 'Point of Sale', section: 'System' }

  const getBadgeFor = (badgeKey?: string) => {
    if (badgeKey === 'pending' && pendingCount > 0) return { count: pendingCount, type: 'amber' as const }
    if (badgeKey === 'orders' && ordersCount > 0) return { count: ordersCount, type: 'emerald' as const }
    if (badgeKey === 'low_stock' && lowStockCount > 0) return { count: `${lowStockCount} Low`, type: 'rose' as const }
    return null
  }

  return (
    <div className="app-shell">
      {/* ---- MODERN LUXURY COLLAPSIBLE SIDEBAR ---- */}
      <nav className={`app-nav ${collapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="app-nav-brand">
          <img
            src={logoImg}
            alt="POS Logo"
            className="app-nav-logo-img"
            onClick={collapsed ? toggleCollapse : undefined}
            style={{ cursor: collapsed ? 'pointer' : 'default' }}
            title={collapsed ? 'Click to expand sidebar' : undefined}
          />
          {!collapsed && (
            <div className="app-nav-brand-text">
              <span className="app-nav-brand-title">MY STORE</span>
              <span className="app-nav-brand-sub">Wholesale & Retail POS</span>
            </div>
          )}
          <button
            type="button"
            className="nav-collapse-btn"
            onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse to compact rail (Ctrl+B)'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Status indicator strip (expanded mode only) */}
        {!collapsed && (
          <div className="nav-status-strip">
            <span className="topbar-pulse-dot" />
            <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em' }}>
              TERMINAL 01:
            </span>
            <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#34D399', letterSpacing: '0.04em' }}>
              SYSTEM ONLINE
            </span>
          </div>
        )}

        {/* Grouped Navigation Links */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => isVisible(item.perm))
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label} style={{ marginBottom: collapsed ? 6 : 10 }}>
                {!collapsed && (
                  <div className="nav-section-label">
                    {group.label}
                  </div>
                )}
                {collapsed && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 12px' }} />}
                {visibleItems.map(item => {
                  const active = isActive(item.path)
                  const badge = getBadgeFor(item.badgeKey)
                  const tooltipText = `${item.label}${item.hotkey ? ` (${item.hotkey})` : ''}`

                  return (
                    <motion.div
                      key={item.path}
                      whileHover={{ x: collapsed ? 0 : 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                      title={collapsed ? tooltipText : undefined}
                      onMouseEnter={(e) => {
                        if (collapsed) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoveredNavItem({
                            label: item.label,
                            hotkey: item.hotkey,
                            top: rect.top + rect.height / 2
                          })
                        }
                      }}
                      onMouseLeave={() => {
                        if (collapsed) setHoveredNavItem(null)
                      }}
                    >
                      <div className="nav-item-icon">
                        <item.icon size={17} />
                        {collapsed && badge && (
                          <span
                            className="nav-dot-badge"
                            style={{
                              background: badge.type === 'amber' ? '#F59E0B' : badge.type === 'emerald' ? '#10B981' : '#F43F5E',
                              boxShadow: `0 0 6px ${badge.type === 'amber' ? '#F59E0B' : badge.type === 'emerald' ? '#10B981' : '#F43F5E'}`
                            }}
                          />
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                          {badge && (
                            <span className={`nav-badge-pill ${badge.type}`}>
                              {badge.count}
                            </span>
                          )}
                          {item.hotkey && !badge && (
                            <kbd className="nav-hotkey-kbd">{item.hotkey}</kbd>
                          )}
                        </>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* User Profile Card in Footer */}
        <div className="nav-user-section">
          <div
            className="nav-user-card"
            onClick={() => setShowChangeUser(true)}
            title={collapsed ? `${currentUser.name} (${roleLabel(currentUser.role)}) — Switch Staff (Ctrl+F12)` : 'Click to switch staff account (Ctrl+F12)'}
          >
            <div className="nav-user-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="nav-user-info">
                  <div className="nav-user-name">{currentUser.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      background: roleBadgeStyle(currentUser.role).bg,
                      color: roleBadgeStyle(currentUser.role).color,
                      border: `1px solid ${roleBadgeStyle(currentUser.role).border}`,
                      lineHeight: 1.1
                    }}>
                      {roleLabel(currentUser.role)}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                      Ctrl+F12
                    </span>
                  </div>
                </div>
                <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Instant Floating Tooltip for Collapsed Sidebar */}
      {collapsed && hoveredNavItem && (
        <div className="nav-rail-floating-tooltip" style={{ top: hoveredNavItem.top }}>
          <span>{hoveredNavItem.label}</span>
          {hoveredNavItem.hotkey && <kbd className="nav-hotkey-kbd">{hoveredNavItem.hotkey}</kbd>}
        </div>
      )}

      {/* ---- MAIN CONTENT & STREAMLINED OPERATIONS TOP BAR ---- */}
      <div className="app-content">
        {/* Sleek Operations Action Bar */}
        <header className="operations-top-bar">
          {/* Left: Dynamic Breadcrumb & Register Tag & Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="topbar-breadcrumb-pill">
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {currentRouteInfo.section}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
              <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
                {currentRouteInfo.title}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(196, 30, 58, 0.12)', border: '1px solid rgba(196, 30, 58, 0.28)',
              color: '#FF758F', fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'var(--font-mono)'
            }}>
              <span>REG-01</span>
            </div>

            {/* Quick Search / Command Palette Trigger */}
            <div
              className="topbar-search-trigger"
              onClick={() => setShowCommandPalette(true)}
              title="Quick Search items, customers, navigation (Ctrl+K)"
            >
              <Search size={13} style={{ opacity: 0.6 }} />
              <span>Quick Search...</span>
              <kbd className="nav-hotkey-kbd" style={{ fontSize: '0.5625rem', padding: '1px 5px', marginLeft: 'auto' }}>Ctrl+K</kbd>
            </div>
          </div>

          {/* Center: Live Hardware & Server Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="topbar-status-pill">
              <span className="topbar-pulse-dot" />
              <span>Master Sync Online</span>
              <span style={{ opacity: 0.35 }}>•</span>
              <Printer size={12} style={{ color: '#34D399' }} />
              <span>80mm Ready</span>
            </div>
          </div>

          {/* Right: Fullscreen, Clock, Active Cashier & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Live Clock */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.775rem', color: 'rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              padding: '3px 9px', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)'
            }}>
              <Clock size={13} style={{ color: '#F59E0B' }} />
              <span>{time.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            {/* Kiosk Fullscreen Mode Toggle */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen Kiosk Mode (F11)'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Cashier profile switcher pill */}
            <div
              onClick={() => setShowChangeUser(true)}
              className="topbar-action-btn"
              title="Click to Switch User (Ctrl+F12)"
              style={{ cursor: 'pointer' }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'linear-gradient(135deg, #C41E3A, #7A0015)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 800, color: '#fff'
              }}>
                {initials}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#F1F5F9' }}>{currentUser.name}</span>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700,
                padding: '1px 5px', borderRadius: 3,
                background: roleBadgeStyle(currentUser.role).bg,
                color: roleBadgeStyle(currentUser.role).color,
                border: `1px solid ${roleBadgeStyle(currentUser.role).border}`,
                lineHeight: 1
              }}>
                {roleLabel(currentUser.role)}
              </span>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5', padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              title="Logout Session (Ctrl+Shift+L / Ctrl+Q)"
            >
              <LogOut size={12} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {children}
        </div>

        {/* Bottom Status & Hotkey Bar */}
        <div className="status-bar">
          <div className="status-bar-item highlight">
            <UserIcon size={13} style={{ color: 'var(--color-primary-light)' }} />
            <span>{currentUser.name}</span>
            <span style={{
              fontSize: '0.6875rem',
              color: roleBadgeStyle(currentUser.role).color,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              ({roleLabel(currentUser.role)})
            </span>
          </div>
          <div className="status-bar-sep">|</div>
          <div className="status-bar-item">
            {time.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            {[
              ['F1', 'POS Terminal'],
              ...(location.pathname === '/pos' ? [['F2', 'Select Customer']] : []),
              ['F4', location.pathname === '/pos' ? 'Prev Sales' : 'Sales History'],
              ['Ctrl+B', 'Sidebar'],
              ['Ctrl+K', 'Search'],
              ['F11', 'Fullscreen'],
              ['Ctrl+F12', 'Staff'],
              ['Ctrl+Shift+L', 'Logout'],
            ].map(([key, label]) => (
              <div key={key} className="status-bar-item" style={{ gap: 5 }}>
                <span className="hotkey" style={{ fontSize: '0.625rem' }}>{key}</span>
                <span style={{ fontSize: '0.725rem' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change User Modal */}
      {showChangeUser && (
        <ChangeUserModal onClose={() => setShowChangeUser(false)} />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />
      )}

      {/* Universal Command Palette Modal */}
      {showCommandPalette && (
        <CommandPaletteModal onClose={() => setShowCommandPalette(false)} />
      )}
    </div>
  )
}

function LogoutConfirmModal({ onClose }: { onClose: () => void }) {
  const { currentUser, logout } = useAuth()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        logout()
        onClose()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [logout, onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-header" style={{ background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogOut size={18} style={{ color: 'var(--color-danger)' }} />
            <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Log Out Session</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--color-danger)',
            border: '1.5px solid rgba(239, 68, 68, 0.25)'
          }}>
            <LogOut size={26} />
          </div>

          <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 6, fontSize: '1.1rem', fontWeight: 700 }}>
            End Current Session?
          </h4>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: 20 }}>
            You are logged in as <strong>{currentUser?.name}</strong>. Logging out will lock Terminal 01 and return to the pin login screen.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minWidth: 100 }}>
              Cancel <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                logout()
                onClose()
              }}
              style={{ minWidth: 130, fontWeight: 700 }}
              autoFocus
            >
              Log Out Now <span className="hotkey" style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', border: 'none', marginLeft: 4 }}>Enter</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function ChangeUserModal({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth()

  const handleSwitchUser = () => {
    logout()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <RefreshCw size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Switch User Account</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--color-primary-10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--color-primary)'
          }}>
            <UserIcon size={24} />
          </div>
          <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Switch Active Terminal Account?
          </h4>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
            Switching accounts will return to the login screen for staff verification.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSwitchUser}>
              Confirm Switch
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
