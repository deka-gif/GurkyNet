/**
 * PBB NOP_YEAR helpers — run: npx --yes tsx src/utils/pajakCustomerNo.test.ts
 */
import assert from 'node:assert/strict';
import {
  composePbbCustomerNo,
  isValidPbbNop,
  isValidTaxYear,
  sanitizePbbNop,
  taxYearOptions,
} from './pajakCustomerNo';

// --- NOP sanitize / validate ---
assert.equal(sanitizePbbNop('329801092375999'), '329801092375999');
assert.equal(isValidPbbNop('329801092375999'), true, '15 digit valid');

assert.equal(sanitizePbbNop('329801092375999991'), '329801092375999991');
assert.equal(isValidPbbNop('329801092375999991'), true, '18 digit valid');

assert.equal(isValidPbbNop('32980109237599'), false, '<15 invalid');
assert.equal(isValidPbbNop('1234567890123456789'), false, '>18 digit invalid');

assert.equal(sanitizePbbNop('32.980-109 2375.999'), '329801092375999');
assert.equal(isValidPbbNop('32.980-109 2375.999'), true, 'non-digit stripped');

assert.equal(isValidPbbNop(''), false, 'empty invalid');
assert.equal(isValidPbbNop('   '), false, 'whitespace empty invalid');
assert.equal(isValidPbbNop(null), false);
assert.equal(composePbbCustomerNo('32.980-109 2375.99991'), '32980109237599991');

// UI sanitize caps typed input at 18
assert.equal(sanitizePbbNop('12345678901234567890').length, 18);

// --- tax years ---
const years = taxYearOptions(6);
assert.equal(years.length, 6);
const current = new Date().getFullYear();
assert.equal(years[0], current, 'first is current year');
assert.equal(years[5], current - 5, 'last is current - 5');
assert.deepEqual(
  years,
  [current, current - 1, current - 2, current - 3, current - 4, current - 5]
);
assert.equal(isValidTaxYear(current, years), true);
assert.equal(isValidTaxYear(current - 5, years), true);
assert.equal(isValidTaxYear(current - 6, years), false);
assert.equal(isValidTaxYear(1999, years), false);

assert.ok(years.every((y, i) => y === current - i));

console.log('pajakCustomerNo.test.ts: all assertions passed');
