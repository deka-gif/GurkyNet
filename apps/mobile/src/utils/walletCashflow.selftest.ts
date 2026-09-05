/**
 * Self-test: cashflow week buckets + dynamic Y axis.
 * Run: npx --yes tsx src/utils/walletCashflow.selftest.ts
 */
import {
  buildDynamicYAxis,
  buildMonthWeekBuckets,
  formatCompactIdr,
  niceCeil,
  aggregateCashflowByWeek,
} from './walletCashflow';
import type { WalletMutation } from '../services/wallet.service';
import { resolveExpenseCategoryId, aggregateExpenseByCategory } from './walletExpenseCategory';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function daysCase(year: number, month0: number, expectedLastLabel: string, count: number) {
  const buckets = buildMonthWeekBuckets(year, month0);
  assert(buckets.length === count, `${year}-${month0 + 1}: expected ${count} buckets, got ${buckets.length}`);
  assert(
    buckets[buckets.length - 1].label === expectedLastLabel,
    `${year}-${month0 + 1}: last label ${buckets[buckets.length - 1].label} != ${expectedLastLabel}`
  );
  console.log(`PASS month days ${year}-${month0 + 1}: ${buckets.map((b) => b.label).join(' | ')}`);
}

function yAxisCase(max: number, mustCover: number) {
  const { domainMax, ticks } = buildDynamicYAxis(max);
  assert(domainMax >= mustCover, `domainMax ${domainMax} < ${mustCover}`);
  assert(ticks.length >= 2 && ticks.length <= 7, `tick count ${ticks.length}`);
  assert(ticks[0] === 0, 'first tick must be 0');
  assert(ticks[ticks.length - 1] === domainMax, 'last tick must be domainMax');
  console.log(
    `PASS Y-axis max=${max} → domain=${domainMax} ticks=[${ticks.map(formatCompactIdr).join(', ')}]`
  );
}

function mut(
  id: number,
  type: 'credit' | 'debit',
  amount: number,
  day: number,
  desc: string,
  service?: string
): WalletMutation {
  return {
    id,
    wallet_id: 1,
    amount,
    type,
    direction: type,
    description: desc,
    service_name: service ?? null,
    reference_id: id,
    created_at: `2026-09-${String(day).padStart(2, '0')}T10:00:00+07:00`,
  };
}

async function main() {
  // Month day lengths
  daysCase(2026, 1, '22-28', 4); // Feb 2026 (non-leap) — 28 days
  daysCase(2024, 1, '29-29', 5); // Feb 2024 leap — 29 days → last 29-29
  daysCase(2026, 8, '29-30', 5); // Sep 2026 — 30 days
  daysCase(2026, 0, '29-31', 5); // Jan 2026 — 31 days

  // Dynamic Y
  yAxisCase(2_084_100, 2_084_100);
  yAxisCase(50_000_000, 50_000_000);
  const zeroAxis = buildDynamicYAxis(0);
  assert(zeroAxis.domainMax === 0 && zeroAxis.ticks.length === 1 && zeroAxis.ticks[0] === 0, 'zero axis');
  console.log('PASS Y-axis empty = [0]');
  assert(niceCeil(4_000_000) >= 4_000_000, 'niceCeil');

  // Cashflow aggregation
  const rows = [
    mut(1, 'debit', 100_000, 3, 'Pembelian Pulsa', 'Pulsa Telkomsel'),
    mut(2, 'credit', 500_000, 10, 'Top Up Saldo'),
    mut(3, 'debit', 50_000_000, 16, 'Transfer ke X'),
    mut(4, 'credit', 1_000_000, 30, 'Refund'),
  ];
  const buckets = aggregateCashflowByWeek(rows, 2026, 8);
  assert(buckets[0].expense === 100_000, 'week1 expense');
  assert(buckets[1].income === 500_000, 'week2 income');
  assert(buckets[2].expense === 50_000_000, 'week3 huge expense');
  assert(buckets[4].income === 1_000_000, 'week5 income');
  const y = buildDynamicYAxis(50_000_000);
  assert(y.domainMax >= 50_000_000, 'huge out must expand Y');
  console.log('PASS cashflow aggregation + huge spike Y');

  // Category mapping
  assert(resolveExpenseCategoryId(mut(1, 'debit', 1, 1, 'x', 'Pulsa XL')) === 'telco', 'pulsa');
  assert(resolveExpenseCategoryId(mut(2, 'debit', 1, 1, 'Paket Data', 'Paket Data')) === 'telco', 'data');
  assert(resolveExpenseCategoryId(mut(3, 'debit', 1, 1, 'x', 'Token PLN')) === 'tagihan', 'pln');
  assert(resolveExpenseCategoryId(mut(4, 'debit', 1, 1, 'Transfer ke', '')) === 'lainnya', 'transfer');
  const slices = aggregateExpenseByCategory([
    mut(1, 'debit', 10_000, 1, 'a', 'Pulsa'),
    mut(2, 'debit', 20_000, 1, 'b', 'Paket Data'),
    mut(3, 'debit', 5_000, 1, 'c', 'Voucher Internet'),
    mut(4, 'credit', 99_000, 1, 'Top Up'),
  ]);
  assert(slices.length === 1 && slices[0].id === 'telco', 'telco merge');
  assert(slices[0].amount === 35_000, 'telco amount');
  assert(slices[0].count === 3, 'telco count');
  console.log('PASS expense category mapping');

  console.log('All walletCashflow self-tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
