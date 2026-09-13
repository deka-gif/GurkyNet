/**
 * Web mirror of mobile langgananPackageGrouping (audit Item 7).
 * Scope: langganan-digital product grids only.
 */

import type { Product } from '../types';

export type LanggananPackageGroup = {
  key: string;
  label: string;
  products: Product[];
  hasDistinctProductNames: boolean;
};

const DURATION_UNIT =
  'hari|day|days|minggu|week|weeks|bulan|month|months|bln|tahun|year|years|thn';

export function stripTrailingTagihanNominal(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s*$/u, '').trim();
}

export function stripLanggananVariantSuffix(name: string | null | undefined): string {
  let t = (name || '').trim();
  if (!t) return '';
  t = t.replace(new RegExp(`\\s*\\(\\s*\\d+\\s*(?:${DURATION_UNIT})\\s*\\)\\s*$`, 'iu'), '').trim();
  t = t.replace(new RegExp(`\\s+\\d+\\s*(?:${DURATION_UNIT})\\s*$`, 'iu'), '').trim();
  t = stripTrailingTagihanNominal(t);
  return t.trim();
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function hasDistinctNames(products: Product[]): boolean {
  const keys = new Set<string>();
  for (const p of products) {
    const k = normalizeKey(p.name || '');
    if (k) keys.add(k);
  }
  return keys.size > 1;
}

export function groupLanggananPackages(products: Product[]): LanggananPackageGroup[] {
  const map = new Map<string, LanggananPackageGroup>();
  for (const product of products) {
    const label =
      stripLanggananVariantSuffix(product.name) || (product.name || '').trim() || 'Lainnya';
    const key = normalizeKey(label);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) {
      prev.products.push(product);
    } else {
      map.set(key, {
        key,
        label,
        products: [product],
        hasDistinctProductNames: false,
      });
    }
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.hasDistinctProductNames = hasDistinctNames(g.products);
  }
  groups.sort((a, b) => a.label.localeCompare(b.label, 'id'));
  return groups;
}
