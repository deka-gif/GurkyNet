import type { Product } from '../types';

/**
 * Shared Ops → User Dashboard catalog rules.
 * Active + Maintenance are listed; Inactive / gangguan are hidden.
 * Only Active (isPurchasable) can open checkout.
 */
export function isCatalogListed(p: Pick<Product, 'status' | 'availabilityStatus' | 'isCatalogVisible'>): boolean {
  return (
    p.status === 'tersedia' ||
    p.status === 'maintenance' ||
    p.availabilityStatus === 'maintenance' ||
    p.isCatalogVisible === true
  );
}

export function isProductPurchasable(
  p: Pick<Product, 'status' | 'availabilityStatus' | 'isPurchasable' | 'isActive'>
): boolean {
  return (
    p.isPurchasable !== false &&
    p.isActive !== false &&
    p.status === 'tersedia' &&
    p.availabilityStatus !== 'maintenance'
  );
}

export function catalogStatusLabel(p: Pick<Product, 'status' | 'availabilityStatus'>): string {
  if (p.status === 'maintenance' || p.availabilityStatus === 'maintenance') {
    return 'Maintenance';
  }
  if (p.status === 'tersedia') {
    return 'Tersedia';
  }
  return 'Gangguan';
}
