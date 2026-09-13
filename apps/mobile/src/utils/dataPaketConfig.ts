import type { DetectedOperator } from './detectOperator';

/**
 * Paket Data catalog configs — Digi brand / taxonomy endpoint keys only.
 * Chips come from GET /catalog/{op}-data/taxonomy (Digi `type`, inventory-backed).
 * `defaultChips` is loading skeleton ("Semua") — never a full hardcode taxonomy.
 */

export type DataTaxonomyKey = 'telkomsel' | 'xl' | 'indosat' | 'tri' | 'smartfren' | 'axis' | 'byu';

export type DataChip = {
  key: string;
  label: string;
  group: string | null;
  /** Exact Digi type when filtering; null for Semua. */
  data_type?: string | null;
};

export type OperatorPaketCatalogConfig = {
  operatorLabel: string;
  providerApiName: string;
  taxonomyKey: DataTaxonomyKey;
  searchPlaceholder: string;
  /** Loading skeleton only — API is source of truth. */
  defaultChips: DataChip[];
};

/** Skeleton while taxonomy API loads — not a curated taxonomy fallback. */
export const SEMUA_CHIP_SKELETON: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null, data_type: null },
];

export const DATA_PAKET_CONFIGS: Record<DetectedOperator, OperatorPaketCatalogConfig> = {
  Telkomsel: {
    operatorLabel: 'Telkomsel',
    providerApiName: 'Telkomsel',
    taxonomyKey: 'telkomsel',
    searchPlaceholder: 'Cari paket Telkomsel...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  'XL Axiata': {
    operatorLabel: 'XL',
    providerApiName: 'XL',
    taxonomyKey: 'xl',
    searchPlaceholder: 'Cari paket XL...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  Indosat: {
    operatorLabel: 'Indosat',
    providerApiName: 'Indosat',
    taxonomyKey: 'indosat',
    searchPlaceholder: 'Cari paket Indosat...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  'Tri (3)': {
    operatorLabel: 'Tri',
    providerApiName: 'Tri',
    taxonomyKey: 'tri',
    searchPlaceholder: 'Cari paket Tri...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  Smartfren: {
    operatorLabel: 'Smartfren',
    providerApiName: 'Smartfren',
    taxonomyKey: 'smartfren',
    searchPlaceholder: 'Cari paket Smartfren...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  Axis: {
    operatorLabel: 'AXIS',
    providerApiName: 'AXIS',
    taxonomyKey: 'axis',
    searchPlaceholder: 'Cari paket AXIS...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
  'by.U': {
    operatorLabel: 'by.U',
    providerApiName: 'by.U',
    taxonomyKey: 'byu',
    searchPlaceholder: 'Cari paket by.U...',
    defaultChips: SEMUA_CHIP_SKELETON,
  },
};

/** @deprecated Prefer taxonomy API regionOptions (inventory-backed). Kept empty for safety. */
export function regionOptionsForOperator(_operator: DetectedOperator | null): string[] {
  return [];
}
