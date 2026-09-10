import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

export type NotificationPreferences = {
  notifyTransactions: boolean;
  notifyAnnouncements: boolean;
  notifyPromotions: boolean;
};

type ProfileLike = {
  notifyTransactions?: boolean;
  notify_transactions?: boolean;
  notifyAnnouncements?: boolean;
  notify_announcements?: boolean;
  notifyPromotions?: boolean;
  notify_promotions?: boolean;
};

function fromProfile(data: ProfileLike | null | undefined): NotificationPreferences {
  return {
    notifyTransactions: Boolean(data?.notifyTransactions ?? data?.notify_transactions ?? true),
    notifyAnnouncements: Boolean(data?.notifyAnnouncements ?? data?.notify_announcements ?? true),
    notifyPromotions: Boolean(data?.notifyPromotions ?? data?.notify_promotions ?? true),
  };
}

/**
 * Customer notification preferences — PUT /profile/notification-preference
 */
export const notificationPreferenceService = {
  fromProfile,

  update: async (prefs: Partial<{
    notify_transactions: boolean;
    notify_announcements: boolean;
    notify_promotions: boolean;
  }>): Promise<ApiResponse<ProfileLike>> => {
    const response = await apiClient.put<ApiResponse<ProfileLike>>(
      '/profile/notification-preference',
      prefs
    );
    return response.data;
  },
};
