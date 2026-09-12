import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCheckoutStore } from '../../src/store/checkout.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { useAuthStore } from '../../src/store/auth.store';
import { transactionService, ReceiptData } from '../../src/services/transaction.service';
import { ScreenContainer, Card, Button, LoadingState, StatusBadge } from '../../src/components/ui';
import { ReceiptSharePrintBar } from '../../src/components/receipt/ReceiptSharePrintBar';
import { colors, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import { appEvents, TRANSACTION_STATUS_PUSH_EVENT } from '../../src/utils/eventEmitter';
import {
  pushHintMatchesCheckoutTransaction,
  type TransactionPushHint,
} from '../../src/utils/transactionStatusFromPush';

/** Backend's own normalized vocabulary (TransactionResource) — never a client-invented
 * status. Matches the terminal set audited from TransactionStatusMapper. */
const TERMINAL_STATUSES = ['success', 'failed', 'expired', 'cancelled', 'refunded'];

// Align with backend TransactionTimeoutService (default 180s) + Digi Pasca-Hookshot lag.
// Evidence 2026-09-12 ShopeePay: pay-pasca Pending → webhook SUCCESS ~148s later; old
// 12×5s (~60s) poll stopped early and left the UI stuck on Tertunda despite settle+push.
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 48; // ~4 minutes, GET only — never re-POSTs purchase
// Push (TRANSACTION_STATUS_PUSH_EVENT) remains the safety net after this window.

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status.toLowerCase());
}

