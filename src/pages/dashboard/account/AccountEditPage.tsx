import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAuthStore } from '../../../store/auth.store';
import { profileService } from '../../../services/profile/profile.service';
import { resolveMediaUrl } from '../../../utils/mediaUrl';
import { AccountShell, AccountCard } from './AccountShell';

export const AccountEditPage: React.FC = () => {
  const { user, fetchUser } = useAuth();
  const patchUser = useAuthStore((s) => s.patchUser);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await profileService.updateProfile({ name, phone_number: phone });
      if (res.success) {
        setMsg(res.message || 'Profil diperbarui.');
        await fetchUser();
      } else setErr(res.message);
    } catch (e: any) {
      setErr(e?.message || 'Gagal menyimpan profil');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErr('Konfirmasi password tidak cocok.');
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await profileService.updatePassword({
        current_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      if (res.success) {
        setMsg(res.message || 'Password diperbarui.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else setErr(res.message);
    } catch (e: any) {
      setErr(e?.message || 'Gagal mengganti password');
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await profileService.uploadAvatar(file);
      if (res.success) {
        const payload: any = (res as any).data?.data ?? res.data ?? res;
        const avatar =
          payload?.avatar ||
          payload?.avatar_url ||
          payload?.user?.avatar ||
          payload?.user?.avatar_url ||
          '';
        if (avatar) {
          patchUser({ avatar: String(avatar) });
        }
        setMsg('Foto profil diperbarui.');
        await fetchUser();
      } else setErr(res.message);
    } catch (err: any) {
      setErr(err?.message || 'Gagal upload avatar');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <AccountShell title="Edit Profile" subtitle="Perbarui data diri Anda. Email tidak dapat diganti langsung.">
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}

      <AccountCard id="avatar">
        <h3 className="text-sm font-extrabold text-gray-900 mb-3">Foto Profil</h3>
        <div className="flex items-center gap-4">
          <img
            src={
              resolveMediaUrl(user?.avatar) ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
            }
            alt=""
            className="w-16 h-16 rounded-2xl object-cover border"
          />
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800">
            Upload Foto
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={busy} />
          </label>
        </div>
      </AccountCard>

      <AccountCard>
        <form onSubmit={saveProfile} className="space-y-3">
          <h3 className="text-sm font-extrabold text-gray-900">Data Pribadi</h3>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Nama</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Email (tidak dapat diganti langsung)</label>
            <input value={user?.email || ''} disabled className="mt-1 w-full rounded-xl border border-gray-100 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Nomor HP</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold" required />
          </div>
          <button disabled={busy} type="submit" className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50">
            Simpan Profil
          </button>
        </form>
      </AccountCard>

      <AccountCard id="password">
        <form onSubmit={savePassword} className="space-y-3">
          <h3 className="text-sm font-extrabold text-gray-900">Ganti Password</h3>
          <input type="password" placeholder="Password lama" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
          <input type="password" placeholder="Password baru" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
          <input type="password" placeholder="Konfirmasi password baru" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
          <button disabled={busy} type="submit" className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
            Simpan Password
          </button>
        </form>
      </AccountCard>
    </AccountShell>
  );
};
