import { create } from 'zustand';
import { parseApiError } from '../api/client';
import { createIdempotencyKey } from '../utils/idempotency';
import {
  topUpService,
  type TopUpCreateResult,
  type TopUpPaymentConfig,
  type TopUpPaymentInfo,
} from '../services/topup.service';
import { transactionService } from '../services/transaction.service';
import { openSnapCheckout, isTopUpSuccess } from '../utils/topupSnap';
import { useWalletStore } from './wallet.store';

type TopUpState = {
  config: TopUpPaymentConfig | null;
  configLoading: boolean;
  configError: string | null;

  submitting: boolean;
  submitError: string | null;
  /** Stable key for current create attempt — rotated only after success/new attempt. */
  idempotencyKey: string | null;

  /** Active pending / in-progress top-up session (create response). */
  active: TopUpCreateResult | null;

  detailLoading: boolean;
  detailError: string | null;
  detailStatus: string | null;
  detailAmount: number | null;
  detailInvoice: string | null;
  detailPayment: TopUpPaymentInfo | null;
  canResume: boolean;
  resumeSnapToken: string | null;

  loadConfig: () => Promise<void>;
  beginNewAttempt: () => void;
  createAndOpenSnap: (params: {
    amount: number;
    paymentMethod: string;
    channel?: string | null;
  }) => Promise<string | null>;
  openActiveSnap: () => Promise<boolean>;
  loadDetail: (transactionId: string) => Promise<void>;
  syncStatus: (transactionId: string) => Promise<void>;
  resumeSnap: (transactionId: string) => Promise<boolean>;
  resetSession: () => void;
};

function mapDetailPayment(raw: Record<string, unknown>): TopUpPaymentInfo | null {
  const amount = Number(raw.totalPayment ?? raw.total_payment ?? raw.amount ?? 0);
  return {
    status: String(raw.status ?? 'pending'),
    method: (raw.paymentMethod as string | null) ?? (raw.payment_method as string | null) ?? null,
    channel: (raw.topup_channel as string | null) ?? (raw.topupChannel as string | null) ?? null,
    channel_label:
      (raw.topup_channel_label as string | null) ??
      (raw.topupChannelLabel as string | null) ??
      null,
    order_id:
      (raw.invoice_number as string | null) ??
      (raw.invoiceNumber as string | null) ??
      (raw.transactionCode as string | null) ??
      null,
    amount,
    va_number: (raw.va_number as string | null) ?? (raw.vaNumber as string | null) ?? null,
    payment_code: (raw.payment_code as string | null) ?? (raw.paymentCode as string | null) ?? null,
    store: (raw.store as string | null) ?? null,
    expiry_time: (raw.expiry_time as string | null) ?? (raw.expiryTime as string | null) ?? null,
  };
}

