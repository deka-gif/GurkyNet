/**
 * Transaction PIN vault pure helpers.
 * Run: npx --yes tsx src/utils/transactionPinVault.test.ts
 */
import assert from 'node:assert/strict';
import {
  isSixDigitPin,
  PIN_VAULT_KEY,
  PIN_VAULT_SERVICE,
} from './transactionPinVault.pure';

assert.equal(isSixDigitPin('123456'), true);
assert.equal(isSixDigitPin('000000'), true);
assert.equal(isSixDigitPin('12345'), false, 'too short');
assert.equal(isSixDigitPin('1234567'), false, 'too long');
assert.equal(isSixDigitPin('12345a'), false, 'non-digit');
assert.equal(isSixDigitPin(''), false);

assert.equal(PIN_VAULT_KEY, 'gurkynet_tx_pin_vault');
assert.equal(PIN_VAULT_SERVICE, 'gurkynet.tx.pin.vault');

console.log('transactionPinVault.test.ts: ok');
