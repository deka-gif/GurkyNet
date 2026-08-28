import assert from 'node:assert/strict';
import { filterVoucherInternetProducts } from './voucherInternetGuard.ts';
import type { Product } from '../types/index.ts';

const base = {
  id: '1',
  code: 'SKU',
  name: 'Produk',
  price: 10000,
  operatorName: 'XL Axiata',
  status: 'tersedia' as const,
};

const products: Product[] = [
  { ...base, id: '1', code: 'VI-XL-5GB', category: 'voucher-internet' },
  { ...base, id: '2', code: 'PULSA-XL-10K', category: 'pulsa' },
  { ...base, id: '3', code: 'DATA-VOUCHER-BUT-NOT-INTERNET', category: 'voucher', name: 'Voucher Data Belanja' },
  { ...base, id: '4', code: 'PLN-TOKEN-20K', category: 'pln' },
  { ...base, id: '5', code: 'VI-INDOSAT-3GB', category: 'voucher-internet', operatorName: 'Indosat' },
];

const filtered = filterVoucherInternetProducts(products);

assert.equal(filtered.length, 2);
assert.ok(filtered.every((p) => p.category === 'voucher-internet'));
assert.deepEqual(
  filtered.map((p) => p.id),
  ['1', '5']
);

// A product whose name merely contains "data"/"voucher" must never slip through on
// name alone — only the resolved category field decides membership in this module.
assert.ok(!filtered.some((p) => p.code === 'DATA-VOUCHER-BUT-NOT-INTERNET'));

assert.deepEqual(filterVoucherInternetProducts([]), []);
