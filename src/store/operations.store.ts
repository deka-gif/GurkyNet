import { create } from 'zustand';
import { operationsService } from '../services/operations.service';
import { Pagination } from '../types';

function normalizePagination(raw: any): Pagination | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    currentPage: Number(raw.currentPage ?? raw.current_page ?? 1),
    lastPage: Number(raw.lastPage ?? raw.last_page ?? 1),
    perPage: Number(raw.perPage ?? raw.per_page ?? 25),
    total: Number(raw.total ?? 0),
  };
}

function extractListAndPagination(response: any): { items: any[]; pagination: Pagination | null } {
  if (!response) return { items: [], pagination: null };

  const payload = response.data !== undefined ? response.data : response;
  let items: any[] = [];
  let pagination: Pagination | null =
    normalizePagination(response.meta?.pagination) ||
    normalizePagination(response.pagination) ||
    null;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.data)) {
    items = payload.data;
    if (!pagination && (payload.current_page !== undefined || payload.currentPage !== undefined)) {
      pagination = normalizePagination(payload);
    }
  } else if (payload && typeof payload === 'object') {
    const listKey = Object.keys(payload).find((k) => Array.isArray(payload[k]));
    if (listKey) {
      items = payload[listKey];
    }
    if (!pagination && payload.pagination) {
      pagination = normalizePagination(payload.pagination);
    }
  }

  return { items, pagination };
}

export interface OperationsState {
  dashboardData: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  products: any[];
  productsPagination: Pagination | null;
  productsLoading: boolean;
  productsError: string | null;

  providers: any[];
  providersPagination: Pagination | null;
  providersLoading: boolean;
  providersError: string | null;

  pricingProducts: any[];
  pricingNodes: any[];
  pricingLevel: string | null;
  pricingBreadcrumb: any[];
  pricingPagination: Pagination | null;
  pricingSummary: {
    total_products?: number;
    average_margin?: number;
    active_sku_count?: number;
  } | null;
  pricingLoading: boolean;
  pricingError: string | null;

  monitoringData: any | null;
  monitoringLoading: boolean;
  monitoringError: string | null;

  syncLoading: boolean;
  syncError: string | null;
  syncResult: any | null;

  fetchDashboard: () => Promise<void>;
  fetchProducts: (params?: Record<string, any>) => Promise<void>;
  updateProduct: (id: string | number, data: any) => Promise<{ success: boolean; message?: string; errors?: any }>;
  fetchProviders: (params?: Record<string, any>) => Promise<void>;
  refreshProviderStatuses: () => Promise<{ success: boolean; message?: string }>;
  updateProvider: (id: string | number, data: any) => Promise<{ success: boolean; message?: string; errors?: any }>;
  fetchPricing: (params?: Record<string, any>) => Promise<void>;
  updatePricing: (
    data: any,
    id?: string | number
  ) => Promise<{ success: boolean; message?: string; errors?: any; data?: any }>;
  fetchMonitoring: (params?: Record<string, any>) => Promise<void>;
  refreshMonitoring: (params?: Record<string, any>) => Promise<{ success: boolean; message?: string }>;
  fetchMonitoringServiceDetail: (serviceKey: string) => Promise<any | null>;
  fetchMonitoringServiceIssues: (
    serviceKey: string,
    params?: { product_provider_id?: number; page?: number; per_page?: number }
  ) => Promise<any | null>;
  syncCatalog: (payload?: { queue?: boolean; cmd?: string[] }) => Promise<{ success: boolean; message?: string; data?: any }>;
}

