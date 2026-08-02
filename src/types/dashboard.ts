export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
}

export interface WalletInfo {
  balance: number;
  points: number;
}

export interface BannerPromo {
  id: string;
  imageUrl: string;
  title: string;
  link: string;
}

export interface QuickMenuItem {
  id: string;
  title: string;
  icon: string;
  path: string;
}

export interface FinanceDashboardStats {
  totalRevenue: number;
  totalProfit: number;
  totalTransactions: number;
  totalUsers: number;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  profit: number;
}

export interface StatusSummary {
  status: string;
  count: number;
  amount: number;
}

export interface LatestPayment {
  id: string;
  date: string;
  amount: number;
  status: string;
  method: string;
}
export type PaymentRecord = LatestPayment;

export interface SettlementData {
  id: string;
  date: string;
  amount: number;
  status: string;
}

export interface RefundData {
  id: string;
  date: string;
  amount: number;
  status: string;
  reason: string;
}

export interface FinanceReportData {
  id: string;
  title: string;
  date: string;
  downloadUrl: string;
}

export interface ServiceStatusItem {
  name: string;
  status: string;
  uptime: string;
}

export interface ProviderStatusItem {
  id: string;
  name: string;
  status: string;
  balance: number;
}

export interface OperationLogItem {
  id: string;
  date: string;
  action: string;
  user: string;
  status?: string;
}

export interface OperationProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  totalSpent: number;
  transactionCount: number;
}

export interface SystemHealthItem {
  component: string;
  status: string;
  message: string;
}

export interface RecentActivity {
  id: string;
  date: string;
  description: string;
  type: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority?: string;
  createdAt: string;
  user: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
}

export interface CampaignPerformanceItem {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface PromoRedemptionItem {
  id: string;
  promoCode: string;
  user: string;
  date: string;
  amount: number;
}
