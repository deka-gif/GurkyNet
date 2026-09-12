import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { PlatformLogo } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { useWebsiteStore } from '../../src/store/website.store';
import {
  enableBiometricIfAvailable,
  getBiometricAvailability,
  promptBiometric,
} from '../../src/utils/biometric';
import { storageService } from '../../src/services/storage.service';
import { colors, spacing, typography } from '../../src/theme';

const PIN_LEN = 6;
const KEY_ROWS: Array<Array<'bio' | 'backspace' | string>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'backspace'],
];

/**
 * App unlock — OVO-style vertical rhythm (air gaps + sticky footer), GurkyNet brand.
 * Auth logic unchanged from a86a324.
 */
export default function UnlockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  const fetchSettings = useWebsiteStore((s) => s.fetchSettings);
  const logo = useWebsiteStore((s) => s.logo);
  const websiteName = useWebsiteStore((s) => s.websiteName);

  const pinLogin = useAuthStore((s) => s.pinLogin);
  const unlockWithExistingSession = useAuthStore((s) => s.unlockWithExistingSession);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const rememberedIdentity = useAuthStore((s) => s.rememberedIdentity);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioLabel, setBioLabel] = useState('Fingerprint');
  const [bioHardware, setBioHardware] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const lockRef = useRef(false);
  const submittingRef = useRef(false);

  const canUseBioUnlock = bioHardware && bioEnabled && !!token;
  const locked = loading || bioBusy;

  const displayName = useMemo(() => {
    const fromUser = user?.name?.trim();
    if (fromUser) return fromUser;
    if (rememberedIdentity?.includes('@')) {
      const local = rememberedIdentity.split('@')[0]?.trim();
      if (local) return local;
    }
    return 'kamu';
  }, [user?.name, rememberedIdentity]);

  // Keypad: gap kolom lebih lebar → 1/4/7/bio ke kiri, 3/6/9 ke kanan.
  const keyHit = Math.min(68, Math.max(56, Math.round(windowWidth * 0.15)));
  const colGap = Math.max(36, Math.round(windowWidth * 0.14));
  const rowGap = Math.max(18, Math.min(34, Math.round(windowHeight * 0.032)));

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    void (async () => {
      const avail = await getBiometricAvailability();
      const enabled = await storageService.getBiometricEnabled();
      setBioLabel(avail.label);
      setBioHardware(avail.supported && avail.enrolled);
      setBioEnabled(enabled);
    })();
  }, [token]);

  const goHome = useCallback(async () => {
    const nextUser = useAuthStore.getState().user;
    if (nextUser && !nextUser.hasPin) {
      router.replace('/(auth)/setup-pin');
      return;
    }
    router.replace('/(tabs)/home');
  }, [router]);

  const clearPinDigits = () => {
    setPin('');
    submittingRef.current = false;
  };

  const submitPin = async (entered: string) => {
    if (lockRef.current || loading) return;
    lockRef.current = true;
    clearError();
    setError(null);
    try {
      const ok = await pinLogin(entered);
      if (ok) {
        await goHome();
        return;
      }
      if (useAuthStore.getState().twoFactorChallenge) {
        router.replace('/(auth)/login');
        return;
      }
      // Account/session definitively invalid → pinLogin cleared identity → Login.
      const after = useAuthStore.getState();
      if (after.gate === 'login' && !after.rememberedIdentity) {
        router.replace('/(auth)/login');
        return;
      }
      setError('PIN SALAH');
      clearPinDigits();
    } finally {
      lockRef.current = false;
      submittingRef.current = false;
    }
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
        void submitPin(next);
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

  const tryBiometric = useCallback(async () => {
    if (bioBusy || !canUseBioUnlock || !token) return;
    setBioBusy(true);
    setError(null);
    try {
      const ok = await promptBiometric('Masuk ke GurkyPay');
      // Batal / gagal biometrik: diam saja, user bisa lanjut pakai PIN.
      if (!ok) return;
      const sessionOk = await unlockWithExistingSession();
      if (sessionOk) {
        await goHome();
        return;
      }
      if (useAuthStore.getState().gate === 'login') {
        router.replace('/(auth)/login');
        return;
      }
      setError('Sesi sudah tidak valid. Masukkan PIN atau gunakan akun lain.');
    } finally {
      setBioBusy(false);
    }
  }, [bioBusy, canUseBioUnlock, goHome, token, unlockWithExistingSession]);

  const consentEnableBiometric = async () => {
    if (bioBusy || loading || !bioHardware) return;
    setBioBusy(true);
    setError(null);
    try {
      const ok = await enableBiometricIfAvailable();
      if (ok) {
        setBioEnabled(true);
      } else {
        setError(`${bioLabel} tidak tersedia di perangkat ini.`);
      }
    } finally {
      setBioBusy(false);
    }
  };

  const onSwitchAccount = () => {
    void switchAccount().then(() => router.replace('/(auth)/login'));
  };

  // Account PIN recovery — destinasi sama dengan Lupa PIN di area Akun.
  const onForgotPin = () => {
    router.push('/akun/pin/forgot');
  };

  const displayError = error || storeError;
  const pinFilled = Math.min(PIN_LEN, pin.replace(/\D/g, '').length);
  const slotStyle = { width: keyHit, height: keyHit };
  // Lebar kolom = keyHit agar sidik jari / teks sejajar pusat dengan 1·4·7 (dan 3·6·9).
  const sideColStyle = { width: keyHit, alignItems: 'center' as const };

  return (
    <View style={styles.fill}>
      <View
        style={[
          styles.body,
          {
            paddingTop: Math.max(insets.top, spacing['2xl']),
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        {/* Top cluster — logo + greeting + PIN dots (OVO upper block) */}
        <View style={styles.upper}>
          <View style={styles.logoWrap}>
            {logo ? (
              <PlatformLogo logo={logo} height={72} contentScale={1.22} />
            ) : (
              <Image
                source={require('../../assets/splash-icon.png')}
                style={styles.logoFallback}
                resizeMode="contain"
                accessibilityLabel={websiteName || 'GurkyPay'}
              />
            )}
          </View>

          <Text
            style={[styles.greeting, fontsLoaded && styles.greetingModern]}
            accessibilityRole="header"
          >
            Halo, {displayName}
          </Text>
          <Text style={[styles.subtitle, fontsLoaded && styles.subtitleModern]}>
            Masukkan PIN
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
                  key={`dot-${i}`}
                  style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
                />
              );
            })}
          </View>

          {/* Slot tinggi tetap: teks Face ID tidak boleh mendorong keypad. */}
          <View style={styles.consentSlot}>
            {bioHardware && !bioEnabled ? (
              <Pressable
                onPress={() => void consentEnableBiometric()}
                disabled={locked}
                hitSlop={8}
                style={styles.consentWrap}
                accessibilityRole="button"
                accessibilityLabel={`Aktifkan ${bioLabel}`}
              >
                <Text style={styles.consentText}>Aktifkan {bioLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          {locked ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary[600]} />
            </View>
          ) : null}

          {displayError && !locked ? <Text style={styles.error}>{displayError}</Text> : null}
        </View>

        {/* Spacer fleksibel di atas keypad — keypad tetap di blok bawah. */}
        <View style={styles.midSpacer} />

        {/* Airy keypad */}
        <View style={[styles.keypad, { gap: rowGap }]}>
          {KEY_ROWS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.keypadRow, { gap: colGap }]}>
              {row.map((key) => {
                if (key === 'bio') {
                  return (
                    <View key="bio-col" style={sideColStyle}>
                      {canUseBioUnlock ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Masuk dengan ${bioLabel}`}
                          disabled={locked}
                          hitSlop={12}
                          onPress={() => void tryBiometric()}
                          style={({ pressed }) => [
                            styles.iconSlot,
                            slotStyle,
                            pressed && !locked && styles.pressed,
                            locked && styles.disabled,
                          ]}
                        >
                          <Ionicons
                            name="finger-print-outline"
                            size={30}
                            color={colors.primary[600]}
                          />
                        </Pressable>
                      ) : (
                        <View
                          style={slotStyle}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                      )}
                      <Pressable
                        onPress={onSwitchAccount}
                        accessibilityRole="button"
                        accessibilityLabel="Gunakan akun lain"
                        hitSlop={6}
                        style={[styles.sideLinkWrap, { width: keyHit }]}
                      >
                        <Text style={styles.sideLinkText} numberOfLines={2}>
                          Gunakan akun lain
                        </Text>
                      </Pressable>
                    </View>
                  );
                }

                if (key === 'backspace') {
                  return (
                    <View key="backspace-col" style={sideColStyle}>
                      <Pressable
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
                      <Pressable
                        onPress={onForgotPin}
                        accessibilityRole="button"
                        accessibilityLabel="Lupa PIN"
                        hitSlop={6}
                        style={[styles.sideLinkWrap, { width: keyHit }]}
                      >
                        <Text style={styles.sideLinkText}>LUPA PIN</Text>
                      </Pressable>
                    </View>
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
    // Turunkan blok Halo + Masukkan PIN ~2cm.
    paddingTop: spacing.lg + 76,
  },
  logoWrap: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  logoFallback: {
    width: 80,
    height: 80,
  },
  greeting: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  greetingModern: {
    fontFamily: 'PlusJakartaSans_700Bold',
    // Weight baked into the font file — avoid Android synthetic bold miss.
    fontWeight: '400',
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
    textAlign: 'center',
    letterSpacing: 0.15,
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
    // Sedikit lebih dekat ke "Masukkan PIN".
    marginTop: spacing.lg,
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
  consentSlot: {
    marginTop: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  consentWrap: {
    paddingVertical: spacing.xs,
  },
  consentText: {
    fontSize: 13,
    fontWeight: typography.weight.medium,
    color: colors.primary[700],
    textAlign: 'center',
  },
  loadingRow: {
    marginTop: spacing.sm,
  },
  error: {
    marginTop: spacing.sm,
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
    flex: 1,
    minHeight: 12,
  },
  keypad: {
    alignSelf: 'center',
    marginBottom: spacing.md,
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
  sideLinkWrap: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLinkText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textAlign: 'center',
    letterSpacing: 0.2,
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
