import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, LoadingState, ErrorState } from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import {
  notificationPreferenceService,
  type NotificationPreferences,
} from '../../src/services/notificationPreference.service';
import { pushNotificationService } from '../../src/services/pushNotification.service';
import { parseApiError } from '../../src/api/client';
import { colors, radius, spacing, typography } from '../../src/theme';

type RowProps = {
  label: string;
  subtitle: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

function PreferenceRow({ label, subtitle, value, onChange, disabled }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
        thumbColor={value ? colors.primary[600] : colors.gray[100]}
      />
    </View>
  );
}

/**
 * Customer notification preferences + soft OS permission entry.
 * Does not claim OS permission is granted until OS API confirms.
 */
export default function NotifikasiPreferensiScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    notifyTransactions: true,
    notifyAnnouncements: true,
    notifyPromotions: true,
  });
  const [osGranted, setOsGranted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, status] = await Promise.all([
        authService.me(),
        pushNotificationService.getPermissionStatus(),
      ]);
      if (me.success) {
        const payload: any = me.data;
        setPrefs(notificationPreferenceService.fromProfile(payload?.user ?? payload));
      }
      setOsGranted(status === 'granted');
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal memuat preferensi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const updatePref = async (
    key: 'notify_transactions' | 'notify_announcements' | 'notify_promotions',
    value: boolean
  ) => {
    const prev = prefs;
    const optimistic: NotificationPreferences = {
      ...prefs,
      notifyTransactions: key === 'notify_transactions' ? value : prefs.notifyTransactions,
      notifyAnnouncements: key === 'notify_announcements' ? value : prefs.notifyAnnouncements,
      notifyPromotions: key === 'notify_promotions' ? value : prefs.notifyPromotions,
    };
    setPrefs(optimistic);
    setSaving(true);
    try {
      const res = await notificationPreferenceService.update({ [key]: value });
      if (res.success === false) {
        setPrefs(prev);
        return;
      }
      setPrefs(notificationPreferenceService.fromProfile(res.data));
    } catch {
      setPrefs(prev);
    } finally {
      setSaving(false);
    }
  };

  const enableOsPush = async () => {
    setSaving(true);
    try {
      const ok = await pushNotificationService.syncPushTokenWithBackend();
      setOsGranted(ok);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/akun');
          }}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Ionicons name="chevron-back" size={24} color={colors.gray[800]} />
        </Pressable>
        <Text style={styles.pageTitle}>Notifikasi</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <LoadingState label="Memuat preferensi..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Jenis notifikasi</Text>
            <PreferenceRow
              label="Notifikasi Transaksi"
              subtitle="Status final top up, pembelian, dan transfer"
              value={prefs.notifyTransactions}
              disabled={saving}
              onChange={(v) => void updatePref('notify_transactions', v)}
            />
            <PreferenceRow
              label="Pengumuman & Informasi"
              subtitle="Pemeliharaan sistem dan informasi layanan"
              value={prefs.notifyAnnouncements}
              disabled={saving}
              onChange={(v) => void updatePref('notify_announcements', v)}
            />
            <PreferenceRow
              label="Promo & Penawaran"
              subtitle="Penawaran spesial dari GurkyNet"
              value={prefs.notifyPromotions}
              disabled={saving}
              onChange={(v) => void updatePref('notify_promotions', v)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Izin perangkat</Text>
            <Text style={styles.osStatus}>
              {osGranted
                ? 'Izin notifikasi sistem sudah aktif di perangkat ini.'
                : 'Izin notifikasi sistem belum aktif. Inbox in-app tetap tersedia.'}
            </Text>
            {!osGranted ? (
              <Pressable
                onPress={() => void enableOsPush()}
                disabled={saving}
                style={({ pressed }) => [styles.enableBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.enableBtnText}>Izinkan notifikasi sistem</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  rowSub: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    marginTop: 2,
  },
  osStatus: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
  },
  enableBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  enableBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
});
