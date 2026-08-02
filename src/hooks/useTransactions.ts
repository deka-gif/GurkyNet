import { useEffect } from 'react';
import { useTransactionStore } from '../store/transaction.store';

export const useTransactions = (autoFetch = false) => {
  const {
    transactions,
    loading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransactionStatus,
  } = useTransactionStore();

  useEffect(() => {
    if (autoFetch) {
      fetchTransactions();
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransactionStatus,
  };
};
