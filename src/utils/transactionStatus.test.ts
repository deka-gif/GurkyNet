import assert from 'node:assert/strict';
import {
  customerFacingTransactionNotes,
  isFailedStatus,
  isPendingStatus,
  isSuccessStatus,
  normalizeTransactionStatus,
  toSrsTransactionStatus,
  transactionStatusLabel,
} from './transactionStatus.ts';

assert.equal(normalizeTransactionStatus('success'), 'success');
assert.equal(normalizeTransactionStatus('sukses'), 'success');
assert.equal(normalizeTransactionStatus('SUCCESS'), 'success');
assert.equal(normalizeTransactionStatus('failed'), 'failed');
assert.equal(normalizeTransactionStatus('gagal'), 'failed');
assert.equal(normalizeTransactionStatus('pending'), 'pending');
assert.equal(normalizeTransactionStatus('processing'), 'processing');
assert.equal(normalizeTransactionStatus('waiting'), 'pending');
assert.equal(normalizeTransactionStatus('expired'), 'expired');
assert.equal(normalizeTransactionStatus('refunded'), 'refunded');
assert.equal(normalizeTransactionStatus('REFUNDED'), 'refunded');

assert.equal(isSuccessStatus('success'), true);
assert.equal(isSuccessStatus('sukses'), true);
assert.equal(isSuccessStatus('pending'), false);

assert.equal(isPendingStatus('processing'), true);
assert.equal(isPendingStatus('LOCKED'), true);
assert.equal(isPendingStatus('INITIATED'), true);
assert.equal(isFailedStatus('gagal'), true);
assert.equal(isFailedStatus('cancelled'), true);
assert.equal(isFailedStatus('expired'), true);

assert.equal(toSrsTransactionStatus('sukses'), 'SUCCESS');
assert.equal(toSrsTransactionStatus('LOCKED'), 'LOCKED');
assert.equal(toSrsTransactionStatus('SENT_TO_SUPPLIER'), 'SENT_TO_SUPPLIER');
assert.equal(toSrsTransactionStatus('REFUNDED'), 'REFUNDED');

assert.equal(transactionStatusLabel('success'), 'Sukses');
assert.equal(transactionStatusLabel('failed'), 'Gagal');
assert.equal(transactionStatusLabel('LOCKED'), 'Saldo dikunci');
assert.equal(transactionStatusLabel('REFUNDED'), 'Direfund');
assert.equal(transactionStatusLabel('pending'), 'Dikirim ke provider');
assert.equal(
  transactionStatusLabel('pending', { serviceName: 'Top Up Saldo', paymentMethod: 'midtrans' }),
  'Menunggu Pembayaran'
);
assert.equal(
  transactionStatusLabel('processing', { serviceName: 'Top Up Saldo' }),
  'Menunggu Pembayaran'
);
assert.equal(
  transactionStatusLabel('pending', {
    invoiceNumber: 'TRX-TOPUP-20260904160000-1111',
  }),
  'Menunggu Pembayaran'
);
assert.equal(
  transactionStatusLabel('expired', { serviceName: 'Top Up Saldo' }),
  'Pembayaran Kedaluwarsa'
);

assert.equal(
  customerFacingTransactionNotes('Menunggu penyelesaian pembayaran di Midtrans.', {
    serviceName: 'Top Up Saldo',
    paymentMethod: 'midtrans',
    status: 'processing',
  }),
  'Menunggu pembayaran. Selesaikan pembayaran untuk menambah saldo Anda.'
);
assert.equal(
  customerFacingTransactionNotes('ignored', {
    serviceName: 'Top Up Saldo',
    status: 'expired',
    amount: 15000,
  }),
  'Pembayaran Rp15.000 telah kedaluwarsa.'
);
assert.ok(
  !/midtrans|provider|saldo Anda tidak berubah/i.test(
    customerFacingTransactionNotes('x', {
      serviceName: 'Top Up Saldo',
      status: 'expired',
      amount: 15000,
    })
  )
);
assert.ok(
  !/midtrans|provider/i.test(
    customerFacingTransactionNotes('Top up saldo via Midtrans (qris/qris)', {
      invoiceNumber: 'TRX-TOPUP-20260904160000-1111',
      status: 'pending',
    })
  )
);

console.log('transactionStatus tests passed');
