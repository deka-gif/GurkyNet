import { create } from 'zustand';
import { Transaction } from '../api/types';
import { transactionService, TransactionListMeta } from '../services/transaction.service';
import { toLocalDateString } from '../utils/historyGrouping';
import { normalizeTransactionStatus } from '../utils/transactionStatus';

export type HistoryStatusFilter =
  | 'all'
  | 'success'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded';

/** Product/service filter — matched against serviceName (client-side). */
export type HistoryProductFilter = 'all' | string;

export type HistoryTimeMode = 'all' | 'month' | 'date';

export type HistoryFilterState = {
  product: HistoryProductFilter;
  timeMode: HistoryTimeMode;
  /** YYYY-MM when timeMode === 'month' */
  monthKey: string;
  /** YYYY-MM-DD when timeMode === 'date' */
  dateStart: string;
  dateEnd: string;
  status: HistoryStatusFilter;
};

type HistoryState = {
  items: Transaction[];
  meta: TransactionListMeta | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  searchQuery: string;
  /** Applied filters (drive list query + client filters). */
  filters: HistoryFilterState;
  setSearchQuery: (q: string) => void;
  applyFilters: (next: HistoryFilterState) => void;
  resetFilters: () => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
};

const PER_PAGE = 20;

function defaultMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultHistoryFilters(): HistoryFilterState {
  const today = toLocalDateString(new Date());
  return {
    product: 'all',
    timeMode: 'all',
    monthKey: defaultMonthKey(),
    dateStart: today,
    dateEnd: today,
    status: 'all',
  };
}

/** Map applied time filter → GET /transactions start_date / end_date. */
export function dateRangeForHistoryFilters(f: HistoryFilterState): {
  start_date?: string;
  end_date?: string;
} {
  if (f.timeMode === 'all') return {};

  if (f.timeMode === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(f.monthKey);
    if (!m) return {};
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const start = new Date(y, mo, 1);
    const end = new Date(y, mo + 1, 0);
    return {
      start_date: toLocalDateString(start),
      end_date: toLocalDateString(end),
    };
  }

  // date mode — inclusive range
  const start = f.dateStart || f.dateEnd;
  const end = f.dateEnd || f.dateStart;
  if (!start || !end) return {};
  return {
    start_date: start <= end ? start : end,
    end_date: start <= end ? end : start,
  };
}

function matchesSearch(tx: Transaction, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return (
    String(tx.transactionCode ?? '').toLowerCase().includes(needle) ||
    String(tx.serviceName ?? '').toLowerCase().includes(needle) ||
    String(tx.productName ?? '').toLowerCase().includes(needle) ||
    String(tx.targetNo ?? '').toLowerCase().includes(needle) ||
    String(tx.id ?? '').toLowerCase().includes(needle)
  );
}

function matchesStatus(tx: Transaction, filter: HistoryStatusFilter): boolean {
  if (filter === 'all') return true;
  const normalized = normalizeTransactionStatus(tx.status);
  if (filter === 'pending') return normalized === 'pending' || normalized === 'processing';
  return normalized === filter;
}

function matchesProduct(tx: Transaction, filter: HistoryProductFilter): boolean {
  if (filter === 'all') return true;
  return String(tx.serviceName ?? '').toLowerCase().includes(filter.toLowerCase());
}

export function selectFilteredHistory(state: HistoryState): Transaction[] {
  return state.items.filter(
    (tx) =>
      matchesSearch(tx, state.searchQuery) &&
      matchesStatus(tx, state.filters.status) &&
      matchesProduct(tx, state.filters.product)
  );
}

/**
 * Build product filter options from loaded transactions (no N+1).
 * Falls back to common GurkyNet service labels if list empty.
 */
export function buildProductOptionsFromTransactions(
  items: Transaction[]
): { key: HistoryProductFilter; label: string }[] {
  const seen = new Map<string, string>();
  for (const tx of items) {
    const name = String(tx.serviceName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }

  const dynamic = Array.from(seen.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));

  const fallback: { key: HistoryProductFilter; label: string }[] = [
    { key: 'pulsa', label: 'Pulsa' },
    { key: 'paket data', label: 'Paket Data' },
    { key: 'token pln', label: 'Token PLN' },
    { key: 'voucher', label: 'Voucher' },
    { key: 'langganan', label: 'Langganan' },
    { key: 'game', label: 'Game' },
    { key: 'top up', label: 'Top Up Saldo' },
    { key: 'tagihan', label: 'Tagihan' },
  ];

  const options = dynamic.length > 0 ? dynamic : fallback;
  return [{ key: 'all', label: 'Semua Produk' }, ...options];
}

/** Months that have at least one transaction in `items`, newest first. */
export function monthsWithTransactions(
  items: Transaction[]
): { monthKey: string; label: string; year: number; monthIndex0: number }[] {
  const map = new Map<string, { year: number; monthIndex0: number }>();
  for (const tx of items) {
    const raw = tx.createdAt || tx.date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, { year: d.getFullYear(), monthIndex0: d.getMonth() });
  }
  return Array.from(map.entries())
    .map(([monthKey, v]) => {
      const label = new Date(v.year, v.monthIndex0, 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
      return { monthKey, label, year: v.year, monthIndex0: v.monthIndex0 };
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export function formatMonthPeriodLine(year: number, monthIndex0: number): string {
  const start = 1;
  const end = new Date(year, monthIndex0 + 1, 0).getDate();
  const endLabel = new Date(year, monthIndex0, end).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Periode ${start} - ${endLabel}`;
}

export const HISTORY_STATUS_OPTIONS: { key: HistoryStatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'success', label: 'Berhasil' },
  { key: 'pending', label: 'Diproses' },
  { key: 'failed', label: 'Gagal' },
  { key: 'expired', label: 'Kedaluwarsa' },
  { key: 'cancelled', label: 'Dibatalkan' },
  { key: 'refunded', label: 'Dana Kembali' },
];

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  meta: null,
  loading: false,
  loadingMore: false,
  error: null,
  searchQuery: '',
  filters: defaultHistoryFilters(),

  setSearchQuery: (q) => set({ searchQuery: q }),

  applyFilters: (next) => {
    set({ filters: next });
    void get().refresh();
  },

  resetFilters: () => {
    set({ filters: defaultHistoryFilters() });
    void get().refresh();
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const range = dateRangeForHistoryFilters(get().filters);
      const status = get().filters.status;
      const result = await transactionService.list({
        ...range,
        // Server status filter when not "all"; pending covers processing via client too
        status: status === 'all' || status === 'pending' ? undefined : status,
        page: 1,
        per_page: PER_PAGE,
      });
      set({
        items: result.items,
        meta: result.meta,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Gagal memuat riwayat transaksi.',
      });
    }
  },

  loadMore: async () => {
    const { meta, loadingMore, loading, items, filters } = get();
    if (loading || loadingMore || !meta) return;
    if (meta.current_page >= meta.last_page) return;

    set({ loadingMore: true });
    try {
      const range = dateRangeForHistoryFilters(filters);
      const status = filters.status;
      const nextPage = meta.current_page + 1;
      const result = await transactionService.list({
        ...range,
        status: status === 'all' || status === 'pending' ? undefined : status,
        page: nextPage,
        per_page: PER_PAGE,
      });
      const seen = new Set(items.map((t) => t.id));
      const merged = [...items];
      for (const row of result.items) {
        if (!seen.has(row.id)) merged.push(row);
      }
      set({ items: merged, meta: result.meta, loadingMore: false });
    } catch {
      set({ loadingMore: false });
    }
  },
}));
