import type { TransactionStatus } from '../api/types';

/** Mirror web `src/utils/transactionStatus.ts` — customer-facing normalize only. */

export type CanonicalTransactionStatus = TransactionStatus;

/** Detect wallet Top Up rows from GET /transactions (same heuristics as Web). */
export function isWalletTopUpService(
  serviceName?: string | null,
  paymentMethod?: string | null,
  invoiceOrCode?: string | null
): boolean {
  const service = String(serviceName || '').toLowerCase();
  const method = String(paymentMethod || '').toLowerCase();
  const invoice = String(invoiceOrCode || '').toUpperCase();

  return (
    method === 'midtrans' ||
    service.includes('top up') ||
    service.includes('topup') ||
    invoice.startsWith('TRX-TOPUP-')
  );
}

export function normalizeTransactionStatus(raw: unknown): CanonicalTransactionStatus {
  const status = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (status === 'success' || status === 'sukses' || status === 'ok' || status === 'berhasil') {
    return 'success';
  }
  if (status === 'refunded') return 'refunded';
  if (status === 'expired') return 'expired';
  if (status === 'failed' || status === 'gagal' || status === 'error' || status === 'fail') {
    return 'failed';
  }
  if (status === 'cancelled' || status === 'canceled' || status === 'batal' || status === 'cancel') {
    return 'cancelled';
  }
  if (status === 'processing') return 'processing';
  if (
    status === 'initiated' ||
    status === 'locked' ||
    status === 'sent_to_supplier' ||
    status === 'pending_supplier'
  ) {
    return 'pending';
  }
  return 'pending';
}

export function isPendingStatus(raw: unknown): boolean {
  const s = normalizeTransactionStatus(raw);
  return s === 'pending' || s === 'processing';
}

/**
 * Customer-facing history label.
 * Top Up unpaid → "Belum Dibayar" (not generic Tertunda).
 */
export function historyStatusLabel(
  status: unknown,
  opts?: {
    serviceName?: string | null;
    paymentMethod?: string | null;
    transactionCode?: string | null;
  }
): string {
  const topUp = isWalletTopUpService(
    opts?.serviceName,
    opts?.paymentMethod,
    opts?.transactionCode
  );
  const canonical = normalizeTransactionStatus(status);

  if (topUp) {
    switch (canonical) {
      case 'pending':
      case 'processing':
        return 'Belum Dibayar';
      case 'success':
        return 'Sukses';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Dibatalkan';
      case 'failed':
        return 'Gagal';
      case 'refunded':
        return 'Direfund';
      default:
        return 'Belum Dibayar';
    }
  }

  switch (canonical) {
    case 'success':
      return 'Berhasil';
    case 'pending':
      return 'Tertunda';
    case 'processing':
      return 'Diproses';
    case 'failed':
      return 'Gagal';
    case 'expired':
      return 'Kedaluwarsa';
    case 'cancelled':
      return 'Dibatalkan';
    case 'refunded':
      return 'Dana Kembali';
    default:
      return String(status ?? '');
  }
}
