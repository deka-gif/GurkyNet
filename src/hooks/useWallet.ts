import { useEffect } from 'react';
import { useWalletStore } from '../store/wallet.store';

export const useWallet = (autoFetch = false) => {
  const { wallet, loading, error, fetchWallet, updateWallet, topUp, transfer } = useWalletStore();

  useEffect(() => {
    if (autoFetch) {
      fetchWallet();
    }
  }, []);

  return {
    wallet,
    loading,
    error,
    fetchWallet,
    updateWallet,
    topUp,
    transfer,
  };
};
