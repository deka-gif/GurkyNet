import { Product } from '../types';

/**
 * Voucher Internet is scoped to Kuota/Internet products only — never mix in pulsa,
 * token listrik, e-wallet, game top-up, etc. even if the API response is stale/wrong.
 * Every product rendered by dashboard/voucher-internet must pass this filter first.
 */
export function filterVoucherInternetProducts(products: Product[]): Product[] {
  return products.filter((p) => p.category === 'voucher-internet');
}
