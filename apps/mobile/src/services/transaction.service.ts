import { apiClient } from '../api/client';
import { ApiResponse, Transaction } from '../api/types';

/**
 * The exact, and only, fields `POST /transactions` accepts
 * (laravel/app/Http/Requests/Api/v1/CreateTransactionRequest.php). `status`, `amount`,
 * `admin_fee`, `total_payment`, `sell_price` are stripped server-side before validation
 * even runs — this type deliberately has no room for them so nothing can be added here
 * by mistake. `inquiry_ref_id` is optional and only used by categories that require a
 * prior inquiry (PLN/Tagihan/E-wallet/Game) — out of scope for Fase 3B's generic
 * direct-purchase categories.
 */
export interface CreateTransactionPayload {
  sku_code: string;
  target_number: string;
  pin: string;
  idempotency_key: string;
  inquiry_ref_id?: string;
}

/**
 * Customer-facing subset of GetReceiptAction's output
 * (laravel/app/Actions/Transaction/GetReceiptAction.php). No provider/cost/margin
 * fields exist anywhere in that action's output — verified by reading the source,
 * so nothing here needs to be filtered the way Product is. The index signature covers
 * category-specific fields (PLN token, game nickname, tagihan tax details, …) that
 * Fase 3B's generic checkout never reads.
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

export const transactionService = {
  /** POST /transactions — a 201 here is NOT a settled purchase; `data.status` will be
   * pending/processing (raw LOCKED) until the async fulfillment job resolves it. */
  create: async (payload: CreateTransactionPayload): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', payload);
    return response.data;
  },

  /** GET /transactions/{id} — read-only, ownership-scoped, safe to poll repeatedly.
   * Never call this in a loop that also POSTs; polling only ever re-GETs. */
  getById: async (idOrInvoice: string | number): Promise<ApiResponse<Transaction>> => {
    const response = await apiClient.get<ApiResponse<Transaction>>(
      `/transactions/${encodeURIComponent(String(idOrInvoice))}`
    );
    return response.data;
  },

  /** GET /transactions/{id}/receipt — JSON receipt only; PDF export is out of scope. */
  getReceipt: async (idOrInvoice: string | number): Promise<ApiResponse<ReceiptData>> => {
    const response = await apiClient.get<ApiResponse<ReceiptData>>(
      `/transactions/${encodeURIComponent(String(idOrInvoice))}/receipt`
    );
    return response.data;
  },
};
