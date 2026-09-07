import { create } from 'zustand';
import { Product } from '../services/catalog.service';
import { PlnInquiryResult } from '../services/pln.service';
import { GameInquiryResult } from '../services/game.service';
import { Transaction, TransactionStatus } from '../api/types';
import { createIdempotencyKey } from '../utils/idempotency';

/**
 * Transient checkout state only. PIN never lives here.
 *
 * PLN prepaid: plnInquiry + plnInquiredMeter + plnInquiryExpiresAt are UI/session
 * mirrors of backend PlnInquiryService (keyed by user + customer_no). They are NOT
 * sent as inquiry_ref_id — POST /transactions only uses target_number = customer_no.
 *
 * Game: gameContext mirrors GameInquiryService session the same way (no inquiry_ref_id).
 */

export type PlnCheckoutContext = {
  inquiry: PlnInquiryResult;
  /** Meter/ID the user typed when inquiry succeeded (may differ from customer_no). */
  inquiredMeter: string;
  /** Absolute expiry timestamp (ms) from inquiry.expires_in_seconds. */
  expiresAt: number;
};

export type GameCheckoutContext = {
  inquiry: GameInquiryResult;
  brand: string;
  /** Absolute expiry timestamp (ms) from inquiry.expires_in_seconds. */
  expiresAt: number;
};

/** Web VoucherInternetPage mode — UX only; not a product-type classifier. */
export type VoucherInternetMode = 'tembak' | 'elektronik';

interface CheckoutState {
  skuCode: string | null;
  categorySlug: string | null;
  targetNumber: string;
  operatorLabel: string | null;
  selectedRegion: string | null;
  plnContext: PlnCheckoutContext | null;
  gameContext: GameCheckoutContext | null;
  /** Set by Voucher Internet flows; null for other categories. */
  voucherInternetMode: VoucherInternetMode | null;
  idempotencyKey: string | null;
  submitting: boolean;
  transaction: Transaction | null;
  status: TransactionStatus | 'idle';
  error: string | null;

  startCheckout: (product: Product) => void;
  setTarget: (target: string) => void;
  setPurchaseContext: (ctx: {
    operatorLabel?: string | null;
    selectedRegion?: string | null;
    plnContext?: PlnCheckoutContext | null;
    gameContext?: GameCheckoutContext | null;
    voucherInternetMode?: VoucherInternetMode | null;
  }) => void;
  clearPlnContext: () => void;
  clearGameContext: () => void;
  setSubmitting: (submitting: boolean) => void;
  setTransaction: (transaction: Transaction | null) => void;
  setStatus: (status: TransactionStatus | 'idle') => void;
  setError: (error: string | null) => void;
  resetCheckout: () => void;
  startNewPurchase: () => void;
  rotateIdempotencyKey: () => void;
}

const IDLE_STATE = {
  skuCode: null as string | null,
  categorySlug: null as string | null,
  targetNumber: '',
  operatorLabel: null as string | null,
  selectedRegion: null as string | null,
  plnContext: null as PlnCheckoutContext | null,
  gameContext: null as GameCheckoutContext | null,
  voucherInternetMode: null as VoucherInternetMode | null,
  idempotencyKey: null as string | null,
  submitting: false,
  transaction: null as Transaction | null,
  status: 'idle' as TransactionStatus | 'idle',
  error: null as string | null,
};

/** True when PLN inquiry context is present, matches target, and not client-expired. */
export function isPlnContextValid(ctx: PlnCheckoutContext | null, targetNumber: string): boolean {
  if (!ctx?.inquiry) return false;
  if (!ctx.inquiry.customer_name) return false;
  if (ctx.inquiry.customer_no !== targetNumber) return false;
  if (!ctx.expiresAt || Date.now() >= ctx.expiresAt) return false;
  return true;
}

/** True when Game inquiry context matches SKU + target and is not client-expired. */
export function isGameContextValid(
  ctx: GameCheckoutContext | null,
  targetNumber: string,
  skuCode: string | null | undefined
): boolean {
  if (!ctx?.inquiry) return false;
  if (!ctx.inquiry.nickname) return false;
  if (!ctx.inquiry.customer_no) return false;
  if (ctx.inquiry.customer_no !== targetNumber) return false;
  if (skuCode && ctx.inquiry.sku_code !== skuCode) return false;
  if (!ctx.expiresAt || Date.now() >= ctx.expiresAt) return false;
  return true;
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  ...IDLE_STATE,

  startCheckout: (product) => {
    const state = get();
    if (state.skuCode === product.code && state.idempotencyKey) {
      return;
    }
    set({
      ...IDLE_STATE,
      skuCode: product.code,
      categorySlug: product.category || null,
      idempotencyKey: createIdempotencyKey(),
    });
  },

  setTarget: (target) => set({ targetNumber: target }),
  setPurchaseContext: (ctx) =>
    set({
      ...(ctx.operatorLabel !== undefined ? { operatorLabel: ctx.operatorLabel } : {}),
      ...(ctx.selectedRegion !== undefined ? { selectedRegion: ctx.selectedRegion } : {}),
      ...(ctx.plnContext !== undefined ? { plnContext: ctx.plnContext } : {}),
      ...(ctx.gameContext !== undefined ? { gameContext: ctx.gameContext } : {}),
      ...(ctx.voucherInternetMode !== undefined
        ? { voucherInternetMode: ctx.voucherInternetMode }
        : {}),
    }),
  clearPlnContext: () => set({ plnContext: null }),
  clearGameContext: () => set({ gameContext: null }),
  setSubmitting: (submitting) => set({ submitting }),
  setTransaction: (transaction) => set({ transaction }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  resetCheckout: () => set({ ...IDLE_STATE }),

  startNewPurchase: () => {
    get().resetCheckout();
  },

  rotateIdempotencyKey: () => {
    set({ idempotencyKey: createIdempotencyKey() });
  },
}));
