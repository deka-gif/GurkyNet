import { create } from 'zustand';
import { notificationService } from '../services/notification/notification.service';
import { Notification } from '../types';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,

  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const response = await notificationService.getNotifications();
      if (response.success) {
        const unread = response.data.filter((n) => !n.isRead).length;
        set({
          notifications: response.data,
          unreadCount: unread,
          loading: false,
        });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memuat notifikasi.', loading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      const response = await notificationService.markAsRead(id);
      if (response.success) {
        const updated = get().notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        const unread = updated.filter((n) => !n.isRead).length;
        set({
          notifications: updated,
          unreadCount: unread,
        });
      }
    } catch {
      // Failed silently
    }
  },

  markAllAsRead: async () => {
    set({ loading: true });
    try {
      const response = await notificationService.markAllAsRead();
      if (response.success) {
        const updated = get().notifications.map((n) => ({ ...n, isRead: true }));
        set({
          notifications: updated,
          unreadCount: 0,
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
