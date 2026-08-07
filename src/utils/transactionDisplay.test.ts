import assert from 'node:assert/strict';
import {
  maskTargetNumber,
  resolveProviderBadge,
} from './transactionDisplay.ts';

assert.equal(maskTargetNumber('081234567890'), '0812*****890');
assert.equal(maskTargetNumber('140283948192'), '1402*****192');
assert.equal(maskTargetNumber(''), '—');
assert.equal(resolveProviderBadge('digiflazz'), 'Digiflazz');
assert.equal(resolveProviderBadge('vip'), 'VIPayment');
assert.equal(resolveProviderBadge(null), null);

console.log('transactionDisplay tests passed');
