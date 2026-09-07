import type { Product } from '../services/catalog.service';

/** Sort catalog products by sell price ascending (nominal kecil → besar). */
export function sortProductsByPriceAsc<T extends { price: number }>(products: T[]): T[] {
  return products.slice().sort((a, b) => a.price - b.price);
}
