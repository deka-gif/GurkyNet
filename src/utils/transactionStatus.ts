/**
 * Canonical transaction status helpers.
 *
 * Backend TransactionResource normalizes DB values to:
 *   success | pending | failed | cancelled
 *
 * Older UI code expected Indonesian: sukses | pending | gagal
 * That mismatch made SUCCESS look like a non-success badge on Riwayat.
 */

export type CanonicalTransactionStatus = 'success' | 'pending' | 'failed' | 'cancelled';

export function normalizeTransactionStatus(raw: unknown): CanonicalTransactionStatus {
  const status = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (status === 'success' || status === 'sukses' || status === 'ok' || status === 'berhasil') {
    return 'success';
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

  // pending | processing | draft | waiting | empty
  return 'pending';
}

export function isSuccessStatus(raw: unknown): boolean {
  return normalizeTransactionStatus(raw) === 'success';
}

export function isPendingStatus(raw: unknown): boolean {
  return normalizeTransactionStatus(raw) === 'pending';
}

export function isFailedStatus(raw: unknown): boolean {
  const s = normalizeTransactionStatus(raw);
  return s === 'failed' || s === 'cancelled';
}

export function transactionStatusLabel(raw: unknown): string {
  switch (normalizeTransactionStatus(raw)) {
    case 'success':
      return 'Sukses';
    case 'failed':
      return 'Gagal';
    case 'cancelled':
      return 'Dibatalkan';
    default:
      return 'Pending';
  }
}
