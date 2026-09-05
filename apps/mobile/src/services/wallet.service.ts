import { apiClient } from '../api/client';
import { ApiResponse, Wallet } from '../api/types';

/**
 * Ledger row — money movement only (wallet_histories).
 * From GET /wallet `recent_transactions` (enriched) or GET /wallet/history (raw model).
 * NOT a PPOB purchase Transaction (that belongs in Riwayat).
 */
export interface WalletMutation {
  id: number | string;
  wallet_id: number | string;
  amount: number;
  type: 'credit' | 'debit';
  direction: 'credit' | 'debit';
  description: string | null;
  reference_id: number | string | null;
  /** Present on GET /wallet enrichment when reference links to a Transaction. */
  invoice_number?: string | null;
  service_name?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WalletOverview {
  wallet: Wallet & {
    id: number;
    reward_points?: number;
    points?: number;
    currency?: string;
    lastUpdated?: string;
    /** Unified GurkyPay account number (YYYY3128NNN) = wallet_number. */
    gurkyPayId?: string | null;
    gurky_pay_id?: string | null;
    wallet_number?: string | null;
  };
  summary: {
    /** Backend: SUM(credit) for current calendar month. */
    income_this_month: number;
    /** Backend: SUM(debit) for current calendar month. */
    expense_this_month: number;
    transaction_count: number;
  };
  recent_transactions: WalletMutation[];
}

export type WalletHistoryFilters = {
  type?: 'credit' | 'debit';
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
};

export type WalletHistoryPagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};

export type WalletHistoryResult = {
  items: WalletMutation[];
  pagination: WalletHistoryPagination;
};

function normalizeMutation(row: any): WalletMutation {
  const typeRaw = String(row?.type || row?.direction || '').toLowerCase();
  const isCredit = typeRaw.includes('credit');
  return {
    id: row?.id,
    wallet_id: row?.wallet_id ?? row?.walletId,
    amount: Number(row?.amount ?? 0),
    type: isCredit ? 'credit' : 'debit',
    direction: isCredit ? 'credit' : 'debit',
    description: row?.description ?? null,
    reference_id: row?.reference_id ?? row?.referenceId ?? null,
    invoice_number: row?.invoice_number ?? row?.invoiceNumber ?? null,
    service_name: row?.service_name ?? row?.serviceName ?? null,
    status: row?.status ?? null,
    created_at: String(row?.created_at || row?.createdAt || ''),
    updated_at: row?.updated_at || row?.updatedAt,
  };
}

function unwrapPagination(body: any): WalletHistoryPagination {
  const p = body?.pagination || body?.meta?.pagination || {};
  return {
    currentPage: Number(p.currentPage ?? p.current_page ?? 1),
    lastPage: Number(p.lastPage ?? p.last_page ?? 1),
    perPage: Number(p.perPage ?? p.per_page ?? 10),
    total: Number(p.total ?? 0),
  };
}

export const walletService = {
  /** GET /wallet — authoritative balance + monthly summary + recent ledger snapshot. */
  getOverview: async (): Promise<ApiResponse<WalletOverview>> => {
    const response = await apiClient.get<ApiResponse<WalletOverview>>('/wallet');
    return response.data;
  },

  /**
   * GET /wallet/history — paginated ledger (WalletHistoryRepository).
   * Filters: type=credit|debit, start_date, end_date, per_page, page.
   * Raw rows (no service_name join) — money movement fields only.
   */
  getHistory: async (filters: WalletHistoryFilters = {}): Promise<WalletHistoryResult> => {
    const response = await apiClient.get<ApiResponse<any[]> & { pagination?: any; meta?: any }>(
      '/wallet/history',
      { params: filters }
    );
    const body = response.data as any;
    const raw = Array.isArray(body?.data) ? body.data : [];
    return {
      items: raw.map(normalizeMutation),
      pagination: unwrapPagination(body),
    };
  },
};
