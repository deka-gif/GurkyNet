import type { Product } from '../services/catalog.service';

/**
 * Tagihan brand-first grouping.
 * Customer-facing key = product.name (not Digi seller / Provider fulfillment).
 *
 * Multi-seller Digiflazz: same customer-facing name + multiple Digi buyer_sku rows
 * → ONE tile + ONE preferred SKU (align ProductRepository::preferCatalogProduct).
 * Different names (e.g. PLN 1k vs 3k) → separate tiles (union, never drop).
 *
 * TV Pascabayar only (opt-in): Digi embeds bill nominal in product_name
 * (`K-Vision Pascabayar 50.000`). Strip trailing nominal so brand tiles merge;
 * denoms stay as distinct products under the group (FR catalog UX — TV brand grid).
 *
 * Brand tiles must never carry catalog price.
 */

export type TagihanBrandGroup = {
  /** Normalized key: trim + lowercase of grouping label */
  key: string;
  /** Display label for the brand tile (no trailing nominal when TV strip is on). */
  label: string;
  /** Eligible products sharing this display key (may be multi Digi offers). */
  products: Product[];
  /** Preferred Digi/customer SKU for inquiry + payment (always set when products nonempty). */
  boundSkuCode: string | null;
  /**
   * True only when this group cannot bind a preferred SKU (empty).
   * Multi-offer Digi same name is NOT ambiguous — preferred SKU is selected.
   */
  isAmbiguous: boolean;
  /** True when more than one Digi/catalog row maps to this customer-facing tile. */
  hasMultipleOffers: boolean;
  /**
   * True when products keep distinct original Digi product_name values
   * (e.g. K-Vision nominals) — UI must show a denom/product picker, not auto-bind.
   */
  hasDistinctProductNames: boolean;
};

export type GroupTagihanBrandsOptions = {
  /**
   * TV Pascabayar only: strip trailing Digi bill amounts from the grouping key/label.
   * Do not enable for PDAM / multifinance / etc. until Owner expands scope.
   */
  stripTrailingNominal?: boolean;
};

export function normalizeTagihanBrandKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

/**
 * Strip trailing Indonesian-style Digi bill amounts from a product name.
 * Example: "K-Vision Pascabayar 50.000" → "K-Vision Pascabayar"
 * Does not touch names without a trailing amount (BIG TV, Biznet Home TV Pascabayar).
 */
export function stripTrailingTagihanNominal(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  // 50.000 / 100.000 / 1.000.000 (optional decimal cents)
  return trimmed.replace(/\s+\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s*$/u, '').trim();
}

function groupingLabelForProduct(product: Product, stripTrailingNominal: boolean): string {
  const raw = (product.name || '').trim();
  if (!raw) return '';
  return stripTrailingNominal ? stripTrailingTagihanNominal(raw) : raw;
}

/**
 * Mirror laravel ProductRepository::preferCatalogProduct for Mobile Product fields.
 * - Prefer non-VIP sku_code over VIP-
 * - Prefer lower sell price (`price`)
 * - Stable tie-break by sku code (deterministic; not seller invent)
 *
 * Does not invent Digi seller ranking.
 */
export function preferTagihanCatalogProduct(a: Product, b: Product): Product {
  const aVip = String(a.code || '')
    .toUpperCase()
    .startsWith('VIP-');
  const bVip = String(b.code || '')
    .toUpperCase()
    .startsWith('VIP-');
  if (aVip !== bVip) {
    return aVip ? b : a;
  }

  const pa = Number(a.price);
  const pb = Number(b.price);
  if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) {
    return pa <= pb ? a : b;
  }

  return String(a.code).localeCompare(String(b.code), 'en') <= 0 ? a : b;
}

export function preferTagihanCatalogProductAmong(products: Product[]): Product | null {
  if (products.length === 0) return null;
  let best = products[0];
  for (let i = 1; i < products.length; i++) {
    best = preferTagihanCatalogProduct(best, products[i]);
  }
  return best;
}

export function tagihanBrandHasDistinctProductNames(products: Product[]): boolean {
  const keys = new Set<string>();
  for (const p of products) {
    const k = normalizeTagihanBrandKey(p.name);
    if (k) keys.add(k);
  }
  return keys.size > 1;
}

/**
 * Group already-filtered eligible products by product.name
 * (or TV-stripped brand label when options.stripTrailingNominal).
 * Caller must pass lifecycle-eligible products only (isCatalogListed ∩ isProductPurchasable).
 */
export function groupTagihanBrandsByProductName(
  products: Product[],
  options?: GroupTagihanBrandsOptions
): TagihanBrandGroup[] {
  const stripTrailingNominal = options?.stripTrailingNominal === true;
  const map = new Map<string, TagihanBrandGroup>();

  for (const product of products) {
    const label = groupingLabelForProduct(product, stripTrailingNominal);
    const key = normalizeTagihanBrandKey(label);
    if (key === '') continue;

    const existing = map.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      map.set(key, {
        key,
        label,
        products: [product],
        boundSkuCode: null,
        isAmbiguous: false,
        hasMultipleOffers: false,
        hasDistinctProductNames: false,
      });
    }
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    const preferred = preferTagihanCatalogProductAmong(g.products);
    g.hasMultipleOffers = g.products.length > 1;
    g.hasDistinctProductNames = tagihanBrandHasDistinctProductNames(g.products);
    g.isAmbiguous = preferred == null;
    g.boundSkuCode = preferred?.code ?? null;
    if (preferred) {
      const preferredLabel = groupingLabelForProduct(preferred, stripTrailingNominal);
      g.label = preferredLabel || preferred.name;
    }
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return groups;
}

/**
 * Resolve a brand selection to a single preferred Product for inquiry + pay.
 * Only safe when !hasDistinctProductNames (multi-seller same Digi product_name).
 */
export function resolveTagihanBrandSelection(
  group: TagihanBrandGroup
): { ok: true; product: Product } | { ok: false; reason: 'ambiguous' | 'empty' | 'needs_product_pick' } {
  if (group.products.length === 0) return { ok: false, reason: 'empty' };
  if (group.hasDistinctProductNames) {
    return { ok: false, reason: 'needs_product_pick' };
  }
  const preferred = preferTagihanCatalogProductAmong(group.products);
  if (!preferred || !group.boundSkuCode) {
    return { ok: false, reason: 'empty' };
  }
  return { ok: true, product: preferred };
}

/**
 * Auto-bind SKU for single-service Tagihan direct-input (PLN pasca/nontaglis, BPJS Kes, Gas).
 * One customer-facing name (possibly multi Digi offers) → preferred SKU.
 * Multiple distinct customer-facing names in category → fail-closed (cannot pick which service).
 */
export function resolvePlnBillDirectSku(
  products: Product[]
): { ok: true; product: Product } | { ok: false; reason: 'ambiguous' | 'empty' } {
  if (products.length === 0) return { ok: false, reason: 'empty' };
  if (products.length === 1) return { ok: true, product: products[0] };
  const groups = groupTagihanBrandsByProductName(products);
  if (groups.length === 1) {
    const resolved = resolveTagihanBrandSelection(groups[0]);
    if (resolved.ok) return resolved;
    return { ok: false, reason: resolved.reason === 'empty' ? 'empty' : 'ambiguous' };
  }
  // Distinct customer products in a direct-input category — do not invent which one.
  return { ok: false, reason: 'ambiguous' };
}
