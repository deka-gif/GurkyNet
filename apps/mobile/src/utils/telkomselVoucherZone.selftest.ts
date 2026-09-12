/**
 * Selftest: Telkomsel voucher zone gate — Nasional vs Wilayah Lainnya.
 * Run: npx --yes tsx src/utils/telkomselVoucherZone.selftest.ts
 */
import assert from 'node:assert/strict';
import type { Product } from '../services/catalog.service';
import {
  collectGeographicTelkomselZoneLabels,
  collectOrphanTelkomselZoneLabels,
  collectTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselGeographicZoneLabel,
  isTelkomselMarketingZoneLabel,
  isTelkomselSelectableZoneLabel,
  orphanZoneLabels,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from './telkomselVoucherZone';

function stub(partial: {
  code: string;
  name: string;
  zoneLabel?: string | null;
}): Product {
  return {
    id: 1,
    code: partial.code,
    name: partial.name,
    category: 'voucher-internet',
    basePrice: 1000,
    sellPrice: 1100,
    adminFee: 0,
    status: true,
    zoneLabel: partial.zoneLabel ?? null,
  } as Product;
}

const catalog = [
  stub({ name: 'Nasional Umum', zoneLabel: null, code: 'n1' }),
  stub({ name: 'Jabodetabek', zoneLabel: 'Jabodetabek', code: 'j1' }),
  stub({ name: 'Jabo-Jabar', zoneLabel: 'Jabo - Jabar', code: 'pre33614747' }),
  stub({
    name: 'Jawa Bali Lombok',
    zoneLabel: 'Jawa Bali Lombok Zona 3',
    code: 'pre33614758',
  }),
  stub({ name: 'Hot Promo', zoneLabel: 'Hot Promo', code: 'hp1' }),
];

assert.equal(isTelkomselMarketingZoneLabel('Hot Promo'), true);
assert.equal(isTelkomselGeographicZoneLabel('Jabo - Jabar'), false);
assert.equal(isTelkomselSelectableZoneLabel('Jabo - Jabar'), true);
assert.equal(isTelkomselSelectableZoneLabel('Hot Promo'), false);
assert.equal(isTelkomselGeographicZoneLabel('Jabodetabek'), true);

assert.equal(telkomselNeedsZoneGate(catalog), true);

const national = telkomselNationalProducts(catalog);
assert.deepEqual(
  national.map((p) => p.code).sort(),
  ['hp1', 'n1'],
  'Nasional = null zoneLabel + Hot Promo only'
);
assert.ok(!national.some((p) => p.code === 'pre33614747'));
assert.ok(!national.some((p) => p.code === 'pre33614758'));

const geo = collectGeographicTelkomselZoneLabels(catalog);
assert.deepEqual(geo, ['Jabodetabek']);

const orphans = collectOrphanTelkomselZoneLabels(catalog);
assert.deepEqual(orphans, ['Jabo - Jabar', 'Jawa Bali Lombok Zona 3']);
assert.ok(!orphans.includes('Hot Promo'));

assert.equal(filterProductsByZoneLabel(catalog, 'Jabo - Jabar').length, 1);
assert.equal(filterProductsByZoneLabel(catalog, 'Jawa Bali Lombok Zona 3').length, 1);
assert.equal(filterProductsByZoneLabel(catalog, 'Hot Promo').length, 0);

assert.deepEqual(
  orphanZoneLabels(collectTelkomselZoneLabels(catalog)),
  ['Jabo - Jabar', 'Jawa Bali Lombok Zona 3']
);

console.log('telkomselVoucherZone.selftest: all assertions passed');
