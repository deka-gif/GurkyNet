import type { Product } from '../services/catalog.service';

/**
 * Tagihan brand-first grouping.
 * Customer-facing key = product.name (not Digi seller / Provider fulfillment).
 *
 * Multi-seller Digiflazz: same customer-facing name + multiple Digi buyer_sku rows
 * → ONE tile + ONE preferred SKU (align ProductRepository::preferCatalogProduct).
 * Different names (e.g. PLN 1k vs 3k) → separate tiles (union, never drop).
 *
 * Brand tiles must never carry catalog price.
 */

export type TagihanBrandGroup = {
  /** Normalized key: trim + lowercase of product.name */
  key: string;
  /** Display label from preferred product's original name (preserve casing). */
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
};

export function normalizeTagihanBrandKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
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

/**
 * Group already-filtered eligible products by product.name.
 * Caller must pass lifecycle-eligible products only (isCatalogListed ∩ isProductPurchasable).
 */
export function groupTagihanBrandsByProductName(products: Product[]): TagihanBrandGroup[] {
  const map = new Map<string, TagihanBrandGroup>();

  for (const product of products) {
    const key = normalizeTagihanBrandKey(product.name);
    if (key === '') continue;

    const existing = map.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      map.set(key, {
        key,
        label: (product.name || '').trim() || product.name,
        products: [product],
        boundSkuCode: null,
        isAmbiguous: false,
        hasMultipleOffers: false,
      });
    }
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    const preferred = preferTagihanCatalogProductAmong(g.products);
    g.hasMultipleOffers = g.products.length > 1;
    g.isAmbiguous = preferred == null;
    g.boundSkuCode = preferred?.code ?? null;
    if (preferred) {
      g.label = (preferred.name || '').trim() || preferred.name;
    }
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return groups;
}

/**
 * Resolve a brand selection to a single preferred Product for inquiry + pay.
 */
export function resolveTagihanBrandSelection(
  group: TagihanBrandGroup
): { ok: true; product: Product } | { ok: false; reason: 'ambiguous' | 'empty' } {
  if (group.products.length === 0) return { ok: false, reason: 'empty' };
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
    return resolveTagihanBrandSelection(groups[0]);
  }
  // Distinct customer products in a direct-input category — do not invent which one.
  return { ok: false, reason: 'ambiguous' };
}
