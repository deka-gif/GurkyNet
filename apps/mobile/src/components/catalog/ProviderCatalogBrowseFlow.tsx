import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import {
  catalogService,
  CategoryProviderSummary,
  Product,
} from '../../services/catalog.service';
import {
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
  BrandLogo,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed } from '../../utils/catalogAvailability';

/**
 * Provider → product browse (Tahap 3B).
 * UI: category name lives in Stack header only — no duplicate in-content title.
 * Header/hardware back on product step returns to provider list (same route), not Home.
 */

type Props = {
  /** Canonical API category (topup-digital | game | langganan-digital). */
  category: string;
  purchaseBanner?: string | null;
  providerSearchPlaceholder?: string;
};

type Step = 'providers' | 'products';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

export function ProviderCatalogBrowseFlow({
  category,
  purchaseBanner,
  providerSearchPlaceholder = 'Cari provider...',
}: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('providers');
  const [providers, setProviders] = useState<CategoryProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [selected, setSelected] = useState<CategoryProviderSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const res = await catalogService.getCategoryProviders(category);
      if (res.success && Array.isArray(res.data)) {
        setProviders(res.data);
      } else {
        setProviders([]);
        setProvidersError(res.message || 'Gagal memuat daftar provider.');
      }
    } catch (err: any) {
      setProviders([]);
      setProvidersError(err?.message || 'Gagal memuat daftar provider.');
    } finally {
      setProvidersLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const goBackToProviders = useCallback(() => {
    setStep('providers');
    setSelected(null);
    setProducts([]);
    setProductsError(null);
  }, []);

  // ← Category header / Android back: products → providers; providers → previous stack (Home).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step !== 'products') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackToProviders();
    });
    return unsub;
  }, [navigation, step, goBackToProviders]);

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => String(p.name ?? '').toLowerCase().includes(q));
  }, [providers, providerQuery]);

  const listedProducts = useMemo(() => {
    return products
      .filter((p) => isCatalogListed(p))
      .slice()
      .sort((a, b) => a.price - b.price);
  }, [products]);

  const selectProvider = async (provider: CategoryProviderSummary) => {
    setSelected(provider);
    setStep('products');
    setProducts([]);
    setProductsError(null);
    setProductsLoading(true);
    try {
      const res = await catalogService.getProducts({
        category,
        provider_id: provider.providerId,
        per_page: 5000,
      });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
        setProductsError(res.message || 'Gagal memuat produk.');
      }
    } catch (err: any) {
      setProducts([]);
      setProductsError(err?.message || 'Gagal memuat produk.');
    } finally {
      setProductsLoading(false);
    }
  };

  const openProduct = (product: Product) => {
    router.push({ pathname: '/produk/detail/[sku]', params: { sku: product.code } });
  };

  if (step === 'providers') {
    return (
      <View style={styles.wrap}>
        <TextInput
          placeholder={providerSearchPlaceholder}
          placeholderTextColor={colors.gray[400]}
          value={providerQuery}
          onChangeText={setProviderQuery}
          style={styles.searchInput}
        />
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}
        {providersLoading && providers.length === 0 ? (
          <LoadingState label="Memuat provider..." />
        ) : providersError && providers.length === 0 ? (
          <ErrorState message={providersError} onRetry={loadProviders} />
        ) : filteredProviders.length === 0 ? (
          <EmptyState title="Belum Ada Provider" message="Provider untuk kategori ini belum tersedia." />
        ) : (
          <View style={styles.list}>
            {filteredProviders.map((p) => (
              <TouchableOpacity
                key={p.providerId}
                activeOpacity={0.7}
                onPress={() => void selectProvider(p)}
              >
                <Card style={styles.rowCard}>
                  <View style={styles.row}>
                    <BrandLogo name={p.name} logo={p.logo} size={44} style={styles.logo} />
                    <View style={styles.rowText}>
                      <Text style={styles.providerName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.providerMeta}>{p.count} produk</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}
      <Text style={styles.providerHeading}>{selected?.name || 'Produk'}</Text>

      {productsLoading ? (
        <LoadingState label="Memuat produk..." />
      ) : productsError ? (
        <ErrorState
          message={productsError}
          onRetry={() => selected && void selectProvider(selected)}
        />
      ) : listedProducts.length === 0 ? (
        <EmptyState title="Belum Ada Produk" message="Produk untuk provider ini belum tersedia." />
      ) : (
        <View style={styles.productGrid}>
          {listedProducts.map((product) => {
            const unavailable = product.status !== 'tersedia';
            return (
              <TouchableOpacity
                key={product.id}
                style={styles.productTile}
                activeOpacity={0.7}
                onPress={() => openProduct(product)}
              >
                <Card style={styles.productCard}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>{formatIDR(product.price)}</Text>
                  {unavailable ? (
                    <Text style={styles.productStatus}>
                      {product.status === 'maintenance' ? 'Maintenance' : 'Gangguan'}
                    </Text>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  banner: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  rowCard: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  logo: { marginRight: spacing.md },
  rowText: { flex: 1, gap: 2 },
  providerName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  providerMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  providerHeading: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  productTile: { width: '48%' },
  productCard: { padding: spacing.md, minHeight: 88, justifyContent: 'space-between', gap: spacing.xs },
  productName: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    fontWeight: typography.weight.medium,
  },
  productPrice: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  productStatus: {
    fontSize: 10,
    color: colors.gray[500],
    fontWeight: typography.weight.bold,
  },
});
