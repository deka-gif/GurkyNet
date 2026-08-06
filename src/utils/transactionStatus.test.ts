import assert from 'node:assert/strict';
import {
  isFailedStatus,
  isPendingStatus,
  isSuccessStatus,
  normalizeTransactionStatus,
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

assert.equal(isSuccessStatus('success'), true);
assert.equal(isSuccessStatus('sukses'), true);
assert.equal(isSuccessStatus('pending'), false);

assert.equal(isPendingStatus('processing'), true);
assert.equal(isFailedStatus('gagal'), true);
assert.equal(isFailedStatus('cancelled'), true);

assert.equal(transactionStatusLabel('success'), 'Sukses');
assert.equal(transactionStatusLabel('failed'), 'Gagal');
assert.equal(transactionStatusLabel('pending'), 'Pending');

console.log('transactionStatus tests passed');
