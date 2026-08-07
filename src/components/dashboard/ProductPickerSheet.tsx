import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  PackageOpen,
  Pin,
  PinOff,
  Search,
  Star,
  X,
  ChevronRight,
} from 'lucide-react';
import type { DashboardServiceCategory, CatalogHubChild } from '../../config/catalogCategories';
import { routeForProductCategory } from '../../utils/catalogRoutes';
import { productService } from '../../services/product/product.service';
import type { Product, Transaction } from '../../types';
import { formatIDR } from '../../utils/currency';
import {
  catalogStatusLabel,
  isCatalogListed,
  isProductPurchasable,
} from '../../utils/catalogAvailability';
import { buildRecentProductsFromTransactions } from '../../utils/recentProducts';
import { useFavoriteStore } from '../../store/favorite.store';
import { VirtualList } from '../ui/VirtualList';
import { debounce } from '../../utils/perf';
import { CacheTTL, cachedFetch } from '../../utils/queryCache';

type ProductPickerSheetProps = {
  open: boolean;
  category: DashboardServiceCategory | null;
  transactions: Transaction[];
  onClose: () => void;
};

function estimateProcessLabel(product: Product): string {
  const cat = (product.category || '').toLowerCase();
  if (cat.includes('tagihan') || cat.includes('pln') || cat.includes('pdam')) {
    return '± 1–5 menit';
  }
  if (cat.includes('game') || cat.includes('voucher')) {
    return 'Instan';
  }
  return '± detik';
}

function providerInitials(name?: string) {
  const parts = String(name || 'GN').trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'GN';
}

/**
 * Desktop: centered modern modal.
 * Mobile: full-width bottom sheet.
 */
