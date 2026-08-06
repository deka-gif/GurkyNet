import { create } from 'zustand';
import { transactionService } from '../services/transaction/transaction.service';
import { Transaction } from '../types';
import { normalizeTransactionStatus } from '../utils/transactionStatus';

function normalizeTransactionRow(row: any): Transaction {
  const status = normalizeTransactionStatus(row?.status);
  return {
    ...row,
    id: row?.id,
    transactionCode: row?.transactionCode || row?.invoice_number || row?.transaction_code || '',
    serviceName: row?.serviceName || row?.service_name || '',
    productName: row?.productName || row?.product_name || row?.serviceName || row?.service_name || '',
    targetNo: row?.targetNo || row?.target_number || '',
    amount: Number(row?.amount ?? 0),
    date: row?.date || row?.createdAt || row?.created_at || '',
    status: status as Transaction['status'],
    note: row?.note || row?.notes || '',
    notes: row?.notes || row?.note || '',
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
    console.log('HISTORY FETCH');
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.getTransactions();
      console.log('HISTORY RESPONSE', {
        success: response?.success,
        count: Array.isArray(response?.data) ? response.data.length : null,
        sampleStatuses: unwrapTransactionList(response?.data)
          .slice(0, 5)
          .map((row) => ({
            code: row?.transactionCode || row?.invoice_number,
            status: row?.status,
            normalized: normalizeTransactionStatus(row?.status),
          })),
      });

      if (response.success && response.data !== undefined && response.data !== null) {
        const rows = unwrapTransactionList(response.data).map(normalizeTransactionRow);
        console.log('HISTORY CACHE', {
          stored: rows.length,
          statuses: rows.slice(0, 5).map((r) => ({ code: r.transactionCode, status: r.status })),
        });
        set({
          transactions: rows,
          loading: false,
          lastFetchedAt: Date.now(),
        });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
      console.error('HISTORY FETCH failed', err);
      set({
        error: err.message || 'Gagal memuat riwayat transaksi.',
        errorCode: err.status || null,
        loading: false,
      });
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
      return;
    }
    const next = [...current];
    next[idx] = { ...next[idx], ...normalized };
    set({ transactions: next });
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
