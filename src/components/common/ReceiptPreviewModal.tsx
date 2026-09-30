import React, { useState, useEffect } from 'react'
import { Printer, CheckCircle, FileText, Minus, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import defaultInvoiceLogo from '../../assets/invoice_logo.png'
import defaultWhatsAppQR from '../../assets/whatsapp_qr.png'
import { CartItem, Customer, InvoiceItem } from '../../types'

export interface ReceiptPreviewModalProps {
  invoiceNumber: string
  total: number
  subtotal?: number
  discountAmount?: number
  change?: number
  items?: CartItem[]
  historyItems?: InvoiceItem[]
  customer?: Customer | { name: string; phone?: string; whatsapp?: string } | null
  customerName?: string
  customerPhone?: string
  userName?: string
  staffName?: string
  paymentMethod: string
  paymentDetails?: string
  amountPaid?: number
  balanceDue?: number
  dateStr?: string
  timeStr?: string
  status?: string
  onClose: () => void
  onDoneNewSale?: () => void
}

export function ReceiptPreviewModal({
  invoiceNumber,
  total,
  subtotal,
  discountAmount,
  change,
  items,
  historyItems,
  customer,
  customerName,
  customerPhone,
  userName,
  staffName,
  paymentMethod,
  paymentDetails,
  amountPaid,
  balanceDue,
  dateStr,
  timeStr,
  status,
  onClose,
  onDoneNewSale
}: ReceiptPreviewModalProps) {
  const today = dateStr || new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  const time  = timeStr || new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm' | 'a4'>('80mm')
  const [zoom, setZoom] = useState<number>(100)
  const [printers, setPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    if (window.api && typeof window.api.getAllSettings === 'function') {
      window.api.getAllSettings().then(s => setSettings(s as unknown as Record<string, string>)).catch(() => {})
    }
    if (window.api && typeof window.api.getPrinters === 'function') {
      window.api.getPrinters().then(pList => {
        if (pList && pList.length > 0) {
          setPrinters(pList)
          const def = pList.find(p => p.isDefault)
          if (def) setSelectedPrinter(def.name)
        }
      }).catch(() => {})
    }
  }, [])

  const handleNativePrint = async () => {
    setIsPrinting(true)
    try {
      if (window.api && typeof window.api.print === 'function') {
        const res = await window.api.print({
          silent: false,
          printBackground: true,
          deviceName: selectedPrinter || undefined,
          pageSize: paperSize === 'a4' ? 'A4' : undefined
        })
        if (!res.success && res.error && !res.error.toLowerCase().includes('cancel')) {
          toast.error(`Print warning: ${res.error}`)
        }
      } else {
        window.print()
      }
    } catch (e) {
      console.warn('Native print error:', e)
      window.print()
    } finally {
      setIsPrinting(false)
    }
  }

  const handleSavePDF = async () => {
    if (window.api && typeof window.api.printToPDF === 'function') {
      const res = await window.api.printToPDF(`Invoice-${invoiceNumber}.pdf`)
      if (res.success && res.filePath) {
        toast.success(`Invoice saved as PDF: ${res.filePath}`)
      }
    } else {
      handleNativePrint()
    }
  }

  // Hotkey listener inside ReceiptPreviewModal: Enter for Done & New Sale, P for Print, Esc to Close
  useEffect(() => {
    const handleReceiptKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        handleNativePrint()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (onDoneNewSale) {
          onDoneNewSale()
        } else {
          onClose()
        }
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleReceiptKey)
    return () => window.removeEventListener('keydown', handleReceiptKey)
  }, [onDoneNewSale, onClose, selectedPrinter, paperSize])

  const isRefunded = status === 'refunded'
  const isVoided = status === 'voided'

  const activeLogo = settings['receipt_header_logo'] === 'none'
    ? null
    : (settings['receipt_header_logo'] || defaultInvoiceLogo)

  const companyName = settings['company_name'] || 'My Store'
  const companyAddress = settings['company_address'] || 'Wholesale Clothing, Lahore, Pakistan'
  const companyPhone = settings['company_phone']
  const whatsappNumber = settings['whatsapp_number']
  const companyNtn = settings['company_ntn']
  const returnPolicy = settings['receipt_return_policy']
  const receiptFooter = settings['receipt_footer'] || 'Thank you for your purchase!'
  const activeQR = settings['receipt_qr_image'] === 'none'
    ? null
    : (settings['receipt_qr_image'] || defaultWhatsAppQR)
  const qrLabel = settings['receipt_qr_label'] || 'JOIN OUR WHATSAPP COMMUNITY'

  const effectiveCustomerName = customerName || customer?.name || 'Walk-in Customer'
  const effectiveCustomerPhone = customerPhone || customer?.phone || customer?.whatsapp || ''
  const effectiveUserName = staffName || userName || 'Cashier'

  const rawPaid = amountPaid !== undefined ? amountPaid : total
  const rawPending = balanceDue !== undefined ? balanceDue : 0

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: paperSize === 'a4' ? 680 : 520,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ padding: '10px 16px', background: 'var(--color-surface)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="modal-title" style={{ fontSize: '1rem', fontWeight: 800 }}>
              Print Preview — {invoiceNumber}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Print Preview Options Bar */}
        <div className="no-print" style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          flexWrap: 'wrap',
          gap: 8
        }}>
          {/* Paper Size Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>Format:</span>
            <div style={{ display: 'flex', background: 'var(--color-surface)', borderRadius: 6, padding: 2, border: '1px solid var(--color-border)' }}>
              {(['80mm', '58mm', 'a4'] as const).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setPaperSize(fmt)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 4,
                    background: paperSize === fmt ? 'var(--color-primary)' : 'transparent',
                    color: paperSize === fmt ? '#fff' : 'var(--color-text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {fmt === '80mm' ? '80mm Thermal' : fmt === '58mm' ? '58mm Mini' : 'A4 Full'}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>Zoom:</span>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setZoom(z => Math.max(75, z - 10))}
              disabled={zoom <= 75}
              style={{ height: 24, width: 24, padding: 0 }}
            >
              <Minus size={12} />
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 36, textAlign: 'center' }}>
              {zoom}%
            </span>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setZoom(z => Math.min(140, z + 10))}
              disabled={zoom >= 140}
              style={{ height: 24, width: 24, padding: 0 }}
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Printer select if printers detected */}
          {printers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                className="form-input"
                value={selectedPrinter}
                onChange={e => setSelectedPrinter(e.target.value)}
                style={{ height: 26, fontSize: '0.6875rem', padding: '0 6px', maxWidth: 140 }}
                title="Select Target Printer"
              >
                <option value="">Default System Printer</option>
                {printers.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Live Visual Print Preview Container */}
        <div className="modal-body" style={{ padding: 0, background: '#0f172a' }}>
          <div className="print-preview-container">
            <div
              id="receipt-content"
              className={`print-preview-paper paper-${paperSize}`}
              style={{
                transform: `scale(${zoom / 100})`,
                fontFamily: 'var(--font-mono)'
              }}
            >
              {/* Header Logo */}
              {activeLogo && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <img
                    src={activeLogo}
                    alt="Company Logo"
                    style={{
                      maxHeight: paperSize === '58mm' ? 45 : paperSize === 'a4' ? 80 : 65,
                      maxWidth: '100%',
                      objectFit: 'contain',
                      margin: '0 auto',
                      display: 'block'
                    }}
                  />
                </div>
              )}

              {/* Refunded or Voided Watermark Banner on Receipt */}
              {isRefunded && (
                <div style={{
                  border: '2px dashed #DC2626',
                  background: '#FEF2F2',
                  padding: '8px 10px',
                  textAlign: 'center',
                  marginBottom: 10,
                  borderRadius: 4
                }}>
                  <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
                    *** REFUNDED INVOICE ***
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#991B1B', marginTop: 2, fontWeight: 700 }}>
                    RETURNED & REFUNDED · NOT VALID FOR PAYMENT OR RE-EXCHANGE
                  </div>
                </div>
              )}

              {isVoided && (
                <div style={{
                  border: '2px dashed #DC2626',
                  background: '#FEF2F2',
                  padding: '8px 10px',
                  textAlign: 'center',
                  marginBottom: 10,
                  borderRadius: 4
                }}>
                  <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
                    *** VOIDED INVOICE ***
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#991B1B', marginTop: 2, fontWeight: 700 }}>
                    TRANSACTION CANCELLED & VOIDED
                  </div>
                </div>
              )}

              {/* Shop Header Details */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 900, fontSize: paperSize === 'a4' ? '1.3rem' : '1.05rem', color: '#111' }}>
                  {companyName}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#444', marginTop: 2 }}>{companyAddress}</div>
                {companyPhone && <div style={{ fontSize: '0.6875rem', color: '#444' }}>Tel: {companyPhone}</div>}
                {whatsappNumber && <div style={{ fontSize: '0.6875rem', color: '#444' }}>WhatsApp: {whatsappNumber}</div>}
                {companyNtn && <div style={{ fontSize: '0.6875rem', color: '#444' }}>NTN #: {companyNtn}</div>}
              </div>

              {/* Invoice & Metadata Section */}
              <div style={{
                margin: '6px 0',
                borderTop: '1px dashed #444',
                borderBottom: '1px dashed #444',
                padding: '6px 0',
                fontSize: paperSize === '58mm' ? '0.625rem' : '0.6875rem',
                lineHeight: 1.45,
                color: '#111'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Date: <strong>{today}</strong></span>
                  <span>Time: <strong>{time}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span>Invoice #: <strong>{invoiceNumber}</strong></span>
                  <span>User: <strong>{effectiveUserName}</strong></span>
                </div>
                <div style={{ marginTop: 3, paddingTop: 3, borderTop: '1px dotted #ccc', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <span>Customer: <strong>{effectiveCustomerName}</strong></span>
                  {effectiveCustomerPhone ? (
                    <span>Customer #: <strong>{effectiveCustomerPhone}</strong></span>
                  ) : null}
                </div>
              </div>

              {/* Items Table Headers: Sr#, Item Name, Qty, Rate, Amount */}
              <div style={{
                borderBottom: '1px solid #111',
                paddingBottom: 4,
                marginTop: 6,
                fontSize: paperSize === '58mm' ? '0.59375rem' : '0.6875rem',
                fontWeight: 900,
                color: '#111'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: paperSize === '58mm'
                    ? '18px 1fr 24px 44px 50px'
                    : paperSize === 'a4'
                      ? '35px 1fr 60px 100px 110px'
                      : '22px 1fr 30px 52px 64px',
                  alignItems: 'center'
                }}>
                  <span>#</span>
                  <span>Item Name</span>
                  <span style={{ textAlign: 'center' }}>Qty</span>
                  <span style={{ textAlign: 'right' }}>Rate</span>
                  <span style={{ textAlign: 'right' }}>Amount</span>
                </div>
              </div>

              {/* Itemized Rows */}
              <div style={{
                borderBottom: '1px dashed #444',
                padding: '4px 0 6px 0',
                marginBottom: 6,
                fontSize: paperSize === '58mm' ? '0.59375rem' : '0.6875rem',
                color: '#111'
              }}>
                {historyItems && historyItems.length > 0 ? (
                  historyItems.map((item, i) => (
                    <div
                      key={item.id || i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: paperSize === '58mm'
                          ? '18px 1fr 24px 44px 50px'
                          : paperSize === 'a4'
                            ? '35px 1fr 60px 100px 110px'
                            : '22px 1fr 30px 52px 64px',
                        alignItems: 'flex-start',
                        padding: '3px 0'
                      }}
                    >
                      <span style={{ color: '#666', fontWeight: 600 }}>{i + 1}</span>
                      <div style={{ overflow: 'hidden', paddingRight: 4 }}>
                        <div style={{ fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.25 }}>
                          {item.item_name || 'Item'}
                        </div>
                        {item.part_number && (
                          <div style={{ fontSize: '0.5625rem', color: '#666' }}>{item.part_number}</div>
                        )}
                        {item.discount_pct > 0 && (
                          <div style={{ fontSize: '0.5625rem', color: '#DC2626', fontWeight: 600 }}>
                            Disc: -{item.discount_pct}%
                          </div>
                        )}
                      </div>
                      <span style={{ textAlign: 'center', fontWeight: 800 }}>{item.qty}</span>
                      <span style={{ textAlign: 'right' }}>{item.unit_price.toLocaleString()}</span>
                      <span style={{ textAlign: 'right', fontWeight: 800 }}>{item.line_total.toLocaleString()}</span>
                    </div>
                  ))
                ) : items && items.length > 0 ? (
                  items.map((item, i) => {
                    const itemName = item.item?.name || 'Item'
                    const partNo = item.item?.part_number
                    const rate = item.unit_price ?? item.item?.retail_price ?? 0
                    const lineTot = item.line_total ?? (rate * item.qty)
                    const disc = item.discount_pct || 0

                    return (
                      <div
                        key={item.id || i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: paperSize === '58mm'
                            ? '18px 1fr 24px 44px 50px'
                            : paperSize === 'a4'
                              ? '35px 1fr 60px 100px 110px'
                              : '22px 1fr 30px 52px 64px',
                          alignItems: 'flex-start',
                          padding: '3px 0'
                        }}
                      >
                        <span style={{ color: '#666', fontWeight: 600 }}>{i + 1}</span>
                        <div style={{ overflow: 'hidden', paddingRight: 4 }}>
                          <div style={{ fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.25 }}>
                            {itemName}
                          </div>
                          {partNo && (
                            <div style={{ fontSize: '0.5625rem', color: '#666' }}>{partNo}</div>
                          )}
                          {disc > 0 && (
                            <div style={{ fontSize: '0.5625rem', color: '#DC2626', fontWeight: 600 }}>
                              Disc: -{disc}%
                            </div>
                          )}
                        </div>
                        <span style={{ textAlign: 'center', fontWeight: 800 }}>{item.qty}</span>
                        <span style={{ textAlign: 'right' }}>{rate.toLocaleString()}</span>
                        <span style={{ textAlign: 'right', fontWeight: 800 }}>{lineTot.toLocaleString()}</span>
                      </div>
                    )
                  })
                ) : null}
              </div>

              {/* Financial Totals Breakdown */}
              <div style={{
                fontSize: paperSize === '58mm' ? '0.65625rem' : '0.75rem',
                lineHeight: 1.5,
                color: '#111'
              }}>
                {discountAmount && discountAmount > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                      <span>Subtotal:</span>
                      <span>Rs. {((subtotal || total + discountAmount)).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontWeight: 600 }}>
                      <span>Discount:</span>
                      <span>- Rs. {discountAmount.toLocaleString()}</span>
                    </div>
                  </>
                ) : null}

                {/* Grand Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 900,
                  fontSize: paperSize === 'a4' ? '1.25rem' : paperSize === '58mm' ? '0.9375rem' : '1.05rem',
                  borderTop: '1px solid #111',
                  borderBottom: '1px solid #111',
                  padding: '4px 0',
                  margin: '4px 0'
                }}>
                  <span>TOTAL RS:</span>
                  {isRefunded ? (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8125rem', marginRight: 6 }}>
                        Rs. {total.toLocaleString()}
                      </span>
                      <span style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.875rem' }}>
                        (REFUNDED)
                      </span>
                    </div>
                  ) : isVoided ? (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8125rem', marginRight: 6 }}>
                        Rs. {total.toLocaleString()}
                      </span>
                      <span style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.875rem' }}>
                        (VOIDED)
                      </span>
                    </div>
                  ) : (
                    <span>Rs. {total.toLocaleString()}</span>
                  )}
                </div>

                {/* Paid Amount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#15803d' }}>
                  <span>PAID:</span>
                  <span>Rs. {rawPaid.toLocaleString()}</span>
                </div>

                {/* Pending Balance */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  color: rawPending > 0 ? '#b45309' : '#555'
                }}>
                  <span>PENDING:</span>
                  <span>Rs. {rawPending.toLocaleString()}</span>
                </div>

                {/* Change if any */}
                {change && change > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#2563eb' }}>
                    <span>CHANGE:</span>
                    <span>Rs. {change.toLocaleString()}</span>
                  </div>
                ) : null}

                {/* Payment Method / Channel Details */}
                <div style={{
                  fontSize: '0.6875rem',
                  color: '#555',
                  marginTop: 4,
                  borderTop: '1px dotted #ccc',
                  paddingTop: 3
                }}>
                  Payment Mode: <strong>{paymentDetails || paymentMethod.toUpperCase()}</strong>
                </div>
              </div>

              {/* Return Policy if configured */}
              {returnPolicy && (
                <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.6875rem', color: '#666', fontStyle: 'italic', borderTop: '1px dotted #ddd', paddingTop: 6 }}>
                  {returnPolicy}
                </div>
              )}

              {/* WhatsApp Community / Custom QR Code */}
              {activeQR && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px dashed #ccc'
                }}>
                  <div style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    marginBottom: 4,
                    textAlign: 'center',
                    color: '#111'
                  }}>
                    {qrLabel}
                  </div>
                  <div style={{
                    background: '#fff',
                    padding: 4,
                    border: '1px solid #222',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={activeQR}
                      alt="WhatsApp Community QR Code"
                      style={{
                        width: paperSize === 'a4' ? 100 : (paperSize === '58mm' ? 68 : 82),
                        height: paperSize === 'a4' ? 100 : (paperSize === '58mm' ? 68 : 82),
                        objectFit: 'contain',
                        display: 'block',
                        imageRendering: 'crisp-edges'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#555', marginTop: 3, textAlign: 'center' }}>
                    Scan QR for new arrivals & wholesale deals
                  </div>
                </div>
              )}

              {/* Custom Receipt Footer message */}
              {receiptFooter && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.6875rem', color: '#777', borderTop: '1px dashed #ccc', paddingTop: 6 }}>
                  {receiptFooter}
                </div>
              )}

              {/* Bottom Software Provider Signature */}
              <div style={{
                textAlign: 'center',
                marginTop: 10,
                paddingTop: 6,
                borderTop: '1px dashed #555',
                fontSize: '0.6875rem',
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: '#222'
              }}>
                Software Provided by: 03039969903
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{
          flexShrink: 0,
          padding: '10px 16px',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close <span className="hotkey" style={{ fontSize: '0.5625rem', marginLeft: 4 }}>Esc</span>
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSavePDF} title="Export as PDF file">
              <FileText size={15} /> Save PDF
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNativePrint}
              disabled={isPrinting}
              style={{ fontWeight: 700 }}
            >
              <Printer size={15} /> {isPrinting ? 'Printing...' : 'Print Receipt'}
              <span className="hotkey" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', marginLeft: 4 }}>P</span>
            </button>
            {onDoneNewSale && (
              <button className="btn btn-success" onClick={onDoneNewSale} style={{ fontWeight: 700 }}>
                <CheckCircle size={15} /> Done & New Sale
                <span className="hotkey" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', marginLeft: 4 }}>Enter</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
