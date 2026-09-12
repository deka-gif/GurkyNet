/**
 * TV Pascabayar web vendor grouping.
 * Digi brand is umbrella (`TV PASCABAYAR`); customer tiles use product.name with
 * trailing bill nominal stripped (align mobile tagihanBrandGrouping).
 */

import type { Product } from '../types';

/** "K-Vision Pascabayar 50.000" → "K-Vision Pascabayar" */
export function stripTrailingTagihanNominal(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s*$/u, '').trim();
}

export function normalizeTagihanBrandKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

export type TagihanTvVendorGroup = {
  name: string;
  products: Product[];
};

/**
 * Group TV Pascabayar products into vendor tiles by stripped product.name.
 * Other bill categories keep BillPaymentFlow's operatorName grouping.
 */
export function groupTvPascabayarVendors(products: Product[]): TagihanTvVendorGroup[] {
  const map = new Map<string, TagihanTvVendorGroup>();
  for (const p of products) {
    const label = stripTrailingTagihanNominal(p.name || '') || (p.name || '').trim() || 'Lainnya';
    const key = normalizeTagihanBrandKey(label);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) {
      prev.products.push(p);
    } else {
      map.set(key, { name: label, products: [p] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}
