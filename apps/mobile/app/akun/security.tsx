import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  PinConfirmModal,
} from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import {
  profileService,
  SecurityOverview,
  SecuritySessionToken,
} from '../../src/services/profile.service';
import { parseApiError } from '../../src/api/client';
import { storageService } from '../../src/services/storage.service';
import { getDeviceModel, getOsVersion } from '../../src/utils/deviceInfo';
import {
  disableUnlockBiometric,
  enableBiometricIfAvailable,
  getBiometricAvailability,
} from '../../src/utils/biometric';
import {
  disableTransactionBiometric,
  enrollTransactionBiometricWithVerifiedPin,
  revokeSanctumTokenBestEffort,
} from '../../src/utils/transactionPinVault';
import { colors, radius, spacing, typography } from '../../src/theme';

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function isTechnicalLabel(raw: string | null | undefined): boolean {
  if (!raw) return true;
  if (/okhttp|axios|curl|python-requests|postman/i.test(raw)) return true;
  if (/^[a-z]+\|/i.test(raw)) return true; // platform|uuid token name
  return false;
}

function sessionLabel(token: SecuritySessionToken): string {
  if (token.device_model && !isTechnicalLabel(token.device_model)) {
    return token.device_model;
  }
  if (token.name && !isTechnicalLabel(token.name)) {
    return token.name;
  }
  if (token.is_current) return 'Perangkat ini';
  if (token.platform === 'android') return 'Perangkat Android';
  if (token.platform === 'ios') return 'Perangkat iOS';
  if (token.platform === 'web' || token.platform === 'pwa') return 'Browser Web';
  return 'Perangkat';
}

function platformLabel(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p === 'android') return 'Android';
  if (p === 'ios') return 'iOS';
  if (p === 'web' || p === 'pwa') return 'Web';
  return platform;
}

/**
 * Keamanan & PIN — PIN status, biometrik (2 toggle terpisah), Sesi & Perangkat.
 * Toggle 1 = Unlock (no PIN vault). Toggle 2 = transaksi (vault PIN + requireAuthentication).
 * Ubah PIN → PUT /pin/change. Lupa PIN → OTP email recovery.
 */
