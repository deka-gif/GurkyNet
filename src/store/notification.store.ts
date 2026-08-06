import { create } from 'zustand';
import { notificationService } from '../services/notification/notification.service';
import { Notification } from '../types';
import { useTransactionStore } from './transaction.store';
import { useWalletStore } from './wallet.store';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

function looksLikeSettlementNotification(n: any): boolean {
  const title = String(n?.title || '').toLowerCase();
  const type = String(n?.type || '').toLowerCase();
  return (
    title.includes('pembayaran berhasil') ||
    title.includes('transaksi berhasil') ||
    title.includes('transaksi gagal') ||
    title.includes('transaksi timeout') ||
    type.includes('transaction_success') ||
    type.includes('transaction_failed') ||
    type.includes('transaction_timeout')
  );
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
      if (response && response.success !== false) {
        const raw: unknown = response.data;
        const wrapped = raw && typeof raw === 'object' ? (raw as { data?: unknown; items?: unknown }) : null;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(wrapped?.data)
            ? wrapped.data
            : Array.isArray(wrapped?.items)
              ? wrapped.items
              : [];
        const unread = list.filter((n: any) => !n.isRead && !n.is_read).length;
        const prevUnread = get().unreadCount;
        const hasSettlement = list.some(looksLikeSettlementNotification);

        set({
          notifications: list,
          unreadCount: unread,
          loading: false,
        });

        // Notifications and History must stay on the same source of truth.
        // When settlement notifications arrive (or unread increases), refresh transactions + wallet.
        if (hasSettlement || unread > prevUnread) {
          void useTransactionStore.getState().fetchTransactions();
          void useWalletStore.getState().fetchWallet();
        }
      } else {
        set({ error: response?.message || 'Gagal memuat notifikasi.', loading: false });
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
