import type { ToastType } from '../store/toast.store';
import { toast } from '../hooks/useToast';

/** Customer-facing transaction toast duration (ms). */
export const CUSTOMER_TOAST_DURATION_MS = 5_000;

/**
 * Internal ledger / lifecycle events kept in notification history but not shown as popups.
 * User sees one toast per meaningful transaction phase instead.
 */
const SUPPRESSED_POPUP_TITLES = new Set([
  'transaksi dibuat',
  'saldo berkurang',
  'saldo bertambah',
]);

/** Backend / UI notification shapes that should surface as dashboard toasts. */
export function mapNotificationToToastType(rawType: unknown, title?: string): ToastType | null {
  const type = String(rawType || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (
    type.includes('transaction_success') ||
    type === 'success' ||
    t.includes('pembayaran berhasil') ||
    t.includes('transaksi berhasil')
  ) {
    return 'success';
  }

  if (
    type.includes('transaction_failed') ||
    type.includes('transaction_timeout') ||
    type === 'error' ||
    t.includes('transaksi gagal') ||
    t.includes('pembayaran gagal') ||
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
    return 'warning';
  }

  if (type === 'promo') {
    return null;
  }

  return null;
}

export function extractTransactionInvoice(title?: string, message?: string): string | null {
  const hay = `${title ?? ''} ${message ?? ''}`;
  const match = hay.match(/#?(GRK-\d{8}-\d{6})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Collapse transaction notifications to one popup phase per invoice:
 * processing → success | failed (refund folded into failed copy).
 */
export function transactionToastPhase(title?: string, type?: string): 'processing' | 'success' | 'failed' | null {
  const t = String(title || '').toLowerCase();
  const rawType = String(type || '').toLowerCase();

  if (t.includes('diproses') || t.includes('menunggu')) {
    return 'processing';
  }
  if (
    t.includes('pembayaran berhasil') ||
    t.includes('transaksi berhasil') ||
    rawType.includes('transaction_success')
  ) {
    return 'success';
  }
  if (
    t.includes('transaksi gagal') ||
    t.includes('transaksi timeout') ||
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
  isRead?: boolean;
  is_read?: boolean;
}): boolean {
  const isRead = Boolean(n.isRead ?? n.is_read);
  if (isRead) return false;

  const title = String(n.title || 'Notifikasi');
  if (shouldSuppressTransactionPopup(title)) {
    return false;
  }

  const phase = transactionToastPhase(title, n.type);
  const toastType = mapNotificationToToastType(n.type, title);
  if (!toastType && !phase) return false;

  const invoice = extractTransactionInvoice(title, n.message);
  const sourceId = invoice && phase
    ? buildTransactionToastSourceId(invoice, phase)
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
