import { create } from 'zustand';
import { bannerService } from '../services/banner/banner.service';
import { Banner } from '../types';

interface BannerState {
  banners: Banner[];
  loading: boolean;
  error: string | null;
  fetchBanners: () => Promise<void>;
  addBanner: (data: Partial<Banner>) => Promise<boolean>;
  removeBanner: (id: string) => Promise<boolean>;
}

export const useBannerStore = create<BannerState>((set, get) => ({
  banners: [],
  loading: false,
  error: null,

  fetchBanners: async () => {
    set({ loading: true, error: null });
    try {
      const response = await bannerService.getBanners();
      if (response.success) {
        set({ banners: response.data, loading: false });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memuat promo banner.', loading: false });
    }
  },

  addBanner: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await bannerService.createBanner(data);
      if (response.success) {
        set({ banners: [...get().banners, response.data], loading: false });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal membuat banner.', loading: false });
      return false;
    }
  },

  removeBanner: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await bannerService.deleteBanner(id);
      if (response.success) {
        set({
          banners: get().banners.filter((b) => b.id !== id),
          loading: false,
        });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal menghapus banner.', loading: false });
      return false;
    }
  },
}));
