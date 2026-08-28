import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  DASHBOARD_SERVICE_CATEGORIES,
  PRODUCT_COUNT_CATEGORY_KEYS,
  type DashboardServiceCategory,
} from '../../config/catalogCategories';
import { productService } from '../../services/product/product.service';
import { CacheTTL, cachedFetch } from '../../utils/queryCache';

type ServiceCategoryGridProps = {
  onSelect: (category: DashboardServiceCategory) => void;
  activeId?: string | null;
};

/** Brand-aligned icon tones — overrides pastel catalog tones without editing catalogCategories.ts */
const BRAND_CATEGORY_TONES: Record<string, string> = {
  all: 'bg-primary-100 text-primary-700 border-primary-200',
  telco: 'bg-primary-50 text-primary-600 border-primary-100',
  tagihan: 'bg-primary-100 text-primary-800 border-primary-200',
  pln: 'bg-accent-300/40 text-primary-800 border-accent-400/40',
  'voucher-digital': 'bg-primary-50 text-primary-700 border-primary-100',
  voucher: 'bg-primary-50 text-primary-700 border-primary-100',
  game: 'bg-primary-100 text-primary-600 border-primary-200',
  'topup-digital': 'bg-accent-300/30 text-primary-800 border-accent-400/35',
  transfer: 'bg-primary-50 text-primary-700 border-primary-100',
  international: 'bg-primary-100 text-primary-700 border-primary-200',
  langganan: 'bg-accent-300/25 text-primary-800 border-accent-400/30',
};

function categoryTone(cat: DashboardServiceCategory): string {
  return BRAND_CATEGORY_TONES[cat.id] ?? 'bg-primary-50 text-primary-600 border-primary-100';
}

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-slate-100" />
          <div className="mx-auto mb-2 h-3 w-20 rounded bg-slate-100" />
          <div className="mx-auto h-2.5 w-14 rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

/**
 * Fintech-style service category grid for User Dashboard.
 */
export const ServiceCategoryGrid = memo(function ServiceCategoryGrid({
  onSelect,
  activeId,
}: ServiceCategoryGridProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      setLoadingCounts(true);
      try {
        const entries = await Promise.all(
          PRODUCT_COUNT_CATEGORY_KEYS.map(async (key) => {
            try {
              const total = await cachedFetch<number>({
                key: `product-count:${key}`,
                ttlMs: CacheTTL.PRODUCT_COUNT,
                fetcher: async () => {
                  const res = await productService.getProducts({
                    category: key,
                    per_page: 1,
                    page: 1,
                  });
                  return (
                    res.pagination?.total ??
                    (Array.isArray(res.data) ? res.data.length : 0)
                  );
                },
              });
              return [key, Number(total) || 0] as const;
            } catch {
              return [key, 0] as const;
            }
          })
        );
        if (!cancelled) setCounts(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    };

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => DASHBOARD_SERVICE_CATEGORIES, []);

  const resolveCount = (cat: DashboardServiceCategory): number | null => {
    if (cat.id === 'all') {
      return Object.values(counts).reduce((a, b) => a + b, 0) || null;
    }
    if (cat.mode === 'navigate') return null;
    if (cat.productCategory && counts[cat.productCategory] != null) {
      return counts[cat.productCategory];
    }
    if (cat.hubChildren?.length) {
      const sum = cat.hubChildren.reduce((acc, child) => {
        if (!child.productCategory) return acc;
        return acc + (counts[child.productCategory] || 0);
      }, 0);
      return sum > 0 ? sum : null;
    }
    return null;
  };

  if (loadingCounts && Object.keys(counts).length === 0) {
    return (
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/40 md:p-7">
        <div className="mb-5">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-50" />
        </div>
        <CategorySkeleton />
      </section>
    );
  }

  return (
    <section className="dashboard-panel">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 md:text-xl">
            Layanan PPOB & Pembayaran
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">Pilih kategori untuk mulai transaksi</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const count = resolveCount(cat);
          const isActive = activeId === cat.id;

          return (
            <motion.button
              key={cat.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(cat)}
              className={`group relative flex cursor-pointer flex-col items-center rounded-2xl border bg-white px-3 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                isActive
                  ? 'border-primary-300 shadow-md shadow-primary-900/10 ring-2 ring-primary-500/20'
                  : 'border-gray-100 hover:border-primary-200'
              }`}
            >
              {cat.badge ? (
                <span
                  className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                    cat.badge === 'Promo'
                      ? 'bg-accent-300/50 text-primary-800'
                      : 'bg-primary-100 text-primary-700'
                  }`}
                >
                  {cat.badge}
                </span>
              ) : null}

              <div
                className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-200 will-change-transform group-hover:scale-105 ${categoryTone(cat)}`}
              >
                <Icon className="h-7 w-7" />
              </div>

              <div className="text-sm font-bold text-slate-900 group-hover:text-primary-700">
                {cat.label}
              </div>
              <div className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-400">
                {count != null ? `${count.toLocaleString('id-ID')} produk` : cat.description}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
});

export default ServiceCategoryGrid;
