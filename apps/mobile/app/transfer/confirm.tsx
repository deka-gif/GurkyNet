import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ScreenContainer, Button, PinConfirmModal } from '../../src/components/ui';
import { useTransferStore } from '../../src/store/transfer.store';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

/**
 * Confirmation after successful recipient lookup — does not POST transfer.
 * PIN opens as modal; digit-6 auto-submits POST /wallet/transfer.
 */
export default function TransferConfirmScreen() {
  const router = useRouter();
  const recipient = useTransferStore((s) => s.recipientWalletNumber);
  const recipientName = useTransferStore((s) => s.recipientName);
  const amount = useTransferStore((s) => s.amount);
  const adminFee = useTransferStore((s) => s.adminFee);
  const submitting = useTransferStore((s) => s.submitting);
  const submitError = useTransferStore((s) => s.submitError);
  const submitTransfer = useTransferStore((s) => s.submitTransfer);
  const clearSubmitError = useTransferStore((s) => s.clearSubmitError);

  const [pinOpen, setPinOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  if (!recipient || !recipientName || amount <= 0) {
    return (
      <ScreenContainer belowHeader>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <Text style={styles.empty}>
          Data transfer tidak lengkap. Validasi nomor tujuan terlebih dahulu.
        </Text>
        <Button label="Kembali" variant="secondary" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const total = amount + adminFee;

  const openPin = () => {
    setPageError(null);
    clearSubmitError();
    setPinOpen(true);
  };

  const onPinSubmit = async (pin: string) => {
    const result = await submitTransfer(pin);
    if (result.ok) {
      setPinOpen(false);
      router.replace('/transfer/result');
      return;
    }

    if (result.code === 'pin') {
      // Stay in modal with error — same idempotency key.
      return;
    }

    // Balance / validation / other: close modal, show on confirmation page.
    setPinOpen(false);
    setPageError(result.message || 'Transfer gagal diproses.');
  };

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />

      <Text style={styles.lead}>Transfer ke Sesama GurkyPay</Text>

      <View style={styles.card}>
        <View style={styles.nameBlock}>
          <Text style={styles.nameLabel}>Nama Tujuan</Text>
          <Text style={styles.nameValue}>{recipientName}</Text>
        </View>

        <Row label="No. Rekening GurkyPay" value={recipient} />
        <Row label="Nominal" value={formatIDR(amount)} />
        <Row label="Biaya Transfer" value={formatIDR(adminFee)} />
        <View style={styles.divider} />
        <Row label="Total" value={formatIDR(total)} emphasize />
      </View>

      {pageError ? <Text style={styles.pageError}>{pageError}</Text> : null}

      <Text style={styles.note}>
        Pastikan nama dan nomor tujuan sudah benar. Biaya transfer mengikuti ketentuan sistem.
      </Text>

      <View style={styles.cta}>
        <Button label="Lanjutkan" onPress={openPin} disabled={submitting} />
      </View>

      <PinConfirmModal
        visible={pinOpen}
        title="Masukkan PIN"
        subtitle="Masukkan 6 digit PIN kamu"
        loading={submitting}
        error={
          submitError
            ? submitError.toLowerCase().includes('pin')
              ? 'PIN salah\nSilakan coba lagi.'
              : submitError
            : null
        }
        dismissible={!submitting}
        onClose={() => {
          if (!submitting) {
            setPinOpen(false);
            clearSubmitError();
          }
        }}
        onEditing={() => clearSubmitError()}
        onSubmit={onPinSubmit}
        onForgotPin={() => {
          if (submitting) return;
          setPinOpen(false);
          clearSubmitError();
          router.push('/akun/pin/forgot');
        }}
      />
    </ScreenContainer>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowEmphasize]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.lg,
    gap: spacing.md,
  },
  nameBlock: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    marginBottom: spacing.xs,
  },
  nameLabel: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nameValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
  rowValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right',
  },
  rowEmphasize: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
  },
  note: {
    marginTop: spacing.md,
    fontSize: typography.size.xs,
    color: colors.gray[500],
    lineHeight: 18,
  },
  pageError: {
    marginTop: spacing.md,
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cta: {
    marginTop: spacing.xl,
  },
  empty: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    marginBottom: spacing.lg,
  },
});
