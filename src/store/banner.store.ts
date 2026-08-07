import { create } from 'zustand';
import { bannerService } from '../services/banner/banner.service';
import { Banner } from '../types';
import { CacheTTL, cachedFetch, getCachedStale } from '../utils/queryCache';

interface BannerState {
  banners: Banner[];
  loading: boolean;
  error: string | null;
  currentPromo: Banner | null;
  promoLoading: boolean;
  promoError: string | null;
  lastFetchedAt: number | null;
  fetchBanners: (opts?: { force?: boolean }) => Promise<void>;
  fetchPromoBySlug: (slug: string) => Promise<Banner | null>;
  clearCurrentPromo: () => void;
}

export const useBannerStore = create<BannerState>((set, get) => ({
  banners: [],
  loading: false,
  error: null,
  currentPromo: null,
  promoLoading: false,
  promoError: null,
  lastFetchedAt: null,

  fetchBanners: async (opts) => {
    const force = Boolean(opts?.force);
    const stale = getCachedStale<Banner[]>('banners:list');
    if (!force && stale?.fresh && get().banners.length > 0) {
      return;
    }
    if (!force && stale && get().banners.length === 0) {
      set({ banners: stale.data, loading: false, lastFetchedAt: Date.now() });
      if (stale.fresh) return;
    }

    // Soft loading — keep stale UI while refreshing
    if (get().banners.length === 0) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const data = await cachedFetch<Banner[]>({
        key: 'banners:list',
        ttlMs: CacheTTL.BANNER,
        force,
        fetcher: async () => {
          const response = await bannerService.getBanners();
          if (!response.success) throw new Error(response.message || 'Gagal memuat banner');
          return response.data || [];
        },
      });
      set({ banners: data, loading: false, lastFetchedAt: Date.now() });
    } catch (err: any) {
      if (get().banners.length === 0) {
        set({ error: err.message || 'Gagal memuat promo banner.', loading: false, banners: [] });
      } else {
        set({ loading: false });
      }
    }
  },

  fetchPromoBySlug: async (slug: string) => {
    set({ promoLoading: true, promoError: null, currentPromo: null });
    try {
      const data = await cachedFetch<Banner>({
        key: `banners:slug:${slug}`,
        ttlMs: CacheTTL.BANNER,
        fetcher: async () => {
          const response = await bannerService.getBannerBySlug(slug);
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Promo tidak ditemukan.');
          }
          return response.data;
        },
      });
      set({ currentPromo: data, promoLoading: false });
      return data;
    } catch (err: any) {
      set({
        promoError: err?.response?.data?.message || err.message || 'Gagal memuat detail promo.',
        promoLoading: false,
      });
      return null;
    }
  },

  clearCurrentPromo: () => set({ currentPromo: null, promoError: null }),
}));
