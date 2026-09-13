/**
 * Langganan Digital — package grouping within a provider brand.
 * Digi embeds duration/nominal in product_name (`Vidio Platinum 30 Hari`, `K-VISION 50.000`),
 * which floods the SKU grid. Strip those suffixes for the grouping key; keep full names as
 * variants under one package tile (audit Item 7 — same idea as TV Pascabayar nominal strip).
 *
 * Scope: langganan-digital only. Do not enable for other categories without Owner OK.
 */

import type { Product } from '../services/catalog.service';
import {
  normalizeTagihanBrandKey,
  preferTagihanCatalogProductAmong,
  stripTrailingTagihanNominal,
  tagihanBrandHasDistinctProductNames,
} from './tagihanBrandGrouping';

export type LanggananPackageGroup = {
  key: string;
  /** Display label after duration/nominal strip. */
  label: string;
  products: Product[];
  boundSkuCode: string | null;
  hasMultipleOffers: boolean;
  hasDistinctProductNames: boolean;
};

const DURATION_UNIT =
  'hari|day|days|minggu|week|weeks|bulan|month|months|bln|tahun|year|years|thn';

/** Strip trailing Digi duration / nominal so package families merge. */
export function stripLanggananVariantSuffix(name: string | null | undefined): string {
  let t = (name || '').trim();
  if (!t) return '';

  // "(180 Hari)" / "(1 Bulan)" at end
  t = t.replace(new RegExp(`\\s*\\(\\s*\\d+\\s*(?:${DURATION_UNIT})\\s*\\)\\s*$`, 'iu'), '').trim();
  // " 30 Hari" / " 6 BULAN" / " 1 Tahun" at end
  t = t.replace(new RegExp(`\\s+\\d+\\s*(?:${DURATION_UNIT})\\s*$`, 'iu'), '').trim();
  // Trailing bill/top-up style amounts (" 50.000")
  t = stripTrailingTagihanNominal(t);

  return t.trim();
}

export function groupLanggananPackages(products: Product[]): LanggananPackageGroup[] {
  const map = new Map<string, LanggananPackageGroup>();

  for (const product of products) {
    const label =
      stripLanggananVariantSuffix(product.name) || (product.name || '').trim() || 'Lainnya';
    const key = normalizeTagihanBrandKey(label);
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      map.set(key, {
        key,
        label,
        products: [product],
        boundSkuCode: null,
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
    g.boundSkuCode = preferred?.code ?? null;
    if (preferred) {
      const preferredLabel =
        stripLanggananVariantSuffix(preferred.name) || preferred.name || g.label;
      g.label = preferredLabel;
    }
  }

  groups.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return groups;
}
