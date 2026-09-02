import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Ticket } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';
import { getRedirectPathForRole } from '../../constants/auth';
import { Button } from '../../components/ui/Button';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { PinInput } from '../../components/auth/PinInput';

const weakPins = new Set(['123456', '111111', '121212', '112233', '987654', '654321']);

export const GoogleCompleteRegistrationPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const googleToken = params.get('google_token') || '';

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [showReferralField, setShowReferralField] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  if (!googleToken) {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-sm text-gray-600">Sesi tidak valid. Silakan mulai dari halaman registrasi.</p>
        <Link to="/register" className="auth-link text-sm font-bold">
          Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const submit = async () => {
    if (!/^08[0-9]{8,11}$/.test(phone)) {
      setErrorMsg('Nomor HP harus diawali 08 dan hanya berisi angka (10-13 digit).');
      return;
    }
    if (pin !== pinConfirmation) {
      setErrorMsg('Konfirmasi PIN tidak cocok.');
      return;
    }
    if (weakPins.has(pin)) {
      setErrorMsg('PIN terlalu lemah. Gunakan kombinasi lain.');
      return;
    }
    if (referralCode && !/^[A-Za-z0-9]{6,20}$/.test(referralCode)) {
      setErrorMsg('Kode referral 6-20 karakter huruf/angka.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('Anda wajib menyetujui syarat & ketentuan.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const response = await authService.completeGoogleRegistration({
        googleToken,
        phone,
        pin,
        pinConfirmation,
        referralCode: referralCode || undefined,
      });
      if (response.success) {
        storageService.setToken(response.data.token, true);
        storageService.setUser(response.data.user as unknown as Record<string, unknown>, true);
        await fetchUser();
        const role = useAuthStore.getState().user?.role || 'User';
        navigate(getRedirectPathForRole(role) || '/dashboard', { replace: true });
      } else {
        setErrorMsg(response.message || 'Gagal menyelesaikan registrasi.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyelesaikan registrasi Google.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="auth-heading mb-2">Lengkapi Profil</h3>
        <p className="auth-subheading">
          Akun Google Anda terhubung. Tambahkan nomor HP dan PIN transaksi untuk mulai menggunakan GurkyNet.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="google-phone" className="auth-label">Nomor Handphone</label>
          <div className="auth-input-icon-wrap">
            <div className="auth-input-icon"><Phone className="w-4 h-4" /></div>
            <input
              id="google-phone"
              type="tel"
              inputMode="numeric"
              placeholder="08xxxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
              disabled={busy}
              className="auth-input pl-9 py-2.5"
            />
          </div>
        </div>

        <div>
          <label className="auth-label">PIN Baru</label>
          <PinInput value={pin} onChange={setPin} disabled={busy} autoFocus />
        </div>
        <div>
          <label className="auth-label">Konfirmasi PIN</label>
          <PinInput value={pinConfirmation} onChange={setPinConfirmation} disabled={busy} />
        </div>

        {!showReferralField ? (
          <button
            type="button"
            onClick={() => setShowReferralField(true)}
            className="w-full border border-dashed border-gray-300 rounded-2xl px-4 py-3 text-xs font-bold text-gray-600 flex items-center justify-between cursor-pointer hover:border-primary-400 hover:text-primary-700"
          >
            <span className="flex items-center gap-2">
              <Ticket className="w-4 h-4" /> Punya kode referral?
            </span>
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              className="auth-input flex-1 uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
              maxLength={20}
              placeholder="Kode referral (opsional)"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => { setShowReferralField(false); setReferralCode(''); }}
              className="text-xs font-bold text-gray-500 hover:text-primary-600 shrink-0"
            >
              Lewati
            </button>
          </div>
        )}

        <label className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/40 px-4 py-3 cursor-pointer hover:bg-primary-50/70 transition-colors">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            disabled={busy}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            Saya menyetujui <Link to="/legal/terms-conditions" className="auth-link">Syarat & Ketentuan</Link> dan{' '}
            <Link to="/legal/privacy-policy" className="auth-link">Kebijakan Privasi</Link>.
          </span>
        </label>

        <Button
          type="button"
          variant="primary"
          disabled={busy || pin.length !== 6 || pinConfirmation.length !== 6 || !phone || !agreeTerms}
          onClick={submit}
          className="w-full"
        >
          {busy ? 'Memproses...' : 'Aktifkan Akun & Masuk'}
        </Button>
      </div>
    </div>
  );
};
