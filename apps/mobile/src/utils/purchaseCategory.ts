/**
 * Purchase-flow category classification for Mobile hardening (Tahap 1+ / 3B).
 * Sourced from Web/backend audit — not invented business rules.
 *
 * Tahap 3B: inquiry-required blocks PURCHASE via generic product detail/checkout.
 * E-Wallet (topup-digital) has a dedicated Transfer/Layanan flow:
 * brand → nomor + nominal manual → inquiry → confirm → PIN → POST /transactions.
 * Game has GameCatalogFlow: game → product → account → inquiry → checkout/PIN.
 * Langganan/Streaming has LanggananCatalogFlow: brand → product → schema → PIN
 * (no upstream inquiry; voucher uses target LANGGANAN).
 *
 * Direct: may use generic checkout (SKU + target + PIN → POST /transactions).
 * PLN prepaid: dedicated inquiry flow (POST /pln/inquiry) then same purchase pipe
 * without inquiry_ref_id (session keyed by user + customer_no on backend).
 * Inquiry-required: must not reach generic PIN / POST /transactions without validation.
 */

const DIRECT_PURCHASE_SLUGS = new Set([
  'pulsa',
  'data',
  'paket-data',
  'voucher-internet',
]);

/** Token PLN prepaid — uses PlnTokenCatalogFlow, not generic checkout. */
const PLN_PREPAID_SLUGS = new Set(['pln', 'token-pln']);

/** Game top-up — uses GameCatalogFlow + game inquiry session (no inquiry_ref_id). */
const GAME_SLUGS = new Set(['game', 'games', 'topup-game', 'top-up-game', 'game-feature']);

/** Langganan Digital / Streaming — uses LanggananCatalogFlow (schema, no inquiry). */
const LANGGANAN_SLUGS = new Set(['langganan-digital', 'langganan', 'streaming']);

/**
 * Provider-first browse catalogs (Web ProviderCatalogFlow).
 * Value = canonical GET /products `category` + GET /products/providers `category`.
 */
const PROVIDER_BROWSE_CANONICAL: Record<string, string> = {
  'topup-digital': 'topup-digital',
  ewallet: 'topup-digital',
  'e-money': 'topup-digital',
  game: 'game',
  'langganan-digital': 'langganan-digital',
  langganan: 'langganan-digital',
  streaming: 'langganan-digital',
};

/** Categories whose Web/backend pre-checkout requires inquiry/schema not yet on Mobile. */
const INQUIRY_REQUIRED_SLUGS = new Set([
  // Pascabayar PLN (tagihan) — NOT token prepaid
  'pln-pascabayar',
  // E-Wallet / e-money (catalog aliases → topup-digital)
  'topup-digital',
  'ewallet',
  'e-money',
  // Game — Digi schema + GameCatalogFlow (VIP nickname optional, not a purchase gate)
  'game',
  // Streaming / langganan — schema-aware LanggananCatalogFlow (not generic checkout)
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

/** Game top-up category (dedicated GameCatalogFlow). */
export function isGameCategory(slug: string | null | undefined): boolean {
  return GAME_SLUGS.has(normalizeCategorySlug(slug));
}

/** Langganan Digital / Streaming (dedicated LanggananCatalogFlow). */
export function isLanggananCategory(slug: string | null | undefined): boolean {
  return LANGGANAN_SLUGS.has(normalizeCategorySlug(slug));
}

/** Purchase gate only — does NOT block browsing/product list. */
export function isInquiryRequiredCategory(slug: string | null | undefined): boolean {
  return INQUIRY_REQUIRED_SLUGS.has(normalizeCategorySlug(slug));
}

/** Provider → product browse UX (Tahap 3B). */
export function isProviderBrowseCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) in PROVIDER_BROWSE_CANONICAL;
}

/** Canonical API category for provider browse (Web SoT). */
export function resolveProviderBrowseCategory(slug: string | null | undefined): string | null {
  const s = normalizeCategorySlug(slug);
  return PROVIDER_BROWSE_CANONICAL[s] ?? null;
}

/** Phone-style target (digits) — Pulsa / Paket Data. Voucher Internet uses checkout.voucherInternetMode. */
export function isPhoneTargetCategory(slug: string | null | undefined): boolean {
  const s = normalizeCategorySlug(slug);
  return s === 'pulsa' || s === 'data' || s === 'paket-data';
}

export function isVoucherInternetCategory(slug: string | null | undefined): boolean {
  return normalizeCategorySlug(slug) === 'voucher-internet';
}
