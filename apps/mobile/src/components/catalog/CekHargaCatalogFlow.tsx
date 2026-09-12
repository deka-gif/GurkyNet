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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  catalogService,
  Category,
  CategoryProviderSummary,
  Product,
} from '../../services/catalog.service';
import {
  BrandLogo,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { groupCategoriesForCatalog } from '../../config/catalogGrouping';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';
import { sortProvidersByNameAsc } from '../../utils/sortProvidersByName';
import {
  collectGeographicTelkomselZoneLabels,
  collectOrphanTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';
import { stripGameProductDisplayName } from '../../utils/stripGameProductDisplayName';

/**
 * Cek Harga — read-only price browser (no Beli / checkout / PIN).
 * Reuses GET /categories, /products/providers, /products (surface=mobile).
 * Detail opens a bottom sheet; Back / backdrop / Android back only dismiss the sheet.
 */

type ZoneFilter = 'all' | 'national' | string;

type SelectOption = { value: string; label: string };

function FilterSelect({
  label,
  valueLabel,
  onPress,
}: {
  label: string;
  valueLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.selectBtn, pressed && styles.pressed]}
      >
        <Text style={styles.selectText} numberOfLines={1}>
          {valueLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.gray[500]} />
      </Pressable>
    </View>
  );
}

function productDisplayName(product: Product, categorySlug: string): string {
  const brand = product.operatorName || product.providerDetails?.name || '';
  if (product.category === 'game' || categorySlug === 'game') {
    return stripGameProductDisplayName(product.name, brand);
  }
  return product.name;
}

