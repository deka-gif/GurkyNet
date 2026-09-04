import { create } from 'zustand';
import { transactionService } from '../services/transaction/transaction.service';
import { Transaction } from '../types';
import { normalizeTransactionStatus } from '../utils/transactionStatus';
import { CacheTTL, cachedFetch, getCachedStale, invalidateCache } from '../utils/queryCache';

function normalizeTransactionRow(row: any): Transaction {
  const status = normalizeTransactionStatus(row?.status);
  const providerCode =
    row?.providerCode ||
    row?.provider_code ||
    row?.fulfillment_provider_code ||
    row?.fulfillmentProviderCode ||
    null;
  const providerName =
    row?.providerName ||
    row?.provider_name ||
    row?.provider ||
    null;

  const paymentResumeRaw = row?.paymentResume || row?.payment_resume || null;
  const paymentResume = paymentResumeRaw
    ? {
        canResume: Boolean(paymentResumeRaw.canResume ?? paymentResumeRaw.can_resume),
        snapToken: paymentResumeRaw.snapToken ?? paymentResumeRaw.snap_token ?? null,
      }
    : undefined;

  return {
    ...row,
    id: row?.id,
    transactionCode: row?.transactionCode || row?.invoice_number || row?.transaction_code || '',
    invoice_number: row?.invoice_number || row?.transactionCode || row?.transaction_code,
    serviceName: row?.serviceName || row?.service_name || '',
    productName:
      row?.productName ||
      row?.product_name ||
      row?.serviceName ||
      row?.service_name ||
      '',
    targetNo: row?.targetNo || row?.target_number || '',
    amount: Number(row?.amount ?? 0),
    date: row?.date || row?.createdAt || row?.created_at || '',
    status: status as Transaction['status'],
    statusRaw: row?.statusRaw || row?.status_raw || row?.status || status,
    note: row?.note || row?.notes || '',
    notes: row?.notes || row?.note || '',
    providerCode,
    providerName,
    adminFee: row?.adminFee != null ? Number(row.adminFee) : undefined,
    totalPayment: row?.totalPayment != null ? Number(row.totalPayment) : undefined,
    paymentMethod: row?.paymentMethod || row?.payment_method || null,
    paymentResume,
  };
}

function unwrapTransactionList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  errorCode: number | string | null;
  validationErrors: Record<string, string[]> | null;
  lastFetchedAt: number | null;
  fetchTransactions: () => Promise<void>;
  upsertTransaction: (row: any) => void;
  createTransaction: (data: any) => Promise<Transaction | null>;
  updateTransactionStatus: (id: string, status: Transaction['status'], note?: string) => Promise<boolean>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  errorCode: null,
  validationErrors: null,
  lastFetchedAt: null,

  fetchTransactions: async () => {
    const stale = getCachedStale<Transaction[]>('transactions:list');
    if (stale?.fresh && get().transactions.length > 0) {
      return;
    }
    if (stale && get().transactions.length === 0) {
      set({ transactions: stale.data, loading: false, lastFetchedAt: Date.now() });
      if (stale.fresh) return;
    }

    if (get().transactions.length === 0) {
      set({ loading: true, error: null, errorCode: null, validationErrors: null });
    } else {
      set({ error: null, errorCode: null, validationErrors: null });
    }

    try {
      const rows = await cachedFetch({
        key: 'transactions:list',
        ttlMs: CacheTTL.RECENT_TX,
        fetcher: async () => {
          const response = await transactionService.getTransactions();
          if (!response.success || response.data === undefined || response.data === null) {
            throw new Error(response.message || 'Gagal memuat riwayat');
          }
          return unwrapTransactionList(response.data).map(normalizeTransactionRow);
        },
      });
      set({
        transactions: rows,
        loading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (err: any) {
      if (get().transactions.length === 0) {
        set({
          error: err.message || 'Gagal memuat riwayat transaksi.',
          errorCode: err.status || null,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    }
  },

  upsertTransaction: (row) => {
    const normalized = normalizeTransactionRow(row);
    const current = get().transactions;
    const idx = current.findIndex(
      (t) =>
        String(t.id) === String(normalized.id) ||
        t.transactionCode === normalized.transactionCode
    );
    if (idx === -1) {
      set({ transactions: [normalized, ...current] });
    } else {
      const next = [...current];
      next[idx] = { ...next[idx], ...normalized };
      set({ transactions: next });
    }
    invalidateCache('transactions:list');
  },

  createTransaction: async (data) => {
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.createTransaction(data);
      if (response.success && response.data) {
        const created = normalizeTransactionRow(response.data);
        set({
          transactions: [created, ...get().transactions.filter((t) => String(t.id) !== String(created.id))],
          loading: false,
        });

        // Background reconcile with server (status may still be pending until VIP settles).
        void get().fetchTransactions();

        return created;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (err: any) {
      set({
        error: err.message || 'Gagal membuat transaksi.',
        errorCode: err.status || null,
        validationErrors: err.errors || null,
        loading: false,
      });
      return null;
    }
  },

  updateTransactionStatus: async (id, status, note) => {
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.updateTransaction(id, { status, note });
      if (response.success && response.data) {
        get().upsertTransaction(response.data);
        set({ loading: false });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memperbarui transaksi.', loading: false });
      return false;
    }
  },
}));
