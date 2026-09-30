import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingCart, FileText, Package, ShoppingBag,
  BarChart3, LogOut, RefreshCw, Wrench,
  Store, User as UserIcon, MessageSquare, RotateCcw, Lock, Barcode as BarcodeIcon,
  Users, Clock
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHotkeys } from '../../contexts/HotkeyContext'
import { NuqtaLogo } from '../brand/NuqtaLogo'

interface NavGroup {
  label: string
  items: {
    path: string
    label: string
    icon: React.ElementType
    hotkey?: string
    perm?: string
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core Operations',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pos', label: 'POS Terminal', icon: ShoppingCart, hotkey: 'F1', perm: 'pos' },
      { path: '/pending-invoices', label: 'Pending Invoices', icon: Clock, perm: 'sales' },
      { path: '/orders', label: 'Online Orders', icon: MessageSquare, perm: 'orders' },
    ]
  },
  {
    label: 'Sales & Inventory',
    items: [
      { path: '/sales', label: 'Sales History', icon: FileText, perm: 'sales' },
      { path: '/returns', label: 'Returns & Refunds', icon: RotateCcw, perm: 'process_return' },
      { path: '/stock', label: 'Stock Catalog', icon: Package, perm: 'add_edit_stock' },
      { path: '/barcode', label: 'Barcode Tags', icon: BarcodeIcon, perm: 'barcode' },
      { path: '/purchases', label: 'Purchases', icon: ShoppingBag, perm: 'record_purchase' },
    ]
  },
  {
    label: 'Finance & Management',
    items: [
      { path: '/day-close', label: 'Day Close', icon: Lock, perm: 'day_closing' },
      { path: '/accounts', label: 'Accounts & Expense', icon: Store, perm: 'view_accounts' },
      { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'view_all_reports' },
      { path: '/customers', label: 'Customers', icon: Users, perm: 'customers' },
      { path: '/maintenance', label: 'System Maintenance', icon: Wrench, perm: 'access_maintenance' },
    ]
  }
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, logout, can } = useAuth()
  const [time, setTime] = useState(new Date())
  const [showChangeUser, setShowChangeUser] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useHotkeys({
    'F1': () => navigate('/pos'),
    'Ctrl+F12': () => setShowChangeUser(true),
    'Ctrl+Shift+L': () => setShowLogoutConfirm(true),
    'Ctrl+Q': () => setShowLogoutConfirm(true),
    'F11': () => setShowLogoutConfirm(true),
  })

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
      case 'owner': return { bg: 'rgba(47, 75, 245,0.2)', color: '#9DB0FF', border: 'rgba(47, 75, 245,0.4)' }
      case 'manager': return { bg: 'rgba(139,92,246,0.2)', color: '#C4B5FD', border: 'rgba(139,92,246,0.4)' }
      default: return { bg: 'rgba(16,185,129,0.2)', color: '#34D399', border: 'rgba(16,185,129,0.4)' }
    }
  }

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const currentGroup = NAV_GROUPS.find(g => g.items.some(i => isActive(i.path)))?.label
  const currentPage = NAV_GROUPS.flatMap(g => g.items).find(i => isActive(i.path))

  const isVisible = (perm?: string) => {
    if (currentUser.role === 'owner') return true
    if (!perm) return true
    return can(perm as any)
  }

  return (
    <div className="app-shell">
      {/* ---- SIDEBAR ---- */}
      <nav className="app-nav">
        {/* Brand + terminal status */}
        <div className="app-nav-brand">
          <NuqtaLogo size={30} descriptor="AI POS" />
          <div className="app-nav-terminal" title="This terminal is online">
            <span className="app-nav-terminal-dot" />
            <span>Terminal 01</span>
            <span style={{ marginLeft: 'auto', color: '#6EE7B7' }}>Online</span>
          </div>
        </div>

        {/* Grouped Navigation Links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {NAV_GROUPS.map((group, gIdx) => {
            const visibleItems = group.items.filter(item => isVisible(item.perm))
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label} style={{ marginBottom: 12 }}>
                <div className="nav-section-label">
                  {group.label}
                </div>
                {visibleItems.map(item => {
                  const active = isActive(item.path)
                  return (
                    <motion.div
                      key={item.path}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                    >
                      <div className="nav-item-icon">
                        <item.icon size={17} />
                      </div>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.hotkey && (
                        <span className="nav-badge">{item.hotkey}</span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* User Card in Footer */}
        <div className="nav-user-section">
          <div className="nav-user-card" onClick={() => setShowChangeUser(true)} title="Click to switch user (Ctrl+F12)">
            <div className="nav-user-avatar">{initials}</div>
            <div className="nav-user-info">
              <div className="nav-user-name">{currentUser.name}</div>
              <div className="nav-user-role" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  background: roleBadgeStyle(currentUser.role).bg,
                  color: roleBadgeStyle(currentUser.role).color,
                  border: `1px solid ${roleBadgeStyle(currentUser.role).border}`
                }}>
                  {roleLabel(currentUser.role)}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)' }}>
                  Ctrl+F12
                </span>
              </div>
            </div>
            <RefreshCw size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      </nav>

      {/* ---- MAIN CONTENT & BRAND TOP BAR ---- */}
      <div className="app-content">
        {/* Top bar: where you are + clock + logout */}
        <div className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span className="app-topbar-title">{currentPage?.label ?? 'Nuqta'}</span>
            {currentGroup && <span className="app-topbar-crumb">{currentGroup}</span>}
          </div>

          {/* Right: Clock & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.775rem',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)'
            }}>
              <Clock size={13} style={{ color: 'var(--color-accent)' }} />
              <span>{time.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#FCA5A5',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Logout Session (Ctrl+Shift+L / Ctrl+Q)"
            >
              <LogOut size={13} />
              <span>Logout</span>
              <span className="hotkey" style={{ fontSize: '0.5625rem', background: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none' }}>
                Ctrl+Shift+L
              </span>
            </button>
          </div>
        </div>

        {/* Page Viewport */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {children}
        </div>

        {/* Bottom Status & Hotkey Bar */}
        <div className="status-bar">
          <div className="status-bar-item highlight">
            <UserIcon size={14} style={{ color: 'var(--color-primary-light)' }} />
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

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            {[
              ['F1', 'POS Terminal'],
              ['F2', 'Customer'],
              ['F3', 'New Tab'],
              ['F4', 'Previous Sales'],
              ['F9', 'Hold Bill'],
              ['F10', 'Item Search'],
              ['Ctrl+Shift+L', 'Logout'],
            ].map(([key, label]) => (
              <div key={key} className="status-bar-item" style={{ gap: 6 }}>
                <span className="hotkey">{key}</span>
                <span style={{ fontSize: '0.75rem' }}>{label}</span>
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
