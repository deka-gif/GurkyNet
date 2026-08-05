import { create } from 'zustand';
import { bannerService } from '../services/banner/banner.service';
import { Banner } from '../types';

interface BannerState {
  banners: Banner[];
  loading: boolean;
  error: string | null;
  fetchBanners: () => Promise<void>;
}

export const useBannerStore = create<BannerState>((set) => ({
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
}));
