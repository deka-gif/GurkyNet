import { create } from 'zustand';
import { filterHelpFaqs, helpService, type HelpCenterPayload, type HelpFaqItem } from '../services/help.service';
import { chatService } from '../services/chat.service';
import { parseApiError } from '../api/client';

type HelpState = {
  loading: boolean;
  error: string | null;
  faq: HelpFaqItem[];
  contacts: Omit<HelpCenterPayload, 'faq'> | null;
  searchQuery: string;
  unreadUser: number;
  fetchHelp: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  filteredFaq: () => HelpFaqItem[];
  refreshUnread: () => Promise<void>;
  getFaqById: (id: number) => HelpFaqItem | undefined;
};

export const useHelpStore = create<HelpState>((set, get) => ({
  loading: false,
  error: null,
  faq: [],
  contacts: null,
  searchQuery: '',
  unreadUser: 0,

  fetchHelp: async () => {
    set({ loading: true, error: null });
    try {
      const data = await helpService.getHelpCenter();
      set({
        faq: data.faq,
        contacts: {
          whatsapp: data.whatsapp,
          telegram: data.telegram,
          email: data.email,
          phone: data.phone,
          operatingHours: data.operatingHours,
          contact: data.contact,
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        loading: false,
        error: parsed.message || 'Gagal memuat bantuan.',
      });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  filteredFaq: () => filterHelpFaqs(get().faq, get().searchQuery),

  getFaqById: (id) => get().faq.find((f) => f.id === id),

  refreshUnread: async () => {
    try {
      const conv = await chatService.ensureConversation();
      set({ unreadUser: Number(conv.unreadUser) || 0 });
    } catch {
      /* badge is best-effort — do not surface error on Help tab load */
    }
  },
}));
