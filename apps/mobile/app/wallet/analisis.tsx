import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../src/store/wallet.store';
import { DonutChart } from '../../src/components/wallet/DonutChart';
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import {
  aggregateExpenseByCategory,
  expenseCategoryColor,
  currentMonthBounds,
} from '../../src/utils/walletExpenseCategory';
import { isCreditMovement } from '../../src/utils/walletMovement';

type AnalisisTab = 'expense' | 'income';

/**
 * Format monthKey "YYYY-MM" → Indonesian label via locale (no hardcoded month names).
 */
function labelFromMonthKey(monthKey: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/**
 * Wallet Analisis — detail kategori untuk periode yang sama dengan Financial Tracker.
 * Navigation: /wallet/analisis?month=YYYY-MM
 * Back → Wallet (stack).
 */
export default function WalletAnalisisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ month?: string }>();
  const [tab, setTab] = useState<AnalisisTab>('expense');

  const overview = useWalletStore((s) => s.overview);
  const monthLedger = useWalletStore((s) => s.monthLedger);
  const storeMonthLabel = useWalletStore((s) => s.monthLabel);
  const storeMonthKey = useWalletStore((s) => s.monthKey);
  const monthLedgerLoading = useWalletStore((s) => s.monthLedgerLoading);
  const monthLedgerError = useWalletStore((s) => s.monthLedgerError);
  const monthLedgerComplete = useWalletStore((s) => s.monthLedgerComplete);
  const refreshMonthLedger = useWalletStore((s) => s.refreshMonthLedger);

  const paramMonth =
    typeof params.month === 'string'
      ? params.month
      : Array.isArray(params.month)
        ? params.month[0]
        : undefined;

  /**
   * Single period SoT: wallet store monthKey/monthLabel (same as Tracker).
   * URL ?month=YYYY-MM must match; otherwise fall back to store (never invent a second month).
   */
  const periodKey = storeMonthKey || currentMonthBounds().monthKey;
  const periodAligned = !paramMonth || paramMonth === periodKey;
  const periodLabel =
    (periodAligned ? storeMonthLabel : null) ||
    labelFromMonthKey(periodKey) ||
    storeMonthLabel ||
    currentMonthBounds().label;

  const income = Number(overview?.summary?.income_this_month ?? 0);
  const expense = Number(overview?.summary?.expense_this_month ?? 0);

  const dataReady = monthLedgerComplete && periodAligned;

  const expenseSlices = useMemo(
    () => (dataReady ? aggregateExpenseByCategory(monthLedger) : []),
    [monthLedger, dataReady]
  );

  const expenseDonut = useMemo(
    () =>
      expenseSlices.map((s) => ({
        key: s.id,
        label: s.label,
        amount: s.amount,
        color: expenseCategoryColor(s.id),
      })),
    [expenseSlices]
  );

  const creditRows = useMemo(() => {
    if (!dataReady) return [];
    return monthLedger.filter(
      (r) => isCreditMovement(r) && Math.abs(Number(r.amount) || 0) > 0
    );
  }, [monthLedger, dataReady]);

  const creditCount = useMemo(() => {
    const ids = new Set(creditRows.map((r) => String(r.id)));
    return ids.size;
  }, [creditRows]);

  const incomeDonut =
    income > 0
      ? [{ key: 'income', label: 'Uang Masuk', amount: income, color: colors.primary[500] }]
      : [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Wallet"
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gray[900]} />
          </Pressable>
          <Text style={styles.topTitle}>Analisis</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* belowHeader: avoid double top safe-area (custom topBar already inset) */}
        <ScreenContainer belowHeader>
          <View style={styles.intro}>
            <Text style={styles.subtitle}>
              Rincian kategori pengeluaran dan pemasukan
            </Text>
            <Text style={styles.monthLine}>bulan {periodLabel}</Text>
          </View>

          <View style={styles.tabRow}>
            {(
              [
                { key: 'expense' as const, label: 'Pengeluaran' },
                { key: 'income' as const, label: 'Pemasukan' },
              ] as const
            ).map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {monthLedgerLoading && !monthLedgerComplete ? (
            <LoadingState label="Memuat analisis…" />
          ) : monthLedgerError || !monthLedgerComplete ? (
            <ErrorState
              message={monthLedgerError || 'Data analisis belum lengkap.'}
              onRetry={() => void refreshMonthLedger()}
            />
          ) : !periodAligned ? (
            <ErrorState
              message="Periode Analisis tidak cocok dengan Wallet. Kembali ke Wallet lalu buka ulang Lihat detail."
              onRetry={() => router.back()}
            />
          ) : tab === 'expense' ? (
            <View style={styles.section}>
              <DonutChart
                slices={expenseDonut}
                centerLabel="Total Pengeluaran"
                centerValue={expense}
                size={200}
              />
              <Text style={styles.catCount}>{expenseSlices.length} kategori</Text>

              {expenseSlices.length === 0 ? (
                <Text style={styles.empty}>Belum ada pengeluaran bulan ini.</Text>
              ) : (
                <Card style={styles.listCard}>
                  {expenseSlices.map((s, i) => (
                    <View key={s.id}>
                      <View style={styles.row}>
                        <View
                          style={[
                            styles.iconCircle,
                            { backgroundColor: expenseCategoryColor(s.id) + '22' },
                          ]}
                        >
                          <View
                            style={[
                              styles.iconDot,
                              { backgroundColor: expenseCategoryColor(s.id) },
                            ]}
                          />
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle}>{s.label}</Text>
                          <Text style={styles.rowMeta}>
                            {s.count} Transaksi ({formatPercent(s.percent)})
                          </Text>
                        </View>
                        <Text style={styles.rowAmount}>−{formatIDR(s.amount)}</Text>
                      </View>
                      {i < expenseSlices.length - 1 ? (
                        <View style={styles.divider} />
                      ) : null}
                    </View>
                  ))}
                </Card>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <DonutChart
                slices={incomeDonut}
                centerLabel="Total Pemasukan"
                centerValue={income}
                size={200}
              />
              <Text style={styles.catCount}>
                {income > 0 ? '1 kategori' : '0 kategori'}
              </Text>

              {income <= 0 ? (
                <Text style={styles.empty}>Belum ada pemasukan bulan ini.</Text>
              ) : (
                <Card style={styles.listCard}>
                  <View style={styles.row}>
                    <View
                      style={[styles.iconCircle, { backgroundColor: colors.primary[50] }]}
                    >
                      <View
                        style={[styles.iconDot, { backgroundColor: colors.primary[500] }]}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>Uang Masuk</Text>
                      <Text style={styles.rowMeta}>
                        {creditCount} Transaksi (100%)
                      </Text>
                    </View>
                    <Text style={[styles.rowAmount, styles.amountIn]}>
                      {formatIDR(income)}
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          )}
        </ScreenContainer>
      </View>
    </>
  );
}

function formatPercent(p: number): string {
  const rounded = Math.round(p * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace('.', ',');
  return `${text}%`;
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  /** Compact block under header — no double safe-area gap. */
  intro: {
    gap: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
    fontWeight: typography.weight.medium,
  },
  monthLine: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    lineHeight: 20,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
  },
  tabTextActive: { color: colors.primary[700] },
  section: { gap: spacing.md, alignItems: 'stretch' },
  catCount: {
    textAlign: 'center',
    fontSize: typography.size.xs,
    color: colors.gray[500],
    fontWeight: typography.weight.medium,
    marginTop: -spacing.sm,
  },
  listCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowMeta: { fontSize: 11, color: colors.gray[500] },
  rowAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.gray[800],
  },
  amountIn: { color: colors.primary[600] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray[200] },
  empty: {
    textAlign: 'center',
    color: colors.gray[500],
    fontSize: typography.size.sm,
    paddingVertical: spacing.lg,
  },
});
