import { create } from 'zustand';
import { parseApiError } from '../api/client';
import { createIdempotencyKey } from '../utils/idempotency';
import { Product } from '../services/catalog.service';
import { ewalletService, EwalletInquiryResult } from '../services/ewallet.service';
import { transactionService } from '../services/transaction.service';
import { Transaction } from '../api/types';
import {
  resolveEwalletOpenAmountProduct,
  validateEwalletOpenAmount,
  openAmountLimitsForBrand,
} from '../utils/ewalletBrand';

/**
 * Transfer E-Wallet UI session — PPOB path (inquiry + POST /transactions).
 * Never uses /wallet/transfer. Never stores PIN.
 * UX: brand → nomor + nominal manual → inquiry → confirm → PIN → purchase.
 * Engine: Digiflazz Pascabayar / Bebas Nominal open-amount SKU only.
 */
interface EwalletTransferState {
  brandKey: string;
  brandName: string;
  brandLogo: string | null;
  providerIds: number[];
  skuCode: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  /** Manual nominal digits (GurkyPay parity). */
  amount: number;
  product: Product | null;
  customerNo: string;
  inquiry: EwalletInquiryResult | null;
  inquiryExpiresAt: number | null;
  idempotencyKey: string | null;
  inquiring: boolean;
  inquiryError: string | null;
  submitting: boolean;
  submitError: string | null;
  transaction: Transaction | null;

  beginBrand: (brand: {
    key: string;
    name: string;
    logo: string | null;
    providerIds: number[];
    skuCode: string | null;
    minAmount: number | null;
    maxAmount: number | null;
  }) => void;
  /** Fill Bebas Nominal SKU / min-max after catalog resolve (legacy provider summary). */
  applyOpenAmountMeta: (meta: {
    skuCode: string | null;
    minAmount: number | null;
    maxAmount: number | null;
  }) => void;
  setAmount: (value: number) => void;
  setCustomerNo: (value: string) => void;
  clearInquiry: () => void;
  /**
   * Resolve Bebas Nominal SKU, then POST /ewallet/inquiry with client amount.
   * Catalog list is internal only — never shown as chips.
   */
  runInquiry: (catalogProducts: Product[]) => Promise<{ ok: boolean; message?: string }>;
  ensureIdempotencyKey: () => string;
  submitPurchase: (pin: string) => Promise<{
    ok: boolean;
    message?: string;
    code?: 'pin' | 'other';
  }>;
  clearSubmitError: () => void;
  reset: () => void;
}

const IDLE = {
  brandKey: '',
  brandName: '',
  brandLogo: null as string | null,
  providerIds: [] as number[],
  skuCode: null as string | null,
  minAmount: null as number | null,
  maxAmount: null as number | null,
  amount: 0,
  product: null as Product | null,
  customerNo: '',
  inquiry: null as EwalletInquiryResult | null,
  inquiryExpiresAt: null as number | null,
  idempotencyKey: null as string | null,
  inquiring: false,
  inquiryError: null as string | null,
  submitting: false,
  submitError: null as string | null,
  transaction: null as Transaction | null,
};

export function isEwalletInquiryValid(
  inquiry: EwalletInquiryResult | null,
  expiresAt: number | null,
  skuCode: string | null,
  customerNo: string
): boolean {
  if (!inquiry || !skuCode) return false;
  if (inquiry.sku_code !== skuCode) return false;
  if (String(inquiry.customer_no) !== String(customerNo)) return false;
  if (!inquiry.inquiry_ref_id) return false;
  if (expiresAt != null && Date.now() >= expiresAt) return false;
  return true;
}

