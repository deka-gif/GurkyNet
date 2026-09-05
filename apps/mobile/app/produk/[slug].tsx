import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
  BrandLogo,
  PurchaseFlowNotice,
} from '../../src/components/ui';
import { PulsaCatalogFlow } from '../../src/components/catalog/PulsaCatalogFlow';
import { PaketDataCatalogFlow } from '../../src/components/catalog/PaketDataCatalogFlow';
import { PlnTokenCatalogFlow } from '../../src/components/catalog/PlnTokenCatalogFlow';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import {
  INQUIRY_FLOW_NOTICE,
  isInquiryRequiredCategory,
  isPlnPrepaidCategory,
  normalizeCategorySlug,
} from '../../src/utils/purchaseCategory';

export default function ProductListScreen() {
  const params = useLocalSearchParams<{ slug: string; name?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const categoryName = typeof params.name === 'string' ? params.name : 'Produk';
  const router = useRouter();
  const { products, productsLoading, productsError, fetchProducts } = useCatalogStore();
  const flags = useFeaturesStore((s) => s.flags);
  const flagsLoading = useFeaturesStore((s) => s.loading);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);
  const [keyword, setKeyword] = useState('');

  const inquiryBlocked = isInquiryRequiredCategory(slug);
  const normalized = normalizeCategorySlug(slug);
  const isPulsaFlow = normalized === 'pulsa';
  const isPaketDataFlow = normalized === 'data' || normalized === 'paket-data';
  const isPlnFlow = isPlnPrepaidCategory(slug);

  const load = useCallback(() => {
    if (slug && !inquiryBlocked && !isPulsaFlow && !isPaketDataFlow && !isPlnFlow) {
      fetchProducts(slug, keyword.trim() || undefined);
    }
  }, [slug, keyword, fetchProducts, inquiryBlocked, isPulsaFlow, isPaketDataFlow, isPlnFlow]);

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  useEffect(() => {
    if (slug && !inquiryBlocked && !isPulsaFlow && !isPaketDataFlow && !isPlnFlow) fetchProducts(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, inquiryBlocked, isPulsaFlow, isPaketDataFlow, isPlnFlow]);

  const purchaseBanner =
    !purchaseEnabled && !flagsLoading ? `Pembelian belum aktif — ${flags.messages.purchase}` : null;

  return (
    <ScreenContainer
      onRefresh={
        inquiryBlocked || isPulsaFlow || isPaketDataFlow || isPlnFlow ? fetchFeatures : load
      }
      refreshing={productsLoading || flagsLoading}
    >
      <Stack.Screen options={{ headerShown: true, title: categoryName, headerBackTitle: 'Kembali' }} />

      {inquiryBlocked ? (
        <PurchaseFlowNotice
          icon="shield-checkmark-outline"
          title={`${categoryName} — Validasi Diperlukan`}
          message={INQUIRY_FLOW_NOTICE}
        />
      ) : isPulsaFlow ? (
        <PulsaCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isPaketDataFlow ? (
        <PaketDataCatalogFlow purchaseBanner={purchaseBanner} />
      ) : isPlnFlow ? (
        <PlnTokenCatalogFlow purchaseBanner={purchaseBanner} />
      ) : (
        <>
          {purchaseBanner ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{purchaseBanner}</Text>
            </View>
          ) : null}
          <TextInput
            placeholder="Cari produk..."
            placeholderTextColor={colors.gray[400]}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={load}
            returnKeyType="search"
            style={styles.searchInput}
          />

          {productsLoading && products.length === 0 ? (
            <LoadingState label="Memuat produk..." />
          ) : productsError ? (
            <ErrorState message={productsError} onRetry={load} />
          ) : products.length === 0 ? (
            <EmptyState
              title="Belum Ada Produk"
              message="Produk untuk kategori ini belum tersedia saat ini."
            />
          ) : (
            <View style={styles.list}>
              {products.map((product) => {
                const unavailable = product.status !== 'tersedia';
                const brandName = product.operatorName || product.providerDetails?.name || '';
                return (
                  <TouchableOpacity
                    key={product.id}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({ pathname: '/produk/detail/[sku]', params: { sku: product.code } })
                    }
                  >
                    <Card style={styles.productCard}>
                      <View style={styles.productRow}>
                        <BrandLogo
                          name={brandName || 'Brand'}
                          logo={product.providerDetails?.logo}
                          size={40}
                          style={styles.brandLogo}
                        />
                        <View style={styles.productInfo}>
                          {brandName ? (
                            <Text style={styles.productOperator} numberOfLines={1}>
                              {brandName}
                            </Text>
                          ) : null}
                          <Text style={styles.productName} numberOfLines={2}>
                            {product.name}
                          </Text>
                          {(product.quota || product.validity) && (
                            <Text style={styles.productMeta} numberOfLines={1}>
                              {[product.quota, product.validity].filter(Boolean).join(' · ')}
                            </Text>
                          )}
                        </View>
                        <View style={styles.productPriceWrap}>
                          <Text style={styles.productPrice}>{formatIDR(product.price)}</Text>
                          {unavailable && (
                            <View
                              style={[
                                styles.statusBadge,
                                product.status === 'maintenance'
                                  ? styles.statusMaintenance
                                  : styles.statusGangguan,
                              ]}
                            >
                              <Text style={styles.statusText}>
                                {product.status === 'maintenance' ? 'Maintenance' : 'Gangguan'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  bannerText: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  list: { gap: spacing.sm },
  productCard: { padding: spacing.md },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { marginRight: spacing.md },
  productInfo: { flex: 1, marginRight: spacing.sm, gap: 2 },
  productName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.gray[900] },
  productMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  productOperator: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.medium,
    textTransform: 'uppercase',
  },
  productPriceWrap: { alignItems: 'flex-end', gap: spacing.xs },
  productPrice: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusMaintenance: { backgroundColor: colors.status.pendingBg },
  statusGangguan: { backgroundColor: colors.status.failedBg },
  statusText: { fontSize: 10, fontWeight: typography.weight.bold, color: colors.gray[700] },
});
