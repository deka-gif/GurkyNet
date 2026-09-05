import { create } from 'zustand';
import { bannerService, Banner } from '../services/banner.service';

interface BannerState {
  banners: Banner[];
  loading: boolean;
  error: string | null;
  /** Fetch Marketing CMS banners. No persistent cache — refetch on Home load/refresh. */
  fetchBanners: () => Promise<void>;
}

/**
 * Mirrors web banner store data source (GET /public/banners) without the
 * long client TTL that can delay Marketing updates on mobile.
 */
export const useBannerStore = create<BannerState>((set) => ({
  banners: [],
  loading: false,
  error: null,

  fetchBanners: async () => {
    set((s) => ({
      loading: s.banners.length === 0,
      error: null,
    }));
    try {
      const response = await bannerService.getBanners();
      if (response.success) {
        set({ banners: Array.isArray(response.data) ? response.data : [], loading: false });
      } else {
        set((s) => ({
          error: response.message || 'Gagal memuat banner.',
          loading: false,
          // Keep last good list so a soft refresh failure does not blank Home promo.
          banners: s.banners,
        }));
      }
    } catch (err: any) {
      set((s) => ({
        error: err?.message || 'Gagal memuat banner.',
        loading: false,
        banners: s.banners,
      }));
    }
  },
}));
