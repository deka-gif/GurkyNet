import type { LucideIcon } from 'lucide-react';
import {
  Smartphone,
  FileText,
  CreditCard,
  Gamepad2,
  Gift,
  PlayCircle,
  Globe,
  Send,
  LayoutGrid,
  Wifi,
  Zap,
  MessageSquare,
  Clock,
  Nfc,
  Droplets,
  Heart,
  Tv,
  Flame,
  Home,
  Car,
  Landmark,
  Receipt,
} from 'lucide-react';
import { routeForProductCategory } from '../utils/catalogRoutes';

export { routeForProductCategory };
export type CategoryBadge = 'Baru' | 'Promo' | null;

export type CatalogHubChild = {
  key: string;
  label: string;
  description?: string;
  path: string;
  productCategory?: string;
  icon: LucideIcon;
};

export type DashboardServiceCategory = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for icon tile */
  tone: string;
  path: string;
  /** API `category` query when browsing SKUs */
  productCategory?: string;
  badge?: CategoryBadge;
  /** hub = children list; products = SKU list; navigate = go straight to path */
  mode: 'hub' | 'products' | 'navigate';
  hubChildren?: CatalogHubChild[];
};

export type CategoryToneStyle = { bg: string; gradient: string; shadow: string };

/** Jewel-tone palette: kartu latar pastel + badge gradasi kaya per kategori (disetujui Owner). */
export const CATEGORY_TONES: Record<string, CategoryToneStyle> = {
  telco: { bg: 'bg-primary-50', gradient: 'bg-gradient-to-br from-primary-500 to-primary-700', shadow: 'shadow-primary-700/30' },
  transfer: { bg: 'bg-primary-50', gradient: 'bg-gradient-to-br from-primary-500 to-primary-700', shadow: 'shadow-primary-700/30' },
  tagihan: { bg: 'bg-indigo-50', gradient: 'bg-gradient-to-br from-indigo-400 to-indigo-600', shadow: 'shadow-indigo-600/30' },
  'topup-digital': { bg: 'bg-emerald-50', gradient: 'bg-gradient-to-br from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-600/30' },
  game: { bg: 'bg-violet-50', gradient: 'bg-gradient-to-br from-violet-400 to-violet-600', shadow: 'shadow-violet-600/30' },
  voucher: { bg: 'bg-accent-300/25', gradient: 'bg-gradient-to-br from-accent-400 to-accent-600', shadow: 'shadow-accent-600/30' },
  langganan: { bg: 'bg-rose-50', gradient: 'bg-gradient-to-br from-rose-400 to-rose-600', shadow: 'shadow-rose-600/30' },
  international: { bg: 'bg-sky-50', gradient: 'bg-gradient-to-br from-sky-400 to-sky-600', shadow: 'shadow-sky-600/30' },
  all: { bg: 'bg-slate-100', gradient: 'bg-gradient-to-br from-primary-700 to-primary-900', shadow: 'shadow-primary-900/30' },
};

export function categoryTone(id: string): CategoryToneStyle {
  return CATEGORY_TONES[id] ?? CATEGORY_TONES.telco;
}

/** Which real ProductCategory slugs live under each of the 7 customer-facing hubs — used by the
 *  Marketing Logo Brand admin page to group brands the same way the customer nav is grouped. */
export const HUB_CATEGORY_SLUGS: Record<string, string[]> = {
  telco: ['pulsa', 'data', 'voucher-internet', 'sms-telepon', 'masa-aktif', 'aktivasi-perdana', 'esim'],
  tagihan: ['pln', 'pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk', 'internet-pascabayar', 'tv-pascabayar', 'gas', 'pbb', 'samsat', 'multifinance', 'tagihan'],
  'topup-digital': ['topup-digital'],
  game: ['game'],
  voucher: ['voucher-digital'],
  langganan: ['langganan-digital'],
  international: ['international'],
};

