import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient, API_BASE_URL } from '../api/client';
import { ApiResponse, Wallet } from '../api/types';
import { storageService } from './storage.service';
import { appEvents, AUTH_UNAUTHORIZED_EVENT } from '../utils/eventEmitter';

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

/** JSON statement — GET /wallet/statements/{YYYY-MM} (wallet_mutations SoT). */
export type WalletStatement = {
  period: {
    key: string;
    start: string;
    end: string;
    timezone: string;
  };
  currency: string;
  account: {
    name: string;
    gurky_pay_id: string;
  };
  opening_balance: number;
  income: number;
  expense: number;
  ending_balance: number;
  categories: Array<{ key: string; label: string; amount: number }>;
  mutations: Array<{
    id: number;
    occurred_at: string | null;
    ledger_type: string;
    direction: 'credit' | 'debit';
    amount: number;
    description: string;
    category_key: string;
    category_label?: string;
    reference_id: string | null;
    affects_balance: boolean;
  }>;
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

async function statementDownloadHeaders(): Promise<Record<string, string>> {
  const token = await storageService.getToken();
  return {
    Authorization: token ? `Bearer ${token}` : '',
    Accept: 'application/pdf',
    'X-Device-UUID': await storageService.getDeviceUuid(),
    'X-Platform': Platform.OS,
    'X-App-Version': Constants.expoConfig?.version ?? 'unknown',
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

  /**
   * GET /wallet/statements/{period} — monthly financial statement (mutations SoT).
   * period: YYYY-MM. Does not send user_id.
   */
  getStatement: async (period: string): Promise<WalletStatement> => {
    const response = await apiClient.get<ApiResponse<WalletStatement>>(
      `/wallet/statements/${encodeURIComponent(period)}`
    );
    return response.data.data as WalletStatement;
  },

  /**
   * GET /wallet/statements/{period}/pdf — binary PDF via authenticated download.
   * Writes to cache then returns local file URI for Sharing.
   */
  downloadStatementPdf: async (
    period: string
  ): Promise<{ uri: string; filename: string }> => {
    if (!API_BASE_URL) {
      throw { status: 'unknown', message: 'Konfigurasi API belum diset.' };
    }

    const filename = `GurkyPay-Laporan-Keuangan-${period}.pdf`;
    const target = `${FileSystem.cacheDirectory ?? ''}${filename}`;
    if (!FileSystem.cacheDirectory) {
      throw { status: 'unknown', message: 'Penyimpanan lokal tidak tersedia.' };
    }

    const url = `${API_BASE_URL}/wallet/statements/${encodeURIComponent(period)}/pdf`;
    const result = await FileSystem.downloadAsync(url, target, {
      headers: await statementDownloadHeaders(),
    });

    if (result.status === 401) {
      await storageService.clear();
      appEvents.emit(AUTH_UNAUTHORIZED_EVENT);
      throw { status: 401, message: 'Sesi telah berakhir.' };
    }

    if (result.status < 200 || result.status >= 300) {
      let message = 'Laporan gagal diunduh. Coba lagi.';
      try {
        const text = await FileSystem.readAsStringAsync(result.uri);
        const json = JSON.parse(text) as { message?: string };
        if (json?.message) message = String(json.message);
      } catch {
        /* keep default */
      }
      throw { status: result.status, message };
    }

    return { uri: result.uri, filename };
  },

  /** Share a local PDF URI via the native share sheet. */
  shareStatementPdf: async (uri: string, filename: string): Promise<void> => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw { status: 'unknown', message: 'Berbagi file tidak tersedia di perangkat ini.' };
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  },
};

/** Months with ledger activity — for Laporan Keuangan picker (newest first). */
export function monthsWithLedgerActivity(
  items: Array<{ created_at?: string }>
): { monthKey: string; label: string; year: number; monthIndex0: number }[] {
  const map = new Map<string, { year: number; monthIndex0: number }>();
  for (const row of items) {
    const raw = row.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, { year: d.getFullYear(), monthIndex0: d.getMonth() });
  }
  return Array.from(map.entries())
    .map(([monthKey, v]) => {
      const label = new Date(v.year, v.monthIndex0, 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
      return { monthKey, label, year: v.year, monthIndex0: v.monthIndex0 };
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
