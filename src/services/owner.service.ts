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
  }
};
