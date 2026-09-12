import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { tagihanService, TagihanInquiryResult } from '../../services/tagihan.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  PurchaseFlowNotice,
  Button,
} from '../ui';
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { TagihanBrandList } from './TagihanBrandList';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';
import {
  groupTagihanBrandsByProductName,
  resolvePlnBillDirectSku,
  resolveTagihanBrandSelection,
  type TagihanBrandGroup,
} from '../../utils/tagihanBrandGrouping';
import {
  isTagihanBillDirectInputCategory,
  isTagihanBrandFirstCategory,
} from '../../utils/tagihanFlowMode';
import { shouldClearTagihanInquiryOnIdentifierEdit } from '../../utils/tagihanCheckout';
import { parseApiError } from '../../api/client';

/**
 * Mobile postpaid bill flow — mirrors Web BillPaymentFlow.
 *
 * Brand-first: `tv-pascabayar`, `pdam`, `internet-pascabayar`, `multifinance`, `bpjs-tk`.
 * Direct-input (no brand tile): `pln-pascabayar`, `pln-nontaglis`, `bpjs-kesehatan`, `gas`.
 * PBB uses dedicated PajakPbbCatalogFlow. Token PLN (`pln`) stays on PlnTokenCatalogFlow.
 *
 * Brand-first navigation: header/hardware back steps brand list ↔ identifier ↔ review
 * (same beforeRemove pattern as ProviderCatalogBrowseFlow). No body "Ganti produk".
 */

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

type Props = {
  category: string;
  purchaseBanner?: string | null;
  targetLabel?: string;
  targetPlaceholder?: string;
};

type Step = 'products' | 'denoms' | 'input' | 'review';

