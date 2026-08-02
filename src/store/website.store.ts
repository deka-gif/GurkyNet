import { create } from 'zustand';
import { websiteService } from '../services/website.service';
import { WebsiteSetting, HomepageSection, WebsiteMenu, StaticPage, PublicBanner } from '../types';

interface WebsiteState {
  settings: WebsiteSetting | null;
  sections: HomepageSection[];
  menus: WebsiteMenu[];
  pages: StaticPage[];
  banners: PublicBanner[];
  
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
}

export const useWebsiteStore = create<WebsiteState>((set, get) => ({
  settings: null,
  sections: [],
  menus: [],
  pages: [],
  banners: [],

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

  fetchSettings: async (force = false) => {
    if (get().settings && !force) return; // Cache hit - avoid duplicate requests!
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
    set({ loadingBanners: true, errorBanners: null });
    try {
      const response = await websiteService.getPublicBanners();
      set({ banners: response.data || [], loadingBanners: false });
    } catch (err: any) {
      set({ errorBanners: err.message || 'Gagal memuat banner promosi.', loadingBanners: false });
    }
  },
}));
