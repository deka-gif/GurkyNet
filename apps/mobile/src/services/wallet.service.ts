import { apiClient } from '../api/client';
import { ApiResponse, Wallet } from '../api/types';

/**
 * A row from `wallet.recent_transactions` (GET /wallet) — this is a ledger entry from
 * `wallet_histories` (WalletSummaryService::mapHistoryRow on the backend), NOT a PPOB
 * `Transaction`. It never has a target number or product — only a credit/debit amount
 * and, when it happens to reference a purchase/top-up, that transaction's invoice/name.
 */
export interface WalletMutation {
  id: number | string;
  wallet_id: number | string;
  amount: number;
  type: 'credit' | 'debit';
  direction: 'credit' | 'debit';
  description: string | null;
  reference_id: number | string | null;
  invoice_number?: string | null;
  service_name?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WalletOverview {
  wallet: Wallet & { id: number; reward_points?: number; points?: number; currency?: string; lastUpdated?: string };
  summary: {
    income_this_month: number;
    expense_this_month: number;
    transaction_count: number;
  };
  recent_transactions: WalletMutation[];
}

export const walletService = {
  /** GET /wallet — balance is always read from here, never computed client-side (spec section 7/18). */
  getOverview: async (): Promise<ApiResponse<WalletOverview>> => {
    const response = await apiClient.get<ApiResponse<WalletOverview>>('/wallet');
    return response.data;
  },
};
