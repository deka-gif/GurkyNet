/**
 * Regression: history section order must preserve global chronological DESC.
 * Run: npx --yes tsx src/utils/historyGrouping.selftest.ts
 */
import { groupTransactionsByPeriod } from './historyGrouping';
import type { Transaction } from '../api/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function tx(id: string, createdAt: string): Transaction {
  return {
    id,
    transactionCode: `INV-${id}`,
    serviceName: 'Top Up Saldo',
    targetNo: '0812',
    amount: 1000,
    adminFee: 0,
    totalPayment: 1000,
    paymentMethod: 'midtrans',
    status: 'processing',
    createdAt,
    date: createdAt,
  };
}

// Freeze "today" as 2026-09-10 local by constructing dates relative to real now is flaky.
// Instead assert structural property: flattening groups yields global DESC timestamps.
function flattenCreatedAts(groups: ReturnType<typeof groupTransactionsByPeriod>): string[] {
  return groups.flatMap((g) => g.items.map((i) => String(i.createdAt)));
}

function isDescIso(a: string, b: string): boolean {
  return new Date(a).getTime() >= new Date(b).getTime();
}

const items = [
  tx('aug-1', '2026-08-07T00:25:00+07:00'),
  tx('sep1', '2026-09-01T21:09:00+07:00'),
  tx('sep10-a', '2026-09-10T17:05:00+07:00'),
  tx('sep10-b', '2026-09-10T17:06:00+07:00'),
  tx('sep10-c', '2026-09-10T17:09:00+07:00'),
  tx('sep7', '2026-09-07T10:45:00+07:00'),
  tx('aug-2', '2026-08-06T18:03:00+07:00'),
];

const groups = groupTransactionsByPeriod(items);
const flat = flattenCreatedAts(groups);

for (let i = 0; i < flat.length - 1; i++) {
  assert(
    isDescIso(flat[i], flat[i + 1]),
    `Global order broken at ${i}: ${flat[i]} then ${flat[i + 1]} (groups=${groups.map((g) => g.title).join(' | ')})`
  );
}

// Newest item must be in the first section
assert(groups[0].items[0].id === 'sep10-c', `First item should be sep10-c, got ${groups[0].items[0].id}`);

// August section must not appear before September 10 content when Sep 10 exists
const titles = groups.map((g) => g.title);
const idxHariIniOrSep10 = titles.findIndex(
  (t) => t === 'Hari Ini' || t.toLowerCase().includes('september')
);
const idxAgustus = titles.findIndex((t) => t.toLowerCase().includes('agustus'));
if (idxHariIniOrSep10 >= 0 && idxAgustus >= 0) {
  assert(
    idxHariIniOrSep10 < idxAgustus,
    `September/Hari Ini section must appear before Agustus (titles=${titles.join(' | ')})`
  );
}

console.log('PASS historyGrouping global chronological DESC');
console.log('Sections:', titles.join(' → '));
console.log('Flat ids:', groups.flatMap((g) => g.items.map((i) => i.id)).join(', '));
