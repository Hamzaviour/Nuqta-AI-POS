# Al-Deewan POS System v2.0.0 🛍️

<div align="center">
  <img src="resources/icon.png" alt="Al-Deewan Logo" width="120" />
  <h3>Enterprise Wholesale & Retail Clothing Point of Sale (POS) — Version 2.0.0</h3>
  <p>A mission-critical desktop Point of Sale, Inventory Management, Double-Entry Accounting, and Remote Cloud Management ERP built with <b>Electron, React 18, TypeScript, and Vite</b>.</p>
</div>

---

## 🌟 What's New in Version 2.0.0

- 🌐 **Cloudflare Tunnel & Remote Live Portal**: Real-time remote store monitoring, live dashboard KPIs, remote invoicing, stock lookup, and day close Z-reports from any smartphone or tablet worldwide without router port forwarding.
- 🎙️ **Voice AI Invoicing Assistant**: Natural speech-to-invoice engine allowing voice commands to add products, adjust quantities, and generate customer receipts hands-free.
- 💵 **Realized vs Invoiced Profit Tracking**: Accurate accounting separation between realized cash profit and pending credit receivables on sales reports.
- ✏️ **Invoice Audit & Editor**: Complete invoice modification with automatic stock rollback, customer credit balance sync, and financial ledger audit logs.
- 🧾 **WhatsApp Direct Sharing & Thermal Print Suite**: 80mm high-speed receipt generator with store branding, WhatsApp contact, QR code, and customer statement dispatch.
- ⚡ **Automated GitHub Actions CI/CD**: Pushing changes or tags automatically compiles production-ready Windows NSIS Setup (`.exe`), Portable (`.exe`), and macOS (`.dmg`) installers in GitHub Actions.

---

## 🌟 Core Modules

### 1. 🛒 POS Terminal (Wholesale & Retail Modes)
- **Rapid Item Scanning & Search**: Instant barcode scanner support or keyword search with auto-switch between wholesale and retail price tiers.
- **Multi-Invoice Hold & Next**: Switch between multiple active customer carts (<kbd>F9</kbd>) without losing cart items.
- **Direct Drawer Expenses**: Record petty cash expenses directly from the POS interface.
- **Flexible Multi-Channel Payments**: Cash, Card, Credit, Bank Transfer (JazzCash, EasyPaisa, Bank accounts), and Split payment allocations.
- **Thermal Receipt Printing**: 80mm thermal receipt printing with store branding, QR codes, and refund watermarks.

### 2. 📦 Stock & Catalog Management
- **Real-Time Inventory Tracking**: Low stock alerts, category filtering, wholesale cost vs retail pricing, and supplier attribution.
- **Barcode Studio**: Create and print standard barcode sticker labels for garments and fabric rolls.
- **Purchase Orders & Restocking**: Record incoming inventory batches with automated supplier ledger cost updates.

### 3. 🔄 Returns & Refund System
- **Invoice Return Lookup**: Look up sales by invoice number or barcode with item-level return adjustments.
- **System-Wide Refund Sync**: Automatically updates invoice status to `refunded` across sales history, ledgers, and financial reports.
- **Double-Refund Shield**: Blocks duplicate return attempts and accurately adjusts profit calculations.

### 4. 🌐 Remote Mobile Server & Cloud Portal
- **Local Wi-Fi LAN Sync**: Connect multiple billing counters across store terminals with zero cloud latency.
- **Cloudflare Remote Tunnel**: Secure encrypted remote access for business owners to view live sales, manage stock, and check day closing reports on mobile.

### 5. 🔒 Day Close & Cash Reconciliation
- **Automated Drawer Summaries**: Real-time aggregation of cash, card, and digital transactions.
- **Interactive Denomination Counter**: Breakdown of physical currency notes (Rs. 5000 to Rs. 10) with automatic over/short variance detection.
- **WhatsApp Z-Report**: Generates formatted daily business closing summaries for direct WhatsApp sharing.

