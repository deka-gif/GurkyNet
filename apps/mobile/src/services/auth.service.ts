import { apiClient } from '../api/client';
import { ApiResponse, User } from '../api/types';

export interface LoginPayload {
  identity: string; // email or phone — server normalizes to phone_or_email
  password: string;
}

/** Raw shape of POST /auth/login's `data` — either a token+user pair or a 2FA challenge. */
export interface LoginResponseData {
  token?: string;
  user?: unknown;
  requires_2fa?: boolean;
  identifier?: string;
  expires_at?: string;
  resend_available_at?: string;
  dummy_sent_code?: string;
}

export const authService = {
  login: async (payload: LoginPayload): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', {
      phone_or_email: payload.identity,
      password: payload.password,
    });
    return response.data;
  },

  verifyLogin2fa: async (payload: { identity: string; code: string }): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login/2fa/verify', payload);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  me: async (): Promise<ApiResponse<{ user: User } | User>> => {
    const response = await apiClient.get<ApiResponse<{ user: User } | User>>('/auth/me');
    return response.data;
  },
};
