import { create } from 'zustand';
import { notificationService } from '../services/notification/notification.service';
import { Notification } from '../types';
import { useTransactionStore } from './transaction.store';
import { useWalletStore } from './wallet.store';
import { enqueueNotificationToast } from '../utils/notificationToast';
import { CacheTTL, cachedFetch, getCachedStale } from '../utils/queryCache';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  lastFetchedAt: number | null;
  fetchNotifications: (opts?: { force?: boolean }) => Promise<void>;
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

function unwrapNotificationList(payload: unknown): Notification[] {
  const wrapped = payload && typeof payload === 'object' ? (payload as { data?: unknown; items?: unknown }) : null;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(wrapped?.data)
      ? wrapped.data
      : Array.isArray(wrapped?.items)
        ? wrapped.items
        : [];
  return list as Notification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,
  lastFetchedAt: null,

  fetchNotifications: async (opts) => {
    const force = Boolean(opts?.force);
    const stale = getCachedStale<Notification[]>('notifications:list');
    if (!force && stale?.fresh && get().notifications.length > 0) {
      return;
    }
    if (!force && stale && get().notifications.length === 0) {
      const unread = stale.data.filter((n: any) => !n.isRead && !n.is_read).length;
      set({
        notifications: stale.data,
        unreadCount: unread,
        loading: false,
        lastFetchedAt: Date.now(),
      });
      if (stale.fresh) return;
    }

    if (get().notifications.length === 0) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const list = await cachedFetch<Notification[]>({
        key: 'notifications:list',
        ttlMs: CacheTTL.NOTIFICATIONS,
        force,
        fetcher: async () => {
          const response = await notificationService.getNotifications();
          if (!response || response.success === false) {
            throw new Error(response?.message || 'Gagal memuat notifikasi.');
          }
          return unwrapNotificationList(response.data);
        },
      });

      const unread = list.filter((n: any) => !n.isRead && !n.is_read).length;
      const prevUnread = get().unreadCount;
      const hasSettlement = list.some(looksLikeSettlementNotification);

      set({
        notifications: list,
        unreadCount: unread,
        loading: false,
        lastFetchedAt: Date.now(),
      });

      for (const n of list) {
        enqueueNotificationToast(n as any);
      }

      if (hasSettlement || unread > prevUnread) {
        void useTransactionStore.getState().fetchTransactions();
        void useWalletStore.getState().fetchWallet();
      }
    } catch (err: any) {
      if (get().notifications.length === 0) {
        set({ error: err.message || 'Gagal memuat notifikasi.', loading: false });
      } else {
        set({ loading: false });
      }
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
