import { apiClient } from '../api/client';
import { ApiResponse, PaginatedResponse } from '../api/types';

/**
 * Customer announcement shape from AnnouncementResource
 * (laravel/app/Http/Resources/AnnouncementResource.php).
 * Same feed as web DashboardHomePage via GET /announcements (auth).
 */
export interface Announcement {
  id: number | string;
  title: string;
  message?: string;
  type?: string;
  isActive?: boolean;
  createdAt?: string;
}

export const announcementService = {
  /**
   * GET /announcements — active announcement + broadcast for logged-in users.
   * Mirrors web `websiteService.getDashboardAnnouncements`.
   */
  getAnnouncements: async (params?: {
    per_page?: number;
  }): Promise<PaginatedResponse<Announcement> | ApiResponse<Announcement[]>> => {
    const response = await apiClient.get<PaginatedResponse<Announcement> | ApiResponse<Announcement[]>>(
      '/announcements',
      { params: { per_page: params?.per_page ?? 20 } }
    );
    return response.data;
  },
};
