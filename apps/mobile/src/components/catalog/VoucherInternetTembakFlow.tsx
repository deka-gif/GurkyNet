import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { catalogService, Product } from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { useWalletStore } from '../../store/wallet.store';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PurchaseFlowNotice,
} from '../ui';
import { PhoneOperatorInput } from './PhoneOperatorInput';
import { VoucherInternetProductList } from './VoucherInternetProductList';
import { colors, radius, spacing, typography } from '../../theme';
import { detectOperatorFromPhone, providerApiName } from '../../utils/detectOperator';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, sanitizePhoneDigits } from '../../utils/targetValidation';
import {
  collectGeographicTelkomselZoneLabels,
  collectOrphanTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';

/**
 * Voucher Internet — Tembak Langsung.
 *
 * Flow: phone → detect operator → (zone if Telkomsel gate) → products → checkout/PIN.
 *
 * Catalog (aligned with Elektronik/Fisik providers-first, adapted for phone-first UX):
 *  1) GET /products/providers?category=voucher-internet (brand ids; TTL 300s)
 *  2) After MSISDN operator detect → GET /products?provider_id=… (on-demand; no full 5000 dump)
 *
 * Preserves: operator↔product mismatch gate, Telkomsel zone gate, Nasional first,
 * Wilayah Lainnya (orphan Digi zones).
 */

type Props = {
  purchaseBanner?: string | null;
  onBack: () => void;
};

type Step = 'phone' | 'zone' | 'products';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

export function VoucherInternetTembakFlow({ purchaseBanner, onBack }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [step, setStep] = useState<Step>('phone');
  const [brandProviders, setBrandProviders] = useState<{ name: string; providerId: number }[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState('');
  const [nationalSelected, setNationalSelected] = useState(false);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadedForOperator, setLoadedForOperator] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const operator = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);
  const phoneReady = isValidPhoneTarget(phoneNo) && !!operator;

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    setError(null);
    try {
      const res = await catalogService.getCategoryProviders('voucher-internet');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBrandProviders(
          res.data
            .filter((p) => p?.providerId && p?.name)
            .map((p) => ({ name: String(p.name).trim(), providerId: p.providerId }))
        );
      } else {
        setBrandProviders([]);
      }
    } catch {
      setBrandProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  const loadOperatorProducts = useCallback(
    async (op: NonNullable<typeof operator>): Promise<Product[]> => {
      const seq = ++loadSeq.current;
      setProductsLoading(true);
      setError(null);
      try {
        const match = brandProviders.find((b) => operatorsMatch(b.name, op));
        const providerName = providerApiName(op);
        const res = match
          ? await catalogService.getProducts({
              category: 'voucher-internet',
              provider_id: match.providerId,
              per_page: 500,
            })
          : await catalogService.getProducts({
              category: 'voucher-internet',
              provider: providerName,
              per_page: 500,
            });
        if (seq !== loadSeq.current) return [];
        if (res.success && Array.isArray(res.data)) {
          const listed = res.data.filter((p) => isCatalogListed(p));
          const forOp = listed.filter((p) =>
            operatorsMatch(p.operatorName || p.providerDetails?.name, op)
          );
          setAllProducts(forOp);
          setLoadedForOperator(op);
          return forOp;
        }
        setAllProducts([]);
        setLoadedForOperator(op);
        setError(res.message || 'Gagal memuat katalog voucher internet.');
        return [];
      } catch (err: any) {
        if (seq !== loadSeq.current) return [];
        setAllProducts([]);
        setLoadedForOperator(op);
        setError(err?.message || 'Gagal memuat katalog voucher internet.');
        return [];
      } finally {
        if (seq === loadSeq.current) setProductsLoading(false);
      }
    },
    [brandProviders]
  );

  useEffect(() => {
    void loadProviders();
    void fetchWallet();
  }, [loadProviders, fetchWallet]);

  // Prefetch operator-scoped catalog after detect — phone step must not wait on full VI dump.
  useEffect(() => {
    if (!operator) {
      loadSeq.current += 1;
      setAllProducts([]);
      setLoadedForOperator(null);
      setProductsLoading(false);
      setError(null);
      return;
    }
    // Wait for providers map when available (warm TTL); still fetch via provider= if empty.
    if (providersLoading) return;
    if (loadedForOperator === operator) return;
    void loadOperatorProducts(operator);
  }, [operator, providersLoading, brandProviders, loadOperatorProducts, loadedForOperator]);

  const operatorProducts = useMemo(() => {
    if (!operator) return [];
    return allProducts
      .filter((p) => operatorsMatch(p.operatorName || p.providerDetails?.name, operator))
      .sort((a, b) => a.price - b.price);
  }, [allProducts, operator]);

  const telkomselActive = !!operator && isTelkomselOperator(operator) && operatorProducts.length > 0;
  const zoneGate = telkomselActive && telkomselNeedsZoneGate(operatorProducts);
  const zoneLabels = useMemo(
    () => (telkomselActive ? collectGeographicTelkomselZoneLabels(operatorProducts) : []),
    [telkomselActive, operatorProducts]
  );
  const orphanLabels = useMemo(
    () => (telkomselActive ? collectOrphanTelkomselZoneLabels(operatorProducts) : []),
    [telkomselActive, operatorProducts]
  );
  const nationalProducts = useMemo(
    () => (telkomselActive ? telkomselNationalProducts(operatorProducts) : []),
    [telkomselActive, operatorProducts]
  );
  const hasNational = nationalProducts.length > 0;

  const catalogProducts = useMemo(() => {
    if (!operator) return [];
    if (!zoneGate) return operatorProducts;
    if (nationalSelected) return nationalProducts;
    if (zoneLabel) return filterProductsByZoneLabel(operatorProducts, zoneLabel);
    return [];
  }, [operator, zoneGate, operatorProducts, nationalSelected, nationalProducts, zoneLabel]);

  const displayZone = zoneLabel || (nationalSelected ? 'Nasional' : null);

  const resetZoneSelection = useCallback(() => {
    setNationalSelected(false);
    setZoneLabel(null);
  }, []);

  const onPhoneChange = (digits: string) => {
    setPhoneNo(digits);
    setFormError(null);
    resetZoneSelection();
  };

  const goBackStep = useCallback(() => {
    if (step === 'products') {
      setFormError(null);
      if (zoneGate) {
        setStep('zone');
      } else {
        setStep('phone');
      }
      return;
    }
    if (step === 'zone') {
      setStep('phone');
      setFormError(null);
      return;
    }
    onBack();
  }, [step, zoneGate, onBack]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, goBackStep]);

  const continueFromPhone = async () => {
    setFormError(null);
    if (!isValidPhoneTarget(phoneNo)) {
      setFormError('Nomor HP penerima tidak valid.');
      return;
    }
    if (!operator) {
      setFormError('Operator tidak dikenali dari nomor ini.');
      return;
    }

    // Ensure operator catalog is ready before choosing zone vs products (zoneGate needs SKUs).
    let products = operatorProducts;
    if (productsLoading || loadedForOperator !== operator || products.length === 0) {
      products = await loadOperatorProducts(operator);
    }
    if (error && products.length === 0) return;

    const telkomsel = isTelkomselOperator(operator) && products.length > 0;
    const needsZone = telkomsel && telkomselNeedsZoneGate(products);
    if (needsZone) {
      setStep('zone');
      return;
    }
    setStep('products');
  };

  const selectNational = () => {
    setNationalSelected(true);
    setZoneLabel(null);
    setFormError(null);
    setStep('products');
  };

  const selectZone = (label: string) => {
    setNationalSelected(false);
    setZoneLabel(label);
    setFormError(null);
    setStep('products');
  };

  const openHelpWilayah = () => {
    router.push({ pathname: '/help/cek-zona', params: { provider: 'telkomsel' } });
  };

  const selectProduct = (product: Product) => {
    setFormError(null);
    if (!isProductPurchasable(product)) return;
    if (!operator || !isValidPhoneTarget(phoneNo)) {
      setFormError('Nomor HP atau operator tidak valid.');
      return;
    }
    const productBrand = product.operatorName || product.providerDetails?.name;
    if (!operatorsMatch(productBrand, operator)) {
      setFormError('Produk tidak sesuai dengan operator nomor tujuan.');
      return;
    }
    if (!purchaseEnabled) return;

    const balance = overview?.wallet?.balance;
    if (typeof balance === 'number' && balance < product.price + (product.adminFee || 0)) {
      setFormError('Saldo GurkyPay tidak mencukupi.');
      return;
    }

    // Idempotency key created/rotated only in startCheckout — not on step navigation.
    startCheckout(product);
    setTarget(sanitizePhoneDigits(phoneNo));
    setPurchaseContext({
      operatorLabel: operator,
      selectedRegion: displayZone,
      voucherInternetMode: 'tembak',
    });
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  const catalogBusy = productsLoading && allProducts.length === 0;

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      {step !== 'zone' ? <Text style={styles.modeTag}>Tembak Langsung</Text> : null}

      {step === 'phone' ? (
        <>
          <Text style={styles.lead}>Masukkan nomor HP</Text>
          <PhoneOperatorInput
            label="Nomor HP"
            value={phoneNo}
            onChangeText={onPhoneChange}
            operator={operator}
            helperWhenDetected="Operator terdeteksi otomatis dari nomor kamu"
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {operator && catalogBusy ? (
            <Text style={styles.hint}>Menyiapkan katalog voucher…</Text>
          ) : null}
          <Button
            label="Lanjut"
            onPress={() => void continueFromPhone()}
            disabled={!phoneReady || catalogBusy}
          />
        </>
      ) : catalogBusy ? (
        <LoadingState label="Memuat voucher internet..." />
      ) : error && allProducts.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            if (operator) void loadOperatorProducts(operator);
            else void loadProviders();
          }}
        />
      ) : step === 'zone' ? (
        <>
          <Text style={styles.kategoriLabel}>Kategori</Text>
          <Text style={styles.kategoriValue}>Tembak Langsung</Text>
          <Text style={styles.phoneMeta}>
            {sanitizePhoneDigits(phoneNo)} · {operator}
          </Text>

          {hasNational ? (
            <TouchableOpacity activeOpacity={0.7} onPress={selectNational}>
              <Card style={[styles.nationalCard, nationalSelected && styles.zoneCardActive]}>
                <View style={styles.nationalHeader}>
                  <Text style={styles.nationalTitle}>Nasional</Text>
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendBadgeText}>Direkomendasikan</Text>
                  </View>
                </View>
                <Text style={styles.nationalMeta}>
                  Berlaku semua wilayah · {nationalProducts.length} produk
                </Text>
              </Card>
            </TouchableOpacity>
          ) : null}

          <View style={styles.zoneWarn}>
            <View style={styles.zoneWarnRow}>
              <Ionicons name="warning" size={22} color={colors.status.pending} />
              <Text style={styles.zoneWarnText}>
                Paket Telkomsel dibagi per wilayah. Pastikan pilih wilayah yang sesuai kartu kamu. Kalau
                salah paket tidak akan aktif.
              </Text>
            </View>
            <Pressable onPress={openHelpWilayah} hitSlop={8}>
              <Text style={styles.helpLink}>Cara cek wilayah kartu saya</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Voucher per wilayah</Text>

          {zoneLabels.length === 0 && orphanLabels.length === 0 && !hasNational ? (
            <EmptyState
              title="Belum Ada Wilayah"
              message="Belum ada paket tersedia untuk wilayah ini."
            />
          ) : zoneLabels.length === 0 && orphanLabels.length === 0 ? (
            <EmptyState
              title="Belum Ada Wilayah"
              message="Belum ada paket per wilayah untuk operator ini."
            />
          ) : (
            <>
              {zoneLabels.length > 0 ? (
                <View style={styles.list}>
                  {zoneLabels.map((label) => {
                    const active = zoneLabel === label;
                    const count = filterProductsByZoneLabel(operatorProducts, label).length;
                    return (
                      <TouchableOpacity key={label} activeOpacity={0.7} onPress={() => selectZone(label)}>
                        <Card style={[styles.zoneCard, active && styles.zoneCardActive]}>
                          <Text style={[styles.zoneTitle, active && styles.zoneTitleActive]} numberOfLines={2}>
                            {label}
                          </Text>
                          <Text style={styles.zoneMeta}>{count} produk</Text>
                        </Card>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {orphanLabels.length > 0 ? (
                <>
                  <Text style={[styles.section, zoneLabels.length > 0 ? styles.orphanSection : null]}>
                    Wilayah Lainnya
                  </Text>
                  <Text style={styles.orphanHint}>
                    Zona Digiflazz yang belum dikelompokkan ke pulau di atas.
                  </Text>
                  <View style={styles.list}>
                    {orphanLabels.map((label) => {
                      const active = zoneLabel === label;
                      const count = filterProductsByZoneLabel(operatorProducts, label).length;
                      return (
                        <TouchableOpacity key={label} activeOpacity={0.7} onPress={() => selectZone(label)}>
                          <Card style={[styles.zoneCard, active && styles.zoneCardActive]}>
                            <Text style={[styles.zoneTitle, active && styles.zoneTitleActive]} numberOfLines={2}>
                              {label}
                            </Text>
                            <Text style={styles.zoneMeta}>{count} produk</Text>
                          </Card>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <Text style={styles.lead}>Pilih paket</Text>
          <Text style={styles.phoneMeta}>
            {sanitizePhoneDigits(phoneNo)} · {operator}
            {displayZone ? ` · ${displayZone}` : ''}
          </Text>

          {!purchaseEnabled ? (
            <PurchaseFlowNotice
              icon="time-outline"
              title="Pembelian Belum Aktif"
              message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
            />
          ) : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          {catalogProducts.length === 0 ? (
            <EmptyState
              title="Belum Ada Paket"
              message="Belum ada paket tersedia untuk wilayah ini."
            />
          ) : (
            <VoucherInternetProductList
              products={catalogProducts}
              onSelect={selectProduct}
              isDisabled={(p) => !isProductPurchasable(p) || !purchaseEnabled}
              getMetaLabel={(p) =>
                p.zoneLabel ? p.zoneLabel : displayZone === 'Nasional' ? 'Nasional' : null
              }
            />
          )}
        </>
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
  modeTag: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kategoriLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kategoriValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  lead: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
  },
  phoneMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  section: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  orphanSection: {
    marginTop: spacing.md,
  },
  orphanHint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  zoneWarn: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent[400],
    padding: spacing.md,
    gap: spacing.sm,
  },
  zoneWarnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  zoneWarnText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.gray[800],
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
  helpLink: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textDecorationLine: 'underline',
    marginLeft: 30,
  },
  list: { gap: spacing.sm },
  nationalCard: {
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.primary[100],
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  nationalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  nationalTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[800],
  },
  nationalMeta: {
    fontSize: typography.size.xs,
    color: colors.primary[700],
    fontWeight: typography.weight.medium,
  },
  recommendBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  recommendBadgeText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.white,
    letterSpacing: 0.2,
  },
  zoneCard: {
    padding: spacing.md,
    gap: 4,
  },
  zoneCardActive: {
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[100],
  },
  zoneTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  zoneTitleActive: { color: colors.primary[700] },
  zoneMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
});
