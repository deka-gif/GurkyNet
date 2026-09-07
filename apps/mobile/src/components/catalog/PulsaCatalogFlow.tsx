import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  PurchaseFlowNotice,
} from '../ui';
import { PhoneOperatorInput } from './PhoneOperatorInput';
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { colors, radius, spacing, typography } from '../../theme';
import { detectOperatorFromPhone } from '../../utils/detectOperator';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, sanitizePhoneDigits } from '../../utils/targetValidation';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';

/**
 * Mobile Pulsa pre-checkout — mirrors Web PulsaPage:
 * phone → prefix operator detect → GET /products?category=pulsa → client filter by brand
 * → checkout (existing Mobile transaction pipeline).
 */

type Props = {
  purchaseBanner?: string | null;
};

export function PulsaCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const [phoneNo, setPhoneNo] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operator = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);
  const phoneReady = isValidPhoneTarget(phoneNo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category: 'pulsa', per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk pulsa.');
        setAllProducts([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat produk pulsa.');
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const listed = useMemo(() => {
    if (!operator) return [];
    return sortProductsByPriceAsc(
      allProducts.filter(
        (p) => isCatalogListed(p) && operatorsMatch(p.operatorName || p.providerDetails?.name, operator)
      )
    );
  }, [allProducts, operator]);

  const onSelect = (product: Product) => {
    if (!purchaseEnabled || !phoneReady || !operator) return;
    if (!isProductPurchasable(product)) return;
    startCheckout(product);
    setTarget(sanitizePhoneDigits(phoneNo));
    setPurchaseContext({ operatorLabel: operator, selectedRegion: null });
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  return (
    <View style={styles.wrap}>
      <PhoneOperatorInput value={phoneNo} onChangeText={setPhoneNo} operator={operator} />

      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      {!operator ? (
        <EmptyState
          title="Masukkan Nomor HP"
          message="Produk pulsa akan muncul setelah operator terdeteksi."
        />
      ) : loading && listed.length === 0 ? (
        <LoadingState label="Memuat nominal pulsa..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : listed.length === 0 ? (
        <EmptyState title="Belum Ada Nominal" message="Produk pulsa untuk operator ini belum tersedia." />
      ) : !purchaseEnabled ? (
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
        />
      ) : (
        <View style={styles.list}>
          {!phoneReady ? (
            <Text style={styles.hintWarn}>Lengkapi nomor HP (minimal 10 digit) sebelum memilih nominal.</Text>
          ) : null}
          <ProductCatalogGrid
            products={listed}
            columns={2}
            onPress={onSelect}
            isDisabled={(p) => !isProductPurchasable(p) || !phoneReady || !purchaseEnabled}
            renderMeta={(p) =>
              !isProductPurchasable(p) ? <Text style={styles.meta}>Tidak tersedia</Text> : null
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
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
  hintWarn: { fontSize: typography.size.xs, color: colors.status.pending },
  list: { gap: spacing.sm },
  meta: { fontSize: 10, color: colors.gray[500] },
});
