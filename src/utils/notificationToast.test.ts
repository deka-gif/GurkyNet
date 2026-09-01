import assert from 'node:assert/strict';
import {
  buildTransactionToastSourceId,
  enqueueNotificationToast,
  extractTransactionInvoice,
  shouldSuppressTransactionPopup,
  transactionToastPhase,
} from './notificationToast.ts';

assert.equal(shouldSuppressTransactionPopup('Transaksi Dibuat'), true);
assert.equal(shouldSuppressTransactionPopup('Saldo Berkurang'), true);
assert.equal(shouldSuppressTransactionPopup('Transaksi Diproses'), false);

assert.equal(
  extractTransactionInvoice('Transaksi Diproses', 'Transaksi #GRK-20260901-000002 sedang diproses.'),
  'GRK-20260901-000002'
);

assert.equal(transactionToastPhase('Transaksi Diproses', 'info'), 'processing');
assert.equal(transactionToastPhase('Pembayaran Berhasil', 'transaction_success'), 'success');
assert.equal(transactionToastPhase('Transaksi Gagal', 'transaction_failed'), 'failed');

assert.equal(
  buildTransactionToastSourceId('GRK-20260901-000002', 'processing'),
  'tx-toast:GRK-20260901-000002:processing'
);

// Suppressed notifications must not enqueue.
const shown = enqueueNotificationToast({
  id: 1,
  title: 'Transaksi Dibuat',
  message: 'Transaksi #GRK-20260901-000001 telah dibuat.',
  type: 'info',
});

assert.equal(shown, false);

console.log('notificationToast tests passed');
