import assert from 'node:assert/strict';
import type { Product } from '../../types';
import { isCatalogListed } from '../../utils/catalogAvailability';

/** Mirrors BillPaymentFlow isCatalogReady guard (FR-OPS catalog UX). */
function isCatalogReady(
  readyForCategory: string | null,
  category: string,
  productsLoading: boolean
): boolean {
  return readyForCategory === category && !productsLoading;
}

/** Mirrors BillPaymentFlow vendors useMemo guard + grouping. */
function buildVendors(products: Product[], catalogReady: boolean): string[] {
  if (!catalogReady) return [];
  const map = new Map<string, string>();
  for (const p of products) {
    if (!isCatalogListed(p)) continue;
    const name = (p.operatorName || p.name || 'Lainnya').trim();
    map.set(name.toLowerCase(), name);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'id'));
}

/** Mirrors auto-skip-vendor effect guard. */
function shouldAutoSelectSingleVendor(params: {
  isCatalogReady: boolean;
  vendors: string[];
  step: 'vendor' | 'input';
  selectedVendor: string | null;
}): boolean {
  const { isCatalogReady, vendors, step, selectedVendor } = params;
  if (!isCatalogReady || vendors.length !== 1 || step !== 'vendor' || selectedVendor) {
    return false;
  }
  return true;
}

function mockProduct(partial: Partial<Product> & Pick<Product, 'operatorName'>): Product {
  return {
    id: partial.id ?? '1',
    name: partial.name ?? partial.operatorName,
    category: partial.category ?? 'pdam',
    price: partial.price ?? 0,
    status: 'tersedia',
    operatorName: partial.operatorName,
    ...partial,
  } as Product;
}

// Category A fetch finished — stale products remain in global store while category B mounts.
{
  const categoryB = 'bpjs-tk';
  const staleProducts = [
    mockProduct({ id: 'pdam-1', operatorName: 'PDAM SURABAYA', category: 'pdam' }),
  ];

  let readyForCategory: string | null = null;
  const productsLoading = false;

  assert.equal(isCatalogReady(readyForCategory, categoryB, productsLoading), false);

  const vendorsBeforeFetch = buildVendors(
    staleProducts,
    isCatalogReady(readyForCategory, categoryB, productsLoading)
  );
  assert.deepEqual(vendorsBeforeFetch, [], 'stale PDAM vendor must not appear before B fetch completes');

  assert.equal(
    shouldAutoSelectSingleVendor({
      isCatalogReady: false,
      vendors: ['PDAM SURABAYA'],
      step: 'vendor',
      selectedVendor: null,
    }),
    false,
    'auto-skip must not run on stale single-vendor data'
  );
}

// Category B fetch completes — correct vendor only.
{
  const categoryB = 'bpjs-tk';
  const bpjsProducts = [
    mockProduct({
      id: 'bpjs-1',
      operatorName: 'BPJS KETENAGAKERJAAN',
      category: 'bpjs-tk',
    }),
  ];

  const readyForCategory = categoryB;
  const productsLoading = false;

  assert.equal(isCatalogReady(readyForCategory, categoryB, productsLoading), true);

  const vendors = buildVendors(
    bpjsProducts,
    isCatalogReady(readyForCategory, categoryB, productsLoading)
  );
  assert.deepEqual(vendors, ['BPJS KETENAGAKERJAAN']);

  assert.equal(
    shouldAutoSelectSingleVendor({
      isCatalogReady: true,
      vendors,
      step: 'vendor',
      selectedVendor: null,
    }),
    true
  );
}

// UI loading gate: spinner while fetch in flight OR catalog not confirmed for this category.
{
  assert.equal(productsLoadingOrNotReady(true, true), true);
  assert.equal(productsLoadingOrNotReady(false, false), true);
  assert.equal(productsLoadingOrNotReady(false, true), false);
}

function productsLoadingOrNotReady(productsLoading: boolean, isReady: boolean): boolean {
  return productsLoading || !isReady;
}

console.log('BillPaymentFlow.catalogReady.test.ts: ok');
