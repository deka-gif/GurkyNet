import { apiClient } from '../api';
import { Product, ApiResponse } from '../../types';

export interface ProductFilters {
  category?: string;
  provider?: string;
  status?: string;
  keyword?: string;
  per_page?: number;
  page?: number;
  telkomsel_group?: string;
  sort?: string;
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
      if (filters.status) params.append('status', filters.status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.telkomsel_group) params.append('telkomsel_group', filters.telkomsel_group);
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.page) params.append('page', String(filters.page));
      // Default page size for lazy catalogs; Telkomsel UX passes smaller per_page.
      params.append('per_page', (filters.per_page ?? 5000).toString());
    } else {
      params.append('per_page', '5000');
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get<ApiResponse<Product[]>>(`/products${queryString}`);
    return response.data;
  },

  getTelkomselDataTaxonomy: async (): Promise<ApiResponse<{ chips: any[]; operator: string }>> => {
    const response = await apiClient.get<ApiResponse<{ chips: any[]; operator: string }>>(
      '/catalog/telkomsel-data/taxonomy'
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

