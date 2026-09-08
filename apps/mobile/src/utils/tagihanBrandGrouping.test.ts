/**
 * Slice 1 — Tagihan brand grouping (TV Pascabayar evidence).
 * Run: npx --yes tsx src/utils/tagihanBrandGrouping.test.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../services/catalog.service';
import {
  groupTagihanBrandsByProductName,
  normalizeTagihanBrandKey,
  resolveTagihanBrandSelection,
} from './tagihanBrandGrouping';

function stubProduct(code: string, name: string, price = 1500): Product {
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
    category: 'tv-pascabayar',
    operatorName: 'TV PASCABAYAR',
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

console.log('tagihanBrandGrouping.test.ts: all assertions passed');
