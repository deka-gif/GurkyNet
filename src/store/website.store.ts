import { create } from 'zustand';
import { websiteService } from '../services/website.service';
import { WebsiteSetting, HomepageSection, WebsiteMenu, StaticPage, PublicBanner, HomepageCatalogBucket, HomepagePayload } from '../types';

interface WebsiteState {
  settings: WebsiteSetting | null;
  sections: HomepageSection[];
  menus: WebsiteMenu[];
  pages: StaticPage[];
  banners: PublicBanner[];
  homepageCategories: HomepageCatalogBucket[];
  featuredProducts: HomepagePayload['featuredProducts'];
  faqs: HomepagePayload['faqs'];
  seo: HomepagePayload['seo'] | null;
  homepageReady: boolean;

  loadingSettings: boolean;
  loadingSections: boolean;
  loadingMenus: boolean;
  loadingPages: boolean;
  loadingBanners: boolean;

  errorSettings: string | null;
  errorSections: string | null;
  errorMenus: string | null;
  errorPages: string | null;
  errorBanners: string | null;

  fetchSettings: (force?: boolean) => Promise<void>;
  fetchSections: (force?: boolean) => Promise<void>;
  fetchMenus: (force?: boolean) => Promise<void>;
  fetchPages: (force?: boolean) => Promise<void>;
  fetchBanners: (force?: boolean) => Promise<void>;
  fetchHomepage: (force?: boolean) => Promise<void>;
}

/** In-flight promise — ensures GET /public/homepage is never duplicated. */
let homepageInflight: Promise<void> | null = null;

export const useWebsiteStore = create<WebsiteState>((set, get) => ({
  settings: null,
  sections: [],
  menus: [],
  pages: [],
  banners: [],
  homepageCategories: [],
  featuredProducts: [],
  faqs: [],
  seo: null,
  homepageReady: false,

  loadingSettings: false,
  loadingSections: false,
  loadingMenus: false,
  loadingPages: false,
  loadingBanners: false,

  errorSettings: null,
  errorSections: null,
  errorMenus: null,
  errorPages: null,
  errorBanners: null,

  fetchHomepage: async (force = false) => {
    if (!force && get().homepageReady) return;
    if (!force && homepageInflight) return homepageInflight;

    homepageInflight = (async () => {
      set({
        loadingSettings: true,
        loadingSections: true,
        loadingBanners: true,
        loadingMenus: true,
        loadingPages: true,
        errorSettings: null,
        errorSections: null,
        errorBanners: null,
      });
      try {
        const response = await websiteService.getPublicHomepage();
        const payload = response.data;
        set({
          settings: payload?.settings ?? null,
          sections: payload?.sections ?? [],
          banners: payload?.banners ?? [],
          homepageCategories: payload?.homepageCategories ?? [],
          featuredProducts: payload?.featuredProducts ?? [],
          faqs: payload?.faqs ?? [],
          menus: payload?.menus ?? get().menus,
          pages: payload?.pages ?? get().pages,
          seo: payload?.seo ?? null,
          homepageReady: true,
          loadingSettings: false,
          loadingSections: false,
          loadingBanners: false,
          loadingMenus: false,
          loadingPages: false,
        });
      } catch (err: any) {
        const message = err?.message || 'Gagal memuat homepage publik.';
        set({
          errorSettings: message,
          errorSections: message,
          errorBanners: message,
          loadingSettings: false,
          loadingSections: false,
          loadingBanners: false,
          loadingMenus: false,
          loadingPages: false,
        });
      }
    })();

    try {
      await homepageInflight;
    } finally {
      homepageInflight = null;
    }
  },

  fetchSettings: async (force = false) => {
    if (get().settings && !force) return;
    if (!force && homepageInflight) {
      await homepageInflight;
      if (get().settings) return;
    }
    set({ loadingSettings: true, errorSettings: null });
    try {
      const data = await websiteService.getPublicSettings();
      const setting = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : (data || null);
      set({ settings: setting, loadingSettings: false });
    } catch (err: any) {
      set({ errorSettings: err.message || 'Gagal memuat pengaturan website.', loadingSettings: false });
    }
  },

  fetchSections: async (force = false) => {
    if (get().sections.length > 0 && !force) return;
    if (!force && homepageInflight) {
      await homepageInflight;
      if (get().sections.length > 0) return;
    }
    set({ loadingSections: true, errorSections: null });
    try {
      const response = await websiteService.getPublicSections();
      set({ sections: response.data || [], loadingSections: false });
    } catch (err: any) {
      set({ errorSections: err.message || 'Gagal memuat seksi halaman.', loadingSections: false });
    }
  },

  fetchMenus: async (force = false) => {
    if (get().menus.length > 0 && !force) return;
    if (!force && homepageInflight) {
      await homepageInflight;
      if (get().menus.length > 0) return;
    }
    set({ loadingMenus: true, errorMenus: null });
    try {
      const response = await websiteService.getPublicMenus();
      set({ menus: response.data || [], loadingMenus: false });
    } catch (err: any) {
      set({ errorMenus: err.message || 'Gagal memuat menu navigasi.', loadingMenus: false });
    }
  },

  fetchPages: async (force = false) => {
    if (get().pages.length > 0 && !force) return;
    if (!force && homepageInflight) {
      await homepageInflight;
      if (get().pages.length > 0) return;
    }
    set({ loadingPages: true, errorPages: null });
    try {
      const response = await websiteService.getPublicPages();
      set({ pages: response.data || [], loadingPages: false });
    } catch (err: any) {
      set({ errorPages: err.message || 'Gagal memuat halaman statis.', loadingPages: false });
    }
  },

  fetchBanners: async (force = false) => {
    if (get().banners.length > 0 && !force) return;
    if (!force && homepageInflight) {
      await homepageInflight;
      if (get().banners.length > 0) return;
    }
    set({ loadingBanners: true, errorBanners: null });
    try {
      const response = await websiteService.getPublicBanners();
      set({ banners: response.data || [], loadingBanners: false });
    } catch (err: any) {
      set({ errorBanners: err.message || 'Gagal memuat banner promosi.', loadingBanners: false });
    }
  },
}));
