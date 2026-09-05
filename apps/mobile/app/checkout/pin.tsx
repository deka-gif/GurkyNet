import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCheckoutStore } from '../../src/store/checkout.store';
import { transactionService } from '../../src/services/transaction.service';
import { parseApiError } from '../../src/api/client';
import { ScreenContainer, PinInput } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

export default function CheckoutPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sku: string }>();
  const sku = typeof params.sku === 'string' ? params.sku : '';

  const skuCode = useCheckoutStore((s) => s.skuCode);
  const targetNumber = useCheckoutStore((s) => s.targetNumber);
  const idempotencyKey = useCheckoutStore((s) => s.idempotencyKey);
  const submitting = useCheckoutStore((s) => s.submitting);
  const setSubmitting = useCheckoutStore((s) => s.setSubmitting);
  const setTransaction = useCheckoutStore((s) => s.setTransaction);
  const setStatus = useCheckoutStore((s) => s.setStatus);

  // The PIN lives ONLY here, as local component state — never in the checkout store,
  // never persisted, never logged. Cleared immediately once the request settles,
  // whichever way it goes.
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleSubmit = async (enteredPin: string) => {
    if (submitting) return;
    if (!skuCode || !idempotencyKey) {
      setPinError('Sesi checkout tidak valid. Silakan mulai ulang dari detail produk.');
      return;
    }

    setSubmitting(true);
    setPinError(null);

    try {
      const response = await transactionService.create({
        sku_code: skuCode,
        target_number: targetNumber,
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });

      // PIN is never needed again past this point, success or not.
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
      // Deliberately no key rotation here — the same idempotency_key stays valid for
      // an explicit retry (re-entering the PIN below fires the same request again).
    } catch (err: any) {
      setPin('');
      setSubmitting(false);
      const parsed = parseApiError(err);
      setPinError(parsed.message || 'Gagal memproses transaksi. Silakan coba lagi.');
      // Same non-rotation guarantee applies to network timeouts / 5xx / 409 here —
      // this catch path never touches idempotencyKey.
      // If the error is a confirmed wrong PIN (backend validation), rotate the key
      // so the user can retry with a fresh idempotency key.
      if (typeof parsed.message === 'string' && parsed.message.toLowerCase().includes('pin transaksi salah')) {
        // rotateIdempotencyKey is defined in the checkout store
        const rotate = useCheckoutStore.getState().rotateIdempotencyKey;
        rotate();
      }
    }
  };

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
};

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
