import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenContainer,
  LoadingState,
  ErrorState,
  Button,
} from '../../src/components/ui';
import {
  selectFilteredNotifications,
  useNotificationStore,
  type InboxFilter,
} from '../../src/store/notification.store';
import type { CustomerNotification } from '../../src/services/notification.service';
import { pushNotificationService } from '../../src/services/pushNotification.service';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatDateTime } from '../../src/utils/date';

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'transaction', label: 'Transaksi' },
  { key: 'announcement', label: 'Informasi' },
  { key: 'promotion', label: 'Promo' },
];

function notifIcon(notif: CustomerNotification): keyof typeof Ionicons.glyphMap {
  const cat = String(notif.category || notif.type || '').toLowerCase();
  if (cat === 'promotion') return 'gift-outline';
  if (cat === 'announcement') return 'megaphone-outline';
  const t = String(notif.title || '').toLowerCase();
  if (t.includes('promo') || t.includes('diskon')) return 'gift-outline';
  if (t.includes('top up') || t.includes('topup')) return 'wallet-outline';
  if (t.includes('saldo') || t.includes('transfer')) return 'swap-horizontal-outline';
  if (t.includes('gagal') || t.includes('kedaluwarsa') || t.includes('timeout')) {
    return 'alert-circle-outline';
  }
  if (t.includes('berhasil') || t.includes('transaksi') || t.includes('pembayaran')) {
    return 'checkmark-circle-outline';
  }
  return 'notifications-outline';
}

/**
 * Customer notification inbox — GET /notifications (existing backend).
 * Filters: Semua | Transaksi | Informasi | Promo
 */
export default function NotifikasiScreen() {
  const router = useRouter();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    filter,
    setFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const visible = useMemo(
    () => selectFilteredNotifications(notifications, filter),
    [notifications, filter]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications({ force: true });
    }, [fetchNotifications])
  );

  const openNotification = async (notif: CustomerNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    await pushNotificationService.openFromPayload(
      {
        type: notif.category || notif.type,
        category: notif.category || notif.type,
        notification_id: notif.id,
        transaction_id: notif.transactionId || undefined,
        invoice_number: notif.invoiceNumber || undefined,
        announcement_id: notif.announcementId || undefined,
        campaign_id: notif.campaignId || undefined,
        deep_link: notif.deepLink || undefined,
      },
      { fallbackToInbox: false }
    );
  };

  return (
    <ScreenContainer
      scroll
      onRefresh={() => fetchNotifications({ force: true })}
      refreshing={loading && notifications.length > 0}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
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

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {unreadCount > 0 ? (
        <Pressable
          onPress={() => void markAllAsRead()}
          style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-done" size={16} color={colors.primary[600]} />
          <Text style={styles.markAllText}>Tandai semua sudah dibaca</Text>
        </Pressable>
      ) : null}

      {loading && notifications.length === 0 ? (
        <LoadingState label="Memuat notifikasi..." />
      ) : error && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={() => void fetchNotifications({ force: true })} />
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={40} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>Belum ada notifikasi</Text>
          <Text style={styles.emptySub}>
            Transaksi, informasi, dan promo akan muncul di sini.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((notif) => (
            <Pressable
              key={notif.id}
              onPress={() => void openNotification(notif)}
              style={({ pressed }) => [
                styles.row,
                !notif.isRead && styles.rowUnread,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={notif.title}
            >
              <View style={[styles.iconWrap, !notif.isRead && styles.iconWrapUnread]}>
                <Ionicons
                  name={notifIcon(notif)}
                  size={20}
                  color={!notif.isRead ? colors.primary[600] : colors.gray[500]}
                />
              </View>
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowTitle, !notif.isRead && styles.rowTitleUnread]}
                  numberOfLines={1}
                >
                  {notif.title}
                </Text>
                {notif.message ? (
                  <Text style={styles.rowMessage} numberOfLines={2}>
                    {notif.message}
                  </Text>
                ) : null}
                <Text style={styles.rowTime}>{formatDateTime(notif.createdAt)}</Text>
              </View>
              {!notif.isRead ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          ))}
        </View>
      )}

      {notifications.length > 0 ? (
        <Button
          label="Muat ulang"
          variant="secondary"
          onPress={() => void fetchNotifications({ force: true })}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.gray[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
  },
  filterText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
  },
  filterTextActive: {
    color: colors.white,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    marginBottom: spacing.sm,
  },
  markAllText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  list: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  rowUnread: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  iconWrapUnread: {
    backgroundColor: colors.white,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[800],
  },
  rowTitleUnread: {
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowMessage: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
  },
  rowTime: {
    fontSize: 11,
    color: colors.gray[400],
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[600],
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  emptySub: {
    fontSize: typography.size.xs,
    color: colors.gray[400],
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
