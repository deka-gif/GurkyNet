import { apiClient } from './api';
import { ApiResponse, WebsiteSetting, HomepageSection, WebsiteMenu, StaticPage, PublicBanner, HomepagePayload } from '../types';

// Helper to convert setting keys from Camel to Snake
function settingToBackend(s: Partial<WebsiteSetting>): any {
  const backend: any = {};
  if (s.websiteName !== undefined) backend.website_name = s.websiteName;
  if (s.tagline !== undefined) backend.tagline = s.tagline;
  if (s.logo !== undefined) backend.logo = s.logo;
  if (s.logoDark !== undefined) backend.logo_dark = s.logoDark;
  if (s.favicon !== undefined) backend.favicon = s.favicon;
  if (s.logoMediaId !== undefined) backend.logo_media_id = s.logoMediaId;
  if (s.logoDarkMediaId !== undefined) backend.logo_dark_media_id = s.logoDarkMediaId;
  if (s.faviconMediaId !== undefined) backend.favicon_media_id = s.faviconMediaId;
  if (s.supportEmail !== undefined) backend.support_email = s.supportEmail;
  if (s.supportPhone !== undefined) backend.support_phone = s.supportPhone;
  if (s.whatsapp !== undefined) backend.whatsapp = s.whatsapp;
  if (s.officeAddress !== undefined) backend.office_address = s.officeAddress;
  if (s.googleMapsUrl !== undefined) backend.google_maps_url = s.googleMapsUrl;
  if (s.facebook !== undefined) backend.facebook = s.facebook;
  if (s.instagram !== undefined) backend.instagram = s.instagram;
  if (s.tiktok !== undefined) backend.tiktok = s.tiktok;
  if (s.youtube !== undefined) backend.youtube = s.youtube;
  if (s.twitter !== undefined) backend.twitter = s.twitter;
  if (s.copyright !== undefined) backend.copyright = s.copyright;
  if (s.maintenanceMode !== undefined) backend.maintenance_mode = s.maintenanceMode;
  if (s.timezone !== undefined) backend.timezone = s.timezone;
  if (s.currency !== undefined) backend.currency = s.currency;
  if (s.language !== undefined) backend.language = s.language;
  return backend;
}

// Helper to convert section keys from Camel to Snake
function sectionToBackend(s: Partial<HomepageSection>): any {
  const backend: any = {};
  if (s.title !== undefined) backend.title = s.title;
  if (s.slug !== undefined) backend.slug = s.slug;
  if (s.componentType !== undefined) backend.component_type = s.componentType;
  if (s.displayOrder !== undefined) backend.display_order = s.displayOrder;
  if (s.visible !== undefined) backend.visible = s.visible;
  if (s.status !== undefined) backend.status = s.status;
  if (s.description !== undefined) backend.description = s.description;
  if (s.heroBackgroundMediaId !== undefined) backend.hero_background_media_id = s.heroBackgroundMediaId;
  if (s.heroIllustrationMediaId !== undefined) backend.hero_illustration_media_id = s.heroIllustrationMediaId;
  if (s.heroMobileImageMediaId !== undefined) backend.hero_mobile_image_media_id = s.heroMobileImageMediaId;
  return backend;
}

// Helper to convert menu keys from Camel to Snake
function menuToBackend(m: Partial<WebsiteMenu>): any {
  const backend: any = {};
  if (m.title !== undefined) backend.title = m.title;
  if (m.slug !== undefined) backend.slug = m.slug;
  if (m.url !== undefined) backend.url = m.url;
  if (m.icon !== undefined) backend.icon = m.icon;
  if (m.parentId !== undefined) backend.parent_id = m.parentId;
  if (m.displayOrder !== undefined) backend.display_order = m.displayOrder;
  if (m.visible !== undefined) backend.visible = m.visible;
  if (m.openInNewTab !== undefined) backend.open_in_new_tab = m.openInNewTab;
  return backend;
}

