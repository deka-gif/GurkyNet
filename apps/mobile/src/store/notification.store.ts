import { create } from 'zustand';
import {
  notificationService,
  type CustomerNotification,
  type NotificationCategory,
} from '../services/notification.service';
import { parseApiError } from '../api/client';

export type InboxFilter = 'all' | 'transaction' | 'announcement' | 'promotion';

type NotificationState = {
  notifications: CustomerNotification[];
  loading: boolean;
  error: string | null;
  /** Derived from loaded list — no dedicated unread-count API yet. */
  unreadCount: number;
  filter: InboxFilter;
  setFilter: (filter: InboxFilter) => void;
  fetchNotifications: (opts?: { force?: boolean }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Clear inbox when user logs out / switches account. */
  reset: () => void;
};

function unwrapList(payload: unknown): CustomerNotification[] {
  if (Array.isArray(payload)) return payload as CustomerNotification[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as { data?: unknown; items?: unknown };
  if (Array.isArray(obj.data)) return obj.data as CustomerNotification[];
  if (Array.isArray(obj.items)) return obj.items as CustomerNotification[];
  return [];
}

function resolveCategory(row: CustomerNotification): NotificationCategory {
  const raw = String(row.category || row.type || row.rawType || '')
    .trim()
    .toLowerCase();
  if (
    raw === 'transaction' ||
    raw === 'transaksi' ||
    raw.includes('transaction') ||
    raw === 'success' ||
    raw === 'failed' ||
    raw === 'timeout'
  ) {
    return 'transaction';
  }
  if (raw === 'promotion' || raw === 'promo' || raw === 'broadcast') {
    return 'promotion';
  }
  if (raw === 'announcement' || raw === 'info' || raw === 'informasi' || raw === 'maintenance') {
    return 'announcement';
  }
  if (row.transactionId || row.invoiceNumber) return 'transaction';
  if (row.campaignId) return 'promotion';
  return 'announcement';
}

function normalize(row: CustomerNotification): CustomerNotification {
  const category = resolveCategory(row);
  return {
    ...row,
    id: String(row.id),
    title: row.title || '',
    message: row.message || '',
    type: category,
    category,
    isRead: Boolean(
      (row as { isRead?: boolean; is_read?: boolean }).isRead ??
        (row as { is_read?: boolean }).is_read
    ),
    createdAt:
      row.createdAt ||
      (row as { created_at?: string }).created_at ||
      undefined,
    transactionId:
      row.transactionId != null
        ? String(row.transactionId)
        : (row as { transaction_id?: string | null }).transaction_id != null
          ? String((row as { transaction_id?: string | null }).transaction_id)
          : null,
    invoiceNumber:
      row.invoiceNumber != null
        ? String(row.invoiceNumber)
        : (row as { invoice_number?: string | null }).invoice_number != null
          ? String((row as { invoice_number?: string | null }).invoice_number)
          : null,
    announcementId:
      row.announcementId != null
        ? String(row.announcementId)
        : (row as { announcement_id?: string | null }).announcement_id != null
          ? String((row as { announcement_id?: string | null }).announcement_id)
          : null,
    campaignId:
      row.campaignId != null
        ? String(row.campaignId)
        : (row as { campaign_id?: string | null }).campaign_id != null
          ? String((row as { campaign_id?: string | null }).campaign_id)
          : null,
    deepLink:
      row.deepLink != null
        ? String(row.deepLink)
        : (row as { deep_link?: string | null }).deep_link != null
          ? String((row as { deep_link?: string | null }).deep_link)
          : null,
    imageUrl:
      row.imageUrl != null
        ? String(row.imageUrl)
        : (row as { image_url?: string | null }).image_url != null
          ? String((row as { image_url?: string | null }).image_url)
          : null,
  };
}

function countUnread(list: CustomerNotification[]): number {
  return list.filter((n) => !n.isRead).length;
}

function isCustomerFacingNotification(n: CustomerNotification): boolean {
  const title = String(n.title || '').trim().toLowerCase();
  const rawType = String(n.rawType || n.type || '').trim().toLowerCase();

  if (
    title === 'transaksi dibuat' ||
    title === 'transaksi diproses' ||
    title === 'saldo berkurang' ||
    title === 'saldo bertambah' ||
    title === 'refund berhasil' ||
    title === 'status pembayaran belum dapat dikonfirmasi' ||
    title === 'transaksi timeout'
  ) {
    return false;
  }

  if (
    rawType === 'transaction_success' ||
    rawType === 'transaction_failed' ||
    rawType === 'transaction_timeout' ||
    rawType === 'transaction' ||
    rawType === 'announcement' ||
    rawType === 'promotion' ||
    rawType === 'promo' ||
    rawType === 'broadcast' ||
    rawType === 'info'
  ) {
    return true;
  }

  return Boolean(n.transactionId || n.invoiceNumber || n.announcementId || n.campaignId || title);
}

/**
 * In-app notification inbox — poll-based (same contract as web).
 * Backend writes SUCCESS/FAILED/EXPIRED via SendNotification; mobile only consumes.
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,
  filter: 'all',

  setFilter: (filter) => set({ filter }),

  fetchNotifications: async (opts) => {
    const force = Boolean(opts?.force);
    if (!force && get().loading) return;

    set((s) => ({
      loading: s.notifications.length === 0,
      error: null,
    }));

    try {
      const response = await notificationService.getNotifications({ per_page: 50 });
      if (!response || response.success === false) {
        throw new Error(response?.message || 'Gagal memuat notifikasi.');
      }
      const list = unwrapList(response.data).map(normalize).filter(isCustomerFacingNotification);
      set({
        notifications: list,
        unreadCount: countUnread(list),
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = parseApiError(err).message || 'Gagal memuat notifikasi.';
      set((s) => ({
        loading: false,
        error: s.notifications.length === 0 ? message : null,
      }));
    }
  },

  markAsRead: async (id) => {
    const prev = get().notifications;
    const optimistic = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    set({ notifications: optimistic, unreadCount: countUnread(optimistic) });
    try {
      const response = await notificationService.markAsRead(id);
      if (response.success === false) {
        set({ notifications: prev, unreadCount: countUnread(prev) });
      }
    } catch {
      set({ notifications: prev, unreadCount: countUnread(prev) });
    }
  },

  markAllAsRead: async () => {
    const prev = get().notifications;
    const optimistic = prev.map((n) => ({ ...n, isRead: true }));
    set({ notifications: optimistic, unreadCount: 0 });
    try {
      const response = await notificationService.markAllAsRead();
      if (response.success === false) {
        set({ notifications: prev, unreadCount: countUnread(prev) });
      }
    } catch {
      set({ notifications: prev, unreadCount: countUnread(prev) });
    }
  },

  reset: () =>
    set({
      notifications: [],
      loading: false,
      error: null,
      unreadCount: 0,
      filter: 'all',
    }),
}));

export function selectFilteredNotifications(
  notifications: CustomerNotification[],
  filter: InboxFilter
): CustomerNotification[] {
  if (filter === 'all') return notifications;
  return notifications.filter((n) => (n.category || n.type) === filter);
}
