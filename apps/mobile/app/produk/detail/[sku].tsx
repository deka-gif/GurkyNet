import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../../src/store/catalog.store';
import { useCheckoutStore } from '../../../src/store/checkout.store';
import { ScreenContainer, Card, Button, LoadingState, ErrorState, BrandLogo } from '../../../src/components/ui';
import { colors, radius, spacing, typography } from '../../../src/theme';
import { formatIDR } from '../../../src/utils/currency';

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ sku: string }>();
  const sku = typeof params.sku === 'string' ? params.sku : '';
  const { productDetail, productDetailLoading, productDetailError, fetchProductDetail, clearProductDetail } =
    useCatalogStore();
  const router = useRouter();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);

  useEffect(() => {
    if (sku) fetchProductDetail(sku);
    return () => clearProductDetail();
  }, [sku, fetchProductDetail, clearProductDetail]);

  const unavailable = productDetail && productDetail.status !== 'tersedia';
  const brandName = productDetail?.operatorName || productDetail?.providerDetails?.name || '';

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: 'Detail Produk', headerBackTitle: 'Kembali' }} />

      {productDetailLoading ? (
        <LoadingState label="Memuat detail produk..." />
      ) : productDetailError ? (
        <ErrorState message={productDetailError} onRetry={() => sku && fetchProductDetail(sku)} />
      ) : !productDetail ? (
        <ErrorState message="Produk tidak ditemukan." />
      ) : (
        <>
          <Card>
            <View style={styles.brandRow}>
              <BrandLogo
                name={brandName || 'Brand'}
                logo={productDetail.providerDetails?.logo}
                size={56}
              />
              <View style={styles.brandText}>
                {brandName ? <Text style={styles.operator}>{brandName}</Text> : null}
                <Text style={styles.name}>{productDetail.name}</Text>
              </View>
            </View>

            <Text style={styles.price}>{formatIDR(productDetail.price)}</Text>

            {(productDetail.quota || productDetail.validity) && (
              <View style={styles.metaRow}>
                {productDetail.quota ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Kuota</Text>
                    <Text style={styles.metaValue}>{productDetail.quota}</Text>
                  </View>
                ) : null}
                {productDetail.validity ? (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Masa Aktif</Text>
                    <Text style={styles.metaValue}>{productDetail.validity}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {productDetail.description ? (
              <Text style={styles.description}>{productDetail.description}</Text>
            ) : null}

            {unavailable && (
              <View
                style={[
                  styles.statusBadge,
                  productDetail.status === 'maintenance' ? styles.statusMaintenance : styles.statusGangguan,
                ]}
              >
                <Text style={styles.statusText}>
                  {productDetail.status === 'maintenance' ? 'Sedang Maintenance' : 'Sedang Gangguan'}
                </Text>
              </View>
            )}
          </Card>

          <Button
            label="Beli Sekarang"
            onPress={() => {
              startCheckout(productDetail);
              router.push({ pathname: '/checkout/[sku]', params: { sku: productDetail.code } });
            }}
            disabled={!!unavailable}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandText: { flex: 1, gap: 2 },
  operator: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  price: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.primary[700],
    marginTop: spacing.md,
  },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  metaItem: { gap: 2 },
  metaLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  metaValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  description: { fontSize: typography.size.sm, color: colors.gray[600], marginTop: spacing.md, lineHeight: 20 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  statusMaintenance: { backgroundColor: colors.status.pendingBg },
  statusGangguan: { backgroundColor: colors.status.failedBg },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.gray[700] },
});
