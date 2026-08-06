import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export const accountContentService = {
  help: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/help');
    return res.data;
  },
  privacy: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/privacy');
    return res.data;
  },
  terms: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/terms');
    return res.data;
  },
  about: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/about');
    return res.data;
  },
};
