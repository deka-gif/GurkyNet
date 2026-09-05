import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  useWalletStore,
  WalletDirectionFilter,
} from '../../src/store/wallet.store';
import type { WalletMutation } from '../../src/services/wallet.service';
import {
  formatWalletWhen,
  isCreditMovement,
  walletMovementTitle,
} from '../../src/utils/walletMovement';
import { FinancialTrackerCard } from '../../src/components/wallet/FinancialTrackerCard';
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

/**
 * Wallet tab — financial movements only (GET /wallet + GET /wallet/history).
 * Purchase history lives in Riwayat.
 */

const DIRECTION_CHIPS: { key: WalletDirectionFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'credit', label: 'Uang Masuk' },
  { key: 'debit', label: 'Uang Keluar' },
];

function MovementRow({ row }: { row: WalletMutation }) {
  const credit = isCreditMovement(row);
  const when = formatWalletWhen(row.created_at);

  return (
    <View style={styles.mutationRow}>
      <View style={[styles.mutationIcon, credit ? styles.mutationIconCredit : styles.mutationIconDebit]}>
        <Ionicons
          name={credit ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={credit ? colors.primary[600] : colors.gray[700]}
        />
      </View>
      <View style={styles.mutationBody}>
        <Text style={styles.mutationTitle} numberOfLines={1}>
          {walletMovementTitle(row)}
        </Text>
        {when ? (
          <Text style={styles.mutationMeta} numberOfLines={1}>
            {when}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.mutationAmount, credit ? styles.amountCredit : styles.amountDebit]}>
        {credit ? '+' : '−'}
        {formatIDR(Number(row.amount || 0))}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const overview = useWalletStore((s) => s.overview);
  const overviewLoading = useWalletStore((s) => s.overviewLoading);
  const overviewError = useWalletStore((s) => s.overviewError);
  const ledger = useWalletStore((s) => s.ledger);
  const ledgerLoading = useWalletStore((s) => s.ledgerLoading);
  const ledgerLoadingMore = useWalletStore((s) => s.ledgerLoadingMore);
  const ledgerError = useWalletStore((s) => s.ledgerError);
  const ledgerPagination = useWalletStore((s) => s.ledgerPagination);
  const directionFilter = useWalletStore((s) => s.directionFilter);
  const setDirectionFilter = useWalletStore((s) => s.setDirectionFilter);
  const refreshAll = useWalletStore((s) => s.refreshAll);
  const loadMoreLedger = useWalletStore((s) => s.loadMoreLedger);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const monthLedger = useWalletStore((s) => s.monthLedger);
  const monthLabel = useWalletStore((s) => s.monthLabel);
  const monthLedgerLoading = useWalletStore((s) => s.monthLedgerLoading);
  const monthLedgerError = useWalletStore((s) => s.monthLedgerError);
  const monthLedgerComplete = useWalletStore((s) => s.monthLedgerComplete);
  const monthKey = useWalletStore((s) => s.monthKey);

  const [copyFeedback, setCopyFeedback] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll])
  );

  const accountNumber =
    overview?.wallet?.gurkyPayId ||
    overview?.wallet?.gurky_pay_id ||
    overview?.wallet?.walletNo ||
    overview?.wallet?.wallet_number ||
    '';

  const income = Number(overview?.summary?.income_this_month ?? 0);
  const expense = Number(overview?.summary?.expense_this_month ?? 0);
  const canLoadMore = Boolean(
    ledgerPagination && ledgerPagination.currentPage < ledgerPagination.lastPage
  );
  const refreshing = overviewLoading || ledgerLoading;

  const onCopyAccount = async () => {
    if (!accountNumber) return;
    try {
      await Clipboard.setStringAsync(String(accountNumber));
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  };

  return (
    <ScreenContainer onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Pergerakan uang & saldo Anda</Text>
      </View>

      {overviewLoading && !overview ? (
        <LoadingState label="Memuat wallet..." />
      ) : overviewError && !overview ? (
        <ErrorState message={overviewError} onRetry={fetchWallet} />
      ) : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo tersedia</Text>
            <Text style={styles.balanceAmount}>{formatIDR(overview?.wallet?.balance)}</Text>
            {accountNumber ? (
              <View style={styles.idBlock}>
                <Text style={styles.idLabel}>ID / No. Rekening GurkyPay</Text>
                <View style={styles.idRow}>
                  <Text style={styles.idValue} numberOfLines={1}>
                    {accountNumber}
                  </Text>
                  <Pressable
                    onPress={() => void onCopyAccount()}
                    style={styles.copyBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Salin ID GurkyPay"
                    hitSlop={8}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.primary[100]} />
                    <Text style={styles.copyText}>Salin</Text>
                  </Pressable>
                </View>
                {copyFeedback ? (
                  <Text style={styles.copyFeedback}>ID / No. Rekening disalin</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <FinancialTrackerCard
            monthLabel={monthLabel}
            monthKey={monthKey}
            income={income}
            expense={expense}
            monthRows={monthLedger}
            monthRowsLoading={monthLedgerLoading}
            monthRowsError={monthLedgerError}
            monthRowsComplete={monthLedgerComplete}
          />

          <View style={styles.mutationsHeader}>
            <Text style={styles.sectionLabel}>Aktivitas Uang</Text>
            <Text style={styles.monthHint}>{monthLabel}</Text>
          </View>

          <View style={styles.chipRow}>
            {DIRECTION_CHIPS.map((chip) => {
              const active = directionFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setDirectionFilter(chip.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {ledgerLoading && ledger.length === 0 ? (
            <LoadingState label="Memuat aktivitas..." />
          ) : ledgerError && ledger.length === 0 ? (
            <ErrorState message={ledgerError} onRetry={() => void refreshAll()} />
          ) : ledger.length === 0 ? (
            <EmptyState
              title="Belum Ada Aktivitas"
              message="Uang masuk dan uang keluar akan muncul di sini setelah ada mutasi saldo."
            />
          ) : (
            <Card style={styles.mutationsCard}>
              {ledger.map((row, index) => (
                <View key={String(row.id)}>
                  <MovementRow row={row} />
                  {index < ledger.length - 1 ? <View style={styles.mutationDivider} /> : null}
                </View>
              ))}
            </Card>
          )}

          {ledgerLoadingMore ? (
            <ActivityIndicator color={colors.primary[600]} style={{ marginVertical: spacing.md }} />
          ) : null}
          {canLoadMore && !ledgerLoadingMore ? (
            <Pressable onPress={() => void loadMoreLedger()} style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreText}>Muat lebih banyak</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500] },
  balanceCard: {
    backgroundColor: colors.primary[700],
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  balanceLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[200],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceAmount: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.white,
  },
  idBlock: { marginTop: spacing.sm, gap: 4 },
  idLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary[200],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  idValue: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[50],
    letterSpacing: 0.4,
    minWidth: 0,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  copyText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.primary[50],
  },
  copyFeedback: {
    fontSize: 11,
    color: colors.primary[100],
    fontWeight: typography.weight.medium,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  mutationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthHint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  chipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[600],
  },
  chipTextActive: { color: colors.primary[700] },
  mutationsCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  mutationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  mutationIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutationIconCredit: { backgroundColor: colors.primary[50] },
  mutationIconDebit: { backgroundColor: colors.gray[100] },
  mutationBody: { flex: 1, gap: 1, minWidth: 0 },
  mutationTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  mutationMeta: { fontSize: 11, color: colors.gray[500] },
  mutationAmount: { fontSize: typography.size.sm, fontWeight: typography.weight.black },
  amountCredit: { color: colors.primary[600] },
  amountDebit: { color: colors.gray[800] },
  mutationDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray[200] },
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
});
