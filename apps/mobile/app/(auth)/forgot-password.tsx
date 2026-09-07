import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  PinKeypadPanel,
  AuthBrandHeader,
  AuthSuccessView,
  Button,
} from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import { parseApiError } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/theme';

type Step = 'email' | 'otp' | 'password' | 'success';

/**
 * Lupa Password — terpisah dari Lupa PIN.
 * requestForgotPassword → OTP (backend) → confirmForgotPassword → login.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const lockRef = useRef(false);
  const otpRef = useRef('');

  useEffect(() => {
    if (resendAt == null) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const resendSecondsLeft =
    resendAt != null ? Math.max(0, Math.ceil((resendAt - nowTs) / 1000)) : 0;

  const applyResendCooldown = (iso?: string | null) => {
    const at = iso ? Date.parse(iso) : Date.now() + 60_000;
    setResendAt(Number.isFinite(at) ? at : Date.now() + 60_000);
  };

  const requestOtp = async () => {
    if (lockRef.current || busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email wajib diisi.');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.requestForgotPassword(trimmed);
      if (res.success) {
        setEmail(trimmed);
        applyResendCooldown(res.data?.resend_available_at);
        setOtp('');
        otpRef.current = '';
        setStep('otp');
      } else {
        setError(res.message || 'Gagal mengirim kode verifikasi.');
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal mengirim kode verifikasi.');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const verifyOtpGate = async (code: string) => {
    // Store verified OTP locally then advance — confirm consumes OTP with new password.
    // Length alone is not enough: we only leave OTP step after user completed 6 digits
    // and we will re-validate with backend on confirmForgotPassword.
    if (lockRef.current || busy) return;
    otpRef.current = code;
    setOtp('');
    setPassword('');
    setPasswordConfirmation('');
    setError(null);
    setStep('password');
  };

  const resendOtp = async () => {
    if (busy || resendSecondsLeft > 0 || !email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.requestForgotPassword(email);
      if (res.success) {
        applyResendCooldown(res.data?.resend_available_at);
        setOtp('');
        otpRef.current = '';
      } else {
        setError(res.message || 'Gagal mengirim ulang OTP.');
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal mengirim ulang OTP.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPassword = async () => {
    if (lockRef.current || busy) return;
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!otpRef.current || otpRef.current.length !== 6) {
      setError('Kode OTP tidak valid. Silakan verifikasi ulang.');
      setStep('otp');
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.confirmForgotPassword({
        email,
        otp_code: otpRef.current,
        new_password: password,
        new_password_confirmation: passwordConfirmation,
      });
      if (res.success) {
        otpRef.current = '';
        setPassword('');
        setPasswordConfirmation('');
        setStep('success');
        return;
      }
      setError(res.message || 'Gagal mengubah kata sandi.');
      // Wrong OTP — stay / go back to OTP
      if (/otp|kode|verifikasi/i.test(res.message || '')) {
        otpRef.current = '';
        setOtp('');
        setStep('otp');
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setError(parsed.message || 'Gagal mengubah kata sandi.');
      if (
        parsed.errors?.otp_code ||
        parsed.errors?.otp ||
        /otp|kode|verifikasi/i.test(parsed.message || '')
      ) {
        otpRef.current = '';
        setOtp('');
        setStep('otp');
      }
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  if (step === 'success') {
    return (
      <AuthSuccessView
        title="Kata Sandi Diperbarui"
        message="Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru."
        buttonLabel="Kembali ke Masuk"
        onContinue={() => router.replace('/(auth)/login')}
      />
    );
  }

  if (step === 'otp') {
    return (
      <ScreenContainer scroll={false} padded>
        <View style={styles.body}>
          <AuthBrandHeader compact />
          <PinKeypadPanel
            title="Verifikasi Email"
            subtitle={`Masukkan kode 6 digit yang dikirim ke ${email}`}
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError(null);
            }}
            disabled={busy}
            error={error}
            onClose={() => {
              if (busy) return;
              setStep('email');
              setOtp('');
              otpRef.current = '';
              setError(null);
            }}
            onComplete={(code) => void verifyOtpGate(code)}
            footer={
              <View style={styles.footerCol}>
                <Pressable
                  onPress={() => void resendOtp()}
                  disabled={busy || resendSecondsLeft > 0}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.resend,
                      (busy || resendSecondsLeft > 0) && styles.resendDisabled,
                    ]}
                  >
                    {resendSecondsLeft > 0
                      ? `Kirim ulang dalam ${resendSecondsLeft}d`
                      : 'Kirim ulang kode'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    otpRef.current = '';
                    setError(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.backLink}>Ubah email</Text>
                </Pressable>
              </View>
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  if (step === 'password') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthBrandHeader compact subtitle="Buat kata sandi baru untuk akun kamu" />
          <Text style={styles.heading}>Kata Sandi Baru</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Kata Sandi Baru</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 karakter"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.gray[500]}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ulangi Kata Sandi</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                placeholder="Ulangi kata sandi"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.gray[500]}
                />
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label="Simpan Kata Sandi"
            onPress={() => void confirmPassword()}
            loading={busy}
            disabled={busy || password.length < 8 || !passwordConfirmation}
          />
          <Button
            label="Kembali"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setPassword('');
              setPasswordConfirmation('');
              setOtp('');
              setStep('otp');
              setError(null);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // step === 'email'
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBrandHeader subtitle="Reset kata sandi melalui email terdaftar" />
        <Text style={styles.heading}>Lupa Password</Text>
        <Text style={styles.lead}>
          Masukkan email akun. Kami akan kirim kode OTP untuk verifikasi.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="nama@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label="Kirim Kode"
          onPress={() => void requestOtp()}
          loading={busy}
          disabled={busy || !email.trim()}
        />
        <Button
          label="Kembali ke Masuk"
          variant="ghost"
          disabled={busy}
          onPress={() => router.replace('/(auth)/login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  body: { flex: 1, minHeight: 0 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  lead: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.gray[50],
    color: colors.gray[900],
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center' },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footerCol: { alignItems: 'center', gap: spacing.md },
  resend: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  resendDisabled: { color: colors.gray[400] },
  backLink: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
  },
});
