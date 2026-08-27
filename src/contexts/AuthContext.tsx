import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { User } from '../types'

interface AuthContextType {
  currentUser: User | null
  isAuthenticated: boolean
  isOwner: boolean
  login: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  // Permission helpers — always check perm flags, never trust role alone
  can: (perm: keyof PermissionMap) => boolean
  canViewCostPrice: boolean
  canViewProfit: boolean
  canVoidInvoice: boolean
  canEditInvoice: boolean   // staff cannot edit unless owner grants
  canProcessReturn: boolean
  canAddEditStock: boolean
  canRecordPurchase: boolean
  canViewAccounts: boolean
  canViewAllReports: boolean
  canManualStockAdjust: boolean
  canAccessMaintenance: boolean
  canManageUsers: boolean
  canDayClose: boolean
  discountLimit: number
}

interface PermissionMap {
  pos: boolean
  orders: boolean
  sales: boolean
  barcode: boolean
  customers: boolean
  view_cost_price: boolean
  view_profit: boolean
  apply_discount: boolean
  void_invoice: boolean
  edit_invoice: boolean
  process_return: boolean
  add_edit_stock: boolean
  record_purchase: boolean
  view_accounts: boolean
  view_all_reports: boolean
  manual_stock_adjust: boolean
  open_cash_drawer: boolean
  day_closing: boolean
  access_maintenance: boolean
  manage_users: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Restore session from sessionStorage
    try {
      const saved = sessionStorage.getItem('pos_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const login = useCallback(async (username: string, pin: string) => {
    const result = await window.api.login(username, pin)
    if (result.success && result.user) {
      setCurrentUser(result.user)
      sessionStorage.setItem('pos_user', JSON.stringify(result.user))
      return { success: true }
    }
    return { success: false, error: result.error || 'Invalid username or PIN.' }
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    sessionStorage.removeItem('pos_user')
  }, [])

  // Permission checker — reads directly from user's permission flags
  const can = useCallback((perm: keyof PermissionMap): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'owner') return true
    const permMap: Record<keyof PermissionMap, number | undefined> = {
      pos:                currentUser.perm_pos ?? 1,
      orders:             currentUser.perm_orders ?? 1,
      sales:              currentUser.perm_sales ?? 1,
      barcode:            currentUser.perm_barcode ?? 1,
      customers:          currentUser.perm_customers ?? 1,
      view_cost_price:    currentUser.perm_view_cost_price,
      view_profit:        currentUser.perm_view_profit,
      apply_discount:     currentUser.perm_apply_discount,
      void_invoice:       currentUser.perm_void_invoice,
      edit_invoice:       currentUser.perm_edit_invoice,
      process_return:     currentUser.perm_process_return,
      add_edit_stock:     currentUser.perm_add_edit_stock,
      record_purchase:    currentUser.perm_record_purchase,
      view_accounts:      currentUser.perm_view_accounts,
      view_all_reports:   currentUser.perm_view_all_reports,
      manual_stock_adjust:currentUser.perm_manual_stock_adjust,
      open_cash_drawer:   currentUser.perm_open_cash_drawer,
      day_closing:        currentUser.perm_day_closing,
      access_maintenance: currentUser.perm_access_maintenance,
      manage_users:       currentUser.perm_manage_users,
    }
    return !!permMap[perm]
  }, [currentUser])

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    isOwner: currentUser?.role === 'owner',
    login,
    logout,
    can,
    canViewCostPrice:    !!currentUser?.perm_view_cost_price,
    canViewProfit:       !!currentUser?.perm_view_profit,
    canVoidInvoice:      !!currentUser?.perm_void_invoice,
    canEditInvoice:      !!currentUser?.perm_edit_invoice,
    canProcessReturn:    !!currentUser?.perm_process_return,
    canAddEditStock:     !!currentUser?.perm_add_edit_stock,
    canRecordPurchase:   !!currentUser?.perm_record_purchase,
    canViewAccounts:     !!currentUser?.perm_view_accounts,
    canViewAllReports:   !!currentUser?.perm_view_all_reports,
    canManualStockAdjust:!!currentUser?.perm_manual_stock_adjust,
    canAccessMaintenance:!!currentUser?.perm_access_maintenance,
    canManageUsers:      !!currentUser?.perm_manage_users,
    canDayClose:         !!currentUser?.perm_day_closing,
    discountLimit:       currentUser?.perm_discount_limit ?? 0,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
