import { create } from 'zustand';
import { ownerService, AuditLogsParams } from '../services/owner.service';

export interface OwnerState {
  // Dashboard
  dashboardData: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  // Financial Overview
  financialOverview: any | null;
  financialLoading: boolean;
  financialError: string | null;

  // Department Overview
  departmentOverview: any | null;
  departmentLoading: boolean;
  departmentError: string | null;

  // System Health
  systemHealth: any[] | null;
  systemHealthLoading: boolean;
  systemHealthError: string | null;

  // Audit Logs
  auditLogs: any[];
  auditLogsPagination: any | null;
  auditLogsLoading: boolean;
  auditLogsError: string | null;

  // Activity Timeline
  activityTimeline: any[];
  activityTimelineLoading: boolean;
  activityTimelineError: string | null;

  // Combined fetchers
  fetchDashboard: () => Promise<void>;
  fetchFinancialOverview: (params?: Record<string, any>) => Promise<void>;
  fetchDepartmentOverview: (params?: Record<string, any>) => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  fetchAuditLogs: (params?: AuditLogsParams) => Promise<void>;
  fetchActivityTimeline: (params?: Record<string, any>) => Promise<void>;
  fetchAllExecutiveData: () => Promise<void>;
}

export const useOwnerStore = create<OwnerState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  financialOverview: null,
  financialLoading: false,
  financialError: null,

  departmentOverview: null,
  departmentLoading: false,
  departmentError: null,

  systemHealth: null,
  systemHealthLoading: false,
  systemHealthError: null,

  auditLogs: [],
  auditLogsPagination: null,
  auditLogsLoading: false,
  auditLogsError: null,

  activityTimeline: [],
  activityTimelineLoading: false,
  activityTimelineError: null,

  fetchDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await ownerService.getDashboard();
      if (response && response.success !== false) {
        set({ dashboardData: response.data || response, dashboardLoading: false });
      } else {
        set({
          dashboardError: response?.message || 'Gagal memuat executive dashboard.',
          dashboardLoading: false,
        });
      }
    } catch (err: any) {
      set({
        dashboardError: err?.message || 'Terjadi kesalahan saat memuat executive dashboard.',
        dashboardLoading: false,
      });
    }
  },

  fetchFinancialOverview: async (params) => {
    set({ financialLoading: true, financialError: null });
    try {
      const response = await ownerService.getFinancialOverview(params);
      if (response && response.success !== false) {
        set({ financialOverview: response.data || response, financialLoading: false });
      } else {
        set({
          financialError: response?.message || 'Gagal memuat financial overview.',
          financialLoading: false,
        });
      }
    } catch (err: any) {
      set({
        financialError: err?.message || 'Terjadi kesalahan saat memuat financial overview.',
        financialLoading: false,
      });
    }
  },

  fetchDepartmentOverview: async (params) => {
    set({ departmentLoading: true, departmentError: null });
    try {
      const response = await ownerService.getDepartmentOverview(params);
      if (response && response.success !== false) {
        set({ departmentOverview: response.data || response, departmentLoading: false });
      } else {
        set({
          departmentError: response?.message || 'Gagal memuat department overview.',
          departmentLoading: false,
        });
      }
    } catch (err: any) {
      set({
        departmentError: err?.message || 'Terjadi kesalahan saat memuat department overview.',
        departmentLoading: false,
      });
    }
  },

  fetchSystemHealth: async () => {
    set({ systemHealthLoading: true, systemHealthError: null });
    try {
      const response = await ownerService.getSystemHealth();
      if (response && response.success !== false) {
        const data = Array.isArray(response.data) ? response.data : (response.data?.services || response.data?.items || response.data || []);
        set({ systemHealth: Array.isArray(data) ? data : [], systemHealthLoading: false });
      } else {
        set({
          systemHealthError: response?.message || 'Gagal memuat system health.',
          systemHealthLoading: false,
        });
      }
    } catch (err: any) {
      set({
        systemHealthError: err?.message || 'Terjadi kesalahan saat memuat system health.',
        systemHealthLoading: false,
      });
    }
  },

  fetchAuditLogs: async (params) => {
    set({ auditLogsLoading: true, auditLogsError: null });
    try {
      const response = await ownerService.getAuditLogs(params);
      if (response && response.success !== false) {
        const raw = response.data || response;
        const list = Array.isArray(raw) ? raw : (raw.data || raw.logs || []);
        const pagination = response.pagination || raw.pagination || null;
        set({
          auditLogs: Array.isArray(list) ? list : [],
          auditLogsPagination: pagination,
          auditLogsLoading: false,
        });
      } else {
        set({
          auditLogsError: response?.message || 'Gagal memuat audit logs.',
          auditLogsLoading: false,
        });
      }
    } catch (err: any) {
      set({
        auditLogsError: err?.message || 'Terjadi kesalahan saat memuat audit logs.',
        auditLogsLoading: false,
      });
    }
  },

  fetchActivityTimeline: async (params) => {
    set({ activityTimelineLoading: true, activityTimelineError: null });
    try {
      const response = await ownerService.getActivityTimeline(params);
      if (response && response.success !== false) {
        const raw = response.data || response;
        const list = Array.isArray(raw) ? raw : (raw.data || raw.activities || []);
        set({
          activityTimeline: Array.isArray(list) ? list : [],
          activityTimelineLoading: false,
        });
      } else {
        set({
          activityTimelineError: response?.message || 'Gagal memuat activity timeline.',
          activityTimelineLoading: false,
        });
      }
    } catch (err: any) {
      set({
        activityTimelineError: err?.message || 'Terjadi kesalahan saat memuat activity timeline.',
        activityTimelineLoading: false,
      });
    }
  },

  fetchAllExecutiveData: async () => {
    await Promise.allSettled([
      get().fetchDashboard(),
      get().fetchFinancialOverview(),
      get().fetchDepartmentOverview(),
      get().fetchSystemHealth(),
      get().fetchAuditLogs(),
      get().fetchActivityTimeline(),
    ]);
  },
}));