export const useOperationsStore = create<OperationsState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  products: [],
  productsPagination: null,
  productsLoading: false,
  productsError: null,

  providers: [],
  providersPagination: null,
  providersLoading: false,
  providersError: null,

  pricingProducts: [],
  pricingNodes: [],
  pricingLevel: null,
  pricingBreadcrumb: [],
  pricingPagination: null,
  pricingSummary: null,
  pricingLoading: false,
  pricingError: null,

  monitoringData: null,
  monitoringLoading: false,
  monitoringError: null,

  syncLoading: false,
  syncError: null,
  syncResult: null,

  fetchDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await operationsService.getDashboard();
      if (response && response.success !== false) {
        set({ dashboardData: response.data || response, dashboardLoading: false });
      } else {
        set({ dashboardError: response?.message || 'Gagal memuat dashboard operasional.', dashboardLoading: false });
      }
    } catch (err: any) {
      set({
        dashboardError: err?.message || 'Terjadi kesalahan saat memuat dashboard operasional.',
        dashboardLoading: false,
      });
    }
  },

  fetchProducts: async (params) => {
    set({ productsLoading: true, productsError: null });
    try {
      const response = await operationsService.getProducts(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({
          products: items,
          productsPagination: pagination,
          productsLoading: false,
        });
      } else {
        set({ productsError: response?.message || 'Gagal memuat data produk.', productsLoading: false });
      }
    } catch (err: any) {
      set({
        productsError: err?.message || 'Terjadi kesalahan saat memuat data produk.',
        productsLoading: false,
      });
    }
  },

  updateProduct: async (id, data) => {
    set({ productsLoading: true, productsError: null });
    try {
      const response = await operationsService.updateProduct(id, data);
      set({ productsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Produk berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui produk.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui produk.';
      set({ productsError: msg, productsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  fetchProviders: async (params) => {
    set({ providersLoading: true, providersError: null });
    try {
      const response = await operationsService.getProviders(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({
          providers: items,
          providersPagination: pagination,
          providersLoading: false,
        });
      } else {
        set({ providersError: response?.message || 'Gagal memuat data provider.', providersLoading: false });
      }
    } catch (err: any) {
      set({
        providersError: err?.message || 'Terjadi kesalahan saat memuat data provider.',
        providersLoading: false,
      });
    }
  },

  refreshProviderStatuses: async () => {
    set({ providersLoading: true, providersError: null });
    try {
      const response = await operationsService.refreshProviderStatuses();
      if (response && response.success !== false) {
        // Reload list with refresh=false — health already persisted by backend probe.
        await get().fetchProviders({ page: 1, per_page: 25, sort: 'priority' });
        return { success: true, message: response.message || 'Status provider berhasil di-refresh.' };
      }
      set({ providersLoading: false });
      return { success: false, message: response?.message || 'Gagal refresh status provider.' };
    } catch (err: any) {
      set({
        providersError: err?.message || 'Gagal refresh status provider.',
        providersLoading: false,
      });
      return { success: false, message: err?.message || 'Gagal refresh status provider.' };
    }
  },

  updateProvider: async (id, data) => {
    set({ providersLoading: true, providersError: null });
    try {
      const response = await operationsService.updateProvider(id, data);
      set({ providersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Provider berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui provider.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui provider.';
      set({ providersError: msg, providersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  fetchPricing: async (params) => {
    set({ pricingLoading: true, pricingError: null });
    try {
      const response = await operationsService.getPricing(params);
      if (response && response.success !== false) {
        const payload = response.data || response;
        const items =
          (Array.isArray(payload?.products) && payload.products) ||
          (Array.isArray(payload?.master_products) && payload.master_products) ||
          [];
        const meta = (response as any)?.meta;
        const pagination =
          normalizePagination(payload?.pagination) ||
          normalizePagination(meta?.pagination) ||
          null;
        set({
          pricingProducts: items,
          pricingNodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
          pricingLevel: payload?.level || meta?.level || null,
          pricingBreadcrumb: Array.isArray(payload?.breadcrumb) ? payload.breadcrumb : [],
          pricingPagination: pagination,
          pricingLoading: false,
          pricingSummary: payload?.summary || meta?.summary || null,
        });
      } else {
        set({ pricingError: response?.message || 'Gagal memuat data harga.', pricingLoading: false });
      }
    } catch (err: any) {
      set({
        pricingError: err?.message || 'Terjadi kesalahan saat memuat data harga.',
        pricingLoading: false,
      });
    }
  },

  updatePricing: async (data, id) => {
    set({ pricingLoading: true, pricingError: null });
    try {
      const productId = id ?? data?.product_id ?? data?.id;
      const response = await operationsService.updatePricing(
        {
          ...data,
          product_id: productId,
        },
        productId
      );
      set({ pricingLoading: false });
      if (response && response.success !== false) {
        return {
          success: true,
          message: response.message || 'Skema harga berhasil diperbarui.',
          data: response.data || response,
        };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui harga.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Gagal memperbarui harga.';
      set({ pricingError: msg, pricingLoading: false });
      return { success: false, message: msg, errors: err?.errors || err?.response?.data?.errors };
    }
  },

  fetchMonitoring: async (params) => {
    set({ monitoringLoading: true, monitoringError: null });
    try {
      const response = await operationsService.getMonitoring(params);
      if (response && response.success !== false) {
        set({ monitoringData: response.data || response, monitoringLoading: false });
      } else {
        set({ monitoringError: response?.message || 'Gagal memuat data monitoring.', monitoringLoading: false });
      }
    } catch (err: any) {
      set({
        monitoringError: err?.message || 'Terjadi kesalahan saat memuat data monitoring.',
        monitoringLoading: false,
      });
    }
  },

  refreshMonitoring: async (params) => {
    set({ monitoringLoading: true, monitoringError: null });
    try {
      const response = await operationsService.refreshMonitoring(params);
      if (response && response.success !== false) {
        set({ monitoringData: response.data || response, monitoringLoading: false });
        return { success: true, message: response.message || 'Status layanan berhasil di-refresh.' };
      }
      set({ monitoringError: response?.message || 'Gagal refresh status layanan.', monitoringLoading: false });
      return { success: false, message: response?.message || 'Gagal refresh status layanan.' };
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kesalahan saat refresh status layanan.';
      set({ monitoringError: msg, monitoringLoading: false });
      return { success: false, message: msg };
    }
  },

  fetchMonitoringServiceDetail: async (serviceKey) => {
    try {
      const response = await operationsService.getMonitoringServiceDetail(serviceKey);
      if (response && response.success !== false) {
        return response.data || response;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchMonitoringServiceIssues: async (serviceKey, params) => {
    try {
      const response = await operationsService.getMonitoringServiceIssues(serviceKey, params);
      if (response && response.success !== false) {
        return response.data || response;
      }
      return null;
    } catch {
      return null;
    }
  },

  syncCatalog: async (payload) => {
    set({ syncLoading: true, syncError: null });
    try {
      const response = await operationsService.syncCatalog(payload);
      if (response && response.success !== false) {
        set({
          syncResult: response.data || response,
          syncLoading: false,
        });
        await get().fetchDashboard();
        return {
          success: true,
          message: response.message || 'Sinkronisasi Digiflazz berhasil.',
          data: response.data || response,
        };
      }
      set({
        syncError: response?.message || 'Gagal menyinkronkan katalog Digiflazz.',
        syncLoading: false,
      });
      return { success: false, message: response?.message || 'Gagal menyinkronkan katalog Digiflazz.' };
    } catch (err: any) {
      const msg = err?.message || 'Gagal menyinkronkan katalog Digiflazz.';
      set({ syncError: msg, syncLoading: false });
      return { success: false, message: msg };
    }
  },
}));
