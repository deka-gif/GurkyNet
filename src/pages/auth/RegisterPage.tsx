import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Ticket, MessageCircle } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';
import { getRedirectPathForRole } from '../../constants/auth';
import { Button } from '../../components/ui/Button';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { AuthDivider, GoogleAuthButton } from '../../components/auth/GoogleAuthButton';
import { PinInput } from '../../components/auth/PinInput';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(255, 'Nama lengkap maksimal 255 karakter'),
  email: z.string().min(1, 'Email wajib diisi').email('Format alamat email tidak valid'),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit').max(13, 'Nomor HP maksimal 13 digit').regex(/^08[0-9]{8,11}$/, 'Nomor HP harus diawali 08 dan hanya berisi angka (10-13 digit)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi'),
  referralCode: z.string().optional().refine((val) => !val || /^[A-Za-z0-9]{6,20}$/.test(val), 'Kode referral 6-20 karakter huruf/angka'),
  agreeTerms: z.boolean().refine((val) => val === true, { message: 'Anda wajib menyetujui syarat & ketentuan' }),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Konfirmasi password tidak cocok',
  path: ['passwordConfirmation'],
});

type RegisterFields = z.infer<typeof registerSchema>;

const weakPins = new Set(['123456', '111111', '121212', '112233', '987654', '654321']);

const STEPS = ['Data Akun', 'Verifikasi OTP', 'Buat PIN'] as const;

