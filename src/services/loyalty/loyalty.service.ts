import { apiClient } from '../api';
import { ApiResponse } from '../../types';
import { createIdempotencyKey } from '../../utils/idempotency';

/** FR-DIFF-01 / FR-DIFF-08 — user loyalty API */
export const loyaltyService = {
  async getSummary() {
    const res = await apiClient.get<ApiResponse<any>>('/loyalty');
    return res.data?.data ?? res.data;
  },

  async getHistory(perPage = 20) {
    const res = await apiClient.get<ApiResponse<any>>('/loyalty/history', {
      params: { per_page: perPage },
    });
    return res.data?.data ?? res.data;
  },

  async redeem(points: number, idempotencyKey?: string) {
    const key = idempotencyKey || createIdempotencyKey('loyalty-redeem');
    const res = await apiClient.post<ApiResponse<any>>('/loyalty/redeem', {
      points,
      idempotency_key: key,
    });
    return res.data?.data ?? res.data;
  },
};

/** Finance Program Poin */
export const financeLoyaltyService = {
  async overview() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/loyalty/overview');
    return res.data?.data ?? res.data;
  },

  async ledger(params?: { type?: string; user_id?: number; per_page?: number }) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/loyalty/ledger', { params });
    return res.data?.data ?? res.data;
  },

  async userBalance(userId: number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/loyalty/users/${userId}`);
    return res.data?.data ?? res.data;
  },

  async adjust(payload: {
    user_id: number;
    points: number;
    direction: 'credit' | 'debit';
    reason: string;
    idempotency_key?: string;
  }) {
    const body = {
      ...payload,
      idempotency_key: payload.idempotency_key || createIdempotencyKey('loyalty-adjust'),
    };
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/loyalty/adjust', body);
    return res.data?.data ?? res.data;
  },
};
