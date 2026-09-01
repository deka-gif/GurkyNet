import { create } from 'zustand';
import { walletService } from '../services/wallet/wallet.service';
import { Wallet, WalletOverviewSummary, WalletLedgerEntry } from '../types';
import { CacheTTL, cachedFetch, getCachedStale, invalidateCache } from '../utils/queryCache';
import { useAuthStore } from './auth.store';

interface WalletState {
  wallet: Wallet | null;
  summary: WalletOverviewSummary | null;
  history: WalletLedgerEntry[];
  loading: boolean;
  error: string | null;
  /** Sprint 11 — force=true bypasses 10-minute cache after settlement. */
  fetchWallet: (opts?: { force?: boolean }) => Promise<void>;
  /**
   * Authoritative balance sync after wallet mutations (purchase, refund, transfer).
   * Always bypasses cache and mirrors balance into auth.user.wallet for header consumers.
   */
  syncAuthoritativeBalance: () => Promise<void>;
  fetchHistory: (params?: Record<string, any>) => Promise<void>;
  updateWallet: (data: Partial<Wallet>) => Promise<boolean>;
  /** Apply balance from SSE balance_updated (notification only; then force-sync). */
  applyRealtimeBalance: (balance: number) => void;
  topUp: (amount: number, paymentMethod: string, idempotencyKey?: string, channel?: string | null) => Promise<any | null>;
  lastTopUpError: { code?: string; message: string } | null;
  transfer: (
    recipient_wallet_number: string,
    amount: number,
    pin: string,
    idempotencyKey?: string
  ) => Promise<any | null>;
  withdraw: (payload: {
    amount: number;
    pin: string;
    bank_name: string;
    account_number: string;
    admin_fee?: number;
    idempotencyKey?: string;
  }) => Promise<any | null>;
  depositManual: (amount: number, proof: File, notes?: string) => Promise<any | null>;
  addBalance: (amount: number) => Promise<boolean>;
  deductBalance: (amount: number) => Promise<boolean>;
}

function normalizeWallet(raw: any): Wallet | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: String(raw.id ?? ''),
    balance: Number(raw.balance ?? 0),
    walletNo: String(raw.walletNo ?? raw.wallet_id ?? raw.wallet_number ?? ''),
    points: Number(raw.points ?? raw.reward_points ?? 0),
    currency: String(raw.currency ?? 'IDR'),
    lastUpdated: String(raw.lastUpdated ?? raw.updated_at ?? ''),
    status: raw.status,
  };
}