export function CekHargaCatalogFlow() {
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [categorySlug, setCategorySlug] = useState('');
  const [providers, setProviders] = useState<CategoryProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerId, setProviderId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('all');

  const [picker, setPicker] = useState<'category' | 'provider' | 'zone' | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const categoryOptions = useMemo((): SelectOption[] => {
    const ordered = groupCategoriesForCatalog(categories).flatMap((s) => s.categories);
    return [
      { value: '', label: 'Semua Kategori' },
      ...ordered.map((c) => ({ value: c.slug, label: c.name })),
    ];
  }, [categories]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.providerId === providerId) ?? null,
    [providers, providerId]
  );

  const isVoucherInternet = categorySlug === 'voucher-internet';
  const isTelkomselProvider = !!selectedProvider && isTelkomselOperator(selectedProvider.name);
  const showZoneFilter =
    isVoucherInternet && isTelkomselProvider && telkomselNeedsZoneGate(products);

  const zoneLabels = useMemo(
    () => (showZoneFilter ? collectGeographicTelkomselZoneLabels(products) : []),
    [showZoneFilter, products]
  );
  const orphanLabels = useMemo(
    () => (showZoneFilter ? collectOrphanTelkomselZoneLabels(products) : []),
    [showZoneFilter, products]
  );

  const zoneOptions = useMemo((): SelectOption[] => {
    if (!showZoneFilter) return [];
    const opts: SelectOption[] = [{ value: 'all', label: 'Semua' }];
    if (telkomselNationalProducts(products).length > 0) {
      opts.push({ value: 'national', label: 'Nasional' });
    }
    for (const label of zoneLabels) {
      opts.push({ value: label, label });
    }
    for (const label of orphanLabels) {
      opts.push({ value: label, label: `${label} (Wilayah Lainnya)` });
    }
    return opts;
  }, [showZoneFilter, products, zoneLabels, orphanLabels]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const res = await catalogService.getCategories();
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      } else {
        setCategories([]);
        setCategoriesError(res.message || 'Gagal memuat kategori.');
      }
    } catch (err: any) {
      setCategories([]);
      setCategoriesError(err?.message || 'Gagal memuat kategori.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadProviders = useCallback(async (slug: string) => {
    if (!slug) {
      setProviders([]);
      setProviderId(null);
      return;
    }
    setProvidersLoading(true);
    try {
      const res = await catalogService.getCategoryProviders(slug);
      if (res.success && Array.isArray(res.data)) {
        setProviders(sortProvidersByNameAsc(res.data));
      } else {
        setProviders([]);
      }
    } catch {
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (slug: string, pid: number | null) => {
    if (!slug) {
      setProducts([]);
      setProductsError(null);
      return;
    }
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await catalogService.getProducts({
        category: slug,
        ...(pid != null ? { provider_id: pid } : {}),
        per_page: 5000,
      });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data.filter((p) => isCatalogListed(p) && isProductPurchasable(p)));
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
  }, []);

  useEffect(() => {
    setProviderId(null);
    setZoneFilter('all');
    void loadProviders(categorySlug);
  }, [categorySlug, loadProviders]);

  useEffect(() => {
    setZoneFilter('all');
    void loadProducts(categorySlug, providerId);
  }, [categorySlug, providerId, loadProducts]);

  const visibleProducts = useMemo(() => {
    let list = products;

    if (showZoneFilter && zoneFilter === 'national') {
      list = telkomselNationalProducts(list);
    } else if (showZoneFilter && zoneFilter !== 'all') {
      list = filterProductsByZoneLabel(list, zoneFilter);
    }

    const q = keyword.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [p.name, p.code, p.operatorName, p.quota, p.validity, p.zoneLabel, p.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return sortProductsByPriceAsc(list);
  }, [products, showZoneFilter, zoneFilter, keyword]);

  const providerOptions = useMemo((): SelectOption[] => {
    if (!categorySlug || providers.length === 0) return [];
    return [
      { value: '', label: 'Semua Provider' },
      ...providers.map((p) => ({ value: String(p.providerId), label: p.name })),
    ];
  }, [categorySlug, providers]);

  const showProviderFilter = categorySlug !== '' && providers.length > 0;

  const closeDetail = () => setDetailProduct(null);

  const pickerOptions: SelectOption[] =
    picker === 'category'
      ? categoryOptions
      : picker === 'provider'
        ? providerOptions
        : picker === 'zone'
          ? zoneOptions
          : [];

  const onPick = (value: string) => {
    if (picker === 'category') {
      setCategorySlug(value);
    } else if (picker === 'provider') {
      setProviderId(value === '' ? null : Number(value));
    } else if (picker === 'zone') {
      setZoneFilter(value as ZoneFilter);
    }
    setPicker(null);
  };

  const categoryLabel =
    categoryOptions.find((o) => o.value === categorySlug)?.label || 'Semua Kategori';
  const providerLabel =
    providerId == null
      ? 'Semua Provider'
      : selectedProvider?.name || 'Semua Provider';
  const zoneLabel =
    zoneOptions.find((o) => o.value === zoneFilter)?.label || 'Semua';

  if (categoriesLoading && categories.length === 0) {
    return <LoadingState label="Memuat kategori..." />;
  }

  if (categoriesError && categories.length === 0) {
    return <ErrorState message={categoriesError} onRetry={loadCategories} />;
  }

  const detailName = detailProduct
    ? productDisplayName(detailProduct, categorySlug)
    : '';
  const detailDesc = detailProduct?.description?.trim() || '';
  const detailMeta = detailProduct
    ? [detailProduct.quota, detailProduct.validity, detailProduct.zoneLabel]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.gray[400]} style={styles.searchIcon} />
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Cari produk..."
          placeholderTextColor={colors.gray[400]}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <FilterSelect
        label="Kategori"
        valueLabel={categoryLabel}
        onPress={() => setPicker('category')}
      />

      {showProviderFilter ? (
        <FilterSelect
          label="Provider / Brand"
          valueLabel={providersLoading ? 'Memuat...' : providerLabel}
          onPress={() => !providersLoading && setPicker('provider')}
        />
      ) : null}

      {showZoneFilter ? (
        <FilterSelect label="Zona" valueLabel={zoneLabel} onPress={() => setPicker('zone')} />
      ) : null}

      <Text style={styles.sectionHeading}>Produk</Text>

      {!categorySlug ? (
        <EmptyState
          title="Pilih Kategori"
          message="Pilih kategori di atas untuk melihat daftar produk dan harga."
        />
      ) : productsLoading ? (
        <LoadingState label="Memuat produk..." />
      ) : productsError ? (
        <ErrorState
          message={productsError}
          onRetry={() => void loadProducts(categorySlug, providerId)}
        />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          title="Tidak Ada Produk"
          message={
            keyword.trim()
              ? 'Tidak ada produk yang cocok dengan pencarian.'
              : 'Belum ada produk untuk filter ini.'
          }
        />
      ) : (
        <View style={styles.list}>
          {visibleProducts.map((product) => {
            const brand = product.operatorName || product.providerDetails?.name || '';
            const name = productDisplayName(product, categorySlug);
            return (
              <Pressable
                key={product.code}
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${formatIDR(product.price)}. Lihat detail`}
                onPress={() => setDetailProduct(product)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                {brand ? (
                  <BrandLogo
                    name={brand}
                    logo={product.providerDetails?.logo}
                    size={36}
                    style={styles.rowLogo}
                  />
                ) : (
                  <View style={[styles.rowLogo, styles.rowLogoPlaceholder]} />
                )}
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={styles.rowDetailLink}>Lihat detail</Text>
                </View>
                <Text style={styles.rowPrice}>{formatIDR(product.price)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Filter picker */}
      <Modal
        visible={picker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {picker === 'category'
                ? 'Pilih Kategori'
                : picker === 'provider'
                  ? 'Pilih Provider'
                  : 'Pilih Zona'}
            </Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalList}>
                {pickerOptions.map((opt) => {
                  const active =
                    picker === 'category'
                      ? opt.value === categorySlug
                      : picker === 'provider'
                        ? (opt.value === '' && providerId == null) ||
                          opt.value === String(providerId ?? '')
                        : opt.value === zoneFilter;
                  return (
                    <TouchableOpacity
                      key={`${picker}-${opt.value}`}
                      activeOpacity={0.7}
                      onPress={() => onPick(opt.value)}
                      style={[styles.modalRow, active && styles.modalRowActive]}
                    >
                      <Text
                        style={[styles.modalRowText, active && styles.modalRowTextActive]}
                        numberOfLines={2}
                      >
                        {opt.label}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary[600]} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Product detail sheet — dismiss only; stays on Cek Harga */}
      <Modal
        visible={detailProduct != null}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View style={styles.detailFlex}>
          <Pressable style={styles.detailBackdrop} onPress={closeDetail} />
          <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.detailHandle} />
            <Text style={styles.detailTitle}>Detail Produk</Text>
            {detailProduct ? (
              <>
                <Text style={styles.detailName}>{detailName}</Text>
                {detailDesc ? <Text style={styles.detailDesc}>{detailDesc}</Text> : null}
                {detailMeta ? <Text style={styles.detailMeta}>{detailMeta}</Text> : null}
                <View style={styles.detailPriceBlock}>
                  <Text style={styles.detailPriceLabel}>Harga</Text>
                  <Text style={styles.detailPriceValue}>{formatIDR(detailProduct.price)}</Text>
                </View>
              </>
            ) : null}
            <Button label="Back" variant="secondary" onPress={closeDetail} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  pressed: { opacity: 0.72 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    color: colors.gray[900],
  },
  field: { gap: spacing.xs },
  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  selectText: {
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
  },
  sectionHeading: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  list: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    minHeight: 56,
  },
  rowLogo: { flexShrink: 0 },
  rowLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.gray[100],
  },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
    lineHeight: 18,
  },
  rowDetailLink: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.medium,
  },
  rowPrice: {
    flexShrink: 0,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginLeft: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  modalScroll: { maxHeight: 420 },
  modalList: { gap: spacing.xs },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  modalRowActive: {
    backgroundColor: colors.primary[50],
  },
  modalRowText: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.gray[800],
    paddingRight: spacing.sm,
  },
  modalRowTextActive: {
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  detailFlex: { flex: 1, justifyContent: 'flex-end' },
  detailBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  detailSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[200],
    marginBottom: spacing.xs,
  },
  detailTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  detailName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  detailDesc: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  detailMeta: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    textAlign: 'center',
  },
  detailPriceBlock: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  detailPriceLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
  },
  detailPriceValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
});
