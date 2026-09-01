import { create } from 'zustand';
import { customerSupportService } from '../services/customerSupport.service';
import { Pagination } from '../types';

export type KBArticle = any;
export type RefundItem = any;
export type InvestigationData = any;

function extractListAndPagination(response: any): { items: any[]; pagination: Pagination | null } {
  if (!response) return { items: [], pagination: null };

  const payload = response.data !== undefined ? response.data : response;
  let items: any[] = [];
  let pagination: Pagination | null = response.pagination || null;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.data)) {
    items = payload.data;
    if (!pagination && (payload.current_page !== undefined || payload.currentPage !== undefined)) {
      pagination = {
        currentPage: payload.current_page ?? payload.currentPage ?? 1,
        lastPage: payload.last_page ?? payload.lastPage ?? 1,
        perPage: payload.per_page ?? payload.perPage ?? 10,
        total: payload.total ?? items.length,
      };
    }
  } else if (payload && typeof payload === 'object') {
    const listKey = Object.keys(payload).find((k) => Array.isArray(payload[k]));
    if (listKey) {
      items = payload[listKey];
    }
    if (!pagination && payload.pagination) {
      pagination = payload.pagination;
    }
  }

  return { items, pagination };
}

export interface CustomerSupportState {
  // Dashboard
  dashboardData: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  // Tickets
  tickets: any[];
  selectedTicket: any | null;
  ticketsPagination: Pagination | null;
  ticketsLoading: boolean;
  ticketsError: string | null;

  // Customers
  customers: any[];
  selectedCustomer: any | null;
  customerTransactions: any[];
  customersPagination: Pagination | null;
  customersLoading: boolean;
  customersError: string | null;

  // Refunds
  refunds: any[];
  selectedRefund: any | null;
  refundsPagination: Pagination | null;
  refundsLoading: boolean;
  refundsError: string | null;

  // Knowledge Base
  kbArticles: any[];
  selectedArticle: any | null;
  kbPagination: Pagination | null;
  kbLoading: boolean;
  kbArticlesLoading: boolean;
  kbError: string | null;

  // Investigation
  investigationData: any | null;
  investigationResult: any | null;
  investigationLoading: boolean;
  investigationError: string | null;

  // Actions
  fetchDashboard: () => Promise<void>;

  fetchTickets: (params?: Record<string, any>) => Promise<void>;
  fetchTicketById: (id: string | number) => Promise<any>;
  createTicket: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any; data?: any }>;
  updateTicket: (id: string | number, data: { status: string; assigned_to?: number | null }) => Promise<{ success: boolean; message?: string; errors?: any }>;
  replyTicket: (id: string | number, message: string | Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;

  fetchCustomers: (params?: Record<string, any>) => Promise<void>;
  fetchCustomerById: (id: string | number) => Promise<any>;
  fetchCustomerTransactions: (id: string | number, params?: Record<string, any>) => Promise<void>;

  fetchRefunds: (params?: Record<string, any>) => Promise<void>;
  fetchRefundById: (id: string | number) => Promise<any>;
  createRefund: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any; data?: any }>;
  updateRefund: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  updateRefundStatus: (id: string | number, status: string, note?: string) => Promise<{ success: boolean; message?: string; errors?: any }>;
  escalateRefund: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;

  fetchKnowledgeBase: (params?: Record<string, any>) => Promise<void>;
  fetchKbArticles: (params?: Record<string, any>) => Promise<void>;
  fetchKnowledgeBaseArticle: (id: string | number) => Promise<any>;

  investigateTransaction: (query: string) => Promise<void>;
}

