import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';

const forgotPasswordSchema = z.object({
  identity: z.string().min(1, 'Email atau Nomor HP wajib diisi'),
});

type ForgotPasswordFields = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.forgotPassword(data);
      if (response.success) {
        setSuccessMsg('Kode OTP atau link pemulihan telah dikirimkan ke kontak Anda.');
        reset();
      } else {
        setErrorMsg('Data kontak tidak ditemukan. Silakan periksa kembali.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem. Silakan coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline mb-4">
          <ArrowLeft /> Kembali ke Halaman Login
        </Link>
        <h3 className="text-3xl font-extrabold text-gray-900 mb-2">Reset Password</h3>
        <p className="text-gray-500">Masukkan Email atau Nomor HP Anda untuk mendapatkan instruksi pemulihan</p>
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Email atau Nomor HP Terdaftar</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="text"
              {...register('identity')}
              placeholder="contoh@email.com atau 08123456789"
              className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                errors.identity ? 'border-red-300' : 'border-gray-200'
              }`}
            />
          </div>
          {errors.identity && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.identity.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Mengirimkan...
            </>
          ) : (
            'Kirim Instruksi Pemulihan'
          )}
        </button>
      </form>
    </div>
  );
};
