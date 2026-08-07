import { apiClient } from './api';
import { ApiResponse } from '../types';

export interface AuditLogsParams {
  search?: string;
  module?: string;
  operator?: string;
  date?: string;
  page?: number;
  limit?: number;
  per_page?: number;
  [key: string]: any;
}

export const ownerService = {
  async getDashboard(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/dashboard');
    return res.data;
  },

  async getCommandCenter() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/command-center', { timeout: 120000 });
    return res.data?.data || res.data;
  },

  async getExecutiveAlerts() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/alerts', { timeout: 90000 });
    return res.data?.data || res.data;
  },

  async getRisks() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/risks');
    return res.data?.data || res.data;
  },

  async getGoals() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/goals');
    return res.data?.data || res.data;
  },

  async getProfit() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/profit');
    return res.data?.data || res.data;
  },

  async getTreasury() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/treasury');
    return res.data?.data || res.data;
  },

  async getInsights() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/insights');
    return res.data?.data || res.data;
  },

  async getWorkflowMonitor() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/workflow-monitor');
    return res.data?.data || res.data;
  },

  async getApprovals() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/approvals');
    return res.data?.data || res.data;
  },

  async decideApproval(workflowId: number, decision: 'approve' | 'reject', note?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/executive/approvals/${workflowId}/decide`, {
      decision,
      note,
    });
    return res.data?.data || res.data;
  },

  async getFinancialOverview(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/financial-overview', { params });
    return res.data;
  },

  async getDepartmentOverview(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/department-overview', { params });
    return res.data;
  },

  async getSystemHealth(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/system-health');
    return res.data;
  },

  async getAuditLogs(params?: AuditLogsParams): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/audit-logs', { params });
    return res.data;
  },

  async getActivityTimeline(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/executive/activity-timeline', { params });
    return res.data;
  },
};
