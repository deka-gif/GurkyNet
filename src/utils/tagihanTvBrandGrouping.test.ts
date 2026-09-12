/**
 * TV Pascabayar vendor grouping (web).
 * Run: npx --yes tsx src/utils/tagihanTvBrandGrouping.test.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../types';
import {
  groupTvPascabayarVendors,
  stripTrailingTagihanNominal,
} from './tagihanTvBrandGrouping';

function stub(code: string, name: string, operatorName = 'TV PASCABAYAR'): Product {
  return {
    id: 1,
    code,
    name,
    description: '',
    price: 1500,
    adminFee: 0,
    status: 'tersedia',
    category: 'tv-pascabayar',
    operatorName,
  } as Product;
}

assert.equal(stripTrailingTagihanNominal('K-Vision Pascabayar 50.000'), 'K-Vision Pascabayar');
assert.equal(stripTrailingTagihanNominal('BIG TV'), 'BIG TV');

const vendors = groupTvPascabayarVendors([
  stub('post733498', 'BIG TV'),
  stub('post737900', 'K-Vision Pascabayar 50.000'),
  stub('post737901', 'K-Vision Pascabayar 75.000'),
  stub('post737897', 'NEX MEDIA'),
]);

assert.equal(vendors.length, 3);
const kv = vendors.find((v) => v.name === 'K-Vision Pascabayar');
assert.ok(kv);
assert.equal(kv!.products.length, 2);
assert.ok(vendors.find((v) => v.name === 'BIG TV'));
assert.ok(vendors.find((v) => v.name === 'NEX MEDIA'));

console.log('tagihanTvBrandGrouping.test.ts: all assertions passed');
