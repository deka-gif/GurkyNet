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

  async getProductProviders() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/product-providers');
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

  async syncCatalog(payload?: { queue?: boolean; cmd?: string[] }) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/sync', payload || {});
    return res.data;
  },

  async getSyncStatus() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/sync-status');
    return res.data;
  },

  // —— Product Provider Control Center (not payment gateways) ——
  async getProductProviderControl() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/product-provider-control');
    return res.data;
  },

  async enableProductProvider(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/enable`);
    return res.data;
  },

  async disableProductProvider(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/disable`);
    return res.data;
  },

  async setPrimaryProductProvider(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/set-primary`);
    return res.data;
  },

  async setProductProviderPriority(id: number | string, priority: number) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/priority`, { priority });
    return res.data;
  },

  async healthCheckProductProvider(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/health-check`);
    return res.data;
  },

  async syncProductProvider(id: number | string, payload?: { cmd?: string[] }) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/sync`, payload || {});
    return res.data;
  },

  async getProductProviderLogs(id: number | string, limit = 50) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/logs`, {
      params: { limit },
    });
    return res.data;
  },
};
