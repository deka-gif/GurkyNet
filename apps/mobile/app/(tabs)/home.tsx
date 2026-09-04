import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '../../src/store/wallet.store';
import { useAuthStore } from '../../src/store/auth.store';
import { ScreenContainer, Card, Button, LoadingState, ErrorState, StatusBadge } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import { formatDateTime } from '../../src/utils/date';

/** Category shortcuts are static UI only — every one of these already has a real
 * backend catalog category (spec section 8); none is invented. Tapping routes to the
 * Transaksi tab, which is a Fase 3 placeholder today. */
const CATEGORY_SHORTCUTS = [
  { key: 'pulsa', label: 'Pulsa', icon: 'call' as const },
  { key: 'paket-data', label: 'Paket Data', icon: 'wifi' as const },
  { key: 'pln', label: 'Token Listrik', icon: 'flash' as const },
  { key: 'voucher-internet', label: 'Voucher Internet', icon: 'globe' as const },
  { key: 'game', label: 'Game', icon: 'game-controller' as const },
  { key: 'tagihan', label: 'Tagihan', icon: 'receipt' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { overview, loading, error, fetchWallet } = useWalletStore();

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Refresh balance every time Home regains focus (e.g. returning from a purchase) —
  // spec section 34: refresh wallet after anything that could have changed it.
  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [fetchWallet])
  );

  return (
    <ScreenContainer onRefresh={fetchWallet} refreshing={loading}>
      <View>
        <Text style={styles.greeting}>Halo, {user?.name?.split(' ')[0] || 'Kasir'} 👋</Text>
        <Text style={styles.greetingSub}>Siap melayani transaksi hari ini</Text>
      </View>

      {loading && !overview ? (
        <LoadingState label="Memuat saldo..." />
      ) : error && !overview ? (
        <ErrorState message={error} onRetry={fetchWallet} />
      ) : (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo GurkyPay</Text>
            <Text style={styles.balanceAmount}>{formatIDR(overview?.wallet.balance)}</Text>
            <Text style={styles.walletNo}>{overview?.wallet.walletNo || overview?.wallet.wallet_number || '-'}</Text>
            <View style={styles.balanceButtonWrap}>
              <Button label="Top Up Saldo" onPress={() => {}} variant="secondary" disabled />
            </View>
          </View>

          <View style={styles.statRow}>
            <Card style={styles.statTile}>
              <Text style={styles.statLabel}>Pemasukan Bulan Ini</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {formatIDR(overview?.summary.income_this_month)}
              </Text>
            </Card>
            <Card style={styles.statTile}>
              <Text style={styles.statLabel}>Pengeluaran Bulan Ini</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {formatIDR(overview?.summary.expense_this_month)}
              </Text>
            </Card>
            <Card style={styles.statTile}>
              <Text style={styles.statLabel}>Mutasi Tercatat</Text>
              <Text style={styles.statValue}>{overview?.summary.transaction_count ?? 0}</Text>
            </Card>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Kategori Transaksi</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_SHORTCUTS.map((cat) => (
                <View key={cat.key} style={styles.categoryItem}>
                  <View
                    style={styles.categoryIconWrap}
                    onTouchEnd={() => router.push('/(tabs)/transaksi')}
                  >
                    <Ionicons name={cat.icon} size={22} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Mutasi Saldo Terbaru</Text>
            {!overview?.recent_transactions?.length ? (
              <Card>
                <Text style={styles.emptyText}>Belum ada mutasi saldo.</Text>
              </Card>
            ) : (
              <View style={styles.transactionList}>
                {overview.recent_transactions.slice(0, 8).map((mutation) => {
                  const isCredit = mutation.direction === 'credit';
                  const title =
                    mutation.service_name ||
                    mutation.description ||
                    (isCredit ? 'Kredit Saldo' : 'Debit Saldo');
                  return (
                    <Card key={mutation.id} style={styles.transactionCard}>
                      <View style={styles.transactionRow}>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.transactionName} numberOfLines={1}>
                            {title}
                          </Text>
                          <Text style={styles.transactionTarget} numberOfLines={1}>
                            {mutation.invoice_number ? `${mutation.invoice_number} · ` : ''}
                            {formatDateTime(mutation.created_at)}
                          </Text>
                        </View>
                        <View style={styles.transactionAmountWrap}>
                          <Text style={[styles.transactionAmount, isCredit && styles.transactionAmountCredit]}>
                            {isCredit ? '+' : '-'}
                            {formatIDR(mutation.amount)}
                          </Text>
                          {mutation.status && <StatusBadge status={mutation.status} />}
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: typography.size.xl, fontWeight: typography.weight.black, color: colors.gray[900] },
  greetingSub: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: 2 },
  balanceCard: {
    backgroundColor: colors.primary[700],
    borderRadius: radius['2xl'],
    padding: spacing.xl,
  },
  balanceLabel: { color: colors.primary[100], fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  balanceAmount: { color: colors.white, fontSize: typography.size['3xl'], fontWeight: typography.weight.black, marginTop: spacing.xs },
  walletNo: { color: colors.primary[200], fontSize: typography.size.xs, marginTop: spacing.xs },
  balanceButtonWrap: { marginTop: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, padding: spacing.md, gap: spacing.xs },
  statLabel: { fontSize: typography.size.xs, color: colors.gray[500], fontWeight: typography.weight.medium },
  statValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryItem: { alignItems: 'center', width: '30%', gap: spacing.xs },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: { fontSize: typography.size.xs, color: colors.gray[700], textAlign: 'center', fontWeight: typography.weight.medium },
  transactionList: { gap: spacing.sm },
  transactionCard: { padding: spacing.md },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transactionInfo: { flex: 1, marginRight: spacing.sm },
  transactionName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.gray[900] },
  transactionTarget: { fontSize: typography.size.xs, color: colors.gray[500], marginTop: 2 },
  transactionAmountWrap: { alignItems: 'flex-end', gap: spacing.xs },
  transactionAmount: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  transactionAmountCredit: { color: colors.primary[600] },
  emptyText: { color: colors.gray[500], fontSize: typography.size.sm, textAlign: 'center' },
});
