import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { storageService } from './storage.service';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'https://api.gurkynet.my.id/api/v1';

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
  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    return error as StandardApiError;
  }
  
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 'unknown';
    const data = error.response?.data;
    const errorMessage = data?.message || error.message || 'Terjadi kesalahan pada server';
    
    // Always prioritize the backend message exactly as returned for all codes
    // 400, 401, 403, 404, 409, 422, 500, etc.
    return { status, message: errorMessage, errors: data?.errors || {} };
  }

  if (!navigator.onLine) {
    return { status: 'offline', message: 'Offline.' };
  }
  return { status: 'unknown', message: error instanceof Error ? error.message : 'Unknown error.' };
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (apiConfig.authMode === 'sanctum_cookie' && config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
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
    if (error.response) {
      const parsed = parseApiError(error);
      if (parsed.status === 401) {
        storageService.clear();
        window.dispatchEvent(new Event('auth-unauthorized'));
        return Promise.reject(parsed);
      }
      return Promise.reject(parsed);
    }
    return Promise.reject(parseApiError(error));
  }
);
