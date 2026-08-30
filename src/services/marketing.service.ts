import { apiClient } from './api';
import { ApiResponse } from '../types';

export const marketingService = {
  // Dashboard
  async getDashboard(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/dashboard');
    return res.data;
  },

  // Banners
  async getBanners(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/banners', { params });
    return res.data;
  },
  async createBanner(data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/admin/marketing/banners', data);
    return res.data;
  },
  async updateBanner(id: string | number, data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/marketing/banners/${id}`, data);
    return res.data;
  },
  async deleteBanner(id: string | number): Promise<ApiResponse<any>> {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/marketing/banners/${id}`);
    return res.data;
  },

  // Promotions / Campaigns
  async getPromotions(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/promotions', { params });
    return res.data;
  },
  async createPromotion(data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/admin/marketing/promotions', data);
    return res.data;
  },
  async updatePromotion(id: string | number, data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/marketing/promotions/${id}`, data);
    return res.data;
  },
  async deletePromotion(id: string | number): Promise<ApiResponse<any>> {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/marketing/promotions/${id}`);
    return res.data;
  },

  // Vouchers
  async getVouchers(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/vouchers', { params });
    return res.data;
  },
  async createVoucher(data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/admin/marketing/vouchers', data);
    return res.data;
  },
  async updateVoucher(id: string | number, data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/marketing/vouchers/${id}`, data);
    return res.data;
  },
  async deleteVoucher(id: string | number): Promise<ApiResponse<any>> {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/marketing/vouchers/${id}`);
    return res.data;
  },

  // Announcements
  async getAnnouncements(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/announcements', { params });
    return res.data;
  },
  async createAnnouncement(data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.post<ApiResponse<any>>('/admin/marketing/announcements', data);
    return res.data;
  },
  async updateAnnouncement(id: string | number, data: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/marketing/announcements/${id}`, data);
    return res.data;
  },
  async deleteAnnouncement(id: string | number): Promise<ApiResponse<any>> {
    const res = await apiClient.delete<ApiResponse<any>>(`/admin/marketing/announcements/${id}`);
    return res.data;
  },

  // Brand Logo (Provider-level — Telkomsel/OVO/DANA/etc, what customers actually see)
  async getBrandLogos(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/brand-logos');
    return res.data;
  },
  async uploadBrandLogoFile(file: File): Promise<ApiResponse<{ path?: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'brand-logos');
    formData.append('alt_text', file.name.split('.')[0] || 'brand-logo');

    const res = await apiClient.post<ApiResponse<{ path?: string }>>('/admin/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  async setBrandLogo(id: string | number, logo: string): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/marketing/brand-logos/${id}`, { logo });
    return res.data;
  },

  async getCategoryIcons(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/admin/marketing/category-icons');
    return res.data;
  },
  async uploadCategoryIconFile(file: File): Promise<ApiResponse<{ path?: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'category-icons');
    formData.append('alt_text', file.name.split('.')[0] || 'category-icon');

    const res = await apiClient.post<ApiResponse<{ path?: string }>>('/admin/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  async setCategoryIcon(key: string, icon: string | null): Promise<ApiResponse<any>> {
    const res = await apiClient.put<ApiResponse<any>>(
      `/admin/marketing/category-icons/${encodeURIComponent(key)}`,
      { icon }
    );
    return res.data;
  },
};

