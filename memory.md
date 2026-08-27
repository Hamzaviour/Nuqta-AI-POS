# Al-Deewan POS System — Architecture & System Memory

> **System Name**: Al-Deewan POS System  
> **Target Industry**: Wholesale & Retail Clothing, Fabrics & Apparel  
> **Platform**: Windows Desktop Application (Offline-First Electron + SQLite + React)  
> **Version**: 1.0.0  
> **Primary Technology Stack**: Electron 29, React 18, TypeScript, SQLite / sql.js, Vite 5  

---

## 1. System Architecture Overview

```mermaid
graph TD
    subgraph Frontend [Renderer Process (React 18 + TypeScript + CSS Modules)]
        UI[Modern POS Interface]
        AuthContext[Auth & Session Context]
        Router[React Router DOM]
        Modals[Quick Add Modals & Dialogs]
    end

    subgraph Bridge [Preload & IPC Security Layer]
        Preload[electron/preload/index.ts (contextBridge)]
        IPC_Channels[Typed IPC Invoke / Handle]
    end

    subgraph Backend [Main Process (Electron + Node.js)]
        MainApp[electron/main/index.ts]
        DB_Engine[electron/database/db.ts (SQLite Engine)]
        AuditEngine[System Audit & Activity Logger]
        BackupEngine[Automated DB Backup & Restore]
    end

    UI --> Preload
    Preload --> MainApp
    MainApp --> DB_Engine
    DB_Engine --> AuditEngine
```

---

## 2. Core Modules & Feature Specifications

### 🛒 1. Point of Sale (POS) & Counter Billing (`/pos`)
* **Barcode & Part Number Fast Search**: Instant lookup by barcode scan or typing SKU / Name (e.g. `Alkaram 2-Piece`, `Safa Noor 3-Piece`).
* **Global Navigation Hotkey**: Pressing <kbd>F2</kbd> anywhere in the application immediately switches to POS counter billing.
* **Strict Negative Inventory Prevention**: Items with 0 quantity cannot be sold; blocked at both UI and database transaction levels.
* **Granular Cashier Action Checks**:
  * Line & Bill Discounts with maximum % cap (`perm_discount_limit`).
  * Invoice editing & voiding privileges with supervisor override.
  * Real-time profit / margin markup calculation (`perm_view_profit`).
  * Wholesale cost price visibility toggling (`perm_view_cost_price`).
* **Multi-Channel Sale Sources**: In-Store Counter, WhatsApp Orders, Social Media Orders.
* **Park & Resume Sales**: Hold current cart state to serve other customers and resume anytime.

### 📦 2. Stock, Inventory & Product Catalog (`/stock`)
* **Complete Product Metadata**: SKU/Part Number, Barcode, Name, Brand, Category, Size Variant, Cost Price, Retail Price, Quantity On Hand, Reorder Level, and **Supplier / Fabric Mill association**.
* **Inline Quick-Add Supplier / Mill**: Register new suppliers/mills directly inside item creation/edit forms without leaving the stock screen.
* **Quantity Valuation Report**: Complete valuation table showing `Quantity On Hand`, `Cost Price (Rs)`, `Retail Price (Rs)`, and `Cost Value (Rs)` with summary totals across all pages.
* **Low Stock & Reorder Alerts**: Automatic highlighting of items at or below reorder threshold.
* **Manual Stock Adjustments**: Inventory audit trails with user reference, reasons, and adjustment timestamps.
* **Barcode Label Printing (`/barcode`)**: Integrated thermal barcode sticker label generator.

### 💬 3. WhatsApp & Online Orders Pipeline (`/orders`)
* **Order Status Lifecycle**: Starts at `Pending` status upon POS generation (not delivered).
* **Courier & Dispatch Tracking**: Assign tracking IDs, update dispatch status, and manage payment collection.

### 🛍️ 4. Purchases & Goods Received (`/purchases`)
* **Supplier Billing & Receiving**: Record incoming shipments with cost price, quantity, invoice reference, and cash/credit terms.
* **Automatic Restocking**: Automatically increments inventory on hand and updates the supplier's payable ledger balance.
* **Supplier Quick-Add**: Inline button to register new suppliers while recording purchase bills.

