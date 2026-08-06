import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { profileService } from '../../../services/profile/profile.service';
import { AccountShell, AccountCard } from './AccountShell';

type Mode = 'create' | 'change' | 'forgot';

export const AccountPinPage: React.FC<{ mode: Mode }> = ({ mode }) => {
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/dashboard/account/settings';

  const [oldPin, setOldPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'create' && user?.hasPin) {
      navigate('/dashboard/account/pin/change', { replace: true });
    }
  }, [mode, user?.hasPin, navigate]);

  const title =
    mode === 'create' ? 'Buat Transaction PIN' : mode === 'change' ? 'Ganti Transaction PIN' : 'Lupa Transaction PIN';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (pin !== confirm) {
        setErr('Konfirmasi PIN tidak cocok.');
        return;
      }
      let res;
      if (mode === 'create') {
        res = await profileService.createPin(pin, confirm);
      } else if (mode === 'change') {
        res = await profileService.changePin(oldPin, pin, confirm);
      } else {
        res = await profileService.forgotPin({
          phone_number: phone,
          otp,
          pin,
          pin_confirmation: confirm,
        });
      }
      if (res.success) {
        setMsg(res.message || 'PIN berhasil disimpan.');
        await fetchUser();
        setTimeout(() => navigate(returnTo), 600);
      } else setErr(res.message);
    } catch (e: any) {
      const errors = e?.response?.data?.errors || e?.errors;
      setErr(errors ? Object.values(errors).flat().join(', ') : e?.message || 'Gagal menyimpan PIN');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { apiClient } = await import('../../../services/api');
      await apiClient.post('/auth/otp/request', { phone_number: phone, action: 'pin_reset' });
      setMsg('OTP dikirim. Masukkan kode untuk reset PIN.');
    } catch (e: any) {
      setErr(e?.message || 'Gagal mengirim OTP');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell title={title} subtitle="PIN 6 digit untuk otorisasi transaksi PPOB.">
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <AccountCard>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'change' && (
            <input inputMode="numeric" maxLength={6} placeholder="PIN lama" value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold tracking-widest" required />
          )}
          {mode === 'forgot' && (
            <>
              <input placeholder="Nomor HP" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required />
              <div className="flex gap-2">
                <input placeholder="Kode OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm" required />
                <button type="button" disabled={busy} onClick={requestOtp} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white hover:bg-slate-50">
                  Kirim OTP
                </button>
              </div>
            </>
          )}
          <input inputMode="numeric" maxLength={6} placeholder="PIN baru (6 digit)" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold tracking-widest" required />
          <input inputMode="numeric" maxLength={6} placeholder="Konfirmasi PIN baru" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold tracking-widest" required />
          <button disabled={busy || pin.length !== 6} type="submit" className="w-full px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50">
            Simpan PIN
          </button>
        </form>
      </AccountCard>
    </AccountShell>
  );
};
