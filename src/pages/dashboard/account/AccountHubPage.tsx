import React, { useEffect, useMemo, useState } from 'react';
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
  Gift,
  Users,
  ChevronRight,
  ScrollText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useWalletStore } from '../../../store/wallet.store';
import { formatIDR as formatIdr } from '../../../utils/currency';
import { resolveMediaUrl } from '../../../utils/mediaUrl';
import { loyaltyService } from '../../../services/loyalty/loyalty.service';
import { referralService } from '../../../services/referral/referral.service';

type MenuItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  iconClass: string;
  badge?: React.ReactNode;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export const AccountHubPage: React.FC = () => {
  const { user, fetchUser } = useAuth();
  const isInternalStaff = (user?.role || 'User') !== 'User';
  const { wallet, fetchWallet } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [loyaltySummary, setLoyaltySummary] = useState<{ points_balance?: number } | null>(null);
  const [referralSummary, setReferralSummary] = useState<{
    level_1_count?: number;
    level_2_count?: number;
  } | null>(null);

  useEffect(() => {
    fetchUser();
    fetchWallet();
  }, [fetchUser, fetchWallet]);

  useEffect(() => {
    if (isInternalStaff) return;
    void (async () => {
      try {
        const data = await loyaltyService.getSummary();
        setLoyaltySummary(data);
      } catch {
        setLoyaltySummary(null);
      }
    })();
  }, [isInternalStaff]);

  useEffect(() => {
    if (isInternalStaff) return;
    void (async () => {
      try {
        const data = await referralService.getSummary();
        setReferralSummary(data);
      } catch {
        setReferralSummary(null);
      }
    })();
  }, [isInternalStaff]);

  const walletNo = user?.wallet?.wallet_number || user?.wallet?.walletNo || wallet?.walletNo || '—';
  const balance = user?.wallet?.balance ?? wallet?.balance ?? 0;

  const copyWallet = async () => {
    if (!walletNo || walletNo === '—') return;
    await navigator.clipboard.writeText(String(walletNo));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const referralFriends =
    (referralSummary?.level_1_count ?? 0) + (referralSummary?.level_2_count ?? 0);

  const menuGroups: MenuGroup[] = useMemo(() => {
    if (isInternalStaff) {
      return [
        {
          title: 'Profil & Keamanan',
          items: [
            {
              to: '/dashboard/account/settings',
              icon: Settings,
              label: 'Pengaturan Akun',
              desc: 'Semua pengaturan di satu tempat',
              iconClass: 'bg-sky-100 text-sky-600',
            },
            {
              to: '/dashboard/account/security',
              icon: Shield,
              label: 'Keamanan',
              desc: 'Transaction PIN, sesi & riwayat login',
              iconClass: 'bg-sky-100 text-sky-600',
            },
          ],
        },
        {
          title: 'Bantuan & Legal',
          items: [
            {
              to: '/dashboard/account/help',
              icon: HelpCircle,
              label: 'Help Center',
              desc: 'FAQ & kontak support',
              iconClass: 'bg-sky-100 text-sky-600',
            },
            {
              to: '/dashboard/account/complaints',
              icon: MessageSquareWarning,
              label: 'Complaint Center',
              desc: 'Buat & lacak tiket',
              iconClass: 'bg-rose-100 text-rose-600',
            },
            {
              to: '/dashboard/account/privacy',
              icon: FileText,
              label: 'Privacy Policy',
              desc: 'Kebijakan privasi',
              iconClass: 'bg-gray-100 text-gray-500',
            },
            {
              to: '/dashboard/account/terms',
              icon: ScrollText,
              label: 'Terms & Conditions',
              desc: 'Syarat & ketentuan',
              iconClass: 'bg-gray-100 text-gray-500',
            },
            {
              to: '/dashboard/account/about',
              icon: Info,
              label: 'About',
              desc: 'Versi & informasi aplikasi',
              iconClass: 'bg-gray-100 text-gray-500',
            },
          ],
        },
      ];
    }

    return [
      {
        title: 'Profil & Keamanan',
        items: [
          {
            to: '/dashboard/account/settings',
            icon: Settings,
            label: 'Pengaturan Akun',
            desc: 'Semua pengaturan di satu tempat',
            iconClass: 'bg-sky-100 text-sky-600',
          },
          {
            to: '/dashboard/account/kyc',
            icon: Shield,
            label: 'Verifikasi KYC',
            desc: 'Tier 1 HP/email & Tier 2 KTP',
            iconClass: 'bg-primary-100 text-primary-700',
          },
          {
            to: '/dashboard/account/security',
            icon: Shield,
            label: 'Keamanan',
            desc: 'Transaction PIN, sesi & riwayat login',
            iconClass: 'bg-sky-100 text-sky-600',
          },
        ],
      },
      {
        title: 'Keuangan & Loyalitas',
        items: [
          {
            to: '/dashboard/account/wallet',
            icon: Wallet,
            label: 'Informasi Wallet',
            desc: 'Nomor & saldo GurkyPay',
            iconClass: 'bg-primary-100 text-primary-700',
            badge: (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 shrink-0">
                {formatIdr(Number(balance))}
              </span>
            ),
          },
          {
            to: '/dashboard/account/loyalty',
            icon: Gift,
            label: 'Poin & Loyalitas',
            desc: 'Saldo poin, tier, redeem',
            iconClass: 'bg-accent-300/60 text-accent-600',
            badge:
              loyaltySummary?.points_balance != null ? (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-accent-300/50 text-accent-700 shrink-0">
                  {loyaltySummary.points_balance.toLocaleString('id-ID')} poin
                </span>
              ) : null,
          },
          {
            to: '/dashboard/account/referral',
            icon: Users,
            label: 'Referral',
            desc: 'Kode & komisi ajak teman',
            iconClass: 'bg-primary-100 text-primary-700',
            badge:
              referralSummary != null ? (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 shrink-0">
                  {referralFriends} teman
                </span>
              ) : null,
          },
          {
            to: '/dashboard/account/subscriptions',
            icon: Settings,
            label: 'Langganan Otomatis',
            desc: 'Auto-reorder per tanggal',
            iconClass: 'bg-gray-100 text-gray-500',
            badge: (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                Segera
              </span>
            ),
          },
        ],
      },
      {
        title: 'Bantuan & Legal',
        items: [
          {
            to: '/dashboard/account/complaints',
            icon: MessageSquareWarning,
            label: 'Complaint Center',
            desc: 'Buat & lacak tiket',
            iconClass: 'bg-rose-100 text-rose-600',
          },
          {
            to: '/dashboard/account/help',
            icon: HelpCircle,
            label: 'Help Center',
            desc: 'FAQ & kontak support',
            iconClass: 'bg-sky-100 text-sky-600',
          },
          {
            to: '/dashboard/account/privacy',
            icon: FileText,
            label: 'Privacy Policy',
            desc: 'Kebijakan privasi',
            iconClass: 'bg-gray-100 text-gray-500',
          },
          {
            to: '/dashboard/account/terms',
            icon: ScrollText,
            label: 'Terms & Conditions',
            desc: 'Syarat & ketentuan',
            iconClass: 'bg-gray-100 text-gray-500',
          },
          {
            to: '/dashboard/account/about',
            icon: Info,
            label: 'About',
            desc: 'Versi & informasi aplikasi',
            iconClass: 'bg-gray-100 text-gray-500',
          },
        ],
      },
    ];
  }, [isInternalStaff, balance, loyaltySummary, referralSummary, referralFriends]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Akun</p>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {isInternalStaff ? 'Staff Account Center' : 'User Account Center'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isInternalStaff
            ? 'Pusat profil, keamanan, dan bantuan.'
            : 'Pusat profil, keamanan, wallet, dan bantuan.'}
        </p>
      </div>

      <div className="dashboard-balance-card rounded-3xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={
                resolveMediaUrl(user?.avatar) ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
              }
              alt=""
              className="w-16 h-16 rounded-2xl object-cover border border-white/20"
            />
            <Link
              to="/dashboard/account/edit"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-white/20 text-white shadow backdrop-blur-sm"
            >
              <Camera className="w-3 h-3" />
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold truncate">{user?.name || '—'}</h2>
            <p className="text-xs text-primary-100">{user?.email}</p>
            <p className="text-xs text-primary-100">{user?.phone || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                {user?.role || 'User'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-white/15 text-white border-white/20`}
              >
                PIN {user?.hasPin ? 'Aktif' : 'Belum dibuat'}
              </span>
            </div>
          </div>
        </div>

        {!isInternalStaff && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-3">
              <p className="text-[10px] font-bold uppercase text-primary-100">Wallet Number</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-extrabold font-mono truncate">{walletNo}</p>
                <button
                  type="button"
                  onClick={copyWallet}
                  className="p-1 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/20"
                >
                  <Copy className="w-3.5 h-3.5 text-primary-100" />
                </button>
                {copied && <span className="text-[10px] font-bold text-emerald-200">Copied</span>}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-3">
              <p className="text-[10px] font-bold uppercase text-primary-100">Saldo GurkyPay</p>
              <p className="text-sm font-extrabold mt-1">{formatIdr(Number(balance))}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400 mb-2 ml-1">
              {group.title}
            </p>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${item.iconClass}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 truncate">{item.desc}</p>
                  </div>
                  {item.badge}
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