// Helper to convert static page keys from Camel to Snake
function pageToBackend(p: Partial<StaticPage>): any {
  const backend: any = {};
  if (p.title !== undefined) backend.title = p.title;
  if (p.slug !== undefined) backend.slug = p.slug;
  if (p.content !== undefined) backend.content = p.content;
  if (p.seoTitle !== undefined) backend.seo_title = p.seoTitle;
  if (p.seoDescription !== undefined) backend.seo_description = p.seoDescription;
  if (p.status !== undefined) backend.status = p.status;
  if (p.publishedAt !== undefined) backend.published_at = p.publishedAt;
  return backend;
}

export const websiteService = {
  // ==========================================
  // PUBLIC WEBSITE ENDPOINTS
  // ==========================================
  async getPublicSettings(): Promise<WebsiteSetting | null> {
    try {
      const res = await apiClient.get<ApiResponse<WebsiteSetting>>('/public/settings');
      return res.data.data;
    } catch {
      return null;
    }
  },

  async getPublicSections(): Promise<ApiResponse<HomepageSection[]>> {
    try {
      const res = await apiClient.get<ApiResponse<HomepageSection[]>>('/public/homepage-sections');
      return res.data;
    } catch {
      return {
        success: true,
        message: 'OK',
        data: [],
      };
    }
  },

  async getPublicMenus(): Promise<ApiResponse<WebsiteMenu[]>> {
    try {
      const res = await apiClient.get<ApiResponse<WebsiteMenu[]>>('/public/menus');
      return res.data;
    } catch {
      return {
        success: true,
        message: 'OK',
        data: [],
      };
    }
  },

  async getPublicPages(): Promise<ApiResponse<StaticPage[]>> {
    try {
      const res = await apiClient.get<ApiResponse<StaticPage[]>>('/public/static-pages');
      return res.data;
    } catch {
      return {
        success: true,
        message: 'OK',
        data: [],
      };
    }
  },

  async getPublicPageBySlug(slug: string): Promise<StaticPage | null> {
    try {
      const res = await apiClient.get<ApiResponse<StaticPage>>(`/public/static-pages/${slug}`);
      return res.data.data;
    } catch {
      try {
        const pages = await this.getPublicPages();
        return pages.data.find((p) => p.slug === slug) || null;
      } catch {
        return null;
      }
    }
  },

  async getPublicBanners(): Promise<ApiResponse<PublicBanner[]>> {
    try {
      const res = await apiClient.get<ApiResponse<PublicBanner[]>>('/public/banners');
      return res.data;
    } catch {
      return {
        success: true,
        message: 'OK',
        data: [],
      };
    }
  },

  async getPublicHomepage(): Promise<ApiResponse<HomepagePayload>> {
    const res = await apiClient.get<ApiResponse<HomepagePayload>>('/public/homepage');
    return res.data;
  },

  async getPublicPromotions(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/promotions', { params });
    return res.data;
  },

  async getPublicVouchers(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/vouchers', { params });
    return res.data;
  },

  async getPublicAnnouncements(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/announcements', { params });
    return res.data;
  },

  async getPublicNews(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/news');
    return res.data;
  },

  async getPublicFaq(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/faq');
    return res.data;
  },

  async getPublicProviderStatus(): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/public/provider-status');
    return res.data;
  },

  // ==========================================
  // WEBSITE SETTINGS (ADMIN)
  // ==========================================
  async getSettings(): Promise<WebsiteSetting[]> {
    const res = await apiClient.get<ApiResponse<WebsiteSetting[]>>('/admin/website/settings');
    return res.data.data;
  },

  async createSetting(setting: Partial<WebsiteSetting>): Promise<WebsiteSetting> {
    const backendData = settingToBackend(setting);
    const res = await apiClient.post<ApiResponse<WebsiteSetting>>('/admin/website/settings', backendData);
    return res.data.data;
  },

  async getSetting(id: number): Promise<WebsiteSetting> {
    const res = await apiClient.get<ApiResponse<WebsiteSetting>>(`/admin/website/settings/${id}`);
    return res.data.data;
  },

  async updateSetting(id: number, setting: Partial<WebsiteSetting>): Promise<WebsiteSetting> {
    const backendData = settingToBackend(setting);
    const res = await apiClient.put<ApiResponse<WebsiteSetting>>(`/admin/website/settings/${id}`, backendData);
    return res.data.data;
  },

  async deleteSetting(id: number): Promise<void> {
    await apiClient.delete(`/admin/website/settings/${id}`);
  },

  // ==========================================
  // HOMEPAGE SECTIONS
  // ==========================================
  async getSections(filters?: {
    keyword?: string;
    component_type?: string;
    visible?: boolean;
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<HomepageSection[]>> {
    const res = await apiClient.get<ApiResponse<HomepageSection[]>>('/admin/website/homepage-sections', {
      params: filters,
    });
    return res.data;
  },

  async createSection(section: Partial<HomepageSection>): Promise<HomepageSection> {
    const backendData = sectionToBackend(section);
    const res = await apiClient.post<ApiResponse<HomepageSection>>('/admin/website/homepage-sections', backendData);
    return res.data.data;
  },

  async getSection(id: number): Promise<HomepageSection> {
    const res = await apiClient.get<ApiResponse<HomepageSection>>(`/admin/website/homepage-sections/${id}`);
    return res.data.data;
  },

  async updateSection(id: number, section: Partial<HomepageSection>): Promise<HomepageSection> {
    const backendData = sectionToBackend(section);
    const res = await apiClient.put<ApiResponse<HomepageSection>>(`/admin/website/homepage-sections/${id}`, backendData);
    return res.data.data;
  },

  async deleteSection(id: number): Promise<void> {
    await apiClient.delete(`/admin/website/homepage-sections/${id}`);
  },

  // ==========================================
  // WEBSITE MENU (TREE / LIST)
  // ==========================================
  async getMenus(filters?: {
    keyword?: string;
    parent_only?: boolean;
    visible?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<WebsiteMenu[]>> {
    const res = await apiClient.get<ApiResponse<WebsiteMenu[]>>('/admin/website/menus', {
      params: filters,
    });
    return res.data;
  },

  async createMenu(menu: Partial<WebsiteMenu>): Promise<WebsiteMenu> {
    const backendData = menuToBackend(menu);
    const res = await apiClient.post<ApiResponse<WebsiteMenu>>('/admin/website/menus', backendData);
    return res.data.data;
  },

  async getMenu(id: number): Promise<WebsiteMenu> {
    const res = await apiClient.get<ApiResponse<WebsiteMenu>>(`/admin/website/menus/${id}`);
    return res.data.data;
  },

  async updateMenu(id: number, menu: Partial<WebsiteMenu>): Promise<WebsiteMenu> {
    const backendData = menuToBackend(menu);
    const res = await apiClient.put<ApiResponse<WebsiteMenu>>(`/admin/website/menus/${id}`, backendData);
    return res.data.data;
  },

  async deleteMenu(id: number): Promise<void> {
    await apiClient.delete(`/admin/website/menus/${id}`);
  },

  // ==========================================
  // STATIC PAGES
  // ==========================================
  async getPages(filters?: {
    keyword?: string;
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<StaticPage[]>> {
    const res = await apiClient.get<ApiResponse<StaticPage[]>>('/admin/website/static-pages', {
      params: filters,
    });
    return res.data;
  },

  async createPage(page: Partial<StaticPage>): Promise<StaticPage> {
    const backendData = pageToBackend(page);
    const res = await apiClient.post<ApiResponse<StaticPage>>('/admin/website/static-pages', backendData);
    return res.data.data;
  },

  async getPage(id: number): Promise<StaticPage> {
    const res = await apiClient.get<ApiResponse<StaticPage>>(`/admin/website/static-pages/${id}`);
    return res.data.data;
  },

  async updatePage(id: number, page: Partial<StaticPage>): Promise<StaticPage> {
    const backendData = pageToBackend(page);
    const res = await apiClient.put<ApiResponse<StaticPage>>(`/admin/website/static-pages/${id}`, backendData);
    return res.data.data;
  },

  async deletePage(id: number): Promise<void> {
    await apiClient.delete(`/admin/website/static-pages/${id}`);
  },
};
