/**
 * E-Wallet open-amount helpers (Fix #3).
 * Run: npx --yes tsx src/utils/ewalletBrand.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  groupEwalletProviders,
  resolveEwalletOpenAmountProduct,
  validateEwalletOpenAmount,
  resolveEwalletBrandLabel,
} from './ewalletBrand';
import type { CategoryProviderSummary, Product } from '../services/catalog.service';

// Brand canonicalization — no duplicate GoPay
assert.equal(resolveEwalletBrandLabel('GO PAY'), 'GoPay');
assert.equal(resolveEwalletBrandLabel('GoPay'), 'GoPay');
assert.equal(resolveEwalletBrandLabel('SHOPEE PAY'), 'ShopeePay');

const providers: CategoryProviderSummary[] = [
  {
    providerId: 11,
    providerIds: [11, 38],
    name: 'GoPay',
    logo: null,
    count: 1,
    is_open_amount: true,
    sku_code: 'post733505',
    min_amount: 1000,
    max_amount: 500000,
  },
  {
    providerId: 38,
    name: 'GO PAY',
    logo: null,
    count: 10,
    // prepaid-only row without open-amount meta should collapse / be ignored when
    // API already sent canonical GoPay — still must not create second tile.
  },
];

const brands = groupEwalletProviders(providers);
assert.equal(brands.length, 1, 'exactly one GoPay brand');
assert.equal(brands[0].name, 'GoPay');
assert.equal(brands[0].skuCode, 'post733505');
assert.equal(brands[0].minAmount, 1000);
assert.equal(brands[0].maxAmount, 500000);
assert.ok(brands[0].providerIds.includes(11));
assert.ok(brands[0].providerIds.includes(38));

// Legacy provider summary without open-amount meta must still list known wallets
const legacyProviders: CategoryProviderSummary[] = [
  { providerId: 13, name: 'DANA', logo: null, count: 1 },
  { providerId: 11, name: 'GoPay', logo: null, count: 1 },
  { providerId: 15, name: 'LinkAja', logo: null, count: 1 },
  { providerId: 12, name: 'OVO', logo: null, count: 1 },
  { providerId: 14, name: 'ShopeePay', logo: null, count: 1 },
  { providerId: 99, name: 'E-Money', logo: null, count: 40 },
];
const legacyBrands = groupEwalletProviders(legacyProviders);
assert.equal(legacyBrands.length, 5, 'legacy API still shows 5 wallets');
assert.ok(legacyBrands.every((b) => b.name !== 'E-Wallet'));
assert.ok(legacyBrands.some((b) => b.name === 'GoPay' && b.skuCode == null));

// Amount validation from API limits (not hard-coded brand switches in assert targets)
// Digiflazz E-Money requires multiples of Rp1.000 (RC 87) — enforce before inquiry.
assert.equal(validateEwalletOpenAmount(1000, 1, 800000), null);
assert.equal(validateEwalletOpenAmount(800000, 1, 800000), null);
assert.ok(validateEwalletOpenAmount(0, 1, 800000));
assert.ok(validateEwalletOpenAmount(800001, 1, 800000));
assert.equal(
  validateEwalletOpenAmount(1, 1, 800000),
  'Nominal harus kelipatan Rp1.000',
  'DANA min 1 still rejects non-multiples of 1000'
);
assert.equal(
  validateEwalletOpenAmount(1500, 1, 800000),
  'Nominal harus kelipatan Rp1.000'
);

assert.equal(validateEwalletOpenAmount(1000, 1000, 500000), null);
assert.equal(validateEwalletOpenAmount(2000, 1000, 500000), null);
assert.equal(validateEwalletOpenAmount(500000, 1000, 500000), null);
assert.ok(validateEwalletOpenAmount(999, 1000, 500000));
assert.ok(validateEwalletOpenAmount(500001, 1000, 500000));
assert.equal(
  validateEwalletOpenAmount(1500, 1000, 500000),
  'Nominal harus kelipatan Rp1.000'
);

// Resolver prefers Bebas Nominal, never fixed denom match
const catalog: Product[] = [
  {
    id: 1,
    code: 'go100',
    name: 'Go Pay 100.000',
    zoneLabel: null,
    description: '',
    quota: null,
    validity: null,
    badge: null,
    price: 103000,
    adminFee: 0,
    status: 'tersedia',
    isPurchasable: true,
    category: 'topup-digital',
    operatorName: 'GO PAY',
  },
  {
    id: 2,
    code: 'post733505',
    name: 'Gopay Bebas Nominal',
    zoneLabel: null,
    description: '',
    quota: null,
    validity: null,
    badge: null,
    price: 1500,
    adminFee: 1500,
    status: 'tersedia',
    isPurchasable: true,
    category: 'topup-digital',
    operatorName: 'GoPay',
    is_open_amount: true,
    min_amount: 1000,
    max_amount: 500000,
  },
];

const open = resolveEwalletOpenAmountProduct(catalog, 'post733505');
assert.equal(open?.code, 'post733505');
assert.notEqual(resolveEwalletOpenAmountProduct(catalog)?.code, 'go100');

console.log('ewalletBrand.selftest: all assertions passed');
