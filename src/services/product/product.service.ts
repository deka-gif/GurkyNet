import { apiClient } from '../api';
import { Product, ApiResponse } from '../../types';

export interface ProductFilters {
  category?: string;
  provider?: string;
  status?: string;
  keyword?: string;
  per_page?: number;
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
      // User catalog pages must receive the full filtered set (Ops ↔ User parity), not page 1 of 15.
      params.append('per_page', (filters.per_page ?? 5000).toString());
    } else {
      params.append('per_page', '5000');
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get<ApiResponse<Product[]>>(`/products${queryString}`);
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

