import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Button, Card, LoadingState } from '../../src/components/ui';
import { useTransferStore } from '../../src/store/transfer.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { transactionService, ReceiptData } from '../../src/services/transaction.service';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

/**
 * Success result for Sesama GurkyPay.
 * Wallet refresh via GET /wallet only — no local debit.
 * Receipt reuses GET /transactions/{id}/receipt.
 * Share: RN Share (no new deps). Print: expo-print not installed → P1 gap.
 */
export default function TransferResultScreen() {
  const router = useRouter();
  const transaction = useTransferStore((s) => s.transaction);
  const recipient = useTransferStore((s) => s.recipientWalletNumber);
  const recipientName = useTransferStore((s) => s.recipientName);
  const adminFee = useTransferStore((s) => s.adminFee);
  const reset = useTransferStore((s) => s.reset);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const walletRefreshedRef = useRef(false);

  useEffect(() => {
    if (!transaction || walletRefreshedRef.current) return;
    walletRefreshedRef.current = true;
    void fetchWallet();
  }, [transaction, fetchWallet]);

  const loadReceipt = async () => {
    if (!transaction?.id) return;
    setShowReceipt(true);
    setShareError(null);
    setReceiptLoading(true);
    try {
      const res = await transactionService.getReceipt(transaction.id);
      if (res.success && res.data) setReceipt(res.data);
    } catch {
      // Best-effort
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleShare = async () => {
    if (!transaction) return;
    setShareError(null);
    const amount = Number(transaction.amount ?? 0);
    const fee = Number(transaction.admin_fee ?? transaction.adminFee ?? adminFee ?? 0);
    const target =
      transaction.target_number || transaction.targetNumber || recipient;
    const when =
      transaction.created_at ||
      transaction.createdAt ||
      receipt?.transaction_details?.date ||
      new Date().toISOString();
    const invoice =
      transaction.invoice_number ||
      transaction.invoiceNumber ||
      receipt?.transaction_details?.invoice_number ||
      String(transaction.id);

    const body = [
      'GurkyPay — Transfer Saldo',
      'Status: Berhasil',
      `Kepada: ${recipientName || '—'}`,
      `ID / No. Rekening: ${target}`,
      `Nominal: ${formatIDR(amount)}`,
      `Biaya: ${formatIDR(fee)}`,
      `Total: ${formatIDR(amount + fee)}`,
      `Tanggal: ${new Date(when).toLocaleString('id-ID')}`,
      `Invoice: ${invoice}`,
    ].join('\n');

    try {
      await Share.share({ message: body, title: 'Struk Transfer GurkyPay' });
    } catch {
      setShareError('Gagal membagikan struk.');
    }
  };

  const handleDone = () => {
    reset();
    router.replace('/(tabs)/wallet');
  };

  if (!transaction) {
    return (
      <ScreenContainer belowHeader>
        <Stack.Screen options={{ headerShown: true, title: 'Hasil Transfer', headerBackVisible: false }} />
        <LoadingState label="Memuat hasil transfer..." />
        <Button label="Selesai" variant="secondary" onPress={handleDone} />
      </ScreenContainer>
    );
  }

  const target =
    transaction.target_number || transaction.targetNumber || recipient;
  const amount = Number(transaction.amount ?? 0);
  const fee = Number(transaction.admin_fee ?? transaction.adminFee ?? adminFee ?? 0);
  const when =
    transaction.created_at || transaction.createdAt
      ? new Date(String(transaction.created_at || transaction.createdAt)).toLocaleString('id-ID')
      : '—';

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen
        options={{ headerShown: true, title: 'Hasil Transfer', headerBackVisible: false }}
      />

      <View style={styles.hero}>
        <View style={styles.checkWrap}>
          <Ionicons name="checkmark" size={36} color={colors.white} />
        </View>
        <Text style={styles.title}>Transfer Berhasil</Text>
        <Text style={styles.amount}>{formatIDR(amount)}</Text>
        <Text style={styles.toLabel}>Kepada</Text>
        <Text style={styles.toName}>{recipientName || '—'}</Text>
        <Text style={styles.toValue}>{target}</Text>
      </View>

      <View style={styles.metaCard}>
        <MetaRow label="Biaya Transfer" value={formatIDR(fee)} />
        <MetaRow label="Tanggal" value={when} />
      </View>

      {!showReceipt ? (
        <View style={styles.actions}>
          {transaction.id ? (
            <Button label="Lihat Struk" variant="secondary" onPress={() => void loadReceipt()} />
          ) : null}
          <Button label="Selesai" onPress={handleDone} />
        </View>
      ) : null}

      {showReceipt && receiptLoading && !receipt ? (
        <Text style={styles.receiptLoading}>Memuat struk...</Text>
      ) : null}

      {showReceipt && receipt ? (
        <Card style={styles.receiptCard}>
          <Text style={styles.brand}>GurkyPay</Text>
          <Text style={styles.receiptTitle}>Transfer Saldo</Text>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Status</Text>
            <Text style={styles.receiptValueOk}>Berhasil</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Kepada</Text>
            <Text style={styles.receiptValue}>{recipientName || '—'}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>ID / No. Rekening</Text>
            <Text style={styles.receiptValue}>{target}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Nominal</Text>
            <Text style={styles.receiptValue}>{formatIDR(amount)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Biaya</Text>
            <Text style={styles.receiptValue}>{formatIDR(fee)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Total</Text>
            <Text style={styles.receiptValueBold}>{formatIDR(amount + fee)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Tanggal</Text>
            <Text style={styles.receiptValue}>
              {new Date(receipt.transaction_details.date).toLocaleString('id-ID')}
            </Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Invoice</Text>
            <Text style={styles.receiptValue}>
              {receipt.transaction_details.invoice_number || String(transaction.id)}
            </Text>
          </View>

          {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}

          <View style={styles.receiptActions}>
            <Button label="Bagikan" variant="secondary" onPress={() => void handleShare()} />
            <Button label="Selesai" onPress={handleDone} />
          </View>
          <Text style={styles.printGap}>
            Cetak native belum tersedia di Mobile (expo-print belum terpasang).
          </Text>
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  checkWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  amount: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  toLabel: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
  toName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  toValue: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
  },
  metaCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: { fontSize: typography.size.sm, color: colors.gray[500] },
  metaValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  receiptLoading: {
    marginTop: spacing.lg,
    fontSize: typography.size.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  receiptCard: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  brand: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
    textAlign: 'center',
  },
  receiptTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  receiptLabel: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  receiptValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right',
  },
  receiptValueOk: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  receiptValueBold: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
    flexShrink: 1,
    textAlign: 'right',
  },
  receiptActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shareError: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
  },
  printGap: {
    fontSize: typography.size.xs,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
