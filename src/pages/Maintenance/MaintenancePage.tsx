import React, { useEffect, useState } from 'react'
import {
  Users, Settings, RefreshCw, HardDrive, Shield,
  Plus, Edit2, CheckCircle, X, ToggleLeft, ToggleRight,
  AlertTriangle, Lock, Unlock, Image, Upload, Trash2,
  Sliders, Check, HelpCircle, QrCode, Smartphone, Copy, ExternalLink, MessageSquare, Send,
  Globe, Download, Play, Square, Radio, Loader2, Mic, Sparkles, Cpu, Server, Wifi, Laptop,
  Cloud, CloudRain, Folder, Calendar, WifiOff
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type {
  User, AuditLogRow, MobileServerInfo, WhatsAppConfig,
  CloudflareCheckResult, CloudflareStatus, DiscoveredMasterServer, ActiveTerminalInfo,
  GDriveConfig
} from '../../types'
import { getTerminalConfig, saveTerminalConfig, initTerminalSync } from '../../services/apiAdapter'
import defaultInvoiceLogo from '../../assets/invoice_logo.png'
import defaultWhatsAppQR from '../../assets/whatsapp_qr.png'
import toast from 'react-hot-toast'

// ============================================================
// HIERARCHICAL MODULE & PERMISSION ARCHITECTURE
// When the owner grants access to a module, all granular action
// checks for that module are grouped and configured directly below it.
// ============================================================
export interface SubPermissionDef {
  key: string
  label: string
  desc: string
  isDiscountLimit?: boolean
  ownerOnly?: boolean
  warningBadge?: string
}

export interface ModulePermissionBlock {
  moduleId: string
  moduleName: string
  route: string
  icon: string
  masterKey: string
  desc: string
  ownerOnly?: boolean
  subPerms: SubPermissionDef[]
}

const MODULE_PERMISSIONS: ModulePermissionBlock[] = [
  {
    moduleId: 'pos',
    moduleName: 'Point of Sale (POS) & Counter Billing',
    route: '/pos',
    icon: '🛒',
    masterKey: 'perm_pos',
    desc: 'Access counter sales, barcode scanning, cart management, customer selection, and cash/card checkout.',
    subPerms: [
      {
        key: 'perm_apply_discount',
        label: 'Apply Line & Bill Discounts',
        desc: 'Allow user to give custom % or flat Rs discounts to customers during counter checkout.'
      },
      {
        key: 'perm_discount_limit',
        label: 'Maximum Allowed Discount Limit (%)',
        desc: 'Upper percentage limit this user can apply on an invoice without supervisor PIN override.',
        isDiscountLimit: true
      },
      {
        key: 'perm_edit_price',
        label: 'Edit Item Selling Price in POS Cart',
        desc: 'Allow user to manually adjust unit selling prices in POS cart (including below cost price) via shortcut (F6) or clicking the price.',
        warningBadge: 'Custom Pricing'
      },
      {
        key: 'perm_void_invoice',
        label: 'Void / Cancel Active Invoices',
        desc: 'Allow canceling invoices with automatic inventory stock replenishment.'
      },
      {
        key: 'perm_edit_invoice',
        label: 'Edit Invoices After Checkout',
        desc: 'Allow modifying prices, items, or quantities on completed invoices.',
        warningBadge: 'High Risk / Supervisor'
      },
      {
        key: 'perm_open_cash_drawer',
        label: 'Manual Cash Drawer Pop',
        desc: 'Allow triggering the physical cash drawer to open without completing a sale.'
      },
      {
        key: 'perm_view_profit',
        label: 'View Real-Time Profit & Margin Markup',
        desc: 'Displays profit and margin percentage in the POS checkout sidebar.'
      },
      {
        key: 'perm_view_cost_price',
        label: 'View Wholesale Item Cost Prices',
        desc: 'Shows item purchase cost prices inside search results and cart items.'
      }
    ]
  },
  {
    moduleId: 'stock',
    moduleName: 'Stock, Products & Inventory Management',
    route: '/stock',
    icon: '📦',
    masterKey: 'perm_add_edit_stock',
    desc: 'Access inventory levels, product catalog, quantity reports, low stock alerts, and stock adjustments.',
    subPerms: [
      {
        key: 'perm_view_cost_price',
        label: 'View Item Cost Price in Inventory Catalog',
        desc: 'Reveals purchase cost and margin calculation in the stock table.'
      },
      {
        key: 'perm_stock_adjustment',
        label: 'Perform Manual Stock Quantity Adjustments',
        desc: 'Allows modifying physical quantity on hand for damaged goods or shrinkage.'
      }
    ]
  },
  {
    moduleId: 'purchases',
    moduleName: 'Purchases, Purchase Orders & Supplier Bills',
    route: '/purchases',
    icon: '🚚',
    masterKey: 'perm_view_purchases',
    desc: 'Create supplier purchase orders, restock inventory, track bills, and settle payables.',
    subPerms: [
      {
        key: 'perm_create_purchase',
        label: 'Create Purchase Invoices & Add Stock Inflow',
        desc: 'Permits creating supplier purchase orders and increasing stock counts.'
      },
      {
        key: 'perm_pay_supplier',
        label: 'Settle Supplier Accounts & Record Outgoing Payments',
        desc: 'Permits making outgoing payments to suppliers and updating AP balances.'
      }
    ]
  },
  {
    moduleId: 'returns',
    moduleName: 'Sales Returns, Replacements & Customer Refunds',
    route: '/returns',
    icon: '↩️',
    masterKey: 'perm_sales_returns',
    desc: 'Process item returns, restore inventory stock on hand, and issue customer cash/credit refunds.',
    subPerms: [
      {
        key: 'perm_sales_returns',
        label: 'Process & Approve Item Returns',
        desc: 'Allows refunding customer invoices and automatically restoring returned quantities into stock.'
      }
    ]
  },
  {
    moduleId: 'day_close',
    moduleName: 'Day Closing, Cash Drawer & Reconciliation',
    route: '/day-close',
    icon: '🔒',
    masterKey: 'perm_day_closing',
    desc: 'Reconcile drawer cash, count physical denominations, and lock invoices for the business date.',
    subPerms: [
      {
        key: 'perm_day_closing',
        label: 'Perform Day Closing & Lock Daily Invoices',
        desc: 'Permits submitting cash reconciliation, locking day sales, and generating Z-reports.'
      }
    ]
  },
  {
    moduleId: 'expenses',
    moduleName: 'Shop Expenses & Petty Cash Outflows',
    route: '/expenses',
    icon: '💸',
    masterKey: 'perm_expenses',
    desc: 'Record daily operating costs (rent, utilities, tea, staff lunch, delivery fees).',
    subPerms: [
      {
        key: 'perm_expenses',
        label: 'Record & Delete Store Expenses',
        desc: 'Allows adding operational expenses and deducting petty cash from the register.'
      }
    ]
  },
  {
    moduleId: 'reports',
    moduleName: 'Financial Reports, Analytics & P&L Statements',
    route: '/reports',
    icon: '📊',
    masterKey: 'perm_view_reports',
    desc: 'Access Daily Sales, Staff Sales Performance, Profit & Loss statements, and Statements.',
    subPerms: [
      {
        key: 'perm_view_staff_sales',
        label: 'View All Staff Members Sales Performance',
        desc: 'See sales aggregated across all staff members and daily revenue breakdowns.'
      },
      {
        key: 'perm_view_profit',
        label: 'View Profit & Loss Financial Statements',
        desc: 'Access Gross Profit, COGS, and Net Income reporting.'
      }
    ]
  }
]

export default function MaintenancePage() {
  const { currentUser, canAccessMaintenance } = useAuth()
  const [tab, setTab] = useState<'users' | 'setup' | 'voice_ai' | 'terminal_sync' | 'mobile' | 'reindex' | 'backup' | 'audit'>('users')

  if (!canAccessMaintenance) {
    return (
      <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <Lock size={48} style={{ color: 'var(--color-danger)', marginBottom: 16 }} />
          <h3>Access Denied</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            The Maintenance module is restricted to Owner only.
            Contact the system owner to request access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header">
        <Shield size={20} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h3 className="page-header-title">Maintenance</h3>
          <div className="page-header-subtitle">System administration & security audit — Owner access only</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px', flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {[
          { key: 'users',         label: 'User Settings', icon: Users },
          { key: 'setup',         label: 'System Setup',  icon: Settings },
          { key: 'voice_ai',      label: 'Voice AI POS Assistant', icon: Mic },
          { key: 'terminal_sync', label: 'Multi-Terminal & LAN Sync', icon: Server },
          { key: 'mobile',        label: 'Mobile & WhatsApp Remote', icon: Globe },
          { key: 'reindex',       label: 'Data Reindex',  icon: RefreshCw },
          { key: 'backup',        label: 'Backup & Restore', icon: HardDrive },
          { key: 'audit',         label: 'Audit Trail',   icon: Shield },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} style={{
            padding: '12px 18px',
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: tab === t.key ? 700 : 500,
            cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s',
            marginBottom: -1, fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', flexShrink: 0
          }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'users'         && <UserSettingsTab />}
        {tab === 'setup'         && <SystemSetupTab />}
        {tab === 'voice_ai'      && <VoiceAIAssistantTab />}
        {tab === 'terminal_sync' && <MultiTerminalSyncTab />}
        {tab === 'mobile'        && <MobileWhatsAppTab />}
        {tab === 'reindex'       && <ReindexTab />}
        {tab === 'backup'        && <BackupTab />}
        {tab === 'audit'         && <AuditTrailTab />}
      </div>
    </div>
  )
}

// ============================================================
// USER SETTINGS TAB — Core permission management UI
// ============================================================
function UserSettingsTab() {
  const { currentUser } = useAuth()
  const [users, setUsers]           = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [localPerms, setLocalPerms] = useState<Record<string, number>>({})
  const [localDiscountLimit, setLocalDiscountLimit] = useState('')
  const [showPinReset, setShowPinReset] = useState(false)
  const [newPin, setNewPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // Edit user profile state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName]               = useState('')
  const [editUsername, setEditUsername]       = useState('')
  const [editRole, setEditRole]               = useState<'owner' | 'manager' | 'salesperson'>('salesperson')
  const [savingProfile, setSavingProfile]     = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    const result = await window.api.getAllUsers(currentUser!.id)
    if (result.success && result.data) setUsers(result.data)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const selectUser = (user: User) => {
    setSelectedUser(user)
    setEditName(user.name)
    setEditUsername(user.username)
    setEditRole(user.role)
    setShowEditProfile(false)
    // Copy all perm values to local state for editing
    const perms: Record<string, number> = {}
    MODULE_PERMISSIONS.forEach(m => {
      perms[m.masterKey] = (user as unknown as Record<string, number>)[m.masterKey] ?? 0
      m.subPerms.forEach(p => {
        if (!p.isDiscountLimit) {
          perms[p.key] = (user as unknown as Record<string, number>)[p.key] ?? 0
        }
      })
    })
    setLocalPerms(perms)
    setLocalDiscountLimit((user.perm_discount_limit ?? 0).toString())
    setShowPinReset(false)
    setNewPin(''); setConfirmPin('')
  }

  const applyPreset = (presetName: 'admin' | 'manager' | 'cashier' | 'lock') => {
    if (!selectedUser) return
    const newPerms: Record<string, number> = {}

    if (presetName === 'admin') {
      MODULE_PERMISSIONS.forEach(m => {
        newPerms[m.masterKey] = 1
        m.subPerms.forEach(p => { if (!p.isDiscountLimit) newPerms[p.key] = 1 })
      })
      setLocalDiscountLimit('100')
      toast.success('Applied Full Admin / Owner Preset')
    } else if (presetName === 'manager') {
      MODULE_PERMISSIONS.forEach(m => {
        const isMaint = m.moduleId === 'maintenance'
        newPerms[m.masterKey] = isMaint ? 0 : 1
        m.subPerms.forEach(p => {
          if (!p.isDiscountLimit) {
            newPerms[p.key] = (p.ownerOnly || isMaint) ? 0 : 1
          }
        })
      })
      setLocalDiscountLimit('25')
      toast.success('Applied Standard Manager Preset')
    } else if (presetName === 'cashier') {
      MODULE_PERMISSIONS.forEach(m => {
        const isAllowedModule = ['pos', 'sales', 'orders', 'customers'].includes(m.moduleId)
        newPerms[m.masterKey] = isAllowedModule ? 1 : 0
        m.subPerms.forEach(p => {
          if (!p.isDiscountLimit) {
            if (['perm_void_invoice', 'perm_edit_invoice', 'perm_view_cost_price', 'perm_view_profit'].includes(p.key)) {
              newPerms[p.key] = 0
            } else if (isAllowedModule) {
              newPerms[p.key] = 1
            } else {
              newPerms[p.key] = 0
            }
          }
        })
      })
      setLocalDiscountLimit('10')
      toast.success('Applied Standard Cashier / Salesperson Preset')
    } else if (presetName === 'lock') {
      MODULE_PERMISSIONS.forEach(m => {
        newPerms[m.masterKey] = 0
        m.subPerms.forEach(p => { if (!p.isDiscountLimit) newPerms[p.key] = 0 })
      })
      setLocalDiscountLimit('0')
      toast.success('Locked & Restricted All Modules')
    }

    setLocalPerms(newPerms)
  }

  const handleSaveProfile = async () => {
    if (!selectedUser || !editName.trim() || !editUsername.trim()) {
      toast.error('Full Name and Username are required.')
      return
    }
    setSavingProfile(true)
    const res = await window.api.updateUserProfile(currentUser!.id, selectedUser.id, {
      name: editName.trim(),
      username: editUsername.trim(),
      role: editRole
    })
    if (res.success && res.data) {
      toast.success(`User updated: ${editName.trim()}`)
      setSelectedUser(prev => prev ? {
        ...prev,
        name: editName.trim(),
        username: editUsername.trim(),
        role: editRole
      } : null)
      setShowEditProfile(false)
      loadUsers()
    } else {
      toast.error(res.error || 'Failed to update user profile')
    }
    setSavingProfile(false)
  }

  const togglePerm = (key: string) => {
    // Owner cannot remove their own manage_users
    if (selectedUser?.id === currentUser!.id && key === 'perm_manage_users' && localPerms[key] === 1) {
      toast.error('Cannot remove your own user management permission.')
      return
    }
    setLocalPerms(prev => ({ ...prev, [key]: prev[key] ? 0 : 1 }))
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return
    setSaving(true)
    const permsToSave: Record<string, unknown> = { ...localPerms, perm_discount_limit: parseFloat(localDiscountLimit) || 0 }
    const result = await window.api.updateUserPermissions(currentUser!.id, selectedUser.id, permsToSave)
    if (result.success) {
      toast.success(`Permissions saved for ${selectedUser.name}`)
      loadUsers()
    } else {
      toast.error(result.error || 'Failed to save permissions')
    }
    setSaving(false)
  }

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser!.id) { toast.error('Cannot deactivate your own account.'); return }
    const newState = !user.is_active
    const result = await window.api.toggleUserActive(currentUser!.id, user.id, newState)
    if (result.success) {
      toast.success(`${user.name} ${newState ? 'activated' : 'deactivated'}`)
      loadUsers()
      if (selectedUser?.id === user.id) setSelectedUser(prev => prev ? { ...prev, is_active: newState ? 1 : 0 } : null)
    }
  }

  const handleResetPin = async () => {
    if (!selectedUser || !newPin || newPin !== confirmPin) {
      toast.error('PINs do not match or are empty'); return
    }
    if (newPin.length < 4) { toast.error('PIN must be at least 4 digits'); return }
    const result = await window.api.resetUserPin(currentUser!.id, selectedUser.id, newPin)
    if (result.success) {
      toast.success(`PIN reset for ${selectedUser.name}`)
      setShowPinReset(false); setNewPin(''); setConfirmPin('')
    } else {
      toast.error(result.error || 'Failed')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    if (selectedUser.id === currentUser!.id) {
      toast.error('Cannot delete your own logged-in account.')
      return
    }
    if (!window.confirm(`Are you sure you want to permanently delete user "${selectedUser.name}" (@${selectedUser.username})? This action cannot be undone.`)) {
      return
    }
    const res = await window.api.deleteUser(currentUser!.id, selectedUser.id)
    if (res.success) {
      toast.success(`User "${selectedUser.name}" deleted successfully.`)
      setSelectedUser(null)
      loadUsers()
    } else {
      toast.error(res.error || 'Failed to delete user.')
    }
  }

  const roleLabel = (r: string) => ({ owner: 'Owner', manager: 'Manager', salesperson: 'Sales Person' }[r] || r)
  const roleColor = (r: string) => ({ owner: 'var(--color-primary)', manager: 'var(--color-info)', salesperson: 'var(--color-success)' }[r] || 'var(--color-text-muted)')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* User list */}
      <div style={{ width: 270, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary btn-sm btn-full" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add New User
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : users.map(user => (
            <div
              key={user.id}
              onClick={() => selectUser(user)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--color-surface-2)',
                background: selectedUser?.id === user.id ? 'var(--color-primary-10)' : 'transparent',
                borderLeft: selectedUser?.id === user.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                opacity: user.is_active ? 1 : 0.5,
                transition: 'all 0.1s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: roleColor(user.role),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0
                }}>
                  {user.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name}
                    {user.id === currentUser!.id && <span style={{ fontSize: '0.625rem', marginLeft: 4, color: 'var(--color-text-muted)' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: roleColor(user.role), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {roleLabel(user.role)}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={e => { e.stopPropagation(); handleToggleActive(user) }}
                  title={user.is_active ? 'Deactivate user' : 'Activate user'}
                  disabled={user.id === currentUser!.id}
                >
                  {user.is_active
                    ? <ToggleRight size={16} style={{ color: 'var(--color-success)' }} />
                    : <ToggleLeft  size={16} style={{ color: 'var(--color-text-muted)' }} />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permission editor */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {!selectedUser ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <Shield size={40} style={{ opacity: 0.3 }} />
            <h3>Select a User</h3>
            <p>Select a user from the list to view and configure their module permissions and action checks.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 780 }}>
            {/* User header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
              padding: 20, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 12
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: roleColor(selectedUser.role),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '1.25rem', flexShrink: 0
              }}>
                {selectedUser.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>{selectedUser.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="badge" style={{ background: `${roleColor(selectedUser.role)}20`, color: roleColor(selectedUser.role) }}>
                    {roleLabel(selectedUser.role)}
                  </span>
                  <span className="text-muted text-xs">@{selectedUser.username}</span>
                  {!selectedUser.is_active && <span className="badge badge-danger">Inactive</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setShowEditProfile(!showEditProfile)
                    setShowPinReset(false)
                  }}
                >
                  <Edit2 size={13} /> Edit Details
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowPinReset(!showPinReset)
                    setShowEditProfile(false)
                  }}
                >
                  <Lock size={13} /> Reset PIN
                </button>
                {selectedUser.id !== currentUser!.id && (
                  <button
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={handleDeleteUser}
                    title="Permanently delete this user"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>

            {/* Edit User Profile / Name Panel */}
            {showEditProfile && (
              <div style={{
                marginBottom: 20, padding: 18,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-primary)', borderRadius: 12,
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h5 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Edit2 size={15} /> Edit User Details
                  </h5>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowEditProfile(false)}>
                    <X size={14} />
                  </button>
                </div>

                <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Muhammad Hassan"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username (Login ID) *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. hassan"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-input"
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as any)}
                      disabled={selectedUser.id === currentUser!.id && selectedUser.role === 'owner'}
                    >
                      <option value="salesperson">Sales Person (Staff)</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner (Full Administrator)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowEditProfile(false)}
                    disabled={savingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    <CheckCircle size={14} /> {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* PIN Reset */}
            {showPinReset && (
              <div style={{
                marginBottom: 20, padding: 16,
                background: 'var(--color-warning-bg)',
                border: '1px solid #FCD34D', borderRadius: 10
              }}>
                <h5 style={{ marginBottom: 12, color: 'var(--color-warning)' }}>
                  <Lock size={14} style={{ marginRight: 6, display: 'inline' }} />
                  Reset PIN for {selectedUser.name}
                </h5>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">New PIN (4–6 digits)</label>
                    <input className="form-input" type="password" placeholder="Enter new PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                    <label className="form-label">Confirm PIN</label>
                    <input className="form-input" type="password" placeholder="Repeat PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleResetPin}>Set PIN</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowPinReset(false); setNewPin(''); setConfirmPin('') }}><X size={13} /></button>
                </div>
              </div>
            )}

            {/* Quick Presets Ribbon */}
            <div style={{
              marginBottom: 20, padding: '14px 18px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sliders size={15} style={{ color: 'var(--color-primary)' }} /> Quick Role Presets
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Instantly configure all modules & action checks with recommended templates
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ border: '1px solid var(--color-border)', fontSize: '0.75rem' }}
                  onClick={() => applyPreset('admin')}
                  title="Grant full access to all modules and checks"
                >
                  👑 Full Admin
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ border: '1px solid var(--color-border)', fontSize: '0.75rem' }}
                  onClick={() => applyPreset('manager')}
                  title="Manager permissions (Stock, Purchases, POS, Accounts, Reports)"
                >
                  👔 Manager
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ border: '1px solid var(--color-border)', fontSize: '0.75rem' }}
                  onClick={() => applyPreset('cashier')}
                  title="Cashier permissions (POS, Sales, Orders only)"
                >
                  🛍️ Cashier / Sales
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  style={{ border: '1px solid var(--color-border)', fontSize: '0.75rem' }}
                  onClick={() => applyPreset('lock')}
                  title="Disable all modules and lock user access"
                >
                  🔒 Lock All
                </button>
              </div>
            </div>

            {/* Hierarchical Module & Granular Checks Cards */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Module Permissions & Granular Action Checks</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  When a module is enabled, configure each action check beneath it to specify exact user privileges.
                </div>
              </div>
            </div>

            {MODULE_PERMISSIONS.map(module => {
              const isMasterEnabled = !!localPerms[module.masterKey]
              const isOwner = selectedUser.role === 'owner'
              const isOwnerOnly = !!module.ownerOnly

              return (
                <div
                  key={module.moduleId}
                  style={{
                    marginBottom: 16,
                    background: 'var(--color-surface)',
                    border: isMasterEnabled ? '1px solid var(--color-primary-30, var(--color-border))' : '1px solid var(--color-border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: isMasterEnabled ? '0 2px 6px rgba(0,0,0,0.03)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Module Master Header */}
                  <div style={{
                    padding: '14px 18px',
                    background: isMasterEnabled ? 'var(--color-surface-2)' : 'var(--color-surface)',
                    borderBottom: isMasterEnabled ? '1px solid var(--color-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{module.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {module.moduleName}
                          <span className="font-mono text-xs" style={{ background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                            {module.route}
                          </span>
                          {isOwnerOnly && (
                            <span className="badge badge-danger" style={{ fontSize: '0.625rem' }}>Owner Only</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {module.desc}
                        </div>
                      </div>
                    </div>

                    {/* Master Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isMasterEnabled ? 'var(--color-success)' : 'var(--color-text-muted)'
                      }}>
                        {isMasterEnabled ? 'MODULE ACTIVE' : 'MODULE OFF'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePerm(module.masterKey)}
                        disabled={isOwnerOnly && !isOwner}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center',
                          color: isMasterEnabled ? 'var(--color-success)' : 'var(--color-surface-3)'
                        }}
                        title={isMasterEnabled ? 'Click to disable module access' : 'Click to enable module access'}
                      >
                        {isMasterEnabled
                          ? <ToggleRight size={30} style={{ color: 'var(--color-success)' }} />
                          : <ToggleLeft  size={30} style={{ color: 'var(--color-surface-3)' }} />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Sub-Checks / Granular Permissions Below The Module */}
                  <div style={{
                    padding: '14px 18px',
                    background: isMasterEnabled ? 'var(--color-surface)' : 'var(--color-surface-1)',
                    opacity: isMasterEnabled ? 1 : 0.45,
                    pointerEvents: isMasterEnabled ? 'auto' : 'none'
                  }}>
                    {!isMasterEnabled ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0'
                      }}>
                        <Lock size={13} />
                        Module is currently disabled. Toggle the switch above to grant access and configure granular action checks.
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--color-primary)',
                          marginBottom: 10,
                          display: 'flex', alignItems: 'center', gap: 6
                        }}>
                          <span>Granular Action Checks & Access Restrictions</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {module.subPerms.map(sub => {
                            if (sub.isDiscountLimit) {
                              return (
                                <div
                                  key={sub.key}
                                  style={{
                                    padding: '10px 14px',
                                    background: 'var(--color-surface-2)',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    border: '1px solid var(--color-border)',
                                    gap: 12
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{sub.label}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{sub.desc}</div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input
                                      type="number"
                                      className="form-input"
                                      style={{ width: 70, textAlign: 'center', padding: '4px 8px', height: 32 }}
                                      value={localDiscountLimit}
                                      onChange={e => setLocalDiscountLimit(e.target.value)}
                                      min={0} max={100}
                                    />
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>%</span>
                                  </div>
                                </div>
                              )
                            }

                            const isSubEnabled = !!localPerms[sub.key]
                            const isSubOwnerOnly = !!sub.ownerOnly

                            return (
                              <div
                                key={sub.key}
                                style={{
                                  padding: '10px 14px',
                                  background: 'var(--color-surface-2)',
                                  borderRadius: 8,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  border: '1px solid var(--color-border)',
                                  gap: 14
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {sub.label}
                                    {sub.warningBadge && (
                                      <span className="badge badge-warning" style={{ fontSize: '0.5625rem' }}>{sub.warningBadge}</span>
                                    )}
                                    {isSubOwnerOnly && (
                                      <span className="badge badge-danger" style={{ fontSize: '0.5625rem' }}>Owner Only</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{sub.desc}</div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => togglePerm(sub.key)}
                                  disabled={isSubOwnerOnly && !isOwner}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    color: isSubEnabled ? 'var(--color-success)' : 'var(--color-text-muted)'
                                  }}
                                  title={isSubEnabled ? 'Click to revoke check' : 'Click to grant check'}
                                >
                                  {isSubEnabled ? (
                                    <>
                                      <ToggleRight size={24} style={{ color: 'var(--color-success)' }} />
                                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-success)' }}>Allowed</span>
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={24} style={{ color: 'var(--color-surface-3)' }} />
                                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Denied</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Save button bar */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--color-border)'
            }}>
              <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Cancel</button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSavePermissions}
                disabled={saving}
              >
                <CheckCircle size={16} />
                {saving ? 'Saving Changes...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddUserModal onSave={async (data) => {
        const result = await window.api.createUser(currentUser!.id, data)
        if (result.success) {
          toast.success(`User ${data.name} created`)
          setShowAdd(false)
          loadUsers()
        } else {
          toast.error(result.error || 'Failed to create user')
        }
      }} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ============================================================
// ADD USER MODAL
// ============================================================
function AddUserModal({ onSave, onClose }: { onSave: (data: { name: string; username: string; pin: string; role: string; [key: string]: unknown }) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', username: '', pin: '', confirmPin: '', role: 'salesperson'
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.pin !== form.confirmPin) { toast.error('PINs do not match'); return }
    if (form.pin.length < 4) { toast.error('PIN must be at least 4 digits'); return }
    if (!form.name || !form.username) { toast.error('Name and username are required'); return }

    // Set default permissions based on role
    const defaultPerms: Record<string, number | string> = {
      perm_apply_discount: 1,
      perm_discount_limit: form.role === 'owner' ? 100 : form.role === 'manager' ? 20 : 10,
    }
    if (form.role === 'manager') {
      Object.assign(defaultPerms, {
        perm_view_cost_price: 1, perm_view_profit: 1,
        perm_void_invoice: 1, perm_edit_invoice: 1,
        perm_process_return: 1, perm_add_edit_stock: 1,
        perm_record_purchase: 1, perm_view_accounts: 1,
        perm_view_all_reports: 1, perm_day_closing: 0
      })
    }

    onSave({ ...form, ...defaultPerms })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Plus size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Add New User</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ahmed Khan" required />
            </div>
            <div className="form-group">
              <label className="form-label">Username (for login) *</label>
              <input className="form-input" value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g,''))} placeholder="e.g. ahmed" required />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="salesperson">Sales Person</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">PIN (4–6 digits) *</label>
                <input className="form-input" type="password" value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="e.g. 1234" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm PIN *</label>
                <input className="form-input" type="password" value={form.confirmPin} onChange={e => set('confirmPin', e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Repeat PIN" />
              </div>
            </div>
            <div style={{ padding: 10, background: 'var(--color-info-bg)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--color-info)' }}>
              ℹ After creating the user, go to their profile to fine-tune individual permissions.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={15} /> Create User</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// SYSTEM SETUP TAB
// ============================================================
function SystemSetupTab() {
  const { currentUser } = useAuth()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const qrFileInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getAllSettings().then(s => setSettings(s as unknown as Record<string, string>))
  }, [])

  const set = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }))

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (.png, .jpg, .webp)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      set('receipt_header_logo', base64)
      toast.success('Logo uploaded! Click "Save Settings" to apply.')
    }
    reader.readAsDataURL(file)
  }

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (.png, .jpg, .webp)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      set('receipt_qr_image', base64)
      toast.success('QR Code uploaded! Click "Save Settings" to apply.')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    for (const [key, value] of Object.entries(settings)) {
      await window.api.setSetting(currentUser!.id, key, value)
    }
    toast.success('Settings, Invoice Logo, and QR Code saved successfully!')
    setSaving(false)
  }

  const activeLogo = settings['receipt_header_logo'] || defaultInvoiceLogo
  const activeQR = settings['receipt_qr_image'] === 'none'
    ? null
    : (settings['receipt_qr_image'] || defaultWhatsAppQR)

  return (
    <div className="page-body" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Invoice Receipt Logo Card */}
      <div className="card">
        <div className="card-header">
          <Image size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Invoice & Receipt Logo (Thermal / A4 Header)</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'center' }}>
            {/* Logo Preview Box */}
            <div style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 130,
              textAlign: 'center'
            }}>
              {activeLogo ? (
                <img
                  src={activeLogo}
                  alt="Invoice Logo Preview"
                  style={{
                    maxHeight: 70,
                    maxWidth: 190,
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No Logo (Text Only)</span>
              )}
              <span style={{ fontSize: '0.6875rem', color: '#888', marginTop: 8 }}>
                {settings['receipt_header_logo'] ? '✓ Custom Logo Active' : '✓ Default Logo (Invoice logo.png)'}
              </span>
            </div>

            {/* Logo Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Receipt Header Brand Logo
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                This logo appears at the top of thermal bills and invoice receipts after completing a sale. Recommended format: <strong>PNG with transparent or white background (approx 300 × 120px)</strong>.
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} /> Upload / Change Logo PNG
                </button>

                {settings['receipt_header_logo'] && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      set('receipt_header_logo', '')
                      toast.success('Reverted to default Invoice logo.png')
                    }}
                  >
                    <RefreshCw size={13} /> Reset to Default
                  </button>
                )}

                {activeLogo && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => {
                      set('receipt_header_logo', 'none')
                      toast.success('Logo removed (text only header)')
                    }}
                  >
                    <Trash2 size={13} /> Remove (Text Only)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt WhatsApp Community QR Code Card */}
      <div className="card">
        <div className="card-header">
          <QrCode size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Receipt QR Code (WhatsApp Community / Customer VIP QR)</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'center' }}>
            {/* QR Preview Box */}
            <div style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 140,
              textAlign: 'center'
            }}>
              {activeQR ? (
                <img
                  src={activeQR}
                  alt="WhatsApp Community QR Preview"
                  style={{
                    maxHeight: 90,
                    maxWidth: 90,
                    objectFit: 'contain',
                    imageRendering: 'crisp-edges'
                  }}
                />
              ) : (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No QR (Disabled)</span>
              )}
              <span style={{ fontSize: '0.6875rem', color: '#888', marginTop: 8 }}>
                {settings['receipt_qr_image'] === 'none'
                  ? '✕ QR Code Disabled'
                  : (settings['receipt_qr_image'] ? '✓ Custom QR Code Active' : '✓ Default WhatsApp Community QR')}
              </span>
            </div>

            {/* QR Actions & Labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Printed Customer Receipt QR Code
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                This QR code is printed at the bottom of customer receipts so buyers can scan and join your <strong>WhatsApp VIP Community</strong> for new stock updates, catalog drops, and wholesale discounts.
              </div>

              <div className="form-group" style={{ marginTop: 2, marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>QR Code Callout / Header Text</label>
                <input
                  className="form-input"
                  placeholder="e.g. JOIN OUR WHATSAPP VIP COMMUNITY"
                  value={settings['receipt_qr_label'] || ''}
                  onChange={e => set('receipt_qr_label', e.target.value)}
                />
              </div>

              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleQRUpload}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => qrFileInputRef.current?.click()}
                >
                  <Upload size={13} /> Upload / Change QR Image
                </button>

                {settings['receipt_qr_image'] && settings['receipt_qr_image'] !== '' && settings['receipt_qr_image'] !== 'none' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      set('receipt_qr_image', '')
                      toast.success('Reverted to default WhatsApp QR')
                    }}
                  >
                    <RefreshCw size={13} /> Reset to Default Community QR
                  </button>
                )}

                {activeQR && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => {
                      set('receipt_qr_image', 'none')
                      toast.success('QR Code removed from receipt')
                    }}
                  >
                    <Trash2 size={13} /> Disable QR on Receipts
                  </button>
                )}

                {settings['receipt_qr_image'] === 'none' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      set('receipt_qr_image', '')
                      toast.success('Restored WhatsApp Community QR Code')
                    }}
                  >
                    <RefreshCw size={13} /> Enable QR Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Information Card */}
      <div className="card">
        <div className="card-header"><Settings size={16} style={{ color: 'var(--color-primary)' }} /><span className="card-title">Business & Bill Header Information</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'company_name',    label: 'Company Name' },
            { key: 'company_address', label: 'Address' },
            { key: 'company_phone',   label: 'Phone' },
            { key: 'receipt_footer',  label: 'Receipt Footer Text' },
            { key: 'currency_symbol', label: 'Currency Symbol' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input className="form-input" value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Default Discount Limit — Sales Person (%)</label>
              <input className="form-input" type="number" value={settings['discount_limit_sp'] || '10'} onChange={e => set('discount_limit_sp', e.target.value)} min={0} max={100} />
            </div>
            <div className="form-group">
              <label className="form-label">NTN / Tax Registration Number</label>
              <input className="form-input" placeholder="e.g. 1234567-8" value={settings['company_ntn'] || ''} onChange={e => set('company_ntn', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Order Contact #</label>
              <input className="form-input" placeholder="e.g. +92 300 1234567" value={settings['whatsapp_number'] || ''} onChange={e => set('whatsapp_number', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Return & Exchange Policy (Printed on Bill)</label>
              <input className="form-input" placeholder="e.g. Items can be exchanged within 7 days with original receipt and tags attached." value={settings['receipt_return_policy'] || ''} onChange={e => set('receipt_return_policy', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Discount Limit — Manager (%)</label>
              <input className="form-input" type="number" value={settings['discount_limit_mgr'] || '20'} onChange={e => set('discount_limit_mgr', e.target.value)} min={0} max={100} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Allow Custom Item Price Editing in POS (Counter Pricing)</label>
              <select
                className="form-select"
                value={settings['pos_allow_price_edit'] ?? '1'}
                onChange={e => set('pos_allow_price_edit', e.target.value)}
              >
                <option value="1">Enabled (Staff/Owner can edit item price in cart via F6 or click, including below cost price)</option>
                <option value="0">Disabled (Lock item unit price strictly to catalog retail price)</option>
                <option value="per_user">Per-User Permissions (Check individual user permissions matrix)</option>
              </select>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                When enabled, cashiers can press <kbd className="hotkey" style={{ fontSize: '0.5625rem' }}>F6</kbd> or click the price in POS to enter a custom selling rate. Prices below wholesale cost are permitted.
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Show Cost Price in Custom Selling Price &amp; Profit Card</label>
              <select
                className="form-select"
                value={settings['pos_show_cost_in_price_edit'] ?? '1'}
                onChange={e => set('pos_show_cost_in_price_edit', e.target.value)}
              >
                <option value="1">Enabled — Show wholesale cost price inside the price edit popup (requires View Cost Price permission)</option>
                <option value="0">Disabled — Hide cost price from the price edit popup entirely</option>
              </select>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                When enabled, the wholesale cost price benchmark is displayed inside the "Custom Selling Price &amp; Profit" popup when editing item prices in POS. Still requires the user to have 'View Wholesale Item Cost Prices' permission.
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Voice AI POS Assistant Module (Whisper Speech &amp; LLM Invoicing)</label>
              <select
                className="form-select"
                value={settings['enable_voice_pos'] ?? '1'}
                onChange={e => set('enable_voice_pos', e.target.value)}
              >
                <option value="1">Enabled (Show Voice Invoice button in POS &amp; activate Whisper AI STT)</option>
                <option value="0">Disabled (Deactivate Voice POS module &amp; hide voice invoice buttons)</option>
              </select>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Enables or disables the optional Voice POS component. When disabled, the core POS functions normally with zero voice overhead.
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <CheckCircle size={15} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// VOICE AI POS ASSISTANT TAB
// Dedicated Control Center for Whisper STT & LLM NLU Reasoning
// ============================================================
function VoiceAIAssistantTab() {
  const { currentUser } = useAuth()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [omniStatus, setOmniStatus] = useState<{ isRunning: boolean; baseUrl: string; dashboardUrl: string; models: string[]; error?: string } | null>(null)
  const [isCheckingOmni, setIsCheckingOmni] = useState(false)

  // Sandbox state
  const [sandboxPrompt, setSandboxPrompt] = useState('2 SKU 101 2500 me dalo customer Hamza')
  const [isTestingSandbox, setIsTestingSandbox] = useState(false)
  const [sandboxResult, setSandboxResult] = useState<any | null>(null)

  const loadSettings = async () => {
    const s = await window.api.getAllSettings()
    if (s) setSettings(s as unknown as Record<string, string>)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const isVoiceEnabled = settings['enable_voice_pos'] !== '0'

  const checkOmni = async (customUrl?: string) => {
    if (!window.api?.checkOmniRouteStatus) return
    setIsCheckingOmni(true)
    try {
      const res = await window.api.checkOmniRouteStatus(customUrl || settings['voice_llm_base_url'])
      setOmniStatus(res)
    } catch (e) {
      setOmniStatus({ isRunning: false, baseUrl: 'http://localhost:20128/v1', dashboardUrl: 'http://localhost:20128', models: [], error: String(e) })
    } finally {
      setIsCheckingOmni(false)
    }
  }

  useEffect(() => {
    if (isVoiceEnabled) {
      checkOmni()
    }
  }, [isVoiceEnabled])

  const set = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(settings)) {
        await window.api.setSetting(currentUser!.id, key, value)
      }
      toast.success('Voice AI & LLM settings saved successfully!')
    } catch (err) {
      toast.error('Failed to save Voice AI settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleVoiceModule = async () => {
    const nextVal = isVoiceEnabled ? '0' : '1'
    set('enable_voice_pos', nextVal)
    await window.api.setSetting(currentUser!.id, 'enable_voice_pos', nextVal)
    toast.success(nextVal === '1' ? 'Voice AI POS Module Enabled!' : 'Voice AI POS Module Disabled!')
  }

  const runSandboxTest = async () => {
    if (!sandboxPrompt.trim()) return
    setIsTestingSandbox(true)
    setSandboxResult(null)
    const provider = settings['voice_llm_provider'] || 'groq'
    const apiKey = settings['voice_llm_api_key'] || settings['voice_stt_api_key'] || (provider === 'omniroute' ? 'any' : '')
    const baseUrl = settings['voice_llm_base_url'] || ''
    const model = settings['voice_llm_model'] || ''

    const startTime = Date.now()
    try {
      // Test parsing command directly
      const ping = await window.api.testLLMConnection(provider, apiKey, baseUrl, model)
      const latency = Date.now() - startTime

      if (!ping.success) {
        setSandboxResult({
          success: false,
          error: ping.message,
          latency
        })
        return
      }

      // If ping passes, try parsing the voice command with active catalog
      const items = await window.api.getAllItems()
      const customers = await window.api.getAllCustomers()

      const res = await window.api.processVoiceWithLLM({
        transcript: sandboxPrompt.trim(),
        catalog: items.map(i => ({ id: i.id, part_number: i.part_number, name: i.name, barcode: i.barcode, retail_price: i.retail_price, cost_price: i.cost_price, quantity_on_hand: i.quantity_on_hand })),
        cart: [],
        customers: customers.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', current_balance: c.balance })),
        canEditPrice: true
      })

      if (res.success && res.result) {
        setSandboxResult({
          success: true,
          parsed_command: res.result,
          latency: Date.now() - startTime
        })
      } else {
        setSandboxResult({
          success: false,
          error: res.error || 'NLU Parsing failed',
          latency: Date.now() - startTime
        })
      }
    } catch (err: any) {
      setSandboxResult({
        success: false,
        error: String(err),
        latency: Date.now() - startTime
      })
    } finally {
      setIsTestingSandbox(false)
    }
  }

  const currentProvider = settings['voice_llm_provider'] || 'groq'

  return (
    <div className="page-body" style={{ maxWidth: 840, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* Master Module Status & Toggle Card */}
      <div className="card" style={{
        padding: '16px 20px',
        background: isVoiceEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        border: isVoiceEnabled ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(239, 68, 68, 0.35)',
        borderRadius: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: isVoiceEnabled ? 'var(--color-primary)' : 'var(--color-surface-2)',
              color: isVoiceEnabled ? '#fff' : 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800
            }}>
              <Mic size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                  Voice AI POS Assistant Module
                </div>
                <span className={`badge ${isVoiceEnabled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6875rem' }}>
                  {isVoiceEnabled ? 'Active / Installed' : 'Disabled / Inactive'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {isVoiceEnabled
                  ? 'Whisper STT transcription and LLM voice invoice parsing are enabled for store owners.'
                  : 'Voice POS module is currently turned off. The core POS system runs in lightweight mode without microphone overhead.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn btn-sm ${isVoiceEnabled ? 'btn-danger' : 'btn-success'}`}
            onClick={toggleVoiceModule}
            style={{ fontWeight: 700, gap: 6 }}
          >
            {isVoiceEnabled ? 'Disable Voice POS' : 'Enable Voice POS'}
          </button>
        </div>
      </div>

      {/* 1-Click Auto-Setup Presets */}
      <div className="card" style={{ opacity: isVoiceEnabled ? 1 : 0.6 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">1-Click Voice AI Presets</span>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
            Active: {currentProvider.toUpperCase()}
          </span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Select a pre-configured AI reasoning engine to automatically configure models and API endpoints:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            {/* Groq Cloud */}
            <button
              type="button"
              onClick={() => {
                set('voice_llm_provider', 'groq')
                set('voice_llm_model', 'openai/gpt-oss-120b')
                set('voice_llm_base_url', '')
                toast.success('Configured Groq (openai/gpt-oss-120b)!')
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: currentProvider === 'groq' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: currentProvider === 'groq' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 4,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                height: 'auto',
                minHeight: 'auto',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: currentProvider === 'groq' ? 'var(--color-primary)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>Groq Cloud (Recommended)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Default: openai/gpt-oss-120b (~200ms ultra-fast)
              </div>
            </button>

            {/* OmniRoute Gateway */}
            <button
              type="button"
              onClick={async () => {
                set('voice_llm_provider', 'omniroute')
                set('voice_llm_base_url', 'http://localhost:20128/v1')
                set('voice_llm_api_key', 'any')
                if (omniStatus?.models && omniStatus.models.length > 0) {
                  set('voice_llm_model', omniStatus.models[0])
                }
                await checkOmni('http://localhost:20128/v1')
                toast.success('Configured OmniRoute Gateway (Port 20128)!')
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: currentProvider === 'omniroute' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: currentProvider === 'omniroute' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 4,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                height: 'auto',
                minHeight: 'auto',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: currentProvider === 'omniroute' ? 'var(--color-primary)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>OmniRoute Gateway</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Local proxy on Port 20128
              </div>
            </button>

            {/* OpenAI */}
            <button
              type="button"
              onClick={() => {
                set('voice_llm_provider', 'openai')
                set('voice_llm_model', 'gpt-4o-mini')
                set('voice_llm_base_url', '')
                toast.success('Configured OpenAI GPT-4o-mini!')
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: currentProvider === 'openai' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: currentProvider === 'openai' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 4,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                height: 'auto',
                minHeight: 'auto',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: currentProvider === 'openai' ? 'var(--color-primary)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>OpenAI Cloud</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Model: gpt-4o-mini
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* LLM Reasoning Engine Configuration */}
      <div className="card">
        <div className="card-header">
          <Cpu size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">LLM NLU Reasoning Engine Settings</span>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Provider Selection */}
          <div className="form-group">
            <label className="form-label">Active Provider</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, width: '100%', boxSizing: 'border-box' }}>
              {[
                { id: 'groq', name: '⚡ Groq Cloud' },
                { id: 'omniroute', name: '🌐 OmniRoute (Port 20128)' },
                { id: 'openai', name: '🟢 OpenAI' },
                { id: 'custom', name: '⚙️ Custom API' }
              ].map(p => {
                const isSelected = currentProvider === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      set('voice_llm_provider', p.id)
                      if (p.id === 'groq') {
                        set('voice_llm_model', 'openai/gpt-oss-120b')
                        set('voice_llm_base_url', '')
                      } else if (p.id === 'omniroute') {
                        set('voice_llm_base_url', 'http://localhost:20128/v1')
                        set('voice_llm_api_key', settings['voice_llm_api_key'] || 'any')
                        if (omniStatus?.models && omniStatus.models.length > 0) {
                          set('voice_llm_model', omniStatus.models[0])
                        }
                      } else if (p.id === 'openai') {
                        set('voice_llm_model', 'gpt-4o-mini')
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-surface)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      textAlign: 'center'
                    }}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Base URL (if custom or OmniRoute) */}
          {(currentProvider === 'omniroute' || currentProvider === 'custom') && (
            <div className="form-group">
              <label className="form-label">
                {currentProvider === 'omniroute' ? 'OmniRoute Base URL' : 'Custom Base URL'}
              </label>
              <input
                className="form-input font-mono"
                placeholder={currentProvider === 'omniroute' ? 'http://localhost:20128/v1' : 'https://your-endpoint/v1'}
                value={settings['voice_llm_base_url'] || (currentProvider === 'omniroute' ? 'http://localhost:20128/v1' : '')}
                onChange={e => {
                  set('voice_llm_base_url', e.target.value.trim())
                  checkOmni(e.target.value.trim())
                }}
              />
            </div>
          )}

          {/* Model Name */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span>LLM Model Identifier</span>
              {currentProvider === 'omniroute' && omniStatus?.models && omniStatus.models.length > 0 && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  ✓ {omniStatus.models.length} Models Detected
                </span>
              )}
            </label>
            {currentProvider === 'omniroute' && omniStatus?.models && omniStatus.models.length > 0 ? (
              <select
                className="form-select font-mono"
                value={settings['voice_llm_model'] || omniStatus.models[0]}
                onChange={e => set('voice_llm_model', e.target.value)}
              >
                {omniStatus.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                className="form-input font-mono"
                placeholder={
                  currentProvider === 'groq'
                    ? 'openai/gpt-oss-120b'
                    : (currentProvider === 'omniroute' ? 'openrouter/z-ai/glm-5.2:free-high' : 'gpt-4o-mini')
                }
                value={settings['voice_llm_model'] || ''}
                onChange={e => set('voice_llm_model', e.target.value.trim())}
              />
            )}
          </div>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span>{currentProvider.toUpperCase()} API Key</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                {currentProvider === 'omniroute'
                  ? '✓ OmniRoute handles auth ("any" default)'
                  : ((settings['voice_llm_api_key'] || settings['voice_stt_api_key'])?.trim()
                    ? '✓ Custom Key Active'
                    : (currentProvider === 'groq' ? '✓ Default Free Groq Key Active' : '⚠ Key Required'))}
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
              <input
                className="form-input font-mono"
                type="password"
                placeholder={
                  currentProvider === 'groq'
                    ? 'Enter your Groq API key (gsk_...)'
                    : (currentProvider === 'omniroute' ? 'any (OmniRoute default)' : 'Enter API key (sk-... or custom)')
                }
                value={settings['voice_llm_api_key'] || (currentProvider === 'omniroute' ? 'any' : '')}
                onChange={e => set('voice_llm_api_key', e.target.value.trim())}
                style={{ flex: 1, minWidth: 0 }}
              />
              {settings['voice_llm_api_key'] && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('voice_llm_api_key', '')} style={{ flexShrink: 0 }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Test Connection Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const provider = settings['voice_llm_provider'] || 'groq'
                const apiKey = settings['voice_llm_api_key'] || settings['voice_stt_api_key'] || (provider === 'omniroute' ? 'any' : '')
                const baseUrl = settings['voice_llm_base_url'] || ''
                const model = settings['voice_llm_model'] || ''
                toast.loading(`Testing ${provider.toUpperCase()} connection...`, { id: 'test-llm' })
                const res = await window.api.testLLMConnection(provider, apiKey, baseUrl, model)
                if (res.success) {
                  toast.success(res.message, { id: 'test-llm' })
                } else {
                  toast.error(res.message, { id: 'test-llm' })
                }
              }}
            >
              <Sparkles size={13} style={{ color: 'var(--color-primary)' }} /> Test {currentProvider.toUpperCase()} Connection
            </button>
          </div>
        </div>
      </div>

      {/* Whisper STT Speech-to-Text Key */}
      <div className="card">
        <div className="card-header">
          <Mic size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Whisper Speech-to-Text (STT) Settings</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span>Whisper Speech Recognition Key (Groq Cloud)</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                {settings['voice_stt_api_key']?.trim() ? '✓ Custom Key Active' : 'Enter your free Groq API key'}
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
              <input
                className="form-input font-mono"
                type="password"
                placeholder="Enter your Groq Whisper API key (gsk_...)"
                value={settings['voice_stt_api_key'] || ''}
                onChange={e => set('voice_stt_api_key', e.target.value.trim())}
                style={{ flex: 1, minWidth: 0 }}
              />
              {settings['voice_stt_api_key'] && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    set('voice_stt_api_key', '')
                    toast.success('Reverted to built-in default Groq key')
                  }}
                  style={{ flexShrink: 0 }}
                >
                  <RefreshCw size={13} /> Reset
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
              Powered by Groq Whisper Large V3 Turbo STT. Supports spoken English and Roman Urdu.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive NLU Diagnostic Sandbox */}
      <div className="card">
        <div className="card-header">
          <Cpu size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Live NLU &amp; Parsing Sandbox</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Test sample voice retail commands against your configured AI engine:
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
            <input
              className="form-input"
              value={sandboxPrompt}
              onChange={e => setSandboxPrompt(e.target.value)}
              placeholder="e.g. 2 SKU 101 2500 me dalo customer Hamza"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={runSandboxTest}
              disabled={isTestingSandbox}
              style={{ flexShrink: 0 }}
            >
              {isTestingSandbox ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
              {isTestingSandbox ? 'Testing...' : 'Run Test'}
            </button>
          </div>

          {sandboxResult && (
            <div style={{
              background: 'var(--color-surface-2)',
              borderRadius: 8,
              border: `1px solid ${sandboxResult.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: 12,
              fontSize: '0.8125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, color: sandboxResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {sandboxResult.success ? `✓ ${sandboxResult.provider} Passed (${sandboxResult.latency}ms)` : '✕ Connection / Parsing Failed'}
                </span>
                {sandboxResult.model && (
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{sandboxResult.model}</span>
                )}
              </div>

              {sandboxResult.error ? (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.4 }}>
                  {sandboxResult.error}
                </div>
              ) : (
                <pre style={{
                  margin: 0,
                  background: 'rgba(0,0,0,0.15)',
                  padding: 8,
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary)',
                  overflowX: 'auto',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  maxHeight: 140,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {JSON.stringify(sandboxResult.mockParsed, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Settings Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', flex: 1, minWidth: 200 }}>
          Settings are saved locally and applied to POS counter voice assistant immediately.
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flexShrink: 0 }}>
          <CheckCircle size={15} /> {saving ? 'Saving...' : 'Save Voice AI Settings'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MULTI-TERMINAL & LAN NETWORK SYNC TAB
// Sync 2 Windows PCs + 1 macOS System with live shared DB
// ============================================================
function MultiTerminalSyncTab() {
  const { currentUser } = useAuth()
  const [config, setConfig] = useState(getTerminalConfig())
  const [serverInfo, setServerInfo] = useState<MobileServerInfo | null>(null)
  const [activeTerminals, setActiveTerminals] = useState<ActiveTerminalInfo[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [discoveredMasters, setDiscoveredMasters] = useState<DiscoveredMasterServer[]>([])
  const [isTestingPing, setIsTestingPing] = useState(false)
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Load server info on Master
  const loadMasterServerInfo = async () => {
    try {
      const res = await window.api.getMobileServerInfo()
      if (res.success && res.data) {
        setServerInfo(res.data)
      }
      const termRes = await window.api.getActiveTerminals()
      if (termRes.success && termRes.data) {
        setActiveTerminals(termRes.data)
      }
    } catch (_) {}
  }

  useEffect(() => {
    loadMasterServerInfo()
    const interval = setInterval(loadMasterServerInfo, 5000)
    return () => clearInterval(interval)
  }, [config.mode])

  // Handle LAN auto-discovery scan
  const handleAutoDiscover = async () => {
    setIsScanning(true)
    setDiscoveredMasters([])
    try {
      const res = await window.api.scanMasterServers()
      if (res.success && res.data && res.data.length > 0) {
        setDiscoveredMasters(res.data)
        toast.success(`Found ${res.data.length} Master Server on your local network!`)
      } else {
        toast.error('No Master Server detected automatically. Please ensure the Main Windows PC is running and verify the IP address.')
      }
    } catch (err: any) {
      toast.error('Discovery scan failed: ' + err.message)
    } finally {
      setIsScanning(false)
    }
  }

  // Handle LAN ping test
  const handleTestPing = async () => {
    if (!config.masterUrl) {
      toast.error('Please enter a Master Server URL to test.')
      return
    }
    setIsTestingPing(true)
    setPingResult(null)
    try {
      const res = await window.api.testLanPing(config.masterUrl)
      setPingResult(res)
      if (res.success) {
        toast.success(`Connected to Master Server (${res.latencyMs}ms)!`)
      } else {
        toast.error(res.message)
      }
    } catch (err: any) {
      setPingResult({ success: false, latencyMs: 0, message: err.message })
      toast.error('Cannot reach Master Server')
    } finally {
      setIsTestingPing(false)
    }
  }

  const handleSave = () => {
    setSaving(true)
    try {
      saveTerminalConfig(config)
      initTerminalSync()
      toast.success('Multi-Terminal Sync configuration saved! Terminal is active.')
    } catch (e: any) {
      toast.error('Failed to save configuration: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: 840, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* Terminal Node Role Selector */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">Terminal Operating Role</span>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
            {config.mode === 'master' ? '🖥️ Master Server Node' : `💻 Satellite Client (${config.terminalId})`}
          </span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Select whether this computer acts as the Central Database Server (Main Windows PC) or a Satellite Counter Terminal:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, width: '100%', boxSizing: 'border-box' }}>
            {/* Master Option */}
            <button
              type="button"
              onClick={() => {
                setConfig(c => ({ ...c, mode: 'master', terminalId: 'T-01', terminalName: 'Main Counter (Master)' }))
              }}
              style={{
                padding: '14px',
                borderRadius: 8,
                border: config.mode === 'master' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: config.mode === 'master' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 4,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                height: 'auto',
                minHeight: 'auto',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: config.mode === 'master' ? 'var(--color-primary)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>Master Server (Main PC)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Terminal 1 · Hosts central database &amp; serves local network
              </div>
            </button>

            {/* Satellite Client Option */}
            <button
              type="button"
              onClick={() => {
                setConfig(c => ({
                  ...c,
                  mode: 'client',
                  terminalId: c.terminalId === 'T-01' ? 'T-02' : c.terminalId,
                  terminalName: c.terminalName.includes('Master') ? 'Secondary Counter' : c.terminalName
                }))
              }}
              style={{
                padding: '14px',
                borderRadius: 8,
                border: config.mode === 'client' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: config.mode === 'client' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 4,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                height: 'auto',
                minHeight: 'auto',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: config.mode === 'client' ? 'var(--color-primary)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Laptop size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>Satellite Client (Win/Mac)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Terminal 2 or 3 · Connects over Wi-Fi to Main PC
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* MASTER NODE ACTIVE VIEW */}
      {config.mode === 'master' && (
        <>
          {/* Master Server Network Status */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="card-title">Master Server LAN Network Info</span>
              </div>
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Active Host</span>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Master Server Local Address (LAN URL)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <input
                    className="form-input font-mono"
                    readOnly
                    value={serverInfo?.primaryUrl || 'http://192.168.1.100:8080'}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(serverInfo?.primaryUrl || 'http://localhost:8080')
                      toast.success('Master URL copied to clipboard!')
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <Copy size={13} /> Copy URL
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                  Enter this URL on your 2nd Windows PC and macOS Terminal to sync with this database.
                </div>
              </div>

              {/* Windows Firewall Helper */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8, background: 'var(--color-surface-2)',
                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', flex: 1, minWidth: 180 }}>
                  If satellite terminals cannot reach this PC, allow incoming traffic through Windows Firewall.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={async () => {
                    await window.api.allowFirewall()
                    toast.success('Firewall rule requested!')
                  }}
                  style={{ flexShrink: 0 }}
                >
                  <Shield size={12} /> Allow Windows Firewall Rule
                </button>
              </div>
            </div>
          </div>

          {/* Active Connected Terminals Monitor */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="card-title">Connected Terminals ({activeTerminals.length + 1})</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={loadMasterServerInfo}
                style={{ flexShrink: 0 }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Terminal ID</th>
                      <th>Friendly Name</th>
                      <th>Platform</th>
                      <th>IP Address</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Master Terminal Row */}
                    <tr>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>T-01 (Master)</td>
                      <td>Main Counter (This Computer)</td>
                      <td>Windows (Server Node)</td>
                      <td><code>127.0.0.1</code></td>
                      <td><span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Master Host</span></td>
                    </tr>

                    {/* Satellite Terminals */}
                    {activeTerminals.map(t => (
                      <tr key={t.terminalId}>
                        <td style={{ fontWeight: 700 }}>{t.terminalId}</td>
                        <td>{t.terminalName}</td>
                        <td>{t.os}</td>
                        <td><code>{t.ip}</code></td>
                        <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Connected</span></td>
                      </tr>
                    ))}

                    {activeTerminals.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          No satellite terminals connected yet. Configure other systems as Satellite Clients to see them live here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SATELLITE CLIENT TERMINAL VIEW */}
      {config.mode === 'client' && (
        <>
          {/* Master Connection Box */}
          <div className="card">
            <div className="card-header">
              <Wifi size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Master Server Connection</span>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1-Click Auto-Detect Button */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 10, background: 'var(--color-surface-2)',
                padding: '12px 14px', borderRadius: 8, border: '1px solid var(--color-border)'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Auto-Detect Master Server on LAN</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Scans local Wi-Fi to find the Main Windows PC automatically.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoDiscover}
                  disabled={isScanning}
                  style={{ flexShrink: 0 }}
                >
                  <Wifi size={13} className={isScanning ? 'animate-spin' : ''} />
                  {isScanning ? 'Scanning...' : 'Scan LAN'}
                </button>
              </div>

              {/* Discovered Servers List */}
              {discoveredMasters.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Discovered Servers:
                  </div>
                  {discoveredMasters.map(d => (
                    <div
                      key={d.url}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{d.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {d.url} · {d.latencyMs}ms
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => {
                          setConfig(c => ({ ...c, masterUrl: d.url }))
                          toast.success(`Connected to ${d.url}!`)
                        }}
                      >
                        Use This Server
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual URL Input */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>Master Server URL</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    e.g. <code>http://192.168.1.100:8080</code>
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <input
                    className="form-input font-mono"
                    placeholder="http://192.168.1.100:8080"
                    value={config.masterUrl}
                    onChange={e => setConfig(c => ({ ...c, masterUrl: e.target.value.trim() }))}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleTestPing}
                    disabled={isTestingPing}
                    style={{ flexShrink: 0 }}
                  >
                    <Play size={13} /> {isTestingPing ? 'Testing...' : 'Test Ping'}
                  </button>
                </div>
              </div>

              {/* Ping Result Alert */}
              {pingResult && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: pingResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${pingResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: pingResult.success ? 'var(--color-primary)' : 'var(--color-danger)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  lineHeight: 1.4
                }}>
                  {pingResult.success ? <CheckCircle size={15} style={{ flexShrink: 0 }} /> : <AlertTriangle size={15} style={{ flexShrink: 0 }} />}
                  <span>
                    {pingResult.success
                      ? `Connected to Master Server in ${pingResult.latencyMs}ms!`
                      : pingResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Satellite Terminal Settings */}
          <div className="card">
            <div className="card-header">
              <Laptop size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Satellite Terminal Identity</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, width: '100%', boxSizing: 'border-box' }}>
                <div className="form-group">
                  <label className="form-label">Terminal ID</label>
                  <input
                    className="form-input font-mono"
                    value={config.terminalId}
                    onChange={e => setConfig(c => ({ ...c, terminalId: e.target.value.trim() }))}
                    placeholder="e.g. T-02"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Friendly Terminal Name</label>
                  <input
                    className="form-input"
                    value={config.terminalName}
                    onChange={e => setConfig(c => ({ ...c, terminalName: e.target.value }))}
                    placeholder="e.g. Upstairs Cashier"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Settings Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', flex: 1, minWidth: 200 }}>
          Multi-Terminal configuration is applied immediately without restart.
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flexShrink: 0 }}>
          <CheckCircle size={15} /> {saving ? 'Saving...' : 'Save Sync Settings'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// REINDEX TAB
// ============================================================
function ReindexTab() {
  const { currentUser } = useAuth()
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<{ fixed: number; message: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<{ message?: string; stats?: any } | null>(null)

  const handleReindex = async () => {
    setRunning(true)
    setResult(null)
    const res = await window.api.reindexData(currentUser!.id)
    if (res.success && res.data) {
      setResult(res.data)
      toast.success('Reindex complete!')
    } else {
      toast.error(res.error || 'Reindex failed')
    }
    setRunning(false)
  }

  const handleSeedDemo = async (mode: 'if_empty' | 'force') => {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await window.api.seedDemoData(currentUser!.id, mode)
      if (res.success && res.data) {
        setSeedResult(res.data)
        toast.success('Demo sample dataset populated successfully!')
      } else {
        toast.error(res.error || 'Failed to populate demo data')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error populating demo data')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Demo / Sample Data card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Demo & Showcase Dataset (Sample Data)</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Populate realistic retail apparel products with standard barcodes, customer profiles, textile suppliers, 75+ sales invoices across the last 30 days, operational expenses, and past day-closings. Ideal for software demonstrations and showcase videos.
          </p>
          {seedResult && (
            <div style={{ padding: 14, background: 'var(--color-success-bg)', borderRadius: 10, border: '1px solid #86EFAC', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>✅ Demo Dataset Loaded</div>
              <div style={{ fontSize: '0.875rem', marginTop: 4 }}>{seedResult.message}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => handleSeedDemo('force')} disabled={seeding}>
              {seeding
                ? <><Loader2 size={16} className="animate-spin" /> Populating Data...</>
                : <><Sparkles size={16} /> Load Full Demo Dataset</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Data Reindex card */}
      <div className="card">
        <div className="card-header"><RefreshCw size={16} style={{ color: 'var(--color-primary)' }} /><span className="card-title">Data Reindex (5-3 Index)</span></div>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>
            Recalculates all stock quantities from the full transaction history.
            Use this if you notice any discrepancies in stock quantities or totals.
          </p>
          {result && (
            <div style={{ padding: 14, background: 'var(--color-success-bg)', borderRadius: 10, border: '1px solid #86EFAC', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>✅ Reindex Complete</div>
              <div style={{ fontSize: '0.875rem', marginTop: 4 }}>{result.message}</div>
            </div>
          )}
          <button className="btn btn-secondary btn-lg" onClick={handleReindex} disabled={running}>
            {running
              ? <><span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span> Running...</>
              : <><RefreshCw size={16} /> Run Reindex Now</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// BACKUP & RESTORE TAB — AUTOMATED GOOGLE DRIVE & LOCAL SNAPSHOTS
// ============================================================
function BackupTab() {
  const { currentUser } = useAuth()
  const [loadingBackup, setLoadingBackup] = useState(false)
  const [loadingRestore, setLoadingRestore] = useState(false)
  const [gdriveConfig, setGdriveConfig] = useState<GDriveConfig | null>(null)
  const [uploadingGDrive, setUploadingGDrive] = useState(false)
  const [testingGDrive, setTestingGDrive] = useState(false)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [savingGDrive, setSavingGDrive] = useState(false)

  const loadGDrive = async () => {
    try {
      const res = await window.api.getGDriveConfig()
      if (res.success && res.data) {
        setGdriveConfig(res.data)
      }
    } catch (_) {}
  }

  useEffect(() => {
    loadGDrive()
    const interval = setInterval(loadGDrive, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveGDrive = async (newCfg: Partial<GDriveConfig>) => {
    setSavingGDrive(true)
    try {
      await window.api.saveGDriveConfig(newCfg)
      setGdriveConfig(prev => prev ? { ...prev, ...newCfg } : null)
      toast.success('Google Drive backup settings saved!')
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message)
    } finally {
      setSavingGDrive(false)
    }
  }

  const handleBackupToGDriveNow = async () => {
    if (!gdriveConfig?.webhookUrl) {
      toast.error('Please configure your Google Drive Webhook URL first.')
      setShowSetupGuide(true)
      return
    }

    setUploadingGDrive(true)
    try {
      const res = await window.api.backupToGDriveNow(currentUser?.id)
      if (res.success) {
        toast.success(res.message, { duration: 6000 })
        loadGDrive()
      } else {
        toast.error(res.message, { duration: 6000 })
      }
    } catch (err: any) {
      toast.error('Google Drive backup failed: ' + err.message)
    } finally {
      setUploadingGDrive(false)
    }
  }

  const handleTestGDrive = async () => {
    if (!gdriveConfig?.webhookUrl) {
      toast.error('Please enter a Google Drive Webhook URL to test.')
      return
    }

    setTestingGDrive(true)
    try {
      const res = await window.api.testGDriveConnection(gdriveConfig.webhookUrl)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message, { duration: 6000 })
      }
    } catch (err: any) {
      toast.error('Connection test failed: ' + err.message)
    } finally {
      setTestingGDrive(false)
    }
  }

  const handleBackup = async () => {
    setLoadingBackup(true)
    const result = await window.api.backupDatabase(currentUser!.id)
    if (result.success) {
      toast.success(`Local backup saved to: ${result.path}`)
    } else if (result.error !== 'Cancelled') {
      toast.error(result.error || 'Backup failed')
    }
    setLoadingBackup(false)
  }

  const handleRestore = async () => {
    const confirm = window.confirm('WARNING: Restoring a backup will overwrite the current database with the selected backup file. Are you sure you want to proceed?')
    if (!confirm) return

    setLoadingRestore(true)
    const result = await window.api.restoreDatabase(currentUser!.id)
    if (result.success) {
      toast.success(result.message || 'Database restored successfully!')
    } else if (result.error !== 'Cancelled') {
      toast.error(result.error || 'Restore failed')
    }
    setLoadingRestore(false)
  }

  const googleScriptTemplate = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.isTestPing) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Google Drive Webhook Connected!' })).setMimeType(ContentService.MimeType.JSON);
    }
    var folderName = data.folderName || 'POS Backups';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var decoded = Utilities.base64Decode(data.fileData);
    var blob = Utilities.newBlob(decoded, data.mimeType || 'application/x-sqlite3', data.filename || 'pos-backup.db');
    var file = folder.createFile(blob);
    return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: file.getId(), url: file.getUrl() })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`

  return (
    <div className="page-body" style={{ maxWidth: 840, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* GOOGLE DRIVE AUTOMATED CLOUD BACKUP CARD */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">Automated Google Drive Cloud Backup</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {gdriveConfig?.isOnline ? (
              <span className="badge badge-success" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={12} /> Wi-Fi Online
              </span>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WifiOff size={12} /> Offline
              </span>
            )}
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Status Indicator Summary Box */}
          <div style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Status
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: gdriveConfig?.enabled ? 'var(--color-primary)' : 'var(--color-text-secondary)', marginTop: 2 }}>
                {gdriveConfig?.enabled ? '🟢 Weekly Auto-Backup Active' : '⚪ Auto-Backup Disabled'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Last Cloud Backup
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 2 }}>
                {gdriveConfig?.lastBackupTime
                  ? new Date(gdriveConfig.lastBackupTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                  : 'No backups uploaded yet'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Next Scheduled Backup
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)', marginTop: 2 }}>
                {gdriveConfig?.enabled && gdriveConfig?.nextBackupTime
                  ? gdriveConfig.nextBackupTime <= Date.now()
                    ? '⚡ Ready (Syncs on Wi-Fi)'
                    : new Date(gdriveConfig.nextBackupTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Enable Toggle & Frequency Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--color-surface)',
              borderRadius: 8, border: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Enable Cloud Backup</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Auto-triggers on Wi-Fi</div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveGDrive({ enabled: !gdriveConfig?.enabled })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: gdriveConfig?.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              >
                {gdriveConfig?.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--color-surface)',
              borderRadius: 8, border: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Backup Frequency</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Recurring schedule</div>
              </div>
              <select
                className="form-select font-mono"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8125rem' }}
                value={gdriveConfig?.frequencyDays || 7}
                onChange={(e) => handleSaveGDrive({ frequencyDays: parseInt(e.target.value, 10) })}
              >
                <option value={7}>Weekly (7 Days)</option>
                <option value={1}>Daily (24 Hours)</option>
                <option value={3}>Every 3 Days</option>
                <option value={14}>Bi-Weekly (14 Days)</option>
                <option value={30}>Monthly (30 Days)</option>
              </select>
            </div>
          </div>

          {/* Webhook URL Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span>Google Apps Script Webhook URL</span>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <HelpCircle size={13} /> {showSetupGuide ? 'Hide Guide' : 'Setup Guide (1 min)'}
              </button>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
              <input
                className="form-input font-mono"
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                value={gdriveConfig?.webhookUrl || ''}
                onChange={(e) => setGdriveConfig(prev => prev ? { ...prev, webhookUrl: e.target.value } : null)}
                onBlur={() => gdriveConfig && handleSaveGDrive({ webhookUrl: gdriveConfig.webhookUrl })}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestGDrive}
                disabled={testingGDrive}
                style={{ flexShrink: 0 }}
              >
                <Play size={13} /> {testingGDrive ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>

          {/* Step-by-Step Setup Guide Collapse */}
          {showSetupGuide && (
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                <span>Google Drive Webhook Setup</span>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>script.google.com</a> and click <strong>New Project</strong>.</li>
                <li>Copy the Google Apps Script template below and paste into editor.</li>
                <li>Click <strong>Deploy &gt; New deployment &gt; Select type: Web app</strong> (Who has access: <em>Anyone</em>).</li>
                <li>Copy the resulting Web App URL and paste it in the field above!</li>
              </ol>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(googleScriptTemplate)
                    toast.success('Script code copied to clipboard!')
                  }}
                >
                  <Copy size={12} /> Copy Script Template
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => window.open('https://script.google.com', '_blank')}
                >
                  <ExternalLink size={12} /> Open script.google.com
                </button>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Folder: <code>Google Drive / {gdriveConfig?.folderName || 'POS Backups'} /</code>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleBackupToGDriveNow}
              disabled={uploadingGDrive}
            >
              <Cloud size={14} className={uploadingGDrive ? 'animate-spin' : ''} />
              {uploadingGDrive ? 'Uploading Snapshot...' : 'Upload Backup Now'}
            </button>
          </div>
        </div>
      </div>

      {/* LOCAL OFFLINE BACKUP CARD */}
      <div className="card">
        <div className="card-header">
          <HardDrive size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Local Database Backup (.db)</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Export a standalone binary snapshot of the entire SQLite database to any local folder, external SSD, or USB flash drive.
          </p>
          <div>
            <button className="btn btn-secondary" onClick={handleBackup} disabled={loadingBackup}>
              <HardDrive size={15} /> {loadingBackup ? 'Saving...' : 'Create Local Snapshot (.db)'}
            </button>
          </div>
        </div>
      </div>

      {/* RESTORE CARD */}
      <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <div className="card-header" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
          <span className="card-title" style={{ color: 'var(--color-danger)' }}>Restore Database from Backup File</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Select a previous <code>.db</code> backup snapshot file to restore. The system verifies file integrity before replacing the active database.
          </p>
          <div>
            <button className="btn btn-danger" onClick={handleRestore} disabled={loadingRestore}>
              <AlertTriangle size={15} /> {loadingRestore ? 'Restoring...' : 'Select File & Restore Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// AUDIT TRAIL LOG TAB
// ============================================================
function AuditTrailTab() {
  const { currentUser } = useAuth()
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [searchAction, setSearchAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.getAllUsers(currentUser!.id).then(res => {
      if (res.success && res.data) setUsers(res.data)
    })
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    const res = await window.api.getAuditLogs(currentUser!.id, {
      userId: selectedUser || undefined,
      action: searchAction || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
    if (res.success && res.data) {
      setLogs(res.data)
    } else {
      toast.error(res.error || 'Failed to load audit logs')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [selectedUser, searchAction, fromDate, toDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filters Bar */}
      <div style={{
        padding: '12px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
          <select className="form-select" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="">All Users / Staff</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>

        <input
          className="form-input"
          style={{ width: 180 }}
          placeholder="Filter action (e.g. INVOICE, VOID)..."
          value={searchAction}
          onChange={e => setSearchAction(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>From:</span>
          <input type="date" className="form-input" style={{ width: 135 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>To:</span>
          <input type="date" className="form-input" style={{ width: 135 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadLogs}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Logs Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Shield size={36} style={{ opacity: 0.2 }} />
            <p>No audit activity matching filter criteria.</p>
          </div>
        ) : (
          <div className="card">
            <table className="data-table" style={{ fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th>User / Operator</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details & Parameters</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                      {l.created_at}
                    </td>
                    <td style={{ fontWeight: 700 }}>{l.user_name}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.6875rem',
                        background: l.action.includes('VOID') || l.action.includes('RESTORE') ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
                        color: l.action.includes('VOID') || l.action.includes('RESTORE') ? 'var(--color-danger)' : 'var(--color-primary)'
                      }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {l.entity}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// MOBILE COMPANION & WHATSAPP AUTOMATION TAB
// ============================================================
function MobileWhatsAppTab() {
  const [serverInfo, setServerInfo] = useState<MobileServerInfo | null>(null)
  const [portInput, setPortInput]   = useState('8080')
  const [waConfig, setWaConfig]     = useState<WhatsAppConfig>({
    ownerPhone: '',
    autoCloseTime: '22:00',
    autoCloseEnabled: true,
    sendOnDayClose: true
  })
  const [cfCheck, setCfCheck]       = useState<CloudflareCheckResult | null>(null)
  const [cfStatus, setCfStatus]     = useState<CloudflareStatus | null>(null)
  const [cfLoading, setCfLoading]   = useState(false)
  const [cfChecking, setCfChecking] = useState(false)
  const [savingWa, setSavingWa]     = useState(false)
  const [testingWa, setTestingWa]   = useState(false)

  const loadData = async () => {
    try {
      const sRes = await window.api.getMobileServerInfo()
      if (sRes.success && sRes.data) {
        setServerInfo(sRes.data)
        setPortInput(String(sRes.data.port))
      }
      const wRes = await window.api.getWhatsAppConfig()
      if (wRes.success && wRes.data) setWaConfig(wRes.data)
      await checkCloudflareState()
    } catch (e) { console.error(e) }
  }

  const checkCloudflareState = async () => {
    setCfChecking(true)
    try {
      const [chk, st] = await Promise.all([window.api.checkCloudflare(), window.api.getCloudflareStatus()])
      if (chk.success && chk.data) setCfCheck(chk.data)
      if (st.success && st.data) setCfStatus(st.data)
    } catch (e) { console.error(e) }
    setCfChecking(false)
  }

  useEffect(() => { loadData() }, [])

  const copyUrl = (url: string, label: string = 'Mobile URL') => {
    navigator.clipboard.writeText(url)
    toast.success(`${label} copied to clipboard!`)
  }

  const openInDefaultBrowser = async (url: string) => {
    if (!url) return
    const res = await window.api.openExternalUrl(url)
    if (res.success) toast.success('Opened in default browser!')
    else toast.error(res.error || 'Failed to open browser')
  }

  const startServer = async () => {
    const res = await window.api.startMobileServer(parseInt(portInput, 10) || 8080)
    if (res.success && res.data) {
      setServerInfo(res.data)
      toast.success('Mobile Companion server is now ONLINE!')
    } else toast.error(res.error || 'Failed to start mobile server')
  }

  const stopServer = async () => {
    const res = await window.api.stopMobileServer()
    if (res.success && res.data) {
      setServerInfo(res.data)
      toast.success('Mobile Companion server turned offline')
    } else toast.error(res.error || 'Failed to stop mobile server')
  }

  const restartServer = async () => {
    const res = await window.api.restartMobileServer(parseInt(portInput, 10))
    if (res.success && res.data) {
      setServerInfo(res.data)
      toast.success(`Mobile Companion server restarted on port ${res.data.port}!`)
    } else toast.error(res.error || 'Failed to restart server')
  }

  const handleStartCloudflare = async () => {
    let activePort = serverInfo?.isRunning ? serverInfo.port : (parseInt(portInput, 10) || 8080)
    if (!serverInfo?.isRunning) {
      const sRes = await window.api.startMobileServer(activePort)
      if (sRes.success && sRes.data) {
        setServerInfo(sRes.data)
        activePort = sRes.data.port
      }
    }
    setCfLoading(true)
    const res = await window.api.startCloudflareTunnel(activePort)
    if (res.success && res.data && res.data.publicUrl) {
      setCfStatus(res.data)
      toast.success('🎉 Worldwide Cloudflare Tunnel is LIVE!')
    } else {
      toast.error(res.error || 'Could not start Cloudflare Tunnel.')
      await checkCloudflareState()
    }
    setCfLoading(false)
  }

  const handleStopCloudflare = async () => {
    setCfLoading(true)
    const res = await window.api.stopCloudflareTunnel()
    if (res.success && res.data) {
      setCfStatus(res.data)
      toast.success('Cloudflare Tunnel stopped')
    }
    setCfLoading(false)
  }

  const handleDownloadCloudflare = async () => {
    await window.api.openExternalUrl(cfCheck?.downloadUrl || 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi')
    toast.success('Downloading Cloudflare Tunnel installer...')
  }

  const saveWhatsAppSettings = async () => {
    setSavingWa(true)
    const res = await window.api.saveWhatsAppConfig(waConfig)
    if (res.success) toast.success('WhatsApp notification settings saved!')
    else toast.error(res.error || 'Failed to save WhatsApp settings')
    setSavingWa(false)
  }

  const testWhatsAppDispatch = async () => {
    if (!waConfig.ownerPhone) {
      toast.error('Please enter an Owner WhatsApp Phone Number first')
      return
    }
    setTestingWa(true)
    const res = await window.api.sendWhatsAppDayClose(undefined, true)
    if (res.success) toast.success('WhatsApp Day Close summary generated & opened!')
    else toast.error(res.error || 'Failed to dispatch WhatsApp message')
    setTestingWa(false)
  }

  const handleAllowFirewall = async () => {
    toast('Opening Windows Administrator prompt to allow port in Firewall...', { icon: '🛡️' })
    const res = await window.api.allowFirewall()
    if (res.success) {
      toast.success('Firewall rule command dispatched! Please click "Yes" on Windows prompt if it appears.')
    } else {
      toast.error(res.error || 'Failed to trigger firewall command')
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: 840, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* SECTION 1: LOCAL WI-FI ACCESS */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">Local Wi-Fi Network Access</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={serverInfo?.isRunning ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '0.75rem' }}>
              {serverInfo?.isRunning ? `Online (Port ${serverInfo.port})` : 'Offline'}
            </span>
            {serverInfo?.isRunning ? (
              <button
                className="btn btn-secondary btn-xs"
                onClick={stopServer}
                style={{ color: 'var(--color-danger)' }}
              >
                Turn Offline
              </button>
            ) : (
              <button
                className="btn btn-primary btn-xs"
                onClick={startServer}
              >
                Turn Online
              </button>
            )}
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Port configuration & Firewall shortcut */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, background: 'var(--color-surface-2)',
            padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
            width: '100%', boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Server Port:</span>
              <input
                type="number"
                value={portInput}
                onChange={e => setPortInput(e.target.value)}
                className="form-input font-mono"
                style={{ width: 85, height: 32, padding: '2px 8px', fontSize: '0.8125rem', textAlign: 'center' }}
              />
              <button className="btn btn-secondary btn-xs" onClick={restartServer}>
                Restart
              </button>
            </div>

            <button
              className="btn btn-secondary btn-xs"
              onClick={handleAllowFirewall}
              title="Allow port through Windows Defender Firewall"
            >
              <Shield size={12} style={{ color: 'var(--color-primary)' }} /> Allow in Windows Firewall
            </button>
          </div>

          {/* Active Network URLs */}
          {serverInfo?.allUrls && serverInfo.allUrls.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Active Local Network URLs:
              </div>
              {serverInfo.allUrls.map((url, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--color-surface-2)', padding: '10px 12px',
                  borderRadius: 8, border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, flex: 1 }}>
                    <span className={idx === 0 ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '0.6875rem' }}>
                      {idx === 0 ? 'Primary Wi-Fi' : 'Alternative'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                      {url}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => copyUrl(url, 'Wi-Fi Link')}
                    >
                      <Copy size={11} /> Copy
                    </button>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => openInDefaultBrowser(url)}
                    >
                      <ExternalLink size={11} /> Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '12px 0' }}>
              No active Wi-Fi interfaces detected.
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)', padding: '8px 12px', borderRadius: 6, lineHeight: 1.4 }}>
            💡 Connect phone or tablet to the same shop Wi-Fi and open the <strong>Primary Wi-Fi URL</strong> in mobile browser.
          </div>
        </div>
      </div>

      {/* SECTION 2: WORLDWIDE CLOUDFLARE ACCESS */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="card-title">Worldwide Access (Cloudflare Secure Tunnel)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {cfChecking ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={12} className="animate-spin" /> Checking...
              </span>
            ) : cfCheck?.isInstalled ? (
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>✓ Cloudflared Ready</span>
            ) : (
              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>⚠️ Not Installed</span>
            )}
            <button
              className="btn btn-secondary btn-xs"
              onClick={checkCloudflareState}
              disabled={cfChecking}
              title="Refresh status"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!cfCheck?.isInstalled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Install the free Cloudflare Tunnel utility on this {cfCheck?.platformLabel || 'computer'} to access the POS remotely without port forwarding.
              </div>
              <div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleDownloadCloudflare}
                >
                  <Download size={13} /> Download for {cfCheck?.platformLabel || 'System'}
                </button>
              </div>
            </div>
          ) : cfStatus?.isRunning && cfStatus.publicUrl ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)', padding: 14, borderRadius: 8,
              border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: 10,
              width: '100%', boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                🟢 Public Worldwide Link Active:
              </div>

              <div style={{
                background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 6,
                border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)', wordBreak: 'break-all'
              }}>
                {cfStatus.publicUrl}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={() => openInDefaultBrowser(cfStatus.publicUrl!)}
                >
                  <ExternalLink size={12} /> Open in Browser
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => copyUrl(cfStatus.publicUrl!, 'Cloudflare Link')}
                >
                  <Copy size={12} /> Copy Link
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={handleStopCloudflare}
                  disabled={cfLoading}
                  style={{ color: 'var(--color-danger)', marginLeft: 'auto' }}
                >
                  <Square size={12} /> Stop Tunnel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Cloudflared is installed. Click below to launch your encrypted worldwide access link.
              </div>
              <div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleStartCloudflare}
                  disabled={cfLoading}
                >
                  {cfLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  {cfLoading ? 'Launching Tunnel...' : 'Launch Worldwide Tunnel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: AUTOMATED WHATSAPP DAY CLOSE */}
      <div className="card">
        <div className="card-header">
          <MessageSquare size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Automated WhatsApp Day Close Delivery</span>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, width: '100%', boxSizing: 'border-box' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Owner WhatsApp Phone Number *</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="e.g. 03001234567 or 923001234567"
                value={waConfig.ownerPhone}
                onChange={e => setWaConfig({ ...waConfig, ownerPhone: e.target.value })}
              />
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Include local or country code (e.g. 03001234567)
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nightly Scheduled Dispatch Time</label>
              <input
                type="time"
                className="form-input font-mono"
                value={waConfig.autoCloseTime}
                onChange={e => setWaConfig({ ...waConfig, autoCloseTime: e.target.value })}
              />
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Default is 22:00 (10:00 PM)
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            background: 'var(--color-surface-2)', padding: 14,
            borderRadius: 8, border: '1px solid var(--color-border)',
            width: '100%', boxSizing: 'border-box'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={waConfig.autoCloseEnabled}
                onChange={e => setWaConfig({ ...waConfig, autoCloseEnabled: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  Enable Automated Nightly Dispatch at {waConfig.autoCloseTime || '10:00 PM'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Dispatches the Day Close summary to owner's WhatsApp automatically.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={waConfig.sendOnDayClose}
                onChange={e => setWaConfig({ ...waConfig, sendOnDayClose: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  Auto-Prompt WhatsApp Summary on Day Close Submission
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Prepares the formatted WhatsApp summary when closing the day.
                </div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={testWhatsAppDispatch}
              disabled={testingWa}
            >
              <Send size={13} style={{ color: 'var(--color-primary)' }} />
              {testingWa ? 'Dispatching...' : 'Test WhatsApp Message'}
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveWhatsAppSettings}
              disabled={savingWa}
            >
              <CheckCircle size={13} /> {savingWa ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
