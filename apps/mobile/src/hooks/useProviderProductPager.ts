import { useCallback, useRef, useState } from 'react';
import { catalogService, Product, ProductFilters } from '../services/catalog.service';
import { parseApiError } from '../api/client';
import {
  CATALOG_PRODUCT_PAGE_SIZE,
  CATALOG_PRODUCT_PAGE_THRESHOLD,
  CatalogPagination,
  mergeCatalogProductPages,
  shouldPaginateCatalogProducts,
  unwrapCatalogPagination,
} from '../utils/catalogProductPaging';

type BaseFilters = Omit<ProductFilters, 'page' | 'per_page'>;

/**
 * Providers-first product loader (threshold 30 / page 20).
 * Trigger uses pagination.total after visibility filters.
 */
export function useProviderProductPager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<CatalogPagination | null>(null);
  /** Client window when full list already in memory (e.g. VI zone needs complete set). */
  const [displayLimit, setDisplayLimit] = useState<number | null>(null);
  const filtersRef = useRef<BaseFilters | null>(null);
  const requestIdRef = useRef(0);
  /** Sync refs so loadAllRemainingPages works immediately after loadInitial (same tick). */
  const productsRef = useRef<Product[]>([]);
  const paginationRef = useRef<CatalogPagination | null>(null);

  const commitProducts = useCallback((next: Product[]) => {
    productsRef.current = next;
    setProducts(next);
  }, []);

  const commitPagination = useCallback((next: CatalogPagination | null) => {
    paginationRef.current = next;
    setPagination(next);
  }, []);

  const fetchPage = useCallback(async (filters: BaseFilters, page: number, perPage: number) => {
    const res = await catalogService.getProducts({
      ...filters,
      page,
      per_page: perPage,
    });
    const rows = res.success && Array.isArray(res.data) ? res.data : [];
    const pag = unwrapCatalogPagination(res);
    return { ok: !!res.success, message: res.message, rows, pag };
  }, []);

  const loadInitial = useCallback(
    async (filters: BaseFilters) => {
      const reqId = ++requestIdRef.current;
      filtersRef.current = filters;
      setLoading(true);
      setError(null);
      commitProducts([]);
      commitPagination(null);
      setDisplayLimit(null);
      try {
        const first = await fetchPage(filters, 1, CATALOG_PRODUCT_PAGE_SIZE);
        if (reqId !== requestIdRef.current) return null;
        if (!first.ok) {
          commitProducts([]);
          setError(first.message || 'Gagal memuat produk.');
          return null;
        }
        const total = first.pag?.total ?? first.rows.length;
        const lastPage = first.pag?.lastPage ?? 1;

        if (!shouldPaginateCatalogProducts(total)) {
          let all = first.rows;
          if (total > first.rows.length) {
            const rest = await fetchPage(filters, 1, Math.max(total, CATALOG_PRODUCT_PAGE_THRESHOLD));
            if (reqId !== requestIdRef.current) return null;
            if (rest.ok) {
              all = rest.rows;
            } else if (lastPage > 1) {
              for (let p = 2; p <= lastPage; p++) {
                const next = await fetchPage(filters, p, CATALOG_PRODUCT_PAGE_SIZE);
                if (reqId !== requestIdRef.current) return null;
                if (!next.ok) break;
                all = mergeCatalogProductPages(all, next.rows);
              }
            }
          }
          commitProducts(all);
          commitPagination({
            currentPage: 1,
            lastPage: 1,
            perPage: all.length,
            total: all.length,
          });
          setDisplayLimit(null);
          return { products: all, total: all.length, paginated: false };
        }

        commitProducts(first.rows);
        const pag =
          first.pag ?? {
            currentPage: 1,
            lastPage: Math.ceil(total / CATALOG_PRODUCT_PAGE_SIZE),
            perPage: CATALOG_PRODUCT_PAGE_SIZE,
            total,
          };
        commitPagination(pag);
        setDisplayLimit(null);
        return { products: first.rows, total, paginated: true, pagination: pag };
      } catch (err: unknown) {
        if (reqId !== requestIdRef.current) return null;
        commitProducts([]);
        setError(parseApiError(err).message || 'Gagal memuat produk.');
        return null;
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [commitPagination, commitProducts, fetchPage]
  );

  /** Pull remaining API pages into memory (for VI zone labels, etc.). */
  const loadAllRemainingPages = useCallback(async () => {
    const filters = filtersRef.current;
    let pag = paginationRef.current;
    if (!filters || !pag) return productsRef.current;
    if (pag.currentPage >= pag.lastPage) return productsRef.current;

    const reqId = requestIdRef.current;
    setLoadingMore(true);
    let all = productsRef.current;
    try {
      for (let p = pag.currentPage + 1; p <= pag.lastPage; p++) {
        const next = await fetchPage(filters, p, CATALOG_PRODUCT_PAGE_SIZE);
        if (reqId !== requestIdRef.current) return all;
        if (!next.ok) {
          setError(next.message || 'Gagal memuat produk berikutnya.');
          break;
        }
        all = mergeCatalogProductPages(all, next.rows);
        pag = next.pag ?? { ...pag, currentPage: p };
      }
      commitProducts(all);
      commitPagination(
        pag
          ? {
              ...pag,
              currentPage: pag.lastPage,
              total: Math.max(pag.total, all.length),
            }
          : null
      );
      // Full set in memory → switch to client windowing (Phase 1).
      if (shouldPaginateCatalogProducts(all.length)) {
        setDisplayLimit(CATALOG_PRODUCT_PAGE_SIZE);
      }
      return all;
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [commitPagination, commitProducts, fetchPage]);

  const loadMore = useCallback(async () => {
    // Client window when full list already loaded.
    if (displayLimit != null) {
      setDisplayLimit((prev) =>
        prev == null
          ? CATALOG_PRODUCT_PAGE_SIZE
          : Math.min(productsRef.current.length, prev + CATALOG_PRODUCT_PAGE_SIZE)
      );
      return;
    }

    const filters = filtersRef.current;
    const pag = paginationRef.current;
    if (!filters || !pag) return;
    if (!shouldPaginateCatalogProducts(pag.total)) return;
    if (pag.currentPage >= pag.lastPage) return;

    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const nextPage = pag.currentPage + 1;
      const next = await fetchPage(filters, nextPage, CATALOG_PRODUCT_PAGE_SIZE);
      if (reqId !== requestIdRef.current) return;
      if (!next.ok) {
        setError(next.message || 'Gagal memuat produk berikutnya.');
        return;
      }
      const merged = mergeCatalogProductPages(productsRef.current, next.rows);
      commitProducts(merged);
      commitPagination(next.pag ?? { ...pag, currentPage: nextPage });
    } catch (err: unknown) {
      if (reqId !== requestIdRef.current) return;
      setError(parseApiError(err).message || 'Gagal memuat produk berikutnya.');
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [commitPagination, commitProducts, displayLimit, fetchPage]);

  const apiCanLoadMore =
    displayLimit == null &&
    !!pagination &&
    shouldPaginateCatalogProducts(pagination.total) &&
    pagination.currentPage < pagination.lastPage;

  const clientCanLoadMore =
    displayLimit != null && displayLimit < products.length;

  const canLoadMore = apiCanLoadMore || clientCanLoadMore;

  const visibleProducts =
    displayLimit != null ? products.slice(0, displayLimit) : products;

  const setProductsSafe = useCallback(
    (next: Product[] | ((prev: Product[]) => Product[])) => {
      const value = typeof next === 'function' ? next(productsRef.current) : next;
      commitProducts(value);
    },
    [commitProducts]
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    filtersRef.current = null;
    commitProducts([]);
    commitPagination(null);
    setDisplayLimit(null);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
  }, [commitPagination, commitProducts]);

  return {
    products,
    visibleProducts,
    setProducts: setProductsSafe,
    loading,
    loadingMore,
    error,
    setError,
    pagination,
    canLoadMore,
    loadInitial,
    loadMore,
    loadAllRemainingPages,
    reset,
  };
}
