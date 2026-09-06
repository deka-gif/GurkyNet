import { create } from 'zustand';
import { parseApiError } from '../api/client';
import { createIdempotencyKey } from '../utils/idempotency';
import { walletService, TransferTransaction } from '../services/wallet.service';

export type TransferDestination = 'gurkypay' | 'ovo' | 'gopay' | 'shopeepay';

/** Backend TransferRequest amount.min */
export const TRANSFER_MIN_AMOUNT = 1000;

interface TransferState {
  destination: TransferDestination | null;
  recipientWalletNumber: string;
  recipientName: string;
  amount: number;
  /** Client display only — backend is authoritative for fee. Always send 0. */
  adminFee: number;
  idempotencyKey: string | null;
  lookupLoading: boolean;
  lookupError: string | null;
  submitting: boolean;
  submitError: string | null;
  transaction: TransferTransaction | null;

  beginSession: (destination: TransferDestination) => void;
  setAmount: (value: number) => void;
  /** Read-only recipient preview — never transfers. */
  lookupRecipient: (walletNumber: string) => Promise<{ ok: boolean; message?: string }>;
  clearRecipient: () => void;
  ensureIdempotencyKey: () => string;
  submitTransfer: (pin: string) => Promise<{
    ok: boolean;
    message?: string;
    code?: 'pin' | 'balance' | 'validation' | 'other';
  }>;
  clearSubmitError: () => void;
  reset: () => void;
}

/**
 * UI session for Sesama GurkyPay transfer.
 * Never stores PIN. Never mutates wallet balance locally.
 */
export const useTransferStore = create<TransferState>((set, get) => ({
  destination: null,
  recipientWalletNumber: '',
  recipientName: '',
  amount: 0,
  adminFee: 0,
  idempotencyKey: null,
  lookupLoading: false,
  lookupError: null,
  submitting: false,
  submitError: null,
  transaction: null,

  beginSession: (destination) => {
    set({
      destination,
      recipientWalletNumber: '',
      recipientName: '',
      amount: 0,
      adminFee: 0,
      // Key created when leaving input for confirm (after successful lookup), not on lookup.
      idempotencyKey: null,
      lookupLoading: false,
      lookupError: null,
      submitting: false,
      submitError: null,
      transaction: null,
    });
  },

  setAmount: (value) => set({ amount: Math.max(0, Math.floor(value)) }),

  clearRecipient: () =>
    set({
      recipientWalletNumber: '',
      recipientName: '',
      lookupError: null,
    }),

  lookupRecipient: async (walletNumber: string) => {
    const trimmed = walletNumber.trim();
    if (!trimmed) {
      set({ lookupError: 'Masukkan ID / No. Rekening GurkyPay' });
      return { ok: false, message: 'Masukkan ID / No. Rekening GurkyPay' };
    }
    if (get().lookupLoading) {
      return { ok: false, message: 'Sedang memvalidasi nomor...' };
    }

    set({
      lookupLoading: true,
      lookupError: null,
      recipientWalletNumber: '',
      recipientName: '',
    });

    try {
      const response = await walletService.getTransferRecipient(trimmed);
      const recipient =
        (response as any)?.data?.recipient ?? (response as any)?.recipient ?? null;

      if (response.success && recipient?.wallet_number && recipient?.name) {
        set({
          recipientWalletNumber: String(recipient.wallet_number),
          recipientName: String(recipient.name),
          lookupLoading: false,
          lookupError: null,
        });
        return { ok: true };
      }

      const message = response.message || 'Nomor GurkyPay tidak ditemukan.';
      set({ lookupLoading: false, lookupError: message });
      return { ok: false, message };
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      const backendMessage = typeof parsed.message === 'string' ? parsed.message.trim() : '';
      // Never collapse every HTTP 404 into "not found" — route-missing / proxy 404s
      // must stay distinguishable from a real recipient miss.
      let message = backendMessage;
      if (!message) {
        message =
          parsed.status === 404
            ? 'Nomor GurkyPay tidak ditemukan.'
            : 'Gagal memvalidasi nomor GurkyPay. Silakan coba lagi.';
      } else if (
        parsed.status === 404 &&
        /route .+ could not be found/i.test(backendMessage)
      ) {
        message =
          'Layanan validasi penerima belum tersedia di server. Hubungi admin / deploy endpoint lookup.';
      }
      set({ lookupLoading: false, lookupError: message });
      return { ok: false, message };
    }
  },

  ensureIdempotencyKey: () => {
    const existing = get().idempotencyKey;
    if (existing) return existing;
    const key = createIdempotencyKey();
    set({ idempotencyKey: key });
    return key;
  },

  clearSubmitError: () => set({ submitError: null }),

  submitTransfer: async (pin: string) => {
    const { recipientWalletNumber, amount, adminFee, submitting } = get();
    if (submitting) {
      return { ok: false, message: 'Transfer sedang diproses.', code: 'other' };
    }

    const key = get().ensureIdempotencyKey();
    if (!recipientWalletNumber || amount < TRANSFER_MIN_AMOUNT) {
      return { ok: false, message: 'Data transfer tidak lengkap.', code: 'validation' };
    }
    if (!/^\d{6}$/.test(pin)) {
      return { ok: false, message: 'PIN transaksi harus 6 digit angka.', code: 'pin' };
    }

    set({ submitting: true, submitError: null });

    try {
      const response = await walletService.transfer({
        recipientWalletNumber,
        amount,
        pin,
        adminFee,
        idempotencyKey: key,
      });

      const raw =
        (response as any)?.data?.transaction ??
        ((response as any)?.data && !(response as any).data.transaction
          ? (response as any).data
          : null);
      if (response.success && raw) {
        const tx = normalizeTransferTx(raw);
        set({ transaction: tx, submitting: false, submitError: null });
        return { ok: true };
      }

      const message = response.message || 'Transfer gagal diproses.';
      set({ submitting: false, submitError: message });
      return { ok: false, message, code: classifyTransferError(message) };
    } catch (err: unknown) {
      // Keep the same idempotency key (web TransferPage / backend claim-after-PIN).
      const parsed = parseApiError(err);
      const message = parsed.message || 'Gagal memproses transfer. Silakan coba lagi.';
      set({ submitting: false, submitError: message });
      return { ok: false, message, code: classifyTransferError(message) };
    }
  },

  reset: () =>
    set({
      destination: null,
      recipientWalletNumber: '',
      recipientName: '',
      amount: 0,
      adminFee: 0,
      idempotencyKey: null,
      lookupLoading: false,
      lookupError: null,
      submitting: false,
      submitError: null,
      transaction: null,
    }),
}));