function RegisterStepper({ step }: { step: 'register' | 'verify' | 'pin' }) {
  const current = step === 'register' ? 0 : step === 'verify' ? 1 : 2;
  return (
    <div className="auth-step-track mb-2">
      {STEPS.map((label, index) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <div
              className={`auth-step-dot ${
                index === current ? 'auth-step-dot-active' : index < current ? 'auth-step-dot-done' : ''
              }`}
            >
              {index + 1}
            </div>
            <span className={`text-[10px] font-bold text-center truncate w-full px-0.5 ${
              index === current ? 'text-primary-700' : index < current ? 'text-primary-500' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`auth-step-line ${index < current ? 'auth-step-line-active' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const [step, setStep] = useState<'register' | 'verify' | 'pin'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [onboardingId, setOnboardingId] = useState<number | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showReferralField, setShowReferralField] = useState(false);
  const [busyWhatsapp, setBusyWhatsapp] = useState(false);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  const { register, handleSubmit, formState: { errors }, setError, setValue } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', passwordConfirmation: '', referralCode: '', agreeTerms: false },
  });

  const submitRegister = async (data: RegisterFields) => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await authService.register({
        ...data,
        referralCode: data.referralCode || undefined,
      });
      if (response.success) {
        setOnboardingId(response.data.onboarding_id);
        setRegisteredEmail(response.data.email);
        setStep('verify');
        setSuccessMsg('OTP verifikasi telah dikirim ke email Anda. Status akun saat ini: Menunggu Verifikasi.');
      } else {
        setErrorMsg(response.message || 'Gagal memulai registrasi.');
      }
    } catch (err: any) {
      if (err.errors?.email) setError('email', { message: err.errors.email[0] });
      if (err.errors?.phone_number) setError('phone', { message: err.errors.phone_number[0] });
      if (err.errors?.name) setError('fullName', { message: err.errors.name[0] });
      if (err.errors?.password) setError('password', { message: err.errors.password[0] });
      setErrorMsg(err.message || 'Terjadi kendala saat registrasi.');
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    if (!onboardingId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const response = await authService.verifyOnboardingOtp({ onboarding_id: onboardingId, code: otpCode });
      if (response.success) {
        setStep('pin');
        setSuccessMsg('Email berhasil diverifikasi. Lanjutkan dengan membuat PIN transaksi 6 digit.');
      } else {
        setErrorMsg(response.message || 'OTP tidak valid.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verifikasi OTP gagal.');
    } finally {
      setBusy(false);
    }
  };

  const resendWhatsappOtp = async () => {
    if (!onboardingId) return;
    setBusyWhatsapp(true);
    setErrorMsg(null);
    try {
      const response = await authService.resendOnboardingOtpWhatsapp(onboardingId);
      if (response.success) {
        setSuccessMsg('Kode OTP baru dikirim ke WhatsApp Anda.');
      } else {
        setErrorMsg(response.message || 'Gagal mengirim OTP via WhatsApp.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim OTP via WhatsApp.');
    } finally {
      setBusyWhatsapp(false);
    }
  };

  const submitPin = async () => {
    if (!onboardingId) return;
    if (pin !== pinConfirmation) {
      setErrorMsg('Konfirmasi PIN tidak cocok.');
      return;
    }
    if (weakPins.has(pin)) {
      setErrorMsg('PIN terlalu lemah. Gunakan kombinasi lain.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const response = await authService.finalizeRegistration({
        onboarding_id: onboardingId,
        pin,
        pin_confirmation: pinConfirmation,
        remember_device: rememberDevice,
        accept_policies: true,
      });
      if (response.success) {
        storageService.setToken(response.data.token, true);
        storageService.setUser(response.data.user as unknown as Record<string, unknown>, true);
        storageService.markTrustedIdentity(registeredEmail);
        await fetchUser();
        const role = useAuthStore.getState().user?.role || 'User';
        navigate(getRedirectPathForRole(role) || '/dashboard', { replace: true });
      } else {
        setErrorMsg(response.message || 'Gagal menyelesaikan onboarding.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="auth-heading mb-2">Daftar Akun Baru</h3>
        <p className="auth-subheading">Registrasi sekarang, verifikasi email, lalu buat PIN sebelum akun aktif sepenuhnya.</p>
      </div>

      <RegisterStepper step={step} />

      {step === 'register' && (
        <>
          <GoogleAuthButton href={authService.googleRedirectUrl()} label="Lanjutkan dengan Google" />
          <AuthDivider label="atau daftar dengan email" />
          <form onSubmit={handleSubmit(submitRegister)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="reg-fullname" className="auth-label">Nama Lengkap</label>
            <div className="auth-input-icon-wrap">
              <div className="auth-input-icon"><User className="w-5 h-5" /></div>
              <input id="reg-fullname" type="text" autoComplete="name" placeholder="Contoh: Budi Santoso" {...register('fullName')} disabled={busy} className={`auth-input pl-10 py-2.5 ${errors.fullName ? 'auth-input-error' : ''}`} />
            </div>
            {errors.fullName && <p className="mt-1 text-xs font-semibold text-red-600">{errors.fullName.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-phone" className="auth-label">Nomor Handphone</label>
              <div className="auth-input-icon-wrap">
                <div className="auth-input-icon"><Phone className="w-4 h-4" /></div>
                <input id="reg-phone" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" {...register('phone')} disabled={busy} className={`auth-input pl-9 py-2.5 ${errors.phone ? 'auth-input-error' : ''}`} />
              </div>
              {errors.phone && <p className="mt-1 text-xs font-semibold text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label htmlFor="reg-email" className="auth-label">Email Aktif</label>
              <div className="auth-input-icon-wrap">
                <div className="auth-input-icon"><Mail className="w-4 h-4" /></div>
                <input id="reg-email" type="email" autoComplete="email" placeholder="nama@email.com" {...register('email')} disabled={busy} className={`auth-input pl-9 py-2.5 ${errors.email ? 'auth-input-error' : ''}`} />
              </div>
              {errors.email && <p className="mt-1 text-xs font-semibold text-red-600">{errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-password" className="auth-label">Password</label>
              <div className="auth-input-icon-wrap">
                <div className="auth-input-icon"><Lock className="w-4 h-4" /></div>
                <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Min. 8 karakter" {...register('password')} disabled={busy} className={`auth-input pl-9 pr-10 py-2.5 ${errors.password ? 'auth-input-error' : ''}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {errors.password && <p className="mt-1 text-xs font-semibold text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="reg-confirm-password" className="auth-label">Konfirmasi Password</label>
              <div className="auth-input-icon-wrap">
                <div className="auth-input-icon"><Lock className="w-4 h-4" /></div>
                <input id="reg-confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Ulangi password" {...register('passwordConfirmation')} disabled={busy} className={`auth-input pl-9 pr-10 py-2.5 ${errors.passwordConfirmation ? 'auth-input-error' : ''}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {errors.passwordConfirmation && <p className="mt-1 text-xs font-semibold text-red-600">{errors.passwordConfirmation.message}</p>}
            </div>
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
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  id="reg-referral"
                  type="text"
                  placeholder="Kode referral (opsional)"
                  {...register('referralCode', {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
                    },
                  })}
                  disabled={busy}
                  className={`auth-input uppercase ${errors.referralCode ? 'auth-input-error' : ''}`}
                />
                {errors.referralCode && <p className="mt-1 text-xs font-semibold text-red-600">{errors.referralCode.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => { setShowReferralField(false); setValue('referralCode', ''); }}
                className="text-xs font-bold text-gray-500 hover:text-primary-600 shrink-0 mt-2.5"
              >
                Lewati
              </button>
            </div>
          )}
          <label className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/40 px-4 py-3 cursor-pointer hover:bg-primary-50/70 transition-colors">
            <input type="checkbox" {...register('agreeTerms')} disabled={busy} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-xs text-gray-600 leading-relaxed">Saya menyetujui <Link to="/legal/terms-conditions" className="auth-link">Syarat & Ketentuan</Link> dan <Link to="/legal/privacy-policy" className="auth-link">Kebijakan Privasi</Link>.</span>
          </label>
          {errors.agreeTerms && <p className="text-xs font-semibold text-red-600">{errors.agreeTerms.message}</p>}
          <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? 'Memproses...' : <>Lanjut Verifikasi <ArrowRight className="w-4 h-4" /></>}</Button>
        </form>
        </>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setStep('register'); setErrorMsg(null); setSuccessMsg(null); setOtpCode(''); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Ubah Data Akun
          </button>
          <div className="auth-info-box">Kode OTP dikirim ke <strong>{registeredEmail}</strong>. Masukkan 6 digit OTP untuk melanjutkan.</div>
          <input inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="auth-otp-input" placeholder="000000" />
          <button
            type="button"
            disabled={busyWhatsapp || !onboardingId}
            onClick={() => void resendWhatsappOtp()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-bold py-2.5 hover:bg-primary-100 disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            {busyWhatsapp ? 'Mengirim...' : 'Tidak menerima email? Kirim ke WhatsApp'}
          </button>
          <Button type="button" variant="primary" disabled={busy || otpCode.length !== 6} onClick={submitOtp} className="w-full">Verifikasi OTP</Button>
        </div>
      )}

      {step === 'pin' && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setStep('verify'); setErrorMsg(null); setSuccessMsg(null); setPin(''); setPinConfirmation(''); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Verifikasi OTP
          </button>
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">Buat PIN transaksi 6 digit. Hindari PIN umum seperti <code className="text-primary-700 font-mono text-xs">123456</code>, <code className="text-primary-700 font-mono text-xs">111111</code>, atau pola berulang lain.</div>
          <div>
            <label className="auth-label">PIN Baru</label>
            <PinInput value={pin} onChange={setPin} disabled={busy} autoFocus />
          </div>
          <div>
            <label className="auth-label">Konfirmasi PIN</label>
            <PinInput value={pinConfirmation} onChange={setPinConfirmation} disabled={busy} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Ingat perangkat ini
          </label>
          <Button type="button" variant="primary" disabled={busy || pin.length !== 6 || pinConfirmation.length !== 6} onClick={submitPin} className="w-full">Aktifkan Akun & Masuk</Button>
        </div>
      )}

      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-xs text-gray-500">Sudah punya akun? <Link to="/login" className="auth-link">Masuk di sini</Link></p>
      </div>
    </div>
  );
};
