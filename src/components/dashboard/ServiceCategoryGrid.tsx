import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  DASHBOARD_SERVICE_CATEGORIES,
  MOBILE_QUICK_SERVICES,
  PRODUCT_COUNT_CATEGORY_KEYS,
  categoryTone,
  type DashboardServiceCategory,
  type MobileQuickService,
} from '../../config/catalogCategories';
import { productService } from '../../services/product/product.service';
import { CacheTTL, cachedFetch } from '../../utils/queryCache';
import { useCategoryIconMap } from '../../hooks/useCategoryIconMap';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { mapPool } from '../../utils/perf';

type ServiceCategoryGridProps = {
  onSelect: (category: DashboardServiceCategory) => void;
  activeId?: string | null;
  /**
   * When false, desktop product-count fetches stay paused so critical dashboard
   * requests keep browser connection slots. Ignored on mobile (counts never fetched).
   */
  enableProductCounts?: boolean;
};

/** Max parallel GET /products count calls — desktop only. */
const PRODUCT_COUNT_CONCURRENCY = 3;

const COUNT_KEY_SET = new Set<string>(PRODUCT_COUNT_CATEGORY_KEYS);

const LG_MQ = '(min-width: 1024px)';

function useIsDesktopLg(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(LG_MQ).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(LG_MQ);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

/** SKU count keys this card needs before showing a number (null = never waits on counts). */
function countKeysFor(cat: DashboardServiceCategory): string[] | null {
  if (cat.mode === 'navigate') return null;
  if (cat.id === 'all') return [...PRODUCT_COUNT_CATEGORY_KEYS];
  if (cat.productCategory) return [cat.productCategory];
  if (cat.hubChildren?.length) {
    return cat.hubChildren
      .map((child) => child.productCategory)
      .filter((key): key is string => Boolean(key) && COUNT_KEY_SET.has(key));
  }
  return null;
}

function mobileItemToCategory(item: MobileQuickService): DashboardServiceCategory {
  return {
    id: item.id,
    label: item.label,
    description: '',
    icon: item.icon,
    tone: '',
    path: item.path,
    mode: item.id === 'lainnya' ? 'hub' : 'navigate',
  };
}

/**
 * Service category grid — mobile: app-style 4-col icon shortcuts;
 * desktop (lg+): full cards with badges + product counts.
 */
export const ServiceCategoryGrid = memo(function ServiceCategoryGrid({
  onSelect,
  activeId,
  enableProductCounts = true,
}: ServiceCategoryGridProps) {
  const isDesktop = useIsDesktopLg();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  const iconMap = useCategoryIconMap();

  // Product counts only matter on desktop cards — skip entirely on mobile to free connections.
  const shouldFetchCounts = enableProductCounts && isDesktop;

  useEffect(() => {
    if (!shouldFetchCounts) return;

    let cancelled = false;

    void mapPool([...PRODUCT_COUNT_CATEGORY_KEYS], PRODUCT_COUNT_CONCURRENCY, async (key) => {
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
        if (cancelled) return;
        setCounts((prev) => ({ ...prev, [key]: Number(total) || 0 }));
        setSettled((prev) => ({ ...prev, [key]: true }));
      } catch {
        if (cancelled) return;
        setSettled((prev) => ({ ...prev, [key]: true }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldFetchCounts]);

  const categories = useMemo(() => DASHBOARD_SERVICE_CATEGORIES, []);

  const resolveCount = (cat: DashboardServiceCategory): number | null => {
    if (cat.id === 'all') {
      const sum = Object.values(counts).reduce((a, b) => a + b, 0);
      return sum > 0 ? sum : null;
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

  const isCountPending = (cat: DashboardServiceCategory): boolean => {
    if (!shouldFetchCounts) return false;
    const keys = countKeysFor(cat);
    if (!keys || keys.length === 0) return false;
    return keys.some((key) => !settled[key]);
  };

  return (
    <section className="dashboard-panel">
      <div className="mb-4 flex items-end justify-between gap-3 md:mb-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 md:text-xl">
            Layanan PPOB & Pembayaran
          </h2>
          <p className="mt-0.5 hidden text-xs text-gray-400 lg:block">
            Pilih kategori untuk mulai transaksi
          </p>
        </div>
      </div>

      {/* —— Mobile: 4-col icon + label (app-style) —— */}
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 lg:hidden">
        {MOBILE_QUICK_SERVICES.map((item) => {
          const Icon = item.icon;
          const tone = categoryTone(item.toneId);
          const customIconUrl = resolveMediaUrl(
            iconMap[`hub:${item.id}`] || iconMap[`sub:telco:${item.id}`] || ''
          );
          const isActive = activeId === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onSelect(mobileItemToCategory(item))}
              className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-start gap-1.5 rounded-xl px-1 py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                isActive ? 'bg-primary-50/80' : 'active:bg-slate-50'
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.bg}`}
              >
                <div
                  className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-white shadow-md ${tone.gradient} ${tone.shadow}`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/35 via-transparent to-transparent" />
                  {customIconUrl ? (
                    <img
                      src={customIconUrl}
                      alt=""
                      className="relative h-7 w-7 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Icon className="relative h-[18px] w-[18px]" />
                  )}
                </div>
              </div>
              <span className="line-clamp-2 max-w-full text-xs font-semibold leading-tight text-slate-800">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* —— Desktop (lg+): full cards with badge + product counts —— */}
      <div className="hidden grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid lg:grid-cols-4 xl:grid-cols-5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const customIconUrl = resolveMediaUrl(iconMap[`hub:${cat.id}`] || '');
          const count = resolveCount(cat);
          const pending = isCountPending(cat);
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
                  className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm ${
                    cat.badge === 'Promo' ? 'bg-accent-500' : 'bg-primary-600'
                  }`}
                >
                  {cat.badge}
                </span>
              ) : null}

              <div
                className={`relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-200 will-change-transform group-hover:scale-105 ${categoryTone(cat.id).bg}`}
              >
                <div
                  className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-white shadow-md ${categoryTone(cat.id).gradient} ${categoryTone(cat.id).shadow}`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/35 via-transparent to-transparent" />
                  {customIconUrl ? (
                    <img
                      src={customIconUrl}
                      alt={cat.label}
                      className="relative h-9 w-9 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Icon className="relative h-5 w-5" />
                  )}
                </div>
              </div>

              <div className="text-sm font-bold text-slate-900 group-hover:text-primary-700">
                {cat.label}
              </div>
              <div className="mt-1 flex min-h-[14px] items-center justify-center text-[11px] font-medium text-slate-400">
                {pending ? (
                  <span
                    className="inline-block h-2.5 w-14 animate-pulse rounded bg-slate-100"
                    aria-hidden="true"
                  />
                ) : count != null ? (
                  <span className="line-clamp-1">{`${count.toLocaleString('id-ID')} produk`}</span>
                ) : (
                  <span className="line-clamp-1">{cat.description || '—'}</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
});

export default ServiceCategoryGrid;
