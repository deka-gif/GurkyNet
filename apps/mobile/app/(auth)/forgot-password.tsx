import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  AuthSuccessView,
  Button,
} from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import { parseApiError } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/theme';

type Step = 'email' | 'otp' | 'password' | 'success';

const OTP_LEN = 6;
const OTP_KEY_ROWS: Array<Array<'blank' | 'backspace' | string>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

/** Gembok padlock realistis (bukan ikon outline yang mirip tas). */
function PadlockIcon({ size = 44 }: { size?: number }) {
  const body = colors.primary[600];
  const dark = colors.primary[800];
  const light = colors.primary[400];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Gembok">
      {/* Shackle (gelang) */}
      <Path
        d="M20 28 V18 C20 10.3 26.3 4 34 4 C41.7 4 48 10.3 48 18 V28"
        stroke={dark}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M20 28 V18 C20 10.3 26.3 4 34 4 C41.7 4 48 10.3 48 18 V28"
        stroke={light}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      {/* Body */}
      <Rect x="12" y="26" width="44" height="34" rx="8" fill={body} />
      <Rect x="16" y="30" width="36" height="10" rx="4" fill={light} opacity={0.35} />
      {/* Keyhole */}
      <Circle cx="34" cy="42" r="5" fill={colors.white} />
      <Path d="M32 42 L32 52 L36 52 L36 42 Z" fill={colors.white} />
    </Svg>
  );
}

/** Kunci realistis untuk langkah buat kata sandi baru. */
function KeyIcon({ size = 44 }: { size?: number }) {
  const body = colors.primary[600];
  const dark = colors.primary[800];
  const light = colors.primary[400];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Kunci">
      {/* Head (bow) */}
      <Circle cx="22" cy="22" r="14" fill={body} />
      <Circle cx="22" cy="22" r="6.5" fill={colors.white} />
      {/* Shaft */}
      <Rect x="32" y="18" width="26" height="8" rx="3" fill={body} />
      {/* Highlight on shaft */}
      <Rect x="34" y="19.5" width="20" height="3" rx="1.5" fill={light} opacity={0.45} />
      {/* Teeth */}
      <Path d="M48 26 H54 V34 H48 Z" fill={dark} />
      <Path d="M40 26 H45 V31 H40 Z" fill={dark} />
    </Svg>
  );
}

