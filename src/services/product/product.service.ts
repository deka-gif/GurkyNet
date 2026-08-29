import { apiClient } from '../api';
import { Product, ApiResponse } from '../../types';

export interface ProductFilters {
  category?: string;
  provider?: string;
  provider_id?: number;
  status?: string;
  keyword?: string;
  per_page?: number;
  page?: number;
  telkomsel_group?: string;
  data_group?: string;
  sort?: string;
}

export interface CategoryProviderSummary {
  providerId: number;
  name: string;
  logo: string | null;
  count: number;
}

export const productService = {
  getAll: async (): Promise<ApiResponse<Product[]>> => {
    const response = await apiClient.get<ApiResponse<Product[]>>('/products');
    return response.data;
  },

  getProducts: async (filters?: ProductFilters): Promise<ApiResponse<Product[]>> => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.category) params.append('category', filters.category);
      if (filters.provider) params.append('provider', filters.provider);
      if (filters.provider_id != null) params.append('provider_id', String(filters.provider_id));
      if (filters.status) params.append('status', filters.status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.data_group) params.append('data_group', filters.data_group);
      if (filters.telkomsel_group) params.append('telkomsel_group', filters.telkomsel_group);
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.page) params.append('page', String(filters.page));
      // Default page size for lazy catalogs; Telkomsel UX passes smaller per_page.
      params.append('per_page', (filters.per_page ?? 5000).toString());
    } else {
      params.append('per_page', '5000');
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get<ApiResponse<Product[]>>(`/products${queryString}`, {
      timeout: 120000,
    });
    return response.data;
  },

  getCategoryProviders: async (category: string): Promise<ApiResponse<CategoryProviderSummary[]>> => {
    const params = new URLSearchParams({ category });
    const response = await apiClient.get<ApiResponse<CategoryProviderSummary[]>>(
      `/products/providers?${params.toString()}`
    );
    return response.data;
  },

  getTelkomselDataTaxonomy: async (): Promise<ApiResponse<{ chips: any[]; operator: string; regionOptions?: string[] }>> => {
    return productService.getOperatorDataTaxonomy('telkomsel');
  },

  getOperatorDataTaxonomy: async (
    key: 'telkomsel' | 'xl' | 'indosat' | 'tri' | 'smartfren' | 'axis' | 'byu'
  ): Promise<ApiResponse<{ chips: any[]; operator: string; regionOptions?: string[] }>> => {
    const pathMap: Record<string, string> = {
      telkomsel: '/catalog/telkomsel-data/taxonomy',
      xl: '/catalog/xl-data/taxonomy',
      indosat: '/catalog/indosat-data/taxonomy',
      tri: '/catalog/tri-data/taxonomy',
      smartfren: '/catalog/smartfren-data/taxonomy',
      axis: '/catalog/axis-data/taxonomy',
      byu: '/catalog/byu-data/taxonomy',
    };
    const path = pathMap[key] ?? pathMap.telkomsel;
    const response = await apiClient.get<ApiResponse<{ chips: any[]; operator: string; regionOptions?: string[] }>>(
      path
    );
    return response.data;
  },

  getTelkomselVoucherZoneReference: async (): Promise<ApiResponse<{ zones: Record<string, string[]> }>> => {
    const response = await apiClient.get<ApiResponse<{ zones: Record<string, string[]> }>>(
      '/catalog/telkomsel-voucher-zones'
    );
    return response.data;
  },
  
  getCategories: async (): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/categories');
    return response.data;
  },

  getProviders: async (): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/providers');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Product>> => {
    const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data;
  },

  create: async (data: Partial<Product>): Promise<ApiResponse<Product>> => {
    const response = await apiClient.post<ApiResponse<Product>>('/admin/operations/products', data);
    return response.data;
  },

  createProduct: async (data: Partial<Product>): Promise<ApiResponse<Product>> => {
    const response = await apiClient.post<ApiResponse<Product>>('/admin/operations/products', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Product>): Promise<ApiResponse<Product>> => {
    const response = await apiClient.put<ApiResponse<Product>>(`/admin/operations/products/${id}`, data);
    return response.data;
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<ApiResponse<Product>> => {
    const response = await apiClient.put<ApiResponse<Product>>(`/admin/operations/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/admin/operations/products/${id}`);
    return response.data;
  },

  deleteProduct: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/admin/operations/products/${id}`);
    return response.data;
  },
};

