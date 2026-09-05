import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { isPlnContextValid, useCheckoutStore } from '../../src/store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import { transactionService } from '../../src/services/transaction.service';
import { parseApiError } from '../../src/api/client';
import { ScreenContainer, PinInput, PurchaseFlowNotice } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import {
  INQUIRY_FLOW_NOTICE,
  isDirectPurchaseCategory,
  isInquiryRequiredCategory,
  isPlnPrepaidCategory,
} from '../../src/utils/purchaseCategory';

export default function CheckoutPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sku: string }>();
  const sku = typeof params.sku === 'string' ? params.sku : '';

  const skuCode = useCheckoutStore((s) => s.skuCode);
  const categorySlug = useCheckoutStore((s) => s.categorySlug);
  const targetNumber = useCheckoutStore((s) => s.targetNumber);
  const plnContext = useCheckoutStore((s) => s.plnContext);
  const clearPlnContext = useCheckoutStore((s) => s.clearPlnContext);
  const idempotencyKey = useCheckoutStore((s) => s.idempotencyKey);
  const submitting = useCheckoutStore((s) => s.submitting);
  const setSubmitting = useCheckoutStore((s) => s.setSubmitting);
  const setTransaction = useCheckoutStore((s) => s.setTransaction);
  const setStatus = useCheckoutStore((s) => s.setStatus);
  const flags = useFeaturesStore((s) => s.flags);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const inquiryBlocked = isInquiryRequiredCategory(categorySlug);
  const plnPrepaid = isPlnPrepaidCategory(categorySlug);
  const plnValid = isPlnContextValid(plnContext, targetNumber);
  const categoryBlocked =
    inquiryBlocked ||
    (!!categorySlug && !isDirectPurchaseCategory(categorySlug) && !plnPrepaid) ||
    (plnPrepaid && !plnValid);

  const handleSubmit = async (enteredPin: string) => {
    if (submitting) return;
    if (!purchaseEnabled) {
      setPinError(flags.messages.purchase);
      return;
    }
    if (plnPrepaid && !isPlnContextValid(plnContext, targetNumber)) {
      clearPlnContext();
      setPinError('Sesi cek meteran tidak valid atau kedaluwarsa. Silakan cek meteran ulang.');
      return;
    }
    if (categoryBlocked) {
      setPinError(
        inquiryBlocked
          ? INQUIRY_FLOW_NOTICE
          : plnPrepaid
            ? 'Silakan cek meteran PLN terlebih dahulu.'
            : 'Kategori ini belum didukung di checkout mobile.'
      );
      return;
    }
    if (!skuCode || !idempotencyKey) {
      setPinError('Sesi checkout tidak valid. Silakan mulai ulang dari detail produk.');
      return;
    }

    setSubmitting(true);
    setPinError(null);

    try {
      // PLN: no inquiry_ref_id — backend resolves session by user + target_number (customer_no).
      const response = await transactionService.create({
        sku_code: skuCode,
        target_number: targetNumber,
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });

      setPin('');

      if (response.success && response.data) {
        setTransaction(response.data);
        setStatus(response.data.status);
        setSubmitting(false);
        router.replace({ pathname: '/checkout/result', params: { sku } });
        return;
      }

      setSubmitting(false);
      setPinError(response.message || 'Transaksi gagal diproses.');
    } catch (err: any) {
      setPin('');
      setSubmitting(false);
      const parsed = parseApiError(err);
      setPinError(parsed.message || 'Gagal memproses transaksi. Silakan coba lagi.');
      if (typeof parsed.message === 'string' && parsed.message.toLowerCase().includes('pin transaksi salah')) {
        useCheckoutStore.getState().rotateIdempotencyKey();
      }
      // Expired / missing PLN session — clear local mirror so user re-inquires.
      if (
        typeof parsed.message === 'string' &&
        (parsed.message.toLowerCase().includes('cek meteran') ||
          parsed.message.toLowerCase().includes('kedaluwarsa') ||
          parsed.message.toLowerCase().includes('inquiry'))
      ) {
        clearPlnContext();
      }
    }
  };

  if (!purchaseEnabled) {
    return (
      <ScreenContainer scroll={false}>
        <Stack.Screen options={{ headerShown: true, title: 'Masukkan PIN', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={flags.messages.purchase}
        />
      </ScreenContainer>
    );
  }

  if (categoryBlocked) {
    return (
      <ScreenContainer scroll={false}>
        <Stack.Screen options={{ headerShown: true, title: 'Masukkan PIN', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="shield-checkmark-outline"
          title={plnPrepaid ? 'Cek Meteran Diperlukan' : 'Validasi Diperlukan'}
          message={
            inquiryBlocked
              ? INQUIRY_FLOW_NOTICE
              : plnPrepaid
                ? 'Sesi cek meteran tidak valid atau kedaluwarsa. Kembali ke menu PLN dan cek meteran ulang.'
                : 'Kategori ini belum didukung di checkout mobile.'
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Masukkan PIN', headerBackTitle: 'Kembali' }} />
      <View style={styles.center}>
        <Text style={styles.title}>Masukkan PIN Transaksi</Text>
        <Text style={styles.subtitle}>PIN 6 digit untuk mengonfirmasi pembelian.</Text>

        <View style={styles.pinWrap}>
          <PinInput
            value={pin}
            onChange={(value) => {
              setPin(value);
              if (pinError) setPinError(null);
            }}
            onComplete={handleSubmit}
            disabled={submitting}
            autoFocus
          />
        </View>

        {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
        {submitting ? <Text style={styles.hint}>Memproses...</Text> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing['2xl'] },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.gray[900] },
  subtitle: { fontSize: typography.size.sm, color: colors.gray[500], textAlign: 'center' },
  pinWrap: { marginTop: spacing.lg },
  error: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  hint: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: spacing.md },
});
