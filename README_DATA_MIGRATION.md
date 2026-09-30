# Nuqta AI POS — Comprehensive Data Migration Guide

This guide walks you through migrating all business data (Products, Stock Quantities, Costs, Retail Prices, Customers, Suppliers, and Opening Balances) from any previous POS or inventory management software into **Nuqta AI POS**.

---

## Migration Overview

Nuqta AI POS supports both **Self-Service CSV/Excel Bulk Import** and **Automated Direct Database Migration**.

```
[Previous POS Software] 
       │
       ├─ Export to CSV / Excel / SQL Dump
       │
       ▼
[Data Preparation & Validation]
       │
       ├─ Option A: Built-in Catalog CSV Import (Stock Page)
       ├─ Option B: Full Database ETL Script (All Ledgers & History)
       │
       ▼
[Nuqta AI POS Production Database]
```

---

## Step 1: Export Data From Previous Software

Open your previous POS software or database management tool and export your core business records.

### What Data to Export:
1. **Product Catalog & Stock**:
   - Product SKU / Part Number
   - Product Name / Description
   - Barcode (EAN-13, Code-128, UPC, or custom)
   - Brand / Fabric Mill
   - Category / Department
   - Size / Variant (e.g., Unstitched, Small, Medium, Large, XL)
   - Wholesale Purchase Cost (Rs.)
   - Retail Selling Price (Rs.)
   - Current Physical Stock Quantity on Hand
   - Reorder Alert Level (default: 5)
2. **Customers & Receivables (AR)**:
   - Full Name
   - Mobile Phone / WhatsApp Number
   - City / Address
   - Current Outstanding Balance (Owed to store)
   - Maximum Credit Limit
3. **Suppliers & Payables (AP)**:
   - Mill / Supplier Name
   - Contact Person & Phone Number
   - Address / City
   - Outstanding Balance Owed to Vendor
4. **Accounts & Historical Transactions** *(if performing full database ETL)*:
   - Past sales receipts and purchase invoices

### Supported Export File Formats:
- `.csv` (Comma Separated Values — UTF-8)
- `.xlsx` / `.xls` (Microsoft Excel)
- `.json` / `.sql` / `.db` (SQLite or SQL database dump)

---

## Step 2: Prepare & Validate the Data

Ensure your CSV or Excel files have clean headers matching the standard Nuqta format.

### Standard Product Import Template (`products.csv`)

| Part Number | Name | Barcode | Brand | Category | Size | Cost | Retail | Quantity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AD-101** | Lawn 3pc Stitched Suit | 890112233001 | Alkaram | Summer Collection | Large | 2500 | 4500 | 25 |
| **AD-102** | Cotton Embroidered Kurti | 890112233002 | Sapphire | Pret Kurti | Medium | 1800 | 2950 | 14 |
| **AD-103** | Chiffon Dupatta 3pc | 890112233003 | Sana Safinaz | Festive Luxury | Unstitched | 4200 | 7800 | 8 |

#### Data Formatting Rules:
- **Part Number (SKU)**: Required, unique alphanumeric code (e.g., `AD-101`, `K-504`).
- **Name**: Required product name (e.g., `Lawn 3pc Stitched`).
- **Barcode**: Optional. If blank, the system auto-generates internal numeric barcodes.
- **Cost Price**: Numbers only (no currency symbols or commas).
- **Retail Price**: Numbers only (must be $\ge$ 0).
- **Quantity**: Integer or decimal representing physical stock on hand.
- **Duplicates**: Existing Part Numbers will be updated with new quantities and prices.

---

## Step 3: Import Into Nuqta AI POS

### Method A: Built-in CSV Import (Fastest & Simplest)

1. Launch **Nuqta AI POS**.
2. Click on **📦 Stock / Inventory** in the main navigation bar.
3. In the top-right header, click the **`Import CSV`** button.
4. Either:
   - Click **`Upload CSV File`** and select your prepared `.csv` file.
   - OR copy and paste your comma-separated table directly into the text box.
5. The system will parse and preview your records with SKU, Name, Size, Cost, Retail, and Quantity.
6. Click **`Import Items`**. All items, brands, and categories will be created instantly.

### Method B: Full Database Migration (Customers, Suppliers, History & Accounts)

If you need a 100% turnkey migration including old invoice records and customer debt ledgers:
1. Nuqta stores its SQLite database at:
   - **Windows**: `%APPDATA%\Nuqta AI POS\aldeewan-pos.db`
   - **macOS**: `~/Library/Application Support/Nuqta AI POS/aldeewan-pos.db`
2. Run our automated migration script against your exported SQL/CSV dump to populate `customers`, `suppliers`, `invoices`, and `journal_entries` with full relational integrity.

---

## Step 4: Verify Imported Data

After completing the import, perform the following verification checks:

1. **Verify Product Counts**:
   - Go to **Stock → Items List**. Confirm the total item count matches your previous system.
2. **Verify Inventory Valuation**:
   - Go to **Stock → Quantity Report**. Check total units on hand and total inventory cost/retail valuation.
3. **Verify Customers & Outstanding Balances**:
   - Go to **Customers**. Verify customer names, phone numbers, and outstanding balance pills.
4. **Verify Suppliers**:
   - Go to **Stock → Supplier Details**. Confirm supplier payables and linked products.
5. **Test POS Cart & Barcode Scanner**:
   - Open **Point of Sale (POS)**. Scan or search for an imported item (e.g., `AD-101`) to verify price and stock deduction.

---

## Step 5: Post-Migration Backup

Once you have verified all data:
1. Go to **Maintenance → Backup & Restore**.
2. Click **`Create Instant Backup Now`**.
3. Save the timestamped `.db` backup file to a secure location (USB drive or cloud storage).
4. You can also configure **Automated Google Drive Cloud Backup** in the Maintenance tab for continuous protection.

---

### Need Assistance?
For custom data extraction from proprietary POS software (e.g., Microsoft Access `.mdb`, legacy SQL Server, or specialized databases), contact Nuqta Support or run the included ETL tools.