export function ProductPickerSheet({
  open,
  category,
  transactions,
  onClose,
}: ProductPickerSheetProps) {
  const navigate = useNavigate();
  const { favorites, hydrate, isFavorite, toggleFavorite } = useFavoriteStore();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChild, setActiveChild] = useState<CatalogHubChild | null>(null);
  const [view, setView] = useState<'hub' | 'products'>('hub');
  const productsAbortRef = useRef<AbortController | null>(null);

  const applyDebouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearch(value);
      }, 200),
    []
  );

  useEffect(() => {
    applyDebouncedSearch(search);
    return () => applyDebouncedSearch.cancel();
  }, [search, applyDebouncedSearch]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!open || !category) return;

    setSearch('');
    setError(null);
    setProducts([]);
    setActiveChild(null);

    if (category.mode === 'products' && category.productCategory) {
      setView('products');
      void loadProducts(category.productCategory, category.path);
      return;
    }

    if (category.mode === 'hub') {
      setView('hub');
      return;
    }

    // navigate mode handled by parent
  }, [open, category?.id]);

  useEffect(() => {
    return () => {
      productsAbortRef.current?.abort();
    };
  }, []);

  const loadProducts = async (productCategory: string, _routeHint?: string) => {
    productsAbortRef.current?.abort();
    const controller = new AbortController();
    productsAbortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const listed = await cachedFetch<Product[]>({
        key: `products:cat:${productCategory}`,
        ttlMs: CacheTTL.PRODUCTS,
        fetcher: async () => {
          const res = await productService.getProducts({
            category: productCategory,
            per_page: 5000,
            page: 1,
          });
          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          if (!res.success || !Array.isArray(res.data)) {
            throw new Error(res.message || 'Gagal memuat produk.');
          }
          return res.data.filter(isCatalogListed);
        },
      });
      if (controller.signal.aborted) return;
      setProducts(listed);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setProducts([]);
      setError(err?.message || 'Gagal memuat produk.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const recent = useMemo(
    () => buildRecentProductsFromTransactions(transactions, 6),
    [transactions]
  );

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.name} ${p.code} ${p.operatorName} ${p.badge || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, debouncedSearch]);

  const filteredHub = useMemo(() => {
    const children = category?.hubChildren || [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return children;
    return children.filter((c) =>
      `${c.label} ${c.description || ''}`.toLowerCase().includes(q)
    );
  }, [category, debouncedSearch]);

  const categoryFavorites = useMemo(() => {
    if (!category) return [];
    const keys = new Set<string>();
    if (category.productCategory) keys.add(category.productCategory);
    category.hubChildren?.forEach((c) => {
      if (c.productCategory) keys.add(c.productCategory);
    });
    if (category.id === 'all') return favorites.slice(0, 8);
    return favorites
      .filter((f) => keys.size === 0 || keys.has(f.category) || f.route.includes(category.path.replace('/dashboard/', '')))
      .slice(0, 8);
  }, [favorites, category]);

  const goProduct = (product: Product) => {
    const route = routeForProductCategory(product.category);
    onClose();
    navigate(route, { state: { productCode: product.code, productId: product.id } });
  };

  const openChild = async (child: CatalogHubChild) => {
    if (child.productCategory) {
      setActiveChild(child);
      setView('products');
      setSearch('');
      await loadProducts(child.productCategory, child.path);
      return;
    }
    onClose();
    navigate(child.path);
  };

  const onToggleFavorite = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({
      id: String(product.id),
      code: product.code,
      name: product.name,
      price: product.price,
      category: product.category,
      operatorName: product.operatorName,
      route: routeForProductCategory(product.category),
      badge: product.badge,
    });
  };

  if (!open || !category) return null;

  const title =
    view === 'products' && activeChild ? activeChild.label : category.label;
  const subtitle =
    view === 'products'
      ? 'Pilih produk untuk melanjutkan transaksi'
      : category.description;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-4">
          <motion.button
            type="button"
            aria-label="Tutup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl md:max-h-[85vh] md:max-w-2xl md:rounded-3xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-3 md:pt-5">
              <div className="min-w-0">
                {view === 'products' && category.mode === 'hub' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setView('hub');
                      setActiveChild(null);
                      setProducts([]);
                      setSearch('');
                    }}
                    className="mb-1 cursor-pointer text-[11px] font-bold text-primary-600"
                  >
                    ← Kembali ke {category.label}
                  </button>
                ) : null}
                <h3 className="truncate text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    view === 'hub' ? 'Cari layanan…' : 'Cari produk, provider, kode…'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/15"
                />
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Recent — hide when empty */}
              {recent.length > 0 ? (
                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    Produk Terakhir
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recent.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(item.route);
                        }}
                        className="min-w-[160px] shrink-0 cursor-pointer rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition hover:border-primary-200 hover:bg-primary-50/40"
                      >
                        <div className="truncate text-xs font-bold text-slate-900">
                          {item.productName}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-400">
                          {item.serviceName}
                          {item.targetNo ? ` · ${item.targetNo}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Favorites */}
              {categoryFavorites.length > 0 ? (
                <section>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    Favorit
                  </div>
                  <div className="space-y-2">
                    {categoryFavorites.map((fav) => (
                      <button
                        key={fav.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(fav.route);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/40 px-3 py-2.5 text-left transition hover:bg-amber-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {fav.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {fav.operatorName || fav.category} · {formatIDR(fav.price)}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Hub children */}
              {view === 'hub' ? (
                <section>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Layanan
                  </div>
                  {filteredHub.length === 0 ? (
                    <EmptyCatalog message="Tidak ada layanan yang cocok." />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {filteredHub.map((child) => {
                        const Icon = child.icon;
                        return (
                          <button
                            key={child.key}
                            type="button"
                            onClick={() => void openChild(child)}
                            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left transition hover:border-primary-200 hover:bg-primary-50/30"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-primary-600">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900">{child.label}</div>
                              {child.description ? (
                                <div className="truncate text-[11px] text-slate-400">
                                  {child.description}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400">
                                  {child.productCategory ? 'Lihat produk' : 'Buka layanan'}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {/* Product list */}
              {view === 'products' ? (
                <section>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Daftar Produk
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-[72px] animate-pulse rounded-2xl bg-slate-100"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-center">
                      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" />
                      <p className="text-xs font-bold text-rose-700">{error}</p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <EmptyCatalog message="Belum ada produk di kategori ini." />
                  ) : filteredProducts.length > 40 ? (
                    <VirtualList
                      items={filteredProducts}
                      estimateSize={78}
                      overscan={8}
                      height={Math.min(420, Math.max(240, filteredProducts.length * 20))}
                      getKey={(p) => p.id}
                      className="pr-1"
                      renderItem={(product) => {
                        const purchasable = isProductPurchasable(product);
                        const fav = isFavorite(String(product.id));
                        const status = catalogStatusLabel(product);
                        return (
                          <div className="pb-2">
                            <ProductRow
                              product={product}
                              purchasable={purchasable}
                              fav={fav}
                              status={status}
                              onOpen={() => {
                                if (purchasable) goProduct(product);
                              }}
                              onToggleFavorite={onToggleFavorite}
                            />
                          </div>
                        );
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {filteredProducts.map((product) => {
                        const purchasable = isProductPurchasable(product);
                        const fav = isFavorite(String(product.id));
                        const status = catalogStatusLabel(product);
                        return (
                          <ProductRow
                            key={product.id}
                            product={product}
                            purchasable={purchasable}
                            fav={fav}
                            status={status}
                            onOpen={() => {
                              if (purchasable) goProduct(product);
                            }}
                            onToggleFavorite={onToggleFavorite}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-center text-[10px] text-slate-400 md:hidden">
              Geser ke bawah atau tap di luar untuk menutup
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

const ProductRow = memo(function ProductRow({
  product,
  purchasable,
  fav,
  status,
  onOpen,
  onToggleFavorite,
}: {
  product: Product;
  purchasable: boolean;
  fav: boolean;
  status: string;
  onOpen: () => void;
  onToggleFavorite: (product: Product, e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      disabled={!purchasable}
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition will-change-transform ${
        purchasable
          ? 'cursor-pointer border-slate-100 bg-white hover:border-primary-200 hover:bg-primary-50/20'
          : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70'
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100 text-xs font-black text-slate-600">
        {providerInitials(product.operatorName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-bold text-slate-900">{product.name}</span>
          {product.badge ? (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700">
              {product.badge}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          <span>{product.operatorName || 'Provider'}</span>
          <span>·</span>
          <span>{estimateProcessLabel(product)}</span>
          <span>·</span>
          <span className={purchasable ? 'text-emerald-600' : 'text-amber-600'}>{status}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-black tabular-nums text-slate-900">
          {formatIDR(product.price)}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleFavorite(product, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onToggleFavorite(product, e as any);
          }}
          className="inline-flex cursor-pointer items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-100 hover:text-amber-600"
          title={fav ? 'Hapus favorit' : 'Tambah favorit'}
        >
          {fav ? (
            <Pin className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
          ) : (
            <PinOff className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </button>
  );
});

function EmptyCatalog({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
        <PackageOpen className="h-7 w-7" />
      </div>
      <p className="text-sm font-bold text-slate-700">{message}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        Coba kata kunci lain atau pilih kategori berbeda.
      </p>
    </div>
  );
}

export default ProductPickerSheet;
