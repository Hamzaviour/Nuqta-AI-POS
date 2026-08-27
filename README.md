# Al-Deewan POS System 🛍️

<div align="center">
  <img src="resources/icon.png" alt="Al-Deewan Logo" width="120" />
  <h3>Enterprise Wholesale & Retail Clothing Point of Sale (POS)</h3>
  <p>A desktop Point of Sale, Inventory Management, and Financial ERP solution built with <b>Electron, React 18, TypeScript, and Vite</b>.</p>
</div>

---

## 🌟 Key Features

### 1. 🛒 POS Terminal
- **Rapid Item Scanning & Search**: Instant barcode input or keyword search with wholesale and retail pricing.
- **Multi-Invoice Hold & Next**: Switch between multiple ongoing sales tabs, hold active invoices (<kbd>F9</kbd>), and recall with ease.
- **Direct Expense Logging**: Record drawer expenses on the fly, instantly reflected in daily summaries and day close totals.
- **Flexible Payments**: Support for Cash, Card, Credit, Bank Transfer (JazzCash, EasyPaisa, Bank accounts), and Split payments.
- **Thermal Receipt Printing**: 80mm thermal receipt printing with store branding, WhatsApp contact, barcode footer, and refunded invoice watermarks.
- **Customer Profiles**: Link registered customers or create new ones directly from the cart drawer.

### 2. 📦 Stock & Catalog Management
- **Real-Time Inventory Tracking**: Monitor quantity on hand, minimum reorder thresholds, and stock valuation.
- **Barcode Tag Generator**: Generate and print standard barcode sticker labels for wholesale clothing items.
- **Purchase Orders**: Record incoming wholesale inventory batches with cost price and supplier linking.

### 3. 🔄 Returns & Refund System
- **Invoice Return Lookup**: Look up sales by invoice number or barcode with granular item selection.
- **Dynamic System-Wide Refund Sync**: Synchronizes invoice statuses automatically to `refunded` across POS history, sales ledgers, and financial reports.
- **Audit Protection**: Permanently blocks double refunds and excludes refunded amounts from profit calculations.

### 4. 📱 Online Orders Queue
- **WhatsApp & Social Media Channels**: Capture and dispatch remote orders with status workflows (`Pending` ➔ `Confirmed` ➔ `Dispatched` ➔ `Completed` / `Refunded`).

### 5. 🔒 Day Close & Cash Reconciliation
- **Automated Drawer Calculations**: Aggregates cash, card, and digital payments for the day.
- **Denomination Counter**: Interactive cash breakdown tool (Rs. 5000, 1000, 500, 100, 50, 20, 10 notes) with variance detection.
- **Daily Lock & Sign**: Locks completed business days to protect financial records against tampering.

### 6. 📊 Reports & Executive Analytics
- **Profit & Loss**: Dynamic gross and net margin analysis excluding voided and refunded invoices.
- **Staff Performance Leaderboard**: Commission, bill count, and sales volume by staff member.
- **Stock Valuation**: Comprehensive breakdown of inventory assets based on cost vs wholesale value.

### 7. 🛡️ Role-Based Access Control (RBAC)
- **Role Profiles**: `Owner` (Full access), `Store Manager`, and `Sales Staff`.
- **Security PIN & Avatars**: Fast user switching with touch-friendly PIN pad and keyboard shortcuts.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>F2</kbd> | Open POS Terminal / Start New Sale |
| <kbd>F4</kbd> | View Previous Invoices |
| <kbd>F9</kbd> | Hold Active Sale / Next Invoice |
| <kbd>F10</kbd> | Focus Product Search |
| <kbd>F12</kbd> | Open Built-in Calculator |
| <kbd>Ctrl</kbd> + <kbd>F12</kbd> | Switch Active User Account |

---

## 🛠️ Technology Stack

- **Runtime**: [Electron](https://www.electronjs.org/) (Desktop application platform)
- **Frontend**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler / Build Tool**: [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS Design System with Google Fonts (*Plus Jakarta Sans*, *Outfit*, *JetBrains Mono*)
- **Database**: SQLite via [sql.js](https://sql.js.org/) (WebAssembly SQLite with disk persistence)
- **Icons & Micro-animations**: [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/), [Canvas Confetti](https://github.com/catdad/canvas-confetti)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   cd "Al-Deewan POS System"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Development Mode

Run the app in live-reload development mode:
```bash
npm run dev
```

### Type Checking & Building

1. **Run TypeScript check:**
   ```bash
   npm run typecheck
   ```

2. **Compile production bundle:**
   ```bash
   npm run build
   ```

3. **Package Windows Installer & Executable:**
   ```bash
   npm run package:win
   ```
   *The packaged installer (`.exe`) and portable build will be generated in the `release/` directory.*

---

## 📁 Project Structure

```
Al-Deewan POS System/
├── electron/
│   ├── database/
│   │   ├── db.ts            # SQLite database logic, queries & migrations
│   │   └── schema.sql       # Database table schemas
│   ├── main/
│   │   └── index.ts         # Electron main process & IPC handlers
│   └── preload/
│       └── index.ts         # Secure preload bridge exposing window.api
├── resources/
│   └── icon.png             # Application desktop icon
├── src/
│   ├── assets/              # Logos and media assets
│   ├── components/          # Reusable UI components & modals
│   │   └── layout/          # AppShell, Navigation, and Header
│   ├── contexts/            # React Auth, Hotkeys & State Providers
│   ├── pages/               # Application Modules
│   │   ├── Accounts/        # Expense & Ledger management
│   │   ├── Barcode/         # Barcode tag generator & label printing
│   │   ├── Customers/       # Customer directory & credit records
│   │   ├── Dashboard/       # Executive summary & live KPI widgets
│   │   ├── DayClose/        # Cash reconciliation & day closing
│   │   ├── Login/           # Luxury staff authentication & PIN pad
│   │   ├── Maintenance/     # DB backup, restore & system tools
│   │   ├── Orders/          # WhatsApp & remote order fulfillment
│   │   ├── POS/             # Point of Sale terminal & checkout drawer
│   │   ├── Purchases/       # Stock purchase order entry
│   │   ├── Reports/         # Analytics, P&L, and staff commissions
│   │   ├── Returns/         # Invoice return lookup & refund handling
│   │   └── Stock/           # Inventory stock catalog
│   ├── styles/
│   │   └── global.css       # Complete design system tokens & utilities
│   ├── types/               # TypeScript interfaces & data contracts
│   ├── App.tsx              # App root & routing configuration
│   ├── index.html           # Main HTML container & Google Fonts
│   └── main.tsx             # React DOM root mounting
├── package.json             # NPM dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

---

## 📄 License

This project is proprietary software created for **Al-Deewan Brand**. All rights reserved.
