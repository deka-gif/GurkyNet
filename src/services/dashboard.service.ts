import { Transaction, UserProfile, WalletInfo, BannerPromo, QuickMenuItem } from '../types';
import { apiClient } from './api';

import { ApiResponse } from '../types';

export interface UserDashboardResponse {
  user: UserProfile;
  wallet: WalletInfo;
  banners: BannerPromo[];
  quickMenu: QuickMenuItem[];
  recentTransactions: Transaction[];
}

export const dashboardService = {
  async getDashboard(): Promise<UserDashboardResponse> {
    const res = await apiClient.get<ApiResponse<UserDashboardResponse>>('/dashboard');
    return res.data.data;
  },
  async getQuickMenu(): Promise<QuickMenuItem[]> {
    const res = await apiClient.get<ApiResponse<QuickMenuItem[]>>('/dashboard');
    return res.data.data as any;
  },
  async getBanners(): Promise<BannerPromo[]> {
    const res = await apiClient.get<ApiResponse<BannerPromo[]>>('/dashboard');
    return res.data.data as any;
  },
  async getRecentTransactions(): Promise<Transaction[]> {
    const res = await apiClient.get<ApiResponse<Transaction[]>>('/dashboard');
    return res.data.data as any;
  }
};
