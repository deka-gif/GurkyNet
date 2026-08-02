import { create } from 'zustand';
import { operationsService } from '../services/operations.service';
import { Pagination } from '../types';

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
    const listKey = Object.keys(payload).find(k => Array.isArray(payload[k]));
    if (listKey) {
      items = payload[listKey];
    }
    if (!pagination && payload.pagination) {
      pagination = payload.pagination;
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
  pricingPagination: Pagination | null;
  pricingLoading: boolean;
  pricingError: string | null;

  monitoringData: any | null;
  monitoringLoading: boolean;
  monitoringError: string | null;

  fetchDashboard: () => Promise<void>;
  fetchProducts: (params?: Record<string, any>) => Promise<void>;
  updateProduct: (id: string | number, data: any) => Promise<{ success: boolean; message?: string; errors?: any }>;
  fetchProviders: (params?: Record<string, any>) => Promise<void>;
  updateProvider: (id: string | number, data: any) => Promise<{ success: boolean; message?: string; errors?: any }>;
  fetchPricing: (params?: Record<string, any>) => Promise<void>;
  updatePricing: (data: any, id?: string | number) => Promise<{ success: boolean; message?: string; errors?: any }>;
  fetchMonitoring: (params?: Record<string, any>) => Promise<void>;
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
  pricingPagination: null,
  pricingLoading: false,
  pricingError: null,

  monitoringData: null,
  monitoringLoading: false,
  monitoringError: null,

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
        const { items, pagination } = extractListAndPagination(response);
        set({
          pricingProducts: items,
          pricingPagination: pagination,
          pricingLoading: false,
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
      const response = await operationsService.updatePricing(data, id);
      set({ pricingLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Skema harga berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui harga.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui harga.';
      set({ pricingError: msg, pricingLoading: false });
      return { success: false, message: msg, errors: err?.errors };
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
}));
