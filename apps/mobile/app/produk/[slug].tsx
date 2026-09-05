import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import { ScreenContainer, Card, LoadingState, ErrorState, EmptyState, BrandLogo } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';

export default function ProductListScreen() {
  const params = useLocalSearchParams<{ slug: string; name?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const categoryName = typeof params.name === 'string' ? params.name : 'Produk';
  const router = useRouter();
  const { products, productsLoading, productsError, fetchProducts } = useCatalogStore();
  const [keyword, setKeyword] = useState('');

  const load = useCallback(() => {
    if (slug) fetchProducts(slug, keyword.trim() || undefined);
  }, [slug, keyword, fetchProducts]);

  useEffect(() => {
    if (slug) fetchProducts(slug);
    // Only re-fetch automatically when the category changes — keyword search is
    // submitted explicitly (onSubmitEditing), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <ScreenContainer onRefresh={load} refreshing={productsLoading}>
      <Stack.Screen options={{ headerShown: true, title: categoryName, headerBackTitle: 'Kembali' }} />

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
                            product.status === 'maintenance' ? styles.statusMaintenance : styles.statusGangguan,
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
