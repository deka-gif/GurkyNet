/**
 * Canonical transaction status helpers.
 *
 * Backend TransactionResource normalizes DB values to:
 *   success | pending | failed | cancelled | refunded
 * and exposes SRS 14.3 vocabulary on status_srs:
 *   INITIATED | LOCKED | SENT_TO_SUPPLIER | PENDING_SUPPLIER | SUCCESS | FAILED | REFUNDED
 *
 * Older UI code expected Indonesian: sukses | pending | gagal
 */

export type CanonicalTransactionStatus =
  | 'success'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type SrsTransactionStatus =
  | 'INITIATED'
  | 'LOCKED'
  | 'SENT_TO_SUPPLIER'
  | 'PENDING_SUPPLIER'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED';

export function normalizeTransactionStatus(raw: unknown): CanonicalTransactionStatus {
  const status = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (
    status === 'success' ||
    status === 'sukses' ||
    status === 'ok' ||
    status === 'berhasil'
  ) {
    return 'success';
  }

  if (status === 'refunded') {
    return 'refunded';
  }

  if (
    status === 'failed' ||
    status === 'gagal' ||
    status === 'error' ||
    status === 'expired' ||
    status === 'fail'
  ) {
    return 'failed';
  }

  if (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'batal' ||
    status === 'cancel'
  ) {
    return 'cancelled';
  }

  // pending | processing | draft | INITIATED | LOCKED | SENT_TO_SUPPLIER | PENDING_SUPPLIER | waiting | empty
  return 'pending';
}

/** Map any status (including SRS uppercase) to SRS 14.3 vocabulary for labels. */
export function toSrsTransactionStatus(raw: unknown): SrsTransactionStatus {
  const status = String(raw ?? '')
    .trim()
    .toUpperCase();

  if (status === 'INITIATED' || status === 'DRAFT') return 'INITIATED';
  if (status === 'LOCKED') return 'LOCKED';
  if (status === 'SENT_TO_SUPPLIER') return 'SENT_TO_SUPPLIER';
  if (status === 'PENDING_SUPPLIER') return 'PENDING_SUPPLIER';
  if (status === 'SUCCESS' || status === 'SUKSES') return 'SUCCESS';
  if (status === 'REFUNDED') return 'REFUNDED';
  if (
    status === 'FAILED' ||
    status === 'GAGAL' ||
    status === 'CANCELED' ||
    status === 'CANCELLED' ||
    status === 'EXPIRED'
  ) {
    return 'FAILED';
  }
  if (status === 'PENDING' || status === 'PROCESSING') return 'SENT_TO_SUPPLIER';

  const canonical = normalizeTransactionStatus(raw);
  if (canonical === 'success') return 'SUCCESS';
  if (canonical === 'failed') return 'FAILED';
  if (canonical === 'cancelled') return 'FAILED';
  if (canonical === 'refunded') return 'REFUNDED';
  return 'SENT_TO_SUPPLIER';
}

export function isSuccessStatus(raw: unknown): boolean {
  return normalizeTransactionStatus(raw) === 'success' || toSrsTransactionStatus(raw) === 'SUCCESS';
}

export function isPendingStatus(raw: unknown): boolean {
  const srs = toSrsTransactionStatus(raw);
  return (
    normalizeTransactionStatus(raw) === 'pending' ||
    srs === 'INITIATED' ||
    srs === 'LOCKED' ||
    srs === 'SENT_TO_SUPPLIER' ||
    srs === 'PENDING_SUPPLIER'
  );
}

export function isFailedStatus(raw: unknown): boolean {
  const s = normalizeTransactionStatus(raw);
  return s === 'failed' || s === 'cancelled';
}

export function transactionStatusLabel(raw: unknown): string {
  const srs = toSrsTransactionStatus(raw);
  switch (srs) {
    case 'INITIATED':
      return 'Diterima';
    case 'LOCKED':
      return 'Saldo dikunci';
    case 'SENT_TO_SUPPLIER':
      return 'Dikirim ke provider';
    case 'PENDING_SUPPLIER':
      return 'Menunggu provider';
    case 'SUCCESS':
      return 'Sukses';
    case 'FAILED':
      return normalizeTransactionStatus(raw) === 'cancelled' ? 'Dibatalkan' : 'Gagal';
    case 'REFUNDED':
      return 'Direfund';
    default:
      return 'Pending';
  }
}
