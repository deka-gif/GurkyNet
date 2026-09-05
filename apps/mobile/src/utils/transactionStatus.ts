import type { TransactionStatus } from '../api/types';

/** Mirror web `src/utils/transactionStatus.ts` — customer-facing normalize only. */

export type CanonicalTransactionStatus = TransactionStatus;

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
