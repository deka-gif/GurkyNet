import { create } from 'zustand';
import {
  walletService,
  WalletMutation,
  WalletOverview,
  WalletHistoryPagination,
} from '../services/wallet.service';
import { currentMonthBounds } from '../utils/walletExpenseCategory';
import { fetchAllWalletHistoryPages } from '../utils/fetchAllWalletHistoryPages';

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

  /**
   * Full current-month ledger (credit + debit) for Cashflow + Pengeluaran.
   * Loaded via GET /wallet/history?start_date&end_date — all pages to last_page.
   */
  monthLedger: WalletMutation[];
  monthLedgerLoading: boolean;
  monthLedgerError: string | null;
  /** True only when every page through last_page was fetched successfully. */
  monthLedgerComplete: boolean;
  monthLabel: string;
  /** YYYY-MM — same period as Financial Tracker / monthLedger. */
  monthKey: string;

  fetchWallet: () => Promise<void>;
  setDirectionFilter: (f: WalletDirectionFilter) => void;
  refreshLedger: () => Promise<void>;
  loadMoreLedger: () => Promise<void>;
  refreshMonthLedger: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const LEDGER_PER_PAGE = 15;
const MONTH_PAGE_SIZE = 100;

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

  monthLedger: [],
  monthLedgerLoading: false,
  monthLedgerError: null,
  monthLedgerComplete: false,
  monthLabel: currentMonthBounds().label,
  monthKey: currentMonthBounds().monthKey,

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
      const { startDate, endDate, label, monthKey } = currentMonthBounds();
      const result = await walletService.getHistory({
        type: directionFilter === 'all' ? undefined : directionFilter,
        start_date: startDate,
        end_date: endDate,
        page: 1,
        per_page: LEDGER_PER_PAGE,
      });
      set({
        ledger: result.items,
        ledgerPagination: result.pagination,
        ledgerLoading: false,
        ledgerError: null,
        monthLabel: label,
        monthKey,
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
      const { startDate, endDate } = currentMonthBounds();
      const next = ledgerPagination.currentPage + 1;
      const result = await walletService.getHistory({
        type: directionFilter === 'all' ? undefined : directionFilter,
        start_date: startDate,
        end_date: endDate,
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

  refreshMonthLedger: async () => {
    set({
      monthLedgerLoading: true,
      monthLedgerError: null,
      monthLedgerComplete: false,
    });
    try {
      const { startDate, endDate, label, monthKey } = currentMonthBounds();
      const { items } = await fetchAllWalletHistoryPages(
        (filters) => walletService.getHistory(filters),
        {
          start_date: startDate,
          end_date: endDate,
          per_page: MONTH_PAGE_SIZE,
        }
      );

      set({
        monthLedger: items,
        monthLedgerLoading: false,
        monthLedgerError: null,
        monthLedgerComplete: true,
        monthLabel: label,
        monthKey,
      });
    } catch (err: any) {
      set({
        monthLedger: [],
        monthLedgerLoading: false,
        monthLedgerComplete: false,
        monthLedgerError: err?.message || 'Gagal memuat data Financial Tracker bulan ini.',
      });
    }
  },

  refreshAll: async () => {
    await Promise.all([
      get().fetchWallet(),
      get().refreshLedger(),
      get().refreshMonthLedger(),
    ]);
  },
}));
