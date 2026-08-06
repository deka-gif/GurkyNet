// Type Declarations for GurkyNet Service Architecture
// Preparing for Laravel API integration

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  isVerified: boolean;
  hasPin?: boolean;
  createdAt?: string;
  wallet?: {
    walletNo?: string;
    wallet_number?: string;
    balance?: number;
    status?: string;
  } | null;
}

export interface Wallet {
  id: string;
  balance: number;
  walletNo: string;
  points: number;
  currency: string;
  lastUpdated: string;
  status?: string;
}

export interface Banner {
  id: string;
  title: string;
  description: string;
  image: string;
  promoCode?: string;
  validUntil?: string;
  isActive: boolean;
  redirectUrl?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  category: 'pulsa' | 'data' | 'pln' | 'ewallet' | 'voucher' | 'game' | 'transfer' | 'tagihan';
  operatorName: string;
  status: 'tersedia' | 'gangguan';
  isActive?: boolean;
}

export interface Transaction {
  id: string;
  transactionCode: string;
  invoice_number?: string;
  serviceName: string;
  productName: string;
  targetNo: string;
  amount: number;
  date: string;
  status: 'sukses' | 'success' | 'pending' | 'gagal' | 'failed' | 'cancelled';
  note?: string;
  notes?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'promo' | 'transaksi';
  isRead: boolean;
  createdAt: string;
}

export interface Profile {
  id?: string | number;
  name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  avatar?: string | null;
  hasPin?: boolean;
  has_pin?: boolean;
  pinUpdatedAt?: string | null;
  wallet?: User['wallet'];
  user?: User;
  kycStatus?: 'unverified' | 'pending' | 'verified';
  whatsappLinked?: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}

export interface Pagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
  errors?: Record<string, string[]>;
}

export * from './website';
export * from './media';

export * from './dashboard';

