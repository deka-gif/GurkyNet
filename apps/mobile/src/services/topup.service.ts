import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/types';

/** GET /wallet/payment-config — public Midtrans + channel catalog (no server_key). */
export type MidtransPublicConfig = {
  client_key: string;
  is_production: boolean;
  snap_js_url: string;
  configured: boolean;
};

export type TopUpBank = {
  code: string;
  label: string;
  enabled: boolean;
};

export type TopUpOutlet = {
  code: string;
  label: string;
  enabled: boolean;
};

export type TopUpMethodCatalog = {
  id: string;
  label: string;
  enabled: boolean;
  banks?: TopUpBank[];
  outlets?: TopUpOutlet[];
};

export type TopUpPaymentConfig = MidtransPublicConfig & {
  min_amount?: number;
  quick_amounts?: number[];
  methods?: TopUpMethodCatalog[];
};

/** payment block from POST /wallet/topup (va_* often null — Snap UI holds instructions). */
export type TopUpPaymentInfo = {
  status: string;
  method: string | null;
  channel: string | null;
  channel_label: string | null;
  order_id: string | null;
  amount: number;
  va_number: string | null;
  payment_code: string | null;
  store: string | null;
  expiry_time: string | null;
};

export type TopUpCreateResult = {
  transactionId: string;
  invoiceNumber: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  payment: TopUpPaymentInfo | null;
  midtrans: MidtransPublicConfig | null;
};

const MIN_FALLBACK = 10000;
const QUICK_FALLBACK = [10000, 50000, 100000, 250000, 500000];

function mapPayment(raw: Record<string, unknown> | null | undefined): TopUpPaymentInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    status: String(raw.status ?? 'pending'),
    method: (raw.method as string | null) ?? null,
    channel: (raw.channel as string | null) ?? null,
    channel_label: (raw.channel_label as string | null) ?? (raw.channelLabel as string | null) ?? null,
    order_id: (raw.order_id as string | null) ?? (raw.orderId as string | null) ?? null,
    amount: Number(raw.amount ?? 0),
    va_number: (raw.va_number as string | null) ?? (raw.vaNumber as string | null) ?? null,
    payment_code: (raw.payment_code as string | null) ?? (raw.paymentCode as string | null) ?? null,
    store: (raw.store as string | null) ?? null,
    expiry_time: (raw.expiry_time as string | null) ?? (raw.expiryTime as string | null) ?? null,
  };
}

function mapMidtrans(raw: Record<string, unknown> | null | undefined): MidtransPublicConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    client_key: String(raw.client_key ?? raw.clientKey ?? ''),
    is_production: Boolean(raw.is_production ?? raw.isProduction ?? false),
    snap_js_url: String(raw.snap_js_url ?? raw.snapJsUrl ?? ''),
    configured: Boolean(raw.configured ?? false),
  };
}

/**
 * Wallet Top Up — same endpoints as Web WalletPage (FR-USR03).
 * Settlement is backend/webhook only; Mobile never invents SUCCESS.
 */
export const topUpService = {
  /** GET /wallet/payment-config */
  getPaymentConfig: async (): Promise<TopUpPaymentConfig> => {
    const response = await apiClient.get<ApiResponse<Record<string, unknown>>>('/wallet/payment-config');
    const raw = response.data.data || {};
    const methodsRaw = Array.isArray(raw.methods) ? raw.methods : [];
    return {
      client_key: String(raw.client_key ?? ''),
      is_production: Boolean(raw.is_production ?? false),
      snap_js_url: String(raw.snap_js_url ?? ''),
      configured: Boolean(raw.configured ?? false),
      min_amount: Number(raw.min_amount ?? MIN_FALLBACK),
      quick_amounts: Array.isArray(raw.quick_amounts)
        ? (raw.quick_amounts as number[]).map(Number)
        : [...QUICK_FALLBACK],
      methods: methodsRaw.map((m: any) => ({
        id: String(m.id ?? ''),
        label: String(m.label ?? m.id ?? ''),
        enabled: Boolean(m.enabled),
        banks: Array.isArray(m.banks)
          ? m.banks.map((b: any) => ({
              code: String(b.code ?? ''),
              label: String(b.label ?? b.code ?? ''),
              enabled: Boolean(b.enabled),
            }))
          : undefined,
        outlets: Array.isArray(m.outlets)
          ? m.outlets.map((o: any) => ({
              code: String(o.code ?? ''),
              label: String(o.label ?? o.code ?? ''),
              enabled: Boolean(o.enabled),
            }))
          : undefined,
      })),
    };
  },

  /**
   * POST /wallet/topup
   * Body: amount, payment_method, idempotency_key, channel?
   */
  createTopUp: async (params: {
    amount: number;
    paymentMethod: string;
    idempotencyKey: string;
    channel?: string | null;
  }): Promise<TopUpCreateResult> => {
    const body: Record<string, unknown> = {
      amount: params.amount,
      payment_method: params.paymentMethod,
      idempotency_key: params.idempotencyKey,
    };
    if (params.channel) {
      body.channel = params.channel;
    }

    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>('/wallet/topup', body);
    const data = response.data.data || {};
    const tx = (data.transaction as Record<string, unknown>) || {};
    const id = String(tx.id ?? '');
    return {
      transactionId: id,
      invoiceNumber:
        (tx.invoice_number as string | null) ??
        (tx.invoiceNumber as string | null) ??
        (tx.transactionCode as string | null) ??
        null,
      snapToken: (data.snap_token as string | null) ?? (data.snapToken as string | null) ?? null,
      redirectUrl:
        (data.redirect_url as string | null) ?? (data.redirectUrl as string | null) ?? null,
      payment: mapPayment(data.payment as Record<string, unknown>),
      midtrans: mapMidtrans(data.midtrans as Record<string, unknown>),
    };
  },
};

export function fallbackMinAmount(config: TopUpPaymentConfig | null): number {
  return Number(config?.min_amount || MIN_FALLBACK);
}

export function fallbackQuickAmounts(config: TopUpPaymentConfig | null): number[] {
  const min = fallbackMinAmount(config);
  const list = config?.quick_amounts?.length ? config.quick_amounts : QUICK_FALLBACK;
  return list.filter((n) => Number(n) >= min);
}

export function enabledTopUpMethods(config: TopUpPaymentConfig | null): TopUpMethodCatalog[] {
  return (config?.methods || []).filter((m) => m.enabled && m.id !== 'manual_transfer');
}
