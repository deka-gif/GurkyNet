import { apiClient, API_BASE_URL } from '../api/client';
import { ApiResponse, User } from '../api/types';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export interface LoginPayload {
  identity: string;
  password: string;
}

export interface LoginResponseData {
  token?: string;
  user?: unknown;
  requires_2fa?: boolean;
  identifier?: string;
  expires_at?: string;
  resend_available_at?: string;
  dummy_sent_code?: string;
}

export type RegisterPayload = {
  name: string;
  email: string;
  phone_number: string;
  password: string;
  password_confirmation: string;
  referral_code?: string;
};

export type RegisterResponseData = {
  onboarding_id: number;
  email: string;
  status: string;
  expires_at?: string | null;
  resend_available_at?: string | null;
  user?: { name?: string; email?: string; phone?: string };
};

export type OtpVerifyResponse = {
  onboarding_id?: number;
  verified?: boolean;
  status?: string;
  next_step?: string;
};

/**
 * Auth API — mirrors Web auth.service contracts.
 * No fake OTP / Google / PIN.
 */
export const authService = {
  login: async (payload: LoginPayload): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', {
      phone_or_email: payload.identity,
      password: payload.password,
    });
    return response.data;
  },

  pinLogin: async (payload: {
    identity: string;
    pin: string;
  }): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login/pin', {
      identity: payload.identity,
      pin: payload.pin,
    });
    return response.data;
  },

  verifyLogin2fa: async (payload: {
    identity: string;
    code: string;
  }): Promise<ApiResponse<LoginResponseData>> => {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>(
      '/auth/login/2fa/verify',
      payload
    );
    return response.data;
  },

  register: async (payload: RegisterPayload): Promise<ApiResponse<RegisterResponseData>> => {
    const response = await apiClient.post<ApiResponse<RegisterResponseData>>(
      '/auth/register',
      payload
    );
    return response.data;
  },

  verifyOnboardingOtp: async (payload: {
    onboarding_id: number;
    code: string;
  }): Promise<ApiResponse<OtpVerifyResponse>> => {
    const response = await apiClient.post<ApiResponse<OtpVerifyResponse>>('/auth/otp/verify', {
      onboarding_id: payload.onboarding_id,
      code: payload.code,
    });
    return response.data;
  },

  resendOnboardingOtp: async (payload: {
    email: string;
    action?: string;
  }): Promise<ApiResponse<{ expires_at?: string; resend_available_at?: string }>> => {
    const response = await apiClient.post<
      ApiResponse<{ expires_at?: string; resend_available_at?: string }>
    >('/auth/otp/request', {
      email: payload.email,
      action: payload.action || 'onboarding_registration',
    });
    return response.data;
  },

  finalizeRegistration: async (payload: {
    onboarding_id: number;
    pin: string;
    pin_confirmation: string;
    accept_policies?: boolean;
    remember_device?: boolean;
  }): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; user: User }>>(
      '/auth/register/finalize',
      {
        onboarding_id: payload.onboarding_id,
        pin: payload.pin,
        pin_confirmation: payload.pin_confirmation,
        accept_policies: payload.accept_policies ?? true,
        remember_device: payload.remember_device ?? true,
      }
    );
    return response.data;
  },

  requestForgotPassword: async (
    email: string
  ): Promise<ApiResponse<{ expires_at?: string; resend_available_at?: string }>> => {
    const response = await apiClient.post<
      ApiResponse<{ expires_at?: string; resend_available_at?: string }>
    >('/auth/password/forgot/request', { email });
    return response.data;
  },

  confirmForgotPassword: async (payload: {
    email: string;
    otp_code: string;
    new_password: string;
    new_password_confirmation: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/auth/password/forgot/confirm',
      payload
    );
    return response.data;
  },

  completeGoogleRegistration: async (payload: {
    google_token: string;
    phone_number: string;
    pin: string;
    pin_confirmation: string;
    accept_policies?: boolean;
    referral_code?: string;
  }): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string; user: User }>>(
      '/auth/google/complete',
      {
        google_token: payload.google_token,
        phone_number: payload.phone_number,
        pin: payload.pin,
        pin_confirmation: payload.pin_confirmation,
        accept_policies: payload.accept_policies ?? true,
        referral_code: payload.referral_code,
      }
    );
    return response.data;
  },

  /**
   * Opens system browser OAuth against existing backend redirect.
   * Returns token (existing user) or google_token (needs complete) or error.
   */
  startGoogleOAuth: async (): Promise<
    | { type: 'token'; token: string }
    | { type: 'google_token'; googleToken: string }
    | { type: 'cancelled' }
    | { type: 'error'; message: string }
  > => {
    if (!API_BASE_URL) {
      return { type: 'error', message: 'API belum dikonfigurasi.' };
    }

    const redirectUri = Linking.createURL('auth/google');
    const authUrl =
      `${API_BASE_URL}/auth/google/redirect` +
      `?client=mobile&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { type: 'cancelled' };
    }
    if (result.type !== 'success' || !('url' in result) || !result.url) {
      return { type: 'error', message: 'Login Google gagal.' };
    }

    const parsed = Linking.parse(result.url);
    const q = parsed.queryParams || {};
    const err = typeof q.google_error === 'string' ? q.google_error : null;
    if (err) return { type: 'error', message: err };

    const token = typeof q.token === 'string' ? q.token : null;
    if (token) return { type: 'token', token };

    const googleToken = typeof q.google_token === 'string' ? q.google_token : null;
    if (googleToken) return { type: 'google_token', googleToken };

    return { type: 'error', message: 'Respons Google tidak dikenali.' };
  },

  logout: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  me: async (): Promise<ApiResponse<{ user: User } | User>> => {
    const response = await apiClient.get<ApiResponse<{ user: User } | User>>('/auth/me');
    return response.data;
  },

  session: async (): Promise<ApiResponse<{ valid?: boolean }>> => {
    const response = await apiClient.get<ApiResponse<{ valid?: boolean }>>('/auth/session');
    return response.data;
  },
};