### 6. 📊 Accounting, Ledgers & Analytics
- **Double-Entry Ledgers**: Customer credit ledgers, supplier payables, and chart of accounts.
- **Profit & Loss Analytics**: Realized cash profit vs pending credit profit calculations.
- **Staff Performance Leaderboards**: Sales volume, bill counts, and commissions per staff member.

### 7. 🛡️ Role-Based Access Control (RBAC)
- **Roles**: `Owner` (Full access), `Store Manager`, and `Sales Staff`.
- **4-Digit Quick PIN**: Fast user switching with tactile on-screen keypad and keyboard shortcuts.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>F2</kbd> | Open POS Terminal / Start New Sale |
| <kbd>F4</kbd> | View Previous Invoices |
| <kbd>F9</kbd> | Hold Active Sale / Next Invoice Tab |
| <kbd>F10</kbd> | Focus Product Search Field |
| <kbd>F12</kbd> | Open Built-in Calculator |
| <kbd>Ctrl</kbd> + <kbd>F12</kbd> | Switch Active User Account / Lock POS |

---

## ⚡ Automated Installer Generation via GitHub Actions

This repository includes a preconfigured GitHub Actions workflow (`.github/workflows/build-installers.yml`) to automatically compile and release production installers.

### How to Build on GitHub:
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: release v2.0.0"
   git push origin main
   ```
2. **Download Artifacts**:
   - Go to your repository on GitHub → **Actions** tab.
   - Click on the running/completed workflow **Build Production Installers**.
   - Download the generated installer ZIPs from the **Artifacts** section:
     - `Al-Deewan-POS-Windows-Installer-v2.0` (Contains `Al-Deewan-Setup-2.0.0.exe` and `Al-Deewan-Portable-2.0.0.exe`)
     - `Al-Deewan-POS-macOS-Installer-v2.0` (Contains `Al-Deewan-POS-2.0.0-Mac-*.dmg`)

3. **Automatic GitHub Releases**:
   - Tagging a commit (e.g., `git tag v2.0.0 && git push origin --tags`) will automatically create a formal GitHub Release and publish all installer binaries for direct one-click public download!

---

## 🛠️ Local Development & Building

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or v20.x recommended)
- `npm`

### Local Commands
```bash
# 1. Install dependencies
npm install

# 2. Run in development mode (with Hot Module Replacement)
npm run dev

# 3. Verify TypeScript types
npm run typecheck

# 4. Compile production bundle
npm run build

# 5. Package Windows installer locally (.exe & Portable)
npm run build:win

# 6. Package macOS DMG installer locally
npm run build:mac
```

---

## 📁 Project Structure

```
Al-Deewan POS System/
├── .github/workflows/
│   └── build-installers.yml # CI/CD GitHub Actions automated packaging workflow
├── electron/
│   ├── database/
│   │   ├── db.ts            # SQLite engine, queries, migrations & audit trail
│   │   └── schema.sql       # Database table schemas
│   ├── main/
│   │   ├── cloudflareTunnel.ts # Cloudflare Tunnel manager for remote live portal
│   │   ├── mobileServer.ts     # Embedded mobile HTTP/REST API server
│   │   └── index.ts         # Electron main process & IPC handlers
│   └── preload/
│       └── index.ts         # Secure preload bridge exposing window.api
├── resources/
│   ├── icon.ico             # Windows application icon
│   └── icon.png             # macOS / Desktop PNG icon
├── src/
│   ├── assets/              # Branding and image assets
│   ├── components/          # Reusable UI components, modals & invoice editors
│   ├── contexts/            # React Auth, Hotkeys & State Providers
│   ├── pages/               # Application Modules (POS, Stock, Sales, DayClose, etc.)
│   ├── styles/
│   │   └── global.css       # Luxury design system tokens & styles
│   └── types/               # TypeScript interfaces & data contracts
├── package.json             # NPM dependencies, metadata & electron-builder config
└── tsconfig.json            # TypeScript configuration
```

---

## 📄 License

This project is proprietary software created for **Al-Deewan Brand**. All rights reserved.

