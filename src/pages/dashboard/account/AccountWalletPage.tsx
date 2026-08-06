import React, { useEffect } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useWalletStore } from '../../../store/wallet.store';
import { AccountShell, AccountCard } from './AccountShell';
import { formatIDR as formatIdr } from '../../../utils/currency';

export const AccountWalletPage: React.FC = () => {
  const { user, fetchUser } = useAuth();
  const { wallet, fetchWallet } = useWalletStore();

  useEffect(() => {
    fetchUser();
    fetchWallet();
  }, [fetchUser, fetchWallet]);

  const walletNo = user?.wallet?.wallet_number || user?.wallet?.walletNo || wallet?.walletNo || '—';
  const balance = user?.wallet?.balance ?? wallet?.balance ?? 0;
  const status = user?.wallet?.status || 'active';

  return (
    <AccountShell title="Informasi Wallet" subtitle="Data GurkyPay dari tabel wallets.">
      <AccountCard>
        <p className="text-[10px] font-bold uppercase text-slate-400">Wallet Number</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-lg font-extrabold font-mono text-gray-900">{walletNo}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(String(walletNo))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Balance</p>
            <p className="text-sm font-extrabold mt-1">{formatIdr(Number(balance))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
            <p className="text-sm font-extrabold mt-1 capitalize">{status}</p>
          </div>
        </div>
        <Link to="/dashboard/wallet" className="inline-flex mt-4 text-xs font-bold text-primary-600">
          Buka halaman Wallet & riwayat →
        </Link>
      </AccountCard>
    </AccountShell>
  );
};
