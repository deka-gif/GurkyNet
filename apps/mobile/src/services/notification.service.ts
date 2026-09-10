import { apiClient } from '../api/client';
import { ApiResponse, PaginatedResponse } from '../api/types';

/**
 * Customer in-app notification — mirrors NotificationResource.
 * Categories: transaction | announcement | promotion
 */
export type NotificationCategory = 'transaction' | 'announcement' | 'promotion' | 'info';

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  /** Canonical category from backend (`transaction` | `announcement` | `promotion`). */
  type: string;
  category?: NotificationCategory | string;
  rawType?: string;
  isRead: boolean;
  createdAt?: string;
  transactionId?: string | null;
  invoiceNumber?: string | null;
  announcementId?: string | null;
  campaignId?: string | null;
  deepLink?: string | null;
  imageUrl?: string | null;
};

export const notificationService = {
  getNotifications: async (params?: {
    per_page?: number;
  }): Promise<PaginatedResponse<CustomerNotification> | ApiResponse<CustomerNotification[]>> => {
    const response = await apiClient.get<
      PaginatedResponse<CustomerNotification> | ApiResponse<CustomerNotification[]>
    >('/notifications', { params: { per_page: params?.per_page ?? 50 } });
    return response.data;
  },

  markAsRead: async (id: string): Promise<ApiResponse<CustomerNotification>> => {
    const response = await apiClient.put<ApiResponse<CustomerNotification>>(
      `/notifications/${id}/read`
    );
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.put<ApiResponse<null>>('/notifications/read-all');
    return response.data;
  },
};
