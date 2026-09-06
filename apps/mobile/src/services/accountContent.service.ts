import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/** GET /privacy | /terms static page payload. */
export type LegalPagePayload = {
  slug?: string;
  title: string;
  content: string;
  updatedAt?: string | null;
};

/** GET /about payload. */
export type AboutPagePayload = {
  title: string;
  content: string;
  appName?: string | null;
  version?: string | null;
  website?: string | null;
  email?: string | null;
};

/**
 * Account CMS content — mirrors Web accountContent.service
 * (GET /terms, /privacy, /about). Auth required on these routes.
 */
export const accountContentService = {
  getTerms: async (): Promise<ApiResponse<LegalPagePayload>> => {
    const response = await apiClient.get<ApiResponse<LegalPagePayload>>('/terms');
    return response.data;
  },

  getPrivacy: async (): Promise<ApiResponse<LegalPagePayload>> => {
    const response = await apiClient.get<ApiResponse<LegalPagePayload>>('/privacy');
    return response.data;
  },

  getAbout: async (): Promise<ApiResponse<AboutPagePayload>> => {
    const response = await apiClient.get<ApiResponse<AboutPagePayload>>('/about');
    return response.data;
  },
};

/** Strip HTML from CMS content for plain Text display (no WebView dependency). */
export function plainTextFromHtml(html: string): string {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
