import { useCallback, useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopUpStore } from '../../src/store/topup.store';
import { useWalletStore } from '../../src/store/wallet.store';
import {
  isTopUpSuccess,
  isTopUpTerminal,
  topUpStatusLabel,
} from '../../src/utils/topupSnap';
import { ScreenContainer, LoadingState, ErrorState, Button } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

/**
 * Top Up payment status — GET detail + POST sync-payment (same as Web).
 * Closing Snap / leaving screen ≠ SUCCESS. Wallet refresh only after backend success.
 */
export default function TopUpDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = String(id || '');

  const detailLoading = useTopUpStore((s) => s.detailLoading);
  const detailError = useTopUpStore((s) => s.detailError);
  const detailStatus = useTopUpStore((s) => s.detailStatus);
  const detailAmount = useTopUpStore((s) => s.detailAmount);
  const detailInvoice = useTopUpStore((s) => s.detailInvoice);
  const detailPayment = useTopUpStore((s) => s.detailPayment);
  const canResume = useTopUpStore((s) => s.canResume);
  const loadDetail = useTopUpStore((s) => s.loadDetail);
  const syncStatus = useTopUpStore((s) => s.syncStatus);
  const resumeSnap = useTopUpStore((s) => s.resumeSnap);
  const openActiveSnap = useTopUpStore((s) => s.openActiveSnap);
  const active = useTopUpStore((s) => s.active);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const balance = useWalletStore((s) => s.overview?.wallet.balance);

  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!transactionId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncStatus(transactionId);
    } finally {
      syncingRef.current = false;
    }
  }, [transactionId, syncStatus]);

  useEffect(() => {
    if (!transactionId) return;
    void loadDetail(transactionId);
  }, [transactionId, loadDetail]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (isTopUpSuccess(detailStatus)) {
      void fetchWallet();
    }
  }, [detailStatus, fetchWallet]);

  const terminal = isTopUpTerminal(detailStatus);
  const success = isTopUpSuccess(detailStatus);
  const pending = !terminal;

  const onContinuePay = async () => {
    if (canResume) {
      await resumeSnap(transactionId);
      return;
    }
    if (active?.transactionId === transactionId) {
      await openActiveSnap();
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace('/(tabs)/home')}
            style={styles.backBtn}
            accessibilityLabel="Kembali"
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.topTitle}>Status Top Up</Text>
          <View style={{ width: 40 }} />
        </View>

        {detailLoading && !detailStatus ? (
          <LoadingState label="Memuat status…" />
        ) : detailError && !detailStatus ? (
          <ErrorState message={detailError} onRetry={() => void loadDetail(transactionId)} />
        ) : (
          <ScreenContainer belowHeader>
            <View
              style={[
                styles.statusCard,
                success && styles.statusSuccess,
                detailStatus === 'expired' && styles.statusExpired,
                detailStatus === 'failed' && styles.statusFailed,
              ]}
            >
              <Text style={styles.statusLabel}>{topUpStatusLabel(detailStatus)}</Text>
              <Text style={styles.amount}>{formatIDR(detailAmount)}</Text>
              {detailInvoice ? (
                <Text style={styles.meta}>Invoice: {detailInvoice}</Text>
              ) : null}
              {detailPayment?.channel_label || detailPayment?.method ? (
                <Text style={styles.meta}>
                  Metode: {detailPayment.channel_label || detailPayment.method}
                </Text>
              ) : null}
              {detailPayment?.va_number ? (
                <Text style={styles.meta}>VA: {detailPayment.va_number}</Text>
              ) : null}
              {detailPayment?.payment_code ? (
                <Text style={styles.meta}>Kode: {detailPayment.payment_code}</Text>
              ) : null}
              {detailPayment?.expiry_time ? (
                <Text style={styles.meta}>Berlaku hingga: {detailPayment.expiry_time}</Text>
              ) : null}
            </View>

            {pending ? (
              <Text style={styles.help}>
                Selesaikan pembayaran di halaman Midtrans. Menutup Snap tidak membuat Top Up
                berhasil. Tekan Cek Status setelah membayar.
              </Text>
            ) : null}

            {success ? (
              <View style={styles.balanceBox}>
                <Text style={styles.balanceLabel}>Saldo GurkyPay terbaru</Text>
                <Text style={styles.balanceValue}>{formatIDR(balance)}</Text>
              </View>
            ) : null}

            {detailError ? <Text style={styles.errorText}>{detailError}</Text> : null}

            <View style={styles.actions}>
              {pending ? (
                <>
                  <Button label="Cek Status" onPress={() => void refresh()} fullWidth />
                  {(canResume || active?.transactionId === transactionId) && (
                    <Button
                      label="Lanjutkan Pembayaran"
                      onPress={() => void onContinuePay()}
                      variant="secondary"
                      fullWidth
                    />
                  )}
                </>
              ) : null}
              {success ? (
                <Button
                  label="Kembali ke Home"
                  onPress={() => router.replace('/(tabs)/home')}
                  fullWidth
                />
              ) : null}
              {terminal && !success ? (
                <Button
                  label="Buat Top Up Baru"
                  onPress={() => router.replace('/topup')}
                  fullWidth
                />
              ) : null}
            </View>
          </ScreenContainer>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statusSuccess: {
    backgroundColor: colors.status.successBg,
    borderColor: colors.status.success,
  },
  statusExpired: {
    backgroundColor: colors.status.pendingBg,
    borderColor: colors.status.pending,
  },
  statusFailed: {
    backgroundColor: colors.status.failedBg,
    borderColor: colors.status.failed,
  },
  statusLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  amount: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  meta: { fontSize: typography.size.sm, color: colors.gray[600] },
  help: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  balanceBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  balanceLabel: { fontSize: typography.size.sm, color: colors.primary[700] },
  balanceValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
  },
  actions: { gap: spacing.sm, marginBottom: spacing['2xl'] },
});