### 📄 5. Sales History & Receipt Repository (`/sales`)
* **Comprehensive Search & Filter**: Filter by date range, invoice number, customer, status, payment method, or cashier staff.
* **Reprint & Void**: Full thermal receipt reprinting and invoice voiding (restores stock back into inventory).

### 🔄 6. Customer Returns & Restocking (`/returns`)
* **Return Processing**: Accept returned items with reason, issue cash/bank refund, and restock goods back into active inventory.

### 👥 7. Customers & Khata CRM (`/customers`)
* **Customer Ledgers**: Walk-in, regular, and online customer profiles with credit limits and Khata balance tracking.
* **Payment Receipts**: Record customer payments against balance dues with automated journal postings.

### 🔒 8. End-of-Day Closing & Cash Reconciliation (`/day-close`)
* **Daily Cash Balancing**: Calculates expected cash from cash sales, customer payments, and cash returns.
* **Physical Cash Counts & Variance**: Compares drawer cash against calculated expected cash.
* **Day Locking**: Locks past business dates to prevent unauthorized backdated tampering.

### 🏦 9. Double-Entry Accounts & Financial Ledgers (`/accounts`)
* **Chart of Accounts**: Assets, Liabilities, Equity, Revenue, and Expense accounts.
* **General Ledger & Journal Entries**: Balanced double-entry accounting entries (Debit = Credit).
* **Supplier Ledger & Payments**: Settle vendor dues with payment vouchers.

### 📊 10. Management Reports & Business Analytics (`/reports`)
* **Daily Sales Report**: Detailed itemized sales with cost, discount, net revenue, and profit/loss.
* **Staff Sales Leaderboard**: Sales totals and profit contribution per staff member.
* **Trading Profit & Loss Statement**: Month-wise and year-wise Gross Profit, COGS, and Net Income.
* **Aging Analysis**: Accounts receivable aging brackets (0–30, 31–60, 61–90, 90+ days).

### 🛠️ 11. Maintenance, Backups & User Security (`/maintenance`)
* **Hierarchical Role & Permission Architecture**:
  * Each module has a **Master Module Access Switch** (sidebar visibility).
  * Beneath each module, all granular action checks, discount limits, and data visibility switches are clearly grouped.
  * **Quick Role Presets**: `👑 Full Admin`, `👔 Manager`, `🛍️ Cashier / Sales`, `🔒 Lock All`.
* **5-3 Data Reindex**: Health check routine that audits and recalculates all balances and stock levels.
* **Database Backup & Restore**: Automated and manual SQLite backup snapshots.
* **Custom Receipt Logo**: Upload and store high-resolution brand invoice logos.

---

## 3. Database Schema Overview

