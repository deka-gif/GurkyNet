import { create } from 'zustand';
import { financeService } from '../services/finance.service';
import { Pagination } from '../types';

export interface FinanceDashboardData {
  summary?: any;
  revenueChart?: any[];
  statusSummaries?: any[];
  latestPayments?: any[];
  [key: string]: any;
}

export interface FinanceState {
  // Dashboard
  dashboardData: FinanceDashboardData | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  // Reports
  reports: any[];
  reportsPagination: Pagination | null;
  reportsLoading: boolean;
  reportsError: string | null;

  // Refunds
  refunds: any[];
  refundsPagination: Pagination | null;
  refundsLoading: boolean;
  refundsError: string | null;

  // Settlements
  settlements: any[];
  settlementsPagination: Pagination | null;
  settlementsLoading: boolean;
  settlementsError: string | null;

  // Actions
  fetchDashboard: () => Promise<void>;
  fetchReports: (params?: Record<string, any>) => Promise<void>;
  fetchRefunds: (params?: Record<string, any>) => Promise<void>;
  approveRefund: (id: string, note?: string) => Promise<boolean>;
  rejectRefund: (id: string, note?: string) => Promise<boolean>;
  updateRefundStatus: (id: string, status: string, note?: string) => Promise<boolean>;
  fetchSettlements: (params?: Record<string, any>) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  reports: [],
  reportsPagination: null,
  reportsLoading: false,
  reportsError: null,

  refunds: [],
  refundsPagination: null,
  refundsLoading: false,
  refundsError: null,

  settlements: [],
  settlementsPagination: null,
  settlementsLoading: false,
  settlementsError: null,

  fetchDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await financeService.getDashboard();
      if (response && response.success !== false) {
        set({ dashboardData: response.data || response, dashboardLoading: false });
      } else {
        set({ dashboardError: response?.message || 'Gagal memuat dashboard keuangan.', dashboardLoading: false });
      }
    } catch (err: any) {
      set({
        dashboardError: err?.message || 'Terjadi kesalahan saat memuat dashboard keuangan.',
        dashboardLoading: false,
      });
    }
  },

  fetchReports: async (params) => {
    set({ reportsLoading: true, reportsError: null });
    try {
      const response = await financeService.getReports(params);
      if (response && response.success !== false) {
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.reports || []);
        set({
          reports: data,
          reportsPagination: response.pagination || response.data?.pagination || null,
          reportsLoading: false,
        });
      } else {
        set({ reportsError: response?.message || 'Gagal memuat laporan keuangan.', reportsLoading: false });
      }
    } catch (err: any) {
      set({
        reportsError: err?.message || 'Terjadi kesalahan saat memuat laporan keuangan.',
        reportsLoading: false,
      });
    }
  },

  fetchRefunds: async (params) => {
    set({ refundsLoading: true, refundsError: null });
    try {
      const response = await financeService.getRefunds(params);
      if (response && response.success !== false) {
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.refunds || []);
        set({
          refunds: data,
          refundsPagination: response.pagination || response.data?.pagination || null,
          refundsLoading: false,
        });
      } else {
        set({ refundsError: response?.message || 'Gagal memuat data refund.', refundsLoading: false });
      }
    } catch (err: any) {
      set({
        refundsError: err?.message || 'Terjadi kesalahan saat memuat data refund.',
        refundsLoading: false,
      });
    }
  },

  approveRefund: async (id, note) => {
    try {
      const response = await financeService.approveRefund(id, { note, internalReviewNote: note });
      if (response && response.success !== false) {
        await get().fetchRefunds();
        return true;
      }
      return false;
    } catch (err: any) {
      set({ refundsError: err?.message || 'Gagal menyetujui refund.' });
      return false;
    }
  },

  rejectRefund: async (id, note) => {
    try {
      const response = await financeService.rejectRefund(id, { note, internalReviewNote: note });
      if (response && response.success !== false) {
        await get().fetchRefunds();
        return true;
      }
      return false;
    } catch (err: any) {
      set({ refundsError: err?.message || 'Gagal menolak refund.' });
      return false;
    }
  },

  updateRefundStatus: async (id, status, note) => {
    try {
      const response = await financeService.updateRefundStatus(id, status, { note, internalReviewNote: note });
      if (response && response.success !== false) {
        await get().fetchRefunds();
        return true;
      }
      return false;
    } catch (err: any) {
      set({ refundsError: err?.message || 'Gagal memperbarui status refund.' });
      return false;
    }
  },

  fetchSettlements: async (params) => {
    set({ settlementsLoading: true, settlementsError: null });
    try {
      const response = await financeService.getSettlements(params);
      if (response && response.success !== false) {
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.settlements || []);
        set({
          settlements: data,
          settlementsPagination: response.pagination || response.data?.pagination || null,
          settlementsLoading: false,
        });
      } else {
        set({ settlementsError: response?.message || 'Gagal memuat data settlement.', settlementsLoading: false });
      }
    } catch (err: any) {
      set({
        settlementsError: err?.message || 'Terjadi kesalahan saat memuat data settlement.',
        settlementsLoading: false,
      });
    }
  },
}));
