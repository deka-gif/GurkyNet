/**
 * Run: npx --yes tsx src/utils/ewalletAmountValidation.test.ts
 */
import assert from 'node:assert/strict';
import { validateEwalletAmountMultipleOfThousand } from './ewalletAmountValidation';

assert.equal(validateEwalletAmountMultipleOfThousand(1000), null);
assert.equal(validateEwalletAmountMultipleOfThousand(171000), null);
assert.equal(validateEwalletAmountMultipleOfThousand(500), 'Nominal harus kelipatan Rp1.000');
assert.equal(validateEwalletAmountMultipleOfThousand(1500), 'Nominal harus kelipatan Rp1.000');
assert.equal(validateEwalletAmountMultipleOfThousand(0), 'Masukkan nominal top up.');
assert.equal(validateEwalletAmountMultipleOfThousand(-1000), 'Masukkan nominal top up.');

console.log('ewalletAmountValidation.test.ts: OK');