export const useCustomerSupportStore = create<CustomerSupportState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  tickets: [],
  selectedTicket: null,
  ticketsPagination: null,
  ticketsLoading: false,
  ticketsError: null,

  customers: [],
  selectedCustomer: null,
  customerTransactions: [],
  customersPagination: null,
  customersLoading: false,
  customersError: null,

  refunds: [],
  selectedRefund: null,
  refundsPagination: null,
  refundsLoading: false,
  refundsError: null,

  kbArticles: [],
  selectedArticle: null,
  kbPagination: null,
  kbLoading: false,
  get kbArticlesLoading() { return this.kbLoading; },
  kbError: null,

  investigationData: null,
  get investigationResult() { return this.investigationData; },
  investigationLoading: false,
  investigationError: null,

  // Dashboard
  fetchDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await customerSupportService.getDashboard();
      if (response && response.success !== false) {
        set({ dashboardData: response.data !== undefined ? response.data : response, dashboardLoading: false });
      } else {
        set({ dashboardError: response?.message || 'Gagal memuat dashboard customer support.', dashboardLoading: false });
      }
    } catch (err: any) {
      set({
        dashboardError: err?.message || 'Terjadi kesalahan saat memuat dashboard customer support.',
        dashboardLoading: false,
      });
    }
  },

  // Tickets
  fetchTickets: async (params) => {
    set({ ticketsLoading: true, ticketsError: null });
    try {
      const response = await customerSupportService.getTickets(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ tickets: items, ticketsPagination: pagination, ticketsLoading: false });
      } else {
        set({ ticketsError: response?.message || 'Gagal memuat daftar tiket.', ticketsLoading: false });
      }
    } catch (err: any) {
      set({ ticketsError: err?.message || 'Terjadi kesalahan saat memuat daftar tiket.', ticketsLoading: false });
    }
  },

  fetchTicketById: async (id) => {
    set({ ticketsLoading: true, ticketsError: null });
    try {
      const response = await customerSupportService.getTicketById(id);
      set({ ticketsLoading: false });
      if (response && response.success !== false) {
        const detail = response.data !== undefined ? response.data : response;
        set({ selectedTicket: detail });
        return detail;
      }
      set({ ticketsError: response?.message || 'Gagal memuat detail tiket.' });
      return null;
    } catch (err: any) {
      set({ ticketsError: err?.message || 'Terjadi kesalahan saat memuat detail tiket.', ticketsLoading: false });
      return null;
    }
  },

  createTicket: async (data) => {
    set({ ticketsLoading: true, ticketsError: null });
    try {
      const response = await customerSupportService.createTicket(data);
      set({ ticketsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Tiket berhasil dibuat.', data: response.data };
      }
      return { success: false, message: response?.message || 'Gagal membuat tiket.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat tiket.';
      set({ ticketsError: msg, ticketsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateTicket: async (id, data) => {
    set({ ticketsLoading: true, ticketsError: null });
    try {
      const response = await customerSupportService.updateTicket(id, data);
      set({ ticketsLoading: false });
      if (response && response.success !== false) {
        // Optionally refresh selected ticket if matches
        if (get().selectedTicket && (get().selectedTicket.id === id || get().selectedTicket.ticketId === id)) {
          set({ selectedTicket: { ...get().selectedTicket, ...data } });
        }
        return { success: true, message: response.message || 'Tiket berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui tiket.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui tiket.';
      set({ ticketsError: msg, ticketsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  replyTicket: async (id, message) => {
    set({ ticketsLoading: true, ticketsError: null });
    try {
      const response = await customerSupportService.replyTicket(id, message);
      set({ ticketsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Balasan tiket berhasil dikirim.' };
      }
      return { success: false, message: response?.message || 'Gagal mengirim balasan tiket.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengirim balasan tiket.';
      set({ ticketsError: msg, ticketsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  // Customers
  fetchCustomers: async (params) => {
    set({ customersLoading: true, customersError: null });
    try {
      const response = await customerSupportService.getCustomers(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ customers: items, customersPagination: pagination, customersLoading: false });
      } else {
        set({ customersError: response?.message || 'Gagal memuat data pelanggan.', customersLoading: false });
      }
    } catch (err: any) {
      set({ customersError: err?.message || 'Terjadi kesalahan saat memuat data pelanggan.', customersLoading: false });
    }
  },

  fetchCustomerById: async (id) => {
    set({ customersLoading: true, customersError: null });
    try {
      const response = await customerSupportService.getCustomerById(id);
      set({ customersLoading: false });
      if (response && response.success !== false) {
        const detail = response.data !== undefined ? response.data : response;
        set({ selectedCustomer: detail });
        return detail;
      }
      set({ customersError: response?.message || 'Gagal memuat profil pelanggan.' });
      return null;
    } catch (err: any) {
      set({ customersError: err?.message || 'Terjadi kesalahan saat memuat profil pelanggan.', customersLoading: false });
      return null;
    }
  },

  fetchCustomerTransactions: async (id, params) => {
    set({ customersLoading: true, customersError: null });
    try {
      const response = await customerSupportService.getCustomerTransactions(id, params);
      if (response && response.success !== false) {
        const { items } = extractListAndPagination(response);
        set({ customerTransactions: items, customersLoading: false });
      } else {
        set({ customersError: response?.message || 'Gagal memuat riwayat transaksi pelanggan.', customersLoading: false });
      }
    } catch (err: any) {
      set({ customersError: err?.message || 'Terjadi kesalahan saat memuat transaksi pelanggan.', customersLoading: false });
    }
  },

  // Refunds
  fetchRefunds: async (params) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const response = await customerSupportService.getRefunds(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ refunds: items, refundsPagination: pagination, refundsLoading: false });
      } else {
        set({ refundsError: response?.message || 'Gagal memuat pengajuan refund.', refundsLoading: false });
      }
    } catch (err: any) {
      set({ refundsError: err?.message || 'Terjadi kesalahan saat memuat pengajuan refund.', refundsLoading: false });
    }
  },

  fetchRefundById: async (id) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const response = await customerSupportService.getRefundById(id);
      set({ refundsLoading: false });
      if (response && response.success !== false) {
        const detail = response.data !== undefined ? response.data : response;
        set({ selectedRefund: detail });
        return detail;
      }
      set({ refundsError: response?.message || 'Gagal memuat detail refund.' });
      return null;
    } catch (err: any) {
      set({ refundsError: err?.message || 'Terjadi kesalahan saat memuat detail refund.', refundsLoading: false });
      return null;
    }
  },

  createRefund: async (data) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const response = await customerSupportService.createRefund(data);
      set({ refundsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Pengajuan refund berhasil dibuat.', data: response.data };
      }
      return { success: false, message: response?.message || 'Gagal membuat pengajuan refund.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat pengajuan refund.';
      set({ refundsError: msg, refundsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateRefund: async (id, data) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const status = String(data.status ?? '').toLowerCase();
      // Sprint 6 / SRS 4.4.5 — CS must not approve/reject balance-mutating refunds.
      if (['approved', 'approve', 'disetujui', 'rejected', 'reject', 'ditolak'].includes(status)) {
        set({ refundsLoading: false });
        return {
          success: false,
          message: 'CS tidak berwenang menyetujui/menolak refund yang mengubah saldo. Gunakan Eskalasi ke Finance.',
        };
      }

      const response = await customerSupportService.updateRefund(id, data);
      set({ refundsLoading: false });
      if (response && response.success !== false) {
        if (get().selectedRefund && (get().selectedRefund.id === id || get().selectedRefund.requestId === id)) {
          set({ selectedRefund: { ...get().selectedRefund, ...data } });
        }
        return { success: true, message: response.message || 'Pengajuan refund berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui refund.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui refund.';
      set({ refundsError: msg, refundsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateRefundStatus: async (id, status, note) => {
    return get().updateRefund(id, { status, note });
  },

  escalateRefund: async (id, data) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const response = await customerSupportService.escalateRefund(id, data);
      set({ refundsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Kasus refund berhasil dieskalasi.' };
      }
      return { success: false, message: response?.message || 'Gagal mengeskalasi kasus refund.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengeskalasi kasus refund.';
      set({ refundsError: msg, refundsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  // Knowledge Base
  fetchKnowledgeBase: async (params) => {
    set({ kbLoading: true, kbError: null });
    try {
      const response = await customerSupportService.getKnowledgeBase(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ kbArticles: items, kbPagination: pagination, kbLoading: false });
      } else {
        set({ kbError: response?.message || 'Gagal memuat Knowledge Base.', kbLoading: false });
      }
    } catch (err: any) {
      set({ kbError: err?.message || 'Terjadi kesalahan saat memuat Knowledge Base.', kbLoading: false });
    }
  },

  fetchKbArticles: async (params) => {
    return get().fetchKnowledgeBase(params);
  },

  fetchKnowledgeBaseArticle: async (id) => {
    set({ kbLoading: true, kbError: null });
    try {
      const response = await customerSupportService.getKnowledgeBaseArticle(id);
      set({ kbLoading: false });
      if (response && response.success !== false) {
        const detail = response.data !== undefined ? response.data : response;
        set({ selectedArticle: detail });
        return detail;
      }
      set({ kbError: response?.message || 'Gagal memuat artikel Knowledge Base.' });
      return null;
    } catch (err: any) {
      set({ kbError: err?.message || 'Terjadi kesalahan saat memuat artikel Knowledge Base.', kbLoading: false });
      return null;
    }
  },

  // Investigation
  investigateTransaction: async (query) => {
    set({ investigationLoading: true, investigationError: null });
    try {
      const response = await customerSupportService.investigateTransaction(query);
      if (response && response.success !== false) {
        const data = response.data !== undefined ? response.data : response;
        set({ investigationData: data, investigationLoading: false });
      } else {
        set({ investigationError: response?.message || 'Gagal melakukan investigasi transaksi.', investigationLoading: false });
      }
    } catch (err: any) {
      set({ investigationError: err?.message || 'Terjadi kesalahan saat memuat data investigasi.', investigationLoading: false });
    }
  },
}));
