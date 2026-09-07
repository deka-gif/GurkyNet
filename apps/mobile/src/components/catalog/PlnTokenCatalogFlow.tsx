import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { isValidPlnMeter, plnMeterError, sanitizePlnMeter, friendlyPlnInquiryError } from '../../utils/plnMeter';
import { sortProductsByPriceAsc } from '../../utils/sortProductsByPrice';

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
  const [balancePopupVisible, setBalancePopupVisible] = useState(false);

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
    return sortProductsByPriceAsc(products.filter((p) => isCatalogListed(p)));
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
        setInquiryError(friendlyPlnInquiryError(res.message));
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
      setInquiryError(friendlyPlnInquiryError(fieldMsg));
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
      setBalancePopupVisible(true);
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

  const canConfirm =
    inquiryReady &&
    !!selected &&
    isProductPurchasable(selected) &&
    purchaseEnabled;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          <ProductCatalogGrid
            products={displayProducts}
            columns={2}
            selectedCode={selected?.code ?? null}
            onPress={setSelected}
            isDisabled={(p) => !isProductPurchasable(p)}
            renderMeta={(p) =>
              !isProductPurchasable(p) ? (
                <Text style={styles.maint}>Sedang maintenance</Text>
              ) : (
                <Text style={styles.productTag}>PLN Prabayar</Text>
              )
            }
          />
        )}

        {/* Spacer so last products are not hidden behind sticky bar */}
        {canConfirm ? <View style={styles.stickySpacer} /> : null}
      </ScrollView>

      {canConfirm ? (
        <View style={styles.stickyBar}>
          <Text style={styles.stickyMeta} numberOfLines={1}>
            {selected!.name} · {formatIDR(selected!.price)}
          </Text>
          <Button label="Lanjut Konfirmasi" onPress={handleBeli} />
        </View>
      ) : null}

      <Modal
        visible={balancePopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBalancePopupVisible(false)}
      >
        <Pressable style={styles.popupBackdrop} onPress={() => setBalancePopupVisible(false)}>
          <Pressable style={styles.popupCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.popupIconWrap}>
              <Ionicons name="wallet-outline" size={28} color={colors.status.failed} />
            </View>
            <Text style={styles.popupTitle}>Saldo GurkyPay Kurang</Text>
            <Text style={styles.popupMessage}>
              Saldo tidak cukup untuk membeli {selected?.name || 'token PLN'} (
              {selected ? formatIDR(selected.price) : '—'}). Silakan isi ulang saldo.
            </Text>
            <Button label="Mengerti" onPress={() => setBalancePopupVisible(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
  stickySpacer: { height: 110 },
  stickyBar: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  stickyMeta: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.gray[600],
    textAlign: 'center',
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  popupCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  popupIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.status.failedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    textAlign: 'center',
  },
  popupMessage: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
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
  productTag: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.gray[400],
    textTransform: 'uppercase',
  },
  maint: { fontSize: typography.size.xs, color: colors.status.pending, fontWeight: typography.weight.bold },
});
