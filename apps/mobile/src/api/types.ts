/**
 * Mirrors the relevant subset of src/types/index.ts on web — same field names, so a
 * developer moving between the two codebases isn't relearning a shape. Not a build-time
 * shared package (see MOBILE_APP_AUDIT_REPORT.md's stack-decision note); kept in sync by
 * hand for now since it's a handful of interfaces, revisit if this list grows a lot.
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  code?: string;
  meta?: unknown;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface Wallet {
  walletNo?: string;
  wallet_number?: string;
  balance: number;
  status?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  isVerified: boolean;
  hasPin?: boolean;
  notifyTransactions?: boolean;
  createdAt?: string;
  kycStatus?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  userType?: string;
  wallet?: Wallet | null;
}

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded';

export interface Transaction {
  id: string;
  transactionCode: string;
  serviceName: string;
  productName?: string;
  targetNo: string;
  amount: number;
  adminFee: number;
  totalPayment: number;
  paymentMethod: string;
  status: TransactionStatus;
  notes?: string | null;
  date?: string;
  createdAt?: string;
  lastUpdated?: string;
}
