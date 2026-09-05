import type { Product } from '../services/catalog.service';

/**
 * Subset of web `src/utils/catalogAvailability.ts` for Mobile Product fields.
 * Listing: tersedia + maintenance. Purchase: isPurchasable + status tersedia.
 */

export function isCatalogListed(p: Pick<Product, 'status'>): boolean {
  return p.status === 'tersedia' || p.status === 'maintenance';
}

export function isProductPurchasable(p: Pick<Product, 'status' | 'isPurchasable'>): boolean {
  return p.isPurchasable !== false && p.status === 'tersedia';
}
