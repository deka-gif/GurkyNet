import assert from 'node:assert/strict';
import {
  addCodesToScan,
  addScannedSerial,
  addScannedSerials,
  expandSnRange,
  removeScannedSerial,
  type ScannedSerial,
} from './voucherPhysicalScan.ts';

// expandSnRange
assert.deepEqual(expandSnRange(''), []);
assert.deepEqual(expandSnRange('SN1,SN2, SN3'), ['SN1', 'SN2', 'SN3']);
assert.deepEqual(expandSnRange('SN1\nSN2\nSN3'), ['SN1', 'SN2', 'SN3']);
assert.deepEqual(expandSnRange('ABC1000-ABC1002'), ['ABC1000', 'ABC1001', 'ABC1002']);
assert.deepEqual(expandSnRange('SINGLE-SN'), ['SINGLE-SN']); // no numeric suffix on both sides — literal
assert.deepEqual(expandSnRange('  RAW123  '), ['RAW123']);

// A range wider than 200 falls back to a literal single entry (guards against fat-finger ranges).
const wideRange = expandSnRange('X1-X99999');
assert.deepEqual(wideRange, ['X1-X99999']);

let nowCounter = 0;
const fakeNow = () => `T${nowCounter++}`;

// addScannedSerial
let list: ScannedSerial[] = [];
const first = addScannedSerial(list, 'SN001', fakeNow);
assert.equal(first.ok, true);
if (first.ok) list = first.list;
assert.deepEqual(list, [{ serial: 'SN001', scannedAt: 'T0' }]);

const dup = addScannedSerial(list, 'SN001', fakeNow);
assert.equal(dup.ok, false);
assert.equal(dup.ok === false && dup.reason, 'duplicate');
assert.equal(dup.list.length, 1); // unchanged

const empty = addScannedSerial(list, '   ', fakeNow);
assert.equal(empty.ok, false);
assert.equal(empty.ok === false && empty.reason, 'empty');

const second = addScannedSerial(list, 'SN002', fakeNow);
assert.equal(second.ok, true);
if (second.ok) list = second.list;
assert.equal(list.length, 2);

// original array reference must be untouched (no in-place mutation)
const before = list;
const third = addScannedSerial(list, 'SN003', fakeNow);
assert.equal(before.length, 2);
if (third.ok) list = third.list;
assert.equal(list.length, 3);

// addScannedSerials — bulk with mixed new/duplicate/blank entries
const bulk = addScannedSerials([], ['SNA', 'SNB', 'SNA', '  ', 'SNC'], fakeNow);
assert.equal(bulk.added, 3);
assert.equal(bulk.duplicates, 1);
assert.deepEqual(
  bulk.list.map((s) => s.serial),
  ['SNA', 'SNB', 'SNC']
);

// removeScannedSerial
const afterRemove = removeScannedSerial(list, 'SN002');
assert.deepEqual(
  afterRemove.map((s) => s.serial),
  ['SN001', 'SN003']
);
assert.equal(list.length, 3); // original untouched

// addCodesToScan
const cap = 3;
const batch1 = addCodesToScan([], ['A', 'B'], cap);
assert.equal(batch1.added, 2);
assert.equal(batch1.list.length, 2);

const batch2 = addCodesToScan(batch1.list, ['C'], cap);
assert.equal(batch2.added, 1);
assert.deepEqual(batch2.list.map((s) => s.serial), ['A', 'B', 'C']);
assert.equal(batch2.atCapacity, true);

const dupTry = addCodesToScan([{ serial: 'X1', scannedAt: 'T0' }], ['X1', 'Y1'], 5);
assert.equal(dupTry.added, 1);
assert.equal(dupTry.duplicates, 1);

const batch3 = addCodesToScan(batch2.list, ['D'], cap);
assert.equal(batch3.added, 0);
assert.equal(batch3.atCapacity, true);
assert.ok(batch3.noticeParts[0]?.includes('maksimal'));

console.log('voucherPhysicalScan.test.ts: ok');