export default function CheckoutResultScreen() {
  const router = useRouter();
  const transaction = useCheckoutStore((s) => s.transaction);
  const setTransaction = useCheckoutStore((s) => s.setTransaction);
  const setStatus = useCheckoutStore((s) => s.setStatus);
  const startNewPurchase = useCheckoutStore((s) => s.startNewPurchase);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const walletRefreshedRef = useRef(false);
  const userName = useAuthStore((s) => s.user?.name);

  const loadReceipt = async (idOrInvoice: string | number) => {
    setReceiptLoading(true);
    try {
      const res = await transactionService.getReceipt(idOrInvoice);
      if (res.success && res.data) setReceipt(res.data);
    } catch {
      // Best-effort — a terminal status still renders correctly without a receipt.
    } finally {
      setReceiptLoading(false);
    }
  };

  const onSettled = (finalTransaction: { id: string; status: string }) => {
    if (!walletRefreshedRef.current) {
      walletRefreshedRef.current = true;
      // Backend already finalized the hold/debit/refund — this only pulls the
      // authoritative post-terminal balance, it never computes anything locally.
      // Mobile's wallet store has no cache layer (unlike web's), so a plain call
      // already always hits GET /wallet fresh.
      void fetchWallet();
    }
    void loadReceipt(finalTransaction.id);
  };

  /** GET once — used by poll, AppState resume, and push safety-net. Never POSTs. */
  const refreshFromServer = async (txId: string): Promise<boolean> => {
    try {
      const res = await transactionService.getById(txId);
      if (res.success && res.data) {
        setTransaction(res.data);
        setStatus(res.data.status);
        if (isTerminal(res.data.status)) {
          onSettled(res.data);
          return true;
        }
      }
    } catch {
      // Transient network error — keep trying, never POST.
    }
    return false;
  };

  useEffect(() => {
    if (!transaction) return;

    if (isTerminal(transaction.status)) {
      onSettled(transaction);
      return;
    }

    let cancelled = false;
    const txId = transaction.id;

    const pollOnce = async () => {
      if (cancelled) return false;
      return refreshFromServer(txId);
    };

    const run = async () => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (cancelled) return;
        if (await pollOnce()) return;
      }
    };

    // Resume from background: Digi Pasca-Hookshot may have settled while UI was paused.
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !cancelled) {
        void pollOnce();
      }
    });

    void run();
    return () => {
      cancelled = true;
      appSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id]);

  // Push safety-net: lives for the whole screen lifetime — still works after poll ends.
  // Reuses Expo transaction push infra (tray + payload); does not trust push body for status.
  useEffect(() => {
    if (!transaction?.id) return;
    const txId = transaction.id;

    return appEvents.on(TRANSACTION_STATUS_PUSH_EVENT, (raw) => {
      const hint = (raw || {}) as TransactionPushHint;
      const current = useCheckoutStore.getState().transaction;
      if (!pushHintMatchesCheckoutTransaction(current, hint)) return;
      void refreshFromServer(txId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id]);

  // When push sync updates the store while this screen is mounted, settle receipt/wallet.
  useEffect(() => {
    if (!transaction) return;
    if (isTerminal(transaction.status)) {
      onSettled(transaction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id, transaction?.status]);

  const handleNewPurchase = () => {
    startNewPurchase();
    router.replace('/(tabs)/transaksi');
  };

  const voucherCode =
    typeof receipt?.transaction_details.voucher_internet_code === 'string'
      ? receipt.transaction_details.voucher_internet_code
      : null;

  const receiptVoucherCode =
    typeof receipt?.transaction_details.voucher_code === 'string'
      ? receipt.transaction_details.voucher_code
      : null;
  const activationCode =
    typeof receipt?.transaction_details.activation_code === 'string'
      ? receipt.transaction_details.activation_code
      : null;
  const activationUrl =
    typeof receipt?.transaction_details.activation_url === 'string'
      ? receipt.transaction_details.activation_url
      : null;
  const serialNumber =
    typeof receipt?.transaction_details.serial_number === 'string'
      ? receipt.transaction_details.serial_number
      : null;

  /** PLACEHOLDER targets (eSIM → ESIM) must not appear as customer "Nomor Tujuan". */
  const displayTargetNo = (() => {
    const raw = String(transaction?.targetNo ?? '').trim();
    if (!raw) return null;
    if (raw.toUpperCase() === 'ESIM') return null;
    return raw;
  })();

  const copyVoucherCode = async () => {
    if (!voucherCode) return;
    try {
      await Clipboard.setStringAsync(voucherCode);
      setCopyMsg('Kode disalin.');
    } catch {
      setCopyMsg('Gagal menyalin kode.');
    }
  };

  const copyText = async (value: string, okMsg: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopyMsg(okMsg);
    } catch {
      setCopyMsg('Gagal menyalin.');
    }
  };

  if (!transaction) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Status Transaksi' }} />
        <LoadingState label="Memuat status transaksi..." />
      </ScreenContainer>
    );
  }

  const terminal = isTerminal(transaction.status);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{ headerShown: true, title: 'Status Transaksi', headerBackVisible: false }}
      />

      <Card style={styles.statusCard}>
        <StatusBadge status={transaction.status} />
        <Text style={styles.serviceName}>{transaction.serviceName}</Text>
        {displayTargetNo ? <Text style={styles.targetNo}>{displayTargetNo}</Text> : null}
        {/* Total dibayar comes straight from the transaction response — never
            recomputed client-side. */}
        <Text style={styles.total}>{formatIDR(transaction.totalPayment)}</Text>
        <Text style={styles.invoice}>{transaction.transactionCode}</Text>
      </Card>

      {!terminal && (
        <View style={styles.processingWrap}>
          <LoadingState label="Menunggu konfirmasi dari sistem..." />
          <Text style={styles.processingHint}>
            Transaksi sedang diproses provider. Status bisa tetap Tertunda beberapa menit
            meskipun saldo tujuan sudah masuk — halaman ini diperbarui otomatis (jangan ulang
            transaksi).
          </Text>
        </View>
      )}

      {terminal && receiptLoading && !receipt && <Text style={styles.receiptLoading}>Memuat struk...</Text>}

      {terminal && voucherCode ? (
        <Card style={styles.voucherCard}>
          <Text style={styles.voucherTitle}>Kode Voucher</Text>
          <Text style={styles.voucherCode} selectable>
            {voucherCode}
          </Text>
          <Button label="Salin Kode" onPress={() => void copyVoucherCode()} />
          {copyMsg ? <Text style={styles.copyMsg}>{copyMsg}</Text> : null}
          <Text style={styles.voucherHint}>Kode tersimpan di Riwayat</Text>
        </Card>
      ) : null}

      {/* Delivery fields only when receipt API actually returns them (no invented QR/ICCID). */}
      {terminal &&
      !voucherCode &&
      (receiptVoucherCode || activationCode || activationUrl || (serialNumber && !voucherCode)) ? (
        <Card style={styles.voucherCard}>
          <Text style={styles.voucherTitle}>Detail Pengiriman</Text>
          {receiptVoucherCode ? (
            <>
              <Text style={styles.receiptLabel}>Kode</Text>
              <Text style={styles.voucherCode} selectable>
                {receiptVoucherCode}
              </Text>
              <Button
                label="Salin Kode"
                onPress={() => void copyText(receiptVoucherCode, 'Kode disalin.')}
              />
            </>
          ) : null}
          {activationCode ? (
            <>
              <Text style={styles.receiptLabel}>Kode Aktivasi</Text>
              <Text style={styles.voucherCode} selectable>
                {activationCode}
              </Text>
              <Button
                label="Salin Kode Aktivasi"
                onPress={() => void copyText(activationCode, 'Kode aktivasi disalin.')}
              />
            </>
          ) : null}
          {activationUrl ? (
            <>
              <Text style={styles.receiptLabel}>URL Aktivasi</Text>
              <Text style={styles.voucherCode} selectable>
                {activationUrl}
              </Text>
            </>
          ) : null}
          {serialNumber && !receiptVoucherCode ? (
            <>
              <Text style={styles.receiptLabel}>Serial Number</Text>
              <Text style={styles.voucherCode} selectable>
                {serialNumber}
              </Text>
            </>
          ) : null}
          {copyMsg ? <Text style={styles.copyMsg}>{copyMsg}</Text> : null}
        </Card>
      ) : null}

      {terminal && receipt && (
        <Card style={styles.receiptCard}>
          <Text style={styles.receiptTitle}>Struk Transaksi</Text>
          {typeof receipt.transaction_details.token_code_grouped === 'string' &&
          receipt.transaction_details.token_code_grouped ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Kode Token</Text>
              <Text style={styles.receiptValue}>
                {receipt.transaction_details.token_code_grouped}
              </Text>
            </View>
          ) : typeof receipt.transaction_details.token_code === 'string' &&
            receipt.transaction_details.token_code ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Kode Token</Text>
              <Text style={styles.receiptValue}>{String(receipt.transaction_details.token_code)}</Text>
            </View>
          ) : serialNumber && !voucherCode && !receiptVoucherCode && !activationCode ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Serial Number</Text>
              <Text style={styles.receiptValue}>{serialNumber}</Text>
            </View>
          ) : null}
          {typeof receipt.transaction_details.customer_name === 'string' &&
          receipt.transaction_details.customer_name ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Atas Nama</Text>
              <Text style={styles.receiptValue}>{receipt.transaction_details.customer_name}</Text>
            </View>
          ) : null}
          {typeof receipt.transaction_details.segment_power === 'string' &&
          receipt.transaction_details.segment_power ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Tarif / Daya</Text>
              <Text style={styles.receiptValue}>{receipt.transaction_details.segment_power}</Text>
            </View>
          ) : null}
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Metode Pembayaran</Text>
            <Text style={styles.receiptValue}>{receipt.transaction_details.payment_method}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Tanggal</Text>
            <Text style={styles.receiptValue}>
              {new Date(receipt.transaction_details.date).toLocaleString('id-ID')}
            </Text>
          </View>
        </Card>
      )}

      {terminal && String(transaction.status).toLowerCase() === 'success' && receipt ? (
        <ReceiptSharePrintBar
          receipt={receipt}
          userName={userName}
          onOpenStruk={() =>
            router.push({
              pathname: '/riwayat/struk/[id]',
              params: { id: String(transaction.id) },
            })
          }
        />
      ) : null}

      {terminal && <Button label="Mulai Pembelian Baru" onPress={handleNewPurchase} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusCard: { alignItems: 'center', gap: spacing.xs },
  serviceName: { fontSize: typography.size.lg, fontWeight: typography.weight.black, color: colors.gray[900], marginTop: spacing.sm },
  targetNo: { fontSize: typography.size.sm, color: colors.gray[500] },
  total: { fontSize: typography.size['2xl'], fontWeight: typography.weight.black, color: colors.primary[700], marginTop: spacing.xs },
  invoice: { fontSize: typography.size.xs, color: colors.gray[400] },
  processingWrap: { alignItems: 'center', gap: spacing.sm },
  processingHint: { fontSize: typography.size.xs, color: colors.gray[500], textAlign: 'center' },
  receiptLoading: { fontSize: typography.size.sm, color: colors.gray[500], textAlign: 'center' },
  voucherCard: { gap: spacing.sm, alignItems: 'stretch' },
  voucherTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  voucherCode: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    letterSpacing: 1,
  },
  voucherHint: { fontSize: typography.size.xs, color: colors.gray[500] },
  copyMsg: { fontSize: typography.size.xs, color: colors.status.success, fontWeight: typography.weight.medium },
  receiptCard: { gap: spacing.sm },
  receiptTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  receiptValue: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.gray[900], flexShrink: 1, textAlign: 'right' },
});
