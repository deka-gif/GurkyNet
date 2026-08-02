import { apiClient } from './api';
import { ApiResponse } from '../types';

export const financeService = {
  async getDashboard() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data;
  },

  async getSummary() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.summary || res.data.data || {};
  },

  async getRevenueChart() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.revenueChart || res.data.data?.chart || [];
  },

  async getStatusSummaries() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.statusSummaries || res.data.data?.statuses || [];
  },

  async getLatestPayments() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.latestPayments || res.data.data?.payments || [];
  },

  async getSettlements(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/settlements', { params });
    return res.data;
  },

  async getRefunds(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/refunds', { params });
    return res.data;
  },

  async approveRefund(id: string, data?: { note?: string; internalReviewNote?: string }) {
    try {
      const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/refunds/${id}/approve`, data);
      return res.data;
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 405) {
        const res = await apiClient.put<ApiResponse<any>>(`/admin/finance/refunds/${id}`, {
          status: 'Approved',
          ...data,
        });
        return res.data;
      }
      throw err;
    }
  },

  async rejectRefund(id: string, data?: { note?: string; internalReviewNote?: string }) {
    try {
      const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/refunds/${id}/reject`, data);
      return res.data;
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 405) {
        const res = await apiClient.put<ApiResponse<any>>(`/admin/finance/refunds/${id}`, {
          status: 'Rejected',
          ...data,
        });
        return res.data;
      }
      throw err;
    }
  },

  async updateRefundStatus(id: string, status: string, data?: { note?: string; internalReviewNote?: string }) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/finance/refunds/${id}`, {
      status,
      ...data,
    });
    return res.data;
  },

  async getReports(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reports', { params });
    return res.data;
  },
};

