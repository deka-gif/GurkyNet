import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Copy,
  Shield,
  Wallet,
  Settings,
  HelpCircle,
  FileText,
  Info,
  MessageSquareWarning,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useWalletStore } from '../../../store/wallet.store';
import { AccountCard } from './AccountShell';

const formatIdr = (n?: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const AccountHubPage: React.FC = () => {
  const { user, fetchUser } = useAuth();
  const { wallet, fetchWallet } = useWalletStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchWallet();
  }, [fetchUser, fetchWallet]);

  const walletNo = user?.wallet?.wallet_number || user?.wallet?.walletNo || wallet?.walletNo || '—';
  const balance = user?.wallet?.balance ?? wallet?.balance ?? 0;

  const copyWallet = async () => {
    if (!walletNo || walletNo === '—') return;
    await navigator.clipboard.writeText(String(walletNo));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Akun</p>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">User Account Center</h1>
        <p className="text-sm text-gray-500 mt-1">Pusat profil, keamanan, wallet, dan bantuan.</p>
      </div>

      <AccountCard>
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
              alt=""
              className="w-16 h-16 rounded-2xl object-cover border border-gray-100"
            />
            <Link
              to="/dashboard/account/edit"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-primary-600 text-white shadow"
            >
              <Camera className="w-3 h-3" />
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-gray-900 truncate">{user?.name || '—'}</h2>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <p className="text-xs text-gray-500">{user?.phone || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {user?.role || 'User'}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${user?.hasPin ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
                PIN {user?.hasPin ? 'Aktif' : 'Belum dibuat'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Wallet Number</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-extrabold text-slate-800 font-mono truncate">{walletNo}</p>
              <button type="button" onClick={copyWallet} className="p-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200">
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              </button>
              {copied && <span className="text-[10px] font-bold text-emerald-600">Copied</span>}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Saldo GurkyPay</p>
            <p className="text-sm font-extrabold text-slate-800 mt-1">{formatIdr(Number(balance))}</p>
          </div>
        </div>
      </AccountCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { to: '/dashboard/account/settings', icon: Settings, label: 'Pengaturan Akun', desc: 'Semua pengaturan di satu tempat' },
          { to: '/dashboard/account/security', icon: Shield, label: 'Keamanan', desc: 'PIN, sesi, riwayat login' },
          { to: '/dashboard/account/wallet', icon: Wallet, label: 'Informasi Wallet', desc: 'Nomor & saldo GurkyPay' },
          { to: '/dashboard/account/pin/create', icon: KeyRound, label: 'Transaction PIN', desc: user?.hasPin ? 'Kelola PIN transaksi' : 'Buat PIN transaksi' },
          { to: '/dashboard/account/complaints', icon: MessageSquareWarning, label: 'Complaint Center', desc: 'Buat & lacak tiket' },
          { to: '/dashboard/account/help', icon: HelpCircle, label: 'Help Center', desc: 'FAQ & kontak support' },
          { to: '/dashboard/account/privacy', icon: FileText, label: 'Privacy Policy', desc: 'Kebijakan privasi' },
          { to: '/dashboard/account/about', icon: Info, label: 'About', desc: 'Versi & informasi aplikasi' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-primary-100 transition flex items-start gap-3"
          >
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
