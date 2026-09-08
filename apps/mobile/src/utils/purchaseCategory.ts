/**
 * Purchase-flow category classification for Mobile hardening (Tahap 1+ / 3B).
 * Sourced from Web/backend audit — not invented business rules.
 *
 * Direct: may use generic checkout (SKU + target + PIN → POST /transactions).
 * PLN prepaid: dedicated inquiry flow (POST /pln/inquiry).
 * Game / Langganan: dedicated schema flows.
 * Postpaid tagihan: TagihanBillCatalogFlow → inquiry_ref_id on POST /transactions.
 */

const DIRECT_PURCHASE_SLUGS = new Set([
  'pulsa',
  'data',
  'paket-data',
  'voucher-internet',
  'sms-telepon',
  'masa-aktif',
  'aktivasi-perdana',
  'esim',
  'voucher-digital',
  'international',
  'gas-prepaid',
]);

/** Token PLN prepaid — uses PlnTokenCatalogFlow, not generic checkout. */
const PLN_PREPAID_SLUGS = new Set(['pln', 'token-pln']);

/** Game top-up — uses GameCatalogFlow (VIP nickname optional). */
const GAME_SLUGS = new Set(['game', 'games', 'topup-game', 'top-up-game', 'game-feature']);

/** Langganan Digital / Streaming — uses LanggananCatalogFlow. */
const LANGGANAN_SLUGS = new Set(['langganan-digital', 'langganan', 'streaming']);

/**
 * Provider-first browse catalogs (Web ProviderCatalogFlow).
 */
const PROVIDER_BROWSE_CANONICAL: Record<string, string> = {
  'topup-digital': 'topup-digital',
  ewallet: 'topup-digital',
  'e-money': 'topup-digital',
  game: 'game',
  'langganan-digital': 'langganan-digital',
  langganan: 'langganan-digital',
  streaming: 'langganan-digital',
  'voucher-digital': 'voucher-digital',
  esim: 'esim',
  international: 'international',
};

/** Postpaid / bill categories — TagihanBillCatalogFlow (inquiry_ref_id). */
const TAGIHAN_BILL_SLUGS = new Set([
  'pln-pascabayar',
  'pdam',
  'bpjs-kesehatan',
  'bpjs-tk',
  'internet-pascabayar',
  'tv-pascabayar',
  'gas',
  'multifinance',
  'tagihan',
  'hp-pascabayar',
  // PBB/SAMSAT need region forms — still bill inquiry; Mobile uses same bill flow for customer_no
  // composed upstream when available. Keep in set so they are not dead-end notices.
  'pbb',
  'samsat',
]);

/** Categories that previously blocked purchase without a dedicated Mobile flow. */
const INQUIRY_REQUIRED_SLUGS = new Set([
  'pln-pascabayar',
  'topup-digital',
  'ewallet',
  'e-money',
  'game',
  'langganan-digital',
  'langganan',
  'streaming',
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
  'hp-pascabayar',
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

export function isGameCategory(slug: string | null | undefined): boolean {
  return GAME_SLUGS.has(normalizeCategorySlug(slug));
}

export function isLanggananCategory(slug: string | null | undefined): boolean {
  return LANGGANAN_SLUGS.has(normalizeCategorySlug(slug));
}

export function isInquiryRequiredCategory(slug: string | null | undefined): boolean {
  return INQUIRY_REQUIRED_SLUGS.has(normalizeCategorySlug(slug));
}

export function isTagihanBillCategory(slug: string | null | undefined): boolean {
  return TAGIHAN_BILL_SLUGS.has(normalizeCategorySlug(slug));
}

export function isProviderBrowseCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) in PROVIDER_BROWSE_CANONICAL;
}

export function resolveProviderBrowseCategory(slug: string | null | undefined): string | null {
  const s = normalizeCategorySlug(slug);
  return PROVIDER_BROWSE_CANONICAL[s] ?? null;
}

export function isPhoneTargetCategory(slug: string | null | undefined): boolean {
  const s = normalizeCategorySlug(slug);
  return (
    s === 'pulsa' ||
    s === 'data' ||
    s === 'paket-data' ||
    s === 'sms-telepon' ||
    s === 'masa-aktif' ||
    s === 'international' ||
    s === 'hp-pascabayar'
  );
}

export function isVoucherInternetCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) === 'voucher-internet';
}

/** Digi voucher / eSIM — Web uses walletNo || 'VOUCHER' / 'ESIM'. */
export function isLiteralTargetCategory(slug: string | null | undefined): boolean {
  const s = normalizeCategorySlug(slug);
  return s === 'voucher-digital' || s === 'esim';
}

export function literalTargetForCategory(slug: string | null | undefined): string {
  const s = normalizeCategorySlug(slug);
  if (s === 'esim') return 'ESIM';
  return 'VOUCHER';
}

export function isSerialTargetCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) === 'aktivasi-perdana';
}

export function isGasPrepaidCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) === 'gas-prepaid';
}

/** Phone-operator style catalog (reuse PulsaCatalogFlow with category prop). */
export function isPhoneOperatorCatalogCategory(slug: string | null | undefined): boolean {
  const s = normalizeCategorySlug(slug);
  return s === 'pulsa' || s === 'sms-telepon' || s === 'masa-aktif' || s === 'international';
}
