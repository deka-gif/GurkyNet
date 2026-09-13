/**
 * Langganan package grouping selftest (audit Item 7).
 * Run: npx --yes tsx src/utils/langgananPackageGrouping.test.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../services/catalog.service';
import {
  groupLanggananPackages,
  stripLanggananVariantSuffix,
} from './langgananPackageGrouping';

function stub(code: string, name: string, price = 10000): Product {
  return {
    id: 1,
    code,
    name,
    zoneLabel: null,
    description: '',
    quota: null,
    validity: null,
    badge: null,
    price,
    adminFee: 0,
    status: 'tersedia',
    isPurchasable: true,
    category: 'langganan-digital',
    operatorName: 'K-VISION dan GOL',
  };
}

assert.equal(stripLanggananVariantSuffix('K-VISION 50.000'), 'K-VISION');
assert.equal(stripLanggananVariantSuffix('Vidio Platinum 30 Hari'), 'Vidio Platinum');
assert.equal(stripLanggananVariantSuffix('Vidio Platinum 3 Bulan'), 'Vidio Platinum');
assert.equal(stripLanggananVariantSuffix('Vidio Platinum Extra 1 Tahun'), 'Vidio Platinum Extra');
assert.equal(
  stripLanggananVariantSuffix('K-Vision & GOL Paket JOSS (180 Hari)'),
  'K-Vision & GOL Paket JOSS'
);
assert.equal(
  stripLanggananVariantSuffix('K-VISION & GOL PAKET JUARA (J01) 30 Hari'),
  'K-VISION & GOL PAKET JUARA (J01)'
);
assert.equal(stripLanggananVariantSuffix('Tanaka Voucher 1.000.000'), 'Tanaka Voucher');
assert.equal(stripLanggananVariantSuffix('Canva Pro'), 'Canva Pro');

const kvisionNominals = groupLanggananPackages([
  stub('a', 'K-VISION 10.000', 10000),
  stub('b', 'K-VISION 50.000', 50000),
  stub('c', 'K-VISION 100.000', 100000),
]);
assert.equal(kvisionNominals.length, 1);
assert.equal(kvisionNominals[0].label, 'K-VISION');
assert.equal(kvisionNominals[0].products.length, 3);
assert.equal(kvisionNominals[0].hasDistinctProductNames, true);

const vidio = groupLanggananPackages([
  stub('v1', 'Vidio Platinum 30 Hari', 30000),
  stub('v2', 'Vidio Platinum 3 Bulan', 80000),
  stub('v3', 'Vidio Platinum Extra 30 Hari', 40000),
]);
assert.equal(vidio.length, 2, 'Platinum vs Platinum Extra stay separate');
assert.equal(vidio.find((g) => g.label === 'Vidio Platinum')?.products.length, 2);
assert.equal(vidio.find((g) => g.label === 'Vidio Platinum Extra')?.products.length, 1);

const juara = groupLanggananPackages([
  stub('j1', 'K-VISION & GOL PAKET JUARA (J01) 30 Hari'),
  stub('j3', 'K-VISION & GOL PAKET JUARA (J03) 90 Hari'),
]);
assert.equal(juara.length, 2, 'different package codes must not merge');

const before = [
  stub('t1', 'Tanaka Voucher 50.000'),
  stub('t2', 'Tanaka Voucher 100.000'),
  stub('t3', 'Tanaka Voucher 200.000'),
  stub('solo', 'Canva Pro'),
];
assert.equal(before.length, 4);
const after = groupLanggananPackages(before);
assert.equal(after.length, 2, 'Tanaka merges; Canva stays');
assert.equal(after.find((g) => g.label === 'Tanaka Voucher')?.products.length, 3);

console.log('langgananPackageGrouping.test.ts: OK');
