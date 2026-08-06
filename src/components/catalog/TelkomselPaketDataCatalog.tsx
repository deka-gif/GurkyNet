import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  Wifi,
  Package,
  Flame,
  Share2,
  Gamepad2,
  PlayCircle,
  Moon,
  Globe,
  Briefcase,
  LayoutGrid,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { formatIDR } from '../../utils/currency';

type Chip = {
  key: string;
  label: string;
  group: string | null;
  icon?: string;
};

type Props = {
  phoneNo: string;
  selectedProduct: Product | null;
  onSelectProduct: (p: Product) => void;
  onRegionNeeded?: (product: Product) => void;
};

const CHIP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  star: Star,
  wifi: Wifi,
  package: Package,
  flame: Flame,
  share: Share2,
  game: Gamepad2,
  play: PlayCircle,
  moon: Moon,
  globe: Globe,
  briefcase: Briefcase,
};

const DEFAULT_CHIPS: Chip[] = [
  { key: 'semua', label: 'Semua', group: null, icon: 'all' },
  { key: 'favorit', label: 'Favorit', group: 'favorit', icon: 'star' },
  { key: 'internet-sakti', label: 'Internet Sakti', group: 'internet-sakti', icon: 'wifi' },
  { key: 'combo-sakti', label: 'Combo Sakti', group: 'combo-sakti', icon: 'package' },
  { key: 'promo', label: 'Promo', group: 'promo', icon: 'flame' },
  { key: 'sosial', label: 'Sosial', group: 'sosial', icon: 'share' },
  { key: 'game', label: 'Games', group: 'games', icon: 'game' },
  { key: 'streaming', label: 'Streaming', group: 'streaming', icon: 'play' },
  { key: 'harian', label: 'Harian', group: 'harian', icon: 'moon' },
  { key: 'roaming', label: 'Roaming', group: 'roaming', icon: 'globe' },
  { key: 'bisnis', label: 'Bisnis', group: 'bisnis', icon: 'briefcase' },
];

function ProductSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-200 rounded w-16" />
        <div className="h-5 bg-gray-200 rounded w-20" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-1/3 ml-auto" />
    </div>
  );
}

/**
 * Telkomsel Paket Data master UX template — filter chips + lazy API loads.
 * Products always from Digiflazz/VIP via GET /products (no hardcode).
 */
export function TelkomselPaketDataCatalog({
  phoneNo,
  selectedProduct,
  onSelectProduct,
  onRegionNeeded,
}: Props) {
  const [chips, setChips] = useState<Chip[]>(DEFAULT_CHIPS);
  const [activeChip, setActiveChip] = useState('semua');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productService.getTelkomselDataTaxonomy().then((res) => {
      if (res.success && Array.isArray(res.data?.chips) && res.data.chips.length > 0) {
        setChips(res.data.chips);
      }
    }).catch(() => {
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
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await productService.getProducts({
          category: 'data',
          provider: 'Telkomsel',
          keyword: debouncedSearch || undefined,
          telkomsel_group: activeGroup || undefined,
          sort: sort === 'default' ? undefined : sort,
          page: pageNum,
          per_page: 24,
        });
        if (!res.success) {
          setError(res.message || 'Gagal memuat produk.');
          if (!append) setProducts([]);
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        const pag = res.pagination;
        if (pag) {
          setHasMore(pag.currentPage < pag.lastPage);
        } else {
          setHasMore(rows.length >= 24);
        }
        setPage(pageNum);
      } catch (e: any) {
        setError(e?.message || 'Gagal memuat produk Telkomsel.');
        if (!append) setProducts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeGroup, debouncedSearch, sort]
  );

  useEffect(() => {
    setProducts([]);
    setPage(1);
    loadPage(1, false);
  }, [loadPage]);

  const handleSelect = (p: Product) => {
    if (p.requiresRegion && onRegionNeeded) {
      onRegionNeeded(p);
    }
    onSelectProduct(p);
  };

  return (
    <div className="space-y-4">
      {/* Provider header */}
      <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-600/20">
          T
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-gray-900 text-base tracking-tight">TELKOMSEL</h3>
          <p className="text-sm font-bold text-gray-700 mt-0.5">{phoneNo || '—'}</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Operator terdeteksi otomatis</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari paket Telkomsel..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
        />
      </div>

      {/* Filter chips — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {chips.map((chip) => {
          const Icon = CHIP_ICONS[chip.icon || 'all'] || LayoutGrid;
          const active = activeChip === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveChip(chip.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
                active
                  ? 'bg-red-600 border-red-600 text-white shadow-sm'
                  : 'bg-white border-gray-100 text-gray-600 hover:border-red-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400 font-semibold">
          {loading ? 'Memuat…' : `${products.length} paket`}
        </p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="text-xs font-bold bg-white border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="default">Urutan default</option>
          <option value="price_asc">Harga Termurah</option>
          <option value="price_desc">Harga Tertinggi</option>
          <option value="popular">Terlaris</option>
          <option value="newest">Terbaru</option>
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 font-semibold flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-14 text-center border border-dashed border-gray-200 rounded-3xl bg-white">
          <Wifi className="w-8 h-8 mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-extrabold text-gray-700">Tidak ada produk pada kategori ini.</p>
          <p className="text-xs text-gray-400 mt-1">Coba filter lain atau ubah kata pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const active = selectedProduct?.id === p.id || selectedProduct?.code === p.code;
            return (
              <button
                key={p.id || p.code}
                type="button"
                onClick={() => handleSelect(p)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? 'border-red-500 bg-red-50/50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-red-200'
                }`}
              >
                <div className="font-extrabold text-gray-900 text-sm leading-snug">{p.name}</div>
                {(p.quota || p.validity) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.quota && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-100">
                        {p.quota}
                      </span>
                    )}
                    {p.validity && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {p.validity}
                      </span>
                    )}
                  </div>
                )}
                {p.description && (
                  <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 leading-relaxed">{p.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {p.telkomselGroupLabel || p.telkomselGroup || 'Paket'}
                  </span>
                  <span className="text-sm font-black text-red-600">{formatIDR(p.price)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => loadPage(page + 1, true)}
          className="w-full py-3 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 hover:border-red-200 disabled:opacity-50"
        >
          {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
        </button>
      )}
    </div>
  );
}
