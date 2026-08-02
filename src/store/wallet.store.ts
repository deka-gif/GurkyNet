import { create } from 'zustand';
import { walletService } from '../services/wallet/wallet.service';
import { Wallet } from '../types';

interface WalletState {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  fetchWallet: () => Promise<void>;
  updateWallet: (data: Partial<Wallet>) => Promise<boolean>;
  topUp: (amount: number, paymentMethod: string) => Promise<any | null>;
  transfer: (recipient_wallet_number: string, amount: number, pin?: string) => Promise<any | null>;
  addBalance: (amount: number) => Promise<boolean>;
  deductBalance: (amount: number) => Promise<boolean>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  loading: false,
  error: null,

  fetchWallet: async () => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.getWallet();
      if (response.success && response.data) {
        set({ wallet: response.data, loading: false });
      } else {
        set({ error: response.message || 'Gagal memuat dompet.', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Terjadi kesalahan jaringan.', loading: false });
    }
  },

  updateWallet: async (data) => {
    const current = get().wallet;
    if (!current) return false;
    set({ loading: true, error: null });
    try {
      const response = await walletService.updateWallet(current.id, data);
      if (response.success) {
        set({ wallet: response.data, loading: false });
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

  addBalance: async (amount) => {
    await get().fetchWallet();
    return true;
  },

  deductBalance: async (amount) => {
    await get().fetchWallet();
    return true;
  },
}));
