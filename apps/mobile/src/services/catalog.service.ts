import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

/**
 * Only the customer-facing subset of ProductResource
 * (laravel/app/Http/Resources/ProductResource.php). The real API response also carries
 * internal fields — providerCost, margin, productProvider, productProviderCode,
 * opsStatus, categoryMappingSource, availabilityStatus — deliberately not declared here
 * so nothing in the app can render them without an explicit unsafe cast.
 *
 * `operatorName`/`provider` on the wire is the telco/utility BRAND (Telkomsel, PLN, …),
 * not the PPOB fulfillment source (Digiflazz/VIP) — that distinction is what makes it
 * safe to surface here.
 */
export interface Product {
  id: number;
  code: string;
  name: string;
  zoneLabel: string | null;
  description: string;
  quota: string | null;
  validity: string | null;
  badge: string | null;
  price: number;
  status: 'tersedia' | 'maintenance' | 'gangguan';
  isPurchasable: boolean;
  category: string;
  operatorName: string;
}

export interface ProductFilters {
  category?: string;
  keyword?: string;
  per_page?: number;
  page?: number;
}

export const catalogService = {
  /** GET /categories — public, returns all categories regardless of product count. */
  getCategories: async (): Promise<ApiResponse<Category[]>> => {
    const response = await apiClient.get<ApiResponse<Category[]>>('/categories');
    return response.data;
  },

  /** GET /products?category=&keyword=&per_page= — public, server-paginated. */
  getProducts: async (filters: ProductFilters): Promise<ApiResponse<Product[]>> => {
    const response = await apiClient.get<ApiResponse<Product[]>>('/products', { params: filters });
    return response.data;
  },

  /** GET /products/{sku_code} — the only authoritative source for a single product's
   * current price; never reuse a price captured from the list response. */
  getProduct: async (skuCode: string): Promise<ApiResponse<Product>> => {
    const response = await apiClient.get<ApiResponse<Product>>(`/products/${encodeURIComponent(skuCode)}`);
    return response.data;
  },
};
