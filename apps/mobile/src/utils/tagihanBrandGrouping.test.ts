/**
 * Tagihan brand grouping + multi-seller Digi prefer + flow-mode gates.
 * Run: npx --yes tsx src/utils/tagihanBrandGrouping.test.ts
 */
import assert from 'node:assert/strict';
import {
  isPlnBillDirectInputCategory,
  isTagihanBillDirectInputCategory,
  isTagihanBrandFirstCategory,
} from './tagihanFlowMode';
import { isHiddenRawCategorySlug } from '../config/catalogGrouping';
import { resolveProviderBrowseCategory } from './purchaseCategory';
import type { Product } from '../services/catalog.service';
import {
  groupTagihanBrandsByProductName,
  normalizeTagihanBrandKey,
  preferTagihanCatalogProduct,
  preferTagihanCatalogProductAmong,
  resolvePlnBillDirectSku,
  resolveTagihanBrandSelection,
} from './tagihanBrandGrouping';
import {
  resolveTagihanCheckoutSession,
  shouldClearTagihanInquiryOnIdentifierEdit,
} from './tagihanCheckout';

function stubProduct(
  code: string,
  name: string,
  opts?: { category?: string; operatorName?: string; price?: number; adminFee?: number; id?: number }
): Product {
  return {
    id: opts?.id ?? 1,
    code,
    name,
    zoneLabel: null,
    description: '',
    quota: null,
    validity: null,
    badge: null,
    price: opts?.price ?? 1500,
    adminFee: opts?.adminFee ?? 0,
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

assert.equal(byLabel['BIG TV'].boundSkuCode, 'post733498');
assert.equal(byLabel['BIG TV'].isAmbiguous, false);
assert.equal(byLabel['BIG TV'].hasMultipleOffers, false);

const bigTvResolve = resolveTagihanBrandSelection(byLabel['BIG TV']);
assert.equal(bigTvResolve.ok, true);
if (bigTvResolve.ok) assert.equal(bigTvResolve.product.code, 'post733498');

// Duplicate display name → ONE tile + preferred SKU (NOT ambiguous block)
const dup = groupTagihanBrandsByProductName([
  stubProduct('post733498', 'BIG TV', { price: 2500 }),
  stubProduct('post999999', '  BIG TV  ', { price: 1500 }),
]);
assert.equal(dup.length, 1);
assert.equal(dup[0].products.length, 2);
assert.equal(dup[0].hasMultipleOffers, true);
assert.equal(dup[0].isAmbiguous, false);
assert.equal(dup[0].boundSkuCode, 'post999999', 'prefer lower sell price');
const preferredDup = resolveTagihanBrandSelection(dup[0]);
assert.equal(preferredDup.ok, true);
if (preferredDup.ok) assert.equal(preferredDup.product.code, 'post999999');

assert.equal(normalizeTagihanBrandKey('  BIG TV  '), 'big tv');

// --- PDAM: different names stay separate (union) ---
const productionPdam = [
  stubProduct('post733471', 'PDAM Aetra', { category: 'pdam', operatorName: 'PDAM' }),
  stubProduct('post733472', 'PDAM Batam', { category: 'pdam', operatorName: 'PDAM' }),
  stubProduct('post733514', 'PDAM Kota Bitung', { category: 'pdam', operatorName: 'PDAM' }),
];
const pdamBrands = groupTagihanBrandsByProductName(productionPdam);
assert.equal(pdamBrands.length, 3);

// Same PDAM name multi Digi → one tile + prefer
const pdamDup = groupTagihanBrandsByProductName([
  stubProduct('post733471', 'PDAM Aetra', { category: 'pdam', price: 3000 }),
  stubProduct('post999998', '  PDAM Aetra  ', { category: 'pdam', price: 2000 }),
]);
assert.equal(pdamDup.length, 1);
assert.equal(pdamDup[0].hasMultipleOffers, true);
assert.equal(pdamDup[0].isAmbiguous, false);
assert.equal(pdamDup[0].boundSkuCode, 'post999998');
const pdamOk = resolveTagihanBrandSelection(pdamDup[0]);
assert.equal(pdamOk.ok, true);

// --- Case 1: multi-seller union — do NOT drop 3k ---
const sellerUnion = groupTagihanBrandsByProductName([
  stubProduct('a1k', 'PLN 1.000', { category: 'pln', price: 1000 }),
  stubProduct('a2k', 'PLN 2.000', { category: 'pln', price: 2000 }),
  stubProduct('a4k', 'PLN 4.000', { category: 'pln', price: 4000 }),
  stubProduct('b3k', 'PLN 3.000', { category: 'pln', price: 3000 }),
]);
assert.equal(sellerUnion.length, 4);
assert.deepEqual(
  sellerUnion.map((g) => g.boundSkuCode).sort(),
  ['a1k', 'a2k', 'a4k', 'b3k'].sort()
);

// --- Case 2: same 5k two sellers → ONE tile ---
const fiveK = groupTagihanBrandsByProductName([
  stubProduct('sellerA5k', 'PLN 5.000', { category: 'pln', price: 5200 }),
  stubProduct('sellerB5k', 'PLN 5.000', { category: 'pln', price: 5100 }),
]);
assert.equal(fiveK.length, 1);
assert.equal(fiveK[0].hasMultipleOffers, true);
assert.equal(fiveK[0].isAmbiguous, false);
assert.equal(fiveK[0].boundSkuCode, 'sellerB5k', 'lower price preferred');
const fiveResolve = resolveTagihanBrandSelection(fiveK[0]);
assert.equal(fiveResolve.ok, true);
if (fiveResolve.ok) assert.equal(fiveResolve.product.code, 'sellerB5k');

// Prefer Digi over VIP-
assert.equal(
  preferTagihanCatalogProduct(
    stubProduct('VIP-x', 'X', { price: 1000 }),
    stubProduct('postX', 'X', { price: 2000 })
  ).code,
  'postX'
);

// --- PLN Pascabayar production Digi multi-seller ---
const pascabayarDup = resolvePlnBillDirectSku([
  stubProduct('post733470', 'PLN Pascabayar', {
    category: 'pln-pascabayar',
    operatorName: 'PLN',
    price: 3000,
  }),
  stubProduct('post733563', 'PLN Pascabayar', {
    category: 'pln-pascabayar',
    operatorName: 'PLN',
    price: 4000,
  }),
]);
assert.equal(pascabayarDup.ok, true, 'multi Digi seller same name → preferred SKU, not block');
if (pascabayarDup.ok) {
  assert.equal(pascabayarDup.product.code, 'post733470', 'lower catalog price wins');
}

// Tie-break by code when prices equal
assert.equal(
  preferTagihanCatalogProductAmong([
    stubProduct('post733563', 'PLN Pascabayar', { price: 3000 }),
    stubProduct('post733470', 'PLN Pascabayar', { price: 3000 }),
  ])?.code,
  'post733470'
);

// Direct-input: multiple distinct customer products → still ambiguous
const directMultiName = resolvePlnBillDirectSku([
  stubProduct('a', 'Gas Negara', { category: 'gas' }),
  stubProduct('b', 'Something Else', { category: 'gas' }),
]);
assert.equal(directMultiName.ok, false);
if (!directMultiName.ok) assert.equal(directMultiName.reason, 'ambiguous');

// --- BPJS TK: PU + BPU two tiles; BPU multi Digi → one preferred ---
assert.equal(isTagihanBrandFirstCategory('bpjs-tk'), true);
const bpjsTkBrands = groupTagihanBrandsByProductName([
  stubProduct('post733500', 'Bpjs Ketenagakerjaan Penerima Upah', {
    category: 'bpjs-tk',
    price: 2500,
  }),
  stubProduct('post733501', 'Bpjs Ketenagakerjaan Bukan Penerima Upah', {
    category: 'bpjs-tk',
    price: 2500,
  }),
  stubProduct('post733503', 'Bpjs Ketenagakerjaan Bukan Penerima Upah', {
    category: 'bpjs-tk',
    price: 2500,
  }),
]);
assert.equal(bpjsTkBrands.length, 2);
const pu = bpjsTkBrands.find((b) => b.key === 'bpjs ketenagakerjaan penerima upah');
const bpu = bpjsTkBrands.find((b) => b.key === 'bpjs ketenagakerjaan bukan penerima upah');
assert.ok(pu);
assert.ok(bpu);
assert.equal(pu!.boundSkuCode, 'post733500');
assert.equal(pu!.hasMultipleOffers, false);
assert.equal(bpu!.hasMultipleOffers, true);
assert.equal(bpu!.isAmbiguous, false);
assert.equal(bpu!.boundSkuCode, 'post733501', 'tie-break lexicographic sku code');
const bpuResolve = resolveTagihanBrandSelection(bpu!);
assert.equal(bpuResolve.ok, true);
if (bpuResolve.ok) assert.equal(bpuResolve.product.code, 'post733501');

// --- Gas / BPJS Kes / flow gates ---
assert.equal(isTagihanBillDirectInputCategory('gas'), true);
assert.equal(isTagihanBillDirectInputCategory('bpjs-kesehatan'), true);
assert.equal(isTagihanBrandFirstCategory('pln-pascabayar'), false);
assert.equal(isTagihanBillDirectInputCategory('pln-pascabayar'), true);
assert.equal(isPlnBillDirectInputCategory('pln'), false);
assert.equal(resolveProviderBrowseCategory('gas-prepaid'), 'gas-prepaid');
assert.equal(isHiddenRawCategorySlug('hp-pascabayar'), true);

const gasDup = groupTagihanBrandsByProductName([
  stubProduct('post733494', 'Gas Negara', { category: 'gas', price: 1500 }),
  stubProduct('post999994', '  Gas Negara  ', { category: 'gas', price: 1600 }),
]);
assert.equal(gasDup[0].boundSkuCode, 'post733494');
assert.equal(resolveTagihanBrandSelection(gasDup[0]).ok, true);

// --- Inquiry binding: preferred SKU must match inquiry sku_code (mirrors isTagihanContextValid) ---
function isTagihanContextValidLite(
  ctx: {
    inquiry: { inquiry_ref_id: string; sku_code: string; customer_no: string };
    expiresAt: number;
  },
  targetNumber: string,
  skuCode: string
): boolean {
  if (!ctx.inquiry.inquiry_ref_id) return false;
  if (ctx.inquiry.customer_no !== targetNumber) return false;
  if (skuCode && ctx.inquiry.sku_code !== skuCode) return false;
  if (!ctx.expiresAt || Date.now() >= ctx.expiresAt) return false;
  return true;
}

{
  const preferredSku = 'post733470';
  const okCtx = {
    inquiry: {
      inquiry_ref_id: 'ref-A',
      sku_code: preferredSku,
      customer_no: '123',
    },
    expiresAt: Date.now() + 60_000,
  };
  assert.equal(isTagihanContextValidLite(okCtx, '123', preferredSku), true);
  // Attempt pay with SKU B while inquiry_ref is for SKU A → blocked
  assert.equal(isTagihanContextValidLite(okCtx, '123', 'post733563'), false);
}

// Identifier change → clear inquiry
assert.equal(shouldClearTagihanInquiryOnIdentifierEdit('123', '999'), true);

// SKU change → new checkout session (new inquiry required) via beginTagihan semantics
assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post733470',
    idempotencyKey: 'k1',
    existingInquiryRef: 'ref-A',
    productCode: 'post733563',
    nextInquiryRef: 'ref-A',
  }),
  'new'
);

// Same inquiry → same attempt
assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post733470',
    idempotencyKey: 'k1',
    existingInquiryRef: 'ref-A',
    productCode: 'post733470',
    nextInquiryRef: 'ref-A',
  }),
  'reuse'
);

// New inquiry → new attempt
assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post733470',
    idempotencyKey: 'k1',
    existingInquiryRef: 'ref-A',
    productCode: 'post733470',
    nextInquiryRef: 'ref-B',
  }),
  'new'
);

console.log('tagihanBrandGrouping.test.ts: all assertions passed');
