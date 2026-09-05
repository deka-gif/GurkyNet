import type { WalletHistoryFilters, WalletHistoryResult, WalletMutation } from '../services/wallet.service';

/**
 * Fetch every page of GET /wallet/history until pagination.lastPage.
 * Stops at last_page — no hardcoded max-page cap.
 * Throws if any page fails so callers never treat partial data as complete.
 */
export async function fetchAllWalletHistoryPages(
  fetchPage: (filters: WalletHistoryFilters) => Promise<WalletHistoryResult>,
  baseFilters: Omit<WalletHistoryFilters, 'page'>
): Promise<{ items: WalletMutation[]; total: number; lastPage: number }> {
  const perPage = baseFilters.per_page ?? 100;
  const all: WalletMutation[] = [];
  let page = 1;
  let lastPage = 1;
  let total = 0;

  do {
    const result = await fetchPage({
      ...baseFilters,
      per_page: perPage,
      page,
    });

    const seen = new Set(all.map((r) => String(r.id)));
    for (const row of result.items) {
      if (!seen.has(String(row.id))) {
        all.push(row);
        seen.add(String(row.id));
      }
    }

    lastPage = Math.max(1, Number(result.pagination.lastPage) || 1);
    total = Number(result.pagination.total) || all.length;
    page += 1;
  } while (page <= lastPage);

  return { items: all, total, lastPage };
}
