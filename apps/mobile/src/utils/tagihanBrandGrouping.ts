import type { Product } from '../services/catalog.service';

/**
 * Tagihan brand-first grouping (Slice 1 — TV Pascabayar pilot).
 * FR: Slice 0 evidence — customer-facing key = product.name, NOT Provider.name / Digi brand.
 *
 * Brand tiles must never carry catalog price.
 */

export type TagihanBrandGroup = {
  /** Normalized key: trim + lowercase of product.name */
  key: string;
  /** Display label from first eligible product's original name (preserve casing). */
  label: string;
  /** Eligible products sharing this display key. */
  products: Product[];
  /**
   * Bound SKU when exactly one product; null when multi-SKU collision (fail-closed).
   * Never guess cheapest / first / admin.
   */
  boundSkuCode: string | null;
  /** True when more than one eligible SKU shares this display key. */
  isAmbiguous: boolean;
};

export function normalizeTagihanBrandKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
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
      });
    }
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    g.isAmbiguous = g.products.length > 1;
    g.boundSkuCode = g.products.length === 1 ? g.products[0].code : null;
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return groups;
}

/**
 * Resolve a brand selection to a single Product, or fail closed.
 */
export function resolveTagihanBrandSelection(
  group: TagihanBrandGroup
): { ok: true; product: Product } | { ok: false; reason: 'ambiguous' | 'empty' } {
  if (group.products.length === 0) return { ok: false, reason: 'empty' };
  if (group.products.length !== 1 || !group.boundSkuCode) {
    return { ok: false, reason: 'ambiguous' };
  }
  return { ok: true, product: group.products[0] };
}

/**
 * Auto-bind SKU for PLN Pascabayar / PLN Nontaglis direct-input (no brand/product picker).
 * Exactly one eligible product → bind. Duplicate display-name Digi SKUs → fail-closed.
 * Never silently pick among collisions (e.g. post733470 / post733563).
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
  return { ok: false, reason: 'ambiguous' };
}
