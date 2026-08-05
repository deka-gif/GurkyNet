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
    const mapped: Record<string, any> = { ...(params || {}) };

    if (mapped.method && !mapped.payment_method) {
      mapped.payment_method = mapped.method;
      delete mapped.method;
    }

    if (mapped.date_range && !mapped.start_date) {
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      let start = end;
      const range = String(mapped.date_range).toLowerCase();
      if (range.includes('hari') || range.includes('today')) {
        start = end;
      } else if (range.includes('minggu') || range.includes('week')) {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = d.toISOString().slice(0, 10);
      } else if (range.includes('bulan') || range.includes('month')) {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      } else if (range.includes('tahun') || range.includes('year')) {
        start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      }
      mapped.start_date = start;
      mapped.end_date = end;
      delete mapped.date_range;
    }

    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reports', { params: mapped });
    return res.data;
  },
};