function normalizeOverviewPayload(data: any): {
  wallet: Wallet | null;
  summary: WalletOverviewSummary | null;
  recent: WalletLedgerEntry[];
} {
  // New overview shape: { wallet, summary, recent_transactions }
  if (data?.wallet && data?.summary) {
    return {
      wallet: normalizeWallet(data.wallet),
      summary: {
        income_this_month: Number(data.summary.income_this_month ?? 0),
        expense_this_month: Number(data.summary.expense_this_month ?? 0),
        transaction_count: Number(data.summary.transaction_count ?? 0),
      },
      recent: Array.isArray(data.recent_transactions) ? data.recent_transactions : [],
    };
  }

  // Legacy flat wallet resource fallback
  return {
    wallet: normalizeWallet(data),
    summary: null,
    recent: [],
  };
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  summary: null,
  history: [],
  loading: false,
  error: null,
  lastTopUpError: null,

  fetchWallet: async (opts) => {
    const force = Boolean(opts?.force);
    if (force) {
      invalidateCache('wallet:overview');
    }

    const stale = getCachedStale<{
      wallet: Wallet | null;
      summary: WalletOverviewSummary | null;
      recent: WalletLedgerEntry[];
    }>('wallet:overview');

    // Sprint 11 — never skip network after settlement (force) or when cache is stale.
    if (!force && stale?.fresh && get().wallet) {
      return;
    }

    if (!force && stale && !get().wallet) {
      set({
        wallet: stale.data.wallet,
        summary: stale.data.summary,
        history: stale.data.recent.length > 0 ? stale.data.recent : get().history,
        loading: false,
      });
      if (stale.fresh) return;
    }

    if (!get().wallet) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const parsed = await cachedFetch({
        key: 'wallet:overview',
        ttlMs: CacheTTL.WALLET,
        fetcher: async () => {
          const response = await walletService.getWallet();
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Gagal memuat dompet.');
          }
          return normalizeOverviewPayload(response.data);
        },
      });
      set({
        wallet: parsed.wallet,
        summary: parsed.summary,
        history: parsed.recent.length > 0 ? parsed.recent : get().history,
        loading: false,
      });
    } catch (err: any) {
      if (!get().wallet) {
        set({ error: err.message || 'Terjadi kesalahan jaringan.', loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  applyRealtimeBalance: (balance) => {
    const current = get().wallet;
    if (!current) return;
    invalidateCache('wallet:overview');
    const next = Number(balance);
    set({
      wallet: { ...current, balance: next },
    });
    const user = useAuthStore.getState().user;
    if (user?.wallet) {
      useAuthStore.getState().patchUser({
        wallet: { ...user.wallet, balance: next },
      });
    }
  },

  syncAuthoritativeBalance: async () => {
    invalidateCache('wallet:overview');
    await get().fetchWallet({ force: true });
    const w = get().wallet;
    const user = useAuthStore.getState().user;
    if (w && user) {
      useAuthStore.getState().patchUser({
        wallet: {
          ...(user.wallet || {}),
          id: user.wallet?.id ?? w.id,
          balance: w.balance,
          walletNo: user.wallet?.walletNo ?? w.walletNo,
          currency: user.wallet?.currency ?? w.currency,
        },
      });
    }
  },

  fetchHistory: async (params) => {
    try {
      const response = await walletService.getHistory(params);
      if (response && response.success !== false) {
        const rows = Array.isArray(response.data)
          ? response.data
          : (response.data?.data || response.data?.history || []);
        set({ history: Array.isArray(rows) ? rows : [] });
      }
    } catch {
      set({ history: [] });
    }
  },

  updateWallet: async (data) => {
    const current = get().wallet;
    if (!current) return false;
    set({ loading: true, error: null });
    try {
      const response = await walletService.updateWallet(current.id, data);
      if (response.success) {
        const parsed = normalizeOverviewPayload(response.data);
        set({
          wallet: parsed.wallet ?? { ...current, ...data },
          summary: parsed.summary ?? get().summary,
          loading: false,
        });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memperbarui dompet.', loading: false });
      return false;
    }
  },

  topUp: async (amount, paymentMethod, idempotencyKey, channel) => {
    set({ loading: true, error: null, lastTopUpError: null });
    try {
      const response = await walletService.topUp(amount, paymentMethod, idempotencyKey, channel);
      if (response.success && response.data) {
        set({ loading: false });
        return response.data;
      } else {
        const payload = {
          code: (response as any).code as string | undefined,
          message: response.message || 'Gagal melakukan top up.',
        };
        set({ error: payload.message, lastTopUpError: payload, loading: false });
        return { __error: true, ...payload };
      }
    } catch (err: any) {
      const payload = {
        code: err?.code as string | undefined,
        message: err?.message || 'Gagal melakukan top up.',
      };
      set({ error: payload.message, lastTopUpError: payload, loading: false });
      return { __error: true, ...payload };
    }
  },

  transfer: async (recipient_wallet_number, amount, pin, idempotencyKey) => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.transfer(recipient_wallet_number, amount, pin, idempotencyKey);
      if (response.success && response.data) {
        set({ loading: false });
        await get().syncAuthoritativeBalance();
        return response.data;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal melakukan transfer.', loading: false });
      return null;
    }
  },

  withdraw: async ({ idempotencyKey, ...payload }) => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.withdraw({ ...payload, idempotency_key: idempotencyKey });
      if (response.success && response.data) {
        set({ loading: false });
        await get().syncAuthoritativeBalance();
        return response.data;
      }
      set({ error: response.message, loading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message || 'Gagal melakukan penarikan.', loading: false });
      return null;
    }
  },

  depositManual: async (amount, proof, notes) => {
    set({ loading: true, error: null });
    try {
      const form = new FormData();
      form.append('amount', String(amount));
      form.append('proof', proof);
      if (notes) form.append('notes', notes);
      const response = await walletService.depositManual(form);
      if (response.success) {
        set({ loading: false });
        return response.data;
      }
      set({ error: response.message, loading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message || 'Gagal mengajukan deposit manual.', loading: false });
      return null;
    }
  },

  addBalance: async (_amount: number) => {
    await get().syncAuthoritativeBalance();
    return true;
  },

  deductBalance: async (_amount: number) => {
    await get().syncAuthoritativeBalance();
    return true;
  },
}));
