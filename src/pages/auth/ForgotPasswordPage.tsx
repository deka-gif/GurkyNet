import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import { Button } from '../../components/ui/Button';

const step1Schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
});

const step2Schema = z.object({
  otpCode: z.string().length(6, 'Kode OTP harus 6 digit').regex(/^[0-9]{6}$/, 'Kode OTP harus berupa angka'),
  password: z.string().min(8, 'Password baru minimal 8 karakter'),
  passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Konfirmasi password baru tidak cocok',
  path: ['passwordConfirmation'],
});

type Step1Fields = z.infer<typeof step1Schema>;
type Step2Fields = z.infer<typeof step2Schema>;

export const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [sandboxOtpCode, setSandboxOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const { register: registerStep1, handleSubmit: handleSubmitStep1, formState: { errors: errorsStep1 } } = useForm<Step1Fields>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: '' },
  });
  const { register: registerStep2, handleSubmit: handleSubmitStep2, setValue: setValueStep2, formState: { errors: errorsStep2 } } = useForm<Step2Fields>({
    resolver: zodResolver(step2Schema),
    defaultValues: { otpCode: '', password: '', passwordConfirmation: '' },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const onStep1Submit = async (data: Step1Fields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await authService.forgotPassword({ email: data.email });
      if (response.success) {
        setEmail(data.email);
        setStep(2);
        setCountdown(60);
        const dummyCode = (response as any).data?.dummy_sent_code;
        if (dummyCode) {
          setSandboxOtpCode(dummyCode);
          setValueStep2('otpCode', dummyCode);
        }
        setSuccessMsg(`Kode OTP telah dikirim ke ${data.email}.`);
      } else {
        setErrorMsg(response.message || 'Gagal mengirimkan kode OTP.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim kode OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || !email) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await authService.forgotPassword({ email });
      if (response.success) {
        setCountdown(60);
        const dummyCode = (response as any).data?.dummy_sent_code;
        if (dummyCode) {
          setSandboxOtpCode(dummyCode);
          setValueStep2('otpCode', dummyCode);
        }
        setSuccessMsg('Kode OTP baru telah berhasil dikirimkan.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim ulang OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const onStep2Submit = async (data: Step2Fields) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await authService.resetPassword({
        email,
        otp_code: data.otpCode,
        new_password: data.password,
        new_password_confirmation: data.passwordConfirmation,
      });
      if (response.success) {
        setSuccessMsg('Password berhasil diperbarui. Anda akan diarahkan ke login.');
        setTimeout(() => navigate('/login', { state: { message: 'Password berhasil diperbarui. Silakan login kembali.' } }), 1200);
      } else {
        setErrorMsg(response.message || 'Gagal memperbarui password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mereset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login
        </Link>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">{step === 1 ? 'Lupa Password' : 'Buat Password Baru'}</h3>
        <p className="text-gray-500 text-sm">{step === 1 ? 'Masukkan email terdaftar untuk menerima OTP pemulihan.' : `Masukkan kode OTP yang dikirim ke ${email}.`}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
      </div>

      {sandboxOtpCode && step === 2 && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span><strong>Reviewer Sandbox OTP:</strong> <span className="font-mono font-bold tracking-widest text-primary-700 bg-white px-2 py-0.5 rounded border border-blue-200">{sandboxOtpCode}</span></span>
          </div>
        </div>
      )}

      {errorMsg && <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm"><AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" /><span className="font-medium">{errorMsg}</span></div>}
      {successMsg && <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 text-sm"><CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" /><span className="font-medium">{successMsg}</span></div>}

      {step === 1 && (
        <form onSubmit={handleSubmitStep1(onStep1Submit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fp-email" className="block text-xs font-bold text-gray-700 mb-1.5">Email Terdaftar</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-5 h-5" /></div>
              <input id="fp-email" type="email" autoComplete="email" autoFocus placeholder="Contoh: user@gurkynet.com" {...registerStep1('email')} disabled={isLoading} className={`w-full pl-10 pr-4 py-3 bg-gray-50/70 border rounded-2xl text-sm ${errorsStep1.email ? 'border-red-300' : 'border-gray-200'}`} />
            </div>
            {errorsStep1.email && <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsStep1.email.message}</p>}
          </div>
          <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
            {isLoading ? 'Mengirim OTP...' : <>Kirim Kode OTP <ArrowRight className="w-4 h-4" /></>}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-4" noValidate>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="fp-otp" className="block text-xs font-bold text-gray-700">Kode OTP</label>
              <button type="button" onClick={() => { setStep(1); setSandboxOtpCode(null); setErrorMsg(null); setSuccessMsg(null); }} className="text-xs font-semibold text-gray-500 hover:text-primary-600 hover:underline">Ganti Email</button>
            </div>
            <input id="fp-otp" inputMode="numeric" maxLength={6} placeholder="6 digit OTP" {...registerStep2('otpCode')} disabled={isLoading} className={`w-full rounded-2xl border px-4 py-3 text-center text-lg font-black tracking-[0.35em] ${errorsStep2.otpCode ? 'border-red-300' : 'border-gray-200'}`} />
            {errorsStep2.otpCode && <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsStep2.otpCode.message}</p>}
          </div>
          <div>
            <label htmlFor="fp-password" className="block text-xs font-bold text-gray-700 mb-1.5">Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-5 h-5" /></div>
              <input id="fp-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...registerStep2('password')} disabled={isLoading} className={`w-full pl-10 pr-10 py-3 bg-gray-50/70 border rounded-2xl text-sm ${errorsStep2.password ? 'border-red-300' : 'border-gray-200'}`} />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
            {errorsStep2.password && <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsStep2.password.message}</p>}
          </div>
          <div>
            <label htmlFor="fp-confirm-password" className="block text-xs font-bold text-gray-700 mb-1.5">Konfirmasi Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-5 h-5" /></div>
              <input id="fp-confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" {...registerStep2('passwordConfirmation')} disabled={isLoading} className={`w-full pl-10 pr-10 py-3 bg-gray-50/70 border rounded-2xl text-sm ${errorsStep2.passwordConfirmation ? 'border-red-300' : 'border-gray-200'}`} />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
            {errorsStep2.passwordConfirmation && <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsStep2.passwordConfirmation.message}</p>}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={handleResendOtp} disabled={countdown > 0 || isLoading} className="text-xs font-semibold text-primary-600 disabled:text-gray-400">{countdown > 0 ? `Kirim ulang dalam ${countdown}s` : 'Kirim ulang OTP'}</button>
          </div>
          <Button type="submit" variant="primary" disabled={isLoading} className="w-full">{isLoading ? 'Menyimpan password...' : 'Simpan Password Baru'}</Button>
        </form>
      )}
    </div>
  );
};
