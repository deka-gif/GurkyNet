import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { transactionService, ReceiptData } from '../../src/services/transaction.service';
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
import {
  isPendingStatus,
  isWalletTopUpService,
} from '../../src/utils/transactionStatus';
import { openSnapCheckout } from '../../src/utils/topupSnap';
import { useTopUpStore } from '../../src/store/topup.store';

/**
 * Transaction detail — GET /transactions/{id}.
 * Top Up pending: resume via paymentResume (no new create).
 * Closing Snap ≠ cancel; sync determines status.
 * Voucher Internet SN: GET …/receipt (voucher_internet_code) — never invent client-side.
 */
export default function RiwayatDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canResume, setCanResume] = useState(false);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const config = useTopUpStore((s) => s.config);
  const loadConfig = useTopUpStore((s) => s.loadConfig);

  const isTopUp = tx
    ? isWalletTopUpService(tx.serviceName, tx.paymentMethod, tx.transactionCode)
    : false;

  const load = useCallback(async () => {
    if (!id) {
      setError('Transaksi tidak ditemukan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await transactionService.getDetailRaw(id);
      const resume = (raw.paymentResume as Record<string, unknown>) || {};
      setCanResume(Boolean(resume.canResume));
      setSnapToken((resume.snapToken as string | null) ?? null);

      const res = await transactionService.getById(id);
      if (res.success && res.data) {
        setTx(res.data);
        try {
          const receiptRes = await transactionService.getReceipt(id);
          if (receiptRes.success && receiptRes.data) {
            setReceipt(receiptRes.data);
          }
        } catch {
          setReceipt(null);
        }
      } else {
        setTx(null);
        setReceipt(null);
        setError(res.message || 'Transaksi tidak ditemukan.');
      }
    } catch (err: any) {
      setTx(null);
      setReceipt(null);
      setError(err?.message || 'Gagal memuat detail transaksi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    if (!config) void loadConfig();
  }, [load, config, loadConfig]);

  useEffect(() => {
    if (!tx || !isPendingStatus(tx.status)) return;
    const timer = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [tx?.status, tx?.id, load]);

  const onResume = async () => {
    if (!canResume || !snapToken || busy) return;
    setBusy(true);
    setActionMsg(null);
    try {
      await transactionService.syncPayment(id);
      const raw = await transactionService.getDetailRaw(id);
      const resume = (raw.paymentResume as Record<string, unknown>) || {};
      const still = Boolean(resume.canResume);
      const token = (resume.snapToken as string | null) ?? null;
      setCanResume(still);
      setSnapToken(token);
      const status = String(raw.status || '').toLowerCase();
      if (status === 'expired') {
        setActionMsg('Pembayaran sudah kedaluwarsa. Buat Top Up baru.');
        await load();
        return;
      }
      if (!still || !token) {
        setActionMsg('Pembayaran tidak dapat dilanjutkan.');
        await load();
        return;
      }
      await openSnapCheckout({
        snapToken: token,
        isProduction: !!config?.is_production,
      });
      // Close Snap ≠ cancel — reconcile then refresh.
      await transactionService.syncPayment(id);
      await load();
      setActionMsg('Jika sudah membayar, status akan diperbarui setelah dikonfirmasi backend.');
    } catch (err: any) {
      setActionMsg(err?.message || 'Gagal melanjutkan pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  const expired = String(tx?.status || '').toLowerCase() === 'expired';
  const success = String(tx?.status || '').toLowerCase() === 'success';
  const voucherCode =
    typeof receipt?.transaction_details.voucher_internet_code === 'string'
      ? receipt.transaction_details.voucher_internet_code
      : null;

  const copyVoucherCode = async () => {
    if (!voucherCode) return;
    try {
      await Clipboard.setStringAsync(voucherCode);
      setCopyMsg('Kode disalin.');
    } catch {
      setCopyMsg('Gagal menyalin kode.');
    }
  };

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
              <StatusBadge
                status={tx.status}
                serviceName={tx.serviceName}
                paymentMethod={tx.paymentMethod}
                transactionCode={tx.transactionCode}
              />
            </View>
            <Text style={styles.service}>{tx.serviceName || 'Transaksi'}</Text>
            {tx.productName && tx.productName !== tx.serviceName ? (
              <Text style={styles.product}>{tx.productName}</Text>
            ) : null}
            <Text style={styles.amount}>{formatIDR(tx.totalPayment || tx.amount)}</Text>
          </Card>

          <Card style={styles.card}>
            <DetailRow label="Invoice" value={tx.transactionCode || '—'} />
            {!isTopUp ? (
              <DetailRow label="Tujuan" value={formatHistoryTarget(tx.targetNo)} />
            ) : null}
            <DetailRow label="Waktu" value={formatTransactionDateTime(tx.createdAt || tx.date)} />
            <DetailRow label="Metode" value={tx.paymentMethod || '—'} />
            {tx.adminFee > 0 ? (
              <DetailRow label="Biaya admin" value={formatIDR(tx.adminFee)} />
            ) : null}
            {tx.notes ? <DetailRow label="Catatan" value={String(tx.notes)} /> : null}
          </Card>

          {voucherCode ? (
            <Card style={styles.card}>
              <Text style={styles.voucherLabel}>Kode Voucher</Text>
              <Text style={styles.voucherCode} selectable>
                {voucherCode}
              </Text>
              <Button label="Salin Kode" onPress={() => void copyVoucherCode()} />
              {copyMsg ? <Text style={styles.copyMsg}>{copyMsg}</Text> : null}
            </Card>
          ) : null}

          {isTopUp && isPendingStatus(tx.status) ? (
            <Text style={styles.pendingHint}>
              Belum Dibayar. Menutup halaman pembayaran tidak membatalkan transaksi. Selesaikan
              pembayaran atau lanjutkan dari sini.
            </Text>
          ) : null}

          {isTopUp && expired ? (
            <View style={styles.expiredBox}>
              <Text style={styles.expiredTitle}>Expired</Text>
              <Text style={styles.expiredBody}>
                Pembayaran kedaluwarsa. Tidak dapat dilanjutkan. Buat Top Up baru jika ingin mengisi
                saldo.
              </Text>
            </View>
          ) : null}

          {actionMsg ? <Text style={styles.actionMsg}>{actionMsg}</Text> : null}

          {isTopUp && canResume && snapToken && isPendingStatus(tx.status) ? (
            <Button
              label={busy ? 'Membuka…' : 'Lanjutkan Pembayaran'}
              onPress={() => void onResume()}
              disabled={busy}
            />
          ) : null}

          {isTopUp && expired ? (
            <Button label="Top Up Baru" onPress={() => router.push('/topup')} />
          ) : null}

          {isTopUp && success ? (
            <Button label="Buka Wallet" variant="secondary" onPress={() => router.push('/(tabs)/wallet')} />
          ) : null}

          {!isTopUp && isPendingStatus(tx.status) ? (
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
  card: { gap: spacing.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  service: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  product: { fontSize: typography.size.sm, color: colors.gray[600] },
  amount: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailLabel: { fontSize: typography.size.sm, color: colors.gray[500] },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  pendingHint: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  expiredBox: {
    backgroundColor: colors.status.failedBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  expiredTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.status.failed,
  },
  expiredBody: { fontSize: typography.size.sm, color: colors.gray[700], lineHeight: 20 },
  actionMsg: { fontSize: typography.size.sm, color: colors.gray[600], lineHeight: 20 },
  voucherLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textTransform: 'uppercase',
  },
  voucherCode: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    letterSpacing: 1,
  },
  copyMsg: { fontSize: typography.size.xs, color: colors.status.success },
});
