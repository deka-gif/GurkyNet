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
  createdAt?: string;
}

export interface Wallet {
  id: string;
  balance: number;
  walletNo: string;
  points: number;
  currency: string;
  lastUpdated: string;
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
  status: 'sukses' | 'success' | 'pending' | 'gagal';
  note?: string;
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
  user: User;
  kycStatus: 'unverified' | 'pending' | 'verified';
  whatsappLinked: boolean;
  twoFactorEnabled: boolean;
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

