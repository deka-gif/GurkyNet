/**
 * Cross-division Workflow Engine client (Sprint 8.2).
 */

import { apiClient } from '../api';

export type WorkflowDivision = 'customer_support' | 'operations' | 'finance' | 'marketing' | 'admin';

export type WorkflowStatus =
  | 'waiting_cs'
  | 'waiting_operations'
  | 'waiting_finance'
  | 'waiting_marketing'
  | 'waiting_user'
  | 'resolved'
  | 'rejected'
  | 'cancelled'
  | 'closed'
  | string;

export type WorkflowItem = {
  id: number;
  workflowCode: string;
  source: string;
  category: string;
  currentDivision: WorkflowDivision | string;
  status: WorkflowStatus;
  priority: string;
  title: string;
  description?: string | null;
  createdByName?: string | null;
  assignedToName?: string | null;
  conversationId?: number | null;
  transactionId?: number | null;
  meta?: Record<string, unknown> | null;
  events?: WorkflowEventItem[];
  transaction?: {
    id: number;
    invoice?: string | null;
    status?: string;
    totalPayment?: number;
    customerName?: string | null;
    customerEmail?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
};

export type WorkflowEventItem = {
  id: number;
  eventType: string;
  fromDivision?: string | null;
  toDivision?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  action?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  actorName?: string | null;
  createdAt?: string;
};

export const workflowService = {
  async list(params: Record<string, string | number | boolean | undefined> = {}) {
    const res = await apiClient.get('/admin/workflows', { params });
    return {
      data: (res.data?.data?.data || []) as WorkflowItem[],
      meta: res.data?.data?.meta || {},
    };
  },

  async get(id: number) {
    const res = await apiClient.get(`/admin/workflows/${id}`);
    return res.data?.data as WorkflowItem;
  },

  async create(payload: Record<string, unknown>) {
    const res = await apiClient.post('/admin/workflows', payload);
    return res.data?.data as WorkflowItem;
  },

  async escalate(id: number, targetDivision: string, note?: string) {
    const res = await apiClient.post(`/admin/workflows/${id}/escalate`, { targetDivision, note });
    return res.data?.data as WorkflowItem;
  },

  async action(id: number, action: string, note?: string, payload?: Record<string, unknown>) {
    const res = await apiClient.post(`/admin/workflows/${id}/actions`, { action, note, payload });
    return res.data?.data as WorkflowItem;
  },

  async close(id: number, note?: string) {
    const res = await apiClient.post(`/admin/workflows/${id}/close`, { note });
    return res.data?.data as WorkflowItem;
  },

  async forceResolve(id: number, note?: string) {
    const res = await apiClient.post(`/admin/workflows/${id}/force-resolve`, { note });
    return res.data?.data as WorkflowItem;
  },

  async assign(id: number, assignedTo: number) {
    const res = await apiClient.post(`/admin/workflows/${id}/assign`, { assignedTo });
    return res.data?.data as WorkflowItem;
  },

  async reassign(id: number, assignedTo: number) {
    const res = await apiClient.post(`/admin/workflows/${id}/reassign`, { assignedTo });
    return res.data?.data as WorkflowItem;
  },

  async override(id: number, status: string, note?: string) {
    const res = await apiClient.post(`/admin/workflows/${id}/override`, { status, note });
    return res.data?.data as WorkflowItem;
  },

  async stats(division: string) {
    const res = await apiClient.get(`/admin/workflows/stats/${division}`);
    return (res.data?.data || {}) as Record<string, number | Record<string, number> | null>;
  },
};
