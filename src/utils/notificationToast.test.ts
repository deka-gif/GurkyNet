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
assert.equal(shouldSuppressTransactionPopup('Menunggu Pembayaran'), true);
assert.equal(shouldSuppressTransactionPopup('Pembayaran Diproses'), true);
assert.equal(shouldSuppressTransactionPopup('Transaksi Diproses'), true);
assert.equal(shouldSuppressTransactionPopup('Top Up Berhasil'), false);

assert.equal(
  extractTransactionInvoice('Transaksi Diproses', 'Transaksi #GRK-20260901-000002 sedang diproses.'),
  'GRK-20260901-000002'
);

assert.equal(transactionToastPhase('Menunggu Pembayaran', 'info'), null);
assert.equal(transactionToastPhase('Pembayaran Diproses', 'info'), null);
assert.equal(transactionToastPhase('Transaksi Diproses', 'info'), 'processing');
assert.equal(transactionToastPhase('Pembayaran Berhasil', 'transaction_success'), 'success');
assert.equal(transactionToastPhase('Top Up Berhasil', 'transaction_success'), 'success');
assert.equal(transactionToastPhase('Top Up Gagal', 'transaction_failed'), 'failed');
assert.equal(transactionToastPhase('Pembayaran Kedaluwarsa', 'transaction_failed'), 'failed');
assert.equal(transactionToastPhase('Transaksi Gagal', 'transaction_failed'), 'failed');

assert.equal(
  buildTransactionToastSourceId('GRK-20260901-000002', 'processing'),
  'tx-toast:GRK-20260901-000002:processing'
);

assert.equal(
  enqueueNotificationToast({
    id: 1,
    title: 'Transaksi Dibuat',
    message: 'Transaksi #GRK-20260901-000001 telah dibuat.',
    type: 'info',
  }),
  false
);

assert.equal(
  enqueueNotificationToast({
    id: 2,
    title: 'Menunggu Pembayaran',
    message: 'Top Up belum dibayar.',
    type: 'info',
  }),
  false
);

assert.equal(
  enqueueNotificationToast({
    id: 3,
    title: 'Top Up Berhasil',
    message: 'Top Up Rp10.000 berhasil.',
    rawType: 'transaction_success',
    transactionId: '93',
    invoiceNumber: 'TRX-TOPUP-20260904151011-6958',
  }),
  true
);

console.log('notificationToast tests passed');
