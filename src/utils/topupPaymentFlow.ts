/**
 * FR-USR03 — user-initiated wallet top-up helpers.
 * AUTO_TOPUP_ENABLED is a separate recurring-payment gate and must stay unused here.
 */

export const MIN_TOPUP_AMOUNT = 10000;

export const TOPUP_QUICK_AMOUNTS = [10000, 50000, 100000, 250000, 500000] as const;

export type TopUpMethodId = 'qris' | 'va' | 'retail' | 'manual_transfer';

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
  id: TopUpMethodId | string;
  label: string;
  enabled: boolean;
  banks?: TopUpBank[];
  outlets?: TopUpOutlet[];
};

export type TopUpPaymentConfig = {
  client_key?: string;
  is_production?: boolean;
  snap_js_url?: string;
  configured?: boolean;
  min_amount?: number;
  quick_amounts?: number[];
  methods?: TopUpMethodCatalog[];
};

export type MidtransPaymentDetails = {
  status?: string;
  method?: string;
  channel?: string;
  channel_label?: string;
  order_id?: string;
  amount?: number;
  va_number?: string | null;
  payment_code?: string | null;
  store?: string | null;
  expiry_time?: string | null;
  payment_type?: string | null;
  instructions?: string | null;
};

export function methodRequiresBank(method: string | null | undefined): boolean {
  return method === 'va';
}

export function methodRequiresRetailOutlet(method: string | null | undefined): boolean {
  return method === 'retail';
}

export function isTopUpAmountValid(amount: number): boolean {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= MIN_TOPUP_AMOUNT;
}

export function enabledMethods(config: TopUpPaymentConfig | null | undefined): TopUpMethodCatalog[] {
  const methods = Array.isArray(config?.methods) ? config.methods : [];
  return methods.filter((m) => m.enabled);
}

export function enabledBanks(config: TopUpPaymentConfig | null | undefined): TopUpBank[] {
  const va = (config?.methods || []).find((m) => m.id === 'va');
  return (va?.banks || []).filter((b) => b.enabled);
}

export function enabledOutlets(config: TopUpPaymentConfig | null | undefined): TopUpOutlet[] {
  const retail = (config?.methods || []).find((m) => m.id === 'retail');
  return (retail?.outlets || []).filter((o) => o.enabled);
}

export function isMethodEnabled(config: TopUpPaymentConfig | null | undefined, method: string): boolean {
  if (method === 'manual_transfer') return true;
  return enabledMethods(config).some((m) => m.id === method);
}

/**
 * Copy only fields Midtrans actually returned. Never invent VA / payment codes.
 */
export function extractMidtransPaymentDetails(result: unknown): MidtransPaymentDetails {
  if (!result || typeof result !== 'object') return {};
  const r = result as Record<string, any>;
  const details: MidtransPaymentDetails = {};

  if (typeof r.order_id === 'string' && r.order_id) details.order_id = r.order_id;
  if (typeof r.payment_type === 'string' && r.payment_type) details.payment_type = r.payment_type;
  if (typeof r.transaction_status === 'string' && r.transaction_status) details.status = r.transaction_status;
  if (typeof r.expiry_time === 'string' && r.expiry_time) details.expiry_time = r.expiry_time;
  if (typeof r.store === 'string' && r.store) details.store = r.store;
  if (typeof r.payment_code === 'string' && r.payment_code) details.payment_code = r.payment_code;
  if (r.gross_amount != null && Number.isFinite(Number(r.gross_amount))) {
    details.amount = Number(r.gross_amount);
  }

  const vaList = Array.isArray(r.va_numbers) ? r.va_numbers : [];
  const firstVa = vaList.find((row: any) => row && typeof row.va_number === 'string' && row.va_number);
  if (firstVa?.va_number) details.va_number = String(firstVa.va_number);

  if (!details.va_number && typeof r.permata_va_number === 'string' && r.permata_va_number) {
    details.va_number = r.permata_va_number;
  }
  if (!details.va_number && typeof r.bill_key === 'string' && r.bill_key) {
    details.va_number = r.bill_key;
  }

  return details;
}

export function mapTopUpError(input: {
  code?: string;
  message?: string;
  status?: number | string;
}): string {
  const code = String(input.code || '');
  const raw = String(input.message || '').trim();

  switch (code) {
    case 'TOPUP_AMOUNT_TOO_SMALL':
      return raw || 'Nominal top up minimal Rp10.000.';
    case 'TOPUP_CHANNEL_UNAVAILABLE':
      return raw || 'Metode pembayaran tersebut sedang tidak tersedia.';
    case 'MIDTRANS_NOT_CONFIGURED':
      return raw || 'Metode pembayaran belum tersedia. Midtrans belum dikonfigurasi.';
    case 'TOPUP_PAYMENT_FAILED':
      return raw || 'Gagal membuat pembayaran top up. Silakan coba lagi.';
    case 'TOPUP_IDEMPOTENCY_CONFLICT':
      return raw || 'Permintaan top up dengan data berbeda memakai kunci yang sama. Ulangi dengan nominal/metode yang sama, atau mulai top up baru.';
    default:
      break;
  }

  if (/minimal/i.test(raw) && /10\.?000/i.test(raw)) {
    return raw;
  }
  if (/belum dikonfigurasi|MIDTRANS_NOT_CONFIGURED/i.test(raw)) {
    return raw;
  }
  if (/tidak tersedia|tidak didukung|pilih bank|pilih gerai/i.test(raw)) {
    return raw;
  }
  if (/kedaluwarsa|expired/i.test(raw)) {
    return 'Pembayaran sudah kedaluwarsa. Silakan buat top up baru.';
  }
  if (/batal|cancel/i.test(raw)) {
    return 'Pembayaran dibatalkan.';
  }
  if (/menunggu|pending/i.test(raw)) {
    return raw;
  }

  if (raw && raw !== 'Terjadi kesalahan saat memproses permintaan top up.') {
    return raw;
  }

  return 'Gagal memproses permintaan top up. Silakan coba lagi.';
}
