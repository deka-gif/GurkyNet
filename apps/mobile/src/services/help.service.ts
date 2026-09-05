import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/types';

/** FAQ item from GET /help (AccountContentController). */
export type HelpFaqItem = {
  id: number;
  question: string;
  answer: string;
};

/** GET /help payload — FAQ + Marketing contacts / hours. */
export type HelpCenterPayload = {
  faq: HelpFaqItem[];
  whatsapp: string | null;
  telegram: string | null;
  email: string | null;
  phone: string | null;
  operatingHours: string | null;
  contact: string | null;
};

export const helpService = {
  /** GET /help — authenticated Help Center (same as Web Account Help). */
  getHelpCenter: async (): Promise<HelpCenterPayload> => {
    const response = await apiClient.get<ApiResponse<HelpCenterPayload>>('/help');
    const raw = response.data.data;
    const faqRaw = Array.isArray(raw?.faq) ? raw.faq : [];
    return {
      faq: faqRaw.map((f) => ({
        id: Number(f.id),
        question: String(f.question ?? ''),
        answer: String(f.answer ?? ''),
      })),
      whatsapp: raw?.whatsapp ?? null,
      telegram: raw?.telegram ?? null,
      email: raw?.email ?? null,
      phone: raw?.phone ?? null,
      operatingHours: raw?.operatingHours ?? null,
      contact: raw?.contact ?? null,
    };
  },
};

/** Client-side FAQ filter (no server search API). */
export function filterHelpFaqs(items: HelpFaqItem[], query: string): HelpFaqItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (f) =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
  );
}

/** Client-side UI topic shortcuts — filters FAQ text; not a backend category. */
export type HelpTopicShortcut = {
  key: string;
  label: string;
  icon: 'wallet-outline' | 'receipt-outline' | 'shield-checkmark-outline' | 'swap-horizontal-outline' | 'help-circle-outline';
  keywords: string[];
};

const TOPIC_SHORTCUTS: HelpTopicShortcut[] = [
  {
    key: 'topup',
    label: 'Top Up Saldo',
    icon: 'wallet-outline',
    keywords: ['top up', 'topup', 'isi saldo', 'deposit', 'saldo'],
  },
  {
    key: 'transaksi',
    label: 'Transaksi',
    icon: 'receipt-outline',
    keywords: ['transaksi', 'pulsa', 'paket', 'gagal', 'berhasil', 'pembelian'],
  },
  {
    key: 'akun',
    label: 'Akun & Keamanan',
    icon: 'shield-checkmark-outline',
    keywords: ['akun', 'pin', 'password', 'keamanan', 'login', 'kyc'],
  },
  {
    key: 'transfer',
    label: 'Transfer & Tarik',
    icon: 'swap-horizontal-outline',
    keywords: ['transfer', 'tarik', 'withdraw', 'kirim saldo'],
  },
];

/**
 * Topics that match at least one FAQ (client-side only).
 * Empty FAQ set → empty topics (never invent backend categories).
 */
export function buildHelpTopicShortcuts(items: HelpFaqItem[]): HelpTopicShortcut[] {
  if (items.length === 0) return [];
  return TOPIC_SHORTCUTS.filter((topic) =>
    items.some((f) => {
      const hay = `${f.question} ${f.answer}`.toLowerCase();
      return topic.keywords.some((k) => hay.includes(k));
    })
  );
}

/** Primary search query string when a topic tile is tapped. */
export function topicSearchQuery(topic: HelpTopicShortcut): string {
  return topic.keywords[0] || topic.label;
}
