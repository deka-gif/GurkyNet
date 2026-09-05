import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../ui';
import { DonutChart, type DonutSlice } from './DonutChart';
import { CashflowBarChart } from './CashflowBarChart';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import type { WalletMutation } from '../../services/wallet.service';
import {
  aggregateExpenseByCategory,
  expenseCategoryColor,
  topExpenseCategory,
} from '../../utils/walletExpenseCategory';
import {
  aggregateCashflowByWeek,
  currentMonthParts,
} from '../../utils/walletCashflow';
import { isCreditMovement } from '../../utils/walletMovement';

export type TrackerTab = 'cashflow' | 'expense' | 'income';

type Props = {
  monthLabel: string;
  /** YYYY-MM period key — passed to Analisis so text + data stay aligned. */
  monthKey: string;
  income: number;
  expense: number;
  /** Full-month credit+debit ledger (all pages). */
  monthRows: WalletMutation[];
  monthRowsLoading?: boolean;
  monthRowsError?: string | null;
  monthRowsComplete?: boolean;
};

const TABS: { key: TrackerTab; label: string }[] = [
  { key: 'cashflow', label: 'Cashflow' },
  { key: 'expense', label: 'Pengeluaran' },
  { key: 'income', label: 'Pemasukan' },
];

/**
 * Single Financial Tracker card — Cashflow = bar chart; Pengeluaran/Pemasukan = donut.
 */
export function FinancialTrackerCard({
  monthLabel,
  monthKey,
  income,
  expense,
  monthRows,
  monthRowsLoading = false,
  monthRowsError = null,
  monthRowsComplete = false,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TrackerTab>('cashflow');

  const incomeTotal = Number(income) || 0;
  const expenseTotal = Number(expense) || 0;
  const { year, monthIndex0 } = currentMonthParts();

  const cashflowBuckets = useMemo(
    () =>
      monthRowsComplete
        ? aggregateCashflowByWeek(monthRows, year, monthIndex0)
        : aggregateCashflowByWeek([], year, monthIndex0),
    [monthRows, monthRowsComplete, year, monthIndex0]
  );

  const expenseSlices = useMemo(
    () => (monthRowsComplete ? aggregateExpenseByCategory(monthRows) : []),
    [monthRows, monthRowsComplete]
  );
  const topExpense = useMemo(() => topExpenseCategory(expenseSlices), [expenseSlices]);
  const slicesSum = expenseSlices.reduce((s, x) => s + x.amount, 0);

  const expenseDonut: DonutSlice[] = useMemo(
    () =>
      expenseSlices.map((s) => ({
        key: s.id,
        label: s.label,
        amount: s.amount,
        color: expenseCategoryColor(s.id),
      })),
    [expenseSlices]
  );

  const incomeDonut: DonutSlice[] = useMemo(
    () =>
      incomeTotal > 0
        ? [{ key: 'income', label: 'Uang Masuk', amount: incomeTotal, color: colors.primary[500] }]
        : [],
    [incomeTotal]
  );

  const creditCount = useMemo(() => {
    if (!monthRowsComplete) return 0;
    const ids = new Set<string>();
    for (const row of monthRows) {
      if (isCreditMovement(row) && Math.abs(Number(row.amount) || 0) > 0) {
        ids.add(String(row.id));
      }
    }
    return ids.size;
  }, [monthRows, monthRowsComplete]);

  const openAnalisis = () => {
    router.push({
      pathname: '/wallet/analisis',
      params: { month: monthKey },
    });
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Financial Tracker</Text>
        <Text style={styles.month}>{monthLabel}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'cashflow' ? (
        monthRowsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary[600]} />
            <Text style={styles.emptyInline}>Memuat cashflow…</Text>
          </View>
        ) : monthRowsError || !monthRowsComplete ? (
          <Text style={styles.empty}>
            {monthRowsError || 'Cashflow belum lengkap. Tarik untuk muat ulang.'}
          </Text>
        ) : (
          <View style={styles.body}>
            <CashflowBarChart buckets={cashflowBuckets} />
          </View>
        )
      ) : tab === 'expense' ? (
        monthRowsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary[600]} />
            <Text style={styles.emptyInline}>Memuat kategori pengeluaran…</Text>
          </View>
        ) : monthRowsError || !monthRowsComplete ? (
          <Text style={styles.empty}>
            {monthRowsError ||
              'Kategori pengeluaran belum lengkap. Tarik untuk muat ulang.'}
          </Text>
        ) : expenseTotal <= 0 && slicesSum <= 0 ? (
          <View style={styles.body}>
            <Text style={styles.kicker}>Kategori Pengeluaran Terbesar</Text>
            <Text style={styles.kickerValue}>—</Text>
            <DonutChart slices={[]} centerLabel="Total" centerValue={0} />
            <Text style={styles.emptyInline}>Belum ada pengeluaran bulan ini.</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.kicker}>Kategori Pengeluaran Terbesar</Text>
            <Text style={styles.kickerValue}>{topExpense?.label || '—'}</Text>
            <DonutChart
              slices={expenseDonut}
              centerLabel="Total"
              centerValue={expenseTotal}
            />
            <View style={styles.legendBlock}>
              {expenseDonut.map((s) => (
                <LegendRow key={s.key} color={s.color} label={s.label} amount={s.amount} />
              ))}
            </View>
            <Pressable onPress={openAnalisis} style={styles.detailBtn} accessibilityRole="link">
              <Text style={styles.detailLink}>Lihat detail</Text>
            </Pressable>
          </View>
        )
      ) : incomeTotal <= 0 ? (
        <View style={styles.body}>
          <Text style={styles.kicker}>Kategori Pemasukan Terbesar</Text>
          <Text style={styles.kickerValue}>Uang Masuk</Text>
          <DonutChart slices={[]} centerLabel="Total" centerValue={0} />
          <Text style={styles.emptyInline}>Belum ada pemasukan bulan ini.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.kicker}>Kategori Pemasukan Terbesar</Text>
          <Text style={styles.kickerValue}>Uang Masuk</Text>
          <DonutChart slices={incomeDonut} centerLabel="Total" centerValue={incomeTotal} />
          <View style={styles.legendBlock}>
            <LegendRow
              color={colors.primary[500]}
              label="Uang Masuk"
              amount={incomeTotal}
              meta={creditCount > 0 ? `${creditCount} transaksi` : undefined}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function LegendRow({
  color,
  label,
  amount,
  meta,
}: {
  color: string;
  label: string;
  amount: number;
  meta?: string;
}) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.legendBody}>
        <Text style={styles.legendLabel} numberOfLines={1}>
          {label}
        </Text>
        {meta ? <Text style={styles.legendMeta}>{meta}</Text> : null}
      </View>
      <Text style={styles.legendAmount} numberOfLines={1}>
        {formatIDR(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  month: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: radius.lg,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
  },
  tabText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
  },
  tabTextActive: { color: colors.primary[700] },
  body: { gap: spacing.md, alignItems: 'stretch' },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  kicker: {
    fontSize: 11,
    fontWeight: typography.weight.medium,
    color: colors.gray[500],
    textAlign: 'center',
  },
  kickerValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  legendBlock: { gap: spacing.sm },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendBody: { flex: 1, minWidth: 0 },
  legendLabel: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    fontWeight: typography.weight.medium,
  },
  legendMeta: { fontSize: 10, color: colors.gray[400] },
  legendAmount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  empty: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  emptyInline: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    textAlign: 'center',
  },
  detailBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  detailLink: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
});
