import type { Category } from '../services/catalog.service';

/**
 * Presentation IA for Mobile "Lainnya" / Katalog — mirrors Web
 * `src/config/catalogCategories.ts` → `HUB_CATEGORY_SLUGS` + hub labels from
 * `DASHBOARD_SERVICE_CATEGORIES` / `laravel/config/category_icon_keys.php`.
 *
 * Does not invent product categories: only groups existing GET /categories rows.
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

/** Same order as Web Home hubs (excluding transfer / semua-produk index). */
export const CATALOG_GROUPS: CatalogGroupDef[] = [
  {
    id: 'telco',
    title: 'Telekomunikasi',
    slugOrder: [
      'pulsa',
      'data',
      'paket-data',
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
      'token-pln',
      'pln-pascabayar',
      'pdam',
      'bpjs-kesehatan',
      'bpjs-tk',
      'bpjs',
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
        'token-pln': 'pln',
        'pln-pascabayar': 'pln-pascabayar',
        pdam: 'pdam',
        'bpjs-kesehatan': 'bpjs',
        'bpjs-tk': 'bpjs',
        bpjs: 'bpjs',
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
    slugOrder: ['topup-digital', 'ewallet', 'e-money'],
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
    slugOrder: ['voucher-digital', 'voucher'],
    iconKeysForSlug: () => ['hub:voucher'],
  },
  {
    id: 'langganan',
    title: 'Langganan',
    slugOrder: ['langganan-digital', 'langganan', 'streaming'],
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
 * Partition API categories into Web hub groups. Unmapped slugs go to "Lainnya"
 * (presentation fallback — same idea as Web Marketing brand "Lainnya" bucket).
 * Empty groups are omitted. No category is dropped.
 */
export function groupCategoriesForCatalog(categories: Category[]): CatalogGroupSection[] {
  const remaining = new Map(categories.map((c) => [c.slug, c]));
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

  const leftovers = Array.from(remaining.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'id')
  );
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
