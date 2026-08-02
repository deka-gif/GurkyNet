export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Super Admin' | 'Finance Admin' | 'Product Admin' | 'User';
  permissions: string[];
  isVerified: boolean;
  walletBalance: number;
  walletNo: string;
  points: number;
  createdAt: string;
}

export interface AdminProduct {
  id: string;
  skuCode: string;
  name: string;
  category: string;
  provider: string;
  price: number;
  margin: number; // percentage or flat
  status: 'tersedia' | 'gangguan';
}

export interface AdminTransaction {
  id: string;
  transactionCode: string;
  serviceName: string;
  productName: string;
  targetNo: string;
  amount: number;
  date: string;
  status: 'sukses' | 'pending' | 'gagal';
  note?: string;
  correlationId: string;
  requestId: string;
}

export interface WalletLedger {
  id: string;
  userId: string;
  userName: string;
  type: 'credit' | 'debit';
  action: 'topup' | 'adjustment' | 'refund' | 'purchase';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  date: string;
  note: string;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  correlationId: string;
  requestId: string;
  event: string;
  description: string;
  date: string;
}

export interface SystemSettings {
  digiflazzUsername: string;
  digiflazzApiKey: string;
  digiflazzProductionMode: boolean;
  midtransClientKey: string;
  midtransServerKey: string;
  midtransSandboxMode: boolean;
  marginGlobal: number;
  maintenanceMode: boolean;
  featureFlags: {
    otpRequest: boolean;
    autoRefund: boolean;
    manualRetry: boolean;
    multiWallet: boolean;
  };
}
