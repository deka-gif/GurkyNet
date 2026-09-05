import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useWalletStore,
  WalletDirectionFilter,
} from '../../src/store/wallet.store';
import type { WalletMutation } from '../../src/services/wallet.service';
import {
  formatWalletWhen,
  isCreditMovement,
  walletMovementSubtitle,
  walletMovementTitle,
} from '../../src/utils/walletMovement';
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
 * Purchase history lives in Riwayat. No category spending chart (backend gap).
 */

const DIRECTION_CHIPS: { key: WalletDirectionFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'credit', label: 'Uang Masuk' },
  { key: 'debit', label: 'Uang Keluar' },
];

/** Monthly in/out comparison from backend summary — not a time-series chart. */
function MonthlyFlowSummary({ income, expense }: { income: number; expense: number }) {
  const max = Math.max(income, expense, 1);
  const incomePct = Math.round((income / max) * 100);
  const expensePct = Math.round((expense / max) * 100);

  return (
    <Card style={styles.trackerCard}>
      <Text style={styles.sectionLabel}>Ringkasan bulan ini</Text>
      <Text style={styles.trackerHint}>Perbandingan uang masuk dan uang keluar bulan berjalan.</Text>
      <View style={styles.trackerRow}>
        <Text style={styles.trackerName}>Uang Masuk</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFillIncome, { width: `${incomePct}%` }]} />
        </View>
        <Text style={styles.trackerAmount}>{formatIDR(income)}</Text>
      </View>
      <View style={styles.trackerRow}>
        <Text style={styles.trackerName}>Uang Keluar</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFillExpense, { width: `${expensePct}%` }]} />
        </View>
        <Text style={styles.trackerAmount}>{formatIDR(expense)}</Text>
      </View>
    </Card>
  );
}

function MovementRow({ row }: { row: WalletMutation }) {
  const credit = isCreditMovement(row);
  const when = formatWalletWhen(row.created_at);
  const subtitle = walletMovementSubtitle(row);

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
        {subtitle ? (
          <Text style={styles.mutationMeta} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
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

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll])
  );

  const income = Number(overview?.summary?.income_this_month ?? 0);
  const expense = Number(overview?.summary?.expense_this_month ?? 0);
  const mutasiCount = Number(overview?.summary?.transaction_count ?? 0);
  const net = income - expense;
  const canLoadMore = Boolean(
    ledgerPagination && ledgerPagination.currentPage < ledgerPagination.lastPage
  );
  const refreshing = overviewLoading || ledgerLoading;

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
            {overview?.wallet?.gurkyPayId ||
            overview?.wallet?.gurky_pay_id ||
            overview?.wallet?.walletNo ||
            overview?.wallet?.wallet_number ? (
              <View style={styles.idBlock}>
                <Text style={styles.idLabel}>ID / No. Rekening GurkyPay</Text>
                <Text style={styles.idValue}>
                  {overview?.wallet?.gurkyPayId ||
                    overview?.wallet?.gurky_pay_id ||
                    overview?.wallet?.walletNo ||
                    overview?.wallet?.wallet_number}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Uang Masuk</Text>
              <Text style={[styles.summaryValue, styles.amountCredit]} numberOfLines={1}>
                {formatIDR(income)}
              </Text>
              <Text style={styles.summaryHint}>bulan ini</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Uang Keluar</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {formatIDR(expense)}
              </Text>
              <Text style={styles.summaryHint}>bulan ini</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text
                style={[styles.summaryValue, net >= 0 ? styles.amountCredit : styles.amountDebit]}
                numberOfLines={1}
              >
                {net >= 0 ? '+' : '−'}
                {formatIDR(Math.abs(net))}
              </Text>
              <Text style={styles.summaryHint}>{mutasiCount} mutasi</Text>
            </View>
          </View>

          <MonthlyFlowSummary income={income} expense={expense} />

          <View style={styles.mutationsHeader}>
            <Text style={styles.sectionLabel}>Aktivitas Uang</Text>
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
  idBlock: { marginTop: spacing.sm, gap: 2 },
  idLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary[200],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  idValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[50],
    letterSpacing: 0.4,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  summaryHint: { fontSize: 10, color: colors.gray[400] },
  trackerCard: { padding: spacing.lg, gap: spacing.sm },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  trackerHint: { fontSize: typography.size.xs, color: colors.gray[500], marginBottom: spacing.xs },
  trackerRow: { gap: spacing.xs },
  trackerName: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    fontWeight: typography.weight.medium,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray[100],
    overflow: 'hidden',
  },
  barFillIncome: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary[500],
    minWidth: 4,
  },
  barFillExpense: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.gray[400],
    minWidth: 4,
  },
  trackerAmount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
  },
  mutationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
