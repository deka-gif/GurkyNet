import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { catalogService, Product } from '../../services/catalog.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { useWalletStore } from '../../store/wallet.store';
import {
  BrandLogo,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PurchaseFlowNotice,
} from '../ui';
import { VoucherInternetProductList } from './VoucherInternetProductList';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, sanitizePhoneDigits } from '../../utils/targetValidation';
import {
  collectTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';

/**
 * Voucher Internet — Elektronik (Web mode `elektronik` / VoucherElektronikZonaPage).
 * Flow: brand → (zone if Telkomsel gate) → products → [phone only if required] → checkout.
 * Target contract (Web): phoneNo (optional) || walletNo || 'EVOUCHER'.
 * No operator detection / mismatch gate (unlike Tembak).
 */

type Props = {
  purchaseBanner?: string | null;
  onBack: () => void;
};

type Step = 'brands' | 'zone' | 'products' | 'phone';

type BrandRow = { name: string; count: number; logo: string | null };

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

/**
 * Web shows phone as optional for every elektronik product — no ProductResource
 * classifier (no productType / fulfillmentType / requiresPhone). Until backend
 * exposes an explicit flag, no product routes through the phone step.
 */
function elektronikProductRequiresPhone(_product: Product): boolean {
  return false;
}

function resolveElektronikTarget(
  optionalPhone: string,
  wallet: { wallet_number?: string | null; gurkyPayId?: string | null; walletNo?: string | null } | null | undefined
): string {
  const digits = sanitizePhoneDigits(optionalPhone);
  if (digits.length >= 10) return digits;
  const walletNo = wallet?.wallet_number || wallet?.gurkyPayId || wallet?.walletNo || null;
  if (walletNo && String(walletNo).trim() !== '') return String(walletNo).trim();
  return 'EVOUCHER';
}

export function VoucherInternetElektronikFlow({ purchaseBanner, onBack }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [step, setStep] = useState<Step>('brands');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [optionalPhone, setOptionalPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [nationalSelected, setNationalSelected] = useState(false);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category: 'voucher-internet', per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data.filter((p) => isCatalogListed(p)));
      } else {
        setAllProducts([]);
        setError(res.message || 'Gagal memuat katalog voucher internet.');
      }
    } catch (err: any) {
      setAllProducts([]);
      setError(err?.message || 'Gagal memuat katalog voucher internet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetchWallet();
  }, [load, fetchWallet]);

  const brands = useMemo((): BrandRow[] => {
    const map = new Map<string, BrandRow>();
    for (const p of allProducts) {
      const name = (p.operatorName || p.providerDetails?.name || 'Umum').trim();
      const prev = map.get(name);
      if (prev) prev.count += 1;
      else map.set(name, { name, count: 1, logo: p.providerDetails?.logo ?? null });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [allProducts]);

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, brandQuery]);

  const brandProducts = useMemo(() => {
    if (!brand) return [];
    return allProducts
      .filter((p) => operatorsMatch(p.operatorName || p.providerDetails?.name, brand))
      .sort((a, b) => a.price - b.price);
  }, [allProducts, brand]);

  const telkomselActive = !!brand && isTelkomselOperator(brand) && brandProducts.length > 0;
  const zoneGate = telkomselActive && telkomselNeedsZoneGate(brandProducts);
  const zoneLabels = useMemo(
    () => (telkomselActive ? collectTelkomselZoneLabels(brandProducts) : []),
    [telkomselActive, brandProducts]
  );
  const nationalProducts = useMemo(
    () => (telkomselActive ? telkomselNationalProducts(brandProducts) : []),
    [telkomselActive, brandProducts]
  );
  const hasNational = nationalProducts.length > 0;

  const catalogProducts = useMemo(() => {
    if (!brand) return [];
    if (!zoneGate) return brandProducts;
    if (nationalSelected) return nationalProducts;
    if (zoneLabel) return filterProductsByZoneLabel(brandProducts, zoneLabel);
    return [];
  }, [brand, zoneGate, brandProducts, nationalSelected, nationalProducts, zoneLabel]);

  const displayZone = zoneLabel || (nationalSelected ? 'Nasional' : null);

  const resetZoneSelection = useCallback(() => {
    setNationalSelected(false);
    setZoneLabel(null);
  }, []);

  const goToCheckout = useCallback(
    (product: Product, phoneForTarget: string) => {
      setFormError(null);
      if (!isProductPurchasable(product)) {
        setFormError('Produk sedang tidak tersedia.');
        return;
      }
      if (!purchaseEnabled) return;

      const balance = overview?.wallet?.balance;
      if (typeof balance === 'number' && balance < product.price + (product.adminFee || 0)) {
        setFormError('Saldo GurkyPay tidak mencukupi.');
        return;
      }

      const target = resolveElektronikTarget(phoneForTarget, overview?.wallet);
      // Idempotency key only via startCheckout — not on step navigation.
      startCheckout(product);
      setTarget(target);
      setPurchaseContext({
        operatorLabel: brand,
        selectedRegion: displayZone,
        voucherInternetMode: 'elektronik',
      });
      router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
    },
    [
      purchaseEnabled,
      overview?.wallet,
      brand,
      displayZone,
      startCheckout,
      setTarget,
      setPurchaseContext,
      router,
    ]
  );

  const goBackStep = useCallback(() => {
    if (step === 'phone') {
      setStep('products');
      setOptionalPhone('');
      setFormError(null);
      return;
    }
    if (step === 'products') {
      setSelected(null);
      setFormError(null);
      if (zoneGate) {
        setStep('zone');
      } else {
        setBrand(null);
        resetZoneSelection();
        setStep('brands');
      }
      return;
    }
    if (step === 'zone') {
      setBrand(null);
      resetZoneSelection();
      setSelected(null);
      setStep('brands');
      setFormError(null);
      return;
    }
    onBack();
  }, [step, zoneGate, onBack, resetZoneSelection]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, goBackStep]);

  const selectBrand = (name: string) => {
    setBrand(name);
    setSelected(null);
    setOptionalPhone('');
    setFormError(null);
    resetZoneSelection();

    const productsForBrand = allProducts.filter((p) =>
      operatorsMatch(p.operatorName || p.providerDetails?.name, name)
    );
    const needsZone =
      isTelkomselOperator(name) &&
      productsForBrand.length > 0 &&
      telkomselNeedsZoneGate(productsForBrand);

    setStep(needsZone ? 'zone' : 'products');
  };

  const selectNational = () => {
    setNationalSelected(true);
    setZoneLabel(null);
    setSelected(null);
    setFormError(null);
    setStep('products');
  };

  const selectZone = (label: string) => {
    setNationalSelected(false);
    setZoneLabel(label);
    setSelected(null);
    setFormError(null);
    setStep('products');
  };

  const openHelpWilayah = () => {
    router.push({ pathname: '/help/cek-zona', params: { provider: 'telkomsel' } });
  };

  const selectProduct = (product: Product) => {
    setFormError(null);
    if (!isProductPurchasable(product)) return;
    setSelected(product);
    setOptionalPhone('');

    if (elektronikProductRequiresPhone(product)) {
      setStep('phone');
      return;
    }
    goToCheckout(product, '');
  };

  const continueFromPhone = () => {
    if (!selected) return;
    setFormError(null);
    // Format-only: if user typed something incomplete, ask to finish or clear.
    const digits = sanitizePhoneDigits(optionalPhone);
    if (digits.length > 0 && !isValidPhoneTarget(optionalPhone)) {
      setFormError('Nomor HP minimal 10 digit, atau kosongkan jika tidak diperlukan.');
      return;
    }
    goToCheckout(selected, optionalPhone);
  };

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      {step !== 'zone' ? <Text style={styles.modeTag}>Voucher Elektronik</Text> : null}

      {loading && allProducts.length === 0 ? (
        <LoadingState label="Memuat voucher internet..." />
      ) : error && allProducts.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : step === 'brands' ? (
        <>
          <Text style={styles.lead}>Pilih Brand</Text>
          <TextInput
            value={brandQuery}
            onChangeText={setBrandQuery}
            placeholder="Cari brand..."
            placeholderTextColor={colors.gray[400]}
            style={styles.search}
          />
          {filteredBrands.length === 0 ? (
            <EmptyState title="Belum Ada Brand" message="Katalog voucher internet kosong." />
          ) : (
            <View style={styles.list}>
              {filteredBrands.map((b) => (
                <TouchableOpacity key={b.name} activeOpacity={0.7} onPress={() => selectBrand(b.name)}>
                  <Card style={styles.rowCard}>
                    <BrandLogo name={b.name} logo={b.logo} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{b.name}</Text>
                      <Text style={styles.rowMeta}>{b.count} produk</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : step === 'zone' ? (
        <>
          <Text style={styles.kategoriLabel}>Kategori</Text>
          <Text style={styles.kategoriValue}>Voucher Elektronik</Text>
          <Text style={styles.meta}>{brand}</Text>

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

          {zoneLabels.length === 0 && !hasNational ? (
            <EmptyState
              title="Belum Ada Wilayah"
              message="Belum ada voucher tersedia untuk wilayah ini."
            />
          ) : zoneLabels.length === 0 ? (
            <EmptyState
              title="Belum Ada Wilayah"
              message="Belum ada paket per wilayah untuk brand ini."
            />
          ) : (
            <View style={styles.list}>
              {zoneLabels.map((label) => {
                const active = zoneLabel === label;
                const count = filterProductsByZoneLabel(brandProducts, label).length;
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
          )}
        </>
      ) : step === 'products' ? (
        <>
          <Text style={styles.lead}>Pilih voucher</Text>
          <Text style={styles.meta}>
            {brand}
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
              title="Belum Ada Voucher"
              message="Belum ada voucher tersedia untuk wilayah ini."
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
      ) : (
        <>
          <Text style={styles.lead}>Nomor HP</Text>
          {selected ? (
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Produk</Text>
              <Text style={styles.summaryValue}>{selected.name}</Text>
              <Text style={styles.price}>{formatIDR(selected.price)}</Text>
            </Card>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Nomor HP</Text>
            <TextInput
              value={optionalPhone}
              onChangeText={(t) => {
                setOptionalPhone(sanitizePhoneDigits(t));
                setFormError(null);
              }}
              placeholder="08xxxxxxxxxx"
              keyboardType="number-pad"
              placeholderTextColor={colors.gray[400]}
              style={styles.search}
            />
            <Text style={styles.hint}>Masukkan nomor sesuai keperluan produk. Tanpa deteksi operator.</Text>
          </View>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Button
            label="Lanjut Konfirmasi"
            onPress={continueFromPhone}
            disabled={!selected || !purchaseEnabled}
          />
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
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
  section: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  search: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  field: { gap: spacing.xs },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[700] },
  hint: { fontSize: typography.size.xs, color: colors.gray[500] },
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
  zoneCard: { padding: spacing.md, gap: 4 },
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
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  price: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  disabled: { opacity: 0.55 },
  summaryCard: { gap: 4, padding: spacing.md },
  summaryLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  summaryValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
});
