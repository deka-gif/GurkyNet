import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Camera,
  Lock,
  KeyRound,
  Shield,
  Bell,
  HelpCircle,
  MessageSquareWarning,
  FileText,
  ScrollText,
  Info,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { AccountShell, AccountCard } from './AccountShell';

const rows = [
  { to: '/dashboard/account/edit', icon: User, label: 'Edit Profile', desc: 'Nama, nomor HP, foto' },
  { to: '/dashboard/account/edit#avatar', icon: Camera, label: 'Ganti Foto Profil', desc: 'Upload avatar baru' },
  { to: '/dashboard/account/edit#password', icon: Lock, label: 'Ganti Password', desc: 'Password login akun' },
  { to: '/dashboard/account/pin/create', icon: KeyRound, label: 'Buat PIN', desc: 'PIN transaksi 6 digit' },
  { to: '/dashboard/account/pin/change', icon: KeyRound, label: 'Ganti PIN', desc: 'Ganti PIN transaksi' },
  { to: '/dashboard/account/pin/forgot', icon: KeyRound, label: 'Lupa PIN', desc: 'Reset PIN via OTP' },
  { to: '/dashboard/account/security', icon: Shield, label: 'Device Login', desc: 'Sesi & riwayat login' },
  { to: '/dashboard/account/settings#notifications', icon: Bell, label: 'Notification Preference', desc: 'Preferensi notifikasi' },
  { to: '/dashboard/account/help', icon: HelpCircle, label: 'Help Center', desc: 'FAQ & kontak' },
  { to: '/dashboard/account/complaints', icon: MessageSquareWarning, label: 'Complaint Center', desc: 'Tiket komplain' },
  { to: '/dashboard/account/privacy', icon: FileText, label: 'Privacy Policy', desc: 'Kebijakan privasi' },
  { to: '/dashboard/account/terms', icon: ScrollText, label: 'Terms & Conditions', desc: 'Syarat & ketentuan' },
  { to: '/dashboard/account/about', icon: Info, label: 'About', desc: 'Versi aplikasi' },
];

export const AccountSettingsPage: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [notif, setNotif] = React.useState(() => localStorage.getItem('gn_notif_pref') !== 'off');

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleRows = rows.filter((row) => {
    if (row.to === '/dashboard/account/pin/create') return !user?.hasPin;
    if (row.to === '/dashboard/account/pin/change' || row.to === '/dashboard/account/pin/forgot') return !!user?.hasPin;
    return true;
  });

  return (
    <AccountShell title="Pengaturan Akun" subtitle="Pusat seluruh pengaturan akun GurkyNet." backTo="/dashboard/account">
      <AccountCard className="divide-y divide-gray-50 p-0 overflow-hidden">
        {visibleRows.map((row) => (
          <Link
            key={row.to + row.label}
            to={row.to}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition"
          >
            <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <row.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{row.label}</p>
              <p className="text-xs text-gray-500">{row.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        ))}

        <div id="notifications" className="flex items-center gap-3 px-4 py-3.5">
          <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Notifikasi Transaksi</p>
            <p className="text-xs text-gray-500">Aktifkan notifikasi di perangkat ini</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !notif;
              setNotif(next);
              localStorage.setItem('gn_notif_pref', next ? 'on' : 'off');
            }}
            className={`relative w-11 h-6 rounded-full transition ${notif ? 'bg-primary-600' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${notif ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-rose-50 transition text-left"
        >
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-700">Logout</p>
            <p className="text-xs text-rose-500">Keluar dari akun ini</p>
          </div>
        </button>
      </AccountCard>
    </AccountShell>
  );
};
