/**
 * Focused unit tests — Mobile physical voucher scan payload → canonical SN.
 * Run: npx --yes tsx src/utils/voucherPhysicalScan.test.ts
 */
import assert from 'node:assert/strict';
import {
  addCodesToScan,
  expandSnRange,
  normalizeScanPayloadToSerial,
  UNRECOGNIZED_SCAN_CODE_MESSAGE,
  validateSnInput,
} from './voucherPhysicalScan';

function expectOk(raw: string, serial: string) {
  const r = normalizeScanPayloadToSerial(raw);
  assert.equal(r.ok, true, `expected ok for ${JSON.stringify(raw)}`);
  if (r.ok) assert.equal(r.serial, serial);
}

function expectReject(raw: string) {
  const r = normalizeScanPayloadToSerial(raw);
  assert.equal(r.ok, false, `expected reject for ${JSON.stringify(raw)}`);
  if (!r.ok) {
    assert.equal(r.reason, 'unrecognized_url');
    assert.equal(r.message, UNRECOGNIZED_SCAN_CODE_MESSAGE);
  }
}

// TEST 1 — REAL TELKOMSEL URL
expectOk('https://tsel.id/cekvoucher?sn=901961579211202', '901961579211202');

// TEST 2 — PLAIN SN
expectOk('901961579211202', '901961579211202');

// TEST 3 — URL WITHOUT SN
expectReject('https://example.com/foo');

// TEST 4 — SURROUNDING WHITESPACE
expectOk('  https://tsel.id/cekvoucher?sn=901961579211202  \n', '901961579211202');

// TEST 5 — UPPERCASE PARAMETER
expectOk('https://example.com/foo?SN=901961579211202', '901961579211202');

// TEST 6 — MIXED-CASE PARAMETER
expectOk('https://example.com/foo?Sn=901961579211202', '901961579211202');

// TEST 7 — EMPTY PARAMETER
expectReject('https://example.com/foo?sn=');

// TEST 8 — MULTIPLE PARAMETERS
expectOk('https://example.com/foo?a=1&sn=901961579211202&b=2', '901961579211202');

// TEST 9 — URL VS PLAIN DUPLICATE (canonical + addCodesToScan)
{
  const url = 'https://tsel.id/cekvoucher?sn=901961579211202';
  const plain = '901961579211202';
  const a = normalizeScanPayloadToSerial(url);
  const b = normalizeScanPayloadToSerial(plain);
  assert.equal(a.ok && b.ok && a.ok === true && b.ok === true && a.serial === b.serial, true);
  const first = addCodesToScan([], [url], 30);
  assert.equal(first.added, 1);
  assert.deepEqual(
    first.list.map((s) => s.serial),
    ['901961579211202']
  );
  const second = addCodesToScan(first.list, [plain], 30);
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(second.list.length, 1);
}

// Cross-host same sn → duplicate
{
  const first = addCodesToScan([], ['https://tsel.id/cekvoucher?sn=901961579211202'], 30);
  const second = addCodesToScan(first.list, ['https://another.example/check?SN=901961579211202'], 30);
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(second.list.length, 1);
}

// TEST 10 — URL WITHOUT RECOGNIZED SN (serial= is NOT sn)
expectReject('https://example.com/foo?serial=901961579211202');

// TEST 11 — NON-URL QUERY-LIKE INPUT (not treated as URL)
{
  const odd = 'ABC?sn=123';
  const r = normalizeScanPayloadToSerial(odd);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.serial, 'ABC?sn=123');
}

// HTTP scheme uppercase
expectOk('HTTP://example.com/foo?SN=901961579211202', '901961579211202');

// Whitespace-only sn value
expectReject('https://example.com/foo?sn=%20%20');

// TEST 12 — EXISTING MANUAL INPUT REGRESSION
assert.deepEqual(expandSnRange('SN1,SN2, SN3'), ['SN1', 'SN2', 'SN3']);
assert.deepEqual(expandSnRange('SN1\nSN2\nSN3'), ['SN1', 'SN2', 'SN3']);
assert.deepEqual(expandSnRange('ABC1000-ABC1002'), ['ABC1000', 'ABC1001', 'ABC1002']);

{
  const v = validateSnInput('A1\nA2\nA3', 30);
  assert.equal(v.ok, true);
  assert.deepEqual(v.uniqueSerials, ['A1', 'A2', 'A3']);
}
{
  const v = validateSnInput('B1,B2,B3', 30);
  assert.equal(v.ok, true);
  assert.equal(v.count, 3);
}
{
  const v = validateSnInput('ABC001-ABC003', 30);
  assert.equal(v.ok, true);
  assert.deepEqual(v.uniqueSerials, ['ABC001', 'ABC002', 'ABC003']);
}

console.log('voucherPhysicalScan.test.ts: ALL PASS');
