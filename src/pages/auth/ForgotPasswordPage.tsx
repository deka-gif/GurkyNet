import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, KeyRound, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';

// Step 1 Schema: Request OTP
const step1Schema = z.object({
  phone: z
    .string()
    .min(10, 'Nomor HP minimal 10 digit')
    .max(13, 'Nomor HP maksimal 13 digit')
    .regex(/^08[0-9]{8,11}$/, 'Nomor HP harus diawali 08 dan hanya angka (10-13 digit)'),
});

// Step 2 Schema: Reset Password with OTP
const step2Schema = z
  .object({
    otpCode: z
      .string()
      .length(6, 'Kode OTP harus terdiri dari tepat 6 digit angka')
      .regex(/^[0-9]{6}$/, 'Kode OTP harus berupa 6 digit angka'),
    password: z
      .string()
      .min(8, 'Password baru minimal 8 karakter'),
    passwordConfirmation: z
      .string()
      .min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Konfirmasi password baru tidak cocok',
    path: ['passwordConfirmation'],
  });

type Step1Fields = z.infer<typeof step1Schema>;
type Step2Fields = z.infer<typeof step2Schema>;

export const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sandboxOtpCode, setSandboxOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  // Step 1 Form
  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    formState: { errors: errorsStep1 },
  } = useForm<Step1Fields>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      phone: '',
    },
  });

  // Step 2 Form
  const {
    register: registerStep2,
    handleSubmit: handleSubmitStep2,
    setValue: setValueStep2,
    formState: { errors: errorsStep2 },
  } = useForm<Step2Fields>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      otpCode: '',
      password: '',
      passwordConfirmation: '',
    },
  });

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Step 1: Submit Phone Number to Request OTP
  const onStep1Submit = async (data: Step1Fields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.requestOtp({
        phone_number: data.phone,
        action: 'password_reset',
      });

      if (response.success) {
        setPhoneNumber(data.phone);
        setStep(2);
        setCountdown(60); // 60s cooldown

        if (response.data?.dummy_sent_code) {
          setSandboxOtpCode(response.data.dummy_sent_code);
          setValueStep2('otpCode', response.data.dummy_sent_code);
        }

        setSuccessMsg(`Kode OTP telah dikirimkan ke nomor ${data.phone}. Silakan masukkan kode OTP dan kata sandi baru Anda.`);
      } else {
        setErrorMsg(response.message || 'Gagal mengirimkan kode OTP. Pastikan nomor handphone terdaftar.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim kode OTP. Silakan periksa kembali nomor HP Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP Action
  const handleResendOtp = async () => {
    if (countdown > 0 || !phoneNumber) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await authService.requestOtp({
        phone_number: phoneNumber,
        action: 'password_reset',
      });

      if (response.success) {
        setCountdown(60);
        if (response.data?.dummy_sent_code) {
          setSandboxOtpCode(response.data.dummy_sent_code);
          setValueStep2('otpCode', response.data.dummy_sent_code);
        }
        setSuccessMsg('Kode OTP baru telah berhasil dikirimkan.');
      } else {
        setErrorMsg(response.message || 'Gagal mengirim ulang OTP.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim ulang kode OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit OTP & New Password (Calls resetPassword directly, without verifyOtp)
  const onStep2Submit = async (data: Step2Fields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.resetPassword({
        phone_number: phoneNumber,
        otp_code: data.otpCode,
        password: data.password,
        password_confirmation: data.passwordConfirmation,
      });

      if (response.success) {
        setSuccessMsg('Kata sandi Anda berhasil diperbarui! Mengalihkan ke halaman login...');

        setTimeout(() => {
          navigate('/login', {
            state: {
              message: 'Kata sandi berhasil diperbarui. Silakan login dengan password baru Anda.',
            },
          });
        }, 1200);
      } else {
        setErrorMsg(response.message || 'Gagal memperbarui kata sandi. Periksa kode OTP Anda.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mereset password. Pastikan kode OTP masih berlaku.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link 
          to="/login" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login
        </Link>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
          {step === 1 ? 'Lupa Password' : 'Buat Password Baru'}
        </h3>
        <p className="text-gray-500 text-sm">
          {step === 1 
            ? 'Masukkan nomor handphone terdaftar untuk menerima 6-digit kode OTP pemulihan.' 
            : `Masukkan kode OTP yang dikirim ke ${phoneNumber} dan buat password baru Anda.`
          }
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
      </div>

      {/* Sandbox OTP Helper Alert for Reviewers */}
      {sandboxOtpCode && step === 2 && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Reviewer Sandbox OTP:</strong> Kode OTP Anda adalah{' '}
              <span className="font-mono font-bold tracking-widest text-primary-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                {sandboxOtpCode}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div 
          role="alert" 
          className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm animate-shake"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div 
          role="status" 
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-sm"
        >
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* ================= STEP 1: Phone Input ================= */}
      {step === 1 && (
        <form onSubmit={handleSubmitStep1(onStep1Submit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fp-phone" className="block text-xs font-bold text-gray-700 mb-1.5">
              Nomor Handphone Terdaftar <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Phone className="w-5 h-5" />
              </div>
              <input
                id="fp-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                placeholder="Contoh: 081234567890"
                {...registerStep1('phone')}
                disabled={isLoading}
                className={`w-full pl-10 pr-4 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errorsStep1.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
            </div>
            {errorsStep1.phone && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorsStep1.phone.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed text-sm group"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mengirim Kode OTP...</span>
              </>
            ) : (
              <>
                <span>Kirim Kode OTP</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ================= STEP 2: OTP & New Password ================= */}
      {step === 2 && (
        <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-4" noValidate>
          {/* OTP Code Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="fp-otp" className="block text-xs font-bold text-gray-700">
                Kode OTP (6 Digit) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSandboxOtpCode(null);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-semibold text-gray-500 hover:text-primary-600 hover:underline"
              >
                Ganti Nomor HP
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                id="fp-otp"
                type="text"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                {...registerStep2('otpCode')}
                disabled={isLoading}
                className={`w-full pl-10 pr-4 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errorsStep2.otpCode ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
            </div>
            {errorsStep2.otpCode && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorsStep2.otpCode.message}
              </p>
            )}
          </div>

          {/* New Password Field */}
          <div>
            <label htmlFor="fp-password" className="block text-xs font-bold text-gray-700 mb-1.5">
              Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="fp-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                {...registerStep2('password')}
                disabled={isLoading}
                className={`w-full pl-10 pr-12 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errorsStep2.password ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errorsStep2.password && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorsStep2.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="fp-confirm-password" className="block text-xs font-bold text-gray-700 mb-1.5">
              Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="fp-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
                {...registerStep2('passwordConfirmation')}
                disabled={isLoading}
                className={`w-full pl-10 pr-12 py-3 bg-gray-50/70 border rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  errorsStep2.passwordConfirmation ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errorsStep2.passwordConfirmation && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorsStep2.passwordConfirmation.message}
              </p>
            )}
          </div>

          {/* Resend OTP Link */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-gray-500">Tidak menerima kode OTP?</span>
            {countdown > 0 ? (
              <span className="font-semibold text-gray-400">Kirim ulang dalam {countdown} detik</span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading}
                className="font-bold text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Kirim Ulang OTP
              </button>
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
                <span>Memperbarui Kata Sandi...</span>
              </>
            ) : (
              <>
                <span>Simpan Kata Sandi Baru</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Footer */}
      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Ingat kata sandi Anda?{' '}
          <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
            Masuk Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
};
