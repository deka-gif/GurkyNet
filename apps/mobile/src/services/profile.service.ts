import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/** Customer-facing subset of GET /profile/security (SecurityAction / ProfileRepository). */
export type SecuritySessionToken = {
  id: number;
  name: string | null;
  token_name?: string | null;
  device_model?: string | null;
  platform?: string | null;
  device_uuid?: string | null;
  is_current?: boolean;
  last_used_at: string | null;
  created_at: string | null;
};

export type SecurityRegisteredDevice = {
  device_uuid?: string | null;
  device_model?: string | null;
  platform?: string | null;
  display_name?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  last_login_at?: string | null;
  is_current?: boolean;
};

export type SecurityOverview = {
  has_pin: boolean;
  pin_updated_at: string | null;
  last_login: {
    ip_address: string | null;
    user_agent: string | null;
    display_name?: string | null;
    logged_at: string | null;
  } | null;
  active_tokens: SecuritySessionToken[];
  registered_devices?: SecurityRegisteredDevice[];
  two_factor_status?: boolean;
};

export type OtpChallengeMeta = {
  expires_at?: string | null;
  resend_available_at?: string | null;
  max_attempts?: number;
};

/**
 * Profile / PIN / security / identity change — mirrors Web profile.service
 * + AccountSecurityController contracts. Never logs PIN, password, or OTP.
 */
export const profileService = {
  getProfile: async (): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.get<ApiResponse<unknown>>('/profile');
    return response.data;
  },

  updateProfile: async (data: {
    name?: string;
    phone_number?: string;
    birth_date?: string;
    gender?: string;
    address?: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.put<ApiResponse<unknown>>('/profile', data);
    return response.data;
  },

  /**
   * POST /profile/avatar — multipart field `avatar`.
   * RN FormData: { uri, name, type }.
   */
  uploadAvatar: async (file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<ApiResponse<unknown>> => {
    const form = new FormData();
    form.append('avatar', file as unknown as Blob);
    const response = await apiClient.post<ApiResponse<unknown>>('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getSecurity: async (): Promise<ApiResponse<SecurityOverview>> => {
    const response = await apiClient.get<ApiResponse<SecurityOverview>>('/profile/security');
    return response.data;
  },

  createPin: async (pin: string, pinConfirmation: string): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>('/pin/create', {
      pin,
      pin_confirmation: pinConfirmation,
    });
    return response.data;
  },

  /**
   * Mobile Ubah PIN — old-PIN-only, no OTP.
   * PUT /pin/change { old_pin, pin, pin_confirmation }
   * (AccountController::changePin / ChangePinAction)
   *
   * Web OTP path remains: requestPinChange / confirmPinChange.
   */
  changePin: async (
    oldPin: string,
    pin: string,
    pinConfirmation: string
  ): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.put<ApiResponse<unknown>>('/pin/change', {
      old_pin: oldPin,
      pin,
      pin_confirmation: pinConfirmation,
    });
    return response.data;
  },

  /**
   * Web OTP change-PIN step 1 (not used by Mobile Ubah PIN).
   * POST /account-security/pin/change/request { old_pin }
   */
  requestPinChange: async (oldPin: string): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/account-security/pin/change/request',
      { old_pin: oldPin }
    );
    return response.data;
  },

  /**
   * Web OTP change-PIN step 2 (not used by Mobile Ubah PIN).
   * POST /account-security/pin/change/confirm { otp_code, pin, pin_confirmation }
   */
  confirmPinChange: async (
    otpCode: string,
    pin: string,
    pinConfirmation: string
  ): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/account-security/pin/change/confirm',
      {
        otp_code: otpCode,
        pin,
        pin_confirmation: pinConfirmation,
      }
    );
    return response.data;
  },

  /**
   * POST /devices/register — upsert device_model for session display.
   * Call after login; no sensitive permissions required.
   */
  registerDevice: async (payload: {
    device_uuid: string;
    platform: 'android' | 'ios' | 'web' | 'pwa';
    device_model?: string;
    os_version?: string;
    app_version?: string;
    push_token?: string;
    push_provider?: 'fcm' | 'apns' | 'webpush' | 'expo';
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>('/devices/register', payload);
    return response.data;
  },

  requestForgotPin: async (email: string): Promise<ApiResponse<OtpChallengeMeta>> => {
    const response = await apiClient.post<ApiResponse<OtpChallengeMeta>>(
      '/auth/pin/forgot/request',
      { email }
    );
    return response.data;
  },

  /**
   * Gate OTP before PIN entry — backend assertValid (does not consume OTP).
   * POST /auth/pin/forgot/verify-otp { email, otp_code }
   */
  verifyForgotPinOtp: async (payload: {
    email: string;
    otp_code: string;
  }): Promise<ApiResponse<{ verified?: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ verified?: boolean }>>(
      '/auth/pin/forgot/verify-otp',
      payload
    );
    return response.data;
  },

  confirmForgotPin: async (payload: {
    email: string;
    otp_code: string;
    pin: string;
    pin_confirmation: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/auth/pin/forgot/confirm',
      payload
    );
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

  /**
   * Phone change — AccountSecurityController::requestPhoneChange.
   * OTP is sent to the user's CURRENT EMAIL (channel=email), not WhatsApp to new phone.
   */
  requestPhoneChange: async (payload: {
    password: string;
    pin: string;
    new_phone: string;
  }): Promise<ApiResponse<OtpChallengeMeta>> => {
    const response = await apiClient.post<ApiResponse<OtpChallengeMeta>>(
      '/account-security/phone/change/request',
      payload
    );
    return response.data;
  },

  confirmPhoneChange: async (payload: {
    otp_code: string;
    new_phone: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/account-security/phone/change/confirm',
      payload
    );
    return response.data;
  },

  /**
   * Email change step 1 — OTP to CURRENT email.
   * Requires password + transaction PIN.
   */
  requestEmailChange: async (payload: {
    password: string;
    pin: string;
    new_email: string;
  }): Promise<ApiResponse<OtpChallengeMeta>> => {
    const response = await apiClient.post<ApiResponse<OtpChallengeMeta>>(
      '/account-security/email/change/request',
      payload
    );
    return response.data;
  },

  /** Email change step 2 — verify old-email OTP, then OTP issued to NEW email. */
  verifyEmailChangeOld: async (payload: {
    otp_code: string;
    new_email: string;
  }): Promise<ApiResponse<OtpChallengeMeta>> => {
    const response = await apiClient.post<ApiResponse<OtpChallengeMeta>>(
      '/account-security/email/change/verify-old',
      payload
    );
    return response.data;
  },

  /** Email change step 3 — verify new-email OTP and apply change. */
  verifyEmailChangeNew: async (payload: {
    new_email: string;
    otp_code: string;
  }): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/account-security/email/change/verify-new',
      payload
    );
    return response.data;
  },
};
