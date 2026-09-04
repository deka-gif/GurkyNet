import { create } from 'zustand';
import { walletService, WalletOverview } from '../services/wallet.service';

interface WalletState {
  overview: WalletOverview | null;
  loading: boolean;
  error: string | null;
  fetchWallet: () => Promise<void>;
}

/** Backend is the sole source of truth for balance — this store only ever mirrors
 * whatever GET /wallet last returned, never computes or adjusts balance locally
 * (spec sections 7, 18: "Jangan menggunakan saldo lokal sebagai sumber kebenaran"). */
export const useWalletStore = create<WalletState>((set) => ({
  overview: null,
  loading: false,
  error: null,

  fetchWallet: async () => {
    set({ loading: true, error: null });
    try {
      const response = await walletService.getOverview();
      if (response.success) {
        set({ overview: response.data, loading: false });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Gagal memuat saldo.', loading: false });
    }
  },
}));
