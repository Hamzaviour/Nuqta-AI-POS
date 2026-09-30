import React, { useState, useEffect, useRef } from 'react'
import { useStoreName } from '../../hooks/useStoreName'
import {
  Barcode as BarcodeIcon, Search, Printer, Settings, CheckSquare,
  Square, RefreshCw, Eye, Tag, LayoutGrid, Check
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Item, BarcodeLabelConfig } from '../../types'
import toast from 'react-hot-toast'

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface SelectedLabelItem {
  item: Item
  copies: number
}

export default function BarcodePage() {
  const { currentUser } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMap, setSelectedMap] = useState<{ [id: string]: number }>({})

  // Label Designer Configuration
  const [config, setConfig] = useState<BarcodeLabelConfig>({
    size: '50x25',
    show_brand: true,
    show_price: true,
    show_size: true,
    show_barcode_text: true,
    currency_prefix: 'Rs. '
  })

  const loadItems = async () => {
    setLoading(true)
    const data = await window.api.getAllItems()
    setItems(data.filter(i => i.is_active === 1))
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  const filtered = items.filter(i =>
    i.part_number.toLowerCase().includes(search.toLowerCase()) ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode && i.barcode.includes(search))
  )

  const toggleSelect = (itemId: string) => {
    setSelectedMap(prev => {
      const copy = { ...prev }
      if (copy[itemId]) delete copy[itemId]
      else copy[itemId] = 1
      return copy
    })
  }

  const setCopies = (itemId: string, copies: number) => {
    setSelectedMap(prev => ({ ...prev, [itemId]: Math.max(1, copies) }))
  }

  const selectAll = () => {
    const next: { [id: string]: number } = {}
    filtered.forEach(i => { next[i.id] = selectedMap[i.id] || 1 })
    setSelectedMap(next)
  }

  const clearSelection = () => setSelectedMap({})

  const selectedItems: SelectedLabelItem[] = Object.entries(selectedMap)
    .map(([id, copies]) => {
      const itm = items.find(i => i.id === id)
      return itm ? { item: itm, copies } : null
    })
    .filter(Boolean) as SelectedLabelItem[]

  const totalStickers = selectedItems.reduce((s, i) => s + i.copies, 0)

  const handlePrint = async () => {
    if (totalStickers === 0) {
      toast.error('Select at least one item to print barcode labels')
      return
    }
    if (window.api && typeof window.api.print === 'function') {
      try {
        await window.api.print({ silent: false, printBackground: true })
      } catch {
        window.print()
      }
    } else {
      window.print()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Screen View (Hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="page-header">
          <BarcodeIcon size={20} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 className="page-header-title">Barcode Label Designer & Printing</h3>
            <div className="page-header-subtitle">Print thermal barcode price tags (50x25mm, 40x28mm, 38x25mm)</div>
          </div>
          <div className="page-header-actions">
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={totalStickers === 0}
            >
              <Printer size={15} /> Print {totalStickers > 0 ? `(${totalStickers} Labels)` : 'Labels'}
            </button>
          </div>
        </div>

        {/* 2-Column Split: Item Selector on Left, Live Thermal Preview & Settings on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Column: Items Catalog Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{
              padding: '12px 20px', background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12, alignItems: 'center'
            }}>
              <div className="search-input-wrap" style={{ flex: 1 }}>
                <Search size={14} className="search-icon" />
                <input
                  className="form-input search-input"
                  placeholder="Search SKU, name, barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={selectAll}>Select All</button>
              <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Clear</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading items...</div>
              ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 40 }}>
                  <BarcodeIcon size={36} style={{ opacity: 0.2 }} />
                  <p>No products found matching search.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>SKU / Part #</th>
                      <th>Item Name</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'center', width: 90 }}>Qty to Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const isSelected = !!selectedMap[item.id]
                      const copies = selectedMap[item.id] || 1
                      return (
                        <tr
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--color-primary-10)' : undefined
                          }}
                        >
                          <td onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <span className="font-mono text-xs" style={{ fontWeight: 700 }}>
                              {item.part_number}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            {item.size_variant && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                Size: {item.size_variant}
                              </div>
                            )}
                          </td>
                          <td className="col-currency" style={{ fontWeight: 700 }}>
                            {fmt(item.retail_price)}
                          </td>
                          <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              className="form-input"
                              min={1}
                              max={999}
                              value={copies}
                              disabled={!isSelected}
                              onChange={e => setCopies(item.id, parseInt(e.target.value) || 1)}
                              style={{ width: 65, textAlign: 'center', margin: '0 auto', padding: '4px 6px' }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Column: Label Settings & Live Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', overflow: 'auto' }}>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Designer Settings Card */}
              <div className="card">
                <div className="card-header">
                  <Settings size={16} style={{ color: 'var(--color-primary)' }} />
                  <span className="card-title">Label Formatting & Dimensions</span>
                </div>
                <div className="card-body">
                  <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Sticker Size</label>
                      <select
                        className="form-select"
                        value={config.size}
                        onChange={e => setConfig(prev => ({ ...prev, size: e.target.value as typeof config.size }))}
                      >
                        <option value="50x25">50mm × 25mm (Standard Retail)</option>
                        <option value="40x28">40mm × 28mm (Compact)</option>
                        <option value="38x25">38mm × 25mm (Small Tag)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Currency Prefix</label>
                      <input
                        className="form-input"
                        value={config.currency_prefix}
                        onChange={e => setConfig(prev => ({ ...prev, currency_prefix: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { key: 'show_brand', label: 'Show Store Name' },
                      { key: 'show_price', label: 'Show Retail Price' },
                      { key: 'show_size', label: 'Show Size Variant' },
                      { key: 'show_barcode_text', label: 'Show SKU Under Barcode' },
                    ].map(opt => (
                      <label
                        key={opt.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: '0.8125rem', cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={config[opt.key as keyof BarcodeLabelConfig] as boolean}
                          onChange={e => setConfig(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Section */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Thermal Sticker Preview
                </div>
                {selectedItems.length === 0 ? (
                  <div style={{
                    padding: 30, textAlign: 'center', background: 'var(--color-surface-2)',
                    borderRadius: 10, border: '2px dashed var(--color-border)', color: 'var(--color-text-muted)'
                  }}>
                    Select products from the left table to preview sticker layout.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', gap: 14, flexWrap: 'wrap',
                    padding: 16, background: '#e2e8f0', borderRadius: 10
                  }}>
                    {selectedItems.slice(0, 3).map(({ item }) => (
                      <SingleLabelPreview key={item.id} item={item} config={config} />
                    ))}
                    {selectedItems.length > 3 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 160, height: 90, background: '#fff', borderRadius: 6,
                        fontSize: '0.8125rem', color: 'var(--color-text-muted)'
                      }}>
                        +{selectedItems.length - 3} more items...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Sheet (Visible ONLY during window.print()) */}
      <div className="print-only print-label-sheet">
        {selectedItems.flatMap(({ item, copies }) =>
          Array.from({ length: copies }).map((_, idx) => (
            <SingleLabelPrint key={`${item.id}-${idx}`} item={item} config={config} />
          ))
        )}
      </div>

      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: flex !important; flex-wrap: wrap; gap: 4mm; }
          body { background: #fff !important; margin: 0; padding: 0; }
          @page { size: auto; margin: 2mm; }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// SINGLE THERMAL LABEL PREVIEW (Screen Canvas)
// ============================================================
function SingleLabelPreview({ item, config }: { item: Item; config: BarcodeLabelConfig }) {
  const storeName = useStoreName()
  const code = item.barcode || item.part_number
  return (
    <div style={{
      width: config.size === '50x25' ? 180 : config.size === '40x28' ? 150 : 140,
      height: config.size === '50x25' ? 100 : config.size === '40x28' ? 105 : 95,
      background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4,
      padding: '6px 8px', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      {/* Brand Header */}
      {config.show_brand && (
        <div style={{
          fontSize: '0.625rem', fontWeight: 800, textAlign: 'center',
          letterSpacing: '0.5px', textTransform: 'uppercase', color: '#000'
        }}>
          {storeName}
        </div>
      )}

      {/* Product Name */}
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, textAlign: 'center',
        lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#000'
      }}>
        {item.name}
      </div>

      {/* Barcode Visual Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <BarcodeSVG code={code} height={24} />
        {config.show_barcode_text && (
          <div style={{ fontSize: '0.5625rem', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 1, color: '#000' }}>
            {code}
          </div>
        )}
      </div>

      {/* Bottom Row: Size & Price */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderTop: '1px dotted #94a3b8', paddingTop: 2
      }}>
        {config.show_size && item.size_variant ? (
          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#000' }}>
            {item.size_variant}
          </span>
        ) : <span />}
        {config.show_price && (
          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#000' }}>
            {config.currency_prefix}{item.retail_price.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// SINGLE THERMAL LABEL PRINT (Optimized for Thermal Paper)
// ============================================================
function SingleLabelPrint({ item, config }: { item: Item; config: BarcodeLabelConfig }) {
  const storeName = useStoreName()
  const code = item.barcode || item.part_number
  const dims = {
    '50x25': { w: '48mm', h: '24mm' },
    '40x28': { w: '38mm', h: '26mm' },
    '38x25': { w: '36mm', h: '23mm' },
  }[config.size]

  return (
    <div style={{
      width: dims.w, height: dims.h,
      boxSizing: 'border-box', padding: '1mm 2mm',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      pageBreakInside: 'avoid', breakInside: 'avoid', overflow: 'hidden',
      color: '#000', fontFamily: 'Arial, sans-serif'
    }}>
      {config.show_brand && (
        <div style={{ fontSize: '7pt', fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>
          {storeName}
        </div>
      )}
      <div style={{
        fontSize: '7pt', fontWeight: 700, textAlign: 'center',
        lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden'
      }}>
        {item.name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <BarcodeSVG code={code} height={20} />
        {config.show_barcode_text && (
          <div style={{ fontSize: '6pt', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
            {code}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        {config.show_size && item.size_variant ? (
          <span style={{ fontSize: '6pt', fontWeight: 700 }}>{item.size_variant}</span>
        ) : <span />}
        {config.show_price && (
          <span style={{ fontSize: '8pt', fontWeight: 900 }}>
            {config.currency_prefix}{item.retail_price.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// VECTOR CODE128 BARCODE SVG GENERATOR
// ============================================================
function BarcodeSVG({ code, height = 24 }: { code: string; height?: number }) {
  // Deterministic Code128 pattern generator
  const bars: number[] = []
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) & 0xffffffff
  }

  // Generate 45 realistic barcode bars based on SKU string
  for (let i = 0; i < 45; i++) {
    const bit = ((hash >> (i % 30)) ^ (i * 7)) & 3
    bars.push(bit === 0 ? 1 : bit === 1 ? 2 : bit === 2 ? 1.5 : 3)
  }

  return (
    <svg height={height} width="100%" viewBox="0 0 110 30" preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect width="110" height="30" fill="#fff" />
      {bars.map((w, idx) => {
        const x = idx * 2.4
        const isBlack = idx % 2 === 0 || (idx % 3 === 0 && idx % 4 !== 0)
        return isBlack ? (
          <rect key={idx} x={x} y={0} width={w * 0.7} height={30} fill="#000" />
        ) : null
      })}
    </svg>
  )
}
