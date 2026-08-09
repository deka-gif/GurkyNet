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

  topUp: async (amount: number, paymentMethod: string, idempotencyKey?: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/wallet/topup', {
      amount,
      paymentMethod,
      idempotency_key: idempotencyKey,
    });
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

  getHistory: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>('/wallet/history', { params });
    return response.data;
  },
};
