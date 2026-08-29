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

export type TelkomselCategoryKey = TelkomselRegionKey | 'orphan';

export const TELKOMSEL_REGION_LABELS: Record<TelkomselRegionKey, string> = {
  Sumatra: 'Sumatra',
  Jawa: 'Jawa',
  'Bali - Nusa Tenggara': 'Bali - Nusa Tenggara',
  Kalimantan: 'Kalimantan',
  Sulawesi: 'Sulawesi',
};

export const TELKOMSEL_REGION_MENU_LABELS: Record<TelkomselRegionKey, string> = {
  Sumatra: 'Voucher Khusus Pulau Sumatra',
  Jawa: 'Voucher Khusus Pulau Jawa',
  'Bali - Nusa Tenggara': 'Voucher Khusus Pulau Bali - Nusa Tenggara',
  Kalimantan: 'Voucher Khusus Pulau Kalimantan',
  Sulawesi: 'Voucher Khusus Pulau Sulawesi',
};

const REGION_PREFIXES: Record<TelkomselRegionKey, readonly string[]> = {
  Sumatra: ['Sumatera Utara', 'Sumatera Tengah', 'Sumatera Selatan'],
  Jawa: ['Jabodetabek', 'Jawa Barat', 'Jawa Tengah - DIY', 'Jawa Timur', 'Sukabumi Bogor Banten', 'Jawa Lombok'],
  'Bali - Nusa Tenggara': ['Bali - Nusa Tenggara'],
  Kalimantan: ['Kalimantan'],
  Sulawesi: ['Sulawesi'],
};

export type TelkomselCityZoneEntry = { city: string; zoneLabel: string };

export function isTelkomselOperator(name: string | null | undefined): boolean {
  return normalizeOperatorKey(name) === 'telkomsel';
}

export function telkomselNeedsZoneGate(products: Product[]): boolean {
  return products.some((p) => !!p.zoneLabel);
}

export function hasTelkomselNationalProducts(products: Product[]): boolean {
  return products.some((p) => !p.zoneLabel);
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

/** zoneLabels that do not match any known island/region prefix — surfaced as "Wilayah Lainnya". */
export function orphanZoneLabels(zoneLabels: string[]): string[] {
  return zoneLabels
    .filter((label) => !TELKOMSEL_REGION_ORDER.some((region) => zoneLabelBelongsToRegion(label, region)))
    .sort((a, b) => a.localeCompare(b, 'id'));
}

export function filterProductsByZoneLabel(products: Product[], zoneLabel: string): Product[] {
  return products.filter((p) => p.zoneLabel === zoneLabel);
}

export function telkomselNationalProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.zoneLabel);
}

export function zoneLabelsWithoutCityData(
  reference: Record<string, string[]>,
  zoneLabels: string[],
  region: TelkomselRegionKey
): string[] {
  return zoneLabelsForRegion(zoneLabels, region).filter((label) => !reference[label]?.length);
}

/** Flat {city, zoneLabel} pairs for zones in a region that have city reference data. */
export function buildCityZoneListForRegion(
  reference: Record<string, string[]>,
  zoneLabels: string[],
  region: TelkomselRegionKey
): TelkomselCityZoneEntry[] {
  const entries: TelkomselCityZoneEntry[] = [];
  for (const zoneLabel of zoneLabelsForRegion(zoneLabels, region)) {
    const cities = reference[zoneLabel];
    if (!cities?.length) continue;
    for (const city of cities) {
      entries.push({ city, zoneLabel });
    }
  }
  return entries.sort((a, b) => a.city.localeCompare(b.city, 'id'));
}

export function uniqueCityNamesForRegion(
  reference: Record<string, string[]>,
  zoneLabels: string[],
  region: TelkomselRegionKey
): string[] {
  const names = new Set(buildCityZoneListForRegion(reference, zoneLabels, region).map((entry) => entry.city));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'id'));
}

export function filterCities(cities: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return cities;
  return cities.filter((city) => city.toLowerCase().includes(q));
}

/** All zone labels that include the given city name within availableZoneLabels. */
export function zoneLabelsForCity(
  city: string,
  reference: Record<string, string[]>,
  availableZoneLabels: string[]
): string[] {
  const cityLower = city.trim().toLowerCase();
  if (!cityLower) return [];

  const matches: string[] = [];
  for (const zoneLabel of availableZoneLabels) {
    const cities = reference[zoneLabel];
    if (cities?.some((entry) => entry.toLowerCase() === cityLower)) {
      matches.push(zoneLabel);
    }
  }
  return matches.sort((a, b) => a.localeCompare(b, 'id'));
}

/** Returns ALL zone labels whose city reference matches the query — never auto-picks one. */
export function searchCityForZoneLabel(
  query: string,
  reference: Record<string, string[]>,
  availableZoneLabels: string[]
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = new Set<string>();
  for (const zoneLabel of availableZoneLabels) {
    const cities = reference[zoneLabel];
    if (!cities?.length) continue;
    for (const city of cities) {
      const cityLower = city.toLowerCase();
      if (cityLower.includes(q) || q.includes(cityLower)) {
        matches.add(zoneLabel);
      }
    }
  }

  return Array.from(matches).sort((a, b) => a.localeCompare(b, 'id'));
}

export function categoryWarningLabel(category: TelkomselCategoryKey): string {
  if (category === 'orphan') return 'Wilayah Lainnya';
  return TELKOMSEL_REGION_LABELS[category];
}
