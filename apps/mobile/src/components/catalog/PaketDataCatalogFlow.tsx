import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
  Button,
  PurchaseFlowNotice,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import {
  DetectedOperator,
  detectOperatorFromPhone,
  providerBadgeLabel,
} from '../../utils/detectOperator';
import { DATA_PAKET_CONFIGS, DataChip, regionOptionsForOperator } from '../../utils/dataPaketConfig';
import { isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, phoneTargetError, sanitizePhoneDigits } from '../../utils/targetValidation';

/**
 * Mobile Paket Data pre-checkout — mirrors Web PaketDataPage + TelkomselPaketDataCatalog:
 * phone → operator → taxonomy chips → GET /products?category=data&provider=…
 * → optional region when requiresRegion → existing Mobile checkout pipeline.
 * Region is confirmation UI only (not sent on POST /transactions).
 */

type Props = {
  purchaseBanner?: string | null;
};

export function PaketDataCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const [phoneNo, setPhoneNo] = useState('');
  const [keyword, setKeyword] = useState('');
  const [chips, setChips] = useState<DataChip[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionProduct, setRegionProduct] = useState<Product | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');

  const operator = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);
  const config = operator ? DATA_PAKET_CONFIGS[operator as DetectedOperator] : null;
  const regionOptions = useMemo(() => regionOptionsForOperator(operator), [operator]);
  const phoneReady = isValidPhoneTarget(phoneNo);
  const phoneErr = phoneNo.length > 0 ? phoneTargetError(phoneNo) : null;

  useEffect(() => {
    if (!config) {
      setChips([]);
      setActiveGroup(null);
      return;
    }
    setChips(config.defaultChips);
    setActiveGroup(null);
    let cancelled = false;
    void (async () => {
      try {
        const res = await catalogService.getOperatorDataTaxonomy(config.taxonomyKey);
        if (cancelled) return;
        if (res.success && Array.isArray(res.data?.chips) && res.data.chips.length > 0) {
          setChips(res.data.chips as DataChip[]);
        }
      } catch {
        // Keep default chips — same as Web fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config?.taxonomyKey, config?.operatorLabel]);

  useEffect(() => {
    if (regionOptions.length > 0) {
      setSelectedRegion((prev) => (regionOptions.includes(prev) ? prev : regionOptions[0]));
    } else {
      setSelectedRegion('');
    }
  }, [regionOptions]);

  const loadProducts = useCallback(async () => {
    if (!config) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({
        category: 'data',
        provider: config.providerApiName,
        keyword: keyword.trim() || undefined,
        data_group: activeGroup || undefined,
        telkomsel_group: activeGroup || undefined,
        sort: 'price_asc',
        page: 1,
        per_page: 40,
      });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat paket data.');
        setProducts([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat paket data.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [config, keyword, activeGroup]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const proceedToCheckout = (product: Product, region: string | null) => {
    if (!purchaseEnabled || !phoneReady || !operator) return;
    if (!isProductPurchasable(product)) return;
    startCheckout(product);
    setTarget(sanitizePhoneDigits(phoneNo));
    setPurchaseContext({
      operatorLabel: operator,
      selectedRegion: product.requiresRegion ? region : null,
    });
    setRegionProduct(null);
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  const onSelect = (product: Product) => {
    if (!purchaseEnabled || !phoneReady) return;
    if (!isProductPurchasable(product)) return;
    if (product.requiresRegion) {
      if (regionOptions.length === 0) {
        // Flag set but no region list for this operator — continue without region (Web still opens panel).
        proceedToCheckout(product, null);
        return;
      }
      setRegionProduct(product);
      return;
    }
    proceedToCheckout(product, null);
  };

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

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
          <Text style={styles.hintWarn}>Operator tidak dikenali. Paket Data memerlukan operator yang didukung.</Text>
        ) : (
          <Text style={styles.hint}>Masukkan minimal 4 digit untuk deteksi operator.</Text>
        )}
        {phoneErr ? <Text style={styles.error}>{phoneErr}</Text> : null}
      </View>

      {!operator || !config ? (
        <EmptyState
          title="Masukkan Nomor HP"
          message="Katalog paket data muncul setelah operator terdeteksi."
        />
      ) : !purchaseEnabled ? (
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
        />
      ) : (
        <>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => void loadProducts()}
            placeholder={config.searchPlaceholder}
            placeholderTextColor={colors.gray[400]}
            returnKeyType="search"
            style={styles.input}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((chip) => {
              const active = activeGroup === chip.group;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setActiveGroup(chip.group)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!phoneReady ? (
            <Text style={styles.hintWarn}>Lengkapi nomor HP (minimal 10 digit) sebelum memilih paket.</Text>
          ) : null}

          {loading && products.length === 0 ? (
            <LoadingState label="Memuat paket data..." />
          ) : error ? (
            <ErrorState message={error} onRetry={loadProducts} />
          ) : products.length === 0 ? (
            <EmptyState title="Belum Ada Paket" message="Tidak ada paket untuk filter ini." />
          ) : (
            <View style={styles.list}>
              {products.map((product) => {
                const unavailable = !isProductPurchasable(product);
                const brandName = product.operatorName || product.providerDetails?.name || config.operatorLabel;
                return (
                  <TouchableOpacity
                    key={product.id}
                    activeOpacity={0.7}
                    disabled={unavailable || !phoneReady}
                    onPress={() => onSelect(product)}
                  >
                    <Card style={[styles.card, (unavailable || !phoneReady) && styles.cardDisabled]}>
                      <View style={styles.row}>
                        <BrandLogo name={brandName} logo={product.providerDetails?.logo} size={40} />
                        <View style={styles.info}>
                          <Text style={styles.name} numberOfLines={2}>
                            {product.name}
                          </Text>
                          {(product.quota || product.validity) && (
                            <Text style={styles.meta} numberOfLines={1}>
                              {[product.quota, product.validity].filter(Boolean).join(' · ')}
                            </Text>
                          )}
                          {product.requiresRegion ? (
                            <Text style={styles.regionFlag}>Memerlukan pilihan wilayah</Text>
                          ) : null}
                        </View>
                        <Text style={styles.price}>{formatIDR(product.price)}</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      <Modal visible={!!regionProduct} transparent animationType="fade" onRequestClose={() => setRegionProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Wilayah</Text>
            <Text style={styles.modalSub}>
              {regionProduct?.name || 'Paket ini membutuhkan konfirmasi wilayah.'}
            </Text>
            <ScrollView style={styles.regionList}>
              {regionOptions.map((region) => {
                const active = selectedRegion === region;
                return (
                  <Pressable
                    key={region}
                    onPress={() => setSelectedRegion(region)}
                    style={[styles.regionItem, active && styles.regionItemActive]}
                  >
                    <Text style={[styles.regionText, active && styles.regionTextActive]}>{region}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <View style={styles.modalBtn}>
                <Button label="Batal" variant="secondary" onPress={() => setRegionProduct(null)} />
              </View>
              <View style={styles.modalBtn}>
                <Button
                  label="Lanjut Bayar"
                  onPress={() => {
                    if (regionProduct) proceedToCheckout(regionProduct, selectedRegion || null);
                  }}
                  disabled={!selectedRegion}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray[100],
  },
  chipActive: { backgroundColor: colors.primary[600] },
  chipText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.gray[700] },
  chipTextActive: { color: colors.white },
  list: { gap: spacing.sm },
  card: { padding: spacing.md },
  cardDisabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.gray[900] },
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
  regionFlag: { fontSize: typography.size.xs, color: colors.primary[600], fontWeight: typography.weight.medium },
  price: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '70%',
    gap: spacing.md,
  },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.gray[900] },
  modalSub: { fontSize: typography.size.sm, color: colors.gray[500] },
  regionList: { maxHeight: 280 },
  regionItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.gray[50],
  },
  regionItemActive: { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[200] },
  regionText: { fontSize: typography.size.sm, color: colors.gray[800] },
  regionTextActive: { fontWeight: typography.weight.bold, color: colors.primary[700] },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalBtn: { flex: 1 },
});
