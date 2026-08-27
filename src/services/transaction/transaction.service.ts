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

  /** Sprint 8 / FR-USR04 — download owned transaction PDF receipt. */
  downloadReceiptPdf: async (id: string): Promise<void> => {
    const response = await apiClient.get(`/transactions/${id}/receipt.pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `struk-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/transactions/${id}`);
    return response.data;
  },
};

