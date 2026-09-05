import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import {
  Card,
  LoadingState,
  ErrorState,
  EmptyState,
  BrandLogo,
  PurchaseFlowNotice,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { detectOperatorFromPhone, providerBadgeLabel } from '../../utils/detectOperator';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, phoneTargetError, sanitizePhoneDigits } from '../../utils/targetValidation';

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
  const phoneErr = phoneNo.length > 0 ? phoneTargetError(phoneNo) : null;

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
    return allProducts.filter(
      (p) => isCatalogListed(p) && operatorsMatch(p.operatorName || p.providerDetails?.name, operator)
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
      <View style={styles.field}>
        <Text style={styles.label}>Nomor Handphone</Text>
        <TextInput
          value={phoneNo}
          onChangeText={(t) => setPhoneNo(sanitizePhoneDigits(t))}
          placeholder="08xxxxxxxxxx"
          keyboardType="number-pad"
          placeholderTextColor={colors.gray[400]}
          style={styles.input}
        />
        {operator ? (
          <Text style={styles.operatorBadge}>{providerBadgeLabel(operator)}</Text>
        ) : phoneNo.length >= 4 ? (
          <Text style={styles.hintWarn}>Operator tidak dikenali dari nomor ini.</Text>
        ) : (
          <Text style={styles.hint}>Masukkan minimal 4 digit untuk deteksi operator.</Text>
        )}
        {phoneErr ? <Text style={styles.error}>{phoneErr}</Text> : null}
      </View>

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
          {listed.map((product) => {
            const unavailable = !isProductPurchasable(product);
            const brandName = product.operatorName || product.providerDetails?.name || '';
            return (
              <TouchableOpacity
                key={product.id}
                activeOpacity={0.7}
                disabled={unavailable || !phoneReady || !purchaseEnabled}
                onPress={() => onSelect(product)}
              >
                <Card style={[styles.card, (unavailable || !phoneReady) && styles.cardDisabled]}>
                  <View style={styles.row}>
                    <BrandLogo name={brandName || 'Brand'} logo={product.providerDetails?.logo} size={40} />
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={2}>
                        {product.name}
                      </Text>
                      {unavailable ? <Text style={styles.meta}>Tidak tersedia</Text> : null}
                    </View>
                    <Text style={styles.price}>{formatIDR(product.price)}</Text>
                  </View>
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
  operatorBadge: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  hint: { fontSize: typography.size.xs, color: colors.gray[500] },
  hintWarn: { fontSize: typography.size.xs, color: colors.status.pending },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
  list: { gap: spacing.sm },
  card: { padding: spacing.md },
  cardDisabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.gray[900] },
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
  price: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
});
