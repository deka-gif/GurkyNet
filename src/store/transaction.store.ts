import { create } from 'zustand';
import { transactionService } from '../services/transaction/transaction.service';
import { Transaction } from '../types';

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  errorCode: number | string | null;
  validationErrors: Record<string, string[]> | null;
  fetchTransactions: () => Promise<void>;
  createTransaction: (data: any) => Promise<Transaction | null>;
  updateTransactionStatus: (id: string, status: Transaction['status'], note?: string) => Promise<boolean>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  errorCode: null,
  validationErrors: null,

  fetchTransactions: async () => {
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.getTransactions();

      console.log('TRANSACTION RESPONSE', response);
      if (response.success && response.data) {
        set({ transactions: response.data, loading: false });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memuat riwayat transaksi.', errorCode: err.status || null, loading: false });
    }
  },

  createTransaction: async (data) => {
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.createTransaction(data);
      if (response.success && response.data) {
        const updatedTransactions = [response.data, ...get().transactions];
        set({
          transactions: updatedTransactions,
          loading: false,
        });

        // Refresh full list from server in background
        get().fetchTransactions();

        return response.data;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (err: any) {
      set({
        error: err.message || 'Gagal membuat transaksi.',
        errorCode: err.status || null,
        validationErrors: err.errors || null,
        loading: false
      });
      return null;
    }
  },

  updateTransactionStatus: async (id, status, note) => {
    set({ loading: true, error: null, errorCode: null, validationErrors: null });
    try {
      const response = await transactionService.updateTransaction(id, { status, note });
      if (response.success) {
        const updatedTransactions = get().transactions.map((t) => (t.id === id ? response.data : t));
        set({
          transactions: updatedTransactions,
          loading: false,
        });
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
