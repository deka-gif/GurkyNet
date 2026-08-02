import { apiClient } from '../api';
import { Profile, ApiResponse } from '../../types';

export const profileService = {
  getProfile: async (): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.get<ApiResponse<Profile>>('/profile');
    return response.data;
  },

  updateProfile: async (data: { name: string; phone_number: string; email: string }): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.put<ApiResponse<Profile>>('/profile', data);
    return response.data;
  },

  updatePassword: async (data: { current_password: string; new_password: string; new_password_confirmation?: string }): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/profile/password', data);
    return response.data;
  }
};
