import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export const complaintService = {
  list: async (perPage = 20) => {
    const res = await apiClient.get<ApiResponse<any[]>>('/complaints', { params: { per_page: perPage } });
    return res.data;
  },
  show: async (id: string | number) => {
    const res = await apiClient.get<ApiResponse<any>>(`/complaints/${id}`);
    return res.data;
  },
  create: async (payload: FormData) => {
    const res = await apiClient.post<ApiResponse<any>>('/complaints', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
