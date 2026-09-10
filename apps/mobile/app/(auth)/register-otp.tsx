import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { authService } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';
import { parseApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme';

const OTP_LEN = 6;
const OTP_KEY_ROWS: Array<Array<'blank' | 'backspace' | string>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

/**
 * Verifikasi email OTP onboarding.
 * onComplete MUST call POST /auth/otp/verify — never advance on length===6 alone.
 * Layout mirrors unlock PIN + forgot-password OTP (full-screen white keypad).
 */
export default function RegisterOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  const params = useLocalSearchParams<{ onboarding_id?: string; email?: string }>();
  const onboardingId = Number(params.onboarding_id);
  const email = typeof params.email === 'string' ? params.email : '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const lockRef = useRef(false);
  const submittingRef = useRef(false);

  const keyHit = Math.min(68, Math.max(56, Math.round(windowWidth * 0.15)));
  const colGap = Math.max(36, Math.round(windowWidth * 0.14));
  const rowGap = Math.max(18, Math.min(34, Math.round(windowHeight * 0.032)));
  const slotStyle = { width: keyHit, height: keyHit };
  const otpFilled = Math.min(OTP_LEN, otp.replace(/\D/g, '').length);

  useEffect(() => {
    if (!onboardingId || !email) {
      router.replace('/(auth)/register');
    }
  }, [onboardingId, email, router]);

  useEffect(() => {
    if (resendAt == null) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);

  const resendSecondsLeft =
    resendAt != null ? Math.max(0, Math.ceil((resendAt - nowTs) / 1000)) : 0;

  const verifyOtp = async (code: string) => {
    if (lockRef.current || busy) return;
    if (!onboardingId) {
      setError('Sesi registrasi tidak valid. Silakan daftar ulang.');
      submittingRef.current = false;
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.verifyOnboardingOtp({
        onboarding_id: onboardingId,
        code,
      });
      if (res.success) {
        const finalizeToken = res.data?.finalize_token;
        if (!finalizeToken) {
          setOtp('');
          setError('Sesi verifikasi tidak lengkap. Silakan coba lagi.');
          return;
        }
        useAuthStore.getState().setPendingOnboardingFinalize({
          onboardingId,
          finalizeToken,
        });
        setOtp('');
        router.replace({
          pathname: '/(auth)/register-pin',
          params: { onboarding_id: String(onboardingId) },
        });
        return;
      }
      setOtp('');
      setError('OTP salah');
    } catch (err: unknown) {
      setOtp('');
      // Jangan tampilkan pesan validasi mentah backend (mis. "bidang action wajib diisi").
      setError('OTP salah');
    } finally {
      setBusy(false);
      lockRef.current = false;
      submittingRef.current = false;
    }
  };

  const appendDigit = (digit: string) => {
    if (busy || submittingRef.current) return;
    if (!/^\d$/.test(digit)) return;
    if (otp.length >= OTP_LEN) return;
    const next = `${otp}${digit}`.slice(0, OTP_LEN);
    setOtp(next);
    setError(null);
    if (next.length === OTP_LEN) {
      submittingRef.current = true;
      requestAnimationFrame(() => {
        void verifyOtp(next);
      });
    }
  };

  const backspace = () => {
    if (busy || submittingRef.current) return;
    if (!otp) return;
    setOtp(otp.slice(0, -1));
    setError(null);
  };

  const resendOtp = async () => {
    if (busy || resendSecondsLeft > 0 || !email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.resendOnboardingOtp({ email });
      if (res.success) {
        const at = res.data?.resend_available_at
          ? Date.parse(res.data.resend_available_at)
          : Date.now() + 60_000;
        setResendAt(Number.isFinite(at) ? at : Date.now() + 60_000);
        setOtp('');
        submittingRef.current = false;
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

  const goBack = () => {
    if (busy) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/register');
  };

  return (
    <View style={styles.fill}>
      <View
        style={[
          styles.body,
          {
            paddingTop: Math.max(insets.top, spacing.md),
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <Pressable
          onPress={goBack}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => [
            styles.backRow,
            pressed && !busy && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.gray[900]} />
          <Text style={styles.backLabel}>Kembali</Text>
        </Pressable>

        <View style={styles.upper}>
          <Text
            style={[styles.title, fontsLoaded && styles.titleModern]}
            accessibilityRole="header"
          >
            Verifikasi Email
          </Text>
          <Text style={[styles.subtitle, fontsLoaded && styles.subtitleModern]}>
            Masukkan kode 6 digit yang dikirim ke {email || 'email kamu'}
          </Text>

          <View
            style={styles.dotsWrap}
            accessibilityRole="text"
            accessibilityLabel={`OTP ${otpFilled} dari ${OTP_LEN} digit`}
          >
            {Array.from({ length: OTP_LEN }).map((_, i) => {
              const filled = i < otpFilled;
              return (
                <View
                  key={`otp-dot-${i}`}
                  style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                />
              );
            })}
          </View>

          {busy ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
            </View>
          ) : null}

          {error && !busy ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.midSpacer} />

        <View style={[styles.keypad, { gap: rowGap }]}>
          {OTP_KEY_ROWS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.keypadRow, { gap: colGap }]}>
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
                      onPress={backspace}
                      style={({ pressed }) => [
                        styles.iconSlot,
                        slotStyle,
                        pressed && !busy && styles.pressed,
                        busy && styles.disabled,
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
                    onPress={() => appendDigit(key)}
                    style={({ pressed }) => [
                      styles.digitSlot,
                      slotStyle,
                      { borderRadius: keyHit / 2 },
                      pressed && !busy && styles.digitPressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Text style={styles.digit}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.footerLinks}>
          <Pressable
            onPress={() => void resendOtp()}
            disabled={busy || resendSecondsLeft > 0}
            hitSlop={8}
          >
            <Text
              style={[styles.resend, (busy || resendSecondsLeft > 0) && styles.resendDisabled]}
            >
              {resendSecondsLeft > 0
                ? `Kirim ulang dalam ${resendSecondsLeft}d`
                : 'Kirim ulang kode'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.lowerSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.white,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
  },
  upper: {
    alignItems: 'center',
    paddingTop: spacing.lg + 40,
  },
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginLeft: -spacing.xs,
    // Turunkan ~0.5cm dari safe area (sebelumnya 38 ≈ 1cm).
    marginTop: 19,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  title: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  titleModern: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '400',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
    textAlign: 'center',
    letterSpacing: 0.15,
    paddingHorizontal: spacing.md,
  },
  subtitleModern: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '400',
  },
  dotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: spacing['3xl'] + spacing.md,
    minHeight: 22,
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[600],
  },
  loadingRow: {
    marginTop: spacing.md,
  },
  error: {
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
  midSpacer: {
    flexGrow: 0.45,
    minHeight: 16,
  },
  lowerSpacer: {
    flexGrow: 0.35,
    minHeight: 8,
  },
  keypad: {
    alignSelf: 'center',
    marginTop: 38,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  digitSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  digit: {
    fontSize: 32,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.55,
  },
  digitPressed: {
    backgroundColor: colors.gray[200],
  },
  disabled: {
    opacity: 0.35,
  },
  footerLinks: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  resend: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  resendDisabled: { color: colors.gray[400] },
});
