import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storageService } from '../services/storage.service';
import { appEvents, AUTH_UNAUTHORIZED_EVENT } from '../utils/eventEmitter';
import { isCredentialAuthRequest } from '../utils/authSession.helpers';
import { getDeviceModel, getOsVersion } from '../utils/deviceInfo';

/** Suppress AUTH_UNAUTHORIZED_EVENT while cold-start hydrate validates /auth/me. */
let unauthorizedEmitSuppressCount = 0;

export function beginSuppressUnauthorizedEmit(): void {
  unauthorizedEmitSuppressCount += 1;
}

export function endSuppressUnauthorizedEmit(): void {
  unauthorizedEmitSuppressCount = Math.max(0, unauthorizedEmitSuppressCount - 1);
}

/**
 * Same base-URL / v1-prefix handling as src/services/api.ts on web. Set
 * EXPO_PUBLIC_API_BASE_URL in .env (e.g. http://10.0.2.2:9000/api/v1 for the Android
 * emulator talking to a host-machine Laravel dev server, or the real API origin for
 * a device on the same network / production).
 */
export const API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

if (!API_BASE_URL) {
  // Fail loud in dev rather than silently hitting a blank base URL — every request
  // would 404 in a confusing way otherwise.
  console.warn('[api] EXPO_PUBLIC_API_BASE_URL is not set — every API call will fail.');
}

export interface StandardApiError {
  status: number | string;
  message: string;
  errors?: Record<string, string[]>;
  code?: string | number;
  provider?: string;
  providerCode?: string;
  retryable?: boolean;
  data?: unknown;
}

/**
 * Never surface a raw Laravel/provider error to the counter-staff user (spec section
 * 24) — always resolve to a short, actionable Indonesian message. Mirrors
 * src/services/api.ts::parseApiError exactly, including the field-error extraction
 * order, so mobile and web show the identical message for the identical failure.
 */
function sanitizeCustomerFacingErrorMessage(message: string): string {
  const raw = String(message || '').trim();
  if (!raw) return 'Terjadi kesalahan. Silakan coba kembali.';

  const lower = raw.toLowerCase();
  if (
    lower.includes('idempotency key reused') ||
    lower.includes('different request payload') ||
    lower.includes('already in progress')
  ) {
    return 'Transaksi sebelumnya masih diproses, mohon tunggu sebentar sebelum mencoba lagi.';
  }
  if (lower.includes('idempotency key') && lower.includes('tidak valid')) {
    return raw; // already Indonesian from API
  }
  if (/sqlstate|integrity constraint|stack trace|exception\b|errorexception/i.test(raw)) {
    return 'Terjadi kesalahan. Silakan coba kembali.';
  }
  return raw;
}

export function parseApiError(error: any): StandardApiError {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error && !axios.isAxiosError(error)) {
    const existing = error as StandardApiError;
    return {
      ...existing,
      message: sanitizeCustomerFacingErrorMessage(String(existing.message || '')),
    };
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 'unknown';
    const data = error.response?.data as any;

    let errorMessage = data?.message;

    if (data?.errors && typeof data.errors === 'object' && Object.keys(data.errors).length > 0) {
      const firstKey = Object.keys(data.errors)[0];
      const firstError = data.errors[firstKey];
      if (Array.isArray(firstError) && firstError.length > 0) {
        errorMessage = firstError[0];
      }
    }

    if (!errorMessage) {
      if (status === 401) {
        errorMessage = 'Email atau password salah.';
      } else if (status === 403) {
        errorMessage = 'Akses ditolak.';
      } else if (status === 419) {
        errorMessage = 'Sesi telah berakhir.';
      } else if (status === 422) {
        errorMessage = 'Data yang dikirim tidak valid.';
      } else if (error.code === 'ECONNABORTED' || /timeout/i.test(String(error.message || ''))) {
        errorMessage = 'Request timeout. Proses provider masih berjalan atau jaringan lambat — coba lagi tanpa reload.';
      } else if (error.code === 'ERR_NETWORK' || /network error/i.test(String(error.message || ''))) {
        errorMessage = 'Tidak ada koneksi internet. Periksa jaringan Anda.';
      } else if (typeof status === 'number' && status >= 500) {
        errorMessage = 'Server sedang bermasalah.';
      } else {
        errorMessage = 'Terjadi kesalahan. Silakan coba kembali.';
      }
    }

    return {
      status,
      message: sanitizeCustomerFacingErrorMessage(String(errorMessage)),
      errors: data?.errors || {},
      code: data?.code ?? data?.provider_code,
      provider: data?.provider,
      providerCode: data?.provider_code,
      retryable: data?.retryable,
      data: data?.data,
    };
  }

  return {
    status: 'unknown',
    message: sanitizeCustomerFacingErrorMessage(
      error instanceof Error ? error.message : 'Terjadi kesalahan tidak terduga.'
    ),
  };
}

/** True only for "the request never reached the server" — never for a timeout. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code === 'ERR_NETWORK';
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await storageService.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.headers) {
    config.headers['X-Device-UUID'] = await storageService.getDeviceUuid();
    config.headers['X-Platform'] = Platform.OS; // 'android' | 'ios' — never 'web' here
    config.headers['X-App-Version'] = Constants.expoConfig?.version ?? 'unknown';
    config.headers['X-Device-Model'] = getDeviceModel();
    config.headers['X-Os-Version'] = getOsVersion();
  }

  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const parsed = parseApiError(error);
    const requestUrl = error.config?.url ?? error.config?.baseURL;

    // Credential login/PIN/2FA 401 = wrong password etc. — do not wipe returning identity.
    // Authenticated session 401 = definitive invalid → full identity clear → Login.
    if (parsed.status === 401 && !isCredentialAuthRequest(requestUrl)) {
      await storageService.clearAuthIdentity();
      if (unauthorizedEmitSuppressCount === 0) {
        appEvents.emit(AUTH_UNAUTHORIZED_EVENT);
      }
    }

    return Promise.reject(parsed);
  }
);
