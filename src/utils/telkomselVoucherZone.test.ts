import assert from 'node:assert/strict';
import type { Product } from '../types/index.ts';
import {
  availableTelkomselRegions,
  buildCityZoneListForRegion,
  categoryWarningLabel,
  collectTelkomselZoneLabels,
  filterCities,
  filterProductsByZoneLabel,
  hasTelkomselNationalProducts,
  isTelkomselOperator,
  orphanZoneLabels,
  searchCityForZoneLabel,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
  uniqueCityNamesForRegion,
  zoneLabelBelongsToRegion,
  zoneLabelsForCity,
  zoneLabelsForRegion,
  zoneLabelsWithoutCityData,
} from './telkomselVoucherZone.ts';

function mockProduct(partial: Partial<Product>): Product {
  return {
    id: partial.id ?? '1',
    code: partial.code ?? 'SKU',
    name: partial.name ?? 'Voucher Telkomsel',
    price: partial.price ?? 10000,
    category: 'voucher-internet',
    operatorName: partial.operatorName ?? 'Telkomsel',
    status: 'tersedia',
    zoneLabel: partial.zoneLabel,
    ...partial,
  } as Product;
}

const catalog: Product[] = [
  mockProduct({ id: '1', zoneLabel: 'Sumatera Utara Zona 1' }),
  mockProduct({ id: '2', zoneLabel: 'Jabodetabek' }),
  mockProduct({ id: '3', zoneLabel: null }),
  mockProduct({ id: '4', zoneLabel: 'Kalimantan Zona 3' }),
  mockProduct({ id: '5', zoneLabel: 'Hot Promo Special' }),
];

const reference = {
  'Sumatera Utara Zona 1': ['Kota Medan', 'Deli Serdang'],
  'Sumatera Utara Zona 3': ['Nias', 'Kota Medan'],
  'Kalimantan Zona 3': ['Kota Balikpapan'],
  Jabodetabek: ['Kota Bekasi', 'Kota Depok'],
  'Jawa Barat': ['Kota Bandung'],
};

assert.equal(isTelkomselOperator('Telkomsel'), true);
assert.equal(isTelkomselOperator('XL Axiata'), false);
assert.equal(telkomselNeedsZoneGate(catalog), true);
assert.equal(telkomselNeedsZoneGate([mockProduct({ zoneLabel: null }), mockProduct({ zoneLabel: null })]), false);
assert.equal(hasTelkomselNationalProducts(catalog), true);
assert.equal(hasTelkomselNationalProducts([mockProduct({ zoneLabel: 'Jabodetabek' })]), false);

const labels = collectTelkomselZoneLabels(catalog);
assert.deepEqual(labels, [
  'Hot Promo Special',
  'Jabodetabek',
  'Kalimantan Zona 3',
  'Sumatera Utara Zona 1',
]);

const regions = availableTelkomselRegions(labels);
assert.ok(regions.includes('Sumatra'));
assert.ok(regions.includes('Jawa'));
assert.ok(regions.includes('Kalimantan'));
assert.ok(!regions.includes('Sulawesi'));

assert.equal(zoneLabelBelongsToRegion('Sumatera Utara Zona 1', 'Sumatra'), true);
assert.equal(zoneLabelBelongsToRegion('Jabodetabek', 'Jawa'), true);

const sumatraZones = zoneLabelsForRegion(labels, 'Sumatra');
assert.deepEqual(sumatraZones, ['Sumatera Utara Zona 1']);

const orphans = orphanZoneLabels(labels);
assert.deepEqual(orphans, ['Hot Promo Special']);

const filtered = filterProductsByZoneLabel(catalog, 'Jabodetabek');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, '2');

const national = telkomselNationalProducts(catalog);
assert.equal(national.length, 1);
assert.equal(national[0].id, '3');

assert.deepEqual(searchCityForZoneLabel('medan', reference, ['Sumatera Utara Zona 1', 'Sumatera Utara Zona 3']), [
  'Sumatera Utara Zona 1',
  'Sumatera Utara Zona 3',
]);
assert.deepEqual(searchCityForZoneLabel('balikpapan', reference, labels), ['Kalimantan Zona 3']);
assert.deepEqual(searchCityForZoneLabel('surabaya', reference, labels), []);

const sumatraCityList = buildCityZoneListForRegion(reference, labels, 'Sumatra');
assert.ok(sumatraCityList.some((entry) => entry.city === 'Kota Medan' && entry.zoneLabel === 'Sumatera Utara Zona 1'));

const sumatraCities = uniqueCityNamesForRegion(reference, ['Sumatera Utara Zona 1', 'Sumatera Utara Zona 3'], 'Sumatra');
assert.ok(sumatraCities.includes('Kota Medan'));
assert.ok(sumatraCities.includes('Nias'));

assert.deepEqual(zoneLabelsForCity('Nias', reference, ['Sumatera Utara Zona 1', 'Sumatera Utara Zona 3']), [
  'Sumatera Utara Zona 3',
]);
assert.deepEqual(zoneLabelsForCity('Kota Medan', reference, ['Sumatera Utara Zona 1', 'Sumatera Utara Zona 3']), [
  'Sumatera Utara Zona 1',
  'Sumatera Utara Zona 3',
]);

assert.deepEqual(filterCities(['Kota Medan', 'Kota Bekasi'], 'bek'), ['Kota Bekasi']);

const jawaLabels = ['Jabodetabek', 'Sukabumi Bogor Banten', 'Jawa Lombok'];
assert.deepEqual(zoneLabelsWithoutCityData(reference, jawaLabels, 'Jawa'), [
  'Jawa Lombok',
  'Sukabumi Bogor Banten',
]);

assert.equal(categoryWarningLabel('orphan'), 'Wilayah Lainnya');
assert.equal(categoryWarningLabel('Sumatra'), 'Sumatra');

// UX flow expectations (logic-only; UI wiring lives in TelkomselZonePicker)
assert.equal(telkomselNationalProducts(catalog).every((p) => !p.zoneLabel), true);
assert.equal(orphans.length > 0, true);
assert.equal(
  zoneLabelsForCity('Kota Medan', reference, ['Sumatera Utara Zona 1', 'Sumatera Utara Zona 3']).length,
  2
);

console.log('telkomselVoucherZone.test.ts: ok');