```sql
-- Core Users & Permissions
CREATE TABLE users (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  username                  TEXT UNIQUE NOT NULL,
  pin                       TEXT NOT NULL,
  role                      TEXT NOT NULL CHECK(role IN ('owner','manager','salesperson')),
  is_active                 INTEGER NOT NULL DEFAULT 1,
  perm_pos                  INTEGER NOT NULL DEFAULT 1,
  perm_orders               INTEGER NOT NULL DEFAULT 0,
  perm_sales                INTEGER NOT NULL DEFAULT 1,
  perm_barcode              INTEGER NOT NULL DEFAULT 0,
  perm_customers            INTEGER NOT NULL DEFAULT 1,
  perm_view_cost_price      INTEGER NOT NULL DEFAULT 0,
  perm_view_profit          INTEGER NOT NULL DEFAULT 0,
  perm_apply_discount       INTEGER NOT NULL DEFAULT 1,
  perm_discount_limit       REAL NOT NULL DEFAULT 10,
  perm_void_invoice         INTEGER NOT NULL DEFAULT 0,
  perm_edit_invoice         INTEGER NOT NULL DEFAULT 0,
  perm_process_return       INTEGER NOT NULL DEFAULT 0,
  perm_add_edit_stock       INTEGER NOT NULL DEFAULT 0,
  perm_record_purchase      INTEGER NOT NULL DEFAULT 0,
  perm_view_accounts        INTEGER NOT NULL DEFAULT 0,
  perm_view_all_reports     INTEGER NOT NULL DEFAULT 0,
  perm_manual_stock_adjust  INTEGER NOT NULL DEFAULT 0,
  perm_open_cash_drawer     INTEGER NOT NULL DEFAULT 0,
  perm_day_closing          INTEGER NOT NULL DEFAULT 0,
  perm_access_maintenance   INTEGER NOT NULL DEFAULT 0,
  perm_manage_users         INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

-- Items & Products
CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  part_number       TEXT UNIQUE NOT NULL,
  barcode           TEXT UNIQUE,
  name              TEXT NOT NULL,
  brand_id          TEXT REFERENCES brands(id),
  category_id       TEXT REFERENCES categories(id),
  supplier_id       TEXT REFERENCES suppliers(id),
  size_variant      TEXT,
  cost_price        REAL NOT NULL DEFAULT 0,
  retail_price      REAL NOT NULL DEFAULT 0,
  quantity_on_hand  REAL NOT NULL DEFAULT 0,
  reorder_level     REAL NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Suppliers & Fabric Mills
CREATE TABLE suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT,
  address     TEXT,
  balance     REAL NOT NULL DEFAULT 0,
  notes       TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL
);
```

---

## 4. Quality Assurance & Test Verification

The application is validated by a Senior QA Test Suite verifying 26 test suites across 11 core functional modules:

| # | Module / Subsystem | Verification Details | Status |
|---|---|---|---|
| 1 | **Authentication & RBAC** | PIN validation, deactivation blocking, staff permission boundaries | ✅ Passed |
| 2 | **Inventory & Stock** | Barcode retrieval, supplier linking, low stock detection, audit trail | ✅ Passed |
| 3 | **POS Invoicing Engine** | Cash/credit billing, negative stock blocking, WhatsApp pending status, void stock restock | ✅ Passed |
| 4 | **Day Closing & Cash** | Expected cash math, variance tracking, date locking | ✅ Passed |
| 5 | **Purchases & Suppliers** | Bill entry, supplier payable ledger updates | ✅ Passed |
| 6 | **Financials & P&L** | Revenue, COGS, Gross Profit math precision | ✅ Passed |
| 7 | **Aging Analysis** | 0–30, 31–60, 61–90, 90+ day debtor aging buckets | ✅ Passed |
| 8 | **Security & Injection** | Parameterized query validation against SQL injection | ✅ Passed |
| 9 | **Double Entry Accounting** | Debit = Credit balancing enforcement and unbalanced voucher rejection | ✅ Passed |
| 10 | **Sales Returns** | Return approval, customer refund, automated restock | ✅ Passed |
| 11 | **Parked Sales Queue** | Cart serialization, hold queue, and cart restoration | ✅ Passed |

---

## 5. Build & Deployment Reference

* **Development Server**: `npm run dev`
* **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`)
* **Windows Production Packaging**: `npm run package:win`
  * Standalone Portable Binary: `release/Al-Deewan POS 1.0.0.exe`
  * NSIS Full Installer: `release/Al-Deewan POS Setup 1.0.0.exe`
  * Unpacked Folder: `release/win-unpacked/`
* **Desktop Shortcut**: Automatically configured on the user's desktop to launch with 1 click.

---

## 6. Key Business & Design Directives

1. **Brand Aesthetics**: Luxurious gold & emerald accents, dark header, modern typography, crisp high-contrast tables.
2. **Offline-First Resilience**: Entire application runs completely standalone with zero cloud dependency.
3. **Data Integrity**: Every financial and inventory change produces an immutable audit transaction record.
4. **Intuitive Navigation**: Full keyboard shortcut support (<kbd>F2</kbd> for POS, fast search, barcode auto-detection).
