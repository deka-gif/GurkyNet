import type { Product } from '../services/catalog.service';
import { normalizeOperatorKey } from './operatorMatch';

/**
 * Telkomsel-only Voucher Internet zone helpers (Mobile).
 * Aligned with web `src/utils/telkomselVoucherZone.ts`:
 * - Nasional = null zoneLabel only (plus marketing denylist: Hot Promo / GamesMAX)
 * - Known REGION_PREFIXES → island/region chips
 * - Other non-null Digi labels → "Wilayah Lainnya" (orphans), never dumped into Nasional
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

/** Marketing / non-geographic Digi `type` values — stay on Nasional path, never zone chips. */
export function isTelkomselMarketingZoneLabel(zoneLabel: string | null | undefined): boolean {
  const label = typeof zoneLabel === 'string' ? zoneLabel.trim() : '';
  if (!label) return false;
  if (label.toLowerCase() === 'hot promo') return true;
  if (label.toLowerCase().includes('gamesmax')) return true;
  return false;
}

export function isTelkomselOperator(name: string | null | undefined): boolean {
  return normalizeOperatorKey(name) === 'telkomsel';
}

export function zoneLabelBelongsToRegion(zoneLabel: string, region: TelkomselRegionKey): boolean {
  return REGION_PREFIXES[region].some((prefix) => zoneLabel.startsWith(prefix));
}

/**
 * True when zoneLabel matches a known Telkomsel geographic prefix.
 * "Hot Promo", "GamesMAX", orphan Digi variants (e.g. "Jabo - Jabar") → false.
 */
export function isTelkomselGeographicZoneLabel(zoneLabel: string | null | undefined): boolean {
  const label = typeof zoneLabel === 'string' ? zoneLabel.trim() : '';
  if (!label || isTelkomselMarketingZoneLabel(label)) return false;
  return TELKOMSEL_REGION_ORDER.some((region) => zoneLabelBelongsToRegion(label, region));
}

/** Selectable zone chip (geo prefix OR orphan Digi label — not marketing, not null). */
export function isTelkomselSelectableZoneLabel(zoneLabel: string | null | undefined): boolean {
  const label = typeof zoneLabel === 'string' ? zoneLabel.trim() : '';
  if (!label || isTelkomselMarketingZoneLabel(label)) return false;
  return true;
}

/** Zone picker when catalog has any selectable (geo or orphan) zoneLabel. */
export function telkomselNeedsZoneGate(products: Product[]): boolean {
  return products.some((p) => isTelkomselSelectableZoneLabel(p.zoneLabel));
}

export function filterProductsByZoneLabel(products: Product[], zoneLabel: string): Product[] {
  if (!isTelkomselSelectableZoneLabel(zoneLabel)) return [];
  return products.filter((p) => p.zoneLabel === zoneLabel);
}

/**
 * Nasional path: null zoneLabel OR marketing denylist (Hot Promo / GamesMAX).
 * Orphan Digi zones (Jabo - Jabar, etc.) are NOT national.
 */
export function telkomselNationalProducts(products: Product[]): Product[] {
  return products.filter(
    (p) => !p.zoneLabel || isTelkomselMarketingZoneLabel(p.zoneLabel)
  );
}

/** All selectable zone labels (geo + orphan), excluding marketing. */
export function collectTelkomselZoneLabels(products: Product[]): string[] {
  const labels = new Set<string>();
  for (const p of products) {
    if (isTelkomselSelectableZoneLabel(p.zoneLabel)) {
      labels.add(p.zoneLabel as string);
    }
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b, 'id'));
}

/** Geographic-only labels for the "Voucher per wilayah" island/region list. */
export function collectGeographicTelkomselZoneLabels(products: Product[]): string[] {
  return collectTelkomselZoneLabels(products).filter((label) => isTelkomselGeographicZoneLabel(label));
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

/**
 * Digi zone labels that do not match REGION_PREFIXES — "Wilayah Lainnya".
 * Marketing labels are excluded (they stay on Nasional).
 */
export function orphanZoneLabels(zoneLabels: string[]): string[] {
  return zoneLabels
    .filter(
      (label) =>
        isTelkomselSelectableZoneLabel(label) && !isTelkomselGeographicZoneLabel(label)
    )
    .sort((a, b) => a.localeCompare(b, 'id'));
}

/** Orphan labels present in a product catalog. */
export function collectOrphanTelkomselZoneLabels(products: Product[]): string[] {
  return orphanZoneLabels(collectTelkomselZoneLabels(products));
}
