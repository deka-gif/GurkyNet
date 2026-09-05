import type { WalletMutation } from '../services/wallet.service';
import { isCreditMovement } from './walletMovement';

export type CashflowWeekBucket = {
  startDay: number;
  endDay: number;
  label: string;
  income: number;
  expense: number;
};

/**
 * Build week-like day ranges for a calendar month (1–7, 8–14, …, remainder).
 * Adapts to 28/29/30/31 days — never hardcodes September.
 */
export function buildMonthWeekBuckets(year: number, monthIndex0: number): CashflowWeekBucket[] {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const buckets: CashflowWeekBucket[] = [];
  let start = 1;
  while (start <= daysInMonth) {
    const end = Math.min(start + 6, daysInMonth);
    buckets.push({
      startDay: start,
      endDay: end,
      label: `${start}-${end}`,
      income: 0,
      expense: 0,
    });
    start = end + 1;
  }
  return buckets;
}

function dayOfMonth(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDate();
}

/** Aggregate credit/debit ledger rows into week buckets for the given month. */
export function aggregateCashflowByWeek(
  rows: WalletMutation[],
  year: number,
  monthIndex0: number
): CashflowWeekBucket[] {
  const buckets = buildMonthWeekBuckets(year, monthIndex0);
  for (const row of rows) {
    const day = dayOfMonth(row.created_at);
    if (day == null) continue;
    const created = new Date(row.created_at);
    if (created.getFullYear() !== year || created.getMonth() !== monthIndex0) continue;

    const bucket = buckets.find((b) => day >= b.startDay && day <= b.endDay);
    if (!bucket) continue;
    const amt = Math.abs(Number(row.amount) || 0);
    if (amt <= 0) continue;
    if (isCreditMovement(row)) bucket.income += amt;
    else bucket.expense += amt;
  }
  return buckets;
}

export function cashflowMaxValue(buckets: CashflowWeekBucket[]): number {
  let max = 0;
  for (const b of buckets) {
    max = Math.max(max, b.income, b.expense);
  }
  return max;
}

/** Round up to a human-friendly “nice” number for axis domain. */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const fraction = value / base;
  let niceFrac: number;
  if (fraction <= 1) niceFrac = 1;
  else if (fraction <= 2) niceFrac = 2;
  else if (fraction <= 2.5) niceFrac = 2.5;
  else if (fraction <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

/**
 * Dynamic linear Y domain + ~4–6 ticks from max cashflow value.
 * Never hardcodes 4 jt.
 */
export function buildDynamicYAxis(
  maxValue: number,
  preferredTicks = 5
): { domainMax: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { domainMax: 0, ticks: [0] };
  }
  const domainMax = niceCeil(maxValue * 1.05);
  const step = niceCeil(domainMax / Math.max(1, preferredTicks - 1));
  const ticks: number[] = [];
  for (let v = 0; v <= domainMax + step * 0.01; v += step) {
    ticks.push(Math.round(v));
    if (ticks.length >= 6) break;
  }
  if (ticks[ticks.length - 1] < domainMax) {
    ticks.push(domainMax);
  }
  // Ensure unique ascending
  const unique = Array.from(new Set(ticks)).sort((a, b) => a - b);
  return { domainMax: unique[unique.length - 1] || domainMax, ticks: unique };
}

/** Compact Rupiah for axis labels: 0, 500 rb, 1 jt, 2,5 jt, 50 jt */
export function formatCompactIdr(value: number): string {
  const n = Math.round(value);
  if (n === 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const rb = n / 1000;
    const text = Number.isInteger(rb) ? String(rb) : rb.toFixed(1).replace('.', ',');
    return `${text} rb`;
  }
  const jt = n / 1_000_000;
  if (jt >= 100) return `${Math.round(jt)} jt`;
  const text = Number.isInteger(jt)
    ? String(jt)
    : jt.toFixed(jt >= 10 ? 0 : 1).replace('.', ',');
  return `${text} jt`;
}

export function currentMonthParts(): { year: number; monthIndex0: number } {
  const now = new Date();
  return { year: now.getFullYear(), monthIndex0: now.getMonth() };
}