export default function AccountSecurityScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const applySession = useAuthStore((s) => s.applySession);
  const rememberedIdentity = useAuthStore((s) => s.rememberedIdentity);

  const [data, setData] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const lockRef = useRef(false);

  const [bioLabel, setBioLabel] = useState('Fingerprint');
  const [bioHardware, setBioHardware] = useState(false);
  const [unlockBioOn, setUnlockBioOn] = useState(false);
  const [txBioOn, setTxBioOn] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [enrollPinOpen, setEnrollPinOpen] = useState(false);
  const [enrollPinError, setEnrollPinError] = useState<string | null>(null);
  const [enrollPinLoading, setEnrollPinLoading] = useState(false);

  const loadBioPrefs = useCallback(async () => {
    const avail = await getBiometricAvailability();
    const unlockOn = await storageService.getBiometricUnlockEnabled();
    const txOn = await storageService.getBiometricTxEnabled();
    setBioLabel(avail.label);
    setBioHardware(!!(avail.supported && avail.enrolled));
    setUnlockBioOn(unlockOn);
    setTxBioOn(txOn);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Best-effort device upsert so labels prefer device_model over okhttp UA.
      try {
        const device_uuid = await storageService.getDeviceUuid();
        if (device_uuid) {
          await profileService.registerDevice({
            device_uuid,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            device_model: getDeviceModel(),
            os_version: getOsVersion(),
            app_version: Constants.expoConfig?.version ?? undefined,
          });
        }
      } catch {
        // ignore — sessions still load
      }

      await fetchUser();
      await loadBioPrefs();
      const res = await profileService.getSecurity();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
        setError(res.message || 'Gagal memuat keamanan.');
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal memuat keamanan.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUser, loadBioPrefs]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPin = !!(user?.hasPin || data?.has_pin);

  const resolveIdentity = (): string => {
    return (
      rememberedIdentity?.trim() ||
      user?.email?.trim() ||
      user?.phone?.trim() ||
      ''
    );
  };

  const onToggleUnlockBio = (next: boolean) => {
    if (bioBusy) return;
    if (!bioHardware) {
      Alert.alert(
        `${bioLabel} tidak tersedia`,
        'Perangkat ini tidak punya biometrik terdaftar di sistem.'
      );
      return;
    }
    void (async () => {
      setBioBusy(true);
      try {
        if (!next) {
          await disableUnlockBiometric();
          setUnlockBioOn(false);
          return;
        }
        const ok = await enableBiometricIfAvailable();
        if (ok) {
          setUnlockBioOn(true);
        } else {
          setUnlockBioOn(false);
          Alert.alert('Dibatalkan', `${bioLabel} dibatalkan atau gagal. Toggle tidak diaktifkan.`);
        }
      } finally {
        setBioBusy(false);
      }
    })();
  };

  const onToggleTxBio = (next: boolean) => {
    if (bioBusy) return;
    if (!hasPin) {
      Alert.alert('PIN belum dibuat', 'Buat PIN transaksi dulu sebelum mengaktifkan biometrik transaksi.');
      return;
    }
    if (!bioHardware) {
      Alert.alert(
        `${bioLabel} tidak tersedia`,
        'Perangkat ini tidak punya biometrik terdaftar di sistem.'
      );
      return;
    }
    if (!next) {
      void (async () => {
        setBioBusy(true);
        try {
          await disableTransactionBiometric();
          setTxBioOn(false);
        } finally {
          setBioBusy(false);
        }
      })();
      return;
    }

    // Toggle 2 ON — wajib penjelasan + verifikasi PIN ke server sebelum vault diisi.
    Alert.alert(
      `Aktifkan ${bioLabel} untuk transaksi?`,
      'Fitur ini akan menyimpan PIN kamu dalam bentuk terenkripsi di perangkat ini, dilindungi biometrik sistem operasi (Keychain/Keystore). PIN tetap dikirim dan dicek ke server saat transaksi. Kamu bisa menonaktifkannya kapan saja; mengganti PIN atau logout akan menghapus PIN tersimpan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lanjut',
          onPress: () => {
            setEnrollPinError(null);
            setEnrollPinOpen(true);
          },
        },
      ]
    );
  };

  const onEnrollPinSubmit = async (pin: string) => {
    const identity = resolveIdentity();
    if (!identity) {
      setEnrollPinError('Sesi identitas tidak ditemukan. Login ulang.');
      return;
    }
    setEnrollPinLoading(true);
    setEnrollPinError(null);
    try {
      const result = await enrollTransactionBiometricWithVerifiedPin({ identity, pin });
      if (!result.ok) {
        setEnrollPinError(result.message);
        return;
      }
      await applySession(result.token, result.user, identity);
      // After switching to the enroll token, drop the prior session so it does not linger.
      if (result.previousToken && result.previousToken !== result.token) {
        await revokeSanctumTokenBestEffort(result.previousToken);
      }
      setTxBioOn(true);
      setEnrollPinOpen(false);
      Alert.alert('Berhasil', `${bioLabel} untuk konfirmasi transaksi sudah aktif.`);
    } catch (err: unknown) {
      setEnrollPinError(parseApiError(err).message || 'Gagal mengaktifkan biometrik transaksi.');
    } finally {
      setEnrollPinLoading(false);
    }
  };

  const revokeOne = (token: SecuritySessionToken) => {
    Alert.alert(
      'Keluar dari sesi?',
      'Sesi ini akan diakhiri. Jika ini perangkat yang sedang kamu pakai, kamu mungkin perlu login ulang.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (lockRef.current || revoking) return;
              lockRef.current = true;
              setRevoking(true);
              try {
                await profileService.revokeSession(token.id);
                await load();
              } catch (err: unknown) {
                Alert.alert('Gagal', parseApiError(err).message || 'Tidak dapat mengakhiri sesi.');
              } finally {
                setRevoking(false);
                lockRef.current = false;
              }
            })();
          },
        },
      ]
    );
  };

  const revokeOthers = () => {
    Alert.alert(
      'Keluar dari perangkat lain?',
      'Semua sesi kecuali sesi saat ini akan diakhiri.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar semua lain',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (lockRef.current || revoking) return;
              lockRef.current = true;
              setRevoking(true);
              try {
                await profileService.revokeOtherSessions();
                await load();
              } catch (err: unknown) {
                Alert.alert(
                  'Gagal',
                  parseApiError(err).message || 'Tidak dapat mengakhiri sesi lain.'
                );
              } finally {
                setRevoking(false);
                lockRef.current = false;
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen
        options={{ headerShown: true, title: 'Keamanan & PIN', headerBackTitle: 'Kembali' }}
      />

      {loading && !data ? (
        <LoadingState label="Memuat keamanan..." />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>PIN Transaksi</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status PIN</Text>
              <Text style={[styles.statusValue, hasPin ? styles.statusOk : styles.statusWarn]}>
                {hasPin ? 'Aktif' : 'Belum dibuat'}
              </Text>
            </View>
            {data?.pin_updated_at ? (
              <Text style={styles.meta}>Terakhir diganti: {formatWhen(data.pin_updated_at)}</Text>
            ) : null}

            <View style={styles.actions}>
              {!hasPin ? (
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                  onPress={() => router.push('/akun/pin/create')}
                >
                  <Text style={styles.primaryBtnText}>Buat PIN</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                    onPress={() => router.push('/akun/pin/change')}
                  >
                    <Text style={styles.primaryBtnText}>Ubah PIN</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                    onPress={() => router.push('/akun/pin/forgot')}
                  >
                    <Text style={styles.secondaryBtnText}>Lupa PIN</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <Text style={styles.sectionLabel}>Biometrik</Text>
          <View style={styles.card}>
            {!bioHardware ? (
              <Text style={styles.meta}>
                Biometrik tidak tersedia atau belum terdaftar di perangkat ini. Gunakan PIN
                seperti biasa.
              </Text>
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.statusLabel}>Sidik jari untuk buka aplikasi</Text>
                <Text style={styles.meta}>
                  Buka layar Unlock dengan {bioLabel}. Tidak menyimpan PIN.
                </Text>
              </View>
              <Switch
                value={unlockBioOn}
                onValueChange={onToggleUnlockBio}
                disabled={bioBusy || !bioHardware}
                trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
                thumbColor={unlockBioOn ? colors.primary[600] : colors.gray[100]}
                accessibilityLabel="Sidik jari untuk buka aplikasi"
              />
            </View>

            <View style={styles.toggleDivider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.statusLabel}>Sidik jari untuk konfirmasi transaksi</Text>
                <Text style={styles.meta}>
                  Menyimpan PIN terenkripsi di perangkat (dilindungi biometrik OS). Bisa
                  diaktifkan terpisah dari buka aplikasi.
                </Text>
              </View>
              <Switch
                value={txBioOn}
                onValueChange={onToggleTxBio}
                disabled={bioBusy || !bioHardware || !hasPin}
                trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
                thumbColor={txBioOn ? colors.primary[600] : colors.gray[100]}
                accessibilityLabel="Sidik jari untuk konfirmasi transaksi"
              />
            </View>
          </View>

          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sectionLabel}>Sesi & Perangkat</Text>
            <Pressable
              onPress={revokeOthers}
              disabled={revoking || !(data?.active_tokens?.length)}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.linkDanger,
                  (revoking || !(data?.active_tokens?.length)) && styles.linkDisabled,
                ]}
              >
                Keluar perangkat lain
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {(data?.active_tokens || []).length === 0 ? (
              <Text style={styles.meta}>Tidak ada sesi aktif.</Text>
            ) : (
              <View style={styles.sessionList}>
                {(data?.active_tokens || []).map((t, index) => {
                  const plat = platformLabel(t.platform);
                  return (
                    <View
                      key={t.id}
                      style={[styles.sessionRow, index > 0 && styles.sessionRowBorder]}
                    >
                      <View style={styles.sessionIcon}>
                        <Ionicons
                          name={
                            t.platform === 'web' || t.platform === 'pwa'
                              ? 'desktop-outline'
                              : 'phone-portrait-outline'
                          }
                          size={18}
                          color={colors.primary[600]}
                        />
                      </View>
                      <View style={styles.sessionText}>
                        <Text style={styles.sessionName} numberOfLines={1}>
                          {sessionLabel(t)}
                        </Text>
                        <Text style={styles.meta} numberOfLines={2}>
                          {[
                            plat,
                            t.is_current ? 'Perangkat ini' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <Text style={styles.meta}>
                          Terakhir aktif: {formatWhen(t.last_used_at || t.created_at)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => revokeOne(t)}
                        disabled={revoking}
                        hitSlop={8}
                        accessibilityLabel="Keluar dari sesi ini"
                      >
                        <Text style={styles.linkDanger}>Keluar</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      <PinConfirmModal
        visible={enrollPinOpen}
        title="Verifikasi PIN"
        subtitle={`Masukkan PIN untuk mengaktifkan ${bioLabel} transaksi`}
        loading={enrollPinLoading}
        error={enrollPinError}
        hideForgotPin
        enableTransactionBiometric={false}
        onClose={() => {
          if (enrollPinLoading) return;
          setEnrollPinOpen(false);
          setEnrollPinError(null);
        }}
        onEditing={() => setEnrollPinError(null)}
        onSubmit={(pin) => void onEnrollPinSubmit(pin)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md, paddingBottom: spacing.xl },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  statusValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  statusOk: { color: colors.primary[700] },
  statusWarn: { color: colors.status.pending },
  meta: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 16,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  primaryBtn: {
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  btnPressed: { opacity: 0.88 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleText: { flex: 1, minWidth: 0, gap: 4 },
  toggleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.xs,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionList: { gap: 0 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[100],
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionText: { flex: 1, minWidth: 0, gap: 2 },
  sessionName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  linkDanger: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.status.failed,
  },
  linkDisabled: { opacity: 0.4 },
});
