import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { tagihanService, TagihanInquiryResult } from '../../services/tagihan.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { CATALOG_FETCH } from '../../config/catalogFetchLimits';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  PurchaseFlowNotice,
  Button,
} from '../ui';
import { TagihanBrandList } from './TagihanBrandList';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import {
  groupTagihanBrandsByProductName,
  resolveTagihanBrandSelection,
  type TagihanBrandGroup,
} from '../../utils/tagihanBrandGrouping';
import {
  composePbbCustomerNo,
  isValidPbbNop,
  isValidTaxYear,
  sanitizePbbNop,
  taxYearOptions,
} from '../../utils/pajakCustomerNo';
import {
  shouldClearTagihanInquiryOnIdentifierEdit,
  shouldClearTagihanInquiryOnTaxYearEdit,
} from '../../utils/tagihanCheckout';
import { parseApiError } from '../../api/client';

/**
 * Mobile PBB (NOP_YEAR) — dedicated Option B flow.
 * Wilayah tiles (product.name, no catalog price) → NOP + Tahun Pajak → inquiry → review → PIN.
 * Does NOT use TagihanBillCatalogFlow / BRAND_FIRST_CATEGORIES.
 */

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

type Props = {
  purchaseBanner?: string | null;
};

type Step = 'regions' | 'input' | 'review';

function isPayableAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function PajakPbbCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const beginTagihanCheckout = useCheckoutStore((s) => s.beginTagihanCheckout);
  const clearTagihanContext = useCheckoutStore((s) => s.clearTagihanContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);

  const yearOptions = useMemo(() => taxYearOptions(6), []);

  const [step, setStep] = useState<Step>('regions');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [nop, setNop] = useState('');
  const [tahunPajak, setTahunPajak] = useState<number>(() => new Date().getFullYear());
  const [inquiredNop, setInquiredNop] = useState<string | null>(null);
  const [inquiredYear, setInquiredYear] = useState<number | null>(null);
  const [inquiring, setInquiring] = useState(false);
  const [inquiry, setInquiry] = useState<TagihanInquiryResult | null>(null);

  const invalidateInquirySession = useCallback(() => {
    setInquiry(null);
    setInquiredNop(null);
    setInquiredYear(null);
    clearTagihanContext();
  }, [clearTagihanContext]);

  const goBackStep = useCallback(() => {
    if (step === 'review') {
      invalidateInquirySession();
      setStep('input');
      return;
    }
    if (step === 'input') {
      setError(null);
      setSelected(null);
      invalidateInquirySession();
      setNop('');
      setTahunPajak(new Date().getFullYear());
      setStep('regions');
    }
  }, [step, invalidateInquirySession]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step === 'regions') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, step, goBackStep]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category: 'pbb', per_page: CATALOG_FETCH.SMALL_CATEGORY });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setError(res.message || 'Gagal memuat produk PBB.');
        setProducts([]);
      }
    } catch (err: unknown) {
      setError(parseApiError(err).message || 'Gagal memuat produk PBB.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const listed = useMemo(
    () => products.filter((p) => isCatalogListed(p) && isProductPurchasable(p)),
    [products]
  );

  const brands = useMemo(() => groupTagihanBrandsByProductName(listed), [listed]);

  const formReady =
    isValidPbbNop(nop) && isValidTaxYear(tahunPajak, yearOptions) && !!selected;

  const onSelectBrand = (brand: TagihanBrandGroup) => {
    if (!purchaseEnabled) return;
    const resolved = resolveTagihanBrandSelection(brand);
    if (!resolved.ok) {
      setError(
        resolved.reason === 'empty'
          ? 'Wilayah tidak memiliki produk yang dapat dibeli.'
          : 'Wilayah tidak dapat dipilih otomatis. Hubungi dukungan.'
      );
      return;
    }
    setError(null);
    setSelected(resolved.product);
    invalidateInquirySession();
    setNop('');
    setTahunPajak(new Date().getFullYear());
    setStep('input');
  };

  const onNopChange = (raw: string) => {
    const next = sanitizePbbNop(raw);
    setNop(next);
    if (shouldClearTagihanInquiryOnIdentifierEdit(inquiredNop, next)) {
      invalidateInquirySession();
    }
  };

  const onYearChange = (year: number) => {
    setTahunPajak(year);
    if (shouldClearTagihanInquiryOnTaxYearEdit(inquiredYear, year)) {
      invalidateInquirySession();
    }
  };

  const onInquire = async () => {
    if (!selected || !formReady) return;
    if (!isValidPbbNop(nop) || !isValidTaxYear(tahunPajak, yearOptions)) {
      setError('Lengkapi NOP dan Tahun Pajak.');
      return;
    }

    const customerNo = composePbbCustomerNo(nop);
    setInquiring(true);
    setError(null);
    try {
      const res = await tagihanService.inquire(selected.code, customerNo, tahunPajak);
      if (!res.success || !res.data?.inquiry_ref_id) {
        invalidateInquirySession();
        setError(res.message || 'Inquiry gagal. Periksa NOP dan Tahun Pajak.');
        return;
      }
      if (!isPayableAmount(res.data.selling_price)) {
        invalidateInquirySession();
        setError('Inquiry berhasil tetapi nominal tagihan tidak valid.');
        return;
      }
      setInquiry(res.data);
      setInquiredNop(customerNo);
      setInquiredYear(tahunPajak);
      setStep('review');
    } catch (err: unknown) {
      invalidateInquirySession();
      setError(parseApiError(err).message || 'Inquiry gagal.');
    } finally {
      setInquiring(false);
    }
  };

  const onPay = () => {
    if (!selected || !inquiry?.inquiry_ref_id || !isPayableAmount(inquiry.selling_price)) return;
    beginTagihanCheckout(
      selected,
      inquiry,
      Date.now() + (inquiry.expires_in_seconds || 20 * 60) * 1000
    );
    router.push({ pathname: '/checkout/[sku]', params: { sku: selected.code } });
  };

  if (loading && products.length === 0) {
    return <LoadingState label="Memuat wilayah PBB..." />;
  }

  if (error && products.length === 0 && step === 'regions') {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (step === 'input' && selected) {
    return (
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
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
        <Text style={styles.productName}>{selected.name}</Text>

        <Text style={styles.label}>Nomor Objek Pajak (NOP)</Text>
        <TextInput
          style={styles.input}
          value={nop}
          onChangeText={onNopChange}
          placeholder="15–18 digit NOP"
          placeholderTextColor={colors.gray[400]}
          keyboardType="number-pad"
          maxLength={18}
          editable={purchaseEnabled && !inquiring}
        />

        <Text style={styles.label}>Tahun Pajak</Text>
        <View style={styles.yearRow}>
          {yearOptions.map((y) => {
            const active = y === tahunPajak;
            return (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, active && styles.yearChipActive]}
                onPress={() => onYearChange(y)}
                disabled={!purchaseEnabled || inquiring}
              >
                <Text style={[styles.yearText, active && styles.yearTextActive]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={inquiring ? 'Cek tagihan...' : 'Cek Tagihan'}
          onPress={() => void onInquire()}
          disabled={inquiring || !formReady || !purchaseEnabled}
        />
      </ScrollView>
    );
  }

  if (step === 'review' && selected && inquiry) {
    const tax = inquiry.tax_details || {};
    return (
      <View style={styles.wrap}>
        <Text style={styles.productName}>{inquiry.product_name || selected.name}</Text>
        <Text style={styles.meta}>Pemilik: {inquiry.customer_name || '-'}</Text>
        <Text style={styles.meta}>NOP: {tax.nop || inquiry.customer_no}</Text>
        <Text style={styles.meta}>Tahun Pajak: {tax.tahun_pajak || String(tahunPajak)}</Text>
        <Text style={styles.meta}>Periode: {inquiry.periode || '-'}</Text>
        <Text style={styles.price}>{formatIDR(inquiry.selling_price)}</Text>
        <Button
          label="Lanjut Bayar (PIN)"
          onPress={onPay}
          disabled={!purchaseEnabled || !isPayableAmount(inquiry.selling_price)}
        />
      </View>
    );
  }

  if (listed.length === 0) {
    return <EmptyState title="Belum Ada Wilayah" message="Produk PBB belum tersedia." />;
  }

  if (brands.length === 0) {
    return <EmptyState title="Belum Ada Wilayah" message="Wilayah PBB belum tersedia." />;
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
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TagihanBrandList brands={brands} onPress={onSelectBrand} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, gap: spacing.md, paddingBottom: spacing.lg },
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
  yearRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  yearChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#fff',
  },
  yearChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  yearText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  yearTextActive: {
    color: colors.primary[700],
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