export const useEwalletTransferStore = create<EwalletTransferState>((set, get) => ({
  ...IDLE,

  beginBrand: (brand) => {
    set({
      ...IDLE,
      brandKey: brand.key,
      brandName: brand.name,
      brandLogo: brand.logo,
      providerIds: [...brand.providerIds],
      skuCode: brand.skuCode,
      minAmount: brand.minAmount,
      maxAmount: brand.maxAmount,
    });
  },

  applyOpenAmountMeta: (meta) =>
    set({
      skuCode: meta.skuCode,
      minAmount: meta.minAmount,
      maxAmount: meta.maxAmount,
    }),

  setAmount: (value) =>
    set({
      amount: Number.isFinite(value) && value > 0 ? Math.floor(value) : 0,
      product: null,
      inquiry: null,
      inquiryExpiresAt: null,
      inquiryError: null,
      idempotencyKey: null,
      submitError: null,
      transaction: null,
    }),

  setCustomerNo: (value) =>
    set({
      customerNo: value.replace(/\D/g, '').slice(0, 15),
      inquiry: null,
      inquiryExpiresAt: null,
      inquiryError: null,
    }),

  clearInquiry: () =>
    set({
      inquiry: null,
      inquiryExpiresAt: null,
      inquiryError: null,
      product: null,
    }),

  runInquiry: async (catalogProducts) => {
    const { amount, customerNo, inquiring, brandName, skuCode, minAmount, maxAmount } = get();
    if (inquiring) return { ok: false, message: 'Sedang memvalidasi...' };

    const phone = customerNo.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      const message = 'Nomor HP e-wallet harus 10–15 digit.';
      set({ inquiryError: message });
      return { ok: false, message };
    }

    const product = resolveEwalletOpenAmountProduct(catalogProducts, skuCode);
    if (!product?.code) {
      const message = `Produk Bebas Nominal untuk ${brandName || 'E-Wallet'} tidak tersedia.`;
      set({ inquiryError: message, product: null });
      return { ok: false, message };
    }

    const fallback = openAmountLimitsForBrand(brandName);
    // Prefer API/product limits when catalog product carries them.
    const effectiveMin =
      typeof product.min_amount === 'number' && product.min_amount > 0
        ? product.min_amount
        : minAmount ?? fallback?.min ?? null;
    const effectiveMax =
      typeof product.max_amount === 'number' && product.max_amount > 0
        ? product.max_amount
        : maxAmount ?? fallback?.max ?? null;
    const limitError = validateEwalletOpenAmount(amount, effectiveMin, effectiveMax);
    if (limitError) {
      set({ inquiryError: limitError });
      return { ok: false, message: limitError };
    }

    set({
      product,
      skuCode: product.code,
      minAmount: effectiveMin ?? null,
      maxAmount: effectiveMax ?? null,
      inquiring: true,
      inquiryError: null,
      inquiry: null,
      inquiryExpiresAt: null,
      idempotencyKey: createIdempotencyKey(),
    });

    try {
      const response = await ewalletService.inquire(product.code, phone, amount);
      if (response.success && response.data?.inquiry_ref_id) {
        const data = response.data;
        const inquiredNominal = Number(data.nominal_amount ?? data.bill_amount ?? 0);
        if (inquiredNominal > 0 && inquiredNominal !== amount) {
          const message =
            'Nominal inquiry tidak sesuai dengan nominal yang dimasukkan. Silakan coba lagi.';
          set({
            inquiring: false,
            inquiryError: message,
            inquiry: null,
            inquiryExpiresAt: null,
          });
          return { ok: false, message };
        }
        const ttlSec = Math.max(0, Number(data.expires_in_seconds || 0));
        set({
          inquiry: data,
          customerNo: String(data.customer_no || phone),
          inquiryExpiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : null,
          inquiring: false,
          inquiryError: null,
        });
        return { ok: true };
      }
      const message = response.message || 'Gagal inquiry top up digital.';
      set({ inquiring: false, inquiryError: message });
      return { ok: false, message };
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      const message = parsed.message || 'Gagal inquiry top up digital.';
      set({ inquiring: false, inquiryError: message });
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

  submitPurchase: async (pin: string) => {
    const { product, inquiry, inquiryExpiresAt, customerNo, submitting } = get();
    if (submitting) return { ok: false, message: 'Transaksi sedang diproses.', code: 'other' };
    if (!/^\d{6}$/.test(pin)) {
      return { ok: false, message: 'PIN transaksi harus 6 digit angka.', code: 'pin' };
    }
    if (!isEwalletInquiryValid(inquiry, inquiryExpiresAt, product?.code ?? null, customerNo)) {
      return {
        ok: false,
        message: 'Sesi inquiry tidak valid atau kedaluwarsa. Silakan inquiry ulang.',
        code: 'other',
      };
    }

    const key = get().ensureIdempotencyKey();
    set({ submitting: true, submitError: null });

    try {
      const response = await transactionService.create({
        sku_code: inquiry!.sku_code,
        target_number: inquiry!.customer_no,
        pin,
        idempotency_key: key,
        inquiry_ref_id: inquiry!.inquiry_ref_id,
      });

      if (response.success && response.data) {
        set({
          transaction: response.data,
          submitting: false,
          submitError: null,
        });
        return { ok: true };
      }

      const message = response.message || 'Transaksi gagal diproses.';
      set({ submitting: false, submitError: message });
      return {
        ok: false,
        message,
        code: message.toLowerCase().includes('pin') ? 'pin' : 'other',
      };
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      const message = parsed.message || 'Gagal memproses transaksi.';
      set({ submitting: false, submitError: message });
      if (message.toLowerCase().includes('pin') && message.toLowerCase().includes('salah')) {
        set({ idempotencyKey: createIdempotencyKey() });
        return { ok: false, message, code: 'pin' };
      }
      return { ok: false, message, code: 'other' };
    }
  },

  reset: () => set({ ...IDLE }),
}));
