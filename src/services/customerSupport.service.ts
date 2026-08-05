import { apiClient } from './api';
import { ApiResponse } from '../types';

export const customerSupportService = {
  async getDashboard() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/dashboard');
    return res.data;
  },

  async getStats() {
    try {
      const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/stats');
      return res.data;
    } catch {
      const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/dashboard');
      return res.data;
    }
  },

  async getTickets(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/tickets', { params });
    return res.data;
  },

  async getTicketById(id: string | number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/customer-support/tickets/${id}`);
    return res.data;
  },

  async createTicket(data: Record<string, any>) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/customer-support/tickets', data);
    return res.data;
  },

  async updateTicket(id: string | number, data: Record<string, any>) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/customer-support/tickets/${id}`, data);
    return res.data;
  },

  async replyTicket(id: string | number, message: string | Record<string, any>) {
    const payload = typeof message === 'string' ? { message } : message;
    const res = await apiClient.post<ApiResponse<any>>(`/admin/customer-support/tickets/${id}/reply`, payload);
    return res.data;
  },

  async getCustomers(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/customers', { params });
    return res.data;
  },

  async getCustomerById(id: string | number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/customer-support/customers/${id}`);
    return res.data;
  },

  async getCustomerTransactions(id: string | number, params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/customer-support/customers/${id}/transactions`, { params });
    return res.data;
  },

  async getRefunds(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/refunds', { params });
    return res.data;
  },

  async getRefundById(id: string | number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/customer-support/refunds/${id}`);
    return res.data;
  },

  async createRefund(data: Record<string, any>) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/customer-support/refunds', data);
    return res.data;
  },

  async updateRefund(id: string | number, data: Record<string, any>) {
    const res = await apiClient.put<ApiResponse<any>>(`/admin/customer-support/refunds/${id}`, data);
    return res.data;
  },

  async escalateRefund(id: string | number, data: Record<string, any>) {
    try {
      const res = await apiClient.post<ApiResponse<any>>(`/admin/customer-support/refunds/${id}/escalate`, data);
      return res.data;
    } catch {
      const res = await apiClient.put<ApiResponse<any>>(`/admin/customer-support/refunds/${id}`, data);
      return res.data;
    }
  },

  async getKnowledgeBase(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/knowledge-base', { params });
    return res.data;
  },

  async getKnowledgeBaseArticle(id: string | number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/customer-support/knowledge-base/${id}`);
    return res.data;
  },

  async investigateTransaction(query: string) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/customer-support/investigation', {
      params: { query, q: query, search: query, invoiceNumber: query, transactionId: query }
    });
    return res.data;
  }
};
