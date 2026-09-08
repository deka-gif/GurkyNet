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
 * Mobile phone-operator catalog — mirrors Web PhoneOperatorCatalogFlow / PulsaPage:
 * phone → prefix operator detect → GET /products?category=… → client filter by brand
 * → checkout (existing Mobile transaction pipeline).
 *
 * Used for pulsa, sms-telepon, masa-aktif, international.
 */

type Props = {
  category?: string;
  purchaseBanner?: string | null;
  /** When true (international), skip Indonesian operator prefix filter. */
  skipOperatorFilter?: boolean;
};

export function PulsaCatalogFlow({
  category = 'pulsa',
  purchaseBanner,
  skipOperatorFilter = false,
}: Props) {
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
  const phoneReady = skipOperatorFilter
    ? phoneNo.replace(/\D/g, '').length >= 8
    : isValidPhoneTarget(phoneNo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category, per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk.');
        setAllProducts([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat produk.');
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  const listed = useMemo(() => {
    if (skipOperatorFilter) {
      return sortProductsByPriceAsc(allProducts.filter((p) => isCatalogListed(p)));
    }
    if (!operator) return [];
    return sortProductsByPriceAsc(
      allProducts.filter(
        (p) => isCatalogListed(p) && operatorsMatch(p.operatorName || p.providerDetails?.name, operator)
      )
    );
  }, [allProducts, operator, skipOperatorFilter]);

  const onSelect = (product: Product) => {
    if (!purchaseEnabled || !phoneReady) return;
    if (!skipOperatorFilter && !operator) return;
    if (!isProductPurchasable(product)) return;
    const digits = sanitizePhoneDigits(phoneNo);
    startCheckout(product);
    setTarget(digits);
    setPurchaseContext({
      operatorLabel: skipOperatorFilter ? product.operatorName || null : operator,
      selectedRegion: null,
    });
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  const needOperator = !skipOperatorFilter && !operator;

  return (
    <View style={styles.wrap}>
      <PhoneOperatorInput value={phoneNo} onChangeText={setPhoneNo} operator={operator} />

      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      {needOperator ? (
        <EmptyState
          title="Masukkan Nomor HP"
          message="Produk akan muncul setelah operator terdeteksi."
        />
      ) : loading && listed.length === 0 ? (
        <LoadingState label="Memuat produk..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : listed.length === 0 ? (
        <EmptyState title="Belum Ada Produk" message="Produk untuk kategori ini belum tersedia." />
      ) : !purchaseEnabled ? (
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
        />
      ) : (
        <View style={styles.list}>
          {!phoneReady ? (
            <Text style={styles.hintWarn}>
              {skipOperatorFilter
                ? 'Lengkapi nomor internasional sebelum memilih produk.'
                : 'Lengkapi nomor HP (minimal 10 digit) sebelum memilih nominal.'}
            </Text>
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
