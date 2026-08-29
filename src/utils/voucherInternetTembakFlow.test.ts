import assert from 'node:assert/strict';
import type { Product } from '../types/index.ts';
import { detectOperatorFromPhone } from './detectOperator.ts';
import { operatorsMatch } from './operatorMatch.ts';
import { isCatalogListed } from './catalogAvailability.ts';

/** Mirrors VoucherInternetPage tembak provider + product visibility guards. */
function resolveTembakProvider(autoProvider: string | null, zona: string | null): string | null {
  return autoProvider || zona;
}

function buildTembakProducts(
  products: Product[],
  autoProvider: string | null,
  zona: string | null
): Product[] {
  const provider = resolveTembakProvider(autoProvider, zona);
  if (!provider) return [];
  return products
    .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, provider))
    .sort((a, b) => a.price - b.price);
}

function shouldShowTembakProducts(
  phoneNo: string,
  autoProvider: string | null,
  zona: string | null
): boolean {
  const phoneReady = phoneNo.replace(/\D/g, '').length >= 10;
  return phoneReady && !!(autoProvider || zona);
}

function requiresManualZoneFallback(phoneNo: string, autoProvider: string | null): boolean {
  const phoneReady = phoneNo.replace(/\D/g, '').length >= 10;
  return phoneReady && !autoProvider;
}

function mockProduct(partial: Partial<Product> & Pick<Product, 'operatorName'>): Product {
  return {
    id: partial.id ?? '1',
    code: partial.code ?? 'VI-1',
    name: partial.name ?? 'Paket 5GB',
    category: 'voucher-internet',
    price: partial.price ?? 25000,
    status: 'tersedia',
    operatorName: partial.operatorName,
    ...partial,
  } as Product;
}

const catalog = [
  mockProduct({ id: 'tsel', operatorName: 'Telkomsel', code: 'VI-TSEL-5GB' }),
  mockProduct({ id: 'xl', operatorName: 'XL Axiata', code: 'VI-XL-5GB' }),
];

// Auto-detect path: no manual zona required.
{
  const phone = '081234567890';
  const autoProvider = detectOperatorFromPhone(phone);
  assert.equal(autoProvider, 'Telkomsel');
  assert.equal(requiresManualZoneFallback(phone, autoProvider), false);
  assert.equal(shouldShowTembakProducts(phone, autoProvider, null), true);

  const products = buildTembakProducts(catalog, autoProvider, null);
  assert.equal(products.length, 1);
  assert.equal(products[0].operatorName, 'Telkomsel');
  assert.equal(resolveTembakProvider(autoProvider, null), 'Telkomsel');
}

// Unknown prefix: fallback zona required before products appear.
{
  const phone = '070012345678';
  const autoProvider = detectOperatorFromPhone(phone);
  assert.equal(autoProvider, null);
  assert.equal(requiresManualZoneFallback(phone, autoProvider), true);
  assert.equal(shouldShowTembakProducts(phone, autoProvider, null), false);
  assert.deepEqual(buildTembakProducts(catalog, autoProvider, null), []);

  assert.equal(shouldShowTembakProducts(phone, autoProvider, 'XL Axiata'), true);
  const fallbackProducts = buildTembakProducts(catalog, autoProvider, 'XL Axiata');
  assert.equal(fallbackProducts.length, 1);
  assert.equal(fallbackProducts[0].operatorName, 'XL Axiata');
}

// Short phone: no products yet (even if autoProvider would eventually resolve).
{
  const phone = '0812';
  const autoProvider = detectOperatorFromPhone(phone);
  assert.equal(autoProvider, 'Telkomsel');
  assert.equal(shouldShowTembakProducts(phone, autoProvider, null), false);
}

console.log('voucherInternetTembakFlow.test.ts: ok');
