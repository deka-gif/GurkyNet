import type { Product } from '../services/catalog.service';
import { normalizeOperatorKey } from './operatorMatch';

/**
 * Telkomsel-only Voucher Internet geographic zone helpers (Mobile).
 * Mirror of web `src/utils/telkomselVoucherZone.ts` REGION_PREFIXES, hardened so
 * non-geographic Digi/VIP categories (e.g. "Hot Promo") are never zone options.
 *
 * Geographic proof = label matches REGION_PREFIXES (same prefixes as Web grouping /
 * keys under laravel/config/telkomsel_voucher_zones.php). No multi-provider classifier.
 */

export const TELKOMSEL_REGION_ORDER = [
  'Sumatra',
  'Jawa',
  'Bali - Nusa Tenggara',
  'Kalimantan',
  'Sulawesi',
] as const;

export type TelkomselRegionKey = (typeof TELKOMSEL_REGION_ORDER)[number];

const REGION_PREFIXES: Record<TelkomselRegionKey, readonly string[]> = {
  Sumatra: ['Sumatera Utara', 'Sumatera Tengah', 'Sumatera Selatan'],
  Jawa: ['Jabodetabek', 'Jawa Barat', 'Jawa Tengah - DIY', 'Jawa Timur', 'Sukabumi Bogor Banten', 'Jawa Lombok'],
  'Bali - Nusa Tenggara': ['Bali - Nusa Tenggara'],
  Kalimantan: ['Kalimantan'],
  Sulawesi: ['Sulawesi'],
};

export function isTelkomselOperator(name: string | null | undefined): boolean {
  return normalizeOperatorKey(name) === 'telkomsel';
}

export function zoneLabelBelongsToRegion(zoneLabel: string, region: TelkomselRegionKey): boolean {
  return REGION_PREFIXES[region].some((prefix) => zoneLabel.startsWith(prefix));
}

/**
 * True only when zoneLabel matches a known Telkomsel geographic prefix.
 * "Hot Promo", "GamesMAX", product-line categories → false.
 */
export function isTelkomselGeographicZoneLabel(zoneLabel: string | null | undefined): boolean {
  const label = typeof zoneLabel === 'string' ? zoneLabel.trim() : '';
  if (!label) return false;
  return TELKOMSEL_REGION_ORDER.some((region) => zoneLabelBelongsToRegion(label, region));
}

/** Zone picker needed only if catalog has at least one geographic zoneLabel. */
export function telkomselNeedsZoneGate(products: Product[]): boolean {
  return products.some((p) => isTelkomselGeographicZoneLabel(p.zoneLabel));
}

export function filterProductsByZoneLabel(products: Product[], zoneLabel: string): Product[] {
  if (!isTelkomselGeographicZoneLabel(zoneLabel)) return [];
  return products.filter((p) => p.zoneLabel === zoneLabel);
}

/**
 * Non-geographic Telkomsel products: null zoneLabel (nasional) OR non-geo labels
 * such as Hot Promo — still listed under Nasional / non-zone path, never as a zona option.
 */
export function telkomselNationalProducts(products: Product[]): Product[] {
  return products.filter((p) => !isTelkomselGeographicZoneLabel(p.zoneLabel));
}

/** Selectable geographic zone labels only (excludes Hot Promo etc.). */
export function collectTelkomselZoneLabels(products: Product[]): string[] {
  const labels = new Set<string>();
  for (const p of products) {
    if (isTelkomselGeographicZoneLabel(p.zoneLabel)) {
      labels.add(p.zoneLabel as string);
    }
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b, 'id'));
}

export function availableTelkomselRegions(zoneLabels: string[]): TelkomselRegionKey[] {
  return TELKOMSEL_REGION_ORDER.filter((region) =>
    zoneLabels.some((label) => zoneLabelBelongsToRegion(label, region))
  );
}

export function zoneLabelsForRegion(zoneLabels: string[], region: TelkomselRegionKey): string[] {
  return zoneLabels
    .filter((label) => zoneLabelBelongsToRegion(label, region))
    .sort((a, b) => a.localeCompare(b, 'id'));
}

/** Labels present in catalog that are NOT geographic (diagnostics / orphan list). */
export function orphanZoneLabels(zoneLabels: string[]): string[] {
  return zoneLabels
    .filter((label) => !isTelkomselGeographicZoneLabel(label))
    .sort((a, b) => a.localeCompare(b, 'id'));
}
