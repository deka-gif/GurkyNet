import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
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
 * Keamanan & PIN — compact PIN status + Sesi & Perangkat.
 * Ubah PIN → PUT /pin/change. Lupa PIN → OTP email recovery.
 */
export default function AccountSecurityScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [data, setData] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const lockRef = useRef(false);

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
  }, [fetchUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPin = !!(user?.hasPin || data?.has_pin);

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
