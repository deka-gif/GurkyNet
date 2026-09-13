/**
 * Web langganan package grouping smoke (audit Item 7).
 * Run: npx --yes tsx src/utils/langgananPackageGrouping.test.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../types';
import {
  groupLanggananPackages,
  stripLanggananVariantSuffix,
} from './langgananPackageGrouping';

function stub(code: string, name: string, price = 10000): Product {
  return {
    id: Math.random(),
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
    operatorName: 'VIDIO',
  } as Product;
}

assert.equal(stripLanggananVariantSuffix('K-VISION 50.000'), 'K-VISION');
assert.equal(stripLanggananVariantSuffix('Vidio Platinum 30 Hari'), 'Vidio Platinum');
const g = groupLanggananPackages([
  stub('a', 'K-VISION 10.000'),
  stub('b', 'K-VISION 50.000'),
  stub('c', 'Vidio Platinum 30 Hari'),
  stub('d', 'Vidio Platinum 3 Bulan'),
]);
assert.equal(g.length, 2);
assert.equal(g.find((x) => x.label === 'K-VISION')?.products.length, 2);
assert.equal(g.find((x) => x.label === 'Vidio Platinum')?.products.length, 2);
console.log('langgananPackageGrouping.test.ts (web): OK');
