import { apiClient } from '../api';
import type { ApiResponse } from '../../types';

/** SRS 31 / FR-REF-07 — user referral */
export const referralService = {
  async getSummary() {
    const res = await apiClient.get<ApiResponse<any>>('/referral');
    return res.data.data;
  },
  async getHistory(perPage = 20) {
    const res = await apiClient.get<ApiResponse<any>>('/referral/history', { params: { per_page: perPage } });
    return res.data.data;
  },
  async setCode(code: string) {
    const res = await apiClient.put<ApiResponse<any>>('/referral/code', { code });
    return res.data.data;
  },
  async getDownlines(perPage = 20) {
    const res = await apiClient.get<ApiResponse<any>>('/referral/downlines', { params: { per_page: perPage } });
    return res.data.data;
  },
};

/** SRS 31 — Finance referral program */
export const financeReferralService = {
  async getOverview() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/referral/overview');
    return res.data.data;
  },
  async getRules() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/referral/rules');
    return res.data.data;
  },
  async updateRule(payload: { level: number; percentage: number; reason: string }) {
    const res = await apiClient.put<ApiResponse<any>>('/admin/finance/referral/rules', payload);
    return res.data.data;
  },
  async getLedger(status?: string) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/referral/ledger', {
      params: status ? { status } : undefined,
    });
    return res.data.data;
  },
  async getFraudFlags() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/referral/fraud-flags');
    return res.data.data;
  },
};
