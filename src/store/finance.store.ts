import { create } from 'zustand';
import { financeService } from '../services/finance.service';
import { Pagination } from '../types';
import {
  clearIdempotencyKeyForLogicalAction,
  getOrCreateIdempotencyKeyForLogicalAction,
} from '../utils/idempotency';

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
  reportsSummary: Record<string, any> | null;
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
  adjustWallet: (payload: {
    user_id?: number;
    email?: string;
    amount: number;
    direction: 'credit' | 'debit';
    reason: string;
  }) => Promise<boolean>;
  fetchSettlements: (params?: Record<string, any>) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  reports: [],
  reportsSummary: null,
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
        const payload = response.data;
        const data = Array.isArray(payload)
          ? payload
          : (payload?.records || payload?.data || payload?.reports || []);
        const reportsSummary = !Array.isArray(payload) && payload?.summary ? payload.summary : null;
        set({
          reports: data,
          reportsSummary,
          reportsPagination: response.pagination || payload?.pagination || null,
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
    const logicalId = `finance-refund-approve:${id}`;
    const idempotencyKey = getOrCreateIdempotencyKeyForLogicalAction(logicalId);
    try {
      const response = await financeService.approveRefund(id, {
        note,
        internalReviewNote: note,
        idempotency_key: idempotencyKey,
      } as any);
      if (response && response.success !== false) {
        clearIdempotencyKeyForLogicalAction(logicalId);
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

  // SRS 14.1 — manual adjustment balance mutation; stable key per logical attempt.
  adjustWallet: async (payload) => {
    const logicalId = `finance-wallet-adjust:${payload.user_id ?? payload.email}:${payload.direction}:${payload.amount}:${payload.reason}`;
    const idempotencyKey = getOrCreateIdempotencyKeyForLogicalAction(logicalId);
    try {
      const response = await financeService.adjustWallet({
        ...payload,
        idempotency_key: idempotencyKey,
      });
      if (response && response.success !== false) {
        clearIdempotencyKeyForLogicalAction(logicalId);
        return true;
      }
      return false;
    } catch (err: any) {
      set({ refundsError: err?.message || 'Gagal penyesuaian saldo.' });
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
