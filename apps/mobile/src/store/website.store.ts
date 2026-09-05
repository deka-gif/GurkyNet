import { create } from 'zustand';
import { websiteService, WebsiteLogoValue } from '../services/website.service';

interface WebsiteState {
  logo: WebsiteLogoValue;
  websiteName: string;
  loading: boolean;
  fetchSettings: () => Promise<void>;
}

/**
 * Platform branding from Marketing Website Settings (GET /public/settings).
 * Non-fatal — Home falls back if fetch fails.
 */
export const useWebsiteStore = create<WebsiteState>((set) => ({
  logo: null,
  websiteName: 'GurkyNet',
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const response = await websiteService.getPublicSettings();
      if (response.success && response.data) {
        set({
          logo: response.data.logo ?? null,
          websiteName: response.data.websiteName || 'GurkyNet',
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));
