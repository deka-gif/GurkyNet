/**
 * Providers-first catalog product paging (Owner-approved 2026-09-13).
 * Mirror laravel/app/Support/Catalog/CatalogProductPaging.php — keep numbers identical.
 */
export const CATALOG_PRODUCT_PAGE_THRESHOLD = 30;
export const CATALOG_PRODUCT_PAGE_SIZE = 20;

export type CatalogPagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};

export function shouldPaginateCatalogProducts(totalAfterVisibility: number): boolean {
  return totalAfterVisibility > CATALOG_PRODUCT_PAGE_THRESHOLD;
}

/** Unwrap API pagination from either top-level or meta.pagination. */
export function unwrapCatalogPagination(body: unknown): CatalogPagination | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const raw =
    (b.pagination as Record<string, unknown> | undefined) ||
    ((b.meta as Record<string, unknown> | undefined)?.pagination as
      | Record<string, unknown>
      | undefined);
  if (!raw || typeof raw !== 'object') return null;
  return {
    currentPage: Number(raw.currentPage ?? raw.current_page ?? 1),
    lastPage: Number(raw.lastPage ?? raw.last_page ?? 1),
    perPage: Number(raw.perPage ?? raw.per_page ?? CATALOG_PRODUCT_PAGE_SIZE),
    total: Number(raw.total ?? 0),
  };
}

/**
 * Deduplicate by product code (fallback id) when appending pages.
 */
export function mergeCatalogProductPages<T extends { code?: string; id?: number | string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const seen = new Set(existing.map((p) => String(p.code || p.id)));
  const merged = [...existing];
  for (const row of incoming) {
    const key = String(row.code || row.id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}
