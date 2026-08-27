import assert from 'node:assert/strict';
import {
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
assert.equal(normalizeTransactionStatus('processing'), 'pending');
assert.equal(normalizeTransactionStatus('waiting'), 'pending');
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

assert.equal(toSrsTransactionStatus('sukses'), 'SUCCESS');
assert.equal(toSrsTransactionStatus('LOCKED'), 'LOCKED');
assert.equal(toSrsTransactionStatus('SENT_TO_SUPPLIER'), 'SENT_TO_SUPPLIER');
assert.equal(toSrsTransactionStatus('REFUNDED'), 'REFUNDED');

assert.equal(transactionStatusLabel('success'), 'Sukses');
assert.equal(transactionStatusLabel('failed'), 'Gagal');
assert.equal(transactionStatusLabel('LOCKED'), 'Saldo dikunci');
assert.equal(transactionStatusLabel('REFUNDED'), 'Direfund');
assert.equal(transactionStatusLabel('pending'), 'Dikirim ke provider');

console.log('transactionStatus tests passed');