export const useTopUpStore = create<TopUpState>((set, get) => ({
  config: null,
  configLoading: false,
  configError: null,
  submitting: false,
  submitError: null,
  idempotencyKey: null,
  active: null,
  detailLoading: false,
  detailError: null,
  detailStatus: null,
  detailAmount: null,
  detailInvoice: null,
  detailPayment: null,
  canResume: false,
  resumeSnapToken: null,

  loadConfig: async () => {
    set({ configLoading: true, configError: null });
    try {
      const config = await topUpService.getPaymentConfig();
      set({ config, configLoading: false, configError: null });
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        configLoading: false,
        configError: parsed.message || 'Gagal memuat konfigurasi pembayaran.',
      });
    }
  },

  beginNewAttempt: () => {
    set({
      idempotencyKey: createIdempotencyKey(),
      submitError: null,
      active: null,
    });
  },

  createAndOpenSnap: async ({ amount, paymentMethod, channel }) => {
    let key = get().idempotencyKey;
    if (!key) {
      key = createIdempotencyKey();
      set({ idempotencyKey: key });
    }

    set({ submitting: true, submitError: null });
    try {
      const result = await topUpService.createTopUp({
        amount,
        paymentMethod,
        idempotencyKey: key,
        channel: channel || null,
      });
      set({ active: result, submitting: false, submitError: null });

      const isProd =
        result.midtrans?.is_production ?? get().config?.is_production ?? false;
      // Opens in-app browser; when user closes it, control returns here — then sync.
      await openSnapCheckout({
        redirectUrl: result.redirectUrl,
        snapToken: result.snapToken,
        isProduction: isProd,
      });
      if (result.transactionId) {
        try {
          await transactionService.syncPayment(result.transactionId);
        } catch {
          /* close ≠ fail; ignore sync errors here */
        }
      }

      set({ idempotencyKey: createIdempotencyKey() });
      return result.transactionId || null;
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        submitting: false,
        submitError: parsed.message || 'Gagal membuat Top Up.',
      });
      // Keep same idempotency key for retry of this logical attempt.
      return null;
    }
  },

  openActiveSnap: async () => {
    const active = get().active;
    if (!active) return false;
    const isProd =
      active.midtrans?.is_production ?? get().config?.is_production ?? false;
    const res = await openSnapCheckout({
      redirectUrl: active.redirectUrl,
      snapToken: active.snapToken,
      isProduction: isProd,
    });
    return res.opened;
  },

  loadDetail: async (transactionId) => {
    set({ detailLoading: true, detailError: null });
    try {
      const raw = await transactionService.getDetailRaw(transactionId);
      const resume = (raw.paymentResume as Record<string, unknown>) || {};
      const payment = mapDetailPayment(raw);
      set({
        detailLoading: false,
        detailStatus: String(raw.status ?? payment?.status ?? 'pending'),
        detailAmount: payment?.amount ?? null,
        detailInvoice: payment?.order_id ?? null,
        detailPayment: payment,
        canResume: Boolean(resume.canResume),
        resumeSnapToken: (resume.snapToken as string | null) ?? null,
      });
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        detailLoading: false,
        detailError: parsed.message || 'Gagal memuat detail Top Up.',
      });
    }
  },

  syncStatus: async (transactionId) => {
    set({ detailError: null });
    try {
      const raw = await transactionService.syncPayment(transactionId);
      const resume = (raw.paymentResume as Record<string, unknown>) || {};
      const payment = mapDetailPayment(raw);
      const status = String(raw.status ?? payment?.status ?? 'pending');
      set({
        detailStatus: status,
        detailAmount: payment?.amount ?? get().detailAmount,
        detailInvoice: payment?.order_id ?? get().detailInvoice,
        detailPayment: payment,
        canResume: Boolean(resume.canResume),
        resumeSnapToken: (resume.snapToken as string | null) ?? null,
      });
      if (isTopUpSuccess(status)) {
        await useWalletStore.getState().fetchWallet();
      }
    } catch (err) {
      const parsed = parseApiError(err);
      set({ detailError: parsed.message || 'Gagal menyinkronkan status pembayaran.' });
    }
  },

  resumeSnap: async (transactionId) => {
    const { resumeSnapToken, canResume, config, active } = get();
    if (!canResume || !resumeSnapToken) return false;
    const isProd =
      active?.midtrans?.is_production ?? config?.is_production ?? false;
    const res = await openSnapCheckout({
      redirectUrl: active?.transactionId === transactionId ? active.redirectUrl : null,
      snapToken: resumeSnapToken,
      isProduction: isProd,
    });
    if (res.opened) {
      try {
        await transactionService.syncPayment(transactionId);
        await get().loadDetail(transactionId);
      } catch {
        /* close ≠ fail */
      }
    }
    return res.opened;
  },

  resetSession: () =>
    set({
      submitting: false,
      submitError: null,
      active: null,
      detailLoading: false,
      detailError: null,
      detailStatus: null,
      detailAmount: null,
      detailInvoice: null,
      detailPayment: null,
      canResume: false,
      resumeSnapToken: null,
    }),
}));
