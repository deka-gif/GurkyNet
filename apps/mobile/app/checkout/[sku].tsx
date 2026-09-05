import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import { useCheckoutStore } from '../../src/store/checkout.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { ScreenContainer, Card, Button, LoadingState, ErrorState } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ sku: string }>();
  const sku = typeof params.sku === 'string' ? params.sku : '';
  const router = useRouter();

  const { productDetail, productDetailLoading, productDetailError, fetchProductDetail, clearProductDetail } =
    useCatalogStore();
  const overview = useWalletStore((s) => s.overview);
  const skuCode = useCheckoutStore((s) => s.skuCode);
  const targetNumber = useCheckoutStore((s) => s.targetNumber);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const startCheckout = useCheckoutStore((s) => s.startCheckout);

  // Always re-fetch fresh from the backend here — never trust price/availability
  // carried over from whatever the user saw on Product Detail earlier.
  useEffect(() => {
    if (sku) fetchProductDetail(sku);
    return () => clearProductDetail();
  }, [sku, fetchProductDetail, clearProductDetail]);

  // Resilience for a fresh navigation or a full reload during dev: (re)start the
  // checkout attempt once the product is known. startCheckout() itself refuses to
  // rotate the idempotency key when it already belongs to this same sku, so this is
  // safe to run again on every remount/re-render.
  useEffect(() => {
    if (productDetail && productDetail.code === sku && skuCode !== sku) {
      startCheckout(productDetail);
    }
  }, [productDetail, sku, skuCode, startCheckout]);

  const goToPin = () => {
    router.push({ pathname: '/checkout/pin', params: { sku } });
  };

  const canContinue = targetNumber.trim().length > 0;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: 'Checkout', headerBackTitle: 'Kembali' }} />

      {productDetailLoading && !productDetail ? (
        <LoadingState label="Memuat produk..." />
      ) : productDetailError ? (
        <ErrorState message={productDetailError} onRetry={() => fetchProductDetail(sku)} />
      ) : !productDetail ? (
        <ErrorState message="Produk tidak ditemukan." />
      ) : (
        <>
          <Card>
            {productDetail.operatorName ? (
              <Text style={styles.operator}>{productDetail.operatorName}</Text>
            ) : null}
            <Text style={styles.name}>{productDetail.name}</Text>
            {(productDetail.quota || productDetail.validity) && (
              <Text style={styles.meta}>
                {[productDetail.quota, productDetail.validity].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Card>

          <View style={styles.field}>
            <Text style={styles.label}>Nomor Tujuan</Text>
            <TextInput
              value={targetNumber}
              onChangeText={setTarget}
              placeholder="Contoh: 081234567890"
              keyboardType="number-pad"
              placeholderTextColor={colors.gray[400]}
              style={styles.input}
            />
          </View>

          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ringkasan</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Harga</Text>
              <Text style={styles.summaryValue}>{formatIDR(productDetail.price)}</Text>
            </View>
            {productDetail.adminFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Biaya Admin</Text>
                <Text style={styles.summaryValue}>{formatIDR(productDetail.adminFee)}</Text>
              </View>
            )}
            <Text style={styles.summaryNote}>Total akhir akan dikonfirmasi oleh sistem saat pembayaran.</Text>
            {overview?.wallet.balance != null && (
              <View style={[styles.summaryRow, styles.balanceRow]}>
                <Text style={styles.balanceLabel}>Saldo GurkyPay</Text>
                <Text style={styles.balanceValue}>{formatIDR(overview.wallet.balance)}</Text>
              </View>
            )}
          </Card>

          <Button label="Lanjut Bayar (PIN)" onPress={goToPin} disabled={!canContinue} />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  operator: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  name: { fontSize: typography.size.lg, fontWeight: typography.weight.black, color: colors.gray[900], marginTop: spacing.xs },
  meta: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: spacing.xs },
  field: { gap: spacing.xs },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[700] },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  summaryCard: { gap: spacing.sm },
  summaryTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: typography.size.sm, color: colors.gray[600] },
  summaryValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  summaryNote: { fontSize: typography.size.xs, color: colors.gray[400] },
  balanceRow: { borderTopWidth: 1, borderTopColor: colors.gray[100], paddingTop: spacing.sm, marginTop: spacing.xs },
  balanceLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  balanceValue: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.gray[700] },
});
