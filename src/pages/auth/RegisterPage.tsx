import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, KeyRound } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';
import { getRedirectPathForRole } from '../../constants/auth';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(255, 'Nama lengkap maksimal 255 karakter'),
  email: z.string().min(1, 'Email wajib diisi').email('Format alamat email tidak valid'),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit').max(13, 'Nomor HP maksimal 13 digit').regex(/^08[0-9]{8,11}$/, 'Nomor HP harus diawali 08 dan hanya berisi angka (10-13 digit)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi'),
  agreeTerms: z.boolean().refine((val) => val === true, { message: 'Anda wajib menyetujui syarat & ketentuan' }),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Konfirmasi password tidak cocok',
  path: ['passwordConfirmation'],
});

type RegisterFields = z.infer<typeof registerSchema>;

const weakPins = new Set(['123456', '111111', '121212', '112233', '987654', '654321']);

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

  const { register, handleSubmit, formState: { errors }, setError } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirmation: '',
      agreeTerms: false,
    },
  });

  const submitRegister = async (data: RegisterFields) => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await authService.register(data);
      if (response.success) {
        setOnboardingId(response.data.onboarding_id);
        setRegisteredEmail(response.data.email);
        setStep('verify');
        setSuccessMsg('OTP verifikasi telah dikirim ke email Anda. Status akun saat ini: Pending Verification.');
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
        remember_device: true,
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
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Daftar Akun Baru</h3>
        <p className="text-gray-500 text-sm">Registrasi sekarang, verifikasi email, lalu buat PIN sebelum akun aktif sepenuhnya.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
        {['Data Akun', 'Verifikasi OTP', 'Buat PIN'].map((label, index) => {
          const active = (step === 'register' && index === 0) || (step === 'verify' && index === 1) || (step === 'pin' && index === 2);
          return <div key={label} className={`rounded-full px-3 py-2 text-center ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{label}</div>;
        })}
      </div>

      {errorMsg && <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm"><AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><span className="font-medium">{errorMsg}</span></div>}
      {successMsg && <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-sm"><CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" /><span className="font-medium">{successMsg}</span></div>}

      {step === 'register' && (
        <form onSubmit={handleSubmit(submitRegister)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="reg-fullname" className="block text-xs font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><User className="w-5 h-5" /></div>
              <input id="reg-fullname" type="text" autoComplete="name" placeholder="Contoh: Budi Santoso" {...register('fullName')} disabled={busy} className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border rounded-2xl text-sm ${errors.fullName ? 'border-red-300' : 'border-gray-200'}`} />
            </div>
            {errors.fullName && <p className="mt-1 text-xs font-semibold text-red-600">{errors.fullName.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-bold text-gray-700 mb-1.5">Nomor Handphone</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Phone className="w-4 h-4" /></div>
                <input id="reg-phone" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" {...register('phone')} disabled={busy} className={`w-full pl-9 pr-3 py-2.5 bg-gray-50/70 border rounded-2xl text-sm ${errors.phone ? 'border-red-300' : 'border-gray-200'}`} />
              </div>
              {errors.phone && <p className="mt-1 text-xs font-semibold text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold text-gray-700 mb-1.5">Email Aktif</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-4 h-4" /></div>
                <input id="reg-email" type="email" autoComplete="email" placeholder="nama@email.com" {...register('email')} disabled={busy} className={`w-full pl-9 pr-3 py-2.5 bg-gray-50/70 border rounded-2xl text-sm ${errors.email ? 'border-red-300' : 'border-gray-200'}`} />
              </div>
              {errors.email && <p className="mt-1 text-xs font-semibold text-red-600">{errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-password" className="block text-xs font-bold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-4 h-4" /></div>
                <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Min. 8 karakter" {...register('password')} disabled={busy} className={`w-full pl-9 pr-10 py-2.5 bg-gray-50/70 border rounded-2xl text-sm ${errors.password ? 'border-red-300' : 'border-gray-200'}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {errors.password && <p className="mt-1 text-xs font-semibold text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-gray-700 mb-1.5">Konfirmasi Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-4 h-4" /></div>
                <input id="reg-confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Ulangi password" {...register('passwordConfirmation')} disabled={busy} className={`w-full pl-9 pr-10 py-2.5 bg-gray-50/70 border rounded-2xl text-sm ${errors.passwordConfirmation ? 'border-red-300' : 'border-gray-200'}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {errors.passwordConfirmation && <p className="mt-1 text-xs font-semibold text-red-600">{errors.passwordConfirmation.message}</p>}
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3 cursor-pointer">
            <input type="checkbox" {...register('agreeTerms')} disabled={busy} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-xs text-gray-600 leading-relaxed">Saya menyetujui <Link to="/legal/terms-conditions" className="font-bold text-primary-600 hover:underline">Syarat & Ketentuan</Link> dan <Link to="/legal/privacy-policy" className="font-bold text-primary-600 hover:underline">Kebijakan Privasi</Link>.</span>
          </label>
          {errors.agreeTerms && <p className="text-xs font-semibold text-red-600">{errors.agreeTerms.message}</p>}
          <button type="submit" disabled={busy} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold flex items-center justify-center gap-2">{busy ? 'Memproses...' : <>Lanjut Verifikasi <ArrowRight className="w-4 h-4" /></>}</button>
        </form>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">Kode OTP dikirim ke <strong>{registeredEmail}</strong>. Masukkan 6 digit OTP untuk melanjutkan.</div>
          <input inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-center text-lg font-black tracking-[0.4em]" placeholder="000000" />
          <button type="button" disabled={busy || otpCode.length !== 6} onClick={submitOtp} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold">Verifikasi OTP</button>
        </div>
      )}

      {step === 'pin' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">Buat PIN transaksi 6 digit. Hindari PIN umum seperti <code>123456</code>, <code>111111</code>, atau pola berulang lain.</div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><KeyRound className="w-4 h-4" /></div>
            <input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-2xl border border-gray-200 pl-10 pr-4 py-3 text-sm font-black tracking-[0.35em]" placeholder="PIN baru" />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><KeyRound className="w-4 h-4" /></div>
            <input inputMode="numeric" maxLength={6} value={pinConfirmation} onChange={(e) => setPinConfirmation(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-2xl border border-gray-200 pl-10 pr-4 py-3 text-sm font-black tracking-[0.35em]" placeholder="Konfirmasi PIN" />
          </div>
          <button type="button" disabled={busy || pin.length !== 6 || pinConfirmation.length !== 6} onClick={submitPin} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold">Aktifkan Akun & Masuk</button>
        </div>
      )}

      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-xs text-gray-500">Sudah punya akun? <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 hover:underline">Masuk di sini</Link></p>
      </div>
    </div>
  );
};
