/**
 * Lightweight in-memory query cache + in-flight dedupe for dashboard stores.
 * No React Query coupling — keeps API contracts unchanged.
 */

type CacheEntry<T> = {
  data: T;
  cachedAt: number;
  expiresAt: number;
};

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const CacheTTL = {
  BANNER: 30 * 60 * 1000,
  CATEGORY: 15 * 60 * 1000,
  PROFILE: 10 * 60 * 1000,
  WALLET: 10 * 60 * 1000,
  PRODUCT_COUNT: 15 * 60 * 1000,
  CATEGORY_ICONS: 5 * 60 * 1000,
  PRODUCTS: 5 * 60 * 1000,
  RECENT_TX: 60 * 1000,
  NOTIFICATIONS: 30 * 1000,
} as const;

export function getCached<T>(key: string): T | null {
  const entry = memory.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.data;
}

export function getCachedStale<T>(key: string): { data: T; fresh: boolean } | null {
  const entry = memory.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  return { data: entry.data, fresh: Date.now() <= entry.expiresAt };
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  const now = Date.now();
  memory.set(key, { data, cachedAt: now, expiresAt: now + ttlMs });
}

export function invalidateCache(prefixOrKey: string): void {
  if (memory.has(prefixOrKey)) {
    memory.delete(prefixOrKey);
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefixOrKey)) memory.delete(key);
  }
}

/**
 * Deduplicate concurrent identical fetches; optionally serve stale while refreshing.
 */
export async function cachedFetch<T>(options: {
  key: string;
  ttlMs: number;
  fetcher: (signal: AbortSignal) => Promise<T>;
  force?: boolean;
  /** If stale exists, return it immediately and refresh in background */
  staleWhileRevalidate?: boolean;
}): Promise<T> {
  const { key, ttlMs, fetcher, force = false, staleWhileRevalidate = true } = options;

  if (!force) {
    const fresh = getCached<T>(key);
    if (fresh !== null) return fresh;
  }

  const stale = getCachedStale<T>(key);
  if (!force && staleWhileRevalidate && stale && !stale.fresh) {
    void runInflight(key, fetcher).then((data) => setCached(key, data, ttlMs)).catch(() => undefined);
    return stale.data;
  }

  if (inflight.has(key) && !force) {
    return inflight.get(key) as Promise<T>;
  }

  const promise = runInflight(key, fetcher).then((data) => {
    setCached(key, data, ttlMs);
    return data;
  });

  return promise;
}

async function runInflight<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const controller = new AbortController();
  const promise = fetcher(controller.signal).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export function clearAllCache(): void {
  memory.clear();
  inflight.clear();
}
