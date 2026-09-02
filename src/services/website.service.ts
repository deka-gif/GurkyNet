import { apiClient } from './api';
import { ApiResponse, WebsiteSetting, HomepageSection, WebsiteMenu, StaticPage, PublicBanner, HomepagePayload } from '../types';

// Helper to convert setting keys from Camel to Snake
function mediaToUrl(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'url' in (value as any)) {
    return String((value as any).url || '');
  }
  return undefined;
}

function settingToBackend(s: Partial<WebsiteSetting>): any {
  const backend: any = {};
  if (s.websiteName !== undefined) backend.website_name = s.websiteName;
  if (s.tagline !== undefined) backend.tagline = s.tagline;

  // Never send Media objects — only string URLs (or omit when only media_id changes)
  const logo = mediaToUrl(s.logo);
  const logoDark = mediaToUrl(s.logoDark);
  const favicon = mediaToUrl(s.favicon);
  if (logo !== undefined) backend.logo = logo;
  if (logoDark !== undefined) backend.logo_dark = logoDark;
  if (favicon !== undefined) backend.favicon = favicon;

  if (s.logoMediaId !== undefined) backend.logo_media_id = s.logoMediaId;
  if (s.logoDarkMediaId !== undefined) backend.logo_dark_media_id = s.logoDarkMediaId;
  if (s.faviconMediaId !== undefined) backend.favicon_media_id = s.faviconMediaId;
  if (s.supportEmail !== undefined) backend.support_email = s.supportEmail;
  if (s.supportPhone !== undefined) backend.support_phone = s.supportPhone;
  if (s.whatsapp !== undefined) backend.whatsapp = s.whatsapp;
  if (s.officeAddress !== undefined) backend.office_address = s.officeAddress;
  if (s.operatingHours !== undefined) backend.operating_hours = s.operatingHours; // FR-MKT01
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
  if (s.seoTitle !== undefined) backend.seo_title = s.seoTitle;
  if (s.seoDescription !== undefined) backend.seo_description = s.seoDescription;
  if (s.seoKeywords !== undefined) backend.seo_keywords = s.seoKeywords;
  return backend;
}

/** Build sparse PATCH payload — only keys that actually changed. */
export function buildWebsiteSettingPatch(
  original: Partial<WebsiteSetting> | null,
  next: Partial<WebsiteSetting>
): Partial<WebsiteSetting> {
  const keys: (keyof WebsiteSetting)[] = [
    'websiteName',
    'tagline',
    'logo',
    'logoDark',
    'favicon',
    'logoMediaId',
    'logoDarkMediaId',
    'faviconMediaId',
    'supportEmail',
    'supportPhone',
    'whatsapp',
    'officeAddress',
    'operatingHours',
    'googleMapsUrl',
    'facebook',
    'instagram',
    'tiktok',
    'youtube',
    'twitter',
    'copyright',
    'maintenanceMode',
    'timezone',
    'currency',
    'language',
    'seoTitle',
    'seoDescription',
    'seoKeywords',
  ];

  const patch: Partial<WebsiteSetting> = {};
  for (const key of keys) {
    if (next[key] === undefined) continue;
    const a =
      key === 'logo' || key === 'logoDark' || key === 'favicon'
        ? mediaToUrl(original?.[key])
        : (original?.[key] as any);
    const b =
      key === 'logo' || key === 'logoDark' || key === 'favicon'
        ? mediaToUrl(next[key])
        : (next[key] as any);
    if (a !== b) {
      (patch as any)[key] = next[key];
    }
  }
  return patch;
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
  if (s.subtitle !== undefined) backend.subtitle = s.subtitle;
  if (s.backgroundColor !== undefined) backend.background_color = s.backgroundColor;
  if (s.textColor !== undefined) backend.text_color = s.textColor;
  if (s.buttonLabel !== undefined) backend.button_label = s.buttonLabel;
  if (s.buttonUrl !== undefined) backend.button_url = s.buttonUrl;
  if (s.animation !== undefined) backend.animation = s.animation;
  if (s.contentItems !== undefined) backend.content_items = s.contentItems;
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

  async getDashboardAnnouncements(params?: Record<string, any>): Promise<ApiResponse<any>> {
    const res = await apiClient.get<ApiResponse<any>>('/announcements', { params });
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
    return this.patchSetting(id, setting);
  },

  /** Sparse PATCH — only send changed fields (Sprint 7.3 live sync). */
  async patchSetting(id: number, setting: Partial<WebsiteSetting>): Promise<WebsiteSetting> {
    const backendData = settingToBackend(setting);
    const res = await apiClient.patch<ApiResponse<WebsiteSetting>>(
      `/admin/website/settings/${id}`,
      backendData
    );
    return res.data.data;
  },

  async getCmsSyncStatus() {
    const res = await apiClient.get<ApiResponse<any>>('/public/cms-sync');
    return res.data;
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
  // HOMEPAGE BUILDER (Sprint 7.2)
  // ==========================================
  async getHomepageBuilder() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/website/homepage-builder', { timeout: 60000 });
    return res.data;
  },

  async saveHomepageBuilderDraft(sections: any[]) {
    const res = await apiClient.put<ApiResponse<any>>(
      '/admin/website/homepage-builder/draft',
      { sections },
      { timeout: 60000 }
    );
    return res.data;
  },

  async reorderHomepageBuilder(orderedIds: Array<string | number>) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/website/homepage-builder/reorder', { orderedIds });
    return res.data;
  },

  async discardHomepageBuilderDraft() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/website/homepage-builder/discard');
    return res.data;
  },

  async publishHomepageBuilder(label?: string) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/website/homepage-builder/publish', { label });
    return res.data;
  },

  async rollbackHomepageBuilder(versionId: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/website/homepage-builder/rollback/${versionId}`);
    return res.data;
  },

  async previewHomepageBuilder() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/website/homepage-builder/preview');
    return res.data;
  },

  // ==========================================
  // LEGAL CENTER (Sprint 7.3)
  // ==========================================
  async getPublicLegalIndex() {
    const res = await apiClient.get<ApiResponse<any>>('/public/legal');
    return res.data;
  },

  async getPublicLegalDocument(slug: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/public/legal/${slug}`);
    return res.data;
  },

  async getLegalCenter() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/website/legal-center', { timeout: 60000 });
    return res.data;
  },

  async getLegalDocument(slug: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/website/legal-center/${slug}`, { timeout: 60000 });
    return res.data;
  },

  async saveLegalDraft(slug: string, payload: Record<string, unknown>) {
    const res = await apiClient.put<ApiResponse<any>>(
      `/admin/website/legal-center/${slug}/draft`,
      payload,
      { timeout: 60000 }
    );
    return res.data;
  },

  async discardLegalDraft(slug: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/website/legal-center/${slug}/discard`);
    return res.data;
  },

  async publishLegal(slug: string, label?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/website/legal-center/${slug}/publish`, { label });
    return res.data;
  },

  async rollbackLegal(slug: string, versionId: number) {
    const res = await apiClient.post<ApiResponse<any>>(
      `/admin/website/legal-center/${slug}/rollback/${versionId}`
    );
    return res.data;
  },

  async previewLegal(slug: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/website/legal-center/${slug}/preview`);
    return res.data;
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
