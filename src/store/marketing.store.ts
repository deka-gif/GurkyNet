import { create } from 'zustand';
import { marketingService } from '../services/marketing.service';
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

export interface MarketingState {
  // Dashboard
  dashboardData: any | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  // Banners
  banners: any[];
  bannersPagination: Pagination | null;
  bannersLoading: boolean;
  bannersError: string | null;

  // Promotions
  promotions: any[];
  promotionsPagination: Pagination | null;
  promotionsLoading: boolean;
  promotionsError: string | null;

  // Vouchers
  vouchers: any[];
  vouchersPagination: Pagination | null;
  vouchersLoading: boolean;
  vouchersError: string | null;

  // Announcements
  announcements: any[];
  announcementsPagination: Pagination | null;
  announcementsLoading: boolean;
  announcementsError: string | null;

  // Dashboard actions
  fetchDashboard: () => Promise<void>;

  // Banners actions
  fetchBanners: (params?: Record<string, any>) => Promise<void>;
  createBanner: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  updateBanner: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  deleteBanner: (id: string | number) => Promise<{ success: boolean; message?: string; errors?: any }>;

  // Promotions actions
  fetchPromotions: (params?: Record<string, any>) => Promise<void>;
  createPromotion: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  updatePromotion: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  deletePromotion: (id: string | number) => Promise<{ success: boolean; message?: string; errors?: any }>;

  // Vouchers actions
  fetchVouchers: (params?: Record<string, any>) => Promise<void>;
  createVoucher: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  updateVoucher: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  deleteVoucher: (id: string | number) => Promise<{ success: boolean; message?: string; errors?: any }>;

  // Announcements actions
  fetchAnnouncements: (params?: Record<string, any>) => Promise<void>;
  createAnnouncement: (data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  updateAnnouncement: (id: string | number, data: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  deleteAnnouncement: (id: string | number) => Promise<{ success: boolean; message?: string; errors?: any }>;
}

export const useMarketingStore = create<MarketingState>((set, get) => ({
  dashboardData: null,
  dashboardLoading: false,
  dashboardError: null,

  banners: [],
  bannersPagination: null,
  bannersLoading: false,
  bannersError: null,

  promotions: [],
  promotionsPagination: null,
  promotionsLoading: false,
  promotionsError: null,

  vouchers: [],
  vouchersPagination: null,
  vouchersLoading: false,
  vouchersError: null,

  announcements: [],
  announcementsPagination: null,
  announcementsLoading: false,
  announcementsError: null,

  // Dashboard
  fetchDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await marketingService.getDashboard();
      if (response && response.success !== false) {
        set({ dashboardData: response.data !== undefined ? response.data : response, dashboardLoading: false });
      } else {
        set({ dashboardError: response?.message || 'Gagal memuat dashboard marketing.', dashboardLoading: false });
      }
    } catch (err: any) {
      set({
        dashboardError: err?.message || 'Terjadi kesalahan saat memuat dashboard marketing.',
        dashboardLoading: false,
      });
    }
  },

  // Banners
  fetchBanners: async (params) => {
    set({ bannersLoading: true, bannersError: null });
    try {
      const response = await marketingService.getBanners(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ banners: items, bannersPagination: pagination, bannersLoading: false });
      } else {
        set({ bannersError: response?.message || 'Gagal memuat data banner.', bannersLoading: false });
      }
    } catch (err: any) {
      set({ bannersError: err?.message || 'Terjadi kesalahan saat memuat data banner.', bannersLoading: false });
    }
  },

