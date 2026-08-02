import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { User, Phone, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal terdiri dari 3 karakter'),
  phone: z.string().min(10, 'Nomor HP minimal terdiri dari 10 digit').regex(/^[0-9]+$/, 'Nomor HP harus berupa angka'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal terdiri dari 8 karakter'),
  passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Konfirmasi password tidak sesuai",
  path: ["passwordConfirmation"],
});

type RegisterFields = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.register(data);
      if (response.success) {
        setSuccessMsg('Pendaftaran berhasil! Silakan masuk dengan akun baru Anda.');
        reset();
      } else {
        setErrorMsg('Registrasi gagal. Silakan periksa kembali data Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kendala pada pendaftaran. Silakan hubungi CS kami.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-3xl font-extrabold text-gray-900 mb-2">Daftar Akun</h3>
        <p className="text-gray-500">Mulai transaksi digital lebih mudah</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              {...register('fullName')}
              placeholder="Masukkan nama lengkap Anda"
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                errors.fullName ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="mt-1 text-xs font-semibold text-red-600">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Nomor Handphone</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Phone className="w-5 h-5" />
            </div>
            <input
              type="text"
              {...register('phone')}
              placeholder="Contoh: 08123456789"
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                errors.phone ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.phone && (
            <p className="mt-1 text-xs font-semibold text-red-600">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              {...register('email')}
              placeholder="Masukkan alamat email aktif"
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                errors.email ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs font-semibold text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                  errors.password ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs font-semibold text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Konfirmasi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                {...register('passwordConfirmation')}
                placeholder="••••••••"
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                  errors.passwordConfirmation ? 'border-red-300' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.passwordConfirmation && (
              <p className="mt-1 text-xs font-semibold text-red-600">{errors.passwordConfirmation.message}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Membuat Akun...
            </>
          ) : (
            'Buat Akun Baru'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-bold text-primary-600 hover:underline">
            Masuk Di Sini
          </Link>
        </p>
      </div>
    </div>
  );
};
