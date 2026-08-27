import { apiClient } from '../api';
import { ApiResponse } from '../../types';

/** FR-DIFF-03 / 10 / 02 Sprint 15 clients */
export const agentMarginService = {
  async calculate(productId: number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/operations/agent-margin/${productId}`);
    return res.data?.data ?? res.data;
  },
  async upsertPrice(productId: number, agentLevel: string, sellPrice: number) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/operations/agent-margin/${productId}/prices`, {
      agent_level: agentLevel,
      sell_price: sellPrice,
    });
    return res.data?.data ?? res.data;
  },
};

export const ownerCashFlowService = {
  async projection() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/cash-flow-projection');
    return res.data?.data ?? res.data;
  },
};

export const subscriptionService = {
  async list() {
    const res = await apiClient.get<ApiResponse<any>>('/subscriptions');
    return res.data?.data ?? res.data;
  },
  async create(payload: { product_id: number; target_number: string; schedule_day: number; pin: string }) {
    const res = await apiClient.post<ApiResponse<any>>('/subscriptions', payload);
    return res.data?.data ?? res.data;
  },
  async update(id: number, payload: Record<string, unknown>) {
    const res = await apiClient.put<ApiResponse<any>>(`/subscriptions/${id}`, payload);
    return res.data?.data ?? res.data;
  },
  async pause(id: number, reason?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/subscriptions/${id}/pause`, { reason });
    return res.data?.data ?? res.data;
  },
  async resume(id: number, pin: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/subscriptions/${id}/resume`, { pin });
    return res.data?.data ?? res.data;
  },
  async cancel(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/subscriptions/${id}/cancel`);
    return res.data?.data ?? res.data;
  },
};
