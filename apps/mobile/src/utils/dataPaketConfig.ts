import type { DetectedOperator } from './detectOperator';

/**
 * Paket Data catalog configs + region option lists — mirrored from Web
 * `PaketDataPage.tsx` + `TelkomselPaketDataCatalog.tsx` (display/taxonomy only).
 */

export type DataTaxonomyKey = 'telkomsel' | 'xl' | 'indosat' | 'tri' | 'smartfren' | 'axis' | 'byu';

export type DataChip = {
  key: string;
  label: string;
  group: string | null;
};

export type OperatorPaketCatalogConfig = {
  operatorLabel: string;
  providerApiName: string;
  taxonomyKey: DataTaxonomyKey;
  searchPlaceholder: string;
  defaultChips: DataChip[];
};

const TELKOMSEL_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'internet-sakti', label: 'Internet Sakti', group: 'internet-sakti' },
  { key: 'combo-sakti', label: 'Combo Sakti', group: 'combo-sakti' },
  { key: 'promo', label: 'Promo', group: 'promo' },
  { key: 'sosial', label: 'Sosial', group: 'sosial' },
  { key: 'games', label: 'Games', group: 'games' },
  { key: 'streaming', label: 'Streaming', group: 'streaming' },
  { key: 'harian', label: 'Harian', group: 'harian' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
  { key: 'bisnis', label: 'Bisnis', group: 'bisnis' },
];

const XL_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'paket-akrab', label: 'Paket Akrab', group: 'paket-akrab' },
  { key: 'xtra-combo', label: 'Xtra Combo', group: 'xtra-combo' },
  { key: 'combo-lite', label: 'Combo Lite', group: 'combo-lite' },
  { key: 'murah', label: 'Murah', group: 'murah' },
  { key: 'kuota-tambahan', label: 'Kuota Tambahan', group: 'kuota-tambahan' },
  { key: 'gift', label: 'Gift', group: 'gift' },
  { key: '5g', label: '5G', group: '5g' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
];

const INDOSAT_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'freedom', label: 'Freedom', group: 'freedom' },
  { key: 'freedom-apps', label: 'Freedom Apps', group: 'freedom-apps' },
  { key: 'gift', label: 'Gift', group: 'gift' },
  { key: '5g', label: '5G', group: '5g' },
  { key: 'bisnis', label: 'Bisnis', group: 'bisnis' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
];

const TRI_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'alwayson', label: 'AlwaysOn', group: 'alwayson' },
  { key: 'happy', label: 'Happy', group: 'happy' },
  { key: 'paket-harian', label: 'Paket Harian', group: 'paket-harian' },
  { key: 'unlimited', label: 'Unlimited', group: 'unlimited' },
  { key: 'hiburan', label: 'Hiburan', group: 'hiburan' },
  { key: 'khusus', label: 'Khusus', group: 'khusus' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
];

const SMARTFREN_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'unlimited', label: 'Unlimited', group: 'unlimited' },
  { key: 'aplikasi', label: 'Aplikasi', group: 'aplikasi' },
  { key: 'hiburan', label: 'Hiburan', group: 'hiburan' },
  { key: 'router', label: 'Router', group: 'router' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
];

const AXIS_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'warnet', label: 'Warnet', group: 'warnet' },
  { key: 'aplikasi', label: 'Aplikasi', group: 'aplikasi' },
  { key: 'hiburan', label: 'Hiburan', group: 'hiburan' },
  { key: 'produktivitas', label: 'Produktivitas', group: 'produktivitas' },
  { key: 'umroh', label: 'Umroh', group: 'umroh' },
];

const BYU_DEFAULT_CHIPS: DataChip[] = [
  { key: 'semua', label: 'Semua', group: null },
  { key: 'favorit', label: 'Favorit', group: 'favorit' },
  { key: 'unlimited', label: 'Unlimited', group: 'unlimited' },
  { key: 'topping', label: 'Topping', group: 'topping' },
  { key: 'jajan', label: 'Jajan', group: 'jajan' },
  { key: 'roaming', label: 'Roaming', group: 'roaming' },
];

export const DATA_PAKET_CONFIGS: Record<DetectedOperator, OperatorPaketCatalogConfig> = {
  Telkomsel: {
    operatorLabel: 'Telkomsel',
    providerApiName: 'Telkomsel',
    taxonomyKey: 'telkomsel',
    searchPlaceholder: 'Cari paket Telkomsel...',
    defaultChips: TELKOMSEL_DEFAULT_CHIPS,
  },
  'XL Axiata': {
    operatorLabel: 'XL',
    providerApiName: 'XL',
    taxonomyKey: 'xl',
    searchPlaceholder: 'Cari paket XL...',
    defaultChips: XL_DEFAULT_CHIPS,
  },
  Indosat: {
    operatorLabel: 'Indosat',
    providerApiName: 'Indosat',
    taxonomyKey: 'indosat',
    searchPlaceholder: 'Cari paket Indosat...',
    defaultChips: INDOSAT_DEFAULT_CHIPS,
  },
  'Tri (3)': {
    operatorLabel: 'Tri',
    providerApiName: 'Tri',
    taxonomyKey: 'tri',
    searchPlaceholder: 'Cari paket Tri...',
    defaultChips: TRI_DEFAULT_CHIPS,
  },
  Smartfren: {
    operatorLabel: 'Smartfren',
    providerApiName: 'Smartfren',
    taxonomyKey: 'smartfren',
    searchPlaceholder: 'Cari paket Smartfren...',
    defaultChips: SMARTFREN_DEFAULT_CHIPS,
  },
  Axis: {
    operatorLabel: 'AXIS',
    providerApiName: 'AXIS',
    taxonomyKey: 'axis',
    searchPlaceholder: 'Cari paket AXIS...',
    defaultChips: AXIS_DEFAULT_CHIPS,
  },
  'by.U': {
    operatorLabel: 'by.U',
    providerApiName: 'by.U',
    taxonomyKey: 'byu',
    searchPlaceholder: 'Cari paket by.U...',
    defaultChips: BYU_DEFAULT_CHIPS,
  },
};

/** Same hardcoded lists as Web PaketDataPage (taxonomy regionOptions unused on FE). */
export function regionOptionsForOperator(operator: DetectedOperator | null): string[] {
  switch (operator) {
    case 'Telkomsel':
      return ['Area 1', 'Area 2', 'Area 3'];
    case 'XL Axiata':
      return ['Sumatera', 'West', 'Central', 'East', 'East Kalsul'];
    case 'Indosat':
      return ['Jabodetabek', 'Jawa Barat', 'Jawa Tengah', 'EJBN', 'Sumatera', 'Kalisumapa'];
    case 'Tri (3)':
      return ['Jakarta Raya', 'Jawa Barat', 'Jawa Tengah', 'EJBN', 'Lokal'];
    case 'Axis':
      return [
        'Jawa Timur',
        'Jawa Bali Nusra',
        'Non Jawa Bali Nusra',
        'Sukabumi',
        'Semarang-Salatiga',
        'Salatiga',
        'Kendal',
        'Banyuwangi Probolinggo',
        'Madura Sidoarjo Malang Sumbawa',
        'Salatiga Jatim Sulawesi',
        'Sulawesi Ewako',
        'Sulutra',
        'NTT',
      ];
    case 'Smartfren':
    case 'by.U':
    default:
      return [];
  }
}
