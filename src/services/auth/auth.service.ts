import { apiClient } from '../api';
import { User, ApiResponse } from '../../types';

export interface LoginPayload {
  identity: string; // Email or Phone
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface ForgotPasswordPayload {
  identity: string;
}

export interface RequestOtpPayload {
  phone_number: string;
  action: 'registration' | 'pin_reset' | 'password_reset' | 'verification';
}

export interface RequestOtpResponse {
  phone_number: string;
  action: string;
  dummy_sent_code?: string;
  expires_at: string;
}

export interface ResetPasswordPayload {
  phone_number: string;
  otp_code: string;
  password: string;
  password_confirmation: string;
}

export interface VerifyOtpPayload {
  phone_number: string;
  code: string;
  action: 'registration' | 'pin_reset' | 'password_reset' | 'verification';
}

export const authService = {
  // Authentication Specific Methods
  login: async (
    payload: LoginPayload
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post<
      ApiResponse<{ token: string; user: User }>
    >('/auth/login', {
      phone_or_email: payload.identity,
      password: payload.password,
    });

    return response.data;
  },

  register: async (payload: RegisterPayload): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.post<ApiResponse<{ user: User }>>('/auth/register', {
      name: payload.fullName,
      email: payload.email,
      phone_number: payload.phone,
      password: payload.password,
      password_confirmation: payload.passwordConfirmation,
    });
    return response.data;
  },

  requestOtp: async (payload: RequestOtpPayload): Promise<ApiResponse<RequestOtpResponse>> => {
    const response = await apiClient.post<ApiResponse<RequestOtpResponse>>('/auth/otp/request', payload);
    return response.data;
  },

  verifyOtp: async (payload: VerifyOtpPayload): Promise<ApiResponse<{ verified: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ verified: boolean }>>('/auth/otp/verify', payload);
    return response.data;
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/password/reset', payload);
    return response.data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/password/reset', payload);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  me: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  // Mandatory Sprint 6 CRUD Methods (Admin User Management)
  getAll: async (): Promise<ApiResponse<User[]>> => {
    const response = await apiClient.get<ApiResponse<User[]>>('/users');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data;
  },

  getUserById: async (id: string): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data;
  },

  create: async (data: Partial<User>): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<User>): Promise<ApiResponse<User>> => {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/users/${id}`);
    return response.data;
  },
};
