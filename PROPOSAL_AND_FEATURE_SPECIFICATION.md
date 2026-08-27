# Commercial Proposal & Complete Technical Specification

**Project Title:** Al-Deewan POS System — Enterprise Wholesale & Retail Suite  
**Client / Business:** Fashion Retailers, Garment Wholesalers, Boutiques & Textile Stores  
**Package:** Complete Production Software License & Onboarding Package  
**Commercial Investment:** **Rs. 60,000 PKR** (All-Inclusive One-Time Package)  

---

## Executive Summary

**Al-Deewan POS System** is a high-speed, enterprise-grade desktop business management platform developed specifically for fashion retailers, clothing manufacturers, fabric mills, wholesale distributors, and retail boutiques.

Unlike generic POS systems that require recurring monthly SaaS subscription fees, constant internet connectivity, and external database servers, Al-Deewan operates **100% offline with zero cloud dependency**, features built-in **multi-terminal LAN synchronization**, **double-entry accounting**, **automated WhatsApp daily business reports**, and **Voice AI automation**.

---

## Complete Feature Matrix & Granular Specification

Below is an exhaustive breakdown of every module, subsystem, and micro-feature included in the Al-Deewan POS System:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             AL-DEEWAN POS SYSTEM — FULL MODULE MAP                               │
├───────────────────┬───────────────────┬───────────────────┬───────────────────┬──────────────────┤
│ 1. Point of Sale  │ 2. Inventory &    │ 3. Purchases &    │ 4. Accounting &   │ 5. Security &    │
│    Counter Billing│    Stock Catalog  │    Supply Chain   │    Financials     │    Administration│
├───────────────────┼───────────────────┼───────────────────┼───────────────────┼──────────────────┤
│ • Barcode Scan    │ • Multi-Tab Stock │ • Vendor Purchase │ • Chart of Accts  │ • 4-Digit PIN    │
│ • Multi-Sessions  │ • SKU / Variants  │ • Cost Auto-Update│ • P&L Statement   │ • Granular Perms │
│ • Price Override  │ • Low-Stock Alert │ • Settle Payables │ • Party Ledgers   │ • Audit Trail    │
│ • Split / Partial │ • Stock Ledger    │ • PO Invoicing    │ • Aging Analysis  │ • Google Drive   │
│ • WhatsApp Day-Cls│ • CSV Bulk Import │ • Mill Directory  │ • Denomination Calc│ • Remote Mobile │
└───────────────────┴───────────────────┴───────────────────┴───────────────────┴──────────────────┘
```

---

### Module 1: High-Speed Counter Point of Sale (POS)
1. **Multi-Session Cart Tabs:** Open and hold up to 10 parallel customer carts (`Ctrl + T`) simultaneously without losing items.
2. **Instant Barcode Scanner Integration:** Plug-and-play USB/Wireless barcode scanner input with instant sound chime and auto-quantity incrementing.
3. **Product Lookup & SKU Search Modal (`F10`):** Search items in under 50 milliseconds by Part Number, Item Name, Category, Brand, or Supplier.
4. **Counter Selling Price Override (`F6`):** Authorized cashiers can manually adjust unit prices directly in the cart, with live wholesale cost price and margin markup benchmarks visible to prevent accidental losses.
5. **Item-Level & Bill-Level Discounts (`F4`):** Flexible percentage (`%`) or flat rupee (`Rs.`) discounts with strict supervisor discount limits.
6. **Multi-Channel Sales Tagger:** Categorize orders as **In-Store Walk-In**, **WhatsApp Order**, or **Social Media Order**.
7. **Compulsory Customer Verification on Remote Orders:** Auto-prompts customer assignment for phone/online orders to ensure delivery data is captured.
8. **Comprehensive Payment Modes:**
   - Cash (with live change calculator)
   - Credit / Debit Card
   - Bank Transfer / Online Digital Wallets (JazzCash, EasyPaisa, Bank AL Habib, Meezan Bank, etc.) with Reference Slip logging
   - Credit (Udhar)
   - **Split / Partial Payments:** Settle a portion in cash (e.g. Rs. 7,000 of an Rs. 18,000 bill) and automatically assign the remainder to the customer's debt ledger while saving the invoice with **Pending** status.
9. **Petty Cash Store Expenses Shortcut (`F7`):** Record routine shop expenses (tea, staff meals, transport, packaging) directly from the POS counter with instant drawer cash deduction.
10. **Live Cash Register Summary Pill:** Displays active session cash drawer totals at a glance.
11. **Confetti Celebration Physics:** Visual celebratory animations upon completing full retail payments.
12. **Thermal & A4 Invoice Printing:**
    - High-speed 80mm & 58mm thermal receipt printing
    - Standard A4 invoice printing
    - Automatic ESC/POS drawer kick pulse and auto-cutter commands
    - Customizable store logo, WhatsApp QR code, and return policy footer.
13. **Historical Receipt Re-Printing:** 1-click re-print for past invoices.

---

### Module 2: Online Orders & Dispatch Tracking
14. **Centralized WhatsApp & Social Media Order Hub:** Dedicated dispatch tracking dashboard.
15. **Status Lifecycle Pipeline:** Track orders through **Pending → Confirmed → Dispatched → Delivered → Cancelled**.
16. **Courier Logistics Tracker:** Record courier company (TCS, Leopard, PostEx, Trax, Call Courier, etc.) and Tracking Reference Numbers.
17. **Thermal Shipping Address Slips:** Print formatted parcel labels for courier dispatch.

---

### Module 3: Stock & Inventory Management Catalog
18. **Comprehensive Item Profiles:** Part Number (SKU), Name, Barcode, Brand/Mill, Category, Size/Variant (Unstitched, S, M, L, XL), Wholesale Cost Price, Retail Selling Price, Quantity on Hand, Reorder Alert Level.
19. **Quantity & Physical Stock Valuation Report:** Real-time calculation of Total Units in Stock, Total Cost Valuation, Total Retail Valuation, and Projected Gross Margin.
20. **Visual Low Stock & Out of Stock Alerts:** Automated color-coded warning pills for depleted stock levels.
21. **Transaction Inquiry (Stock Audit Trail):** Complete SKU movement ledger tracking all Restocks, Counter Sales, Customer Returns, and Manual Adjustments.
22. **Supplier Details Hub:** Complete mill/vendor directory showing linked products, supplied stock values, outstanding AP payables, and historical purchase bills.
23. **Stock Performance Analytics:** Visual charts displaying fast-moving items, revenue contribution, dead stock indicators, and profit margin distributions.
24. **Bulk CSV / Excel Import Engine:** Import tens of thousands of catalog items and stock levels in seconds.
25. **Bulk CSV Catalog Export:** 1-click export of complete product inventory to Excel.
26. **Quick Add Brand & Supplier Modals:** Add new mills and brands on the fly without leaving active screens.

---

### Module 4: Suppliers, Mills & Restock Purchase Orders
27. **Purchase Order Creation:** Restock inventory with automatic item cost price averaging and physical stock increments.
28. **Vendor Bill Reference Tracking:** Record mill invoice numbers, delivery challan references, and dates.
29. **Payment Source Flexibility:** Pay restocks via Cash Drawer, Bank Transfer, or Book to Accounts Payable (AP Credit).
30. **Supplier Statement & Ledger:** Complete running ledger for every supplier with debits, credits, running balance, and date range filters.
31. **Direct Supplier Payment Vouchers:** Record supplier settlements directly from the Stock or Purchases page.

---

### Module 5: Sales Returns & Customer Replacements
32. **Invoice-Linked Return Processing:** Search original bill and process full or partial item returns.
33. **Automatic Inventory Replenishment:** Restores returned quantities back into stock on hand immediately.
34. **Refund Processing:** Issue cash refunds from register or adjust against customer's credit balance.
35. **Return Reason & Audit Logging:** Detailed logging of defect, exchange, or size return reasons.

---

### Module 6: Customers & Accounts Receivable (AR)
36. **Customer Directory:** Full customer database with phone numbers, WhatsApp, city, addresses, and customer categories (Regular, Wholesale, VIP).
37. **Customer Debt Ledgers (Party Statement):** Detailed running statement of all sales, payments, and balances due.
38. **Customer Payment Collection:** Record incoming cash/bank vouchers to clear customer debts.
39. **1-Click WhatsApp Payment Reminder:** Automatically formats and sends polite balance reminder messages directly to customer WhatsApp.
40. **Credit Limit Enforcement:** Prevents billing beyond pre-authorized credit limits.

---

### Module 7: Barcode Studio & Thermal Label Printing
41. **Multi-Size Label Formats:** Native support for `50 × 25 mm`, `40 × 28 mm`, and `38 × 25 mm` thermal sticker rolls.
42. **Configurable Price Tag Elements:** Toggle Brand name, Product Name, Size Variant, Price (`Rs.`), and Scannable Code-128 barcode.
43. **Bulk Batch Printing:** 1-click generation of exact label counts matching current physical stock or custom quantities.
44. **Live Print Preview:** Real-time WYSIWYG preview before sending to thermal printer.

---

### Module 8: Double-Entry Accounting & Financial Reports
45. **Chart of Accounts:** Complete standard ledgers for Assets, Liabilities, Equity, Revenue, and Operating Expenses.
46. **General Ledger & Journal Entries:** Automatic ledger postings for every sale, purchase, expense, and payment voucher.
47. **Live Profit & Loss (P&L) Statement:** Accurate Gross Revenue, Cost of Goods Sold (COGS), Operating Expenses, and Net Profit calculations over any date range.
48. **Aging Analysis Reports:** Categorize overdue receivables and payables across 30, 60, 90, and 90+ day buckets.
49. **Daily Sales & Cash Flow Summary:** Comprehensive end-of-day revenue breakdown by cash, card, bank, and credit.

---

### Module 9: Day Closing, Cash Reconciliation & WhatsApp Z-Report
50. **Denomination Counter Calculator:** Fast cash counting calculator for all Pakistani currency notes (`5000`, `1000`, `500`, `100`, `50`, `20`, `10`, and coins).
51. **Cash Drawer Variance Detection:** Compares physical cash against system expected cash and flags shortages/surpluses.
52. **Automated WhatsApp Z-Report:** 1-click automated delivery of complete Day Close report directly to the store owner's mobile WhatsApp.
53. **Day Locking:** Locks invoices for closed business dates to eliminate employee tampering.

---

### Module 10: Multi-Terminal Local Network (LAN) Sync
54. **Master / Slave Terminal Architecture:** Run multiple billing counters in the same store with zero cloud latency.
55. **UDP Automatic Terminal Discovery:** Slave billing counters auto-discover the Master server over local Wi-Fi without entering complex IP addresses.
56. **Real-time RPC Data Dispatcher:** Stock deductions on any terminal update all other counters instantaneously.
57. **Terminal Monitor:** View active connected counters in real time.

---

### Module 11: Remote Mobile Server & Cloudflare Tunneling
58. **Built-in Mobile Web Server:** Access live dashboard on smartphones and tablets.
59. **Encrypted Zero-Config Cloudflare Tunnel:** Monitor store sales from anywhere in the world without static IP, port forwarding, or firewall configuration.
60. **QR Code Quick Connect:** Instant mobile device pairing via camera scan.

---

### Module 12: Security, User Roles & Audit Trail
61. **Fast 4-Digit PIN Authentication:** Swift cashier switching between sales.
62. **Granular Permissions Matrix:** Role presets for **Store Owner**, **Store Manager**, and **Salesperson / Cashier**.
63. **High-Security Protections:** Wholesale cost price masking, profit margin hiding, maximum discount limits, price override lock, and void invoice restrictions.
64. **Tamper-Proof Audit Trail:** Comprehensive activity log recording every login, sale, void, return, price change, and expense.

---

### Module 13: Automated Google Drive Backup & System Health
65. **Scheduled Google Drive Cloud Backup:** Automated daily synchronization of encrypted `.db` backups to owner's Google Drive.
66. **1-Click Local Database Backup & Restore:** Easy database backup and instant restore functionality.
67. **Data Reindex & SQLite VACUUM Optimization:** 1-click database cleanup for lifelong lightning speed.

---

### Module 14: Voice AI POS Assistant (Whisper Speech Engine)
68. **High-Speed Whisper AI STT:** Speech-to-text supporting Urdu, Roman Urdu, and English.
69. **Natural Language Invoicing:** Convert spoken commands into cart items, custom prices, discounts, and customer names.
70. **Modular Configuration:** Can be enabled or disabled with 1 click in System Setup.

---

## Commercial Proposal & Pricing Table

### Investment Summary (Rs. 60,000 PKR Package)

| # | Package Component / Deliverable | Included Value | Status |
| :---: | :--- | :---: | :---: |
| **1** | **Al-Deewan POS System Full Enterprise License**<br>• Lifetime Desktop License for Windows (10/11 64-bit) & macOS<br>• Unrestricted product catalog, unlimited invoices, unlimited customers | Rs. 40,000 | **INCLUDED** |
| **2** | **Multi-Terminal LAN Network Node System**<br>• Master Server + Multi-Terminal Counter Sync Engine<br>• Connect multiple billing counters across the shop over Wi-Fi | Rs. 10,000 | **INCLUDED** |
| **3** | **Hardware & Peripherals Setup & Integration**<br>• 80mm/58mm Thermal Receipt Printer integration<br>• USB / Wireless Barcode Scanner setup<br>• Thermal Barcode Label Printer calibration (50x25mm / 40x28mm) | Rs. 5,000 | **INCLUDED** |
| **4** | **Data Migration, Catalog Setup & Staff Training**<br>• Migration of previous software catalog, stock, and customers via CSV/SQL<br>• Complete onboarding & staff training session | Rs. 5,000 | **INCLUDED** |
| **5** | **Cloud Backup & Remote Monitoring Suite**<br>• Google Drive automated cloud backup integration<br>• Cloudflare Tunnel & Mobile Remote Access setup<br>• WhatsApp Automated Day-Close Z-Report configuration | Rs. 10,000 | **FREE BONUS** |
| **6** | **3 Months Priority Technical Support & Maintenance**<br>• Direct phone/WhatsApp support for software operations and updates | Rs. 8,000 | **FREE BONUS** |
| **TOTAL COMMERCIAL VALUE:** | | **~~Rs. 78,000~~** | |
| **SPECIAL PROMOTIONAL PACKAGE PRICE:** | | **Rs. 60,000 PKR** | **FINAL** |

---

## Payment Terms & Milestone Schedule

1. **Advance Deposit (50% — Rs. 30,000):** Upon agreement and project initiation.
2. **Final Settlement (50% — Rs. 30,000):** Upon software deployment, hardware printer/scanner setup, and staff training.

---

## Hardware Compatibility Guarantee

The software is guaranteed compatible with standard retail hardware:
- **Thermal Receipt Printers:** Xprinter, POS-58, POS-80, Epson TM-T88, Sunmi, Rongta, Black Copper, Star Micronics (USB, Network, Bluetooth).
- **Barcode Label Printers:** Xprinter 350B, 365B, 420B, TSC TE244, Zebra GK420t, Gprinter.
- **Barcode Scanners:** 1D / 2D QR Laser and Image scanners (Datalogic, Honeywell, Symbol/Zebra, Netum, generic USB).
- **Electronic Cash Drawers:** Standard RJ11 / RJ12 12V/24V cash drawers triggered via receipt printer.

---

## Acceptance & Authorization

**For Client / Store:**  
Name: ____________________________________  
Signature: _______________________________  
Date: ____________________________________  

**For Al-Deewan POS Solutions:**  
Authorized Signature: ______________________  
Date: ____________________________________  
