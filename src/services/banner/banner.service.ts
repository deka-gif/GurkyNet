import { apiClient } from '../api';
import { Banner, ApiResponse } from '../../types';

export const bannerService = {
  getBanners: async (): Promise<ApiResponse<Banner[]>> => {
    const response = await apiClient.get<ApiResponse<Banner[]>>('/public/banners');
    return response.data;
  },
};
