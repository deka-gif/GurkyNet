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
import { useAuthStore } from '../../src/store/auth.store';
import { colors, spacing, typography } from '../../src/theme';

type Step = 'enter' | 'confirm';

const PIN_LEN = 6;
const KEY_ROWS: Array<Array<'blank' | 'backspace' | string>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['blank', '0', 'backspace'],
];

/**
 * Buat PIN onboarding — layout mirror unlock PIN + register OTP (full-screen white).
 * PIN only in local refs. Success → register-success.
 */
export default function RegisterPinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  const params = useLocalSearchParams<{ onboarding_id?: string }>();
  const onboardingId = Number(params.onboarding_id);

  const finalizeRegistration = useAuthStore((s) => s.finalizeRegistration);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const firstPinRef = useRef('');
  const lockRef = useRef(false);
  const submittingRef = useRef(false);

  const keyHit = Math.min(68, Math.max(56, Math.round(windowWidth * 0.15)));
  const colGap = Math.max(36, Math.round(windowWidth * 0.14));
  const rowGap = Math.max(18, Math.min(34, Math.round(windowHeight * 0.032)));
  const slotStyle = { width: keyHit, height: keyHit };
  const pinFilled = Math.min(PIN_LEN, pin.replace(/\D/g, '').length);
  const locked = loading;
  const displayError = error || storeError;

  const title = step === 'enter' ? 'Buat PIN' : 'Konfirmasi PIN';
  const subtitle =
    step === 'enter'
      ? 'Masukkan 6 digit PIN untuk mengamankan akun kamu'
      : 'Masukkan kembali PIN kamu';

  useEffect(() => {
    if (!onboardingId) {
      router.replace('/(auth)/register');
    }
  }, [onboardingId, router]);

  const submit = async (pinValue: string, confirmValue: string) => {
    if (lockRef.current || loading) return;
    if (pinValue !== confirmValue) {
      setError('PIN tidak sama.');
      setPin('');
      submittingRef.current = false;
      setStep('confirm');
      return;
    }
    if (!onboardingId) {
      setError('Sesi registrasi tidak valid. Silakan daftar ulang.');
      submittingRef.current = false;
      return;
    }

    lockRef.current = true;
    clearError();
    setError(null);
    try {
      const ok = await finalizeRegistration({
        onboarding_id: onboardingId,
        pin: pinValue,
        pin_confirmation: confirmValue,
      });
      firstPinRef.current = '';
      setPin('');
      if (ok) {
        router.replace('/(auth)/register-success');
        return;
      }
      setError(useAuthStore.getState().error || 'Gagal menyelesaikan registrasi.');
      setStep('enter');
    } finally {
      lockRef.current = false;
      submittingRef.current = false;
    }
  };

  const onComplete = (entered: string) => {
    if (step === 'enter') {
      firstPinRef.current = entered;
      setPin('');
      submittingRef.current = false;
      setStep('confirm');
      setError(null);
      clearError();
      return;
    }
    void submit(firstPinRef.current, entered);
  };

  const appendDigit = (digit: string) => {
    if (locked || submittingRef.current) return;
    if (!/^\d$/.test(digit)) return;
    if (pin.length >= PIN_LEN) return;
    const next = `${pin}${digit}`.slice(0, PIN_LEN);
    setPin(next);
    setError(null);
    clearError();
    if (next.length === PIN_LEN) {
      submittingRef.current = true;
      requestAnimationFrame(() => {
        onComplete(next);
      });
    }
  };

  const backspace = () => {
    if (locked || submittingRef.current) return;
    if (!pin) return;
    setPin(pin.slice(0, -1));
    setError(null);
    clearError();
  };

  const goBack = () => {
    if (locked) return;
    if (step === 'confirm') {
      firstPinRef.current = '';
      setPin('');
      submittingRef.current = false;
      setStep('enter');
      setError(null);
      clearError();
      return;
    }
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
          disabled={locked}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => [
            styles.backRow,
            pressed && !locked && styles.pressed,
            locked && styles.disabled,
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
            {title}
          </Text>
          <Text style={[styles.subtitle, fontsLoaded && styles.subtitleModern]}>
            {subtitle}
          </Text>

          <View
            style={styles.dotsWrap}
            accessibilityRole="text"
            accessibilityLabel={`PIN ${pinFilled} dari ${PIN_LEN} digit`}
          >
            {Array.from({ length: PIN_LEN }).map((_, i) => {
              const filled = i < pinFilled;
              return (
                <View
                  key={`pin-dot-${i}`}
                  style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                />
              );
            })}
          </View>

          {locked ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
            </View>
          ) : null}

          {displayError && !locked ? <Text style={styles.error}>{displayError}</Text> : null}
        </View>

        <View style={styles.midSpacer} />

        <View style={[styles.keypad, { gap: rowGap }]}>
          {KEY_ROWS.map((row, rowIndex) => (
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
                      disabled={locked}
                      hitSlop={12}
                      onPress={backspace}
                      style={({ pressed }) => [
                        styles.iconSlot,
                        slotStyle,
                        pressed && !locked && styles.pressed,
                        locked && styles.disabled,
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
                    disabled={locked}
                    hitSlop={8}
                    onPress={() => appendDigit(key)}
                    style={({ pressed }) => [
                      styles.digitSlot,
                      slotStyle,
                      { borderRadius: keyHit / 2 },
                      pressed && !locked && styles.digitPressed,
                      locked && styles.disabled,
                    ]}
                  >
                    <Text style={styles.digit}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
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
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginLeft: -spacing.xs,
    // Naikkan ~0.5cm dari posisi sebelumnya (38 → 19).
    marginTop: 19,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  upper: {
    alignItems: 'center',
    paddingTop: spacing.lg + 40,
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
    flexGrow: 0.55,
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
});
