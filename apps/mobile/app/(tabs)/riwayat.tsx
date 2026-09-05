import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  HISTORY_STATUS_OPTIONS,
  buildProductOptionsFromTransactions,
  selectFilteredHistory,
  useHistoryStore,
} from '../../src/store/history.store';
import { groupTransactionsByPeriod } from '../../src/utils/historyGrouping';
import {
  formatHistoryTarget,
  formatTransactionDateTime,
  transactionTimestamp,
} from '../../src/utils/transactionDisplay';
import { Transaction } from '../../src/api/types';
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusBadge,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

/**
 * Riwayat — purchase transaction history (GET /transactions).
 * Not wallet ledger. Filter screen: Produk + Waktu + Status.
 */

function serviceIcon(serviceName: string): keyof typeof Ionicons.glyphMap {
  const s = serviceName.toLowerCase();
  if (s.includes('pulsa')) return 'call-outline';
  if (s.includes('data') || s.includes('paket')) return 'wifi-outline';
  if (s.includes('pln') || s.includes('token')) return 'flash-outline';
  if (s.includes('game')) return 'game-controller-outline';
  if (s.includes('langganan') || s.includes('streaming')) return 'play-circle-outline';
  if (s.includes('voucher')) return 'gift-outline';
  if (s.includes('top up') || s.includes('topup') || s.includes('wallet')) return 'wallet-outline';
  if (s.includes('tagihan') || s.includes('pdam') || s.includes('bpjs')) return 'receipt-outline';
  return 'cube-outline';
}

function TransactionCard({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const title = tx.serviceName || 'Transaksi';
  const product = tx.productName && tx.productName !== tx.serviceName ? tx.productName : null;
  const when = formatTransactionDateTime(tx.createdAt || tx.date);
  const amount = tx.totalPayment || tx.amount;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={styles.txIconWrap}>
            <Ionicons name={serviceIcon(title)} size={20} color={colors.primary[600]} />
          </View>
          <View style={styles.txBody}>
            <Text style={styles.txService} numberOfLines={1}>
              {title}
            </Text>
            {product ? (
              <Text style={styles.txProduct} numberOfLines={1}>
                {product}
              </Text>
            ) : null}
            <Text style={styles.txMeta} numberOfLines={1}>
              {formatHistoryTarget(tx.targetNo)}
            </Text>
            <Text style={styles.txMeta} numberOfLines={1}>
              {when}
              {tx.transactionCode ? ` · ${tx.transactionCode}` : ''}
            </Text>
          </View>
          <View style={styles.txRight}>
            <Text style={styles.txAmount}>{formatIDR(amount)}</Text>
            <StatusBadge status={tx.status} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function summarizeFilters(store: ReturnType<typeof useHistoryStore.getState>): string | null {
  const f = store.filters;
  const parts: string[] = [];
  if (f.product !== 'all') {
    const opts = buildProductOptionsFromTransactions(store.items);
    parts.push(opts.find((o) => o.key === f.product)?.label || f.product);
  }
  if (f.timeMode === 'month') {
    const [y, m] = f.monthKey.split('-').map(Number);
    if (y && m) {
      parts.push(
        new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      );
    }
  } else if (f.timeMode === 'date') {
    parts.push(`${f.dateStart} – ${f.dateEnd}`);
  }
  if (f.status !== 'all') {
    parts.push(HISTORY_STATUS_OPTIONS.find((o) => o.key === f.status)?.label || f.status);
  }
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

export default function RiwayatScreen() {
  const router = useRouter();
  const store = useHistoryStore();
  const {
    loading,
    loadingMore,
    error,
    searchQuery,
    meta,
    filters,
    setSearchQuery,
    refresh,
    loadMore,
  } = store;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const filtered = useMemo(
    () => selectFilteredHistory(store),
    [store.items, store.searchQuery, store.filters]
  );

  const groups = useMemo(() => groupTransactionsByPeriod(filtered), [filtered]);
  const filterSummary = useMemo(() => summarizeFilters(store), [store.filters, store.items]);

  const hasActiveClientFilter =
    searchQuery.trim().length > 0 ||
    filters.product !== 'all' ||
    filters.status !== 'all' ||
    filters.timeMode !== 'all';

  const emptyMessage = hasActiveClientFilter
    ? 'Transaksi tidak ditemukan untuk filter ini.'
    : 'Belum ada transaksi pembelian.';

  const canLoadMore = Boolean(meta && meta.current_page < meta.last_page);

  return (
    <ScreenContainer onRefresh={() => void refresh()} refreshing={loading}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Riwayat Transaksi</Text>
          <Text style={styles.subtitle}>Transaksi pembelian layanan Anda</Text>
        </View>
        <Pressable
          onPress={() => router.push('/riwayat/laporan')}
          style={styles.headerIconBtn}
          accessibilityLabel="Laporan Keuangan"
          hitSlop={8}
        >
          <Ionicons name="download-outline" size={22} color={colors.gray[800]} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.gray[400]} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari transaksi..."
            placeholderTextColor={colors.gray[400]}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable
          onPress={() => router.push('/riwayat/filter')}
          style={[styles.filterBtn, hasActiveClientFilter && styles.filterBtnActive]}
          accessibilityLabel="Filter Transaksi"
          hitSlop={6}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={hasActiveClientFilter ? colors.primary[700] : colors.gray[700]}
          />
        </Pressable>
      </View>

      {filterSummary ? (
        <Text style={styles.filterSummary} numberOfLines={2}>
          Filter: {filterSummary}
        </Text>
      ) : null}

      {loading && store.items.length === 0 ? (
        <LoadingState label="Memuat riwayat..." />
      ) : error && store.items.length === 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Belum Ada Transaksi" message={emptyMessage} />
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.groupRule} />
              <View style={styles.groupList}>
                {group.items.map((tx) => (
                  <TransactionCard
                    key={tx.id || `${tx.transactionCode}-${transactionTimestamp(tx)}`}
                    tx={tx}
                    onPress={() =>
                      router.push({
                        pathname: '/riwayat/[id]',
                        params: { id: tx.id || tx.transactionCode },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))}
          {loadingMore ? (
            <ActivityIndicator color={colors.primary[600]} style={{ marginVertical: spacing.md }} />
          ) : null}
          {canLoadMore && !loadingMore ? (
            <Pressable onPress={() => void loadMore()} style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreText}>Muat lebih banyak</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 2, minWidth: 0 },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500] },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    color: colors.gray[900],
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  filterSummary: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: -spacing.sm,
  },
  groups: { gap: spacing.xl },
  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
    textTransform: 'capitalize',
  },
  groupRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray[200] },
  groupList: { gap: spacing.sm },
  txCard: { padding: spacing.md },
  txRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: { flex: 1, gap: 2, minWidth: 0 },
  txService: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  txProduct: { fontSize: typography.size.xs, color: colors.gray[700] },
  txMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  txRight: { alignItems: 'flex-end', gap: spacing.xs },
  txAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  pressed: { opacity: 0.85 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
});
