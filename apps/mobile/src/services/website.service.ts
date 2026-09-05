import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/** Minimal customer-facing fields from WebsiteSettingResource / GET /public/settings. */
export type WebsiteLogoValue = string | { url?: string | null } | null;

export interface PublicWebsiteSettings {
  websiteName?: string;
  logo?: WebsiteLogoValue;
  logoDark?: WebsiteLogoValue;
}

export const websiteService = {
  /** GET /public/settings — platform branding (logo GurkyNet) from Marketing CMS. */
  getPublicSettings: async (): Promise<ApiResponse<PublicWebsiteSettings>> => {
    const response = await apiClient.get<ApiResponse<PublicWebsiteSettings>>('/public/settings');
    return response.data;
  },
};
