import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { getRedirectPathForRole } from '../../constants/auth';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';

const loginSchema = z.object({
  identity: z.string().min(1, 'Email atau Nomor HP wajib diisi'),
  password: z.string().min(6, 'Password minimal terdiri dari 6 karakter'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const navigate = useNavigate();
  const { login, fetchUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const success = await login(data);

      if (success) {
        setSuccessMsg('Login berhasil. Memuat profil...');

        // Hydrate Zustand with fresh data from /api/v1/auth/me
        await fetchUser();

        const currentUser = useAuthStore.getState().user;
        const role = currentUser?.role || 'User';

        // Auto-redirect based on role
        const targetPath = getRedirectPathForRole(role) || '/dashboard';
        navigate(targetPath);
      } else {
        const err = useAuthStore.getState().error;
        setErrorMsg(err || 'Autentikasi gagal. Silakan periksa kembali detail login Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-extrabold text-gray-900 mb-2">Masuk Akun</h3>
        <p className="text-gray-500 text-sm">Akses dashboard transaksi & portal manajemen GurkyNet</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Email / Username / No. HP</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="text"
              {...register('identity')}
              placeholder="contoh: admin@gurkynet.my.id atau cs@gurkynet.my.id"
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${errors.identity ? 'border-red-300' : 'border-gray-200'
                }`}
            />
          </div>
          {errors.identity && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.identity.message}</p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-gray-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary-600 hover:underline">
              Lupa Password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${errors.password ? 'border-red-300' : 'border-gray-200'
                }`}
            />
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Memproses Autentikasi...
            </>
          ) : (
            'Masuk Ke Dashboard'
          )}
        </button>
      </form>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Belum punya akun?{' '}
          <Link to="/register" className="font-bold text-primary-600 hover:underline">
            Daftar Gratis
          </Link>
        </p>
      </div>
    </div>
  );
};
