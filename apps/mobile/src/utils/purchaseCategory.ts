/**
 * Purchase-flow category classification for Mobile hardening (Tahap 1+).
 * Sourced from Web/backend audit — not invented business rules.
 *
 * Direct: may use generic checkout (SKU + target + PIN → POST /transactions).
 * PLN prepaid: dedicated inquiry flow (POST /pln/inquiry) then same purchase pipe
 * without inquiry_ref_id (session keyed by user + customer_no on backend).
 * Inquiry-required (blocked until dedicated flow exists): e-wallet, game, tagihan, etc.
 */

const DIRECT_PURCHASE_SLUGS = new Set([
  'pulsa',
  'data',
  'paket-data',
  'voucher-internet',
]);

/** Token PLN prepaid — uses PlnTokenCatalogFlow, not generic checkout. */
const PLN_PREPAID_SLUGS = new Set(['pln', 'token-pln']);

/** Categories whose Web/backend pre-checkout requires inquiry/schema not yet on Mobile. */
const INQUIRY_REQUIRED_SLUGS = new Set([
  // Pascabayar PLN (tagihan) — NOT token prepaid
  'pln-pascabayar',
  // E-Money / e-wallet
  'topup-digital',
  'ewallet',
  'e-money',
  // Game
  'game',
  // Streaming / langganan
  'langganan-digital',
  'langganan',
  'streaming',
  // Pascabayar / pajak (inquiry_ref_id)
  'pdam',
  'bpjs-kesehatan',
  'bpjs-tk',
  'internet-pascabayar',
  'tv-pascabayar',
  'gas',
  'pbb',
  'samsat',
  'multifinance',
  'tagihan',
]);

export const INQUIRY_FLOW_NOTICE =
  'Pembelian kategori ini memerlukan langkah validasi (inquiry) sebelum pembayaran. Fitur tersebut sedang disiapkan di aplikasi mobile. Silakan gunakan Web GurkyNet untuk sementara, atau coba lagi setelah pembaruan.';

export function normalizeCategorySlug(slug: string | null | undefined): string {
  return (slug || '').trim().toLowerCase();
}

export function isDirectPurchaseCategory(slug: string | null | undefined): boolean {
  return DIRECT_PURCHASE_SLUGS.has(normalizeCategorySlug(slug));
}

export function isPlnPrepaidCategory(slug: string | null | undefined): boolean {
  return PLN_PREPAID_SLUGS.has(normalizeCategorySlug(slug));
}

export function isInquiryRequiredCategory(slug: string | null | undefined): boolean {
  return INQUIRY_REQUIRED_SLUGS.has(normalizeCategorySlug(slug));
}

/** Phone-style target (digits) — matches Web Pulsa / Paket Data / Voucher Internet tembak. */
export function isPhoneTargetCategory(slug: string | null | undefined): boolean {
  const s = normalizeCategorySlug(slug);
  return s === 'pulsa' || s === 'data' || s === 'paket-data' || s === 'voucher-internet';
}