function classifyTransferError(message: string): 'pin' | 'balance' | 'validation' | 'other' {
  const m = message.toLowerCase();
  if (m.includes('pin')) return 'pin';
  if (m.includes('saldo') || m.includes('mencukupi')) return 'balance';
  if (m.includes('tidak ditemukan') || m.includes('sendiri') || m.includes('valid')) {
    return 'validation';
  }
  return 'other';
}

function normalizeTransferTx(raw: any): TransferTransaction {
  return {
    id: raw.id,
    invoice_number: raw.invoice_number ?? raw.invoiceNumber,
    invoiceNumber: raw.invoiceNumber ?? raw.invoice_number,
    service_name: raw.service_name ?? raw.serviceName ?? 'Transfer Saldo',
    serviceName: raw.serviceName ?? raw.service_name ?? 'Transfer Saldo',
    target_number: raw.target_number ?? raw.targetNumber,
    targetNumber: raw.targetNumber ?? raw.target_number,
    amount: Number(raw.amount ?? 0),
    admin_fee: Number(raw.admin_fee ?? raw.adminFee ?? 0),
    adminFee: Number(raw.adminFee ?? raw.admin_fee ?? 0),
    total_payment: Number(raw.total_payment ?? raw.totalPayment ?? raw.amount ?? 0),
    totalPayment: Number(raw.totalPayment ?? raw.total_payment ?? raw.amount ?? 0),
    status: String(raw.status || 'success'),
    notes: raw.notes ?? null,
    created_at: raw.created_at ?? raw.createdAt,
    createdAt: raw.createdAt ?? raw.created_at,
  };
}
