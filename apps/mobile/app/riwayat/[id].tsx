import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { transactionService } from '../../src/services/transaction.service';
import { Transaction } from '../../src/api/types';
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
  StatusBadge,
  Button,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import {
  formatHistoryTarget,
  formatTransactionDateTime,
} from '../../src/utils/transactionDisplay';
import { isPendingStatus } from '../../src/utils/transactionStatus';

/**
 * Purchase transaction detail — GET /transactions/{id_or_invoice}.
 * Read-only; no retry / re-POST.
 */
export default function RiwayatDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Transaksi tidak ditemukan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await transactionService.getById(id);
      if (res.success && res.data) {
        setTx(res.data);
      } else {
        setTx(null);
        setError(res.message || 'Transaksi tidak ditemukan.');
      }
    } catch (err: any) {
      setTx(null);
      setError(err?.message || 'Gagal memuat detail transaksi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Soft poll while pending (same idea as Web Riwayat) — GET only.
  useEffect(() => {
    if (!tx || !isPendingStatus(tx.status)) return;
    const timer = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [tx?.status, tx?.id, load]);

  return (
    <ScreenContainer belowHeader onRefresh={() => void load()} refreshing={loading}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Detail Transaksi',
          headerBackTitle: 'Kembali',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {loading && !tx ? (
        <LoadingState label="Memuat detail..." />
      ) : error && !tx ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !tx ? (
        <ErrorState message="Transaksi tidak ditemukan." />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.statusRow}>
              <StatusBadge status={tx.status} />
            </View>
            <Text style={styles.service}>{tx.serviceName || 'Transaksi'}</Text>
            {tx.productName && tx.productName !== tx.serviceName ? (
              <Text style={styles.product}>{tx.productName}</Text>
            ) : null}
            <Text style={styles.amount}>{formatIDR(tx.totalPayment || tx.amount)}</Text>
          </Card>

          <Card style={styles.card}>
            <DetailRow label="Invoice" value={tx.transactionCode || '—'} />
            <DetailRow label="Tujuan" value={formatHistoryTarget(tx.targetNo)} />
            <DetailRow label="Waktu" value={formatTransactionDateTime(tx.createdAt || tx.date)} />
            <DetailRow label="Metode" value={tx.paymentMethod || '—'} />
            {tx.adminFee > 0 ? (
              <DetailRow label="Biaya admin" value={formatIDR(tx.adminFee)} />
            ) : null}
            {tx.notes ? <DetailRow label="Catatan" value={String(tx.notes)} /> : null}
          </Card>

          {isPendingStatus(tx.status) ? (
            <Text style={styles.pendingHint}>
              Transaksi masih diproses. Status akan diperbarui otomatis — tidak perlu mengirim ulang.
            </Text>
          ) : null}

          <Button label="Kembali ke Riwayat" variant="secondary" onPress={() => router.back()} />
        </>
      )}
    </ScreenContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  statusRow: { marginBottom: spacing.xs },
  service: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  product: { fontSize: typography.size.sm, color: colors.gray[600] },
  amount: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  detailLabel: { fontSize: typography.size.xs, color: colors.gray[500], fontWeight: typography.weight.medium },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.size.sm,
    color: colors.gray[900],
    fontWeight: typography.weight.medium,
  },
  pendingHint: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
    backgroundColor: colors.status.pendingBg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
});
