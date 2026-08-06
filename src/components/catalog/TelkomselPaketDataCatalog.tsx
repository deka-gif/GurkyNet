import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Wifi, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { formatIDR } from '../../utils/currency';

type Chip = {
  key: string;
  label: string;
  group: string | null;
};

type Props = {
  selectedProduct: Product | null;
  onSelectProduct: (p: Product) => void;
  onBuy: (p: Product) => void;
  onRegionNeeded?: (product: Product) => void;
};

const DEFAULT_CHIPS: Chip[] = [
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

const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Harga Termurah' },
  { value: 'price_desc', label: 'Harga Termahal' },
  { value: 'quota_desc', label: 'Kuota Terbesar' },
  { value: 'validity_desc', label: 'Masa Aktif Terlama' },
  { value: 'popular', label: 'Terlaris' },
  { value: 'newest', label: 'Terbaru' },
];

const BADGE_STYLES: Record<string, string> = {
  TERLARIS: 'bg-red-500 text-white',
  FAVORIT: 'bg-rose-500 text-white',
  PROMO: 'bg-orange-500 text-white',
  BARU: 'bg-sky-500 text-white',
};

const PER_PAGE = 20;

function ProductSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 space-y-3 h-[200px]">
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-4/5" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded w-14" />
        <div className="h-5 bg-gray-100 rounded w-16" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-5 bg-gray-200 rounded w-1/2 mt-auto" />
      <div className="h-9 bg-gray-100 rounded-xl w-full" />
    </div>
  );
}

/**
 * Telkomsel Paket Data — marketplace master UX (Tokopedia/Shopee style).
 * Products from Digiflazz/VIP via GET /products only.
 */
export function TelkomselPaketDataCatalog({
  selectedProduct,
  onSelectProduct,
  onBuy,
  onRegionNeeded,
}: Props) {
  const [chips, setChips] = useState<Chip[]>(DEFAULT_CHIPS);
  const [activeChip, setActiveChip] = useState('semua');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('price_asc');
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productService
      .getTelkomselDataTaxonomy()
      .then((res) => {
        if (res.success && Array.isArray(res.data?.chips) && res.data.chips.length > 0) {
          setChips(
            res.data.chips.map((c: Chip) => ({
              key: c.key,
              label: c.label,
              group: c.group ?? null,
            }))
          );
        }
      })
      .catch(() => {
        /* keep DEFAULT_CHIPS */
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const activeGroup = useMemo(() => {
    const chip = chips.find((c) => c.key === activeChip);
    return chip?.group || null;
  }, [chips, activeChip]);

  const loadPage = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await productService.getProducts({
          category: 'data',
          provider: 'Telkomsel',
          keyword: debouncedSearch || undefined,
          telkomsel_group: activeGroup || undefined,
          sort,
          page: pageNum,
          per_page: PER_PAGE,
        });
        if (!res.success) {
          setError(res.message || 'Gagal memuat produk.');
          setProducts([]);
          setTotal(0);
          setLastPage(1);
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts(rows);
        const pag = res.pagination;
        if (pag) {
          const current = pag.currentPage ?? pag.current_page ?? pageNum;
          const last = pag.lastPage ?? pag.last_page ?? 1;
          const tot = pag.total ?? rows.length;
          setPage(current);
          setLastPage(Math.max(1, last));
          setTotal(tot);
        } else {
          setPage(pageNum);
          setLastPage(1);
          setTotal(rows.length);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal memuat produk Telkomsel.';
        setError(msg);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [activeGroup, debouncedSearch, sort]
  );

  useEffect(() => {
    setPage(1);
    loadPage(1);
  }, [loadPage]);

  const handleBuy = (p: Product) => {
    if (p.requiresRegion && onRegionNeeded) {
      onRegionNeeded(p);
    }
    onSelectProduct(p);
    onBuy(p);
  };

  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    if (lastPage <= maxButtons) {
      return Array.from({ length: lastPage }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(page - 2, lastPage - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i).filter((n) => n <= lastPage);
  }, [page, lastPage]);

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari paket Telkomsel..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="sm:w-52 shrink-0">
          <label className="sr-only">Urutkan</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full h-full min-h-[48px] text-sm font-semibold bg-white border border-gray-200 rounded-2xl px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter chips — text only, horizontal scroll */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {chips.map((chip) => {
          const active = activeChip === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveChip(chip.key)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold border transition-colors ${
                active
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm shadow-primary-600/20'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:text-primary-700'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-gray-500">
        {loading ? 'Memuat paket…' : `${total || products.length} paket ditemukan`}
      </p>

      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 font-semibold flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Responsive marketplace grid: 1 / 2 / 4 / 5 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-gray-200 rounded-3xl bg-white">
          <Wifi className="w-8 h-8 mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-extrabold text-gray-700">Tidak ada produk pada kategori ini.</p>
          <p className="text-xs text-gray-400 mt-1">Coba filter lain atau ubah kata pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {products.map((p) => {
            const active = selectedProduct?.id === p.id || selectedProduct?.code === p.code;
            const badge = p.badge;
            return (
              <article
                key={p.id || p.code}
                className={`flex flex-col rounded-2xl border bg-white p-4 transition-all ${
                  active
                    ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md'
                    : 'border-gray-100 shadow-sm hover:border-primary-200 hover:shadow-md'
                }`}
              >
                {badge ? (
                  <span
                    className={`self-start text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded-md mb-2 ${
                      BADGE_STYLES[badge] || 'bg-gray-700 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                ) : (
                  <span className="h-5 mb-2" aria-hidden />
                )}

                <h4 className="font-extrabold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                  {p.name}
                </h4>

                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-bold text-gray-600">
                  {p.quota && <span>{p.quota}</span>}
                  {p.validity && <span>{p.validity}</span>}
                </div>

                {p.description ? (
                  <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 leading-relaxed flex-1">
                    {p.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}

                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="text-base font-black text-red-600 leading-none">{formatIDR(p.price)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleBuy(p)}
                  className="mt-3 w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black tracking-wide transition-colors"
                >
                  Beli
                </button>
              </article>
            );
          })}
        </div>
      )}

      {lastPage > 1 && !loading && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => loadPage(page - 1)}
            className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-40 hover:border-primary-300"
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => loadPage(n)}
              className={`min-w-9 h-9 px-2 rounded-xl text-xs font-bold border transition-colors ${
                n === page
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => loadPage(page + 1)}
            className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-40 hover:border-primary-300"
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
