/**
 * Canonical transaction status helpers.
 *
 * Backend TransactionResource normalizes DB values to:
 *   success | pending | processing | failed | cancelled | refunded | expired
 * and exposes SRS 14.3 vocabulary on status_srs:
 *   INITIATED | LOCKED | SENT_TO_SUPPLIER | PENDING_SUPPLIER | SUCCESS | FAILED | REFUNDED
 *
 * Older UI code expected Indonesian: sukses | pending | gagal
 */

export type CanonicalTransactionStatus =
  | 'success'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'expired';

export type SrsTransactionStatus =
  | 'INITIATED'
  | 'LOCKED'
  | 'SENT_TO_SUPPLIER'
  | 'PENDING_SUPPLIER'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED';

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

  if (status === 'expired') {
    return 'expired';
  }

  if (
    status === 'failed' ||
    status === 'gagal' ||
    status === 'error' ||
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

  if (status === 'processing') {
    return 'processing';
  }

  // pending | draft | INITIATED | LOCKED | SENT_TO_SUPPLIER | PENDING_SUPPLIER | waiting | empty
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
  if (canonical === 'failed' || canonical === 'expired') return 'FAILED';
  if (canonical === 'cancelled') return 'FAILED';
  if (canonical === 'refunded') return 'REFUNDED';
  return 'SENT_TO_SUPPLIER';
}

export function isSuccessStatus(raw: unknown): boolean {
  return normalizeTransactionStatus(raw) === 'success' || toSrsTransactionStatus(raw) === 'SUCCESS';
}

export function isPendingStatus(raw: unknown): boolean {
  const canonical = normalizeTransactionStatus(raw);
  if (canonical === 'pending' || canonical === 'processing') return true;
  const srs = toSrsTransactionStatus(raw);
  return (
    srs === 'INITIATED' ||
    srs === 'LOCKED' ||
    srs === 'SENT_TO_SUPPLIER' ||
    srs === 'PENDING_SUPPLIER'
  );
}

export function isFailedStatus(raw: unknown): boolean {
  const s = normalizeTransactionStatus(raw);
  return s === 'failed' || s === 'cancelled' || s === 'expired';
}

export function isExpiredStatus(raw: unknown): boolean {
  return normalizeTransactionStatus(raw) === 'expired';
}

/**
 * Human-readable status. For Top Up, never use PPOB labels like "Dikirim ke provider".
 * Unpaid Top Up (pending|processing) → "Menunggu Pembayaran".
 */
export function transactionStatusLabel(
  raw: unknown,
  opts?: {
    serviceName?: string | null;
    paymentMethod?: string | null;
    statusRaw?: string | null;
    invoiceNumber?: string | null;
    transactionCode?: string | null;
  }
): string {
  const topUp = isWalletTopUpService(
    opts?.serviceName,
    opts?.paymentMethod,
    opts?.invoiceNumber || opts?.transactionCode
  );
  const canonical = normalizeTransactionStatus(opts?.statusRaw ?? raw);

  if (topUp) {
    switch (canonical) {
      case 'pending':
      case 'processing':
        // Customer-facing unpaid Top Up is always "Menunggu Pembayaran".
        return 'Menunggu Pembayaran';
      case 'success':
        return 'Sukses';
      case 'expired':
        return 'Pembayaran Kedaluwarsa';
      case 'cancelled':
        return 'Dibatalkan';
      case 'failed':
        return 'Gagal';
      case 'refunded':
        return 'Direfund';
      default:
        return 'Menunggu Pembayaran';
    }
  }

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
      if (canonical === 'expired') return 'Pembayaran Kedaluwarsa';
      return canonical === 'cancelled' ? 'Dibatalkan' : 'Gagal';
    case 'REFUNDED':
      return 'Direfund';
    default:
      return 'Pending';
  }
}

/** Strip internal provider / payment-processor wording from customer notes. */
export function customerFacingTransactionNotes(
  notes: string | null | undefined,
  opts?: {
    serviceName?: string | null;
    paymentMethod?: string | null;
    invoiceNumber?: string | null;
    transactionCode?: string | null;
    status?: string | null;
    amount?: number | null;
  }
): string {
  const raw = String(notes || '').trim();
  const topUp = isWalletTopUpService(
    opts?.serviceName,
    opts?.paymentMethod,
    opts?.invoiceNumber || opts?.transactionCode
  );
  if (!topUp) return raw;

  const status = normalizeTransactionStatus(opts?.status);
  if (status === 'success') return 'Top Up berhasil. Saldo Anda telah ditambahkan.';
  if (status === 'expired') {
    const amount = Number(opts?.amount ?? 0);
    if (Number.isFinite(amount) && amount > 0) {
      return `Pembayaran ${formatIdrAmount(amount)} telah kedaluwarsa.`;
    }
    return 'Pembayaran telah kedaluwarsa.';
  }
  if (status === 'failed' || status === 'cancelled') {
    return 'Pembayaran Top Up tidak berhasil. Saldo Anda tidak berubah.';
  }

  if (!raw || /midtrans|provider|webhook|snap/i.test(raw)) {
    return 'Menunggu pembayaran. Selesaikan pembayaran untuk menambah saldo Anda.';
  }

  return raw;
}

function formatIdrAmount(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
}
