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

  async refreshProviderStatuses() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/providers/refresh-status');
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
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/monitoring', { params });
    return res.data;
  },

  async refreshMonitoring(params?: Record<string, any>) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/monitoring/refresh', params || {});
    return res.data;
  },

  async getMonitoringServiceDetail(serviceKey: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/monitoring/services/${serviceKey}`);
    return res.data;
  },

  async getMonitoringServiceIssues(
    serviceKey: string,
    params?: { product_provider_id?: number; page?: number; per_page?: number }
  ) {
    const res = await apiClient.get<ApiResponse<any>>(
      `/admin/operations/monitoring/services/${serviceKey}/issues`,
      { params }
    );
    return res.data;
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
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/product-provider-control', {
      timeout: 60000,
    });
    return res.data;
  },

  async getAutomaticCatalogSyncStatus() {
    const res = await apiClient.get<ApiResponse<any>>(
      '/admin/operations/product-provider-control/auto-sync',
      { timeout: 60000 }
    );
    return res.data;
  },

  /** Global refresh: health + balance + SKU + latency for all providers (no page reload). */
  async refreshProductProviderControl() {
    const res = await apiClient.post<ApiResponse<any>>(
      '/admin/operations/product-provider-control/refresh',
      {},
      { timeout: 180000 }
    );
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

  async uploadProviderLogoFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'product-providers');
    formData.append('alt_text', file.name.split('.')[0] || 'provider-logo');

    const res = await apiClient.post<ApiResponse<{ path?: string }>>('/admin/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async setProductProviderLogo(id: number | string, logo: string) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/logo`, {
      logo,
    });
    return res.data;
  },

  async setProductProviderPriority(id: number | string, priority: number) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/priority`, { priority });
    return res.data;
  },

  async healthCheckProductProvider(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(
      `/admin/operations/product-provider-control/${id}/health-check`,
      {},
      { timeout: 90000 }
    );
    return res.data;
  },

  async syncProductProvider(id: number | string, payload?: { cmd?: string[] }) {
    // Catalog sync can take minutes — never use the default 15s axios timeout (causes Canceled).
    const res = await apiClient.post<ApiResponse<any>>(
      `/admin/operations/product-provider-control/${id}/sync`,
      payload || {},
      { timeout: 300000 }
    );
    return res.data;
  },

  async getProductProviderLogs(id: number | string, limit = 50) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/logs`, {
      params: { limit },
      timeout: 60000,
    });
    return res.data;
  },

  async setProductProviderMaintenance(id: number | string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/product-provider-control/${id}/maintenance`);
    return res.data;
  },

  // —— Payment Gateway Control Center (not product providers) ——
  async getPaymentGatewayControl() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/payment-gateway-control');
    return res.data;
  },

  async refreshPaymentGateways() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/payment-gateway-control/refresh');
    return res.data;
  },

  async enablePaymentGateway(code: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/enable`);
    return res.data;
  },

  async disablePaymentGateway(code: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/disable`);
    return res.data;
  },

  async setPaymentGatewayMaintenance(code: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/maintenance`);
    return res.data;
  },

  async setPaymentGatewayPriority(code: string, priority: number) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/priority`, {
      priority,
    });
    return res.data;
  },

  async healthCheckPaymentGateway(code: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/health-check`);
    return res.data;
  },

  async getPaymentGatewayLogs(code: string, limit = 50) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/payment-gateway-control/${code}/logs`, {
      params: { limit },
    });
    return res.data;
  },

  // —— Operations Command Center (Sprint 8.4) ——
  async getCommandCenter() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/command-center');
    return res.data?.data || res.data;
  },

  async getInfraMonitoring() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/monitoring/infra');
    return res.data?.data || res.data;
  },

  async refreshInfraMonitoring() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/monitoring/infra/refresh');
    return res.data?.data || res.data;
  },

  async getLiveTransactions(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/live-transactions', { params });
    return res.data?.data || res.data;
  },

  async getActivityTimeline(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/activity-timeline', { params });
    return res.data?.data || res.data;
  },

  async getAlerts(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/operations/alerts', { params });
    return res.data?.data || res.data;
  },

  async evaluateAlerts() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/operations/alerts/evaluate');
    return res.data?.data || res.data;
  },

  async ackAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/alerts/${id}/ack`);
    return res.data?.data || res.data;
  },

  async investigateAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/alerts/${id}/investigate`);
    return res.data?.data || res.data;
  },

  async resolveAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/alerts/${id}/resolve`);
    return res.data?.data || res.data;
  },

  async closeAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/operations/alerts/${id}/close`);
    return res.data?.data || res.data;
  },

  async getIssueDetail(workflowId: number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/issues/${workflowId}`);
    return res.data?.data || res.data;
  },
};
