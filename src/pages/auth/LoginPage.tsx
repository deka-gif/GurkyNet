import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { getRedirectPathForRole } from '../../constants/auth';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';

const loginSchema = z.object({
  identity: z.string().min(1, 'Email atau Nomor HP wajib diisi'),
  password: z.string().min(6, 'Password minimal terdiri dari 6 karakter'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showPinMode, setShowPinMode] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, pinLogin, fetchUser } = useAuthStore();
  const identityInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identity: '',
      password: '',
    },
  });

  // Check for remembered identity and state flash message from registration/logout
  useEffect(() => {
    const remembered = storageService.getRememberedIdentity();
    if (remembered) {
      setValue('identity', remembered);
      setShowPinMode(storageService.isTrustedIdentity(remembered));
    }

    if (location.state?.message) {
      setSuccessMsg(location.state.message);
    }
  }, [setValue, location.state]);

  const { ref: registerIdentityRef, ...identityRest } = register('identity');

  const onSubmit = async (data: LoginFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const success = await login(data, rememberMe);

      if (success) {
        setSuccessMsg('Login berhasil! Mengalihkan ke dashboard...');

        // Hydrate Zustand with fresh data from /api/v1/auth/me
        await fetchUser();

        const currentUser = useAuthStore.getState().user;
        const role = currentUser?.role || 'User';

        // Auto-redirect based on role
        const targetPath = getRedirectPathForRole(role) || '/dashboard';
        
        // Brief pause for UX feedback
        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 400);
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

  const onSubmitPin = async () => {
    const identity = identityInputRef.current?.value || storageService.getRememberedIdentity();
    if (!identity) {
      setErrorMsg('Masukkan email terlebih dahulu.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const success = await pinLogin(identity, pin, rememberMe);
      if (success) {
        await fetchUser();
        const currentUser = useAuthStore.getState().user;
        navigate(getRedirectPathForRole(currentUser?.role || 'User') || '/dashboard', { replace: true });
      } else {
        setErrorMsg(useAuthStore.getState().error || 'Login PIN gagal.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
          Masuk ke Akun
        </h3>
        <p className="text-gray-500 text-sm">
          Akses transaksi PPOB dan manajemen akun GurkyNet Anda.
        </p>
      </div>

      {errorMsg && (
        <div 
          role="alert" 
          className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm animate-shake"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div 
          role="status" 
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-sm"
        >
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email or Phone Number Field */}
        <div>
          <label htmlFor="login-identity" className="block text-xs font-bold text-gray-700 mb-1.5">
            Email atau Nomor Handphone <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              id="login-identity"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="contoh: user@gurkynet.my.id atau 08123456789"
              {...identityRest}
              ref={(e) => {
                registerIdentityRef(e);
                identityInputRef.current = e;
              }}
              disabled={isLoading}
              className={`w-full pl-10 pr-4 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.identity ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.identity && (
            <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.identity.message}
            </p>
          )}
        </div>

        {/* Password Field with Show/Hide toggle */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-bold text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <Link 
              to="/forgot-password" 
              tabIndex={3}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
            >
              Lupa Password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan password Anda"
              {...register('password')}
              disabled={isLoading}
              className={`w-full pl-10 pr-12 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.password ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
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

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 focus:ring-offset-0 transition-colors"
            />
            <span className="text-xs font-medium text-gray-700">Ingat Saya di Perangkat Ini</span>
          </label>
          {storageService.getRememberedIdentity() && (
            <button
              type="button"
              onClick={() => setShowPinMode((prev) => !prev)}
              className="text-xs font-bold text-primary-600"
            >
              {showPinMode ? 'Gunakan Password' : 'Masuk dengan PIN'}
            </button>
          )}
        </div>

        {showPinMode && (
          <div className="space-y-3 rounded-2xl border border-primary-100 bg-primary-50 p-4">
            <p className="text-xs text-primary-800">
              Perangkat ini dikenali. Masukkan PIN 6 digit untuk masuk lebih cepat.
            </p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-2xl border border-primary-200 bg-white px-4 py-3 text-center text-base font-black tracking-[0.35em] text-gray-900"
              placeholder="000000"
            />
            <button
              type="button"
              disabled={isLoading || pin.length !== 6}
              onClick={onSubmitPin}
              className="w-full rounded-full bg-primary-700 text-white py-3 font-bold disabled:opacity-50"
            >
              Masuk dengan PIN
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed text-sm group"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Memproses Autentikasi...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Belum memiliki akun GurkyNet?{' '}
          <Link to="/register" className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
            Daftar Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
};
