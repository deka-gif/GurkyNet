/**
 * Soft caps for catalog list fetches — avoid unbounded `per_page: 5000` dumps (audit Item 6).
 * Small tagihan categories stay fast with 100; provider-scoped / general use higher but finite caps.
 */
export const CATALOG_FETCH = {
  /** PDAM, PBB, multifinance, gas, PLN token, tagihan bill lists (~≤110 SKUs). */
  SMALL_CATEGORY: 100,
  /** E-wallet open-amount SKU resolution (provider-scoped). */
  PROVIDER_SCOPED: 150,
  /** Cek harga / generic category+provider browse / web product lists. */
  GENERAL: 200,
  /** Rare fallback when provider-summary empty (VI brand invent from products). */
  FALLBACK_DUMP: 300,
} as const;
