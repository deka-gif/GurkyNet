import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import { plnService, PlnInquiryResult } from '../../services/pln.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { useWalletStore } from '../../store/wallet.store';
import { parseApiError } from '../../api/client';
import {
  Card,
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  PurchaseFlowNotice,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPlnMeter, plnMeterError, sanitizePlnMeter } from '../../utils/plnMeter';

/**
 * Mobile Token PLN prepaid — mirrors Web TokenPlnPage:
 * meter 11–12 → POST /pln/inquiry → show name/daya → pick product (category=pln)
 * → confirmation → PIN → POST /transactions (target = inquiry.customer_no, no inquiry_ref_id).
 */

type Props = {
  purchaseBanner?: string | null;
};

export function PlnTokenCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [meter, setMeter] = useState('');
  const [inquiry, setInquiry] = useState<PlnInquiryResult | null>(null);
  const [inquiredFor, setInquiredFor] = useState<string | null>(null);
  const [inquiring, setInquiring] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const meterValid = isValidPlnMeter(meter);
  const meterErr = meter.length > 0 ? plnMeterError(meter) : null;

  // Same as Web: inquiryReady requires inquiredFor === typed meter AND customer_name.
  const inquiryReady =
    !!inquiry && inquiredFor === meter && !!inquiry.customer_name;

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await catalogService.getProducts({ category: 'pln', per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
        setProductsError(res.message || 'Gagal memuat produk token PLN.');
      }
    } catch (err: any) {
      setProducts([]);
      setProductsError(err?.message || 'Gagal memuat produk token PLN.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const displayProducts = useMemo(() => {
    return products
      .filter((p) => isCatalogListed(p))
      .slice()
      .sort((a, b) => a.price - b.price);
  }, [products]);

  const onMeterChange = (value: string) => {
    const next = sanitizePlnMeter(value);
    setMeter(next);
    setSelected(null);
    setInquiryError(null);
    if (inquiredFor && inquiredFor !== next) {
      setInquiry(null);
      setInquiredFor(null);
    }
  };

  const handleCekMeteran = async () => {
    setInquiryError(null);
    if (!meterValid) {
      setInquiryError(plnMeterError(meter) || 'Masukkan 11–12 digit Nomor Meter / ID Pelanggan PLN.');
      return;
    }
    if (!purchaseEnabled) {
      setInquiryError(purchaseBanner || 'Pembelian belum aktif.');
      return;
    }

    setInquiring(true);
    setSelected(null);
    try {
      const res = await plnService.inquire(meter);
      if (!res.success || !res.data) {
        setInquiry(null);
        setInquiredFor(null);
        setInquiryError(res.message || 'Gagal cek meteran. Silakan coba lagi.');
        return;
      }
      setInquiry(res.data);
      setInquiredFor(meter);
    } catch (err: any) {
      setInquiry(null);
      setInquiredFor(null);
      const parsed = parseApiError(err);
      const fieldMsg =
        parsed.errors?.inquiry?.[0] ||
        parsed.errors?.customer_no?.[0] ||
        parsed.message;
      setInquiryError(fieldMsg || 'Gagal cek meteran. Silakan coba lagi.');
    } finally {
      setInquiring(false);
    }
  };

  const handleBeli = () => {
    if (!inquiryReady || !inquiry || !selected) return;
    if (!isProductPurchasable(selected)) return;
    if (!purchaseEnabled) return;

    const balance = overview?.wallet?.balance;
    if (typeof balance === 'number' && balance < selected.price) {
      setInquiryError('Saldo GurkyPay Anda tidak mencukupi untuk pembelian token PLN ini.');
      return;
    }

    const expiresAt = Date.now() + Math.max(0, (inquiry.expires_in_seconds || 0) * 1000);
    if (expiresAt <= Date.now()) {
      setInquiry(null);
      setInquiredFor(null);
      setInquiryError('Sesi cek meteran sudah kedaluwarsa. Silakan cek meteran ulang.');
      return;
    }

    startCheckout(selected);
    // Backend session key = resolved customer_no from inquiry (same as Web targetNo).
    setTarget(inquiry.customer_no);
    setPurchaseContext({
      operatorLabel: 'PLN',
      selectedRegion: null,
      plnContext: {
        inquiry,
        inquiredMeter: meter,
        expiresAt,
      },
    });
    router.push({ pathname: '/checkout/[sku]', params: { sku: selected.code } });
  };

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Nomor Meter / ID Pelanggan PLN</Text>
        <TextInput
          value={meter}
          onChangeText={onMeterChange}
          placeholder="11–12 digit angka"
          keyboardType="number-pad"
          placeholderTextColor={colors.gray[400]}
          style={styles.input}
        />
        {meterErr ? <Text style={styles.error}>{meterErr}</Text> : null}
        <Button
          label={inquiring ? 'Mengecek meteran...' : 'Cek Meteran'}
          onPress={() => void handleCekMeteran()}
          disabled={!meterValid || inquiring || !purchaseEnabled}
          loading={inquiring}
        />
        {inquiryError ? <Text style={styles.error}>{inquiryError}</Text> : null}
      </View>

      {!purchaseEnabled ? (
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
        />
      ) : inquiryReady && inquiry ? (
        <Card style={styles.inquiryCard}>
          <Text style={styles.inquiryTitle}>Hasil Pengecekan</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>ID Pelanggan</Text>
            <Text style={styles.rowValue}>{inquiry.customer_no}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Atas Nama</Text>
            <Text style={[styles.rowValue, styles.rowValueUpper]}>{inquiry.customer_name}</Text>
          </View>
          {inquiry.segment_power ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Tarif / Daya</Text>
              <Text style={styles.rowValue}>{inquiry.segment_power}</Text>
            </View>
          ) : null}
          {inquiry.meter_no && inquiry.meter_no !== inquiry.customer_no ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>No. Meter</Text>
              <Text style={styles.rowValue}>{inquiry.meter_no}</Text>
            </View>
          ) : null}
          <Text style={styles.inquiryHint}>
            Pastikan nama pelanggan sudah sesuai sebelum memilih nominal token.
          </Text>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Pilih Nominal Token</Text>

      {!inquiryReady ? (
        <EmptyState
          title="Cek Meteran Dulu"
          message="Pilihan nominal terkunci. Tekan Cek Meteran terlebih dahulu."
        />
      ) : productsLoading && displayProducts.length === 0 ? (
        <LoadingState label="Memuat daftar token PLN..." />
      ) : productsError ? (
        <ErrorState message={productsError} onRetry={loadProducts} />
      ) : displayProducts.length === 0 ? (
        <EmptyState title="Belum Ada Produk" message="Produk token PLN tidak tersedia di katalog." />
      ) : (
        <View style={styles.list}>
          {displayProducts.map((product) => {
            const unavailable = !isProductPurchasable(product);
            const active = selected?.id === product.id;
            return (
              <TouchableOpacity
                key={product.id}
                activeOpacity={0.7}
                disabled={unavailable}
                onPress={() => setSelected(product)}
              >
                <Card style={[styles.productCard, active && styles.productCardActive, unavailable && styles.disabled]}>
                  <Text style={styles.productTag}>PLN Prabayar</Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {unavailable ? <Text style={styles.maint}>Sedang maintenance</Text> : null}
                  <Text style={styles.price}>{formatIDR(product.price)}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {inquiryReady ? (
        <Button
          label="Lanjut Konfirmasi"
          onPress={handleBeli}
          disabled={!selected || !isProductPurchasable(selected) || !purchaseEnabled}
        />
      ) : null}
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
  field: { gap: spacing.sm },
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
    letterSpacing: 1,
  },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
  inquiryCard: {
    gap: spacing.sm,
    backgroundColor: colors.status.successBg,
    borderColor: colors.primary[200],
  },
  inquiryTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: typography.size.xs, color: colors.gray[500], fontWeight: typography.weight.medium },
  rowValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueUpper: { textTransform: 'uppercase' },
  inquiryHint: { fontSize: typography.size.xs, color: colors.primary[700], marginTop: spacing.xs },
  sectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  list: { gap: spacing.sm },
  productCard: { padding: spacing.md, gap: 4 },
  productCardActive: {
    borderColor: colors.accent[500],
    borderWidth: 2,
    backgroundColor: '#fffbeb',
  },
  disabled: { opacity: 0.55 },
  productTag: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.gray[400],
    textTransform: 'uppercase',
  },
  productName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.gray[900] },
  maint: { fontSize: typography.size.xs, color: colors.status.pending, fontWeight: typography.weight.bold },
  price: { fontSize: typography.size.sm, fontWeight: typography.weight.black, color: colors.gray[800], marginTop: spacing.xs },
});
