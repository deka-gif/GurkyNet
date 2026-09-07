import type { Category } from '../services/catalog.service';

/**
 * Presentation IA for Mobile "Lainnya" / Katalog — mirrors Web
 * `src/config/catalogCategories.ts` → `HUB_CATEGORY_SLUGS` + hub labels from
 * `DASHBOARD_SERVICE_CATEGORIES` / `laravel/config/category_icon_keys.php`.
 *
 * Does not invent product categories: only groups existing GET /categories rows.
 * Raw/legacy provider slugs are never dumped into "Lainnya" (backend should already
 * filter; this is a customer-facing safety net).
 */

export type CatalogGroupId =
  | 'telco'
  | 'tagihan'
  | 'topup-digital'
  | 'game'
  | 'voucher'
  | 'langganan'
  | 'international'
  | 'lainnya';

export type CatalogGroupDef = {
  id: CatalogGroupId;
  title: string;
  /** ProductCategory.slug order within the group (Web HUB_CATEGORY_SLUGS + aliases). */
  slugOrder: string[];
  /**
   * Marketing icon key resolver: prefers `sub:{hub}:{child}` then `hub:{hub}`.
   * childKey may differ from slug (e.g. internet-pascabayar → internet).
   */
  iconKeysForSlug: (slug: string) => string[];
};

/** Canonical customer-facing slugs (must stay in sync with backend allowlist). */
export const CUSTOMER_FACING_SLUGS = new Set([
  'pulsa',
  'data',
  'voucher-internet',
  'sms-telepon',
  'masa-aktif',
  'aktivasi-perdana',
  'esim',
  'pln',
  'pln-pascabayar',
  'pdam',
  'bpjs-kesehatan',
  'bpjs-tk',
  'internet-pascabayar',
  'tv-pascabayar',
  'gas',
  'pbb',
  'samsat',
  'multifinance',
  'tagihan',
  'topup-digital',
  'game',
  'voucher-digital',
  'langganan-digital',
  'international',
  'transfer',
]);

/** Known raw/legacy aliases — never show as their own tile in Lainnya. */
const HIDDEN_RAW_SLUGS = new Set([
  'game-feature',
  'gamed',
  'voucher-game',
  'topup-game',
  'top-up-game',
  'games',
  'saldo-emoney',
  'emoney',
  'e-money',
  'e-wallet',
  'ewallet',
  'streaming-tv',
  'streaming',
  'aplikasi',
  'apps',
  'voucher',
  'prepaid',
  'paket-data',
  'paket_data',
  'token-pln',
  'bpjs',
  'langganan',
]);

export function isHiddenRawCategorySlug(slug: string): boolean {
  const s = String(slug ?? '')
    .trim()
    .toLowerCase();
  if (!s) return true;
  if (HIDDEN_RAW_SLUGS.has(s)) return true;
  if (s.startsWith('pulsa-') || s.startsWith('paket-')) return true;
  if (!CUSTOMER_FACING_SLUGS.has(s)) return true;
  return false;
}

/** Same order as Web Home hubs (excluding transfer / semua-produk index). */
export const CATALOG_GROUPS: CatalogGroupDef[] = [
  {
    id: 'telco',
    title: 'Telekomunikasi',
    slugOrder: [
      'pulsa',
      'data',
      'voucher-internet',
      'sms-telepon',
      'masa-aktif',
      'aktivasi-perdana',
      'esim',
    ],
    iconKeysForSlug: (slug) => {
      const child = slug === 'paket-data' ? 'data' : slug;
      return [`sub:telco:${child}`, 'hub:telco'];
    },
  },
  {
    id: 'tagihan',
    title: 'Tagihan',
    slugOrder: [
      'pln',
      'pln-pascabayar',
      'pdam',
      'bpjs-kesehatan',
      'bpjs-tk',
      'internet-pascabayar',
      'tv-pascabayar',
      'gas',
      'pbb',
      'samsat',
      'multifinance',
      'tagihan',
    ],
    iconKeysForSlug: (slug) => {
      const childMap: Record<string, string> = {
        pln: 'pln',
        'pln-pascabayar': 'pln-pascabayar',
        pdam: 'pdam',
        'bpjs-kesehatan': 'bpjs',
        'bpjs-tk': 'bpjs',
        'internet-pascabayar': 'internet',
        'tv-pascabayar': 'tv',
        gas: 'gas',
        pbb: 'pbb',
        samsat: 'samsat',
        multifinance: 'multifinance',
        tagihan: 'lainnya',
      };
      const child = childMap[slug] || slug;
      return [`sub:tagihan:${child}`, 'hub:tagihan'];
    },
  },
  {
    id: 'topup-digital',
    title: 'E-Wallet',
    // Only canonical slug — never surface e-money / ewallet as separate menus.
    slugOrder: ['topup-digital'],
    iconKeysForSlug: () => ['hub:topup-digital'],
  },
  {
    id: 'game',
    title: 'Game',
    slugOrder: ['game'],
    iconKeysForSlug: () => ['hub:game'],
  },
  {
    id: 'voucher',
    title: 'Voucher Digital',
    // Keep separate from voucher-internet (telco).
    slugOrder: ['voucher-digital'],
    iconKeysForSlug: () => ['hub:voucher'],
  },
  {
    id: 'langganan',
    title: 'Langganan',
    slugOrder: ['langganan-digital'],
    iconKeysForSlug: () => ['hub:langganan'],
  },
  {
    id: 'international',
    title: 'International',
    slugOrder: ['international'],
    iconKeysForSlug: () => ['hub:international'],
  },
];

export type CatalogGroupSection = {
  id: CatalogGroupId;
  title: string;
  categories: Category[];
  iconKeysForSlug: (slug: string) => string[];
};

/**
 * Partition API categories into Web hub groups.
 * "Lainnya" only receives real CF slugs (e.g. transfer) — never raw provider taxonomy.
 */
export function groupCategoriesForCatalog(categories: Category[]): CatalogGroupSection[] {
  const remaining = new Map(
    categories
      .filter((c) => !isHiddenRawCategorySlug(c.slug))
      .map((c) => [c.slug, c])
  );
  const sections: CatalogGroupSection[] = [];

  for (const group of CATALOG_GROUPS) {
    const items: Category[] = [];
    for (const slug of group.slugOrder) {
      const hit = remaining.get(slug);
      if (hit) {
        items.push(hit);
        remaining.delete(slug);
      }
    }
    if (items.length > 0) {
      sections.push({
        id: group.id,
        title: group.title,
        categories: items,
        iconKeysForSlug: group.iconKeysForSlug,
      });
    }
  }

  const leftovers = Array.from(remaining.values())
    .filter((c) => CUSTOMER_FACING_SLUGS.has(c.slug) && !isHiddenRawCategorySlug(c.slug))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  if (leftovers.length > 0) {
    sections.push({
      id: 'lainnya',
      title: 'Lainnya',
      categories: leftovers,
      iconKeysForSlug: () => [],
    });
  }

  return sections;
}