export const DASHBOARD_SERVICE_CATEGORIES: DashboardServiceCategory[] = [
  {
    id: 'telco',
    label: 'Telekomunikasi',
    description: 'Pulsa, data, eSIM & lainnya',
    icon: Smartphone,
    tone: 'bg-blue-50 text-blue-600 border-blue-100',
    path: '/dashboard/telekomunikasi',
    badge: 'Promo',
    mode: 'hub',
    hubChildren: [
      { key: 'pulsa', label: 'Pulsa', description: 'Semua operator', path: '/dashboard/pulsa', productCategory: 'pulsa', icon: Smartphone },
      { key: 'data', label: 'Paket Data', description: 'Kuota internet', path: '/dashboard/paket-data', productCategory: 'data', icon: Wifi },
      { key: 'voucher-internet', label: 'Voucher Internet', path: '/dashboard/voucher-internet', productCategory: 'voucher-internet', icon: Wifi },
      { key: 'sms-telepon', label: 'SMS & Telepon', path: '/dashboard/telekomunikasi/sms-telepon', icon: MessageSquare },
      { key: 'masa-aktif', label: 'Masa Aktif', path: '/dashboard/telekomunikasi/masa-aktif', icon: Clock },
      { key: 'aktivasi-perdana', label: 'Aktivasi Perdana', path: '/dashboard/telekomunikasi/aktivasi-perdana', icon: Nfc },
      { key: 'esim', label: 'eSIM', path: '/dashboard/telekomunikasi/esim', icon: Nfc },
    ],
  },
  {
    id: 'tagihan',
    label: 'Tagihan',
    description: 'PLN, PDAM, BPJS & lainnya',
    icon: FileText,
    tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    path: '/dashboard/tagihan',
    mode: 'hub',
    hubChildren: [
      { key: 'pln', label: 'Token PLN', path: '/dashboard/token-pln', productCategory: 'pln', icon: Zap },
      { key: 'pln-pascabayar', label: 'PLN Pascabayar', path: '/dashboard/tagihan/pln-pascabayar', icon: Zap },
      { key: 'pdam', label: 'PDAM', path: '/dashboard/tagihan/pdam', icon: Droplets },
      { key: 'bpjs', label: 'BPJS', path: '/dashboard/tagihan/bpjs', icon: Heart },
      { key: 'internet', label: 'Internet', path: '/dashboard/tagihan/internet', icon: Wifi },
      { key: 'tv', label: 'TV Pascabayar', path: '/dashboard/tagihan/tv', icon: Tv },
      { key: 'gas', label: 'Gas Negara', path: '/dashboard/tagihan/gas', icon: Flame },
      { key: 'pbb', label: 'PBB', path: '/dashboard/tagihan/pbb', icon: Home },
      { key: 'samsat', label: 'SAMSAT', path: '/dashboard/tagihan/samsat', icon: Car },
      { key: 'multifinance', label: 'Multifinance', path: '/dashboard/tagihan/multifinance', icon: Landmark },
      { key: 'lainnya', label: 'Tagihan Lainnya', path: '/dashboard/tagihan/lainnya', icon: Receipt },
    ],
  },
  {
    id: 'topup-digital',
    label: 'E-Wallet',
    description: 'e-Wallet & dompet digital',
    icon: CreditCard,
    tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    path: '/dashboard/topup-digital',
    productCategory: 'topup-digital',
    mode: 'products',
  },
  {
    id: 'game',
    label: 'Game',
    description: 'Diamond & voucher game',
    icon: Gamepad2,
    tone: 'bg-purple-50 text-purple-600 border-purple-100',
    path: '/dashboard/game',
    productCategory: 'game',
    badge: 'Baru',
    mode: 'products',
  },
  {
    id: 'voucher',
    label: 'Voucher Digital',
    description: 'Voucher belanja & hiburan',
    icon: Gift,
    tone: 'bg-rose-50 text-rose-600 border-rose-100',
    path: '/dashboard/voucher-digital',
    productCategory: 'voucher-digital',
    mode: 'products',
  },
  {
    id: 'langganan',
    label: 'Langganan',
    description: 'Streaming & membership',
    icon: PlayCircle,
    tone: 'bg-orange-50 text-orange-600 border-orange-100',
    path: '/dashboard/langganan-digital',
    productCategory: 'langganan-digital',
    mode: 'products',
  },
  {
    id: 'international',
    label: 'International',
    description: 'Top up luar negeri',
    icon: Globe,
    tone: 'bg-sky-50 text-sky-600 border-sky-100',
    path: '/dashboard/international',
    productCategory: 'international',
    mode: 'products',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    description: 'Kirim saldo sesama user',
    icon: Send,
    tone: 'bg-teal-50 text-teal-600 border-teal-100',
    path: '/dashboard/transfer',
    mode: 'navigate',
  },
  {
    id: 'all',
    label: 'Semua Produk',
    description: 'Jelajahi seluruh layanan',
    icon: LayoutGrid,
    tone: 'bg-primary-50 text-primary-600 border-primary-100',
    path: '/dashboard/semua-produk',
    mode: 'hub',
    hubChildren: [
      { key: 'pulsa', label: 'Pulsa', path: '/dashboard/pulsa', productCategory: 'pulsa', icon: Smartphone },
      { key: 'data', label: 'Paket Data', path: '/dashboard/paket-data', productCategory: 'data', icon: Wifi },
      { key: 'pln', label: 'Token PLN', path: '/dashboard/token-pln', productCategory: 'pln', icon: Zap },
      { key: 'topup-digital', label: 'E-Wallet', path: '/dashboard/topup-digital', productCategory: 'topup-digital', icon: CreditCard },
      { key: 'game', label: 'Game', path: '/dashboard/game', productCategory: 'game', icon: Gamepad2 },
      { key: 'voucher', label: 'Voucher', path: '/dashboard/voucher-digital', productCategory: 'voucher-digital', icon: Gift },
      { key: 'voucher-internet', label: 'Voucher Internet', path: '/dashboard/voucher-internet', productCategory: 'voucher-internet', icon: Wifi },
      { key: 'langganan', label: 'Langganan', path: '/dashboard/langganan-digital', productCategory: 'langganan-digital', icon: PlayCircle },
      { key: 'international', label: 'International', path: '/dashboard/international', productCategory: 'international', icon: Globe },
      { key: 'transfer', label: 'Transfer', path: '/dashboard/transfer', icon: Send },
      { key: 'tagihan', label: 'Tagihan', path: '/dashboard/tagihan', icon: FileText },
    ],
  },
];

/** Categories used for product-count prefetch (SKU-backed only). */
export const PRODUCT_COUNT_CATEGORY_KEYS = [
  'pulsa',
  'data',
  'pln',
  'topup-digital',
  'game',
  'voucher-digital',
  'langganan-digital',
  'international',
  'voucher-internet',
] as const;
