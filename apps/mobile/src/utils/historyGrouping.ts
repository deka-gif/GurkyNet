import type { Transaction } from '../api/types';
import { transactionTimestamp } from './transactionDisplay';

export type HistoryPeriodKey =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'this_month'
  | 'last_month';

export type HistoryPeriodOption = { key: HistoryPeriodKey; label: string };

export const HISTORY_PERIOD_OPTIONS: HistoryPeriodOption[] = [
  { key: 'all', label: 'Semua Tanggal' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: 'last7', label: '7 Hari Terakhir' },
  { key: 'last30', label: '30 Hari Terakhir' },
  { key: 'this_month', label: 'Bulan Ini' },
  { key: 'last_month', label: 'Bulan Lalu' },
];

/** YYYY-MM-DD in local timezone — matches Laravel whereDate filters. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Map UI period → GET /transactions start_date / end_date.
 * Returns null dates for "all".
 */
export function dateRangeForPeriod(period: HistoryPeriodKey): {
  start_date?: string;
  end_date?: string;
} {
  const now = new Date();
  const today = startOfDay(now);

  if (period === 'all') return {};

  if (period === 'today') {
    const s = toLocalDateString(today);
    return { start_date: s, end_date: s };
  }

  if (period === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = toLocalDateString(y);
    return { start_date: s, end_date: s };
  }

  if (period === 'last7') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start_date: toLocalDateString(start), end_date: toLocalDateString(today) };
  }

  if (period === 'last30') {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { start_date: toLocalDateString(start), end_date: toLocalDateString(today) };
  }

  if (period === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start_date: toLocalDateString(start), end_date: toLocalDateString(today) };
  }

  // last_month
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { start_date: toLocalDateString(start), end_date: toLocalDateString(end) };
}

export type HistoryGroup = {
  key: string;
  title: string;
  items: Transaction[];
};

/**
 * Dynamic period labels from transaction timestamps (not hardcoded static buckets).
 * Order: Hari Ini → Kemarin → 7 Hari Terakhir → then month+year descending.
 */
export function groupTransactionsByPeriod(transactions: Transaction[]): HistoryGroup[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const buckets = new Map<string, HistoryGroup>();

  const sorted = [...transactions].sort((a, b) => transactionTimestamp(b) - transactionTimestamp(a));

  for (const tx of sorted) {
    const ts = transactionTimestamp(tx);
    if (!ts) continue;
    const d = startOfDay(new Date(ts));

    let key: string;
    let title: string;
    let order: number;

    if (d.getTime() === today.getTime()) {
      key = 'today';
      title = 'Hari Ini';
      order = 0;
    } else if (d.getTime() === yesterday.getTime()) {
      key = 'yesterday';
      title = 'Kemarin';
      order = 1;
    } else if (d >= weekStart && d < yesterday) {
      key = 'last7';
      title = '7 Hari Terakhir';
      order = 2;
    } else {
      const monthTitle = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      key = `m-${d.getFullYear()}-${d.getMonth()}`;
      title = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
      order = 1000 - (d.getFullYear() * 12 + d.getMonth());
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(tx);
    } else {
      buckets.set(key, { key: `${order}:${key}`, title, items: [tx] });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const oa = Number(a.key.split(':')[0]);
    const ob = Number(b.key.split(':')[0]);
    return oa - ob;
  });
}
