# Al-Deewan POS System — Comprehensive Operations & User Manual

**Version:** 2.0.0 Production Release  
**Platform:** Windows 10/11 & macOS  
**Target Industry:** Wholesale Clothing, Retail Fashion, Boutiques, Fabrics & General Retail  

---

# Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Getting Started & Initial Setup](#2-getting-started--initial-setup)
3. [Point of Sale (POS) Counter Billing](#3-point-of-sale-pos-counter-billing)
4. [Online Orders & WhatsApp Dispatch Manager](#4-online-orders--whatsapp-dispatch-manager)
5. [Sales History, Invoices & Debt Collection](#5-sales-history-invoices--debt-collection)
6. [Stock & Inventory Catalog Management](#6-stock--inventory-catalog-management)
7. [Suppliers, Mills & Purchase Restocking](#7-suppliers-mills--purchase-restocking)
8. [Sales Returns, Refunds & Restocking](#8-sales-returns-refunds--restocking)
9. [Customers & Receivables (Accounts Receivable)](#9-customers--receivables-accounts-receivable)
10. [Barcode Studio & Thermal Label Printing](#10-barcode-studio--thermal-label-printing)
11. [Double-Entry Accounting & Financial Reports](#11-double-entry-accounting--financial-reports)
12. [Day Closing, Cash Drawer & WhatsApp Z-Report](#12-day-closing-cash-drawer--whatsapp-z-report)
13. [Store Expenses & Petty Cash Outflows](#13-store-expenses--petty-cash-outflows)
14. [Multi-Terminal LAN Network Sync](#14-multi-terminal-lan-network-sync)
15. [Remote Mobile Server & Cloudflare Tunneling](#15-remote-mobile-server--cloudflare-tunneling)
16. [Security, Roles & Granular Permissions](#16-security-roles--granular-permissions)
17. [Automated Cloud Backups & System Maintenance](#17-automated-cloud-backups--system-maintenance)
18. [Voice AI POS Assistant (Whisper Speech Engine)](#18-voice-ai-pos-assistant-whisper-speech-engine)
19. [Keyboard Shortcuts Master Reference](#19-keyboard-shortcuts-master-reference)

---

# 1. System Overview & Architecture

**Al-Deewan POS System** is a mission-critical desktop business management software built specifically for high-speed retail and wholesale garment businesses.

### Core Architecture Highlights:
- **Embedded Zero-Config Database:** Runs on an embedded SQLite WebAssembly engine (`aldeewan-pos.db`). No external database servers (MySQL/SQL Server) or Python runtimes required.
- **100% Offline Resilience:** Continues operating during internet outages. Local data persists securely in `%APPDATA%\Al-Deewan POS System`.
- **Multi-Terminal LAN Sync:** Connect multiple billing counters across a store or warehouse over local Wi-Fi without cloud latency.
- **Enterprise Accounting:** True double-entry ledger tracking for Accounts Receivable, Accounts Payable, Expenses, Cash, and Bank accounts.

---

# 2. Getting Started & Initial Setup

### First Launch & Login
1. Launch **Al-Deewan POS System** from your Desktop or Start Menu.
2. Select your user account on the lock screen and enter your **4-Digit Secret PIN**.
3. **Default Owner Account:**
   - **Username:** `admin` / `owner`
   - **Role:** Store Owner (Unrestricted supervisor access)

### Company Profile & Receipt Branding
1. Navigate to **Maintenance → System Setup**.
2. Configure your business identity:
   - **Company Name, Address & Phone Number** (printed on thermal receipts and A4 invoices).
   - **Receipt Header Brand Logo:** Upload a PNG logo (`300 × 120px`) for bill headers.
   - **WhatsApp Community QR Code:** Upload your WhatsApp VIP community QR code to print at the bottom of bills.
   - **Return & Exchange Policy:** Custom text printed at the receipt footer.
   - **Tax / NTN Number & Currency Symbol** (Default: `Rs.`).
3. Click **Save Settings**.

---

# 3. Point of Sale (POS) Counter Billing

The POS billing screen is engineered for sub-second checkout speed with keyboard-first ergonomics.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  [Session 1 (Active)]  [Session 2 (Hold)]  [+] Add Tab                                   │
├──────────────────────────────────────────┬───────────────────────────────────────────────┤
│  🛒 CART ITEMS                           │  💳 CHECKOUT & TOTALS                         │
│  - Barcode Scanner Live Input            │  Subtotal:                 Rs. 15,000         │
│  - AD-101 | Lawn 3pc | Qty: 2 | Rs. 3500 │  Discount:                 Rs.  1,000         │
│  - AD-102 | Kurti Pret | Qty: 1 | Rs. 2000 │  -------------------------------------------  │
│  --------------------------------------- │  Grand Total:              Rs. 14,000         │
│  [F10 Search] [F6 Price] [F7 Expense]    │  [Cash] [Card] [Bank] [Partial / Udhar]       │
│  [Customer: Walk-in / Select]            │  [Complete Sale — Enter]                      │
└──────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 3.1 Adding Products to the Cart
- **Barcode Scanner:** Simply scan any product barcode. The item is instantly added with sound confirmation. Scanning the same barcode multiple times increments quantity automatically.
- **Search Catalog Modal (`F10`):** Press `F10` or click **Search Item**. Search by Part Number, Item Name, Brand, Category, or Supplier. Press `Enter` to add to cart.
- **Multi-Tab Sessions:** Click `+` or press `Ctrl + T` to open up to 10 simultaneous billing tabs. You can hold a customer's cart while serving another customer without losing cart items.

### 3.2 Adjusting Quantities & Pricing
- **Quantity Adjustments:** Use `+` and `-` buttons in the cart or type the exact quantity.
- **Custom Selling Price Override (`F6`):** Click the item price or press `F6` to enter a custom selling rate. The popup displays real-time wholesale cost price and profit markup so cashiers never sell at an unintentional loss.
- **Line & Bill Discounts:** Apply flat rupee discounts or percentage discounts. The system enforces supervisor discount limits configured in user settings.

### 3.3 Customer Assignment & Sales Channels
- **Walk-in Customers:** Selected by default for instant retail checkout.
- **Registered Customers:** Click **Customer** or press `F3` to search by name or phone number. Displays customer credit limit and outstanding ledger balance.
- **Sales Channels:** Tag sales as **In-Store**, **WhatsApp Order**, or **Social Media Order**. (WhatsApp and Social orders mandate customer contact assignment).

### 3.4 Payment Modes & Partial Settlements
1. Click **Pay Now** or press `F12` / `Space`.
2. Select Payment Method:
   - **💵 Full Cash:** Enter tendered cash amount; system calculates change return.
   - **💳 Card Payment:** Record credit/debit card swipe.
   - **🏦 Bank Transfer / Digital Wallet:** Select provider (JazzCash, EasyPaisa, Bank AL Habib, Meezan, etc.) and enter transaction reference slip number.
   - **💸 Partial Cash & Credit (Udhar):** Enter collected amount (e.g., Rs. 7,000 on an Rs. 18,000 bill). The remaining Rs. 11,000 is automatically booked to the customer's ledger, and the invoice is saved with **Pending** status.
3. Press **Enter** to complete sale. Receipt prints automatically and cash drawer pops.

---

# 4. Online Orders & WhatsApp Dispatch Manager

The **Online Orders** module manages WhatsApp, phone, and social media deliveries.

### Workflow:
1. **Order Capture:** In POS, select channel **WhatsApp** or **Social Media**, attach the customer, and complete checkout.
2. **Dispatch Processing:** Open **Online Orders**.
3. **Status Pipeline:**
   - **🟡 Pending:** New order awaiting stock pick.
   - **🔵 Confirmed:** Payment verified / parcel packed.
   - **🟣 Dispatched:** Enter courier name (TCS, Leopard, PostEx, Trax) and **Tracking ID**.
   - **🟢 Delivered:** Cash on Delivery (COD) received.
4. **Thermal Packing Slip:** Click **Print Packing Slip** for shipping address labels.

---

# 5. Sales History, Invoices & Debt Collection

The **Sales** directory maintains an audit log of every historical transaction.

### Features:
- **Search & Filter:** Filter by Date Range, Cashier/Staff, Payment Method, Sales Channel, or Invoice Number.
- **Invoice Status:** Clearly marked as `Completed`, `Pending` (Partial Payment), or `Voided`.
- **Collect Pending Balance:** Open any pending invoice, click **Record Payment**, enter collected cash/bank amount, and download an updated payment receipt.
- **Supervisor Invoice Edit:** Authorized managers can adjust quantities, prices, or add items post-sale.
- **Void Invoice:** Void incorrect bills with mandatory reason logging. Stock is automatically restored to inventory.
- **Export:** Export filtered sales reports to Excel / CSV.

---

# 6. Stock & Inventory Catalog Management

The **Stock** module houses 5 specialized tabs:

### 6.1 Items List (Catalog)
- Add, edit, and deactivate products.
- Product attributes: **Part Number (SKU)**, **Name**, **Barcode**, **Supplier/Mill**, **Brand**, **Category**, **Size/Variant**, **Cost Price**, **Retail Price**, **Reorder Alert Level**.
- **Bulk CSV Import:** Import thousands of products from Excel/CSV in under 5 seconds.

### 6.2 Quantity Report & Stock Valuation
- Real-time stock valuation breakdown: Total Units on Hand, Total Cost Valuation, Total Retail Valuation, Potential Profit.
- Visual alerts for **Low Stock** ($\le$ reorder level) and **Out of Stock** ($0$ units).

### 6.3 Transaction Inquiry (Stock Ledger)
- Comprehensive stock audit trail. Inspect every SKU's complete historical movement:
  - Purchases restock inflow
  - POS counter sales outflow
  - Customer return restock inflow
  - Manual inventory adjustments

### 6.4 Supplier Details Directory
- Dedicated mill and fabric vendor directory.
- Displays linked catalog products, total stock value supplied, outstanding Accounts Payable balance, purchase bill history, and ledger statements.

### 6.5 Stock Performance Analytics
- Revenue contribution charts, fast-moving items, dead stock warnings, and profit margin distributions.

---

# 7. Suppliers, Mills & Purchase Restocking

Manage fabric mills, unstitched suit vendors, and wholesale distributors.

### Purchase Order Workflow:
1. Navigate to **Purchases → Create Purchase Order**.
2. Select **Supplier / Mill** and enter Vendor Bill / Invoice Reference number.
3. Add restock items, enter received quantities and wholesale cost prices.
4. Select payment source: **Cash Register Drawer**, **Bank Account**, or **Pay Later (Credit)**.
5. Click **Submit Purchase**.
   - Physical stock quantity increments immediately.
   - Item cost prices update.
   - Supplier ledger balance (AP) updates automatically.

---

# 8. Sales Returns, Refunds & Restocking

Handles customer returns, exchanges, and defective item replacements.

### Return Process:
1. Open **Returns → Process Return**.
2. Enter original **Invoice Number** (or select Walk-in return).
3. Select items and quantities returned.
4. Choose refund mode:
   - **Cash Refund:** Deducts cash from active POS drawer.
   - **Customer Credit:** Deducts balance from customer's debt ledger.
5. Confirm return. Returned items are automatically restored to active inventory stock.

---

# 9. Customers & Receivables (Accounts Receivable)

Maintain comprehensive relationship profiles and debt ledgers for retail buyers and wholesale clients.

### Capabilities:
- **Customer Profiles:** Name, Mobile/WhatsApp, Address, Customer Category (Regular, Wholesale, VIP), and Credit Limit.
- **Party Ledger Statement:** Complete debits (purchases), credits (payments), and running balance history. Filterable by date with PDF / print support.
- **Payment Collection Voucher:** Record incoming customer cash or bank payments to settle pending balances.
- **WhatsApp 1-Click Reminder:** Send personalized ledger balance reminders directly to customer WhatsApp.

---

# 10. Barcode Studio & Thermal Label Printing

Design and print scannable barcode price tags on standard thermal barcode sticker rolls.

### Supported Sticker Roll Sizes:
- `50 × 25 mm` (Standard Retail Sticker)
- `40 × 28 mm` (Boutique Tag)
- `38 × 25 mm` (Compact Jewelry/Garment Label)

### Label Elements:
- Brand / Store Name
- Product Name & Size Variant
- Scannable Code-128 Barcode with human-readable numbers
- Retail Selling Price (`Rs.`)
- **Batch Printing:** Print exact quantities matching in-stock inventory or custom quantities with 1 click.

---

# 11. Double-Entry Accounting & Financial Reports

An integrated financial accounting engine that produces accurate business statements.

### Financial Statements:
- **Chart of Accounts:** Assets, Liabilities, Equity, Revenue, Expenses.
- **General Ledger & Journal Entries:** View debits and credits for every account.
- **Profit & Loss (P&L) Statement:** Live Gross Revenue, Cost of Goods Sold (COGS), Operating Expenses, and Net Profit calculation over any date range.
- **Aging Analysis:** Breakdown of receivables and payables (0-30 days, 31-60 days, 61-90 days, 90+ days).

---

# 12. Day Closing, Cash Drawer & WhatsApp Z-Report

The **Day Close** module reconciles daily cash register receipts and prevents revenue shrinkage.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  🔒 DAY CLOSING RECONCILIATION                                                           │
├──────────────────────────────────────────┬───────────────────────────────────────────────┤
│  DENOMINATION COUNTER                    │  DRAWER SUMMARY (PKR)                         │
│  - Rs. 5000 × [ 25 ] = Rs. 125,000       │  Opening Cash:             Rs.  10,000        │
│  - Rs. 1000 × [ 40 ] = Rs.  40,000       │  + Cash Sales:             Rs. 185,000        │
│  - Rs.  500 × [ 30 ] = Rs.  15,000       │  + Customer Debt Recv:     Rs.  25,000        │
│  - Rs.  100 × [ 80 ] = Rs.   8,000       │  - Petty Cash Expenses:    Rs.  (4,500)       │
│  - Rs.   50 × [ 40 ] = Rs.   2,000       │  - Supplier Cash Paid:     Rs. (20,000)       │
│  --------------------------------------- │  -------------------------------------------  │
│  Total Physical Cash:  Rs. 195,500       │  Expected Drawer Cash:     Rs. 195,500        │
│                                          │  Variance:                 Rs.       0 (OK)    │
├──────────────────────────────────────────┴───────────────────────────────────────────────┤
│  [ Submit Day Close & Lock Invoices ]    [ 📲 Send WhatsApp Z-Report to Owner ]          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Steps:
1. Open **Day Close**.
2. Enter physical denomination counts in the calculator.
3. System verifies physical cash against expected drawer cash and flags any cash shortage or overage.
4. Click **Submit Day Close**. Invoices for that business date are locked against unauthorized editing.
5. Click **Send WhatsApp Day Close** to automatically send the formatted Z-Report summary directly to the store owner's mobile number.

---

# 13. Store Expenses & Petty Cash Outflows

Track routine shop expenses to keep drawer cash and net profit accurate.

- **Quick Record (`F7` in POS):** Cashiers can quickly record tea, staff lunch, delivery fees, stationery, or shop maintenance.
- **Payment Source:** Select **Cash Register Drawer** (automatically deducts from expected drawer cash at day close) or **Owner External Funds / Bank**.
- **Category Ledgers:** Filter and analyze expense breakdown by category over time.

---

# 14. Multi-Terminal LAN Network Sync

Run multiple cash counters simultaneously in the same store without cloud subscription fees.

### Master / Slave Setup:
1. **Master Server Counter:** Set the primary computer to **Master Node** under **Maintenance → Multi-Terminal Sync**.
2. **Slave Billing Terminals:** Set secondary computers to **Terminal Node**.
3. **Auto-Discovery:** The terminal automatically scans and links to the Master Server via local UDP broadcast.
4. **Live Synchronization:** Stock deductions and invoice creations on any terminal reflect across all connected counters in real time.

---

# 15. Remote Mobile Server & Cloudflare Tunneling

Access live store sales and reports from your iPhone, Android, or laptop while away from the shop.

1. Navigate to **Maintenance → Mobile & WhatsApp Remote**.
2. Click **Start Mobile Server**.
3. Click **Launch Cloudflare Tunnel**. The system generates an encrypted public HTTPS URL and QR code.
4. Scan the QR code with your mobile phone to monitor live sales, inventory, and staff performance anywhere in the world.

---

# 16. Security, Roles & Granular Permissions

Hierarchical security matrix protecting your store from employee theft and unauthorized overrides.

| Permission Check | Owner | Manager | Cashier / Sales |
| :--- | :---: | :---: | :---: |
| **Counter POS Billing** | ✅ | ✅ | ✅ |
| **Apply Discounts** | ✅ | ✅ (Max 20%) | ✅ (Max 10%) |
| **Edit Item Selling Price in Cart** | ✅ | ✅ | 🔒 (Configurable) |
| **View Wholesale Cost Prices** | ✅ | ✅ | ❌ Masked |
| **View Profit Margins & P&L** | ✅ | 🔒 | ❌ Hidden |
| **Void / Cancel Invoices** | ✅ | ✅ | ❌ Requires PIN |
| **Edit Completed Invoices** | ✅ | 🔒 | ❌ |
| **Day Closing & Cash Reconcile** | ✅ | ✅ | ❌ |
| **Database Backup & Maintenance**| ✅ | ❌ | ❌ |

---

# 17. Automated Cloud Backups & System Maintenance

Protect your store against hardware failure or accidental deletion.

- **Automated Google Drive Cloud Backup:** Connect your Google Drive in Maintenance to automatically sync encrypted database backups daily.
- **1-Click Local Backup:** Export timestamped `.db` files to a USB drive anytime.
- **Database Restore:** 1-click restore function from any backup archive.
- **Data Reindex & Optimization:** Cleans and defragments the SQLite database for maximum speed.

---

# 18. Voice AI POS Assistant (Whisper Speech Engine)

Hands-free invoice generation powered by high-speed Whisper AI speech recognition.

- **Activate:** Press `F6` in POS or click **Voice Invoice (Owner)**.
- **Natural Commands in Urdu / English:**
  - *"2 suit SKU 101 teen hazaar me dalo customer Hamza"*
  - *"Kurti medium size add karo 1500 discount 200"*
- The NLU engine parses product names, quantities, custom prices, discounts, and customer names directly into the active cart.

---

# 19. Keyboard Shortcuts Master Reference

| Shortcut Key | Action | Description |
| :--- | :--- | :--- |
| **`F10`** | **Search Item Catalog** | Opens instant SKU & name search popup |
| **`F12` / `Space`** | **Pay / Checkout** | Opens payment tender modal |
| **`F3`** | **Select / Add Customer** | Opens customer search & add dialog |
| **`F6`** | **Edit Item Price / Voice** | Opens custom price override or Voice POS |
| **`F7`** | **Add Expense** | Opens petty cash drawer expense popup |
| **`F4`** | **Invoice Discount** | Focuses bill-level discount input |
| **`Ctrl + T`** | **New Billing Session** | Opens a new parallel multi-cart tab |
| **`Ctrl + W`** | **Close Session Tab** | Closes the active held cart tab |
| **`Esc`** | **Cancel / Close Modal** | Closes any open popup dialog |
| **`Enter`** | **Confirm / Submit** | Submits modal forms and completes sales |
