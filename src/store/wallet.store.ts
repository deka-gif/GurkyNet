import { create } from 'zustand';
import { walletService } from '../services/wallet/wallet.service';
import { Wallet, WalletOverviewSummary, WalletLedgerEntry } from '../types';

interface WalletState {
  wallet: Wallet | null;
  summary: WalletOverviewSummary | null;
  history: WalletLedgerEntry[];
  loading: boolean;
  error: string | null;
  fetchWallet: () => Promise<void>;
  fetchHistory: (params?: Record<string, any>) => Promise<void>;
  updateWallet: (data: Partial<Wallet>) => Promise<boolean>;
  topUp: (amount: number, paymentMethod: string) => Promise<any | null>;
  transfer: (recipient_wallet_number: string, amount: number, pin: string) => Promise<any | null>;
  withdraw: (payload: {
    amount: number;
    pin: string;
    bank_name: string;
    account_number: string;
    admin_fee?: number;
  }) => Promise<any | null>;
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

  fetchWallet: async () => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.getWallet();
      if (response.success && response.data) {
        const parsed = normalizeOverviewPayload(response.data);
        set({
          wallet: parsed.wallet,
          summary: parsed.summary,
          history: parsed.recent.length > 0 ? parsed.recent : get().history,
          loading: false,
        });
      } else {
        set({ error: response.message || 'Gagal memuat dompet.', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Terjadi kesalahan jaringan.', loading: false });
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

  topUp: async (amount, paymentMethod) => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.topUp(amount, paymentMethod);
      if (response.success && response.data) {
        set({ loading: false });
        return response.data;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal melakukan top up.', loading: false });
      return null;
    }
  },

  transfer: async (recipient_wallet_number, amount, pin) => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.transfer(recipient_wallet_number, amount, pin);
      if (response.success && response.data) {
        set({ loading: false });
        await get().fetchWallet();
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

  withdraw: async (payload) => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.withdraw(payload);
      if (response.success && response.data) {
        set({ loading: false });
        await get().fetchWallet();
        return response.data;
      }
      set({ error: response.message, loading: false });
      return null;
    } catch (err: any) {
      set({ error: err.message || 'Gagal melakukan penarikan.', loading: false });
      return null;
    }
  },

  addBalance: async (_amount: number) => {
    await get().fetchWallet();
    return true;
  },

  deductBalance: async (_amount: number) => {
    await get().fetchWallet();
    return true;
  },
}));
