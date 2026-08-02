import { apiClient } from './api';
import { ApiResponse } from '../types';

export const operationsService = {
  async getDashboard() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/dashboard');
    return res.data;
  },

  async getProducts(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/products', { params });
    return res.data;
  },

  async updateProduct(id: string | number, data: Record<string, any>) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/products/${id}`, data);
    return res.data;
  },

  async getProviders(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/providers', { params });
    return res.data;
  },

  async updateProvider(id: string | number, data: Record<string, any>) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/providers/${id}`, data);
    return res.data;
  },

  async getPricing(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/pricing', { params });
    return res.data;
  },

  async updatePricing(data: Record<string, any>, id?: string | number) {
    const url = id ? `/admin/operations/pricing/${id}` : '/admin/operations/pricing';
    const res = await apiClient.put<ApiResponse<any>>(url, data);
    return res.data;
  },

  async getMonitoring(params?: Record<string, any>) {
    try {
      const res = await apiClient.get<ApiResponse<any>>('/admin/operations/monitoring', { params });
      return res.data;
    } catch {
      const res = await apiClient.get<ApiResponse<any>>('/admin/operations/dashboard', { params });
      return res.data;
    }
  },
};
