import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { detectOperatorFromPhone, providerApiName } from '../../utils/detectOperator';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPhoneTarget, sanitizePhoneDigits } from '../../utils/targetValidation';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';
import { CATALOG_FETCH } from '../../config/catalogFetchLimits';
import {
  collectGeographicTelkomselZoneLabels,
  collectOrphanTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';

/**
 * Mobile phone-operator catalog — mirrors Web PhoneOperatorCatalogFlow / PulsaPage.
 *
 * Pulsa (category=pulsa): phone → prefix detect → GET /products?provider=… on-demand
 * (no full-category dump). Other categories using this component keep legacy load until
 * their own optimisations land.
 *
 * sms-telepon: Telkomsel zone gate (Nasional / geo / Wilayah Lainnya) — audit Item 9.
 *
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
  const [nationalSelected, setNationalSelected] = useState(false);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const operator = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);
  const phoneReady = skipOperatorFilter
    ? phoneNo.replace(/\D/g, '').length >= 8
    : isValidPhoneTarget(phoneNo);

  /** P0 — only Pulsa uses provider-scoped fetch; other categories unchanged. */
  const pulsaOnDemand = category === 'pulsa' && !skipOperatorFilter;
  const smsZoneEnabled = category === 'sms-telepon' && !skipOperatorFilter;

  const loadLegacyFullDump = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category, per_page: CATALOG_FETCH.GENERAL });
      if (seq !== loadSeq.current) return;
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk.');
        setAllProducts([]);
      }
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'Gagal memuat produk.');
      setAllProducts([]);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [category]);

  const loadPulsaForOperator = useCallback(async (op: NonNullable<typeof operator>) => {
    const seq = ++loadSeq.current;
    const provider = providerApiName(op);
    if (!provider) {
      setAllProducts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({
        category: 'pulsa',
        provider,
        per_page: 500,
        sort: 'price_asc',
      });
      if (seq !== loadSeq.current) return;
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk.');
        setAllProducts([]);
      }
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'Gagal memuat produk.');
      setAllProducts([]);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNationalSelected(false);
    setZoneLabel(null);
  }, [operator, category]);

  useEffect(() => {
    if (!pulsaOnDemand) {
      void loadLegacyFullDump();
      return;
    }
    if (!operator) {
      loadSeq.current += 1;
      setAllProducts([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadPulsaForOperator(operator);
  }, [pulsaOnDemand, operator, loadLegacyFullDump, loadPulsaForOperator]);

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

  const telkomselActive =
    smsZoneEnabled && !!operator && isTelkomselOperator(operator) && listed.length > 0;
  const zoneGate = telkomselActive && telkomselNeedsZoneGate(listed);
  const geoLabels = useMemo(
    () => (telkomselActive ? collectGeographicTelkomselZoneLabels(listed) : []),
    [telkomselActive, listed]
  );
  const orphanLabels = useMemo(
    () => (telkomselActive ? collectOrphanTelkomselZoneLabels(listed) : []),
    [telkomselActive, listed]
  );
  const hasNational = useMemo(
    () => (telkomselActive ? telkomselNationalProducts(listed).length > 0 : false),
    [telkomselActive, listed]
  );
  const zonePicked = nationalSelected || !!zoneLabel;

  const displayProducts = useMemo(() => {
    if (!zoneGate) return listed;
    if (!zonePicked) return [];
    if (nationalSelected) return telkomselNationalProducts(listed);
    if (zoneLabel) return filterProductsByZoneLabel(listed, zoneLabel);
    return [];
  }, [zoneGate, listed, zonePicked, nationalSelected, zoneLabel]);

  const displayZone = zoneLabel || (nationalSelected ? 'Nasional' : null);

  const onSelect = (product: Product) => {
    if (!purchaseEnabled || !phoneReady) return;
    if (!skipOperatorFilter && !operator) return;
    if (!isProductPurchasable(product)) return;
    if (zoneGate && !zonePicked) return;
    const digits = sanitizePhoneDigits(phoneNo);
    startCheckout(product);
    setTarget(digits);
    setPurchaseContext({
      operatorLabel: skipOperatorFilter ? product.operatorName || null : operator,
      selectedRegion: displayZone,
    });
    router.push({ pathname: '/checkout/[sku]', params: { sku: product.code } });
  };

  const needOperator = !skipOperatorFilter && !operator;
  const onRetry = () => {
    if (pulsaOnDemand) {
      if (operator) void loadPulsaForOperator(operator);
      return;
    }
    void loadLegacyFullDump();
  };

  return (
    <View style={styles.wrap}>
      <PhoneOperatorInput
        value={phoneNo}
        onChangeText={(t) => {
          setPhoneNo(t);
          setNationalSelected(false);
          setZoneLabel(null);
        }}
        operator={operator}
      />

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
        <ErrorState message={error} onRetry={onRetry} />
      ) : listed.length === 0 ? (
        <EmptyState
          title="Belum Ada Produk"
          message={
            category === 'international'
              ? 'Belum ada produk international aktif dari DigiFlazz/VIP. Negara tanpa SKU aktif tidak ditampilkan.'
              : 'Produk untuk kategori ini belum tersedia.'
          }
        />
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

          {zoneGate ? (
            <View style={styles.zoneBlock}>
              <Text style={styles.zoneTitle}>Pilih wilayah produk</Text>
              <Text style={styles.zoneHint}>
                SMS/Telepon regional mengikuti zona Digi — pilih Nasional atau wilayah yang sesuai.
              </Text>
              <View style={styles.zoneChips}>
                {hasNational ? (
                  <TouchableOpacity
                    style={[styles.zoneChip, nationalSelected ? styles.zoneChipOn : null]}
                    onPress={() => {
                      setNationalSelected(true);
                      setZoneLabel(null);
                    }}
                  >
                    <Text style={styles.zoneChipText}>Nasional</Text>
                  </TouchableOpacity>
                ) : null}
                {geoLabels.map((label) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.zoneChip, zoneLabel === label ? styles.zoneChipOn : null]}
                    onPress={() => {
                      setNationalSelected(false);
                      setZoneLabel(label);
                    }}
                  >
                    <Text style={styles.zoneChipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {orphanLabels.length > 0 ? (
                <View style={styles.orphanBlock}>
                  <Text style={styles.orphanTitle}>Wilayah Lainnya</Text>
                  <View style={styles.zoneChips}>
                    {orphanLabels.map((label) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.zoneChip, zoneLabel === label ? styles.zoneChipOn : null]}
                        onPress={() => {
                          setNationalSelected(false);
                          setZoneLabel(label);
                        }}
                      >
                        <Text style={styles.zoneChipText}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
              {!zonePicked ? (
                <Text style={styles.hintWarn}>Pilih wilayah dulu sebelum memilih produk.</Text>
              ) : null}
            </View>
          ) : null}

          {(!zoneGate || zonePicked) && displayProducts.length === 0 ? (
            <EmptyState
              title="Belum Ada Produk"
              message={
                zoneGate
                  ? 'Tidak ada produk untuk wilayah ini.'
                  : 'Produk untuk kategori ini belum tersedia.'
              }
            />
          ) : !zoneGate || zonePicked ? (
            <ProductCatalogGrid
              products={displayProducts}
              columns={2}
              onPress={onSelect}
              isDisabled={(p) => !isProductPurchasable(p) || !phoneReady || !purchaseEnabled}
              renderMeta={(p) =>
                !isProductPurchasable(p) ? <Text style={styles.meta}>Tidak tersedia</Text> : null
              }
            />
          ) : null}
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
  zoneBlock: { gap: spacing.sm },
  zoneTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  zoneHint: { fontSize: typography.size.xs, color: colors.gray[500], lineHeight: 16 },
  zoneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  zoneChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  zoneChipOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  zoneChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
  },
  orphanBlock: { gap: spacing.xs, marginTop: spacing.xs },
  orphanTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
});
