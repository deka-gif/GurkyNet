/**
 * Lightweight assertion runner for fetchAllWalletHistoryPages (no Jest in mobile).
 * Run: npx --yes tsx src/utils/fetchAllWalletHistoryPages.selftest.ts
 */
import { fetchAllWalletHistoryPages } from './fetchAllWalletHistoryPages';
import type { WalletHistoryFilters, WalletHistoryResult, WalletMutation } from '../services/wallet.service';

function row(id: number): WalletMutation {
  return {
    id,
    wallet_id: 1,
    amount: 1000,
    type: 'debit',
    direction: 'debit',
    description: `Debit ${id}`,
    reference_id: null,
    created_at: '2026-09-01T00:00:00+07:00',
  };
}

function mockPaged(totalItems: number, perPage: number) {
  const pages: WalletMutation[][] = [];
  for (let i = 0; i < totalItems; i += perPage) {
    pages.push(
      Array.from({ length: Math.min(perPage, totalItems - i) }, (_, j) => row(i + j + 1))
    );
  }
  const lastPage = Math.max(1, pages.length);
  let calls = 0;

  const fetchPage = async (filters: WalletHistoryFilters): Promise<WalletHistoryResult> => {
    calls += 1;
    const page = filters.page ?? 1;
    if (page < 1 || page > lastPage) {
      throw new Error(`Unexpected page ${page}`);
    }
    return {
      items: pages[page - 1] || [],
      pagination: {
        currentPage: page,
        lastPage,
        perPage,
        total: totalItems,
      },
    };
  };

  return { fetchPage, getCalls: () => calls, lastPage };
}

async function assertCase(name: string, totalItems: number, perPage: number) {
  const { fetchPage, getCalls, lastPage } = mockPaged(totalItems, perPage);
  const result = await fetchAllWalletHistoryPages(fetchPage, {
    type: 'debit',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    per_page: perPage,
  });

  if (result.items.length !== totalItems) {
    throw new Error(`${name}: expected ${totalItems} items, got ${result.items.length}`);
  }
  if (getCalls() !== lastPage) {
    throw new Error(`${name}: expected ${lastPage} requests, got ${getCalls()}`);
  }
  if (result.lastPage !== lastPage) {
    throw new Error(`${name}: lastPage mismatch`);
  }
  console.log(`PASS ${name}: ${totalItems} rows, ${lastPage} page(s), ${getCalls()} request(s)`);
}

async function assertFailStops() {
  let calls = 0;
  const fetchPage = async (filters: WalletHistoryFilters): Promise<WalletHistoryResult> => {
    calls += 1;
    if ((filters.page ?? 1) === 2) throw new Error('page 2 failed');
    return {
      items: [row(1)],
      pagination: { currentPage: 1, lastPage: 3, perPage: 1, total: 3 },
    };
  };
  try {
    await fetchAllWalletHistoryPages(fetchPage, { type: 'debit', per_page: 1 });
    throw new Error('expected throw');
  } catch (e: any) {
    if (String(e?.message).includes('expected throw')) throw e;
    if (calls !== 2) throw new Error(`fail-stop: expected 2 calls, got ${calls}`);
    console.log('PASS fails mid-pagination without treating data as complete');
  }
}

async function assertLatePageMonthsSurfaced() {
  // Simulate 7 pages / 650 rows; only page 7 carries a distinct month (2025-01).
  const perPage = 100;
  const totalItems = 650;
  const pages: WalletMutation[][] = [];
  for (let i = 0; i < totalItems; i += perPage) {
    const chunk: WalletMutation[] = [];
    for (let j = 0; j < Math.min(perPage, totalItems - i); j++) {
      const id = i + j + 1;
      const onLastPage = i + perPage >= totalItems;
      chunk.push({
        ...row(id),
        created_at: onLastPage
          ? '2025-01-15T10:00:00+07:00'
          : '2026-09-01T00:00:00+07:00',
      });
    }
    pages.push(chunk);
  }
  const lastPage = pages.length;
  const fetchPage = async (filters: WalletHistoryFilters): Promise<WalletHistoryResult> => {
    const page = filters.page ?? 1;
    return {
      items: pages[page - 1] || [],
      pagination: { currentPage: page, lastPage, perPage, total: totalItems },
    };
  };
  const result = await fetchAllWalletHistoryPages(fetchPage, { per_page: perPage });
  if (result.items.length !== 650) throw new Error('late-page: row count');
  if (result.lastPage !== 7) throw new Error(`late-page: expected 7 pages, got ${result.lastPage}`);
  const hasJan2025 = result.items.some((r) => String(r.created_at).startsWith('2025-01'));
  if (!hasJan2025) throw new Error('late-page: January 2025 activity missing (would hide from picker)');
  console.log('PASS late-page activity (page 7 / 650 rows) retained for month picker');
}

async function main() {
  await assertCase('1 page', 40, 100);
  await assertCase('3 pages', 250, 100);
  await assertCase('>5 pages', 650, 100);
  await assertFailStops();
  await assertLatePageMonthsSurfaced();
  console.log('All fetchAllWalletHistoryPages self-tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