/**
 * Lupa Password — terpisah dari Lupa PIN.
 * requestForgotPassword → OTP (backend) → confirmForgotPassword → login.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });

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
  const otpSubmittingRef = useRef(false);

  // Keypad spacing — mirror unlock PIN login.
  const keyHit = Math.min(68, Math.max(56, Math.round(windowWidth * 0.15)));
  const colGap = Math.max(36, Math.round(windowWidth * 0.14));
  const rowGap = Math.max(18, Math.min(34, Math.round(windowHeight * 0.032)));
  const slotStyle = { width: keyHit, height: keyHit };
  const otpFilled = Math.min(OTP_LEN, otp.replace(/\D/g, '').length);

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
    otpSubmittingRef.current = false;
    setPassword('');
    setPasswordConfirmation('');
    setError(null);
    setStep('password');
  };

  const appendOtpDigit = (digit: string) => {
    if (busy || otpSubmittingRef.current) return;
    if (!/^\d$/.test(digit)) return;
    if (otp.length >= OTP_LEN) return;
    const next = `${otp}${digit}`.slice(0, OTP_LEN);
    setOtp(next);
    setError(null);
    if (next.length === OTP_LEN) {
      otpSubmittingRef.current = true;
      requestAnimationFrame(() => {
        void verifyOtpGate(next);
      });
    }
  };

  const otpBackspace = () => {
    if (busy || otpSubmittingRef.current) return;
    if (!otp) return;
    setOtp(otp.slice(0, -1));
    setError(null);
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
        otpSubmittingRef.current = false;
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
        buttonLabel="Kembali Ke Login"
        onContinue={() => router.replace('/(auth)/login')}
      />
    );
  }

  if (step === 'otp') {
    return (
      <View style={styles.otpFill}>
        <View
          style={[
            styles.otpBody,
            {
              paddingTop: Math.max(insets.top, spacing['2xl']),
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          {/* Upper cluster — mirror unlock PIN login positions */}
          <View style={styles.otpUpper}>
            <Text
              style={[styles.otpTitle, fontsLoaded && styles.otpTitleModern]}
              accessibilityRole="header"
            >
              Verifikasi Email
            </Text>
            <Text style={[styles.otpSubtitle, fontsLoaded && styles.otpSubtitleModern]}>
              Masukkan kode 6 digit yang dikirim ke {email}
            </Text>

            <View
              style={styles.otpDotsWrap}
              accessibilityRole="text"
              accessibilityLabel={`OTP ${otpFilled} dari ${OTP_LEN} digit`}
            >
              {Array.from({ length: OTP_LEN }).map((_, i) => {
                const filled = i < otpFilled;
                return (
                  <View
                    key={`otp-dot-${i}`}
                    style={[styles.otpDot, filled ? styles.otpDotFilled : styles.otpDotEmpty]}
                  />
                );
              })}
            </View>

            {busy ? (
              <View style={styles.otpLoadingRow}>
                <ActivityIndicator color={colors.primary[600]} />
              </View>
            ) : null}

            {error && !busy ? <Text style={styles.otpError}>{error}</Text> : null}
          </View>

          <View style={styles.otpMidSpacer} />

          <View style={[styles.otpKeypad, { gap: rowGap }]}>
            {OTP_KEY_ROWS.map((row, rowIndex) => (
              <View key={`otp-row-${rowIndex}`} style={[styles.otpKeypadRow, { gap: colGap }]}>
                {row.map((key) => {
                  if (key === 'blank') {
                    return <View key="blank" style={slotStyle} />;
                  }
                  if (key === 'backspace') {
                    return (
                      <Pressable
                        key="backspace"
                        accessibilityRole="button"
                        accessibilityLabel="Hapus"
                        disabled={busy}
                        hitSlop={12}
                        onPress={otpBackspace}
                        style={({ pressed }) => [
                          styles.otpIconSlot,
                          slotStyle,
                          pressed && !busy && styles.otpPressed,
                          busy && styles.otpDisabled,
                        ]}
                      >
                        <Ionicons name="backspace-outline" size={26} color={colors.gray[600]} />
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Angka ${key}`}
                      disabled={busy}
                      hitSlop={8}
                      onPress={() => appendOtpDigit(key)}
                      style={({ pressed }) => [
                        styles.otpDigitSlot,
                        slotStyle,
                        { borderRadius: keyHit / 2 },
                        pressed && !busy && styles.otpDigitPressed,
                        busy && styles.otpDisabled,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.otpFooterLinks}>
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
                if (busy) return;
                setStep('email');
                setOtp('');
                otpRef.current = '';
                otpSubmittingRef.current = false;
                setError(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.backLink}>Ubah email</Text>
            </Pressable>
          </View>

          <View style={styles.otpLowerSpacer} />
        </View>
      </View>
    );
  }

  if (step === 'password') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.lockHeader}>
            <View style={styles.lockIconWrap}>
              <KeyIcon size={44} />
            </View>
            <Text style={styles.lockTitle}>Buat Kata Sandi Baru</Text>
            <Text style={styles.lockLead}>Buat kata sandi baru untuk akun kamu</Text>
          </View>

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
        <View style={styles.lockHeader}>
          <View style={styles.lockIconWrap}>
            <PadlockIcon size={44} />
          </View>
          <Text style={styles.lockTitle}>Lupa Password</Text>
          <Text style={styles.lockLead}>
            Masukkan email akun, kami kirim kode OTP untuk verifikasi
          </Text>
        </View>

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
          label="Kembali Ke Login"
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  // OTP step — mirror unlock PIN login vertical rhythm
  otpFill: {
    flex: 1,
    backgroundColor: colors.white,
  },
  otpBody: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
  },
  otpUpper: {
    alignItems: 'center',
    paddingTop: spacing.lg + 76,
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  otpTitleModern: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '400',
  },
  otpSubtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
    textAlign: 'center',
    letterSpacing: 0.15,
    paddingHorizontal: spacing.md,
  },
  otpSubtitleModern: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '400',
  },
  otpDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: spacing['3xl'] + spacing.md,
    minHeight: 22,
  },
  otpDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  otpDotEmpty: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    backgroundColor: 'transparent',
  },
  otpDotFilled: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[600],
  },
  otpLoadingRow: {
    marginTop: spacing.md,
  },
  otpError: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  otpMidSpacer: {
    flexGrow: 0.45,
    minHeight: 16,
  },
  otpLowerSpacer: {
    flexGrow: 0.35,
    minHeight: 8,
  },
  otpKeypad: {
    alignSelf: 'center',
    marginTop: 38,
  },
  otpKeypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  otpDigitSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  otpDigit: {
    fontSize: 32,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  otpIconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  otpPressed: {
    opacity: 0.55,
  },
  otpDigitPressed: {
    backgroundColor: colors.gray[200],
  },
  otpDisabled: {
    opacity: 0.35,
  },
  otpFooterLinks: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  lockHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -76,
    marginBottom: spacing.sm,
  },
  lockIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  lockTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  lockLead: {
    fontSize: typography.size.base,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
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