  createBanner: async (data) => {
    set({ bannersLoading: true, bannersError: null });
    try {
      const response = await marketingService.createBanner(data);
      set({ bannersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Banner berhasil dibuat.' };
      }
      return { success: false, message: response?.message || 'Gagal membuat banner.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat banner.';
      set({ bannersError: msg, bannersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateBanner: async (id, data) => {
    set({ bannersLoading: true, bannersError: null });
    try {
      const response = await marketingService.updateBanner(id, data);
      set({ bannersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Banner berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui banner.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui banner.';
      set({ bannersError: msg, bannersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  deleteBanner: async (id) => {
    set({ bannersLoading: true, bannersError: null });
    try {
      const response = await marketingService.deleteBanner(id);
      set({ bannersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Banner berhasil dihapus.' };
      }
      return { success: false, message: response?.message || 'Gagal menghapus banner.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghapus banner.';
      set({ bannersError: msg, bannersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  // Promotions
  fetchPromotions: async (params) => {
    set({ promotionsLoading: true, promotionsError: null });
    try {
      const response = await marketingService.getPromotions(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ promotions: items, promotionsPagination: pagination, promotionsLoading: false });
      } else {
        set({ promotionsError: response?.message || 'Gagal memuat data promosi.', promotionsLoading: false });
      }
    } catch (err: any) {
      set({ promotionsError: err?.message || 'Terjadi kesalahan saat memuat data promosi.', promotionsLoading: false });
    }
  },

  createPromotion: async (data) => {
    set({ promotionsLoading: true, promotionsError: null });
    try {
      const response = await marketingService.createPromotion(data);
      set({ promotionsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Promosi berhasil dibuat.' };
      }
      return { success: false, message: response?.message || 'Gagal membuat promosi.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat promosi.';
      set({ promotionsError: msg, promotionsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updatePromotion: async (id, data) => {
    set({ promotionsLoading: true, promotionsError: null });
    try {
      const response = await marketingService.updatePromotion(id, data);
      set({ promotionsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Promosi berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui promosi.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui promosi.';
      set({ promotionsError: msg, promotionsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  deletePromotion: async (id) => {
    set({ promotionsLoading: true, promotionsError: null });
    try {
      const response = await marketingService.deletePromotion(id);
      set({ promotionsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Promosi berhasil dihapus.' };
      }
      return { success: false, message: response?.message || 'Gagal menghapus promosi.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghapus promosi.';
      set({ promotionsError: msg, promotionsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  // Vouchers
  fetchVouchers: async (params) => {
    set({ vouchersLoading: true, vouchersError: null });
    try {
      const response = await marketingService.getVouchers(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ vouchers: items, vouchersPagination: pagination, vouchersLoading: false });
      } else {
        set({ vouchersError: response?.message || 'Gagal memuat data voucher.', vouchersLoading: false });
      }
    } catch (err: any) {
      set({ vouchersError: err?.message || 'Terjadi kesalahan saat memuat data voucher.', vouchersLoading: false });
    }
  },

  createVoucher: async (data) => {
    set({ vouchersLoading: true, vouchersError: null });
    try {
      const response = await marketingService.createVoucher(data);
      set({ vouchersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Voucher berhasil dibuat.' };
      }
      return { success: false, message: response?.message || 'Gagal membuat voucher.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat voucher.';
      set({ vouchersError: msg, vouchersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateVoucher: async (id, data) => {
    set({ vouchersLoading: true, vouchersError: null });
    try {
      const response = await marketingService.updateVoucher(id, data);
      set({ vouchersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Voucher berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui voucher.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui voucher.';
      set({ vouchersError: msg, vouchersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  deleteVoucher: async (id) => {
    set({ vouchersLoading: true, vouchersError: null });
    try {
      const response = await marketingService.deleteVoucher(id);
      set({ vouchersLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Voucher berhasil dihapus.' };
      }
      return { success: false, message: response?.message || 'Gagal menghapus voucher.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghapus voucher.';
      set({ vouchersError: msg, vouchersLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  // Announcements
  fetchAnnouncements: async (params) => {
    set({ announcementsLoading: true, announcementsError: null });
    try {
      const response = await marketingService.getAnnouncements(params);
      if (response && response.success !== false) {
        const { items, pagination } = extractListAndPagination(response);
        set({ announcements: items, announcementsPagination: pagination, announcementsLoading: false });
      } else {
        set({ announcementsError: response?.message || 'Gagal memuat data pengumuman.', announcementsLoading: false });
      }
    } catch (err: any) {
      set({ announcementsError: err?.message || 'Terjadi kesalahan saat memuat data pengumuman.', announcementsLoading: false });
    }
  },

  createAnnouncement: async (data) => {
    set({ announcementsLoading: true, announcementsError: null });
    try {
      const response = await marketingService.createAnnouncement(data);
      set({ announcementsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Pengumuman berhasil dibuat.' };
      }
      return { success: false, message: response?.message || 'Gagal membuat pengumuman.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal membuat pengumuman.';
      set({ announcementsError: msg, announcementsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  updateAnnouncement: async (id, data) => {
    set({ announcementsLoading: true, announcementsError: null });
    try {
      const response = await marketingService.updateAnnouncement(id, data);
      set({ announcementsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Pengumuman berhasil diperbarui.' };
      }
      return { success: false, message: response?.message || 'Gagal memperbarui pengumuman.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui pengumuman.';
      set({ announcementsError: msg, announcementsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },

  deleteAnnouncement: async (id) => {
    set({ announcementsLoading: true, announcementsError: null });
    try {
      const response = await marketingService.deleteAnnouncement(id);
      set({ announcementsLoading: false });
      if (response && response.success !== false) {
        return { success: true, message: response.message || 'Pengumuman berhasil dihapus.' };
      }
      return { success: false, message: response?.message || 'Gagal menghapus pengumuman.', errors: response?.errors };
    } catch (err: any) {
      const msg = err?.message || 'Gagal menghapus pengumuman.';
      set({ announcementsError: msg, announcementsLoading: false });
      return { success: false, message: msg, errors: err?.errors };
    }
  },
}));
