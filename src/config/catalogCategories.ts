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
  Briefcase,
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
      { key: 'bpjs-kesehatan', label: 'BPJS Kesehatan', path: '/dashboard/tagihan/bpjs-kesehatan', icon: Heart },
      { key: 'bpjs-tk', label: 'BPJS TK', path: '/dashboard/tagihan/bpjs-tk', icon: Briefcase },
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
    path: '#all-services',
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
