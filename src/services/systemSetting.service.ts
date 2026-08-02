import { apiClient } from './api';
import { ApiResponse } from '../types';

export const systemSettingService = {
  async getSettings(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/system-settings');
    return res.data;
  },

  async updateSettings(settings: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>('/admin/system-settings', { settings });
    return res.data;
  },

  async sendTestEmail(email: string): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/admin/system-settings/test-email', { email });
    return res.data;
  }
};
