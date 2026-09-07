import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PinConfirmModal } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { useWebsiteStore } from '../../src/store/website.store';
import {
  enableBiometricIfAvailable,
  getBiometricAvailability,
  promptBiometric,
} from '../../src/utils/biometric';
import { storageService } from '../../src/services/storage.service';
import { colors, spacing, typography } from '../../src/theme';

/**
 * Returning-user unlock — checkout master PIN UI (PinConfirmModal).
 * PIN → POST /auth/login/pin; 2FA challenge → existing login 2FA UI.
 * Biometric unlocks existing SecureStore session only (after explicit consent).
 */
export default function UnlockScreen() {
  const router = useRouter();
  const fetchSettings = useWebsiteStore((s) => s.fetchSettings);
  const pinLogin = useAuthStore((s) => s.pinLogin);
  const unlockWithExistingSession = useAuthStore((s) => s.unlockWithExistingSession);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const rememberedIdentity = useAuthStore((s) => s.rememberedIdentity);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [error, setError] = useState<string | null>(null);
  const [bioLabel, setBioLabel] = useState('Fingerprint');
  const [bioHardware, setBioHardware] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const lockRef = useRef(false);
  const bioTriedRef = useRef(false);

  const canUseBioUnlock = bioHardware && bioEnabled && !!token;

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
    const user = useAuthStore.getState().user;
    if (user && !user.hasPin) {
      router.replace('/(auth)/setup-pin');
      return;
    }
    router.replace('/(tabs)/home');
  }, [router]);

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
      // Reuse existing login 2FA UI — store already set twoFactorChallenge + gate.
      if (useAuthStore.getState().twoFactorChallenge) {
        router.replace('/(auth)/login');
        return;
      }
      setError(useAuthStore.getState().error || 'PIN tidak valid.');
    } finally {
      lockRef.current = false;
    }
  };

  const tryBiometric = useCallback(async () => {
    if (bioBusy || !canUseBioUnlock || !token) return;
    setBioBusy(true);
    setError(null);
    try {
      const ok = await promptBiometric('Masuk ke GurkyPay');
      if (!ok) {
        setError('Autentikasi biometrik gagal atau dibatalkan.');
        return;
      }
      const sessionOk = await unlockWithExistingSession();
      if (sessionOk) {
        await goHome();
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

  useEffect(() => {
    if (!canUseBioUnlock || bioTriedRef.current) return;
    bioTriedRef.current = true;
    void tryBiometric();
  }, [canUseBioUnlock, tryBiometric]);

  const displayError = error || storeError;
  const masked =
    rememberedIdentity && rememberedIdentity.includes('@')
      ? rememberedIdentity.replace(/(.{2}).+(@.+)/, '$1***$2')
      : rememberedIdentity
        ? rememberedIdentity.replace(/(\d{4})\d+(\d{3})/, '$1****$2')
        : 'akun kamu';

  return (
    <View style={styles.fill}>
      <PinConfirmModal
        visible
        title="Selamat datang kembali 👋"
        subtitle={`Masukkan PIN untuk melanjutkan\n${masked}`}
        loading={loading || bioBusy}
        error={displayError}
        hideForgotPin
        dismissible={false}
        onClose={() => {
          void switchAccount().then(() => router.replace('/(auth)/login'));
        }}
        onEditing={() => {
          setError(null);
          clearError();
        }}
        onSubmit={(entered) => void submitPin(entered)}
        footer={
          <View style={styles.footerCol}>
            {canUseBioUnlock ? (
              <Pressable
                onPress={() => void tryBiometric()}
                disabled={bioBusy || loading}
                hitSlop={8}
                style={styles.bioBtn}
                accessibilityRole="button"
                accessibilityLabel={`Masuk dengan ${bioLabel}`}
              >
                <Ionicons name="finger-print-outline" size={22} color={colors.primary[700]} />
                <Text style={styles.bioText}>Masuk dengan {bioLabel}</Text>
              </Pressable>
            ) : bioHardware ? (
              <Pressable
                onPress={() => void consentEnableBiometric()}
                disabled={bioBusy || loading}
                hitSlop={8}
                style={styles.bioBtn}
                accessibilityRole="button"
                accessibilityLabel={`Aktifkan ${bioLabel}`}
              >
                <Ionicons name="finger-print-outline" size={22} color={colors.primary[700]} />
                <Text style={styles.bioText}>Aktifkan {bioLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void switchAccount().then(() => router.replace('/(auth)/login'))}
              hitSlop={8}
            >
              <Text style={styles.switchText}>Gunakan akun lain</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.gray[50] },
  footerCol: { alignItems: 'center', gap: spacing.md },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  bioText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  switchText: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
  },
});
