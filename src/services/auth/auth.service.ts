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

export interface RegisterStartResponse {
  onboarding_id: number;
  email: string;
  status: string;
  expires_at: string;
  dummy_sent_code?: string;
}

export interface VerifyOnboardingPayload {
  onboarding_id: number;
  code: string;
}

export interface FinalizeRegistrationPayload {
  onboarding_id: number;
  pin: string;
  pin_confirmation: string;
  remember_device?: boolean;
  /** Sprint 18 — server-side policy acceptance */
  accept_policies: boolean;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface RequestOtpPayload {
  phone_number?: string;
  email?: string;
  action: 'registration' | 'pin_reset' | 'password_reset' | 'verification' | 'forgot_password' | 'forgot_pin' | 'change_password' | 'change_pin' | 'change_phone' | 'change_email_old' | 'change_email_new' | 'onboarding_registration';
}

export interface RequestOtpResponse {
  identifier?: string;
  action: string;
  dummy_sent_code?: string;
  expires_at: string;
  resend_available_at?: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp_code: string;
  new_password: string;
  new_password_confirmation: string;
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
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/auth/login', {
      phone_or_email: payload.identity,
      password: payload.password,
    });

    return response.data;
  },

  verifyLogin2fa: async (payload: {
    identity: string;
    code: string;
  }): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; user: User }>>(
      '/auth/login/2fa/verify',
      payload
    );
    return response.data;
  },

  register: async (payload: RegisterPayload): Promise<ApiResponse<RegisterStartResponse>> => {
    const response = await apiClient.post<ApiResponse<RegisterStartResponse>>('/auth/register', {
      name: payload.fullName,
      email: payload.email,
      phone_number: payload.phone,
      password: payload.password,
      password_confirmation: payload.passwordConfirmation,
    });
    return response.data;
  },

  verifyOnboardingOtp: async (payload: VerifyOnboardingPayload): Promise<ApiResponse<{ verified: boolean; onboarding_id: number; next_step: string }>> => {
    const response = await apiClient.post<ApiResponse<{ verified: boolean; onboarding_id: number; next_step: string }>>('/auth/otp/verify', {
      onboarding_id: payload.onboarding_id,
      code: payload.code,
      action: 'onboarding_registration',
    });
    return response.data;
  },

  finalizeRegistration: async (payload: FinalizeRegistrationPayload): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/register/finalize', payload);
    return response.data;
  },

  pinLogin: async (payload: { identity: string; pin: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/auth/login/pin', payload);
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
    const response = await apiClient.post<ApiResponse<null>>('/auth/password/forgot/confirm', payload);
    return response.data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/password/forgot/request', payload);
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
