import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/types';
import type { Ionicons } from '@expo/vector-icons';
import type { HelpFaqItem } from './help.cekWilayah';

export type { HelpFaqItem } from './help.cekWilayah';
export {
  CEK_WILAYAH_FAQ_PREFIX,
  isCekWilayahFaq,
  customerFacingFaqs,
  cekWilayahFaqTitle,
  findCekWilayahFaq,
  parseCekWilayahAnswer,
} from './help.cekWilayah';

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

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Fixed Bantuan Populer tiles (Owner-approved v1).
 * No longer gated by FAQ keyword match — always 4 cards, even if CMS FAQ empty.
 */
export type HelpPopularTile = {
  key: string;
  label: string;
  icon: IconName;
  highlight?: boolean;
} & (
  | { action: 'search'; searchQuery: string }
  | { action: 'cek-zona' }
);

export const FIXED_HELP_POPULAR: HelpPopularTile[] = [
  {
    key: 'topup',
    label: 'Top up saldo',
    icon: 'wallet-outline',
    action: 'search',
    searchQuery: 'top up',
  },
  {
    key: 'transaksi',
    label: 'Transaksi',
    icon: 'receipt-outline',
    action: 'search',
    searchQuery: 'transaksi',
  },
  {
    key: 'transfer',
    label: 'Transfer & Tarik',
    icon: 'swap-horizontal-outline',
    action: 'search',
    searchQuery: 'transfer',
  },
  {
    key: 'cek-zona',
    label: 'Cek wilayah kartu',
    icon: 'map-outline',
    action: 'cek-zona',
    highlight: true,
  },
];

/** Local-only FAQ rows (not in CMS). Opens in-app article routes. */
export const LOCAL_HELP_FAQS = [
  {
    id: 'local-voucher-zona',
    question: 'Kenapa voucher internet saya tidak aktif setelah dibeli?',
    href: '/help/cek-zona' as const,
    searchText:
      'voucher internet tidak aktif zona wilayah kartu telkomsel indosat xl axis tri smartfren',
  },
];

/** @deprecated Prefer FIXED_HELP_POPULAR — kept for reference / any leftover imports. */
export type HelpTopicShortcut = {
  key: string;
  label: string;
  icon: IconName;
  keywords: string[];
};

/** @deprecated Dynamic FAQ-gated topics — superseded by FIXED_HELP_POPULAR. */
export function buildHelpTopicShortcuts(items: HelpFaqItem[]): HelpTopicShortcut[] {
  if (items.length === 0) return [];
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
  return TOPIC_SHORTCUTS.filter((topic) =>
    items.some((f) => {
      const hay = `${f.question} ${f.answer}`.toLowerCase();
      return topic.keywords.some((k) => hay.includes(k));
    })
  );
}

/** @deprecated */
export function topicSearchQuery(topic: HelpTopicShortcut): string {
  return topic.keywords[0] || topic.label;
}
