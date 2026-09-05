import { create } from 'zustand';
import { Product } from '../services/catalog.service';
import { Transaction, TransactionStatus } from '../api/types';
import { createIdempotencyKey } from '../utils/idempotency';

/**
 * Transient checkout state only. This store NEVER holds the PIN — the PIN lives
 * exclusively in the PIN screen's local component state and is cleared the instant
 * the POST /transactions request settles (success or failure). It also never holds
 * price/balance — those are always read fresh from the catalog/wallet stores or the
 * transaction response itself, never computed or cached here.
 */
interface CheckoutState {
  skuCode: string | null;
  targetNumber: string;
  idempotencyKey: string | null;
  submitting: boolean;
  transaction: Transaction | null;
  status: TransactionStatus | 'idle';
  error: string | null;

  /**
   * Entry point when navigating from Product Detail's "Beli Sekarang". Remount-safe:
   * if this exact product's attempt is already in progress (same skuCode, a key
   * already exists), it does nothing — the idempotency key and any in-flight/terminal
   * state are left untouched. Only initializes a genuinely fresh attempt (idle, or a
   * different product than whatever was tracked before).
   */
  startCheckout: (product: Product) => void;
  setTarget: (target: string) => void;
  setSubmitting: (submitting: boolean) => void;
  setTransaction: (transaction: Transaction | null) => void;
  setStatus: (status: TransactionStatus | 'idle') => void;
  setError: (error: string | null) => void;
  /** Resets to idle. Only ever called from an explicit "start over" user action —
   * never on a network error or timeout, which must preserve the idempotency key. */
  resetCheckout: () => void;
  /** User-facing "Mulai Pembelian Baru" action. Same effect as resetCheckout() today
   * (no product is known yet at that point — the user goes back to pick one), kept as
   * a distinct named action so the one deliberate reset path in the UI is explicit
   * about intent rather than reusing the generic primitive by coincidence. */
  startNewPurchase: () => void;

  // Rotate idempotency key – used only after a confirmed wrong PIN error.
  rotateIdempotencyKey: () => void;
}

const IDLE_STATE = {
  skuCode: null as string | null,
  targetNumber: '',
  idempotencyKey: null as string | null,
  submitting: false,
  transaction: null as Transaction | null,
  status: 'idle' as TransactionStatus | 'idle',
  error: null as string | null,
};

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  ...IDLE_STATE,

  startCheckout: (product) => {
    const state = get();
    if (state.skuCode === product.code && state.idempotencyKey) {
      // Resuming the same attempt after a remount/re-render/navigation — never
      // rotate the key or clear in-flight/terminal state here.
      return;
    }
    set({
      ...IDLE_STATE,
      skuCode: product.code,
      idempotencyKey: createIdempotencyKey(),
    });
  },

  setTarget: (target) => set({ targetNumber: target }),
  setSubmitting: (submitting) => set({ submitting }),
  setTransaction: (transaction) => set({ transaction }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  resetCheckout: () => set({ ...IDLE_STATE }),

  startNewPurchase: () => {
    get().resetCheckout();
  },

  // Rotate idempotency key – used only after a confirmed wrong PIN error.
  rotateIdempotencyKey: () => {
    set({ idempotencyKey: createIdempotencyKey() });
  },
}));
