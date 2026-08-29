import assert from 'node:assert/strict';
import type { Product } from '../types/index.ts';
import {
  availableTelkomselRegions,
  collectTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  searchCityForZoneLabel,
  telkomselNeedsZoneGate,
  zoneLabelBelongsToRegion,
  zoneLabelsForRegion,
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
];

assert.equal(isTelkomselOperator('Telkomsel'), true);
assert.equal(isTelkomselOperator('XL Axiata'), false);
assert.equal(telkomselNeedsZoneGate(catalog), true);
assert.equal(telkomselNeedsZoneGate([mockProduct({ zoneLabel: null }), mockProduct({ zoneLabel: null })]), false);

const labels = collectTelkomselZoneLabels(catalog);
assert.deepEqual(labels, ['Jabodetabek', 'Kalimantan Zona 3', 'Sumatera Utara Zona 1']);

const regions = availableTelkomselRegions(labels);
assert.ok(regions.includes('Sumatra'));
assert.ok(regions.includes('Jawa'));
assert.ok(regions.includes('Kalimantan'));
assert.ok(!regions.includes('Sulawesi'));

assert.equal(zoneLabelBelongsToRegion('Sumatera Utara Zona 1', 'Sumatra'), true);
assert.equal(zoneLabelBelongsToRegion('Jabodetabek', 'Jawa'), true);

const sumatraZones = zoneLabelsForRegion(labels, 'Sumatra');
assert.deepEqual(sumatraZones, ['Sumatera Utara Zona 1']);

const filtered = filterProductsByZoneLabel(catalog, 'Jabodetabek');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, '2');

const reference = {
  'Sumatera Utara Zona 1': ['Kota Medan', 'Deli Serdang'],
  'Kalimantan Zona 3': ['Kota Balikpapan'],
};

assert.equal(
  searchCityForZoneLabel('medan', reference, labels),
  'Sumatera Utara Zona 1'
);
assert.equal(
  searchCityForZoneLabel('balikpapan', reference, labels),
  'Kalimantan Zona 3'
);
assert.equal(searchCityForZoneLabel('surabaya', reference, labels), null);

console.log('telkomselVoucherZone.test.ts: ok');
