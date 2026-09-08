import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import {
  catalogService,
  CategoryProviderSummary,
  Product,
} from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import {
  Button,
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
  BrandLogo,
  PurchaseFlowNotice,
} from '../ui';
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { colors, radius, spacing, typography } from '../../theme';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isGasPrepaidCategory } from '../../utils/purchaseCategory';

/**
 * Provider → product browse (Tahap 3B).
 * UI: category name lives in Stack header only — no duplicate in-content title.
 * Header/hardware back on product step returns to provider list (same route), not Home.
 *
 * Gas Prepaid (FR catalog gas-prepaid / PREPAID_DIRECT + CUSTOMER_NO):
 * providers → ID pelanggan (above) + products → shared checkout (skip Detail Produk).
 * Other provider-browse categories still open generic /produk/detail/[sku].
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
  const gasPrepaid = isGasPrepaidCategory(category);
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const [step, setStep] = useState<Step>('providers');
  const [providers, setProviders] = useState<CategoryProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [selected, setSelected] = useState<CategoryProviderSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerNo, setCustomerNo] = useState('');

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
    setSelectedProduct(null);
    setCustomerNo('');
  }, []);

  // ← Header / Android back: products → providers; providers → previous stack.
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
    return products.filter((p) => isCatalogListed(p));
  }, [products]);

  const productColumns = category === 'game' ? 5 : 2;

  // Existing Gas Prepaid validation (Web targetMode=phone digits; capability CUSTOMER_NO).
  const gasTarget = customerNo.replace(/\D/g, '').trim();
  const customerReady = gasTarget.length > 0;
  const canProceedGas =
    gasPrepaid &&
    !!selectedProduct &&
    customerReady &&
    isProductPurchasable(selectedProduct) &&
    purchaseEnabled;

  const selectProvider = async (provider: CategoryProviderSummary) => {
    setSelected(provider);
    setStep('products');
    setProducts([]);
    setProductsError(null);
    setSelectedProduct(null);
    setCustomerNo('');
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

  const proceedGasCheckout = (product: Product) => {
    if (!gasPrepaid || !selected) return;
    if (!isProductPurchasable(product) || !purchaseEnabled) return;
    const target = customerNo.replace(/\D/g, '').trim();
    if (!target) return;

    startCheckout(product);
    setTarget(target);
    setPurchaseContext({
      operatorLabel: selected.name,
      selectedRegion: null,
    });
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  const openProduct = (product: Product) => {
    if (gasPrepaid) {
      if (!isProductPurchasable(product) || !purchaseEnabled) return;
      // Keep identifier when switching products (ID-first UX).
      setSelectedProduct(product);
      const target = customerNo.replace(/\D/g, '').trim();
      if (target) {
        proceedGasCheckout(product);
      }
      return;
    }
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

      {gasPrepaid ? (
        !purchaseEnabled ? (
          <PurchaseFlowNotice
            icon="time-outline"
            title="Pembelian Belum Aktif"
            message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
          />
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>ID Pelanggan / Nomor</Text>
            <TextInput
              value={customerNo}
              onChangeText={(t) => setCustomerNo(t.replace(/\D/g, ''))}
              placeholder="Masukkan ID pelanggan / nomor"
              placeholderTextColor={colors.gray[400]}
              keyboardType="number-pad"
              style={styles.searchInput}
            />
          </View>
        )
      ) : null}

      {gasPrepaid && purchaseEnabled ? (
        <Text style={styles.sectionHeading}>Pilih Produk</Text>
      ) : null}

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
        <ProductCatalogGrid
          products={listedProducts}
          columns={productColumns}
          onPress={openProduct}
          selectedCode={gasPrepaid ? selectedProduct?.code ?? null : null}
          isDisabled={(p) =>
            gasPrepaid
              ? !isProductPurchasable(p) || !purchaseEnabled
              : p.status !== 'tersedia'
          }
          renderMeta={(p) =>
            p.status !== 'tersedia' ? (
              <Text style={styles.productStatus}>
                {p.status === 'maintenance' ? 'Maintenance' : 'Gangguan'}
              </Text>
            ) : null
          }
        />
      )}

      {gasPrepaid && purchaseEnabled && selectedProduct ? (
        <Button
          label="Lanjut"
          onPress={() => selectedProduct && proceedGasCheckout(selectedProduct)}
          disabled={!canProceedGas}
        />
      ) : null}
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
  sectionHeading: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  productStatus: {
    fontSize: 10,
    color: colors.gray[500],
    fontWeight: typography.weight.bold,
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
});
