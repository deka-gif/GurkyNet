/**
 * Run: npx tsx src/utils/transactionStatusFromPush.selftest.ts
 */
import {
  isTerminalTransactionStatus,
  isTransactionPushHint,
  pushHintMatchesCheckoutTransaction,
} from './transactionStatusFromPush';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const tx = { id: '161', transactionCode: 'GRK-20260912-000011', status: 'pending' };

assert(pushHintMatchesCheckoutTransaction(tx, { transactionId: '161' }), 'match by id');
assert(
  pushHintMatchesCheckoutTransaction(tx, { invoiceNumber: 'GRK-20260912-000011' }),
  'match by invoice'
);
assert(
  !pushHintMatchesCheckoutTransaction(tx, { transactionId: '999' }),
  'reject other id'
);
assert(
  !pushHintMatchesCheckoutTransaction(tx, { invoiceNumber: 'OTHER' }),
  'reject other invoice'
);
assert(!pushHintMatchesCheckoutTransaction(null, { transactionId: '161' }), 'null tx');
assert(isTransactionPushHint({ category: 'transaction' }), 'category transaction');
assert(isTransactionPushHint({ transactionId: '1' }), 'id alone');
assert(!isTransactionPushHint({ category: 'announcement' }), 'announcement ignored');
assert(isTerminalTransactionStatus('success'), 'terminal success');
assert(!isTerminalTransactionStatus('pending'), 'pending not terminal');

console.log('transactionStatusFromPush.selftest OK');
