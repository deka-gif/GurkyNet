import { apiClient } from '../api';
import { Transaction, ApiResponse } from '../../types';

export const transactionService = {
  getAll: async (): Promise<ApiResponse<Transaction[]>> => {
    const response = await apiClient.get<ApiResponse<Transaction[]>>('/transactions');
    return response.data;
  },

  getTransactions: async (): Promise<ApiResponse<Transaction[]>> => {
    const response = await apiClient.get<ApiResponse<Transaction[]>>('/transactions');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.get<ApiResponse<Transaction>>(`/transactions/${id}`);
    return response.data;
  },

  create: async (data: any): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data;
  },

  createTransaction: async (data: any): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Transaction>): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
    return response.data;
  },

  updateTransaction: async (id: string, data: Partial<Transaction>): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
    return response.data;
  },

  getReceipt: async (id: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/transactions/${id}/receipt`);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/transactions/${id}`);
    return response.data;
  },
};

