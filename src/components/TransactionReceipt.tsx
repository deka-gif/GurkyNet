import { useState } from 'react';
import {
  Check,
  Clock,
  AlertTriangle,
  Download,
  Share2,
  Printer,
  Copy,
  QrCode,
  X,
  RefreshCw,
} from 'lucide-react';
import { formatIDR } from '../utils/currency';

export type ReceiptStatus = 'success' | 'pending' | 'failed';

export interface ReceiptExtraRow {
  label: string;
  value: string;
}

export interface ReceiptDeliverable {
  label: string;
  value: string;
  url?: string | null;
  copyValue: string;
}

export interface TransactionReceiptProps {
  status: ReceiptStatus;
  /** Customer-friendly failure reason (FAILED only). */
  failureMessage?: string | null;
  /** Optional override for the PENDING hero description. */
  pendingMessage?: string | null;
  companyName?: string | null;
  invoiceNumber?: string | null;
  /** ISO date string or anything `new Date()` can parse. */
  date?: string | null;
  serialNumber?: string | null;
  category?: string | null;
  productName?: string | null;
  targetLabel?: string | null;
  targetValue?: string | null;
  /** Already sanitized for customer display — never pass a raw gateway id like "midtrans". */
  paymentMethodLabel?: string | null;
  price?: number | null;
  adminFee?: number | null;
  totalPayment?: number | null;
  extraRows?: ReceiptExtraRow[];
  deliverable?: ReceiptDeliverable | null;
  /** Set when status is success but the provider hasn't returned the code yet, e.g. "Kode token". */
  deliverablePendingLabel?: string | null;
  qrCodeUrl?: string | null;
  /** True while the detailed receipt payload is still being fetched. */
  loading?: boolean;
  footerNote?: string | null;
  /** Only rendered when provided — no real backend PDF to fetch yet (e.g. pre-validation failure). */
  onDownloadPdf?: () => void;
  /** Defaults to a Web Share / clipboard fallback built from the fields above. */
  onShare?: () => void;
  /** Defaults to window.print(). */
  onPrint?: () => void;
  /** Small dismiss (×) in the top-right corner. Omit to hide it. */
  onClose?: () => void;
  onDone: () => void;
  doneLabel?: string;
  className?: string;
}

const DEFAULT_FOOTER_NOTE =
  'Terima kasih telah menggunakan layanan GurkyPay. Simpan struk ini sebagai bukti transaksi yang sah.';

/** Even tooth count keeps both outer corners flush (clean vertical sides). */
const ZIGZAG_TEETH = 18;
const ZIGZAG_DEPTH = 7;

function buildZigzagClipPath(): string {
  const step = 100 / ZIGZAG_TEETH;
  const points: string[] = [];
  for (let i = 0; i <= ZIGZAG_TEETH; i++) {
    const x = i * step;
    const y = i % 2 === 0 ? 0 : ZIGZAG_DEPTH;
    points.push(`${x}% ${y}px`);
  }
  for (let i = ZIGZAG_TEETH; i >= 0; i--) {
    const x = i * step;
    const y = i % 2 === 0 ? 0 : ZIGZAG_DEPTH;
    points.push(`${x}% calc(100% - ${y}px)`);
  }
  return `polygon(${points.join(', ')})`;
}

const ZIGZAG_CLIP_PATH = buildZigzagClipPath();

