import { apiClient } from '../api';
import { Profile, ApiResponse } from '../../types';

export const profileService = {
  getProfile: async (): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.get<ApiResponse<Profile>>('/profile');
    return response.data;
  },

  updateProfile: async (data: {
    name?: string;
    phone_number?: string;
    birth_date?: string;
    gender?: string;
    address?: string;
  }): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.put<ApiResponse<Profile>>('/profile', data);
    return response.data;
  },

  updatePassword: async (data: {
    current_password: string;
    new_password: string;
    new_password_confirmation?: string;
  }): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/profile/password', data);
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<ApiResponse<Profile>> => {
    const form = new FormData();
    form.append('avatar', file);
    const response = await apiClient.post<ApiResponse<Profile>>('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getSecurity: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>('/profile/security');
    return response.data;
  },

  createPin: async (pin: string, pinConfirmation: string): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.post<ApiResponse<Profile>>('/pin/create', {
      pin,
      pin_confirmation: pinConfirmation,
    });
    return response.data;
  },

  changePin: async (oldPin: string, pin: string, pinConfirmation: string): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.put<ApiResponse<Profile>>('/pin/change', {
      old_pin: oldPin,
      pin,
      pin_confirmation: pinConfirmation,
    });
    return response.data;
  },

  forgotPin: async (payload: {
    phone_number: string;
    otp: string;
    pin: string;
    pin_confirmation: string;
  }): Promise<ApiResponse<Profile>> => {
    const response = await apiClient.post<ApiResponse<Profile>>('/pin/forgot', payload);
    return response.data;
  },

  revokeSession: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/profile/sessions/${id}`);
    return response.data;
  },

  revokeOtherSessions: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>('/profile/sessions');
    return response.data;
  },
};
