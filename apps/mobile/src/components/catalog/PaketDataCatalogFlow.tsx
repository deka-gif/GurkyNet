import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  Button,
  PurchaseFlowNotice,
} from '../ui';
import { PhoneOperatorInput } from './PhoneOperatorInput';
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { colors, radius, spacing, typography } from '../../theme';
import {
  DetectedOperator,
  detectOperatorFromPhone,
} from '../../utils/detectOperator';
import { DATA_PAKET_CONFIGS, DataChip, regionOptionsForOperator } from '../../utils/dataPaketConfig';
import { isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, sanitizePhoneDigits } from '../../utils/targetValidation';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';

/**
 * Mobile Paket Data pre-checkout — mirrors Web PaketDataPage + TelkomselPaketDataCatalog:
 *
 * 1) phone → MSISDN prefix detects operator (local; no catalog dump)
 * 2) operator → DATA_PAKET_CONFIGS confirms Digi brand / providerApiName (local)
 * 3) taxonomy chips from GET /catalog/{op}-data/taxonomy (Digi `type`, inventory-backed)
 * 4) on-demand GET /products?category=data&provider=…&data_type=… (exact Digi type)
 */

type Props = {
  purchaseBanner?: string | null;
};

const KEYWORD_DEBOUNCE_MS = 300;

export function PaketDataCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const [phoneNo, setPhoneNo] = useState('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [chips, setChips] = useState<DataChip[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionProduct, setRegionProduct] = useState<Product | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const loadSeq = useRef(0);

  const operator = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);
  const config = operator ? DATA_PAKET_CONFIGS[operator as DetectedOperator] : null;
  const regionOptions = useMemo(() => regionOptionsForOperator(operator), [operator]);
  const phoneReady = isValidPhoneTarget(phoneNo);

  // Mirror web TelkomselPaketDataCatalog — debounce search before product refetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    if (!config) {
      setChips([]);
      setActiveGroup(null);
      setKeyword('');
      setDebouncedKeyword('');
      return;
    }
    setChips(config.defaultChips);
    setActiveGroup(null);
    setKeyword('');
    setDebouncedKeyword('');
    let cancelled = false;
    void (async () => {
      try {
        const res = await catalogService.getOperatorDataTaxonomy(config.taxonomyKey);
        if (cancelled) return;
        if (res.success && Array.isArray(res.data?.chips) && res.data.chips.length > 0) {
          setChips(res.data.chips as DataChip[]);
        }
        // API fail / empty → keep Semua skeleton only (never restore hardcode taxonomy).
      } catch {
        // Keep Semua skeleton.
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
    // Gate: no product API until operator → provider brand is confirmed locally.
    if (!config) {
      loadSeq.current += 1;
      setProducts([]);
      setError(null);
      setLoading(false);
      return;
    }

    const seq = ++loadSeq.current;
    const provider = config.providerApiName;
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({
        category: 'data',
        provider,
        keyword: debouncedKeyword || undefined,
        data_type: activeGroup || undefined,
        data_group: activeGroup || undefined,
        sort: 'price_asc',
        page: 1,
        per_page: 40,
      });
      if (seq !== loadSeq.current) return;
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat paket data.');
        setProducts([]);
      }
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'Gagal memuat paket data.');
      setProducts([]);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [config, debouncedKeyword, activeGroup]);

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
      <PhoneOperatorInput
        value={phoneNo}
        onChangeText={setPhoneNo}
        operator={operator}
        unrecognizedMessage="Operator tidak dikenali. Paket Data memerlukan operator yang didukung."
      />

      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

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
            onSubmitEditing={() => setDebouncedKeyword(keyword.trim())}
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
              <ProductCatalogGrid
                products={sortProductsByPriceAsc(products)}
                columns={2}
                onPress={onSelect}
                isDisabled={(p) => !isProductPurchasable(p) || !phoneReady}
                renderMeta={(p) => (
                  <>
                    {(p.quota || p.validity) ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {[p.quota, p.validity].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {p.requiresRegion ? (
                      <Text style={styles.regionFlag}>Perlu wilayah</Text>
                    ) : null}
                    {!isProductPurchasable(p) ? (
                      <Text style={styles.meta}>Tidak tersedia</Text>
                    ) : null}
                  </>
                )}
              />
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
  hintWarn: { fontSize: typography.size.xs, color: colors.status.pending },
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
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
  regionFlag: { fontSize: typography.size.xs, color: colors.primary[600], fontWeight: typography.weight.medium },
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
