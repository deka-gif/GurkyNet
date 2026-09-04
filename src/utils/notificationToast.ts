import type { ToastType } from '../store/toast.store';
import { toast } from '../hooks/useToast';

/** Customer-facing transaction toast duration (ms). */
export const CUSTOMER_TOAST_DURATION_MS = 5_000;

/**
 * Internal ledger / lifecycle events kept in notification history but not shown as popups.
 * Top Up intermediate statuses are history-only (FR-TOPUP-UX-01).
 */
const SUPPRESSED_POPUP_TITLES = new Set([
  'transaksi dibuat',
  'saldo berkurang',
  'saldo bertambah',
  'menunggu pembayaran',
  'pembayaran diproses',
  'transaksi diproses',
]);

/** Backend / UI notification shapes that should surface as dashboard toasts. */
export function mapNotificationToToastType(rawType: unknown, title?: string): ToastType | null {
  const type = String(rawType || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (
    type.includes('transaction_success') ||
    type === 'success' ||
    t.includes('pembayaran berhasil') ||
    t.includes('transaksi berhasil') ||
    t.includes('top up berhasil')
  ) {
    return 'success';
  }

  if (
    type.includes('transaction_failed') ||
    type.includes('transaction_timeout') ||
    type === 'error' ||
    t.includes('transaksi gagal') ||
    t.includes('pembayaran gagal') ||
    t.includes('top up gagal') ||
    t.includes('pembayaran kedaluwarsa') ||
    t.includes('transaksi timeout')
  ) {
    return 'error';
  }

  if (t.includes('refund berhasil')) {
    return 'error';
  }

  if (
    type === 'warning' ||
    t.includes('menunggu') ||
    t.includes('diproses')
  ) {
    // Intermediate Top Up / PPOB phases — suppressed via shouldSuppressTransactionPopup.
    return 'warning';
  }

  if (type === 'promo') {
    return null;
  }

  return null;
}

export function extractTransactionInvoice(title?: string, message?: string): string | null {
  const hay = `${title ?? ''} ${message ?? ''}`;
  const match = hay.match(/#?(GRK-\d{8}-\d{6}|TRX-TOPUP-\d{14}-\d{4})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Collapse transaction notifications to one popup phase per invoice:
 * success | failed (processing/pending suppressed for Top Up UX).
 */
export function transactionToastPhase(title?: string, type?: string): 'processing' | 'success' | 'failed' | null {
  const t = String(title || '').toLowerCase();
  const rawType = String(type || '').toLowerCase();

  if (
    t.includes('menunggu pembayaran') ||
    t.includes('pembayaran diproses')
  ) {
    return null;
  }

  if (t.includes('diproses') || t.includes('menunggu')) {
    return 'processing';
  }
  if (
    t.includes('pembayaran berhasil') ||
    t.includes('transaksi berhasil') ||
    t.includes('top up berhasil') ||
    rawType.includes('transaction_success')
  ) {
    return 'success';
  }
  if (
    t.includes('transaksi gagal') ||
    t.includes('transaksi timeout') ||
    t.includes('top up gagal') ||
    t.includes('pembayaran kedaluwarsa') ||
    t.includes('pembayaran gagal') ||
    t.includes('refund berhasil') ||
    rawType.includes('transaction_failed') ||
    rawType.includes('transaction_timeout')
  ) {
    return 'failed';
  }

  return null;
}

export function shouldSuppressTransactionPopup(title?: string): boolean {
  return SUPPRESSED_POPUP_TITLES.has(String(title || '').trim().toLowerCase());
}

export function buildTransactionToastSourceId(
  invoice: string,
  phase: 'processing' | 'success' | 'failed'
): string {
  return `tx-toast:${invoice}:${phase}`;
}

export function normalizeTransactionToastCopy(
  title: string,
  message?: string,
  phase?: 'processing' | 'success' | 'failed' | null
): { title: string; description?: string } {
  const lower = title.toLowerCase();

  if (lower.includes('top up berhasil')) {
    return { title: 'Top Up Berhasil', description: message };
  }
  if (lower.includes('top up gagal')) {
    return { title: 'Top Up Gagal', description: message };
  }
  if (lower.includes('pembayaran kedaluwarsa')) {
    return { title: 'Pembayaran Kedaluwarsa', description: message };
  }

  if (phase === 'processing') {
    const invoice = extractTransactionInvoice(title, message);
    return {
      title: 'Transaksi Diproses',
      description: invoice
        ? `Transaksi ${invoice} sedang diproses.`
        : message || 'Transaksi Anda sedang diproses.',
    };
  }
  if (phase === 'success') {
    return {
      title: 'Transaksi Berhasil',
      description: message || 'Pembelian berhasil diproses.',
    };
  }
  if (phase === 'failed') {
    const refundHint = /dikembalikan|refund/i.test(`${title} ${message ?? ''}`);
    return {
      title: 'Transaksi Gagal',
      description: refundHint
        ? message || 'Transaksi gagal dan saldo telah dikembalikan.'
        : message || 'Transaksi gagal diproses.',
    };
  }
  return { title, description: message };
}

/**
 * @returns true when a toast was enqueued
 */
export function enqueueNotificationToast(n: {
  id?: string | number;
  title?: string;
  message?: string;
  type?: string;
  rawType?: string;
  isRead?: boolean;
  is_read?: boolean;
  transactionId?: string | number | null;
  invoiceNumber?: string | null;
}): boolean {
  const isRead = Boolean(n.isRead ?? n.is_read);
  if (isRead) return false;

  const title = String(n.title || 'Notifikasi');
  if (shouldSuppressTransactionPopup(title)) {
    return false;
  }

  const typeForMap = n.rawType || n.type;
  const phase = transactionToastPhase(title, typeForMap);
  const toastType = mapNotificationToToastType(typeForMap, title);
  if (!toastType && !phase) return false;

  const invoice =
    (n.invoiceNumber ? String(n.invoiceNumber) : null) ||
    extractTransactionInvoice(title, n.message);
  const sourceId = invoice && phase
    ? buildTransactionToastSourceId(invoice, phase)
    : n.transactionId != null && phase
      ? `tx-toast:id:${n.transactionId}:${phase}`
      : n.id != null
        ? `notification:${n.id}`
        : undefined;

  const copy = normalizeTransactionToastCopy(title, n.message, phase);

  toast({
    type: toastType ?? (phase === 'processing' ? 'warning' : 'info'),
    title: copy.title,
    description: copy.description,
    sourceId,
    durationMs: CUSTOMER_TOAST_DURATION_MS,
  });

  return true;
}
