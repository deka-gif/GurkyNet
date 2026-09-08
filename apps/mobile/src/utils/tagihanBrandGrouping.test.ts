/**
 * Tagihan brand grouping + PLN bill direct-input + flow-mode gates.
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
  resolvePlnBillDirectSku,
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

// --- Slice 4 Multifinance production fixtures (test-only; not hardcoded in UI) ---
const productionMultifinance = [
  stubProduct('post733488', 'Columbia Finance', {
    category: 'multifinance',
    operatorName: 'MULTIFINANCE',
  }),
  stubProduct('post733489', 'Bussan Auto Finance', {
    category: 'multifinance',
    operatorName: 'MULTIFINANCE',
  }),
  stubProduct('post733490', 'PT Aeon Credit Service Indonesia', {
    category: 'multifinance',
    operatorName: 'MULTIFINANCE',
  }),
];

const mfBrands = groupTagihanBrandsByProductName(productionMultifinance);
assert.equal(mfBrands.length, 3, 'expected 3 Multifinance brand tiles');

const mfByLabel = Object.fromEntries(mfBrands.map((g) => [g.label, g]));
assert.ok(mfByLabel['Columbia Finance']);
assert.ok(mfByLabel['Bussan Auto Finance']);
assert.ok(mfByLabel['PT Aeon Credit Service Indonesia']);

assert.equal(mfByLabel['Columbia Finance'].boundSkuCode, 'post733488');
assert.equal(mfByLabel['Bussan Auto Finance'].boundSkuCode, 'post733489');
assert.equal(mfByLabel['PT Aeon Credit Service Indonesia'].boundSkuCode, 'post733490');

const columbiaResolve = resolveTagihanBrandSelection(mfByLabel['Columbia Finance']);
assert.equal(columbiaResolve.ok, true);
if (columbiaResolve.ok) assert.equal(columbiaResolve.product.code, 'post733488');

// Deterministic sort (localeCompare id)
assert.deepEqual(
  mfBrands.map((g) => g.label),
  ['Bussan Auto Finance', 'Columbia Finance', 'PT Aeon Credit Service Indonesia']
);

// Duplicate Multifinance display name → fail-closed
const mfDup = groupTagihanBrandsByProductName([
  stubProduct('post733488', 'Columbia Finance', {
    category: 'multifinance',
    operatorName: 'MULTIFINANCE',
  }),
  stubProduct('post999996', '  Columbia Finance  ', {
    category: 'multifinance',
    operatorName: 'MULTIFINANCE',
  }),
]);
assert.equal(mfDup.length, 1);
assert.equal(mfDup[0].isAmbiguous, true);
assert.equal(mfDup[0].boundSkuCode, null);
const mfAmb = resolveTagihanBrandSelection(mfDup[0]);
assert.equal(mfAmb.ok, false);
if (!mfAmb.ok) assert.equal(mfAmb.reason, 'ambiguous');

// --- BPJS Kesehatan production fixture (test-only; not hardcoded in UI) ---
const productionBpjsKes = [
  stubProduct('post733487', 'Bpjs Kesehatan', {
    category: 'bpjs-kesehatan',
    operatorName: 'BPJS Kesehatan',
  }),
];

const bpjsKesBrands = groupTagihanBrandsByProductName(productionBpjsKes);
assert.equal(bpjsKesBrands.length, 1, 'expected 1 BPJS Kesehatan brand tile');
assert.equal(bpjsKesBrands[0].label, 'Bpjs Kesehatan');
assert.equal(bpjsKesBrands[0].boundSkuCode, 'post733487');
assert.equal(bpjsKesBrands[0].isAmbiguous, false);
assert.equal(Object.prototype.hasOwnProperty.call(bpjsKesBrands[0], 'price'), false);

const bpjsKesResolve = resolveTagihanBrandSelection(bpjsKesBrands[0]);
assert.equal(bpjsKesResolve.ok, true);
if (bpjsKesResolve.ok) assert.equal(bpjsKesResolve.product.code, 'post733487');

// Duplicate BPJS Kesehatan display name → fail-closed
const bpjsKesDup = groupTagihanBrandsByProductName([
  stubProduct('post733487', 'Bpjs Kesehatan', {
    category: 'bpjs-kesehatan',
    operatorName: 'BPJS Kesehatan',
  }),
  stubProduct('post999995', '  Bpjs Kesehatan  ', {
    category: 'bpjs-kesehatan',
    operatorName: 'BPJS Kesehatan',
  }),
]);
assert.equal(bpjsKesDup.length, 1);
assert.equal(bpjsKesDup[0].isAmbiguous, true);
assert.equal(bpjsKesDup[0].boundSkuCode, null);
const bpjsKesAmb = resolveTagihanBrandSelection(bpjsKesDup[0]);
assert.equal(bpjsKesAmb.ok, false);
if (!bpjsKesAmb.ok) assert.equal(bpjsKesAmb.reason, 'ambiguous');

// --- Gas Negara production fixture (test-only; not hardcoded in UI) ---
const productionGas = [
  stubProduct('post733494', 'Gas Negara', {
    category: 'gas',
    operatorName: 'GAS NEGARA',
  }),
];

const gasBrands = groupTagihanBrandsByProductName(productionGas);
assert.equal(gasBrands.length, 1, 'expected 1 Gas Negara brand tile');
assert.equal(gasBrands[0].label, 'Gas Negara');
assert.equal(gasBrands[0].boundSkuCode, 'post733494');
assert.equal(gasBrands[0].isAmbiguous, false);
assert.equal(Object.prototype.hasOwnProperty.call(gasBrands[0], 'price'), false);

const gasResolve = resolveTagihanBrandSelection(gasBrands[0]);
assert.equal(gasResolve.ok, true);
if (gasResolve.ok) assert.equal(gasResolve.product.code, 'post733494');

// Duplicate Gas Negara display name → fail-closed
const gasDup = groupTagihanBrandsByProductName([
  stubProduct('post733494', 'Gas Negara', { category: 'gas', operatorName: 'GAS NEGARA' }),
  stubProduct('post999994', '  Gas Negara  ', { category: 'gas', operatorName: 'GAS NEGARA' }),
]);
assert.equal(gasDup.length, 1);
assert.equal(gasDup[0].isAmbiguous, true);
assert.equal(gasDup[0].boundSkuCode, null);
const gasAmb = resolveTagihanBrandSelection(gasDup[0]);
assert.equal(gasAmb.ok, false);
if (!gasAmb.ok) assert.equal(gasAmb.reason, 'ambiguous');

// --- PLN Nontaglis: direct-input bind (catalog SKU; not brand-first) ---
const productionPlnNontaglis = [
  stubProduct('post733504', 'PLN Nontaglis', {
    category: 'pln-nontaglis',
    operatorName: 'PLN NONTAGLIS',
  }),
];

const nontaglisDirect = resolvePlnBillDirectSku(productionPlnNontaglis);
assert.equal(nontaglisDirect.ok, true);
if (nontaglisDirect.ok) assert.equal(nontaglisDirect.product.code, 'post733504');

// Duplicate PLN Nontaglis display name → fail-closed (no silent pick)
const nontaglisDupDirect = resolvePlnBillDirectSku([
  stubProduct('post733504', 'PLN Nontaglis', {
    category: 'pln-nontaglis',
    operatorName: 'PLN NONTAGLIS',
  }),
  stubProduct('post999993', '  PLN Nontaglis  ', {
    category: 'pln-nontaglis',
    operatorName: 'PLN NONTAGLIS',
  }),
]);
assert.equal(nontaglisDupDirect.ok, false);
if (!nontaglisDupDirect.ok) assert.equal(nontaglisDupDirect.reason, 'ambiguous');

// --- PLN Pascabayar HOLD: duplicate Digi SKUs → fail-closed ---
const pascabayarDup = resolvePlnBillDirectSku([
  stubProduct('post733470', 'PLN Pascabayar', {
    category: 'pln-pascabayar',
    operatorName: 'PLN',
  }),
  stubProduct('post733563', 'PLN Pascabayar', {
    category: 'pln-pascabayar',
    operatorName: 'PLN',
  }),
]);
assert.equal(pascabayarDup.ok, false);
if (!pascabayarDup.ok) assert.equal(pascabayarDup.reason, 'ambiguous');

// --- Flow-mode gates (regression) ---
assert.equal(isTagihanBrandFirstCategory('pln-nontaglis'), false);
assert.equal(isTagihanBrandFirstCategory('pln-pascabayar'), false);
assert.equal(isTagihanBrandFirstCategory('pln'), false);
assert.equal(isTagihanBillDirectInputCategory('pln-nontaglis'), true);
assert.equal(isTagihanBillDirectInputCategory('pln-pascabayar'), true);
assert.equal(isPlnBillDirectInputCategory('pln'), false, 'Token PLN must stay on PlnTokenCatalogFlow');

// BPJS Kesehatan / Gas Negara → direct-input (single service)
assert.equal(isTagihanBrandFirstCategory('bpjs-kesehatan'), false);
assert.equal(isTagihanBillDirectInputCategory('bpjs-kesehatan'), true);
assert.equal(isTagihanBrandFirstCategory('gas'), false);
assert.equal(isTagihanBillDirectInputCategory('gas'), true);

const bpjsKesDirect = resolvePlnBillDirectSku([
  stubProduct('post733487', 'Bpjs Kesehatan', {
    category: 'bpjs-kesehatan',
    operatorName: 'BPJS Kesehatan',
  }),
]);
assert.equal(bpjsKesDirect.ok, true);
if (bpjsKesDirect.ok) assert.equal(bpjsKesDirect.product.code, 'post733487');

const gasDirect = resolvePlnBillDirectSku([
  stubProduct('post733494', 'Gas Negara', { category: 'gas', operatorName: 'GAS NEGARA' }),
]);
assert.equal(gasDirect.ok, true);
if (gasDirect.ok) assert.equal(gasDirect.product.code, 'post733494');

// BPJS TK → brand-first membership type; BPU Digi collision fail-closed
assert.equal(isTagihanBrandFirstCategory('bpjs-tk'), true);
assert.equal(isTagihanBillDirectInputCategory('bpjs-tk'), false);
const bpjsTkBrands = groupTagihanBrandsByProductName([
  stubProduct('post733500', 'Bpjs Ketenagakerjaan Penerima Upah', {
    category: 'bpjs-tk',
    operatorName: 'BPJS KETENAGAKERJAAN',
  }),
  stubProduct('post733501', 'Bpjs Ketenagakerjaan Bukan Penerima Upah', {
    category: 'bpjs-tk',
    operatorName: 'BPJS KETENAGAKERJAAN',
  }),
  stubProduct('post733503', 'Bpjs Ketenagakerjaan Bukan Penerima Upah', {
    category: 'bpjs-tk',
    operatorName: 'BPJS KETENAGAKERJAAN',
  }),
]);
assert.equal(bpjsTkBrands.length, 2);
const pu = bpjsTkBrands.find((b) => b.key === 'bpjs ketenagakerjaan penerima upah');
const bpu = bpjsTkBrands.find((b) => b.key === 'bpjs ketenagakerjaan bukan penerima upah');
assert.ok(pu);
assert.ok(bpu);
assert.equal(pu!.isAmbiguous, false);
assert.equal(pu!.boundSkuCode, 'post733500');
assert.equal(bpu!.isAmbiguous, true);
assert.equal(bpu!.boundSkuCode, null);
const bpuResolve = resolveTagihanBrandSelection(bpu!);
assert.equal(bpuResolve.ok, false);
if (!bpuResolve.ok) assert.equal(bpuResolve.reason, 'ambiguous');

// Multi-brand Tagihan stay brand-first
assert.equal(isTagihanBrandFirstCategory('tv-pascabayar'), true);
assert.equal(isTagihanBrandFirstCategory('pdam'), true);
assert.equal(isTagihanBrandFirstCategory('internet-pascabayar'), true);
assert.equal(isTagihanBrandFirstCategory('multifinance'), true);
assert.equal(isTagihanBillDirectInputCategory('tv-pascabayar'), false);
assert.equal(isTagihanBillDirectInputCategory('gas'), true);

// Gas Prepaid → provider browse (not tagihan bill / not brand-first)
assert.equal(resolveProviderBrowseCategory('gas-prepaid'), 'gas-prepaid');
assert.equal(isTagihanBrandFirstCategory('gas-prepaid'), false);
assert.equal(isTagihanBillDirectInputCategory('gas-prepaid'), false);

// HP Pascabayar hidden from Mobile Semua Layanan
assert.equal(isHiddenRawCategorySlug('hp-pascabayar'), true);

console.log('tagihanBrandGrouping.test.ts: all assertions passed');
