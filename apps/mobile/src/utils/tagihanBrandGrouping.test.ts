/**
 * Slice 1–3 — Tagihan brand grouping (TV Pascabayar + PDAM + Internet Pascabayar evidence).
 * Run: npx --yes tsx src/utils/tagihanBrandGrouping.test.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../services/catalog.service';
import {
  groupTagihanBrandsByProductName,
  normalizeTagihanBrandKey,
  resolveTagihanBrandSelection,
} from './tagihanBrandGrouping';

function stubProduct(
  code: string,
  name: string,
  opts?: { category?: string; operatorName?: string; price?: number }
): Product {
  return {
    id: 1,
    code,
    name,
    zoneLabel: null,
    description: '',
    quota: null,
    validity: null,
    badge: null,
    price: opts?.price ?? 1500,
    adminFee: 0,
    status: 'tersedia',
    isPurchasable: true,
    category: opts?.category ?? 'tv-pascabayar',
    operatorName: opts?.operatorName ?? 'TV PASCABAYAR',
  };
}

// --- Production fixture names (Slice 0) → 6 tiles ---
const productionTv = [
  stubProduct('post733497', 'INDOVISION'),
  stubProduct('post733498', 'BIG TV'),
  stubProduct('post733499', 'FIRSTMEDIA'),
  stubProduct('post737899', 'Iconnet'),
  stubProduct('post737906', 'Biznet Home TV Pascabayar'),
  stubProduct('post737907', 'Indosat HiFi'),
];

const six = groupTagihanBrandsByProductName(productionTv);
assert.equal(six.length, 6, 'expected 6 brand tiles');

const byLabel = Object.fromEntries(six.map((g) => [g.label, g]));
assert.ok(byLabel['INDOVISION']);
assert.ok(byLabel['BIG TV']);
assert.ok(byLabel['FIRSTMEDIA']);
assert.ok(byLabel['Iconnet']);
assert.ok(byLabel['Biznet Home TV Pascabayar']);
assert.ok(byLabel['Indosat HiFi']);

// Casing preserved for Biznet
assert.equal(byLabel['Biznet Home TV Pascabayar'].label, 'Biznet Home TV Pascabayar');

// No price field on brand tile model
for (const g of six) {
  assert.equal(Object.prototype.hasOwnProperty.call(g, 'price'), false);
}

// Single-SKU binds correct code
assert.equal(byLabel['BIG TV'].boundSkuCode, 'post733498');
assert.equal(byLabel['Biznet Home TV Pascabayar'].boundSkuCode, 'post737906');
assert.equal(byLabel['BIG TV'].isAmbiguous, false);

const bigTvResolve = resolveTagihanBrandSelection(byLabel['BIG TV']);
assert.equal(bigTvResolve.ok, true);
if (bigTvResolve.ok) assert.equal(bigTvResolve.product.code, 'post733498');

// Duplicate display name → one tile, ambiguous
const dup = groupTagihanBrandsByProductName([
  stubProduct('post733498', 'BIG TV'),
  stubProduct('post999999', '  BIG TV  '),
]);
assert.equal(dup.length, 1);
assert.equal(dup[0].label, 'BIG TV');
assert.equal(dup[0].products.length, 2);
assert.equal(dup[0].isAmbiguous, true);
assert.equal(dup[0].boundSkuCode, null);

const amb = resolveTagihanBrandSelection(dup[0]);
assert.equal(amb.ok, false);
if (!amb.ok) assert.equal(amb.reason, 'ambiguous');

// normalize key
assert.equal(normalizeTagihanBrandKey('  BIG TV  '), 'big tv');
assert.equal(normalizeTagihanBrandKey('Biznet Home TV Pascabayar'), 'biznet home tv pascabayar');

// --- Slice 2 PDAM production fixtures (test-only; not hardcoded in UI) ---
const productionPdam = [
  stubProduct('post733471', 'PDAM Aetra', { category: 'pdam', operatorName: 'PDAM' }),
  stubProduct('post733472', 'PDAM Batam', { category: 'pdam', operatorName: 'PDAM' }),
  stubProduct('post733514', 'PDAM Kota Bitung', { category: 'pdam', operatorName: 'PDAM' }),
];

const pdamBrands = groupTagihanBrandsByProductName(productionPdam);
assert.equal(pdamBrands.length, 3, 'expected 3 PDAM brand tiles');

const pdamByLabel = Object.fromEntries(pdamBrands.map((g) => [g.label, g]));
assert.ok(pdamByLabel['PDAM Aetra']);
assert.ok(pdamByLabel['PDAM Batam']);
assert.ok(pdamByLabel['PDAM Kota Bitung']);

assert.equal(pdamByLabel['PDAM Aetra'].boundSkuCode, 'post733471');
assert.equal(pdamByLabel['PDAM Batam'].boundSkuCode, 'post733472');
assert.equal(pdamByLabel['PDAM Kota Bitung'].boundSkuCode, 'post733514');

const aetraResolve = resolveTagihanBrandSelection(pdamByLabel['PDAM Aetra']);
assert.equal(aetraResolve.ok, true);
if (aetraResolve.ok) assert.equal(aetraResolve.product.code, 'post733471');

// Deterministic sort (localeCompare id): Aetra → Batam → Kota Bitung
assert.deepEqual(
  pdamBrands.map((g) => g.label),
  ['PDAM Aetra', 'PDAM Batam', 'PDAM Kota Bitung']
);

// Duplicate PDAM display name → fail-closed
const pdamDup = groupTagihanBrandsByProductName([
  stubProduct('post733471', 'PDAM Aetra', { category: 'pdam', operatorName: 'PDAM' }),
  stubProduct('post999998', '  PDAM Aetra  ', { category: 'pdam', operatorName: 'PDAM' }),
]);
assert.equal(pdamDup.length, 1);
assert.equal(pdamDup[0].isAmbiguous, true);
assert.equal(pdamDup[0].boundSkuCode, null);
const pdamAmb = resolveTagihanBrandSelection(pdamDup[0]);
assert.equal(pdamAmb.ok, false);
if (!pdamAmb.ok) assert.equal(pdamAmb.reason, 'ambiguous');

// --- Slice 3 Internet Pascabayar production fixtures (test-only; not hardcoded in UI) ---
const productionInternet = [
  stubProduct('post733483', 'XL HOME', {
    category: 'internet-pascabayar',
    operatorName: 'INTERNET PASCABAYAR',
  }),
  stubProduct('post733484', 'BIZNET HOME', {
    category: 'internet-pascabayar',
    operatorName: 'INTERNET PASCABAYAR',
  }),
  stubProduct('post733485', 'BNETFIT', {
    category: 'internet-pascabayar',
    operatorName: 'INTERNET PASCABAYAR',
  }),
];

const internetBrands = groupTagihanBrandsByProductName(productionInternet);
assert.equal(internetBrands.length, 3, 'expected 3 Internet Pascabayar brand tiles');

const internetByLabel = Object.fromEntries(internetBrands.map((g) => [g.label, g]));
assert.ok(internetByLabel['XL HOME']);
assert.ok(internetByLabel['BIZNET HOME']);
assert.ok(internetByLabel['BNETFIT']);

assert.equal(internetByLabel['XL HOME'].boundSkuCode, 'post733483');
assert.equal(internetByLabel['BIZNET HOME'].boundSkuCode, 'post733484');
assert.equal(internetByLabel['BNETFIT'].boundSkuCode, 'post733485');

const xlResolve = resolveTagihanBrandSelection(internetByLabel['XL HOME']);
assert.equal(xlResolve.ok, true);
if (xlResolve.ok) assert.equal(xlResolve.product.code, 'post733483');

// Deterministic sort (localeCompare id): BIZNET HOME → BNETFIT → XL HOME
assert.deepEqual(
  internetBrands.map((g) => g.label),
  ['BIZNET HOME', 'BNETFIT', 'XL HOME']
);

// Duplicate Internet display name → fail-closed
const internetDup = groupTagihanBrandsByProductName([
  stubProduct('post733483', 'XL HOME', {
    category: 'internet-pascabayar',
    operatorName: 'INTERNET PASCABAYAR',
  }),
  stubProduct('post999997', '  XL HOME  ', {
    category: 'internet-pascabayar',
    operatorName: 'INTERNET PASCABAYAR',
  }),
]);
assert.equal(internetDup.length, 1);
assert.equal(internetDup[0].isAmbiguous, true);
assert.equal(internetDup[0].boundSkuCode, null);
const internetAmb = resolveTagihanBrandSelection(internetDup[0]);
assert.equal(internetAmb.ok, false);
if (!internetAmb.ok) assert.equal(internetAmb.reason, 'ambiguous');

console.log('tagihanBrandGrouping.test.ts: all assertions passed');
