import { apiClient } from './api';
import { ApiResponse, Media, MediaFilters } from '../types';

export const mediaService = {
  getMedia: async (filters?: MediaFilters): Promise<ApiResponse<Media[]>> => {
    const response = await apiClient.get<ApiResponse<Media[]>>('/admin/media', {
      params: filters
    });
    return response.data;
  },

  getMediaById: async (id: number): Promise<ApiResponse<Media>> => {
    const response = await apiClient.get<ApiResponse<Media>>(`/admin/media/${id}`);
    return response.data;
  },

  uploadMedia: async (file: File, folder?: string, altText?: string): Promise<ApiResponse<Media>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    if (altText) formData.append('alt_text', altText);

    const response = await apiClient.post<ApiResponse<Media>>('/admin/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateMedia: async (id: number, data: Partial<Media>): Promise<ApiResponse<Media>> => {
    const response = await apiClient.put<ApiResponse<Media>>(`/admin/media/${id}`, data);
    return response.data;
  },

  deleteMedia: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/admin/media/${id}`);
    return response.data;
  },
};
