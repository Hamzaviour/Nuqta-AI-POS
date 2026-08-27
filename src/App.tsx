import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HotkeyProvider } from './contexts/HotkeyContext'
import AppShell from './components/layout/AppShell'
import LoginPage      from './pages/Login/LoginPage'
import DashboardPage  from './pages/Dashboard/DashboardPage'
import POSPage        from './pages/POS/POSPage'
import CustomersPage  from './pages/Customers/CustomersPage'
import OrdersPage     from './pages/Orders/OrdersPage'
import SalesPage      from './pages/Sales/SalesPage'
import ReturnsPage    from './pages/Returns/ReturnsPage'
import StockPage      from './pages/Stock/StockPage'
import BarcodePage    from './pages/Barcode/BarcodePage'
import PurchasesPage  from './pages/Purchases/PurchasesPage'
import DayClosePage   from './pages/DayClose/DayClosePage'
import ReportsPage    from './pages/Reports/ReportsPage'
import MaintenancePage from './pages/Maintenance/MaintenancePage'
import AccountsPage   from './pages/Accounts/AccountsPage'
import PendingInvoicesPage from './pages/PendingInvoices/PendingInvoicesPage'
import './styles/global.css'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/"            element={<Navigate to="/pos" replace />} />
        <Route path="/pos"         element={<POSPage />} />
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/pending-invoices" element={<PendingInvoicesPage />} />
        <Route path="/orders"      element={<OrdersPage />} />
        <Route path="/sales"       element={<SalesPage />} />
        <Route path="/returns"     element={<ReturnsPage />} />
        <Route path="/stock"       element={<StockPage />} />
        <Route path="/barcode"     element={<BarcodePage />} />
        <Route path="/purchases"   element={<PurchasesPage />} />
        <Route path="/day-close"   element={<DayClosePage />} />
        <Route path="/accounts"    element={<AccountsPage />} />
        <Route path="/reports"     element={<ReportsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/customers"   element={<CustomersPage />} />
        <Route path="*"            element={<Navigate to="/pos" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <HotkeyProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                borderRadius: '10px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              },
              success: {
                iconTheme: { primary: '#16A34A', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#DC2626', secondary: '#fff' },
              }
            }}
          />
        </HotkeyProvider>
      </AuthProvider>
    </HashRouter>
  )
}
