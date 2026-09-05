import { apiClient } from '../api/client';
import { ApiResponse, Transaction, TransactionStatus } from '../api/types';

/**
 * The exact, and only, fields `POST /transactions` accepts
 * (laravel/app/Http/Requests/Api/v1/CreateTransactionRequest.php).
 */
export interface CreateTransactionPayload {
  sku_code: string;
  target_number: string;
  pin: string;
  idempotency_key: string;
  inquiry_ref_id?: string;
}

/**
 * Customer-facing subset of GetReceiptAction's output.
 */
export interface ReceiptData {
  header: {
    company_name: string;
    tagline: string | null;
    address: string | null;
    support_phone: string | null;
    support_email: string | null;
  };
  transaction_details: {
    invoice_number: string;
    date: string;
    status: string;
    service_name: string;
    target_number: string;
    payment_method: string;
    serial_number: string | null;
    voucher_code: string | null;
    voucher_url: string | null;
    voucher_internet_code: string | null;
    voucher_internet_url: string | null;
    activation_code: string | null;
    activation_url: string | null;
    [key: string]: unknown;
  };
  items: Array<{ sku_code: string; name: string; price: number; quantity: number; total: number }>;
  payment_summary: { subtotal: number; denda: number; admin_fee: number; total_payment: number };
  footer: { note: string };
}

export type TransactionListFilters = {
  status?: string;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
};

export type TransactionListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type TransactionListResult = {
  items: Transaction[];
  meta: TransactionListMeta;
};

function normalizeListRow(row: any): Transaction {
  const status = String(row?.status ?? 'pending').toLowerCase() as TransactionStatus;
  return {
    id: String(row?.id ?? ''),
    transactionCode: String(row?.transactionCode || row?.invoice_number || row?.transaction_code || ''),
    serviceName: String(row?.serviceName || row?.service_name || ''),
    productName: String(
      row?.productName || row?.product_name || row?.serviceName || row?.service_name || ''
    ),
    targetNo: String(row?.targetNo || row?.target_number || ''),
    amount: Number(row?.amount ?? 0),
    adminFee: Number(row?.adminFee ?? row?.admin_fee ?? 0),
    totalPayment: Number(row?.totalPayment ?? row?.total_payment ?? row?.amount ?? 0),
    paymentMethod: String(row?.paymentMethod || row?.payment_method || ''),
    status,
    notes: row?.notes ?? row?.note ?? null,
    date: row?.date || row?.createdAt || row?.created_at || undefined,
    createdAt: row?.createdAt || row?.created_at || row?.date || undefined,
    lastUpdated: row?.lastUpdated || row?.updated_at || undefined,
  };
}

function unwrapList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown };
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

export const transactionService = {
  create: async (payload: CreateTransactionPayload): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', payload);
    return response.data;
  },

  /**
   * GET /transactions — purchase history (TransactionController::index).
   * Server filters: status, start_date, end_date, per_page (+ page).
   * No keyword param — search is client-side (Web RiwayatPage same).
   */
  list: async (filters: TransactionListFilters = {}): Promise<TransactionListResult> => {
    const response = await apiClient.get<
      ApiResponse<Transaction[]> & { meta?: TransactionListMeta }
    >('/transactions', { params: filters });
    const body = response.data;
    const items = unwrapList(body?.data ?? body).map(normalizeListRow);
    const meta = (body as any)?.meta || {
      current_page: 1,
      last_page: 1,
      per_page: filters.per_page ?? 15,
      total: items.length,
    };
    return { items, meta };
  },

  getById: async (idOrInvoice: string | number): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.get<ApiResponse<Transaction>>(
      `/transactions/${encodeURIComponent(String(idOrInvoice))}`
    );
    const body = response.data;
    if (body.success && body.data) {
      return { ...body, data: normalizeListRow(body.data) };
    }
    return body;
  },

  getReceipt: async (idOrInvoice: string | number): Promise<ApiResponse<ReceiptData>> => {
    const response = await apiClient.get<ApiResponse<ReceiptData>>(
      `/transactions/${encodeURIComponent(String(idOrInvoice))}/receipt`
    );
    return response.data;
  },
};
