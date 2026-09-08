/**
 * Tagihan Mobile flow-mode gates (brand-first vs PLN bill direct-input).
 * Kept separate from TagihanBillCatalogFlow so Node tests can import without RN.
 */

/** Brand-first Tagihan — excludes Token PLN, PLN Pascabayar, PLN Nontaglis. */
export const BRAND_FIRST_CATEGORIES = new Set([
  'tv-pascabayar',
  'pdam',
  'internet-pascabayar',
  'multifinance',
  'bpjs-kesehatan',
  'gas',
]);

/**
 * PLN postpaid bills: category → meter input (no intermediate brand/product tile).
 * Uses tagihan inquiry + inquiry_ref_id — not PlnTokenCatalogFlow / brand-first.
 */
export const PLN_BILL_DIRECT_INPUT_CATEGORIES = new Set([
  'pln-pascabayar',
  'pln-nontaglis',
]);

export function isTagihanBrandFirstCategory(category: string): boolean {
  return BRAND_FIRST_CATEGORIES.has(category.trim().toLowerCase());
}

export function isPlnBillDirectInputCategory(category: string): boolean {
  return PLN_BILL_DIRECT_INPUT_CATEGORIES.has(category.trim().toLowerCase());
}
