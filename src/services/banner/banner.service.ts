import { apiClient } from '../api';
import { Banner, ApiResponse } from '../../types';

export const bannerService = {
  getAll: async (): Promise<ApiResponse<Banner[]>> => {
    const response = await apiClient.get<ApiResponse<Banner[]>>('/public/banners');
    return response.data;
  },

  getBanners: async (): Promise<ApiResponse<Banner[]>> => {
    const response = await apiClient.get<ApiResponse<Banner[]>>('/public/banners');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Banner>> => {
    const response = await apiClient.get<ApiResponse<Banner>>(`/banners/${id}`);
    return response.data;
  },

  create: async (data: Partial<Banner>): Promise<ApiResponse<Banner>> => {
    const response = await apiClient.post<ApiResponse<Banner>>('/banners', data);
    return response.data;
  },

  createBanner: async (data: Partial<Banner>): Promise<ApiResponse<Banner>> => {
    const response = await apiClient.post<ApiResponse<Banner>>('/banners', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Banner>): Promise<ApiResponse<Banner>> => {
    const response = await apiClient.put<ApiResponse<Banner>>(`/banners/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/banners/${id}`);
    return response.data;
  },

  deleteBanner: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/banners/${id}`);
    return response.data;
  },
};

