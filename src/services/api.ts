import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { storageService } from './storage.service';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'https://gurkynet.my.id/api/v1';

export type AuthMode = 'sanctum_cookie' | 'sanctum_token';

export const apiConfig = {
  authMode: 'sanctum_token' as AuthMode,
  csrfCookieEndpoint: '/sanctum/csrf-cookie',
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
  withCredentials: true,
});

export async function ensureCsrfCookie(): Promise<void> {
  if (apiConfig.authMode === 'sanctum_cookie') {
    try {
      await axios.get(`${API_BASE_URL.split('/api')[0]}/sanctum/csrf-cookie`, {
        withCredentials: true,
      });
    } catch (err) {
      throw err;
    }
  }
}

export interface StandardApiError {
  status: number | string;
  message: string;
  errors?: Record<string, string[]>;
  code?: string | number;
}

export function parseApiError(error: any): StandardApiError {
  if (error && typeof error === 'object' && 'status' in error && 'message' in error && !axios.isAxiosError(error)) {
    return error as StandardApiError;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 'unknown';
    const data = error.response?.data;

    let errorMessage = data?.message;

    // Kalau Laravel mengirim validation errors,
    // ambil pesan pertama.
    if (
      data?.errors &&
      typeof data.errors === 'object' &&
      Object.keys(data.errors).length > 0
    ) {
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
      } else if (typeof status === 'number' && status >= 500) {
        errorMessage = 'Server sedang bermasalah.';
      } else {
        errorMessage = error.message || 'Terjadi kesalahan.';
      }
    }

    // <<< INI YANG HILANG
    return {
      status,
      message: errorMessage,
      errors: data?.errors || {},
    };
  }

  if (!navigator.onLine) {
    return {
      status: 'offline',
      message: 'Koneksi internet terputus. Silakan periksa jaringan Anda.',
    };
  }

  return {
    status: 'unknown',
    message:
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan tidak terduga.',
  };
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (
      apiConfig.authMode === 'sanctum_cookie' &&
      config.method &&
      ['post', 'put', 'delete', 'patch'].includes(
        config.method.toLowerCase()
      )
    ) {
      await ensureCsrfCookie();
    }

    if (apiConfig.authMode === 'sanctum_token') {
      const token = storageService.getToken();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const parsed = parseApiError(error);

    if (parsed.status === 401) {
      storageService.clear();
      window.dispatchEvent(new Event('auth-unauthorized'));
    }

    return Promise.reject(parsed);
  }
);
