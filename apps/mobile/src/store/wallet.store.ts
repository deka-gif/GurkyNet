import { create } from 'zustand';
import {
  walletService,
  WalletMutation,
  WalletOverview,
  WalletHistoryPagination,
} from '../services/wallet.service';

export type WalletDirectionFilter = 'all' | 'credit' | 'debit';

interface WalletState {
  overview: WalletOverview | null;
  /** @deprecated alias — Home/checkout use `loading`; mirrors overviewLoading. */
  loading: boolean;
  overviewLoading: boolean;
  /** @deprecated alias — mirrors overviewError. */
  error: string | null;
  overviewError: string | null;

  ledger: WalletMutation[];
  ledgerPagination: WalletHistoryPagination | null;
  ledgerLoading: boolean;
  ledgerLoadingMore: boolean;
  ledgerError: string | null;
  directionFilter: WalletDirectionFilter;

  fetchWallet: () => Promise<void>;
  setDirectionFilter: (f: WalletDirectionFilter) => void;
  refreshLedger: () => Promise<void>;
  loadMoreLedger: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const LEDGER_PER_PAGE = 15;

/**
 * Wallet store — mirrors GET /wallet + GET /wallet/history only.
 * Never computes balance from ledger or from Riwayat (purchase history).
 */
export const useWalletStore = create<WalletState>((set, get) => ({
  overview: null,
  loading: false,
  overviewLoading: false,
  error: null,
  overviewError: null,

  ledger: [],
  ledgerPagination: null,
  ledgerLoading: false,
  ledgerLoadingMore: false,
  ledgerError: null,
  directionFilter: 'all',

  fetchWallet: async () => {
    set({ loading: true, overviewLoading: true, error: null, overviewError: null });
    try {
      const response = await walletService.getOverview();
      if (response.success) {
        set({
          overview: response.data,
          loading: false,
          overviewLoading: false,
        });
      } else {
        set({
          error: response.message,
          overviewError: response.message,
          loading: false,
          overviewLoading: false,
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Gagal memuat saldo.';
      set({ error: msg, overviewError: msg, loading: false, overviewLoading: false });
    }
  },

  setDirectionFilter: (f) => {
    set({ directionFilter: f });
    void get().refreshLedger();
  },

  refreshLedger: async () => {
    set({ ledgerLoading: true, ledgerError: null });
    try {
      const { directionFilter } = get();
      const result = await walletService.getHistory({
        type: directionFilter === 'all' ? undefined : directionFilter,
        page: 1,
        per_page: LEDGER_PER_PAGE,
      });
      set({
        ledger: result.items,
        ledgerPagination: result.pagination,
        ledgerLoading: false,
        ledgerError: null,
      });
    } catch (err: any) {
      set({
        ledgerLoading: false,
        ledgerError: err?.message || 'Gagal memuat aktivitas uang.',
      });
    }
  },

  loadMoreLedger: async () => {
    const { ledgerPagination, ledgerLoading, ledgerLoadingMore, ledger, directionFilter } = get();
    if (ledgerLoading || ledgerLoadingMore || !ledgerPagination) return;
    if (ledgerPagination.currentPage >= ledgerPagination.lastPage) return;

    set({ ledgerLoadingMore: true });
    try {
      const next = ledgerPagination.currentPage + 1;
      const result = await walletService.getHistory({
        type: directionFilter === 'all' ? undefined : directionFilter,
        page: next,
        per_page: LEDGER_PER_PAGE,
      });
      const seen = new Set(ledger.map((r) => String(r.id)));
      const merged = [...ledger];
      for (const row of result.items) {
        if (!seen.has(String(row.id))) merged.push(row);
      }
      set({
        ledger: merged,
        ledgerPagination: result.pagination,
        ledgerLoadingMore: false,
      });
    } catch {
      set({ ledgerLoadingMore: false });
    }
  },

  refreshAll: async () => {
    await Promise.all([get().fetchWallet(), get().refreshLedger()]);
  },
}));
