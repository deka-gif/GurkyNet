/**
 * Tagihan Mobile flow-mode gates (brand-first vs bill direct-input).
 * Kept separate from TagihanBillCatalogFlow so Node tests can import without RN.
 */

/**
 * Multi-brand Tagihan — customer picks provider/brand tile first.
 * Excludes single-service bills (PLN pasca/nontaglis, BPJS Kes, Gas Negara)
 * and Token PLN (`pln`).
 */
export const BRAND_FIRST_CATEGORIES = new Set([
  'tv-pascabayar',
  'pdam',
  'internet-pascabayar',
  'multifinance',
  /** Membership type tiles (PU / BPU). BPU Digi SKU collision → fail-closed. */
  'bpjs-tk',
]);

/**
 * Single-service postpaid bills: category → identifier input (no brand/product picker).
 * Uses tagihan inquiry + inquiry_ref_id — not PlnTokenCatalogFlow / brand-first.
 */
export const TAGIHAN_BILL_DIRECT_INPUT_CATEGORIES = new Set([
  'pln-pascabayar',
  'pln-nontaglis',
  'bpjs-kesehatan',
  'gas',
]);

/** @deprecated Use TAGIHAN_BILL_DIRECT_INPUT_CATEGORIES */
export const PLN_BILL_DIRECT_INPUT_CATEGORIES = TAGIHAN_BILL_DIRECT_INPUT_CATEGORIES;

export function isTagihanBrandFirstCategory(category: string): boolean {
  return BRAND_FIRST_CATEGORIES.has(category.trim().toLowerCase());
}

export function isTagihanBillDirectInputCategory(category: string): boolean {
  return TAGIHAN_BILL_DIRECT_INPUT_CATEGORIES.has(category.trim().toLowerCase());
}

/** @deprecated Use isTagihanBillDirectInputCategory */
export function isPlnBillDirectInputCategory(category: string): boolean {
  return isTagihanBillDirectInputCategory(category);
}