function Row({ label, value, mono, bold, highlight }: { label: string; value: string; mono?: boolean; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span
        className={`text-right ${mono ? 'font-mono text-xs' : 'text-sm'} ${bold ? 'font-black' : 'font-semibold'} ${
          highlight ? 'text-primary-700' : 'text-slate-900'
        } break-words`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * FR-RECEIPT-UI-01 — single reusable "struk" (paper receipt) view used for every
 * GurkyNet transaction result: fresh checkout, Top Up, and history lookups alike.
 * Purely presentational — callers supply already-resolved, customer-facing data.
 */
export function TransactionReceipt({
  status,
  failureMessage,
  pendingMessage,
  companyName = 'GurkyNet',
  invoiceNumber,
  date,
  serialNumber,
  category,
  productName,
  targetLabel = 'Nomor Tujuan',
  targetValue,
  paymentMethodLabel,
  price,
  adminFee,
  totalPayment,
  extraRows = [],
  deliverable,
  deliverablePendingLabel,
  qrCodeUrl,
  loading,
  footerNote,
  onDownloadPdf,
  onShare,
  onPrint,
  onClose,
  onDone,
  doneLabel = 'Selesai & Kembali',
  className,
}: TransactionReceiptProps) {
  const [copied, setCopied] = useState(false);
  const [shareFallbackMsg, setShareFallbackMsg] = useState<string | null>(null);

  const formattedDate = (() => {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  })();

  const handleCopyDeliverable = async () => {
    if (!deliverable?.copyValue) return;
    try {
      await navigator.clipboard.writeText(deliverable.copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable — silently ignore, value is still visible on the receipt
    }
  };

  const handlePrint = () => {
    if (onPrint) return onPrint();
    window.print();
  };

  const handleShare = () => {
    if (onShare) return onShare();
    const lines = [
      `Struk ${companyName || 'GurkyNet'}`,
      invoiceNumber ? `Invoice: ${invoiceNumber}` : null,
      productName ? `Produk: ${productName}` : null,
      totalPayment != null ? `Total: ${formatIDR(totalPayment)}` : null,
      `Status: ${status === 'success' ? 'Berhasil' : status === 'pending' ? 'Tertunda' : 'Gagal'}`,
    ].filter(Boolean) as string[];
    const shareText = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: `Struk ${companyName || 'GurkyNet'}`, text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        setShareFallbackMsg('Detail struk disalin ke papan klip!');
        window.setTimeout(() => setShareFallbackMsg(null), 3000);
      }).catch(() => {});
    }
  };

  return (
    <div className={`mx-auto w-full max-w-[380px] ${className || ''}`}>
      <style>{`
        @media print {
          /* Print only the receipt subtree, regardless of how deep it's mounted in the DOM
             (visibility — unlike display — lets a descendant re-assert itself over a hidden ancestor). */
          body * { visibility: hidden; }
          .gn-receipt-print-root, .gn-receipt-print-root * { visibility: visible; }
          .gn-receipt-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            filter: none !important;
          }
          .gn-receipt-no-print { display: none !important; }
        }
      `}</style>

      <div
        className="gn-receipt-print-root"
        style={{ filter: 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.14)) drop-shadow(0 3px 8px rgba(15, 23, 42, 0.08))' }}
      >
        <div className="relative bg-white" style={{ clipPath: ZIGZAG_CLIP_PATH }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="gn-receipt-no-print absolute right-3 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="space-y-5 px-6 pb-6 pt-5">
            {/* Header */}
            <div className="text-center">
              <h3 className="text-base font-black tracking-tight text-slate-900">{companyName || 'GurkyNet'}</h3>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Bukti Pembayaran Resmi
              </p>
            </div>

            {/* Status hero */}
            <div className="space-y-2.5 border-b border-dashed border-slate-200 pb-5 text-center">
              {status === 'success' && (
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
                    <Check className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-emerald-950">Transaksi Berhasil!</h4>
                    <p className="mt-0.5 text-xs font-medium text-emerald-700">
                      Pembayaran Anda telah sukses diverifikasi oleh provider.
                    </p>
                  </div>
                </>
              )}
              {status === 'pending' && (
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-inner">
                    <Clock className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-amber-950">Transaksi Tertunda (Pending)</h4>
                    <p className="mt-0.5 text-xs font-medium text-amber-700">
                      {pendingMessage ||
                        'Transaksi Anda sedang diproses. Struk ini akan diperbarui otomatis begitu status berubah.'}
                    </p>
                  </div>
                </>
              )}
              {status === 'failed' && (
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 shadow-inner">
                    <AlertTriangle className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-red-950">Transaksi Gagal</h4>
                    <p className="mt-0.5 text-xs font-medium text-red-700">
                      {failureMessage || 'Transaksi tidak dapat diproses. Saldo Anda tidak berubah.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Fields */}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
                <span className="text-xs font-bold">Membuat struk resmi...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {invoiceNumber && <Row label="Nomor Invoice" value={invoiceNumber} mono />}
                {formattedDate && <Row label="Tanggal" value={formattedDate} />}
                {serialNumber && <Row label="Serial Number (SN)" value={serialNumber} mono />}
                {category && <Row label="Kategori" value={category} />}
                {productName && <Row label="Produk" value={productName} />}
                {targetValue && <Row label={targetLabel || 'Nomor Tujuan'} value={targetValue} mono />}
                {extraRows.map((row, idx) => (
                  <Row key={`${row.label}-${idx}`} label={row.label} value={row.value} />
                ))}
                {paymentMethodLabel && <Row label="Metode Pembayaran" value={paymentMethodLabel} highlight />}

                {(price != null || adminFee != null || totalPayment != null) && (
                  <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
                    {price != null && <Row label="Harga" value={formatIDR(price)} />}
                    {adminFee != null && <Row label="Admin" value={formatIDR(adminFee)} />}
                    {totalPayment != null && (
                      <div className="flex items-center justify-between border-t border-dashed border-slate-100 pt-2">
                        <span className="text-xs font-black uppercase text-slate-900">Total Bayar</span>
                        <span className="text-lg font-black text-primary-600">{formatIDR(totalPayment)}</span>
                      </div>
                    )}
                  </div>
                )}

                {deliverable && (
                  <div className="space-y-2.5 border-t border-dashed border-slate-200 pt-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {deliverable.label}
                    </p>
                    <p className="break-all text-lg font-black leading-snug tracking-wide text-slate-950">
                      {deliverable.value}
                    </p>
                    {deliverable.url && (
                      <a
                        href={deliverable.url}
                        target="_blank"
                        rel="noreferrer"
                        className="gn-receipt-no-print block break-all text-[11px] font-bold text-primary-600 underline"
                      >
                        Buka Link
                      </a>
                    )}
                    {deliverable.copyValue && (
                      <button
                        type="button"
                        onClick={() => void handleCopyDeliverable()}
                        className="gn-receipt-no-print inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-xs font-extrabold text-white hover:bg-primary-700"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Tersalin' : 'Salin Kode'}
                      </button>
                    )}
                  </div>
                )}

                {!deliverable && deliverablePendingLabel && (
                  <p className="border-t border-dashed border-slate-200 pt-3 text-center text-[11px] font-medium text-slate-500">
                    {deliverablePendingLabel} sedang diproses oleh provider. Struk akan diperbarui otomatis.
                  </p>
                )}

                {qrCodeUrl && (
                  <div className="flex flex-col items-center gap-2 border-t border-dashed border-slate-200 pt-5 text-center">
                    <div className="rounded-xl border border-slate-150 bg-white p-2">
                      <img src={qrCodeUrl} alt="QR verifikasi GurkyPay" className="h-20 w-20 object-contain" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GURKYPAY</p>
                    <p className="max-w-[220px] text-[10px] font-medium leading-normal text-slate-400">
                      Scan untuk verifikasi atau cek transaksi
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer note */}
            <p className="border-t border-dashed border-slate-200 pt-4 text-center text-[10px] font-medium leading-relaxed text-slate-400">
              {footerNote || DEFAULT_FOOTER_NOTE}
            </p>

            {/* Actions */}
            <div className="gn-receipt-no-print space-y-2.5 pt-1">
              {shareFallbackMsg && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-center text-xs font-bold text-emerald-600">
                  {shareFallbackMsg}
                </div>
              )}
              <div className={`grid gap-2 ${onDownloadPdf ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 shadow-sm hover:border-slate-300"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    Download PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 shadow-sm hover:border-slate-300"
                >
                  <Share2 className="h-4 w-4 text-slate-500" />
                  Bagikan
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 shadow-sm hover:border-slate-300"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  Cetak
                </button>
              </div>
              <button
                type="button"
                onClick={onDone}
                className="w-full rounded-xl bg-primary-600 py-3 text-xs font-extrabold text-white shadow-md shadow-primary-600/10 hover:bg-primary-700"
              >
                {doneLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransactionReceipt;

/** Kept for callers using the icon in adjacent UI (e.g. an empty-state hint). */
export { QrCode as ReceiptQrIcon };
