import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Bell, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { profileService } from '../../../services/profile/profile.service';
import { AccountShell, AccountCard } from './AccountShell';

const rows = [
  { to: '/dashboard/account/edit', icon: User, label: 'Edit Profile', desc: 'Nama, nomor HP, email, foto', section: 'Profil' },
  { to: '/dashboard/account/edit#password', icon: Lock, label: 'Ganti Password', desc: 'Password login akun', section: 'Login' },
];

export const AccountSettingsPage: React.FC = () => {
  const { logout, user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const [notif, setNotif] = React.useState<boolean>(user?.notifyTransactions ?? true);
  const [notifBusy, setNotifBusy] = React.useState(false);

  React.useEffect(() => {
    void profileService.getProfile().then((res) => {
      const val = res.data?.notifyTransactions ?? res.data?.notify_transactions;
      if (typeof val === 'boolean') setNotif(val);
    });
  }, []);

  React.useEffect(() => {
    if (typeof user?.notifyTransactions === 'boolean') setNotif(user.notifyTransactions);
  }, [user?.notifyTransactions]);

  const toggleNotif = async () => {
    const next = !notif;
    setNotif(next);
    setNotifBusy(true);
    try {
      await profileService.updateNotificationPreference(next);
      const profile = await profileService.getProfile();
      const saved = profile.data?.notifyTransactions ?? profile.data?.notify_transactions;
      if (typeof saved === 'boolean') setNotif(saved);
      await fetchUser();
    } catch {
      setNotif(!next);
    } finally {
      setNotifBusy(false);
    }
  };

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AccountShell title="Pengaturan Akun" subtitle="Pusat seluruh pengaturan akun GurkyNet." backTo="/dashboard/account">
      <AccountCard className="divide-y divide-gray-50 p-0 overflow-hidden">
        {rows.map((row) => (
          <div key={row.to}>
            <p className="text-[10px] font-bold uppercase text-slate-400 px-4 pt-3.5 pb-1">{row.section}</p>
            <Link
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
          </div>
        ))}

        <div id="notifications">
          <p className="text-[10px] font-bold uppercase text-slate-400 px-4 pt-3.5 pb-1">Preferensi</p>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Notifikasi Transaksi</p>
              <p className="text-xs text-gray-500">Aktifkan notifikasi push transaksi di perangkat ini</p>
            </div>
            <button
              type="button"
              disabled={notifBusy}
              onClick={() => void toggleNotif()}
              className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${notif ? 'bg-primary-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${notif ? 'translate-x-5' : ''}`} />
            </button>
          </div>
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