export function TagihanBillCatalogFlow({
  category,
  purchaseBanner,
  targetLabel = 'Nomor / ID Pelanggan',
  targetPlaceholder = 'Masukkan nomor pelanggan',
}: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const beginTagihanCheckout = useCheckoutStore((s) => s.beginTagihanCheckout);
  const clearTagihanContext = useCheckoutStore((s) => s.clearTagihanContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const brandFirst = isTagihanBrandFirstCategory(category);
  const directInput = isTagihanBillDirectInputCategory(category);
  /** Owner-scoped: strip Digi trailing bill amounts only for TV Pascabayar brand tiles. */
  const tvStripNominal = category.trim().toLowerCase() === 'tv-pascabayar';

  const [step, setStep] = useState<Step>(directInput ? 'input' : 'products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<TagihanBrandGroup | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [customerNo, setCustomerNo] = useState('');
  /** Identifier used for the current local inquiry session (mirror Token PLN inquiredFor). */
  const [inquiredFor, setInquiredFor] = useState<string | null>(null);
  const [inquiring, setInquiring] = useState(false);
  const [inquiry, setInquiry] = useState<TagihanInquiryResult | null>(null);

  const invalidateInquirySession = useCallback(() => {
    setInquiry(null);
    setInquiredFor(null);
    clearTagihanContext();
  }, [clearTagihanContext]);

  /** Brand-first: review → input → denoms (if any) → brand list. */
  const goBackBrandFirstStep = useCallback(() => {
    if (step === 'review') {
      invalidateInquirySession();
      setStep('input');
      return;
    }
    if (step === 'input') {
      setError(null);
      setSelected(null);
      invalidateInquirySession();
      setCustomerNo('');
      if (selectedBrand?.hasDistinctProductNames) {
        setStep('denoms');
        return;
      }
      setSelectedBrand(null);
      setStep('products');
      return;
    }
    if (step === 'denoms') {
      setError(null);
      setSelectedBrand(null);
      setSelected(null);
      setStep('products');
    }
  }, [step, selectedBrand, invalidateInquirySession]);

  useEffect(() => {
    if (!brandFirst) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step === 'products') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackBrandFirstStep();
    });
    return unsub;
  }, [navigation, brandFirst, step, goBackBrandFirstStep]);

  /** Direct-input: review → meter; meter leaves the screen via header back (no product picker). */
  const goBackDirectInputStep = useCallback(() => {
    if (step === 'review') {
      invalidateInquirySession();
      setStep('input');
    }
  }, [step, invalidateInquirySession]);

  useEffect(() => {
    if (!directInput) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step !== 'review') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackDirectInputStep();
    });
    return unsub;
  }, [navigation, directInput, step, goBackDirectInputStep]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category, per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk tagihan.');
        setProducts([]);
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal memuat produk tagihan.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  const listed = useMemo(
    () =>
      sortProductsByPriceAsc(
        products.filter((p) => isCatalogListed(p) && isProductPurchasable(p))
      ),
    [products]
  );

  const brands = useMemo(
    () =>
      brandFirst
        ? groupTagihanBrandsByProductName(listed, {
            stripTrailingNominal: tvStripNominal,
          })
        : [],
    [brandFirst, listed, tvStripNominal]
  );

  const denomProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return sortProductsByPriceAsc(selectedBrand.products);
  }, [selectedBrand]);

  /** Auto-bind catalog SKU for PLN bill direct-input; fail-closed on Digi duplicates. */
  useEffect(() => {
    if (!directInput || loading) return;
    if (selected) return;

    const resolved = resolvePlnBillDirectSku(listed);
    if (resolved.ok) {
      setSelected(resolved.product);
      setStep('input');
      setError(null);
      return;
    }
    if (resolved.reason === 'empty') {
      setError(null);
      return;
    }
    setError(
      'Kategori ini memiliki lebih dari satu jenis produk dan belum dapat dipilih otomatis. Hubungi dukungan.'
    );
  }, [directInput, loading, listed, selected]);

  const onSelectProduct = (product: Product) => {
    if (!purchaseEnabled) return;
    setSelected(product);
    invalidateInquirySession();
    setCustomerNo('');
    setError(null);
    setStep('input');
  };

  const onSelectBrand = (brand: TagihanBrandGroup) => {
    if (!purchaseEnabled) return;
    setError(null);
    // Multi Digi product_name under one brand tile (TV K-Vision nominals) → pick denom first.
    if (brand.hasDistinctProductNames) {
      setSelectedBrand(brand);
      setSelected(null);
      invalidateInquirySession();
      setCustomerNo('');
      setStep('denoms');
      return;
    }
    const resolved = resolveTagihanBrandSelection(brand);
    if (!resolved.ok) {
      setError(
        resolved.reason === 'empty'
          ? 'Brand tidak memiliki produk yang dapat dibeli.'
          : 'Brand tidak dapat dipilih otomatis. Hubungi dukungan.'
      );
      return;
    }
    setSelectedBrand(brand);
    onSelectProduct(resolved.product);
  };

  const onCustomerNoChange = (value: string) => {
    setCustomerNo(value);
    if (shouldClearTagihanInquiryOnIdentifierEdit(inquiredFor, value)) {
      invalidateInquirySession();
    }
  };

  const onInquire = async () => {
    if (!selected || !customerNo.trim()) return;
    setInquiring(true);
    setError(null);
    try {
      const typed = customerNo.trim();
      const res = await tagihanService.inquire(selected.code, typed);
      if (!res.success || !res.data?.inquiry_ref_id) {
        invalidateInquirySession();
        setError(res.message || 'Inquiry gagal. Periksa nomor pelanggan.');
        return;
      }
      setInquiry(res.data);
      setInquiredFor(typed);
      setStep('review');
    } catch (err: unknown) {
      invalidateInquirySession();
      setError(parseApiError(err).message || 'Inquiry gagal.');
    } finally {
      setInquiring(false);
    }
  };

  const onPay = () => {
    if (!selected || !inquiry?.inquiry_ref_id) return;
    beginTagihanCheckout(
      selected,
      inquiry,
      Date.now() + (inquiry.expires_in_seconds || 20 * 60) * 1000
    );
    router.push({ pathname: '/checkout/[sku]', params: { sku: selected.code } });
  };

  if (loading && products.length === 0) {
    return <LoadingState label="Memuat produk..." />;
  }

  if (directInput && loading && !selected) {
    return <LoadingState label="Memuat produk..." />;
  }

  if (directInput && !loading && !selected) {
    if (listed.length === 0) {
      return <EmptyState title="Belum Ada Produk" message="Produk tagihan belum tersedia." />;
    }
    return (
      <ErrorState
        message={
          error ||
          'Kategori ini memiliki lebih dari satu jenis produk dan belum dapat dipilih otomatis. Hubungi dukungan.'
        }
        onRetry={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  if (error && products.length === 0 && step === 'products') {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (step === 'denoms' && selectedBrand) {
    return (
      <View style={styles.wrap}>
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}
        {!purchaseEnabled ? (
          <PurchaseFlowNotice
            icon="time-outline"
            title="Pembelian Belum Aktif"
            message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
          />
        ) : null}
        <Text style={styles.productName}>{selectedBrand.label}</Text>
        <Text style={styles.label}>Pilih nominal / produk</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ProductCatalogGrid products={denomProducts} onPress={onSelectProduct} columns={2} />
      </View>
    );
  }

  if (step === 'input' && selected) {
    return (
      <View style={styles.wrap}>
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}
        {!purchaseEnabled ? (
          <PurchaseFlowNotice
            icon="time-outline"
            title="Pembelian Belum Aktif"
            message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
          />
        ) : null}
        {/* Product-first Tagihan: body back to product grid. Brand-first / PLN direct: header back only. */}
        {!brandFirst && !directInput ? (
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setStep('products');
            }}
            style={styles.back}
          >
            <Text style={styles.backText}>← Ganti produk</Text>
          </TouchableOpacity>
        ) : null}
        {!directInput ? <Text style={styles.productName}>{selected.name}</Text> : null}
        <Text style={styles.label}>{targetLabel}</Text>
        <TextInput
          style={styles.input}
          value={customerNo}
          onChangeText={onCustomerNoChange}
          placeholder={targetPlaceholder}
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="characters"
          keyboardType={directInput ? 'number-pad' : 'default'}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={inquiring ? 'Cek tagihan...' : 'Cek Tagihan'}
          onPress={() => void onInquire()}
          disabled={inquiring || !customerNo.trim() || !purchaseEnabled}
        />
      </View>
    );
  }

  if (step === 'review' && selected && inquiry) {
    return (
      <View style={styles.wrap}>
        {!directInput ? (
          <TouchableOpacity
            onPress={() => {
              invalidateInquirySession();
              setStep('input');
            }}
            style={styles.back}
          >
            <Text style={styles.backText}>← Ubah nomor</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.productName}>{inquiry.product_name || selected.name}</Text>
        <Text style={styles.meta}>Pelanggan: {inquiry.customer_name || '-'}</Text>
        <Text style={styles.meta}>ID: {inquiry.customer_no}</Text>
        <Text style={styles.meta}>Periode: {inquiry.periode || '-'}</Text>
        <Text style={styles.price}>{formatIDR(inquiry.selling_price)}</Text>
        <Button label="Lanjut Bayar (PIN)" onPress={onPay} disabled={!purchaseEnabled} />
      </View>
    );
  }

  if (listed.length === 0) {
    return <EmptyState title="Belum Ada Produk" message="Produk tagihan belum tersedia." />;
  }

  if (brandFirst && brands.length === 0) {
    return <EmptyState title="Belum Ada Brand" message="Brand tagihan belum tersedia." />;
  }

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}
      {!purchaseEnabled ? (
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
        />
      ) : brandFirst ? (
        <>
          {category.trim().toLowerCase() === 'bpjs-tk' ? (
            <Text style={styles.label}>Pilih jenis kepesertaan</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TagihanBrandList brands={brands} onPress={onSelectBrand} />
        </>
      ) : (
        <ProductCatalogGrid products={listed} onPress={onSelectProduct} columns={2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  banner: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bannerText: {
    fontSize: typography.size.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  back: { paddingVertical: spacing.xs },
  backText: {
    fontSize: typography.size.sm,
    color: colors.primary[600],
    fontWeight: typography.weight.bold,
  },
  productName: {
    fontSize: typography.size.md,
    color: colors.gray[900],
    fontWeight: typography.weight.black,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    fontWeight: typography.weight.bold,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.base,
    color: colors.gray[900],
    backgroundColor: '#fff',
  },
  error: { fontSize: typography.size.xs, color: '#b91c1c' },
  meta: { fontSize: typography.size.xs, color: colors.gray[600] },
  price: {
    fontSize: typography.size.xl,
    color: colors.primary[700],
    fontWeight: typography.weight.black,
    marginVertical: spacing.sm,
  },
});
