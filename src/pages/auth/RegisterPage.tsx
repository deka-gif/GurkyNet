import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(3, 'Nama lengkap minimal 3 karakter')
      .max(255, 'Nama lengkap maksimal 255 karakter'),
    email: z
      .string()
      .min(1, 'Email wajib diisi')
      .email('Format alamat email tidak valid'),
    phone: z
      .string()
      .min(10, 'Nomor HP minimal 10 digit')
      .max(13, 'Nomor HP maksimal 13 digit')
      .regex(/^08[0-9]{8,11}$/, 'Nomor HP harus diawali 08 dan hanya berisi angka (10-13 digit)'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter'),
    passwordConfirmation: z
      .string()
      .min(1, 'Konfirmasi password wajib diisi'),
    agreeTerms: z
      .boolean()
      .refine((val) => val === true, {
        message: 'Anda wajib menyetujui Syarat & Ketentuan untuk mendaftar',
      }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Konfirmasi password tidak cocok dengan password di atas',
    path: ['passwordConfirmation'],
  });

type RegisterFields = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFields>({
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

  const onSubmit = async (data: RegisterFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.register(data);

      if (response.success) {
        setSuccessMsg('Registrasi berhasil! Akun dan dompet Anda siap digunakan.');
        
        // Redirect to login with friendly flash state message
        setTimeout(() => {
          navigate('/login', {
            state: {
              message: 'Pendaftaran akun berhasil! Silakan masuk dengan email/nomor HP Anda.',
            },
          });
        }, 800);
      } else {
        setErrorMsg(response.message || 'Pendaftaran gagal. Silakan periksa kembali data Anda.');
      }
    } catch (err: any) {
      if (err.errors) {
        // Map backend validation errors to form fields
        if (err.errors.email) {
          setError('email', { message: err.errors.email[0] });
        }
        if (err.errors.phone_number) {
          setError('phone', { message: err.errors.phone_number[0] });
        }
        if (err.errors.password) {
          setError('password', { message: err.errors.password[0] });
        }
        if (err.errors.name) {
          setError('fullName', { message: err.errors.name[0] });
        }
      }
      setErrorMsg(err.message || 'Terjadi kendala saat registrasi. Silakan coba kembali.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
          Daftar Akun Baru
        </h3>
        <p className="text-gray-500 text-sm">
          Mulai bertransaksi produk digital PPOB cepat, aman, & hemat.
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
        {/* Full Name */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-bold text-gray-700 mb-1.5">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <User className="w-5 h-5" />
            </div>
            <input
              id="reg-fullname"
              type="text"
              autoComplete="name"
              placeholder="Contoh: Budi Santoso"
              {...register('fullName')}
              disabled={isLoading}
              className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.fullName ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Phone & Email Grid on Tablet/Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Phone Number */}
          <div>
            <label htmlFor="reg-phone" className="block text-xs font-bold text-gray-700 mb-1.5">
              Nomor Handphone <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="reg-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="08xxxxxxxxxx"
                {...register('phone')}
                disabled={isLoading}
                className={`w-full pl-9 pr-3 py-2.5 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-xs font-bold text-gray-700 mb-1.5">
              Email Aktif <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                {...register('email')}
                disabled={isLoading}
                className={`w-full pl-9 pr-3 py-2.5 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.email ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        {/* Password & Password Confirmation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="block text-xs font-bold text-gray-700 mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 karakter"
                {...register('password')}
                disabled={isLoading}
                className={`w-full pl-9 pr-10 py-2.5 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.password ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Password Confirmation */}
          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-gray-700 mb-1.5">
              Konfirmasi Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi password"
                {...register('passwordConfirmation')}
                disabled={isLoading}
                className={`w-full pl-9 pr-10 py-2.5 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.passwordConfirmation ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showConfirmPassword ? 'Sembunyikan password konfirmasi' : 'Tampilkan password konfirmasi'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.passwordConfirmation && (
              <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.passwordConfirmation.message}
              </p>
            )}
          </div>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register('agreeTerms')}
              disabled={isLoading}
              className="w-4 h-4 mt-0.5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 focus:ring-offset-0 transition-colors"
            />
            <span className="text-xs text-gray-600 leading-snug">
              Saya menyetujui{' '}
              <a 
                href="#terms" 
                onClick={(e) => { e.preventDefault(); alert('Syarat & Ketentuan Layanan GurkyNet: Pengguna wajib memberikan data yang valid untuk keperluan verifikasi dan keamanan transaksi.'); }}
                className="font-bold text-primary-600 hover:underline"
              >
                Syarat & Ketentuan
              </a>{' '}
              serta{' '}
              <a 
                href="#privacy" 
                onClick={(e) => { e.preventDefault(); alert('Kebijakan Privasi GurkyNet: Data Anda dilindungi dengan standar keamanan enkripsi SSL/TLS.'); }}
                className="font-bold text-primary-600 hover:underline"
              >
                Kebijakan Privasi
              </a>{' '}
              GurkyNet.
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="mt-1 text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.agreeTerms.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed text-sm group"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Mendaftarkan Akun...</span>
            </>
          ) : (
            <>
              <span>Buat Akun GurkyNet</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Sudah memiliki akun GurkyNet?{' '}
          <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
            Masuk di Sini
          </Link>
        </p>
      </div>
    </div>
  );
};
