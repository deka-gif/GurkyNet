import { apiClient } from '../api';
import { Wallet, WalletOverview, ApiResponse } from '../../types';

export const walletService = {
  getWallet: async (): Promise<ApiResponse<WalletOverview | Wallet>> => {
    const response = await apiClient.get<ApiResponse<WalletOverview | Wallet>>('/wallet');
    return response.data;
  },

  getAll: async (): Promise<ApiResponse<Wallet[]>> => {
    const response = await apiClient.get<ApiResponse<Wallet[]>>('/wallet');
    return response.data;
  },

  getWallets: async (): Promise<ApiResponse<Wallet[]>> => {
    const response = await apiClient.get<ApiResponse<Wallet[]>>('/wallet');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Wallet>> => {
    const response = await apiClient.get<ApiResponse<Wallet>>(`/wallet/${id}`);
    return response.data;
  },

  create: async (data: Partial<Wallet>): Promise<ApiResponse<Wallet>> => {
    const response = await apiClient.post<ApiResponse<Wallet>>('/wallet', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Wallet>): Promise<ApiResponse<Wallet>> => {
    const response = await apiClient.put<ApiResponse<Wallet>>(`/wallet/${id}`, data);
    return response.data;
  },

  updateWallet: async (id: string, data: Partial<Wallet>): Promise<ApiResponse<Wallet>> => {
    const response = await apiClient.put<ApiResponse<Wallet>>(`/wallet/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/wallet/${id}`);
    return response.data;
  },

  topUp: async (
    amount: number,
    paymentMethod: string,
    idempotencyKey?: string,
    channel?: string | null
  ): Promise<ApiResponse<any>> => {
    const body: Record<string, unknown> = {
      amount,
      payment_method: paymentMethod,
      idempotency_key: idempotencyKey,
    };
    if (channel) {
      body.channel = channel;
    }
    const response = await apiClient.post<ApiResponse<any>>('/wallet/topup', body);
    return response.data;
  },

  transfer: async (
    recipient_wallet_number: string,
    amount: number,
    pin?: string,
    idempotencyKey?: string
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/wallet/transfer', {
      recipient_wallet_number,
      amount,
      pin,
      idempotency_key: idempotencyKey,
    });
    return response.data;
  },

  withdraw: async (payload: {
    amount: number;
    pin: string;
    bank_name: string;
    account_number: string;
    admin_fee?: number;
    idempotency_key?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/wallet/withdraw', payload);
    return response.data;
  },

  /** FR-FIN-03 — manual bank transfer deposit with proof. */
  depositManual: async (form: FormData): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/wallet/deposit-manual', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getHistory: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>('/wallet/history', { params });
    return response.data;
  },

  /** Sprint 11 — public Midtrans Snap bootstrap (no server_key). */
  getPaymentConfig: async (): Promise<ApiResponse<{
    client_key: string;
    is_production: boolean;
    snap_js_url: string;
    configured: boolean;
    min_amount?: number;
    quick_amounts?: number[];
    methods?: Array<{
      id: string;
      label: string;
      enabled: boolean;
      banks?: Array<{ code: string; label: string; enabled: boolean }>;
      outlets?: Array<{ code: string; label: string; enabled: boolean }>;
    }>;
  }>> => {
    const response = await apiClient.get('/wallet/payment-config');
    return response.data;
  },
};
