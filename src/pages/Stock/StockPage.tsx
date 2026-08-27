import React, { useEffect, useState, useRef } from 'react'
import {
  Search, Plus, Edit2, Package, Download, Filter,
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, X, CheckCircle,
  Upload, FileSpreadsheet, Truck, Tag, BarChart3, PieChart, Sparkles,
  Zap, Award, Flame, ShoppingBag, ArrowUpRight, Activity,
  Building2, Phone, MapPin, CreditCard, Layers, ExternalLink,
  FileText, ChevronRight, Trash2, Coins, Eye, History, User,
  DollarSign, Receipt, Calendar, Printer, ArrowRight
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import type { Item, Brand, Category, Supplier, Purchase, PartyStatementReport, QuantityReportRow, BulkImportItemInput } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// ============================================================
// QUICK ADD BRAND MODAL (REUSABLE)
// ============================================================
export function QuickAddBrandModal({
  onSaved,
  onClose
}: {
  onSaved: (brand: Brand) => void
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Brand name is required')
      return
    }
    setSaving(true)
    const res = await window.api.createBrand(currentUser!.id, name.trim())
    setSaving(false)
    if (res.success && res.data) {
      toast.success(`Brand "${res.data.name}" added successfully!`)
      onSaved(res.data)
      onClose()
    } else {
      toast.error(res.error || 'Failed to add brand')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Tag size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Add New Brand</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Brand Name *</label>
              <input
                className="form-input form-input-lg"
                placeholder="e.g. Sana Safinaz, Maria.B, Asim Jofa, J., Nishat"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              <CheckCircle size={15} /> {saving ? 'Saving...' : 'Save Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// QUICK ADD / EDIT SUPPLIER MODAL (REUSABLE)
// ============================================================
export function QuickAddSupplierModal({
  supplierToEdit,
  onSaved,
  onClose
}: {
  supplierToEdit?: Supplier | null
  onSaved: (supplier: Supplier) => void
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [name, setName] = useState(supplierToEdit?.name || '')
  const [contact, setContact] = useState(supplierToEdit?.contact || '')
  const [address, setAddress] = useState(supplierToEdit?.address || '')
  const [notes, setNotes] = useState(supplierToEdit?.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setSaving(true)
    let res
    if (supplierToEdit?.id) {
      res = await window.api.updateSupplier(currentUser!.id, supplierToEdit.id, {
        name: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        notes: notes.trim()
      })
    } else {
      res = await window.api.createSupplier(currentUser!.id, {
        name: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        notes: notes.trim()
      })
    }
    setSaving(false)
    if (res.success && res.data) {
      toast.success(`Supplier "${res.data.name}" ${supplierToEdit ? 'updated' : 'added'} successfully!`)
      onSaved(res.data)
      onClose()
    } else {
      toast.error(res.error || `Failed to ${supplierToEdit ? 'update' : 'add'} supplier`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Truck size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">{supplierToEdit ? 'Edit Supplier / Mill' : 'Add New Supplier / Mill'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Supplier / Mill Name *</label>
              <input
                className="form-input form-input-lg"
                placeholder="e.g. Alkaram Textiles, Sapphire Mills, Gul Ahmed"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Contact / Phone Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. 0300-1234567"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">City / Address</label>
                <input
                  className="form-input"
                  placeholder="e.g. Faisalabad / Karachi"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Remarks</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="e.g. Fabric supplier, wholesale rates, 15-day credit"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              <CheckCircle size={15} /> {saving ? 'Saving...' : (supplierToEdit ? 'Save Changes' : 'Save Supplier')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// STOCK PAGE (tabs: Items List | Quantity Report | Transaction Inquiry | Suppliers | Analytics)
// ============================================================
export default function StockPage() {
  const { currentUser, canAddEditStock, canViewCostPrice, canViewProfit } = useAuth()
  const [tab, setTab] = useState<'items' | 'qtyreport' | 'transactions' | 'suppliers' | 'analytics'>('items')
  const [showImportModal, setShowImportModal] = useState(false)

  const handleExportCSV = async () => {
    const items = await window.api.getAllItems()
    if (items.length === 0) {
      toast.error('No items to export')
      return
    }

    const headers = ['Part Number', 'Name', 'Barcode', 'Supplier', 'Brand', 'Category', 'Size Variant', 'Cost Price', 'Retail Price', 'Quantity On Hand', 'Reorder Level']
    const rows = items.map(i => [
      `"${i.part_number}"`,
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.barcode || ''}"`,
      `"${i.supplier_name || ''}"`,
      `"${i.brand_name || ''}"`,
      `"${i.category_name || ''}"`,
      `"${i.size_variant || ''}"`,
      i.cost_price,
      i.retail_price,
      i.quantity_on_hand,
      i.reorder_level
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `aldeewan_inventory_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Inventory exported to CSV!')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h3 className="page-header-title">Stock / Inventory</h3>
          <div className="page-header-subtitle">Manage product catalog, suppliers & mills, bulk import & inventory levels</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={14} /> Export CSV
          </button>
          {canAddEditStock && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                <Upload size={14} /> Import CSV
              </button>
              <button className="btn btn-primary" onClick={() => document.dispatchEvent(new CustomEvent('stock:add-item'))}>
                <Plus size={15} /> Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 24px',
        flexShrink: 0
      }}>
        {[
          { key: 'items', label: 'Items List', icon: Package },
          { key: 'qtyreport', label: 'Quantity Report', icon: FileSpreadsheet },
          { key: 'transactions', label: 'Transaction Inquiry', icon: RefreshCw },
          { key: 'suppliers', label: 'Supplier Details', icon: Truck },
          { key: 'analytics', label: 'Stock & Item Performance Analytics', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              padding: '12px 20px',
              background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'all 0.15s',
              marginBottom: -1,
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'items'        && <ItemsList canEdit={canAddEditStock} canViewCost={canViewCostPrice} />}
        {tab === 'qtyreport'   && <QuantityReport canViewCost={canViewCostPrice} />}
        {tab === 'transactions' && <TransactionInquiry />}
        {tab === 'suppliers'    && <SupplierDetailsView canEdit={canAddEditStock} canViewCost={canViewCostPrice} />}
        {tab === 'analytics'    && <ItemPerformanceAnalytics canViewCost={canViewCostPrice} canViewProfit={canViewProfit} />}
      </div>

      {showImportModal && (
        <BulkImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false)
            toast.success('Items successfully imported!')
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// ITEMS LIST
// ============================================================
function ItemsList({ canEdit, canViewCost }: { canEdit: boolean; canViewCost: boolean }) {
  const { currentUser } = useAuth()
  const [items, setItems]                 = useState<Item[]>([])
  const [filtered, setFiltered]           = useState<Item[]>([])
  const [query, setQuery]                 = useState('')
  const [brands, setBrands]               = useState<Brand[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [suppliers, setSuppliers]         = useState<Supplier[]>([])
  const [brandFilter, setBrandFilter]     = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [loading, setLoading]             = useState(true)
  const [showAdd, setShowAdd]             = useState(false)
  const [editItem, setEditItem]           = useState<Item | null>(null)

  const loadItems = async () => {
    setLoading(true)
    const [its, bs, cs, sups] = await Promise.all([
      window.api.getAllItems(),
      window.api.getAllBrands(),
      window.api.getAllCategories(),
      window.api.getAllSuppliers()
    ])
    setItems(its); setBrands(bs); setCategories(cs); setSuppliers(sups)
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  // Listen for add-item event from header
  useEffect(() => {
    const handler = () => setShowAdd(true)
    document.addEventListener('stock:add-item', handler)
    return () => document.removeEventListener('stock:add-item', handler)
  }, [])

  useEffect(() => {
    let result = items
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.part_number.toLowerCase().includes(q) ||
        (i.brand_name || '').toLowerCase().includes(q) ||
        (i.supplier_name || '').toLowerCase().includes(q)
      )
    }
    if (brandFilter) {
      result = result.filter(i => i.brand_id === brandFilter)
    }
    if (supplierFilter) {
      result = result.filter(i => i.supplier_id === supplierFilter)
    }
    setFiltered(result)
  }, [items, query, brandFilter, supplierFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filters */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search name, part #, supplier..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ maxWidth: 160 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 180 }} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
          <option value="">All Suppliers / Mills</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={loadItems} title="Refresh Inventory"><RefreshCw size={14} /></button>
        <div style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
          {filtered.length} / {items.length} items
        </div>
      </div>

      {/* Table */}
      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Part #</th>
                <th>Item Name</th>
                <th>Supplier / Mill</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>On Hand</th>
                {canViewCost && <th style={{ textAlign: 'right' }}>🔒 Cost</th>}
                <th style={{ textAlign: 'right' }}>Retail</th>
                <th>Status</th>
                {canEdit && <th style={{ width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    {query ? `No items found for "${query}"` : 'No items in inventory'}
                  </td>
                </tr>
              ) : filtered.map(item => (
                <tr key={item.id} style={{ cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && setEditItem(item)}>
                  <td><span className="font-mono text-xs">{item.part_number}</span></td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>
                    {item.supplier_name ? (
                      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
                        <Truck size={11} /> {item.supplier_name}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td>{item.brand_name || '—'}</td>
                  <td>{item.category_name || '—'}</td>
                  <td>{item.size_variant || '—'}</td>
                  <td className="col-number" style={{
                    fontWeight: 700,
                    color: item.quantity_on_hand <= 0 ? 'var(--color-danger)' :
                      item.quantity_on_hand <= item.reorder_level ? 'var(--color-warning)' : 'var(--color-success)'
                  }}>
                    {item.quantity_on_hand}
                  </td>
                  {canViewCost && <td className="col-currency text-muted">{fmt(item.cost_price)}</td>}
                  <td className="col-currency" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{fmt(item.retail_price)}</td>
                  <td>
                    {item.quantity_on_hand <= 0
                      ? <span className="badge badge-danger">Out of Stock</span>
                      : item.quantity_on_hand <= item.reorder_level
                        ? <span className="badge badge-warning">Low Stock</span>
                        : <span className="badge badge-success">In Stock</span>
                    }
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={e => { e.stopPropagation(); setEditItem(item) }}
                      ><Edit2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editItem) && (
        <AddEditItemModal
          item={editItem}
          brands={brands}
          categories={categories}
          suppliers={suppliers}
          onBrandCreated={(newBrand) => {
            setBrands(prev => [newBrand, ...prev.filter(b => b.id !== newBrand.id)])
          }}
          onSupplierCreated={(newSup) => {
            setSuppliers(prev => [newSup, ...prev.filter(s => s.id !== newSup.id)])
          }}
          onSave={async (data) => {
            let result
            if (editItem) {
              result = await window.api.updateItem(currentUser!.id, editItem.id, data)
            } else {
              result = await window.api.createItem(currentUser!.id, data)
            }
            if (result.success) {
              toast.success(editItem ? 'Item updated' : 'Item added')
              setShowAdd(false); setEditItem(null)
              loadItems()
            } else {
              toast.error(result.error || 'Failed')
            }
          }}
          onClose={() => { setShowAdd(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}

// ============================================================
// ADD/EDIT ITEM MODAL (WITH DIRECT SUPPLIER & BRAND QUICK ADD)
// ============================================================
function AddEditItemModal({
  item,
  brands,
  categories,
  suppliers,
  onBrandCreated,
  onSupplierCreated,
  onSave,
  onClose
}: {
  item: Item | null
  brands: Brand[]
  categories: Category[]
  suppliers: Supplier[]
  onBrandCreated?: (brand: Brand) => void
  onSupplierCreated: (sup: Supplier) => void
  onSave: (data: object) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    part_number: item?.part_number || '',
    name:        item?.name || '',
    brand_id:    item?.brand_id || '',
    category_id: item?.category_id || '',
    supplier_id: item?.supplier_id || '',
    size_variant: item?.size_variant || '',
    cost_price:  item?.cost_price?.toString() || '',
    retail_price: item?.retail_price?.toString() || '',
    quantity_on_hand: item?.quantity_on_hand?.toString() || '0',
    reorder_level: item?.reorder_level?.toString() || '5',
    barcode:     item?.barcode || '',
  })
  const [createStockInvoice, setCreateStockInvoice] = useState(true)
  const [invoiceRef, setInvoiceRef]                 = useState('')
  const [paymentStatus, setPaymentStatus]           = useState<'paid' | 'partial' | 'unpaid'>('unpaid')
  const [paymentSource, setPaymentSource]           = useState<'drawer' | 'outside'>('drawer')
  const [amountPaid, setAmountPaid]                 = useState('')
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [showAddBrandModal, setShowAddBrandModal]       = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))
  const isEdit = !!item

  const openingQty = parseFloat(form.quantity_on_hand) || 0
  const unitCost = parseFloat(form.cost_price) || 0
  const totalOpeningBill = openingQty * unitCost

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.part_number || !form.name || !form.cost_price || !form.retail_price) {
      toast.error('Please fill all required fields')
      return
    }

    const payload: any = {
      ...form,
      cost_price: parseFloat(form.cost_price),
      retail_price: parseFloat(form.retail_price),
      quantity_on_hand: openingQty,
      reorder_level: parseFloat(form.reorder_level) || 0,
    }

    if (!isEdit && openingQty > 0 && createStockInvoice && form.supplier_id) {
      payload.create_stock_invoice = true
      payload.invoice_ref = invoiceRef || undefined
      payload.payment_status = paymentStatus
      payload.payment_source = paymentSource
      payload.amount_paid = paymentStatus === 'unpaid'
        ? 0
        : (paymentStatus === 'paid' ? totalOpeningBill : (parseFloat(amountPaid) || 0))
    }

    onSave(payload)
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <Package size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title">{isEdit ? 'Edit Item' : 'Add New Item to Catalog'}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Part Number / SKU *</label>
                  <input className="form-input" value={form.part_number} onChange={e => set('part_number', e.target.value)} required disabled={isEdit} />
                </div>
                <div className="form-group">
                  <label className="form-label">Barcode (optional)</label>
                  <input className="form-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Scan or type barcode" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Item Name *</label>
                  <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Alkaram 2-Piece Suit" />
                </div>

                {/* SUPPLIER FIELD WITH INSTANT ADD BUTTON */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>Supplier / Mill</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-primary"
                      style={{ padding: '0 4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                      onClick={() => setShowAddSupplierModal(true)}
                    >
                      <Plus size={11} /> + New Supplier
                    </button>
                  </div>
                  <select className="form-select" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                    <option value="">Select supplier / mill...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* BRAND FIELD WITH INSTANT ADD BUTTON */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>Brand</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-primary"
                      style={{ padding: '0 4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                      onClick={() => setShowAddBrandModal(true)}
                    >
                      <Plus size={11} /> + New Brand
                    </button>
                  </div>
                  <select className="form-select" value={form.brand_id} onChange={e => set('brand_id', e.target.value)}>
                    <option value="">Select brand...</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Size / Variant</label>
                  <input className="form-input" value={form.size_variant} onChange={e => set('size_variant', e.target.value)} placeholder="e.g. M, L, XL" />
                </div>

                <div className="form-group">
                  <label className="form-label">🔒 Cost Price (Rs.) *</label>
                  <input className="form-input" type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} required min={0} />
                </div>
                <div className="form-group">
                  <label className="form-label">Retail / Selling Price (Rs.) *</label>
                  <input className="form-input" type="number" value={form.retail_price} onChange={e => set('retail_price', e.target.value)} required min={0} />
                </div>

                {!isEdit && (
                  <div className="form-group">
                    <label className="form-label">Opening Quantity Received</label>
                    <input className="form-input" type="number" value={form.quantity_on_hand} onChange={e => set('quantity_on_hand', e.target.value)} min={0} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Reorder Level (Low stock alert at)</label>
                  <input className="form-input" type="number" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} min={0} />
                </div>
              </div>

              {/* STOCK INVOICE GENERATION SECTION */}
              {!isEdit && openingQty > 0 && form.supplier_id && (
                <div style={{
                  marginTop: 18,
                  padding: '14px 16px',
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={createStockInvoice}
                        onChange={e => setCreateStockInvoice(e.target.checked)}
                      />
                      <span>🧾 Generate Supplier Stock Invoice & Bill ({fmt(totalOpeningBill)})</span>
                    </label>
                  </div>

                  {createStockInvoice && (
                    <div className="grid-3" style={{ gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Supplier Bill #</label>
                        <input
                          className="form-input form-input-sm"
                          value={invoiceRef}
                          onChange={e => setInvoiceRef(e.target.value)}
                          placeholder="e.g. INV-2024-001"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Status</label>
                        <select
                          className="form-select form-select-sm"
                          value={paymentStatus}
                          onChange={e => setPaymentStatus(e.target.value as typeof paymentStatus)}
                        >
                          <option value="paid">🟢 Fully Paid</option>
                          <option value="partial">🟡 Partial Payment</option>
                          <option value="unpaid">🔴 Pending / Unpaid</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Source</label>
                        <select
                          className="form-select form-select-sm"
                          disabled={paymentStatus === 'unpaid'}
                          value={paymentSource}
                          onChange={e => setPaymentSource(e.target.value as typeof paymentSource)}
                        >
                          <option value="drawer">🏪 Shop Drawer Cash</option>
                          <option value="outside">💳 Outside / Bank</option>
                        </select>
                      </div>

                      {paymentStatus === 'partial' && (
                        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Amount Paid Now (Rs.)</label>
                          <input
                            type="number"
                            className="form-input form-input-sm"
                            value={amountPaid}
                            onChange={e => setAmountPaid(e.target.value)}
                            placeholder={`Total: ${totalOpeningBill}`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {form.cost_price && form.retail_price && (
                <div style={{
                  marginTop: 16, padding: '10px 14px',
                  background: parseFloat(form.retail_price) >= parseFloat(form.cost_price) ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  borderRadius: 8, fontSize: '0.8125rem',
                  color: parseFloat(form.retail_price) >= parseFloat(form.cost_price) ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  🔒 Margin: Rs. {(parseFloat(form.retail_price) - parseFloat(form.cost_price)).toLocaleString()} (
                  {parseFloat(form.cost_price) > 0
                    ? (((parseFloat(form.retail_price) - parseFloat(form.cost_price)) / parseFloat(form.cost_price)) * 100).toFixed(1)
                    : '0'}%)
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                <CheckCircle size={15} /> {isEdit ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onSaved={(newSup) => {
            onSupplierCreated(newSup)
            set('supplier_id', newSup.id)
          }}
          onClose={() => setShowAddSupplierModal(false)}
        />
      )}

      {showAddBrandModal && (
        <QuickAddBrandModal
          onSaved={(newBrand) => {
            onBrandCreated?.(newBrand)
            set('brand_id', newBrand.id)
          }}
          onClose={() => setShowAddBrandModal(false)}
        />
      )}
    </>
  )
}

// ============================================================
// QUANTITY REPORT (paginated, with grand totals)
// ============================================================
function QuantityReport({ canViewCost }: { canViewCost: boolean }) {
  const [rows, setRows]       = useState<QuantityReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const PER_PAGE = 20

  useEffect(() => {
    window.api.getQuantityReport().then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const totalPages = Math.ceil(rows.length / PER_PAGE)
  const pageRows   = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const totalQty   = rows.reduce((s, r) => s + r.quantity_on_hand, 0)
  const totalValue = rows.reduce((s, r) => s + r.cost_value, 0)
  const totalItems = rows.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Summary bar */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total SKUs</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{totalItems.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Qty on Hand</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>{totalQty.toLocaleString()} pcs</div>
        </div>
        {canViewCost && (
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🔒 Total Inventory Value</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>{fmt(totalValue)}</div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} /> Export</button>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-wrap" style={{ flex: 1, overflow: 'auto', borderRadius: 0, border: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Part Number</th>
                <th>Item Name</th>
                <th>Supplier / Mill</th>
                <th>Brand</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>Qty on Hand</th>
                {canViewCost && <th style={{ textAlign: 'right' }}>🔒 Cost Price</th>}
                {canViewCost && <th style={{ textAlign: 'right' }}>🔒 Cost Value</th>}
                <th style={{ textAlign: 'right' }}>Retail Price</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={row.part_number}>
                  <td className="text-muted text-xs">{(page - 1) * PER_PAGE + i + 1}</td>
                  <td><span className="font-mono text-xs">{row.part_number}</span></td>
                  <td style={{ fontWeight: 500 }}>{row.name}</td>
                  <td>
                    {row.supplier_name ? (
                      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
                        <Truck size={11} /> {row.supplier_name}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td>{row.brand_name || '—'}</td>
                  <td>{row.size_variant || '—'}</td>
                  <td className="col-number" style={{ fontWeight: 700, color: row.quantity_on_hand <= 0 ? 'var(--color-danger)' : 'inherit' }}>
                    {row.quantity_on_hand.toLocaleString()}
                  </td>
                  {canViewCost && <td className="col-currency text-muted">{fmt(row.cost_price)}</td>}
                  {canViewCost && <td className="col-currency" style={{ fontWeight: 700 }}>{fmt(row.cost_value)}</td>}
                  <td className="col-currency" style={{ color: 'var(--color-primary)' }}>{fmt(row.retail_price)}</td>
                </tr>
              ))}
            </tbody>
            {/* Grand totals on last page */}
            {page === totalPages && (
              <tfoot>
                <tr style={{ background: 'var(--color-primary-10)', fontWeight: 800 }}>
                  <td colSpan={6} style={{ padding: '12px 16px', color: 'var(--color-primary)' }}>
                    GRAND TOTAL — {totalItems} items
                  </td>
                  <td className="col-number" style={{ color: 'var(--color-success)', fontSize: '1rem' }}>
                    {totalQty.toLocaleString()} pcs
                  </td>
                  {canViewCost && <td className="col-currency text-muted">—</td>}
                  {canViewCost && (
                    <td className="col-currency" style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>
                      {fmt(totalValue)}
                    </td>
                  )}
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '10px 20px',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
        }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Last page shows grand totals
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TRANSACTION INQUIRY
// ============================================================
function TransactionInquiry() {
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { window.api.getAllItems().then(setItems) }, [])

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(query.toLowerCase()) ||
    i.part_number.includes(query)
  )

  const selectItem = async (item: Item) => {
    setSelectedItem(item)
    setLoading(true)
    const txs = await window.api.getTransactionHistory(item.id)
    setTransactions(txs)
    setLoading(false)
  }

  const typeLabel = (type: string) => ({
    purchase: '📦 Purchase In',
    sale: '🛒 Sale Out',
    return_in: '↩ Return In',
    adjustment: '⚙ Adjustment',
    opening: '🔓 Opening Stock'
  }[type] || type)

  const typeColor = (type: string) => ({
    purchase: 'var(--color-success)',
    sale: 'var(--color-danger)',
    return_in: 'var(--color-info)',
    adjustment: 'var(--color-warning)',
    opening: 'var(--color-text-muted)'
  }[type] || 'inherit')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Item list */}
      <div style={{ width: 280, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12 }}>
          <input
            className="form-input"
            placeholder="Search item..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map(item => (
            <div
              key={item.id}
              onClick={() => selectItem(item)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-surface-2)',
                background: selectedItem?.id === item.id ? 'var(--color-primary-10)' : 'transparent',
                borderLeft: selectedItem?.id === item.id ? '3px solid var(--color-primary)' : '3px solid transparent'
              }}
            >
              <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                {item.part_number} · Qty: {item.quantity_on_hand}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!selectedItem ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <Package size={36} style={{ opacity: 0.3 }} />
            <p>Select an item to view its transaction history</p>
          </div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <h4>{selectedItem.name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                {selectedItem.part_number} · Current Qty: <strong>{selectedItem.quantity_on_hand}</strong>
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Reference</th>
                  <th>Staff</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No transactions found</td></tr>
                ) : transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td><span style={{ color: typeColor(tx.type), fontWeight: 500, fontSize: '0.75rem' }}>{typeLabel(tx.type)}</span></td>
                    <td className="col-number" style={{ color: tx.qty_change > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                      {tx.qty_change > 0 ? '+' : ''}{tx.qty_change}
                    </td>
                    <td className="col-number font-bold">{tx.qty_after}</td>
                    <td><span className="font-mono text-xs">{tx.reference || '—'}</span></td>
                    <td>{tx.user_name || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{tx.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ITEM SALES & STOCK PERFORMANCE ANALYTICS TAB
// ============================================================
function ItemPerformanceAnalytics({ canViewCost, canViewProfit }: { canViewCost: boolean; canViewProfit: boolean }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7d' | 'month' | '30d' | 'custom'>('all')
  const [fromDate, setFromDate]     = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [toDate, setToDate]         = useState(todayStr)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [velocityFilter, setVelocityFilter] = useState<'all' | 'fast' | 'moderate' | 'slow' | 'stagnant' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'units_sold' | 'revenue' | 'profit' | 'margin' | 'stock'>('units_sold')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const [report, setReport] = useState<any | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    let start: string | undefined = undefined
    let end: string | undefined = undefined

    if (datePreset === 'today') {
      start = todayStr
      end = todayStr
    } else if (datePreset === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    } else if (datePreset === 'month') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      end = todayStr
    } else if (datePreset === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      start = d.toISOString().slice(0, 10)
      end = todayStr
    } else if (datePreset === 'custom') {
      start = fromDate
      end = toDate
    }

    try {
      const [res, cats, brs] = await Promise.all([
        window.api.getItemSalesPerformance(start, end),
        window.api.getAllCategories(),
        window.api.getAllBrands()
      ])

      if (res.success && res.data) {
        setReport(res.data)
      } else {
        toast.error(res.error || 'Failed to load stock analytics')
      }
      if (Array.isArray(cats)) setCategories(cats)
      if (Array.isArray(brs)) setBrands(brs)
    } catch (err) {
      console.error(err)
      toast.error('Error fetching stock performance analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [datePreset, fromDate, toDate])

  const summary = report?.summary || {
    total_units_sold: 0,
    total_revenue: 0,
    total_profit: 0,
    total_inventory_items: 0,
    total_inventory_units: 0,
    total_inventory_cost_value: 0,
    total_inventory_retail_value: 0,
    fast_movers_count: 0,
    moderate_movers_count: 0,
    slow_movers_count: 0,
    stagnant_count: 0,
    top_10_units: [],
    top_10_revenue: [],
    top_10_profit: [],
    category_performance: [],
    brand_performance: []
  }

  // Filter items in memory for search, category, brand, and velocity
  const filteredItems: any[] = (report?.items || []).filter((item: any) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery = !q ||
      item.name.toLowerCase().includes(q) ||
      item.part_number.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.includes(q))
    const matchesCat = selectedCat === 'all' || item.category_name === selectedCat
    const matchesBrand = selectedBrand === 'all' || item.brand_name === selectedBrand
    const matchesVelocity = velocityFilter === 'all' || item.velocity === velocityFilter
    return matchesQuery && matchesCat && matchesBrand && matchesVelocity
  })

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    let diff = 0
    if (sortBy === 'units_sold') diff = a.units_sold - b.units_sold
    else if (sortBy === 'revenue') diff = a.revenue_generated - b.revenue_generated
    else if (sortBy === 'profit') diff = a.profit_generated - b.profit_generated
    else if (sortBy === 'margin') diff = a.profit_margin_pct - b.profit_margin_pct
    else if (sortBy === 'stock') diff = a.quantity_on_hand - b.quantity_on_hand
    return sortOrder === 'desc' ? -diff : diff
  })

  const exportCSV = () => {
    if (sortedItems.length === 0) {
      toast.error('No item analytics to export')
      return
    }

    const headers = ['Rank', 'SKU / Code', 'Item Name', 'Category', 'Brand', 'Units Sold', 'Current Stock', 'Cost Price', 'Retail Price', 'Revenue Generated', 'Profit Generated', 'Profit Margin %', 'Turnover Velocity']
    const rows = sortedItems.map((it, idx) => [
      idx + 1,
      `"${it.part_number}"`,
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.category_name}"`,
      `"${it.brand_name}"`,
      it.units_sold,
      it.quantity_on_hand,
      canViewCost ? it.cost_price : '—',
      it.retail_price,
      it.revenue_generated,
      canViewProfit ? it.profit_generated : '—',
      canViewProfit ? it.profit_margin_pct.toFixed(1) + '%' : '—',
      it.velocity
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `AlDeewan_Item_Sales_Performance_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Stock performance report exported to CSV')
  }

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B', '#F97316']

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
          fontSize: '0.8125rem',
          minWidth: 200
        }}>
          <div style={{ fontWeight: 800, color: '#F3F4F6', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
            {label}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, margin: '4px 0' }}>
              <span style={{ color: entry.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                {entry.name}:
              </span>
              <span style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                {entry.dataKey === 'revenue' || entry.dataKey === 'profit' ? fmt(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const topSeller = summary.top_10_units[0]
  const topRevenue = summary.top_10_revenue[0]
  const topProfit = summary.top_10_profit[0]

  // Clean data for top 10 units chart
  const topUnitsChartData = summary.top_10_units.map((it: any) => ({
    name: it.name.length > 20 ? it.name.slice(0, 18) + '…' : it.name,
    fullName: it.name,
    sku: it.part_number,
    units: it.units_sold,
    revenue: it.revenue_generated
  }))

  // Clean data for top 10 revenue chart
  const topRevenueChartData = summary.top_10_revenue.slice(0, 8).map((it: any) => ({
    name: it.name.length > 16 ? it.name.slice(0, 14) + '…' : it.name,
    fullName: it.name,
    revenue: it.revenue_generated,
    profit: it.profit_generated
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Filter & Control Bar */}
      <div style={{
        padding: '12px 24px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        {/* Date Presets */}
        <div className="btn-group">
          {(['all', 'today', '7d', 'month', '30d', 'custom'] as const).map(p => (
            <button
              key={p}
              className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDatePreset(p)}
            >
              {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === 'month' ? 'This Month' : p === '30d' ? '30 Days' : 'Custom'}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>to</span>
            <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}

        {/* Category Dropdown */}
        <select
          className="form-select form-select-sm"
          style={{ width: 170 }}
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Brand Dropdown */}
        <select
          className="form-select form-select-sm"
          style={{ width: 170 }}
          value={selectedBrand}
          onChange={e => setSelectedBrand(e.target.value)}
        >
          <option value="all">All Brands / Mills</option>
          {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>

        <button className="btn btn-primary btn-sm" onClick={loadData}>
          <RefreshCw size={13} /> Refresh Performance
        </button>

        <button className="btn btn-secondary btn-sm" onClick={exportCSV} style={{ marginLeft: 'auto' }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Activity size={36} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
            <div>Analyzing Product Catalog Sales & Generating Performance Visuals...</div>
          </div>
        ) : !report ? (
          <div className="empty-state" style={{ padding: 60 }}>No stock performance data available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI Cards Row */}
            <div className="grid-4" style={{ gap: 14 }}>
              {/* Top Seller Card */}
              <div className="kpi-card" style={{ borderTop: '3px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Award size={14} style={{ color: '#F59E0B' }} /> Top Best Seller (Qty)
                  </div>
                  <span className="badge badge-warning text-xs">#1 Volume</span>
                </div>
                <div className="kpi-value text-warning" style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topSeller ? topSeller.name : '—'}
                </div>
                <div className="kpi-subtitle">
                  {topSeller ? `SKU: ${topSeller.part_number} · Sold ${topSeller.units_sold} units` : 'No sales recorded'}
                </div>
              </div>

              {/* Top Revenue Card */}
              <div className="kpi-card" style={{ borderTop: '3px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Flame size={14} style={{ color: '#10B981' }} /> Top Revenue Generator
                  </div>
                  <span className="badge badge-success text-xs">#1 Revenue</span>
                </div>
                <div className="kpi-value text-success" style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topRevenue ? fmt(topRevenue.revenue_generated) : '—'}
                </div>
                <div className="kpi-subtitle">
                  {topRevenue ? `${topRevenue.name} (SKU: ${topRevenue.part_number})` : 'No sales recorded'}
                </div>
              </div>

              {/* Fast Movers vs Stagnant Count */}
              <div className="kpi-card" style={{ borderTop: '3px solid #3B82F6' }}>
                <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Zap size={14} style={{ color: '#3B82F6' }} /> Stock Movement Velocity
                </div>
                <div className="kpi-value text-primary" style={{ fontWeight: 900 }}>
                  {summary.fast_movers_count} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Fast Movers</span>
                </div>
                <div className="kpi-subtitle">
                  {summary.moderate_movers_count} moderate · <span style={{ color: '#EF4444' }}>{summary.stagnant_count} stagnant items</span>
                </div>
              </div>

              {/* Inventory Valuation */}
              <div className="kpi-card" style={{ borderTop: '3px solid #8B5CF6' }}>
                <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Package size={14} style={{ color: '#8B5CF6' }} /> Total Catalog Valuation
                </div>
                <div className="kpi-value" style={{ color: '#C084FC', fontWeight: 900 }}>
                  {fmt(summary.total_inventory_retail_value)}
                </div>
                <div className="kpi-subtitle">
                  {summary.total_inventory_items} items ({summary.total_inventory_units} units on hand)
                  {canViewCost && ` · Cost: ${fmt(summary.total_inventory_cost_value)}`}
                </div>
              </div>
            </div>

            {/* Visual Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
              {/* Chart 1: Top 10 Best Sellers by Quantity */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Award size={16} style={{ color: '#F59E0B' }} />
                  Top Best-Selling Items by Units Sold
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Items with highest sales volume during the selected timeframe
                </div>

                {topUnitsChartData.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No units sold in this timeframe</div>
                ) : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topUnitsChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
                        <XAxis type="number" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} width={100} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Bar dataKey="units" name="Units Sold" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Chart 2: Category Sales Share Donut */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <PieChart size={16} style={{ color: 'var(--color-primary)' }} />
                  Sales Volume by Category
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Share of pieces sold per product category
                </div>

                {summary.category_performance.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No category sales data</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: 260 }}>
                    <div style={{ width: '55%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={summary.category_performance}
                            dataKey="units_sold"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {summary.category_performance.map((entry: any, index: number) => (
                              <Cell key={`cat-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomChartTooltip />} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.775rem' }}>
                      {summary.category_performance.slice(0, 6).map((cat: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                            {cat.name}
                          </span>
                          <strong>{cat.units_sold} pcs</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 3: Top Revenue & Profit Generators */}
            {canViewProfit && topRevenueChartData.length > 0 && (
              <div className="card" style={{ padding: '20px 24px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <TrendingUp size={16} style={{ color: '#10B981' }} />
                  Top Items: Revenue vs Gross Profit Generated
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Comparing gross sales revenue (Green) and gross profit (Blue) generated per top product
                </div>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRevenueChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: '0.8rem' }} />
                      <Bar dataKey="revenue" name="Revenue Generated (PKR)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Gross Profit (PKR)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Item Performance Table & Search */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Filter bar */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
                display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
              }}>
                <div style={{ position: 'relative', width: 240 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    placeholder="Search product or SKU..."
                    style={{ paddingLeft: 30 }}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Velocity filters */}
                <div className="btn-group">
                  {[
                    { key: 'all', label: 'All Items' },
                    { key: 'fast', label: '🚀 Fast' },
                    { key: 'moderate', label: '⚡ Moderate' },
                    { key: 'slow', label: '🐢 Slow' },
                    { key: 'stagnant', label: '💤 Stagnant' },
                    { key: 'out_of_stock', label: '⚠️ Out of Stock' }
                  ].map(v => (
                    <button
                      key={v.key}
                      className={`btn btn-sm ${velocityFilter === v.key ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setVelocityFilter(v.key as any)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Showing {sortedItems.length} of {report.items.length} catalog items
                </span>
              </div>

              {sortedItems.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <Package size={32} style={{ opacity: 0.3 }} />
                  <p>No products match the selected filters</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: 'center' }}>#</th>
                      <th>SKU / Code</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Brand</th>
                      <th
                        style={{ textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          if (sortBy === 'units_sold') setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
                          else { setSortBy('units_sold'); setSortOrder('desc') }
                        }}
                      >
                        Units Sold {sortBy === 'units_sold' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        style={{ textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          if (sortBy === 'stock') setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
                          else { setSortBy('stock'); setSortOrder('desc') }
                        }}
                      >
                        Stock {sortBy === 'stock' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th style={{ textAlign: 'right' }}>Retail Price</th>
                      <th
                        style={{ textAlign: 'right', cursor: 'pointer' }}
                        onClick={() => {
                          if (sortBy === 'revenue') setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
                          else { setSortBy('revenue'); setSortOrder('desc') }
                        }}
                      >
                        Revenue {sortBy === 'revenue' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      {canViewProfit && (
                        <th
                          style={{ textAlign: 'right', cursor: 'pointer' }}
                          onClick={() => {
                            if (sortBy === 'profit') setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
                            else { setSortBy('profit'); setSortOrder('desc') }
                          }}
                        >
                          🔒 Profit {sortBy === 'profit' && (sortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {canViewProfit && (
                        <th
                          style={{ textAlign: 'center', cursor: 'pointer' }}
                          onClick={() => {
                            if (sortBy === 'margin') setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
                            else { setSortBy('margin'); setSortOrder('desc') }
                          }}
                        >
                          Margin % {sortBy === 'margin' && (sortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      <th>Velocity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((it, idx) => (
                      <tr key={it.id}>
                        <td style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </td>
                        <td><span className="font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{it.part_number}</span></td>
                        <td><strong>{it.name}</strong></td>
                        <td><span className="badge badge-primary">{it.category_name}</span></td>
                        <td className="text-muted text-xs">{it.brand_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge" style={{
                            background: it.units_sold >= 8 ? 'rgba(16, 185, 129, 0.15)' : it.units_sold > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: it.units_sold >= 8 ? '#34D399' : it.units_sold > 0 ? '#60A5FA' : 'var(--color-text-muted)',
                            fontWeight: 800
                          }}>
                            {it.units_sold} pcs
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: it.quantity_on_hand <= it.reorder_level ? 'var(--color-danger)' : 'inherit' }}>
                          {it.quantity_on_hand}
                        </td>
                        <td className="col-currency">{fmt(it.retail_price)}</td>
                        <td className="col-currency text-success" style={{ fontWeight: 800 }}>{fmt(it.revenue_generated)}</td>
                        {canViewProfit && (
                          <td className="col-currency text-primary" style={{ fontWeight: 800 }}>
                            {fmt(it.profit_generated)}
                          </td>
                        )}
                        {canViewProfit && (
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {it.revenue_generated > 0 ? `${it.profit_margin_pct.toFixed(1)}%` : '—'}
                          </td>
                        )}
                        <td>
                          {it.velocity === 'fast' && (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              🚀 Fast Mover
                            </span>
                          )}
                          {it.velocity === 'moderate' && (
                            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                              ⚡ Moderate
                            </span>
                          )}
                          {it.velocity === 'slow' && (
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                              🐢 Slow
                            </span>
                          )}
                          {it.velocity === 'stagnant' && (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              💤 Stagnant
                            </span>
                          )}
                          {it.velocity === 'out_of_stock' && (
                            <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9CA3AF', border: '1px solid rgba(107, 114, 128, 0.3)' }}>
                              ⚠️ Out of Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// BULK CSV IMPORT MODAL
// ============================================================
function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { currentUser } = useAuth()
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState<BulkImportItemInput[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const template = `Part Number,Name,Barcode,Brand Name,Category Name,Size Variant,Cost Price,Retail Price,Quantity
AD-LAWN-001,Al-Deewan Summer Lawn 3pc,890111222,Al-Deewan,Unstitched,Unstitched,2200,3800,20
AD-KURTI-002,Embroidered Lawn Kurti,890333444,Al-Deewan,Pret,Medium,1500,2800,15`
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'aldeewan_product_import_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const text = String(evt.target?.result || '')
      setCsvText(text)
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split(/\r?\n/)
      if (lines.length < 2) {
        setParsed([])
        return
      }

      const rows: BulkImportItemInput[] = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
        if (cols.length < 2 || !cols[0] || !cols[1]) continue

        rows.push({
          part_number: cols[0],
          name: cols[1],
          barcode: cols[2] || cols[0],
          brand_name: cols[3] || undefined,
          category_name: cols[4] || undefined,
          size_variant: cols[5] || undefined,
          cost_price: parseFloat(cols[6]) || 0,
          retail_price: parseFloat(cols[7]) || 0,
          quantity: parseInt(cols[8]) || 0,
        })
      }
      setParsed(rows)
    } catch (err) {
      toast.error('Failed to parse CSV file')
    }
  }

  const handleImport = async () => {
    if (parsed.length === 0) {
      toast.error('No valid products to import')
      return
    }

    setLoading(true)
    const res = await window.api.bulkImportItems(currentUser!.id, parsed)
    if (res.success) {
      toast.success(`Imported ${res.imported} items successfully!`)
      onImported()
    } else {
      toast.error(res.error || 'Import failed')
    }
    setLoading(false)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 850, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
          <h4 className="modal-title">Bulk Import Products from CSV</h4>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-2)', padding: '12px 16px', borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Need the CSV Template?</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Download the official Excel/CSV format with sample rows.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
              <Download size={13} /> Download Template
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Choose .CSV File
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>or paste comma-separated text below:</span>
          </div>

          <textarea
            className="form-input font-mono"
            rows={4}
            placeholder="Part Number,Name,Barcode,Brand,Category,Size,Cost,Retail,Quantity&#10;AD-101,Lawn 3pc,89011,Al-Deewan,Summer,Unstitched,2000,3500,10"
            value={csvText}
            onChange={e => { setCsvText(e.target.value); parseCSV(e.target.value) }}
            style={{ fontSize: '0.75rem', resize: 'vertical' }}
          />

          {parsed.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 8 }}>
                Ready to Import ({parsed.length} Products):
              </div>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <table className="data-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Size</th>
                      <th style={{ textAlign: 'right' }}>Cost</th>
                      <th style={{ textAlign: 'right' }}>Retail</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{p.part_number}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.size_variant || '—'}</td>
                        <td className="col-currency">{fmt(p.cost_price)}</td>
                        <td className="col-currency">{fmt(p.retail_price)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={loading || parsed.length === 0}
          >
            <CheckCircle size={15} /> {loading ? 'Importing...' : `Import ${parsed.length} Items`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SUPPLIER DETAILS VIEW (COMPREHENSIVE SUPPLIERS & MILLS TAB)
// ============================================================
function SupplierDetailsView({ canEdit, canViewCost }: { canEdit: boolean; canViewCost: boolean }) {
  const { currentUser } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'products' | 'purchases' | 'statement'>('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'due' | 'zero'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'products' | 'newest'>('name')
  const [showAddModal, setShowAddModal] = useState(false)
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null)
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null)
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null)
  const [itemSearchQuery, setItemSearchQuery] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [sups, its, purs] = await Promise.all([
        window.api.getAllSuppliers(),
        window.api.getAllItems(),
        currentUser ? window.api.getAllPurchases(currentUser.id) : Promise.resolve({ success: true, data: [] })
      ])
      setSuppliers(Array.isArray(sups) ? sups : [])
      setItems(Array.isArray(its) ? its : [])
      if (purs && purs.success && Array.isArray(purs.data)) {
        setPurchases(purs.data)
      }
    } catch (e) {
      console.error('Failed to load supplier directory data:', e)
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentUser])

  // Select first supplier automatically if none selected
  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id)
    }
  }, [suppliers, selectedSupplierId])

  // Aggregate Metrics
  const totalSuppliersCount = suppliers.length
  const totalProductsSupplied = items.filter(i => Boolean(i.supplier_id)).length
  const totalOutstandingBalance = suppliers.reduce((s, sup) => s + (Number(sup.balance) || 0), 0)
  const totalPurchasesVolume = purchases.reduce((s, p) => s + (Number(p.total_cost) || 0), 0)

  // Map products count per supplier
  const supplierItemsMap = React.useMemo(() => {
    const map = new Map<string, Item[]>()
    items.forEach(it => {
      if (it.supplier_id) {
        const list = map.get(it.supplier_id) || []
        list.push(it)
        map.set(it.supplier_id, list)
      }
    })
    return map
  }, [items])

  // Map purchases per supplier
  const supplierPurchasesMap = React.useMemo(() => {
    const map = new Map<string, Purchase[]>()
    purchases.forEach(p => {
      if (p.supplier_id) {
        const list = map.get(p.supplier_id) || []
        list.push(p)
        map.set(p.supplier_id, list)
      }
    })
    return map
  }, [purchases])

  // Filtered & Sorted Suppliers
  const filteredSuppliers = React.useMemo(() => {
    let list = [...suppliers]

    // Search query filter
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.contact || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (supplierItemsMap.get(s.id) || []).some(it => it.name.toLowerCase().includes(q) || it.part_number.toLowerCase().includes(q))
      )
    }

    // Balance filter
    if (balanceFilter === 'due') {
      list = list.filter(s => (Number(s.balance) || 0) > 0)
    } else if (balanceFilter === 'zero') {
      list = list.filter(s => (Number(s.balance) || 0) <= 0)
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'balance') return (Number(b.balance) || 0) - (Number(a.balance) || 0)
      if (sortBy === 'products') return (supplierItemsMap.get(b.id)?.length || 0) - (supplierItemsMap.get(a.id)?.length || 0)
      if (sortBy === 'newest') return (b.id || '').localeCompare(a.id || '')
      return 0
    })

    return list
  }, [suppliers, searchQuery, balanceFilter, sortBy, supplierItemsMap])

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || filteredSuppliers[0] || null
  const selectedSupplierItems = selectedSupplier ? (supplierItemsMap.get(selectedSupplier.id) || []) : []
  const selectedSupplierPurchases = selectedSupplier ? (supplierPurchasesMap.get(selectedSupplier.id) || []) : []

  // Items search within selected supplier
  const filteredSupplierItems = React.useMemo(() => {
    const q = itemSearchQuery.toLowerCase().trim()
    if (!q) return selectedSupplierItems
    return selectedSupplierItems.filter(it =>
      it.name.toLowerCase().includes(q) ||
      it.part_number.toLowerCase().includes(q) ||
      (it.category_name || '').toLowerCase().includes(q) ||
      (it.brand_name || '').toLowerCase().includes(q) ||
      (it.barcode || '').includes(q)
    )
  }, [selectedSupplierItems, itemSearchQuery])

  // Total stock on hand for selected supplier's items
  const selectedSupplierStockUnits = selectedSupplierItems.reduce((s, it) => s + (it.quantity_on_hand || 0), 0)
  const selectedSupplierStockValueCost = selectedSupplierItems.reduce((s, it) => s + ((it.cost_price || 0) * (it.quantity_on_hand || 0)), 0)
  const selectedSupplierStockValueRetail = selectedSupplierItems.reduce((s, it) => s + ((it.retail_price || 0) * (it.quantity_on_hand || 0)), 0)

  // Export Suppliers to CSV
  const handleExportSuppliersCSV = () => {
    if (suppliers.length === 0) {
      toast.error('No suppliers to export')
      return
    }

    const headers = ['Supplier Name', 'Contact Phone', 'Address / City', 'Current Balance Owed', 'Total Products Supplied', 'Notes']
    const rows = suppliers.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.contact || ''}"`,
      `"${s.address || ''}"`,
      s.balance || 0,
      supplierItemsMap.get(s.id)?.length || 0,
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `aldeewan_suppliers_directory_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Suppliers directory exported to CSV!')
  }

  // Delete Supplier
  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!currentUser) return
    const isOwnerOrManager = currentUser.role === 'owner' || currentUser.role === 'manager'
    if (!isOwnerOrManager) {
      toast.error('Only store owners or managers can delete suppliers.')
      return
    }
    const itemCount = supplierItemsMap.get(sup.id)?.length || 0
    const msg = itemCount > 0
      ? `Are you sure you want to delete supplier "${sup.name}"? This supplier is linked to ${itemCount} products. The products will remain in stock without a supplier link.`
      : `Are you sure you want to delete supplier "${sup.name}"?`
    if (!window.confirm(msg)) return

    try {
      const res = await window.api.deleteSupplier(currentUser.id, sup.id)
      if (res.success) {
        toast.success(`Supplier "${sup.name}" deleted successfully!`)
        if (selectedSupplierId === sup.id) setSelectedSupplierId(null)
        loadData()
      } else {
        toast.error(res.error || 'Failed to delete supplier')
      }
    } catch (err) {
      toast.error('Error deleting supplier')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '16px 24px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        <div className="card" style={{ padding: '12px 16px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total Suppliers / Mills</span>
            <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalSuppliersCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Registered mills, fabric & ready-made vendors
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Catalog Products Linked</span>
            <Package size={16} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
            {totalProductsSupplied}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Products mapped to suppliers in inventory
          </div>
        </div>

        <div className="card" style={{
          padding: '12px 16px',
          background: totalOutstandingBalance > 0 ? 'rgba(234, 88, 12, 0.08)' : 'var(--color-surface-2)',
          border: totalOutstandingBalance > 0 ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid var(--color-border)',
          borderRadius: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: totalOutstandingBalance > 0 ? '#ea580c' : 'var(--color-text-secondary)' }}>
              Outstanding Payables (AP)
            </span>
            <CreditCard size={16} style={{ color: totalOutstandingBalance > 0 ? '#ea580c' : 'var(--color-text-muted)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalOutstandingBalance > 0 ? '#ea580c' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
            {fmt(totalOutstandingBalance)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: totalOutstandingBalance > 0 ? '#c2410c' : 'var(--color-text-muted)', marginTop: 2 }}>
            {totalOutstandingBalance > 0 ? 'Pending dues owed to fabric suppliers' : 'All supplier balances are fully settled'}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total Invoiced Purchases</span>
            <Receipt size={16} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
            {fmt(totalPurchasesVolume)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Across {purchases.length} purchase invoices & stock batches
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        gap: 12,
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search supplier name, phone, city, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, fontSize: '0.8125rem' }}
          />
        </div>

        {/* Filters & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Balance Filter */}
          <div style={{ display: 'flex', background: 'var(--color-surface-2)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            {[
              { key: 'all', label: 'All Suppliers' },
              { key: 'due', label: 'Balance Due' },
              { key: 'zero', label: 'Settled' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                className="btn btn-sm"
                onClick={() => setBalanceFilter(f.key as typeof balanceFilter)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: balanceFilter === f.key ? 700 : 500,
                  border: 'none',
                  background: balanceFilter === f.key ? 'var(--color-primary)' : 'transparent',
                  color: balanceFilter === f.key ? '#fff' : 'var(--color-text-secondary)',
                  borderRadius: 'calc(var(--radius-md) - 2px)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort By */}
          <select
            className="form-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{ fontSize: '0.75rem', padding: '6px 10px', maxWidth: 160 }}
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="balance">Sort: Highest Balance</option>
            <option value="products">Sort: Most Products</option>
            <option value="newest">Sort: Newest</option>
          </select>

          {/* Export CSV */}
          <button className="btn btn-secondary btn-sm" onClick={handleExportSuppliersCSV} title="Export suppliers to CSV">
            <Download size={13} /> Export CSV
          </button>

          {/* Add Supplier Button */}
          {canEdit && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSupplierToEdit(null)
                setShowAddModal(true)
              }}
              style={{ fontWeight: 700 }}
            >
              <Plus size={14} /> Add Supplier / Mill
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Left Suppliers List | Right Supplier Detail Hub */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', overflow: 'hidden' }}>
        {/* Left Column: Suppliers Directory Cards */}
        <div style={{
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 16px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-muted)',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Suppliers Directory ({filteredSuppliers.length})</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>Click to view details</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <div>Loading suppliers...</div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Truck size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>No Suppliers Found</div>
              <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                {searchQuery ? 'Try adjusting your search criteria' : 'Click "Add Supplier / Mill" above to create your first vendor.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredSuppliers.map(sup => {
                const isSelected = selectedSupplier?.id === sup.id
                const supItemsCount = supplierItemsMap.get(sup.id)?.length || 0
                const supBalance = Number(sup.balance) || 0

                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplierId(sup.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-primary-10)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--color-primary)' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-surface-2)',
                          color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.875rem', flexShrink: 0,
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`
                        }}>
                          {sup.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: isSelected ? 800 : 700,
                            fontSize: '0.875rem',
                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: 170
                          }}>
                            {sup.name}
                          </div>
                          {sup.contact && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Phone size={11} /> {sup.contact}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Balance badge */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {supBalance > 0 ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px' }}>
                            {fmt(supBalance)}
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '2px 6px' }}>
                            Settled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Sub-row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={12} style={{ color: '#0284c7' }} />
                        <strong>{supItemsCount}</strong> {supItemsCount === 1 ? 'Product' : 'Products'}
                      </span>
                      {sup.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <MapPin size={11} /> {sup.address}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Supplier Full Detail Hub */}
        <div style={{
          background: 'var(--color-surface-2)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedSupplier ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Supplier Header Banner */}
              <div className="card" style={{
                padding: '20px 24px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  {/* Left: Supplier Identity */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: 'var(--color-primary-10)', color: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1.35rem', flexShrink: 0,
                      border: '1.5px solid var(--color-primary-20)'
                    }}>
                      {selectedSupplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          {selectedSupplier.name}
                        </h2>
                        <span className="badge badge-primary" style={{ fontSize: '0.625rem', textTransform: 'uppercase' }}>
                          Supplier / Mill
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {selectedSupplier.contact && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={13} style={{ color: 'var(--color-primary)' }} />
                            <strong>{selectedSupplier.contact}</strong>
                          </span>
                        )}
                        {selectedSupplier.address && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={13} style={{ color: '#ea580c' }} />
                            {selectedSupplier.address}
                          </span>
                        )}
                        {selectedSupplier.created_at && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            <Calendar size={12} /> Added: {selectedSupplier.created_at.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      {selectedSupplier.notes && (
                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', maxWidth: 600 }}>
                          📝 <em>{selectedSupplier.notes}</em>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Balance Callout & Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <div style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: (Number(selectedSupplier.balance) || 0) > 0 ? 'rgba(234, 88, 12, 0.12)' : 'var(--color-success-bg)',
                      border: (Number(selectedSupplier.balance) || 0) > 0 ? '1.5px solid rgba(234, 88, 12, 0.35)' : '1.5px solid #86EFAC',
                      textAlign: 'right'
                    }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: (Number(selectedSupplier.balance) || 0) > 0 ? '#c2410c' : 'var(--color-success)', textTransform: 'uppercase' }}>
                        Current Outstanding Balance
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: (Number(selectedSupplier.balance) || 0) > 0 ? '#ea580c' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                        {fmt(selectedSupplier.balance || 0)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => setPayingSupplier(selectedSupplier)}
                        style={{ fontWeight: 700 }}
                      >
                        <Coins size={13} /> Record Payment
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setStatementSupplier(selectedSupplier)}
                        style={{ fontWeight: 600 }}
                      >
                        <FileText size={13} /> Ledger Statement
                      </button>
                      {canEdit && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSupplierToEdit(selectedSupplier)
                            setShowAddModal(true)
                          }}
                          title="Edit supplier details"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      )}
                      {canEdit && (currentUser?.role === 'owner' || currentUser?.role === 'manager') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteSupplier(selectedSupplier)}
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete supplier"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Tabs: Supplied Products | Purchase Bills | Statement */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '10px 10px 0 0', padding: '0 16px' }}>
                {[
                  { key: 'products', label: `Supplied Products (${selectedSupplierItems.length})`, icon: Package },
                  { key: 'purchases', label: `Purchase Invoices (${selectedSupplierPurchases.length})`, icon: Receipt },
                  { key: 'statement', label: 'Ledger & Statement', icon: FileText },
                ].map(st => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setSubTab(st.key as typeof subTab)}
                    style={{
                      padding: '12px 18px',
                      background: 'none', border: 'none',
                      borderBottom: subTab === st.key ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                      color: subTab === st.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontWeight: subTab === st.key ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: -1
                    }}
                  >
                    <st.icon size={14} /> {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab 1: Supplied Products */}
              {subTab === 'products' && (
                <div className="card" style={{ padding: 0, borderRadius: '0 0 12px 12px', border: '1px solid var(--color-border)', borderTop: 'none', background: 'var(--color-surface)' }}>
                  {/* Stock Summary Metrics for this supplier */}
                  <div style={{
                    padding: '12px 20px',
                    background: 'var(--color-surface-2)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span>Total Units in Stock: <strong className="font-mono">{selectedSupplierStockUnits}</strong></span>
                      {canViewCost && (
                        <span>Inventory Value (Cost): <strong className="font-mono" style={{ color: 'var(--color-primary)' }}>{fmt(selectedSupplierStockValueCost)}</strong></span>
                      )}
                      <span>Retail Value: <strong className="font-mono" style={{ color: '#059669' }}>{fmt(selectedSupplierStockValueRetail)}</strong></span>
                    </div>

                    <div style={{ position: 'relative', minWidth: 220 }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input
                        type="text"
                        className="form-input form-input-sm"
                        placeholder="Search items for this supplier..."
                        value={itemSearchQuery}
                        onChange={e => setItemSearchQuery(e.target.value)}
                        style={{ paddingLeft: 26, fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>

                  {filteredSupplierItems.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <Package size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No products mapped to this supplier</div>
                      <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        When adding or editing items in the "Items List" tab, select <strong>{selectedSupplier.name}</strong> as the Supplier.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th>Part # / SKU</th>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Brand</th>
                            <th style={{ textAlign: 'center' }}>Stock Qty</th>
                            {canViewCost && <th style={{ textAlign: 'right' }}>Cost Price</th>}
                            <th style={{ textAlign: 'right' }}>Retail Price</th>
                            {canViewCost && <th style={{ textAlign: 'right' }}>Margin %</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSupplierItems.map(item => {
                            const isLowStock = (item.quantity_on_hand ?? 0) <= (item.reorder_level || 5) && (item.quantity_on_hand ?? 0) > 0
                            const isOutOfStock = (item.quantity_on_hand ?? 0) <= 0
                            const marginPct = (item.retail_price && item.cost_price && item.retail_price > 0)
                              ? (((item.retail_price - item.cost_price) / item.retail_price) * 100).toFixed(1)
                              : '0'

                            return (
                              <tr key={item.id}>
                                <td className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {item.part_number}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                                  {item.size_variant && (
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Variant: {item.size_variant}</span>
                                  )}
                                </td>
                                <td>{item.category_name || '—'}</td>
                                <td>{item.brand_name || '—'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  {isOutOfStock ? (
                                    <span className="badge badge-danger" style={{ fontSize: '0.6875rem', fontWeight: 700 }}>
                                      Out of Stock (0)
                                    </span>
                                  ) : isLowStock ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.6875rem', fontWeight: 700 }}>
                                      Low: {item.quantity_on_hand}
                                    </span>
                                  ) : (
                                    <span className="font-mono" style={{ fontWeight: 800, color: '#059669' }}>
                                      {item.quantity_on_hand}
                                    </span>
                                  )}
                                </td>
                                {canViewCost && (
                                  <td className="col-currency font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                                    {fmt(item.cost_price)}
                                  </td>
                                )}
                                <td className="col-currency font-mono" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                  {fmt(item.retail_price)}
                                </td>
                                {canViewCost && (
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: Number(marginPct) >= 20 ? '#059669' : '#ea580c' }}>
                                    {marginPct}%
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Purchase Invoices */}
              {subTab === 'purchases' && (
                <div className="card" style={{ padding: 0, borderRadius: '0 0 12px 12px', border: '1px solid var(--color-border)', borderTop: 'none', background: 'var(--color-surface)' }}>
                  {selectedSupplierPurchases.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <Receipt size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No purchase invoices recorded yet</div>
                      <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        Record supplier bills and incoming shipments in the <strong>Purchases</strong> page.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th>PO #</th>
                            <th>Date</th>
                            <th>Bill / Invoice Ref</th>
                            <th style={{ textAlign: 'right' }}>Total Cost</th>
                            <th style={{ textAlign: 'right' }}>Amount Paid</th>
                            <th style={{ textAlign: 'right' }}>Balance Due</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSupplierPurchases.map(p => (
                            <tr key={p.id}>
                              <td className="font-mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                {p.purchase_number}
                              </td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                {p.date}
                              </td>
                              <td>
                                {p.invoice_ref ? (
                                  <span className="badge badge-secondary" style={{ fontSize: '0.6875rem' }}>{p.invoice_ref}</span>
                                ) : '—'}
                              </td>
                              <td className="col-currency font-mono" style={{ fontWeight: 700 }}>
                                {fmt(p.total_cost)}
                              </td>
                              <td className="col-currency font-mono" style={{ color: '#059669' }}>
                                {fmt(p.amount_paid)}
                              </td>
                              <td className="col-currency font-mono" style={{ fontWeight: 800, color: (p.balance_due || 0) > 0 ? '#ea580c' : 'var(--color-text-muted)' }}>
                                {fmt(p.balance_due || 0)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${p.payment_status === 'paid' ? 'badge-success' : p.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                  {p.payment_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 3: Statement & Ledger Summary */}
              {subTab === 'statement' && (
                <SupplierStatementView supplier={selectedSupplier} />
              )}
            </div>
          ) : (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Building2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Select a Supplier</div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Choose a supplier from the list on the left to view their supplied products, purchase history, and ledger.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <QuickAddSupplierModal
          supplierToEdit={supplierToEdit}
          onSaved={() => {
            setShowAddModal(false)
            loadData()
          }}
          onClose={() => {
            setShowAddModal(false)
            setSupplierToEdit(null)
          }}
        />
      )}

      {/* Record Payment to Supplier Modal */}
      {payingSupplier && (
        <QuickSupplierPaymentModal
          supplier={payingSupplier}
          onSaved={() => {
            setPayingSupplier(null)
            loadData()
          }}
          onClose={() => setPayingSupplier(null)}
        />
      )}

      {/* Supplier Statement Modal */}
      {statementSupplier && (
        <SupplierStatementModal
          supplier={statementSupplier}
          onClose={() => setStatementSupplier(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// SUPPLIER STATEMENT INLINE VIEW
// ============================================================
function SupplierStatementView({ supplier }: { supplier: Supplier }) {
  const { currentUser } = useAuth()
  const [statement, setStatement] = useState<PartyStatementReport | null>(null)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const fetchStatement = async () => {
    if (!currentUser || !supplier) return
    setLoading(true)
    try {
      const res = await window.api.getSupplierStatement(currentUser.id, supplier.id, fromDate, toDate)
      if (res && res.success && res.data) {
        setStatement(res.data)
      } else {
        toast.error(res?.error || 'Failed to load statement')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error fetching statement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatement()
  }, [supplier.id, fromDate, toDate])

  return (
    <div className="card" style={{ padding: 20, borderRadius: '0 0 12px 12px', border: '1px solid var(--color-border)', borderTop: 'none', background: 'var(--color-surface)' }}>
      {/* Date Filter & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
          <label style={{ fontWeight: 600 }}>From:</label>
          <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 140 }} />
          <label style={{ fontWeight: 600, marginLeft: 8 }}>To:</label>
          <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 140 }} />
          <button className="btn btn-secondary btn-sm" onClick={fetchStatement} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
          <div>Generating statement...</div>
        </div>
      ) : statement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Statement Summary KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Opening Balance</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{fmt(statement.opening_balance)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Total Payments (Debits)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{fmt(statement.total_debit)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: '#ea580c', fontWeight: 600 }}>Total Purchases (Credits)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ea580c', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{fmt(statement.total_credit)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(234, 88, 12, 0.08)', borderRadius: 8, border: '1.5px solid rgba(234, 88, 12, 0.3)' }}>
              <div style={{ fontSize: '0.6875rem', color: '#ea580c', fontWeight: 700 }}>Closing Balance Owed</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#ea580c', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{fmt(statement.closing_balance)}</div>
            </div>
          </div>

          {/* Statement Rows Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref #</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Debit (Paid)</th>
                  <th style={{ textAlign: 'right' }}>Credit (Billed)</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                      No ledger transactions found in selected date range
                    </td>
                  </tr>
                ) : (
                  statement.rows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{row.date}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>{row.ref_number || '—'}</td>
                      <td>{row.description}</td>
                      <td className="col-currency font-mono" style={{ color: '#059669', fontWeight: row.debit > 0 ? 700 : 400 }}>
                        {row.debit > 0 ? fmt(row.debit) : '—'}
                      </td>
                      <td className="col-currency font-mono" style={{ color: '#ea580c', fontWeight: row.credit > 0 ? 700 : 400 }}>
                        {row.credit > 0 ? fmt(row.credit) : '—'}
                      </td>
                      <td className="col-currency font-mono" style={{ fontWeight: 800 }}>
                        {fmt(row.running_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// QUICK RECORD SUPPLIER PAYMENT MODAL
// ============================================================
function QuickSupplierPaymentModal({
  supplier,
  onSaved,
  onClose
}: {
  supplier: Supplier
  onSaved: () => void
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash')
  const [paymentSource, setPaymentSource] = useState<'drawer' | 'outside' | 'bank'>('drawer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    const payVal = parseFloat(amount) || 0
    if (payVal <= 0) {
      toast.error('Please enter a valid payment amount (> 0)')
      return
    }

    if (!currentUser) return
    setSubmitting(true)

    try {
      const res = await window.api.recordSupplierPayment(currentUser.id, {
        supplier_id: supplier.id,
        amount: payVal,
        payment_method: paymentMethod,
        payment_source: paymentSource,
        reference_no: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        date: new Date().toISOString().slice(0, 10)
      })

      if (res && res.success) {
        toast.success(`Payment of ${fmt(payVal)} to "${supplier.name}" recorded successfully!`)
        onSaved()
      } else {
        toast.error(res?.error || 'Failed to record supplier payment')
      }
    } catch (err) {
      toast.error('Error recording payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Coins size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="modal-title">Record Payment to Supplier</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handlePay}>
          <div className="modal-body">
            {/* Supplier Info & Balance */}
            <div style={{
              padding: '12px 14px',
              background: 'var(--color-surface-2)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>{supplier.name}</div>
                {supplier.contact && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{supplier.contact}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Current Balance Owed</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#ea580c', fontFamily: 'var(--font-mono)' }}>
                  {fmt(supplier.balance || 0)}
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Payment Amount (Rs.) *</label>
              <input
                type="number"
                step="any"
                className="form-input form-input-lg"
                placeholder="Enter amount to pay..."
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                autoFocus
                style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="grid-2" style={{ gap: 14 }}>
              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as 'cash' | 'bank')}
                >
                  <option value="cash">💵 Cash Payment</option>
                  <option value="bank">🏦 Bank / Online Transfer</option>
                </select>
              </div>

              {/* Payment Source */}
              <div className="form-group">
                <label className="form-label">Fund Source</label>
                <select
                  className="form-select"
                  value={paymentSource}
                  onChange={e => setPaymentSource(e.target.value as 'drawer' | 'outside' | 'bank')}
                >
                  <option value="drawer">POS Cash Drawer</option>
                  <option value="outside">Owner / External Funds</option>
                  <option value="bank">Company Bank Account</option>
                </select>
              </div>
            </div>

            {/* Reference */}
            <div className="form-group">
              <label className="form-label">Reference # / Cheque # / Slip #</label>
              <input
                className="form-input"
                placeholder="e.g. Cheque # 104423, JazzCash Ref, Receipt #"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes / Remarks</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="e.g. Paid against Lawn 3pc fabric order"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={submitting || !amount || parseFloat(amount) <= 0}>
              <CheckCircle size={15} /> {submitting ? 'Recording...' : `Confirm Payment of ${fmt(parseFloat(amount) || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// SUPPLIER STATEMENT MODAL (POPUP LEDGER & PRINT)
// ============================================================
function SupplierStatementModal({
  supplier,
  onClose
}: {
  supplier: Supplier
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [statement, setStatement] = useState<PartyStatementReport | null>(null)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 60)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const fetchStatement = async () => {
    if (!currentUser || !supplier) return
    setLoading(true)
    try {
      const res = await window.api.getSupplierStatement(currentUser.id, supplier.id, fromDate, toDate)
      if (res && res.success && res.data) {
        setStatement(res.data)
      } else {
        toast.error(res?.error || 'Failed to load statement')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error fetching statement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatement()
  }, [supplier.id, fromDate, toDate])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title">Supplier Statement / Ledger — {supplier.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={13} /> Print Statement
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div style={{ padding: '12px 20px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>From:</label>
          <input type="date" className="form-input form-input-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 140 }} />
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, marginLeft: 8 }}>To:</label>
          <input type="date" className="form-input form-input-sm" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 140 }} />
          <button className="btn btn-secondary btn-sm" onClick={fetchStatement} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
              <div>Generating statement...</div>
            </div>
          ) : statement ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Financial Snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Opening Balance</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{fmt(statement.opening_balance)}</div>
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Total Payments (Debits)</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>{fmt(statement.total_debit)}</div>
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#ea580c', fontWeight: 600 }}>Total Purchases (Credits)</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ea580c', fontFamily: 'var(--font-mono)' }}>{fmt(statement.total_credit)}</div>
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(234, 88, 12, 0.08)', borderRadius: 8, border: '1.5px solid rgba(234, 88, 12, 0.3)' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#ea580c', fontWeight: 700 }}>Closing Balance Owed</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#ea580c', fontFamily: 'var(--font-mono)' }}>{fmt(statement.closing_balance)}</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref #</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit (Paid)</th>
                      <th style={{ textAlign: 'right' }}>Credit (Billed)</th>
                      <th style={{ textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                          No transactions found in this period
                        </td>
                      </tr>
                    ) : (
                      statement.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{row.date}</td>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{row.ref_number || '—'}</td>
                          <td>{row.description}</td>
                          <td className="col-currency font-mono" style={{ color: '#059669', fontWeight: row.debit > 0 ? 700 : 400 }}>
                            {row.debit > 0 ? fmt(row.debit) : '—'}
                          </td>
                          <td className="col-currency font-mono" style={{ color: '#ea580c', fontWeight: row.credit > 0 ? 700 : 400 }}>
                            {row.credit > 0 ? fmt(row.credit) : '—'}
                          </td>
                          <td className="col-currency font-mono" style={{ fontWeight: 800 }}>
                            {fmt(row.running_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

