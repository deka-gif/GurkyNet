import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { profileService } from '../../../services/profile/profile.service';
import { AccountShell, AccountCard } from './AccountShell';
import { PinInput } from '../../../components/auth/PinInput';

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
  const [email, setEmail] = useState(user?.email || '');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [oldPinError, setOldPinError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'create' && user?.hasPin) {
      navigate('/dashboard/account/pin/change', { replace: true });
    }
  }, [mode, user?.hasPin, navigate]);

  const title =
    mode === 'create' ? 'Buat Transaction PIN' : mode === 'change' ? 'Ganti Transaction PIN' : 'Lupa Transaction PIN';

  const resetFieldErrors = () => {
    setEmailError(null);
    setOtpError(null);
    setOldPinError(null);
    setPinError(null);
    setConfirmError(null);
  };

  const mapBackendErrors = (obj: any): boolean => {
    const errors = obj?.errors || obj?.response?.data?.errors;
    if (!errors) return false;
    let mapped = false;
    if (errors.email) { setEmailError(errors.email[0]); mapped = true; }
    if (errors.otp || errors.otp_code) { setOtpError((errors.otp || errors.otp_code)[0]); mapped = true; }
    if (errors.old_pin) { setOldPinError(errors.old_pin[0]); mapped = true; }
    if (errors.pin) { setPinError(errors.pin[0]); mapped = true; }
    return mapped;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    resetFieldErrors();
    try {
      if (pin !== confirm) {
        setConfirmError('Konfirmasi PIN tidak cocok.');
        return;
      }
      let res;
      if (mode === 'create') {
        res = await profileService.createPin(pin, confirm);
      } else if (mode === 'change') {
        if (step === 'request') {
          res = await profileService.changePin(oldPin, pin, confirm);
          if (res.success) {
            setMsg('OTP dikirim ke email Anda. Masukkan OTP untuk menyelesaikan perubahan PIN.');
            setStep('confirm');
            return;
          }
        } else {
          res = await profileService.confirmChangePin(otp, pin, confirm);
        }
      } else {
        if (step === 'request') {
          res = await profileService.forgotPin({ email });
          if (res.success) {
            setMsg('OTP dikirim ke email Anda. Masukkan OTP untuk reset PIN.');
            setStep('confirm');
            return;
          }
        } else {
          res = await profileService.confirmForgotPin({
            email,
            otp_code: otp,
            pin,
            pin_confirmation: confirm,
          });
        }
      }
      if (res.success) {
        setMsg(res.message || 'PIN berhasil disimpan.');
        await fetchUser();
        setTimeout(() => navigate(returnTo), 600);
      } else if (!mapBackendErrors(res)) {
        setErr(res.message);
      }
    } catch (e: any) {
      if (!mapBackendErrors(e)) {
        const errors = e?.response?.data?.errors || e?.errors;
        setErr(errors ? Object.values(errors).flat().join(', ') : e?.message || 'Gagal menyimpan PIN');
      }
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setBusy(true);
    setErr(null);
    resetFieldErrors();
    try {
      if (mode === 'forgot') {
        await profileService.forgotPin({ email });
        setMsg('OTP dikirim ke email. Masukkan kode untuk reset PIN.');
      } else {
        await profileService.changePin(oldPin, pin, confirm);
        setMsg('OTP dikirim ke email. Masukkan kode untuk menyelesaikan perubahan PIN.');
      }
      setStep('confirm');
    } catch (e: any) {
      if (!mapBackendErrors(e)) {
        setErr(e?.message || 'Gagal mengirim OTP');
      }
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
            <>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">PIN Lama</label>
              <PinInput value={oldPin} onChange={setOldPin} disabled={busy} error={!!oldPinError} />
              {oldPinError && <p className="mt-1 text-xs font-semibold text-rose-600">{oldPinError}</p>}
              {step === 'request' && (
                <div className="text-right -mt-1">
                  <Link to={`/dashboard/account/pin/forgot?returnTo=${encodeURIComponent(returnTo)}`} className="text-xs font-bold text-primary-700 underline underline-offset-2">
                    Lupa PIN?
                  </Link>
                </div>
              )}
            </>
          )}
          {mode === 'forgot' && (
            <>
              <input placeholder="Email akun" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm ${emailError ? 'border-red-400' : 'border-gray-200'}`} required />
              {emailError && <p className="mt-1 text-xs font-semibold text-rose-600">{emailError}</p>}
              <div className="flex gap-2">
                <div className="flex-1">
                  <input placeholder="Kode OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm ${otpError ? 'border-red-400' : 'border-gray-200'}`} required />
                  {otpError && <p className="mt-1 text-xs font-semibold text-rose-600">{otpError}</p>}
                </div>
                <button type="button" disabled={busy || step === 'confirm'} onClick={requestOtp} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white hover:bg-slate-50 self-start">
                  Kirim OTP
                </button>
              </div>
            </>
          )}
          <label className="block text-xs font-bold text-gray-700 mb-1.5">PIN Baru (6 digit)</label>
          <PinInput value={pin} onChange={setPin} disabled={busy} error={!!pinError} />
          {pinError && <p className="mt-1 text-xs font-semibold text-rose-600">{pinError}</p>}
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Konfirmasi PIN Baru</label>
          <PinInput value={confirm} onChange={setConfirm} disabled={busy} error={!!confirmError} />
          {confirmError && <p className="mt-1 text-xs font-semibold text-rose-600">{confirmError}</p>}
          <button disabled={busy || pin.length !== 6} type="submit" className="w-full px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50">
            Simpan PIN
          </button>
        </form>
      </AccountCard>
    </AccountShell>
  );
};
