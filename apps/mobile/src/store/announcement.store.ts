import { create } from 'zustand';
import { announcementService, Announcement } from '../services/announcement.service';

interface AnnouncementState {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  /** Fetch Marketing announcements (auth feed). Hide ticker on failure. */
  fetchAnnouncements: () => Promise<void>;
}

function unwrapList(response: {
  success?: boolean;
  data?: Announcement[] | { data?: Announcement[] };
}): Announcement[] {
  if (!response || response.success === false) return [];
  const raw = response.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray((raw as { data?: Announcement[] }).data)) {
    return (raw as { data: Announcement[] }).data;
  }
  return [];
}

/**
 * Home ticker source — same endpoint family as web dashboard marquee.
 * No dummy rows; empty list means hide ticker.
 */
export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  announcements: [],
  loading: false,
  error: null,

  fetchAnnouncements: async () => {
    set((s) => ({
      loading: s.announcements.length === 0,
      error: null,
    }));
    try {
      const response = await announcementService.getAnnouncements({ per_page: 20 });
      // Active rows with message body; ascending id so ID1 → ID2 matches CMS order.
      const rows = unwrapList(response)
        .filter((a) => a.isActive !== false)
        .filter((a) => (a.message || '').trim().length > 0)
        .slice()
        .sort((a, b) => Number(a.id) - Number(b.id));
      if (__DEV__) {
        // Safe count-only debug — no message bodies / PII.
        // eslint-disable-next-line no-console
        console.debug('[announcements] received', rows.length);
      }
      set({ announcements: rows, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat pengumuman.';
      set((s) => ({
        error: message,
        loading: false,
        announcements: s.announcements,
      }));
    }
  },
}));
