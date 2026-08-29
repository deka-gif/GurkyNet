import type { Product } from '../types';
import { normalizeOperatorKey } from './operatorMatch';

export const TELKOMSEL_REGION_ORDER = [
  'Sumatra',
  'Jawa',
  'Bali - Nusa Tenggara',
  'Kalimantan',
  'Sulawesi',
] as const;

export type TelkomselRegionKey = (typeof TELKOMSEL_REGION_ORDER)[number];

export const TELKOMSEL_REGION_LABELS: Record<TelkomselRegionKey, string> = {
  Sumatra: 'Sumatra',
  Jawa: 'Jawa',
  'Bali - Nusa Tenggara': 'Bali - Nusa Tenggara',
  Kalimantan: 'Kalimantan',
  Sulawesi: 'Sulawesi',
};

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

export function telkomselNeedsZoneGate(products: Product[]): boolean {
  return products.some((p) => !!p.zoneLabel);
}

export function collectTelkomselZoneLabels(products: Product[]): string[] {
  const labels = new Set<string>();
  for (const p of products) {
    if (p.zoneLabel) labels.add(p.zoneLabel);
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b, 'id'));
}

export function zoneLabelBelongsToRegion(zoneLabel: string, region: TelkomselRegionKey): boolean {
  return REGION_PREFIXES[region].some((prefix) => zoneLabel.startsWith(prefix));
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

export function filterProductsByZoneLabel(products: Product[], zoneLabel: string): Product[] {
  return products.filter((p) => p.zoneLabel === zoneLabel);
}

export function telkomselNationalProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.zoneLabel);
}

export function regionHasCitySearch(region: TelkomselRegionKey | null): boolean {
  return region !== null && region !== 'Jawa';
}

/** Best-effort city search — reference keys must match catalog zoneLabel exactly. */
export function searchCityForZoneLabel(
  query: string,
  reference: Record<string, string[]>,
  availableZoneLabels: string[]
): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  for (const zoneLabel of availableZoneLabels) {
    const cities = reference[zoneLabel];
    if (!cities?.length) continue;
    for (const city of cities) {
      const cityLower = city.toLowerCase();
      if (cityLower.includes(q) || q.includes(cityLower)) {
        return zoneLabel;
      }
    }
  }

  return null;
}
