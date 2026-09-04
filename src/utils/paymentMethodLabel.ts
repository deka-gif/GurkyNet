/**
 * FR-TOPUP-UX-03 — customer-facing payment method labels.
 * Never render gateway names (midtrans) or raw processor enums.
 */

const FALLBACK = 'Pembayaran';

const CHANNEL_LABELS: Record<string, string> = {
  qris: 'QRIS',
  other_qris: 'QRIS',
  bca_va: 'Virtual Account BCA',
  bca: 'Virtual Account BCA',
  bri_va: 'Virtual Account BRI',
  bri: 'Virtual Account BRI',
  bni_va: 'Virtual Account BNI',
  bni: 'Virtual Account BNI',
  echannel: 'Virtual Account Mandiri',
  mandiri: 'Virtual Account Mandiri',
  mandiri_va: 'Virtual Account Mandiri',
  permata_va: 'Virtual Account Permata',
  permata: 'Virtual Account Permata',
  alfamart: 'Alfamart',
  indomaret: 'Indomaret',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  dana: 'DANA',
  ovo: 'OVO',
  linkaja: 'LinkAja',
  bank_transfer: 'Virtual Account',
  cstore: 'Gerai Retail',
  credit_card: 'Kartu Kredit/Debit',
  card: 'Kartu Kredit/Debit',
  wallet: 'Saldo Dompet',
  manual_transfer: 'Transfer Manual',
};

/**
 * Prefer paymentMethodLabel from API; sanitize legacy raw values like "midtrans".
 */
export function customerFacingPaymentMethodLabel(
  paymentMethod?: string | null,
  paymentMethodLabel?: string | null
): string | null {
  const preferred = String(paymentMethodLabel || paymentMethod || '').trim();
  if (!preferred) return null;

  const key = preferred.toLowerCase();
  if (key === 'midtrans' || key === 'dummy_gateway') {
    return FALLBACK;
  }

  if (CHANNEL_LABELS[key]) {
    return CHANNEL_LABELS[key];
  }

  // Already a human label from backend (e.g. "Virtual Account BRI", "QRIS").
  if (/[A-Z]/.test(preferred) || /\s/.test(preferred)) {
    return preferred;
  }

  // Unknown snake_case / enum — do not show raw processor codes.
  if (/^[a-z0-9_\-]+$/i.test(preferred)) {
    return FALLBACK;
  }

  return preferred;
}
