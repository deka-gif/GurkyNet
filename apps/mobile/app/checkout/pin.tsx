import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { isPlnContextValid, useCheckoutStore } from '../../src/store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import { transactionService } from '../../src/services/transaction.service';
import { parseApiError } from '../../src/api/client';
import { ScreenContainer, PinConfirmModal, PurchaseFlowNotice } from '../../src/components/ui';
import { colors } from '../../src/theme';
import {
  INQUIRY_FLOW_NOTICE,
  isDirectPurchaseCategory,
  isInquiryRequiredCategory,
  isPlnPrepaidCategory,
} from '../../src/utils/purchaseCategory';

/**
 * Legacy route /checkout/pin — kept for deep links / back-stack.
 * UI is PinConfirmModal (same component as confirmation modal on /checkout/[sku]).
 */
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

  const [pinError, setPinError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const inquiryBlocked = isInquiryRequiredCategory(categorySlug);
  const plnPrepaid = isPlnPrepaidCategory(categorySlug);
  const plnValid = isPlnContextValid(plnContext, targetNumber);
  const categoryBlocked =
    inquiryBlocked ||
    (!!categorySlug && !isDirectPurchaseCategory(categorySlug) && !plnPrepaid) ||
    (plnPrepaid && !plnValid);

  const handleSubmit = async (enteredPin: string) => {
    if (lockRef.current || submitting) return;
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

    lockRef.current = true;
    setSubmitting(true);
    setPinError(null);

    try {
      const response = await transactionService.create({
        sku_code: skuCode,
        target_number: targetNumber,
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });

      if (response.success && response.data) {
        setTransaction(response.data);
        setStatus(response.data.status);
        setSubmitting(false);
        router.replace({ pathname: '/checkout/result', params: { sku } });
        return;
      }

      setSubmitting(false);
      setPinError(response.message || 'Transaksi gagal diproses.');
    } catch (err: unknown) {
      setSubmitting(false);
      const parsed = parseApiError(err);
      setPinError(parsed.message || 'Gagal memproses transaksi. Silakan coba lagi.');
      if (
        typeof parsed.message === 'string' &&
        parsed.message.toLowerCase().includes('pin transaksi salah')
      ) {
        useCheckoutStore.getState().rotateIdempotencyKey();
      }
      if (
        typeof parsed.message === 'string' &&
        (parsed.message.toLowerCase().includes('cek meteran') ||
          parsed.message.toLowerCase().includes('kedaluwarsa') ||
          parsed.message.toLowerCase().includes('inquiry'))
      ) {
        clearPlnContext();
      }
    } finally {
      lockRef.current = false;
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
    <ScreenContainer scroll={false} padded={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Masukkan PIN', headerBackTitle: 'Kembali' }} />
      <View style={styles.fill}>
        <PinConfirmModal
          visible
          title="Masukkan PIN"
          subtitle="PIN 6 digit untuk mengonfirmasi pembelian."
          loading={submitting}
          error={
            pinError
              ? pinError.toLowerCase().includes('pin')
                ? 'PIN salah\nSilakan coba lagi.'
                : pinError
              : null
          }
          dismissible={!submitting}
          onClose={() => {
            if (!submitting) router.back();
          }}
          onEditing={() => setPinError(null)}
          onSubmit={handleSubmit}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.gray[50] },
});
