import { AdminUser, AdminProduct, AdminTransaction, WalletLedger, AuditLogEntry, SystemSettings } from './types';

// Helper to generate IDs
export const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substring(2, 9)}`;

// Initial Data
export const initialUsers: AdminUser[] = [
  {
    id: 'usr_1',
    name: 'Ahmad Faisal (Super Admin)',
    email: 'ahmad.faisal@gurkypay.com',
    phone: '081234567890',
    role: 'Super Admin',
    permissions: ['manage_users', 'manage_products', 'manage_transactions', 'manage_wallet', 'manage_settings', 'view_audit_logs'],
    isVerified: true,
    walletBalance: 12500000,
    walletNo: 'GP1000001',
    points: 4500,
    createdAt: '2026-01-15T08:30:00Z',
  },
  {
    id: 'usr_2',
    name: 'Siti Aminah (Finance)',
    email: 'siti.aminah@gurkypay.com',
    phone: '085712345678',
    role: 'Finance Admin',
    permissions: ['manage_transactions', 'manage_wallet', 'view_audit_logs'],
    isVerified: true,
    walletBalance: 4200000,
    walletNo: 'GP1000002',
    points: 1200,
    createdAt: '2026-02-10T11:20:00Z',
  },
  {
    id: 'usr_3',
    name: 'Budi Santoso',
    email: 'budi.santoso@gmail.com',
    phone: '081398765432',
    role: 'User',
    permissions: [],
    isVerified: true,
    walletBalance: 450000,
    walletNo: 'GP1000003',
    points: 350,
    createdAt: '2026-03-01T14:45:00Z',
  },
  {
    id: 'usr_4',
    name: 'Dewi Lestari',
    email: 'dewi.lestari@yahoo.com',
    phone: '087811223344',
    role: 'User',
    permissions: [],
    isVerified: false,
    walletBalance: 0,
    walletNo: 'GP1000004',
    points: 0,
    createdAt: '2026-05-12T09:15:00Z',
  },
  {
    id: 'usr_5',
    name: 'Rian Hidayat',
    email: 'rian.hidayat@outlook.com',
    phone: '082155667788',
    role: 'User',
    permissions: [],
    isVerified: true,
    walletBalance: 125000,
    walletNo: 'GP1000005',
    points: 95,
    createdAt: '2026-06-20T16:10:00Z',
  }
];

export const initialProducts: AdminProduct[] = [
  { id: 'prd_1', skuCode: 'tsel5', name: 'Telkomsel Pulsa 5.000', category: 'pulsa', provider: 'Telkomsel', price: 5300, margin: 200, status: 'tersedia' },
  { id: 'prd_2', skuCode: 'tsel10', name: 'Telkomsel Pulsa 10.000', category: 'pulsa', provider: 'Telkomsel', price: 10250, margin: 250, status: 'tersedia' },
  { id: 'prd_3', skuCode: 'isat10', name: 'Indosat Pulsa 10.000', category: 'pulsa', provider: 'Indosat Ooredoo', price: 10100, margin: 300, status: 'tersedia' },
  { id: 'prd_4', skuCode: 'isat_data5', name: 'Indosat Freedom 5GB 30D', category: 'data', provider: 'Indosat Ooredoo', price: 47500, margin: 2500, status: 'tersedia' },
  { id: 'prd_5', skuCode: 'pln20', name: 'Token PLN 20.000', category: 'pln', provider: 'PLN', price: 20000, margin: 500, status: 'tersedia' },
  { id: 'prd_6', skuCode: 'pln50', name: 'Token PLN 50.000', category: 'pln', provider: 'PLN', price: 50000, margin: 1000, status: 'tersedia' },
  { id: 'prd_7', skuCode: 'gopay10', name: 'GoPay Top Up 10.000', category: 'ewallet', provider: 'GoPay', price: 10500, margin: 500, status: 'tersedia' },
  { id: 'prd_8', skuCode: 'shopee10', name: 'ShopeePay 10.000', category: 'ewallet', provider: 'ShopeePay', price: 10600, margin: 400, status: 'gangguan' }
];

export const initialTransactions: AdminTransaction[] = [
  {
    id: 'tx_1',
    transactionCode: 'GP-TX-20260730-001',
    serviceName: 'Pulsa',
    productName: 'Telkomsel Pulsa 10.000',
    targetNo: '081234567890',
    amount: 10500,
    date: '2026-07-30T10:15:00Z',
    status: 'sukses',
    note: 'Transaksi berhasil diselesaikan oleh provider.',
    correlationId: 'corr-t-sel-872f-a2e1',
    requestId: 'req-ts-782a-bc91'
  },
  {
    id: 'tx_2',
    transactionCode: 'GP-TX-20260730-002',
    serviceName: 'Token PLN',
    productName: 'Token PLN 50.000',
    targetNo: '14102938475',
    amount: 51000,
    date: '2026-07-30T11:42:00Z',
    status: 'sukses',
    note: 'Token PLN: 1827-3948-2018-3849-2918',
    correlationId: 'corr-pln-127b-09ef',
    requestId: 'req-pln-776a-fe21'
  },
  {
    id: 'tx_3',
    transactionCode: 'GP-TX-20260730-003',
    serviceName: 'E-Wallet',
    productName: 'ShopeePay 10.000',
    targetNo: '085712345678',
    amount: 11000,
    date: '2026-07-30T13:05:00Z',
    status: 'gagal',
    note: 'Provider ShopeePay sedang gangguan.',
    correlationId: 'corr-shopee-831e-42ef',
    requestId: 'req-sp-908d-8812'
  },
  {
    id: 'tx_4',
    transactionCode: 'GP-TX-20260730-004',
    serviceName: 'Paket Data',
    productName: 'Indosat Freedom 5GB 30D',
    targetNo: '081398765432',
    amount: 50000,
    date: '2026-07-30T14:12:00Z',
    status: 'pending',
    note: 'Menunggu konfirmasi status dari Digiflazz.',
    correlationId: 'corr-isat-0982-f67c',
    requestId: 'req-isat-554c-aa01'
  }
];

export const initialLedger: WalletLedger[] = [
  {
    id: 'ld_1',
    userId: 'usr_3',
    userName: 'Budi Santoso',
    type: 'credit',
    action: 'topup',
    amount: 500000,
    balanceBefore: 0,
    balanceAfter: 500000,
    date: '2026-07-29T09:00:00Z',
    note: 'Top Up Manual disetujui oleh Admin Siti Aminah'
  },
  {
    id: 'ld_2',
    userId: 'usr_3',
    userName: 'Budi Santoso',
    type: 'debit',
    action: 'purchase',
    amount: 50000,
    balanceBefore: 500000,
    balanceAfter: 450000,
    date: '2026-07-30T14:12:00Z',
    note: 'Pembelian Indosat Freedom 5GB 30D'
  }
];

export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'log_1',
    user: 'ahmad.faisal@gurkypay.com',
    correlationId: 'corr-sys-8371-ff2a',
    requestId: 'req-sys-a128-449e',
    event: 'ADMIN_LOGIN',
    description: 'Ahmad Faisal berhasil masuk ke panel Admin CMS dari IP 192.168.1.52.',
    date: '2026-07-30T08:15:00Z'
  },
  {
    id: 'log_2',
    user: 'ahmad.faisal@gurkypay.com',
    correlationId: 'corr-sys-9912-7bb3',
    requestId: 'req-sys-c331-552d',
    event: 'PRODUCT_STATUS_UPDATE',
    description: 'Status produk ShopeePay 10.000 (shopee10) diubah menjadi gangguan.',
    date: '2026-07-30T08:30:00Z'
  },
  {
    id: 'log_3',
    user: 'siti.aminah@gurkypay.com',
    correlationId: 'corr-sys-1011-88fc',
    requestId: 'req-sys-e918-09aa',
    event: 'WALLET_TOPUP_MANUAL',
    description: 'Top up manual disetujui untuk user Budi Santoso (usr_3) sebesar Rp 500.000.',
    date: '2026-07-29T09:00:00Z'
  }
];

export const initialSettings: SystemSettings = {
  digiflazzUsername: 'gurkypay_dev',
  digiflazzApiKey: 'df_live_92039a82bbef77c1d30f',
  digiflazzProductionMode: false,
  midtransClientKey: 'SB-Mid-client-u2389ab3',
  midtransServerKey: 'SB-Mid-server-y19208a38b',
  midtransSandboxMode: true,
  marginGlobal: 2.5,
  maintenanceMode: false,
  featureFlags: {
    otpRequest: true,
    autoRefund: true,
    manualRetry: true,
    multiWallet: false
  }
};

// LocalStorage helpers to simulate persistence
export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(`admin_cms_${key}`);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(`admin_cms_${key}`, JSON.stringify(data));
  } catch {
    // Save storage error handled
  }
};
