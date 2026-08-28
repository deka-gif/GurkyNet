import assert from 'node:assert/strict';
import {
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
