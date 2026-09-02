import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Shield } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import { getRedirectPathForRole } from '../../constants/auth';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { AuthDivider, GoogleAuthButton } from '../../components/auth/GoogleAuthButton';

const loginSchema = z.object({
  identity: z.string().min(1, 'Email atau Nomor HP wajib diisi'),
  password: z.string().min(6, 'Password minimal terdiri dari 6 karakter'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, verifyLogin2fa, twoFactorChallenge, clearTwoFactorChallenge, fetchUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identity: '', password: '' },
  });

  useEffect(() => {
    const remembered = storageService.getRememberedIdentity();
    if (remembered) setValue('identity', remembered);
    if (location.state?.message) setSuccessMsg(location.state.message);
    const googleError = searchParams.get('google_error');
    if (googleError) setErrorMsg(decodeURIComponent(googleError));
  }, [setValue, location.state, searchParams]);

  const finishLogin = async () => {
    setSuccessMsg('Login berhasil! Mengalihkan ke dashboard...');
    await fetchUser();
    const currentUser = useAuthStore.getState().user;
    const role = currentUser?.role || 'User';
    const targetPath = getRedirectPathForRole(role) || '/dashboard';
    setTimeout(() => navigate(targetPath, { replace: true }), 400);
  };

  const onSubmit = async (data: LoginFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await login(data, rememberMe);
      if (result === 'ok') {
        await finishLogin();
      } else if (result === '2fa') {
        setSuccessMsg('Kode verifikasi 2FA telah dikirim ke email Anda.');
        const challenge = useAuthStore.getState().twoFactorChallenge;
        if (challenge?.dummySentCode) {
          setSuccessMsg(`Kode verifikasi 2FA dikirim. (dev: ${challenge.dummySentCode})`);
        }
      } else {
        const storeError = useAuthStore.getState().error;
        const validationErrs = useAuthStore.getState().validationErrors;
        if (validationErrs?.credentials?.[0]) {
          setErrorMsg(validationErrs.credentials[0]);
        } else {
          setErrorMsg(storeError || 'Autentikasi gagal. Silakan periksa kembali email/nomor HP dan password Anda.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat mencoba masuk. Silakan coba beberapa saat lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const onVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setOtpError(null);
    try {
      const ok = await verifyLogin2fa(otpCode.trim());
      if (ok) {
        await finishLogin();
      } else {
        const validationErrs = useAuthStore.getState().validationErrors;
        const otpMsg = validationErrs?.otp?.[0];
        if (otpMsg) {
          setOtpError(otpMsg);
        } else {
          setErrorMsg(useAuthStore.getState().error || 'Kode 2FA tidak valid.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal verifikasi 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  if (twoFactorChallenge) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="auth-heading mb-2">Verifikasi 2FA</h3>
          <p className="auth-subheading">Masukkan kode OTP yang dikirim ke email staf Finance/Owner.</p>
        </div>

        <form onSubmit={onVerify2fa} className="space-y-4">
          <div>
            <label className="auth-label">Kode OTP 6 digit</label>
            <div className="auth-input-icon-wrap">
              <div className="auth-input-icon"><Shield className="w-5 h-5" /></div>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoFocus
                maxLength={6}
                className={`auth-input pl-10 tracking-widest text-center ${otpError ? 'auth-input-error' : ''}`}
                placeholder="••••••"
                disabled={isLoading}
              />
            </div>
            {otpError && <p className="mt-1.5 text-xs font-semibold text-red-600">{otpError}</p>}
          </div>
          <Button type="submit" variant="primary" disabled={isLoading || otpCode.length !== 6} className="w-full disabled:opacity-60">
            {isLoading ? 'Memverifikasi…' : 'Verifikasi & Masuk'}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <button
            type="button"
            className="w-full text-xs font-bold text-gray-500 hover:text-primary-600 transition-colors"
            onClick={() => {
              clearTwoFactorChallenge();
              setOtpCode('');
              setOtpError(null);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            Kembali ke login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="auth-heading mb-2">Masuk ke Akun</h3>
        <p className="auth-subheading">Akses transaksi PPOB dan manajemen akun GurkyNet Anda.</p>
      </div>

      <GoogleAuthButton href={authService.googleRedirectUrl()} label="Masuk dengan Google" />
      <AuthDivider label="atau masuk dengan email" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-identity" className="auth-label">
            Email atau Nomor Handphone <span className="text-red-500">*</span>
          </label>
          <div className="auth-input-icon-wrap">
            <div className="auth-input-icon"><Mail className="w-5 h-5" /></div>
            <input
              id="login-identity"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="contoh: user@gurkynet.my.id atau 08123456789"
              {...register('identity')}
              disabled={isLoading}
              className={`auth-input pl-10 pr-4 py-3 ${errors.identity ? 'auth-input-error' : ''}`}
            />
          </div>
          {errors.identity && (
            <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.identity.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="login-password" className="auth-label">
            Kata Sandi <span className="text-red-500">*</span>
          </label>
          <div className="auth-input-icon-wrap">
            <div className="auth-input-icon"><Lock className="w-5 h-5" /></div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isLoading}
              className={`auth-input pl-10 pr-12 py-3 ${errors.password ? 'auth-input-error' : ''}`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Ingat saya
          </label>
          <Link to="/forgot-password" className="auth-link text-sm">
            Lupa kata sandi?
          </Link>
        </div>

        <Button type="submit" variant="primary" disabled={isLoading} className="w-full disabled:opacity-60">
          {isLoading ? 'Memproses…' : 'Masuk'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 pt-2 border-t border-gray-100">
        Belum punya akun?{' '}
        <Link to="/register" className="auth-link">Daftar</Link>
      </p>
    </div>
  );
};
