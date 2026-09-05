import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import { isPlnContextValid, useCheckoutStore } from '../../src/store/checkout.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import {
  ScreenContainer,
  Card,
  Button,
  LoadingState,
  ErrorState,
  PurchaseFlowNotice,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import {
  INQUIRY_FLOW_NOTICE,
  isDirectPurchaseCategory,
  isInquiryRequiredCategory,
  isPhoneTargetCategory,
  isPlnPrepaidCategory,
} from '../../src/utils/purchaseCategory';
import { isValidPhoneTarget, phoneTargetError, sanitizePhoneDigits } from '../../src/utils/targetValidation';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ sku: string }>();
  const sku = typeof params.sku === 'string' ? params.sku : '';
  const router = useRouter();

  const { productDetail, productDetailLoading, productDetailError, fetchProductDetail, clearProductDetail } =
    useCatalogStore();
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const skuCode = useCheckoutStore((s) => s.skuCode);
  const storeCategorySlug = useCheckoutStore((s) => s.categorySlug);
  const targetNumber = useCheckoutStore((s) => s.targetNumber);
  const operatorLabel = useCheckoutStore((s) => s.operatorLabel);
  const selectedRegion = useCheckoutStore((s) => s.selectedRegion);
  const plnContext = useCheckoutStore((s) => s.plnContext);
  const clearPlnContext = useCheckoutStore((s) => s.clearPlnContext);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const flags = useFeaturesStore((s) => s.flags);
  const flagsLoading = useFeaturesStore((s) => s.loading);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);

  useEffect(() => {
    void fetchFeatures();
    void fetchWallet();
  }, [fetchFeatures, fetchWallet]);

  useEffect(() => {
    if (sku) fetchProductDetail(sku);
    return () => clearProductDetail();
  }, [sku, fetchProductDetail, clearProductDetail]);

  useEffect(() => {
    if (productDetail && productDetail.code === sku && skuCode !== sku) {
      startCheckout(productDetail);
    }
  }, [productDetail, sku, skuCode, startCheckout]);

  const categorySlug = productDetail?.category || storeCategorySlug;
  const inquiryBlocked = isInquiryRequiredCategory(categorySlug);
  const directAllowed = isDirectPurchaseCategory(categorySlug);
  const plnPrepaid = isPlnPrepaidCategory(categorySlug);
  const plnValid = isPlnContextValid(plnContext, targetNumber);
  const plnExpired = !!plnContext && Date.now() >= (plnContext.expiresAt || 0);

  // PLN must come from inquiry flow with a still-valid session mirror; others need direct allow.
  const categoryBlocked =
    inquiryBlocked ||
    (!!categorySlug && !directAllowed && !plnPrepaid) ||
    (plnPrepaid && !plnValid);

  const phoneCategory = isPhoneTargetCategory(categorySlug);

  const estimatedTotal =
    productDetail != null ? productDetail.price + (productDetail.adminFee || 0) : 0;
  const balance = overview?.wallet?.balance;
  const insufficientBalance =
    typeof balance === 'number' && productDetail != null && balance < estimatedTotal;

  const targetError = plnPrepaid
    ? !plnValid
      ? plnExpired
        ? 'Sesi cek meteran sudah kedaluwarsa. Silakan cek meteran ulang.'
        : 'Silakan cek meteran terlebih dahulu dari menu Token PLN.'
      : null
    : phoneCategory
      ? phoneTargetError(targetNumber)
      : targetNumber.trim().length === 0
        ? 'Nomor tujuan wajib diisi.'
        : null;

  const targetOk = plnPrepaid
    ? plnValid
    : phoneCategory
      ? isValidPhoneTarget(targetNumber)
      : targetNumber.trim().length > 0;

  const canContinue =
    purchaseEnabled &&
    !flagsLoading &&
    !categoryBlocked &&
    targetOk &&
    !insufficientBalance &&
    !!productDetail;

  const onTargetChange = (text: string) => {
    if (plnPrepaid) return; // Locked — changing meter would break backend session binding.
    setTarget(phoneCategory ? sanitizePhoneDigits(text) : text);
  };

  const goToPin = () => {
    if (!canContinue) return;
    if (plnPrepaid && !isPlnContextValid(plnContext, targetNumber)) {
      clearPlnContext();
      return;
    }
    router.push({ pathname: '/checkout/pin', params: { sku } });
  };

  if (productDetail && inquiryBlocked) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="shield-checkmark-outline"
          title="Validasi Diperlukan"
          message={INQUIRY_FLOW_NOTICE}
        />
      </ScreenContainer>
    );
  }

  if (productDetail && !purchaseEnabled && !productDetailLoading) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={flags.messages.purchase}
        />
      </ScreenContainer>
    );
  }

  if (productDetail && plnPrepaid && !plnValid) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="flash-outline"
          title={plnExpired ? 'Sesi Meter Kedaluwarsa' : 'Cek Meteran Diperlukan'}
          message={
            plnExpired
              ? 'Sesi cek meteran PLN sudah habis (maks. 30 menit). Silakan kembali dan tekan Cek Meteran ulang.'
              : 'Pembelian token PLN membutuhkan cek meteran terlebih dahulu. Buka menu PLN dari Home, cek meteran, lalu pilih nominal.'
          }
        />
      </ScreenContainer>
    );
  }

  if (productDetail && categoryBlocked && !inquiryBlocked && !plnPrepaid) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="information-circle-outline"
          title="Checkout Belum Tersedia"
          message="Kategori produk ini belum didukung pada alur pembelian mobile saat ini."
        />
      </ScreenContainer>
    );
  }

  const plnInquiry = plnContext?.inquiry;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />

      {productDetailLoading && !productDetail ? (
        <LoadingState label="Memuat produk..." />
      ) : productDetailError ? (
        <ErrorState message={productDetailError} onRetry={() => fetchProductDetail(sku)} />
      ) : !productDetail ? (
        <ErrorState message="Produk tidak ditemukan." />
      ) : (
        <>
          <Card>
            {(operatorLabel || productDetail.operatorName) ? (
              <Text style={styles.operator}>{operatorLabel || productDetail.operatorName}</Text>
            ) : null}
            <Text style={styles.name}>{productDetail.name}</Text>
            {(productDetail.quota || productDetail.validity) && (
              <Text style={styles.meta}>
                {[productDetail.quota, productDetail.validity].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Card>

          <View style={styles.field}>
            <Text style={styles.label}>{plnPrepaid ? 'ID Pelanggan PLN' : 'Nomor Tujuan'}</Text>
            <TextInput
              value={targetNumber}
              onChangeText={onTargetChange}
              placeholder={plnPrepaid ? 'Dari hasil cek meteran' : 'Contoh: 081234567890'}
              keyboardType="number-pad"
              editable={!plnPrepaid}
              placeholderTextColor={colors.gray[400]}
              style={[styles.input, plnPrepaid && styles.inputLocked]}
            />
            {plnPrepaid ? (
              <Text style={styles.lockHint}>
                Nomor terkunci dari hasil cek meteran. Ubah meter di layar sebelumnya dan cek ulang jika perlu.
              </Text>
            ) : null}
            {targetError ? <Text style={styles.fieldError}>{targetError}</Text> : null}
          </View>

          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ringkasan Pembelian</Text>
            {plnInquiry ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ID Pelanggan</Text>
                  <Text style={styles.summaryValue}>{plnInquiry.customer_no}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Atas Nama</Text>
                  <Text style={[styles.summaryValue, styles.summaryValueFlex]} numberOfLines={2}>
                    {plnInquiry.customer_name}
                  </Text>
                </View>
                {plnInquiry.segment_power ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tarif / Daya</Text>
                    <Text style={styles.summaryValue}>{plnInquiry.segment_power}</Text>
                  </View>
                ) : null}
                {plnContext?.inquiredMeter ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>No. Meter Diinput</Text>
                    <Text style={styles.summaryValue}>{plnContext.inquiredMeter}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {(operatorLabel || productDetail.operatorName) ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Operator</Text>
                    <Text style={styles.summaryValue}>
                      {operatorLabel || productDetail.operatorName}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Nomor Tujuan</Text>
                  <Text style={styles.summaryValue}>{targetNumber || '—'}</Text>
                </View>
                {selectedRegion ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wilayah</Text>
                    <Text style={styles.summaryValue}>{selectedRegion}</Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Produk</Text>
              <Text style={[styles.summaryValue, styles.summaryValueFlex]} numberOfLines={2}>
                {productDetail.name}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Harga</Text>
              <Text style={styles.summaryValue}>{formatIDR(productDetail.price)}</Text>
            </View>
            {productDetail.adminFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Biaya Admin</Text>
                <Text style={styles.summaryValue}>{formatIDR(productDetail.adminFee)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Perkiraan Total</Text>
              <Text style={styles.summaryValueBold}>{formatIDR(estimatedTotal)}</Text>
            </View>
            <Text style={styles.summaryNote}>
              Total akhir akan dikonfirmasi oleh sistem saat pembayaran. Saldo di bawah hanya
              pengecekan awal — backend tetap sumber kebenaran.
            </Text>
            {typeof balance === 'number' && (
              <View style={[styles.summaryRow, styles.balanceRow]}>
                <Text style={styles.balanceLabel}>Saldo GurkyPay</Text>
                <Text style={styles.balanceValue}>{formatIDR(balance)}</Text>
              </View>
            )}
            {insufficientBalance && (
              <Text style={styles.fieldError}>
                Saldo tidak mencukupi untuk perkiraan total {formatIDR(estimatedTotal)}. Silakan top
                up terlebih dahulu.
              </Text>
            )}
          </Card>

          <Button
            label={flagsLoading ? 'Memuat...' : 'Lanjut Bayar (PIN)'}
            onPress={goToPin}
            disabled={!canContinue}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  operator: {
    fontSize: typography.size.xs,
    color: colors.primary[600],
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    marginTop: spacing.xs,
  },
  meta: { fontSize: typography.size.sm, color: colors.gray[500], marginTop: spacing.xs },
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
  inputLocked: { backgroundColor: colors.gray[50], color: colors.gray[700] },
  lockHint: { fontSize: typography.size.xs, color: colors.gray[500] },
  fieldError: { fontSize: typography.size.xs, color: colors.status.failed, marginTop: 2 },
  summaryCard: { gap: spacing.sm },
  summaryTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { fontSize: typography.size.sm, color: colors.gray[600] },
  summaryLabelBold: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  summaryValue: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gray[900] },
  summaryValueBold: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
  },
  summaryValueFlex: { flex: 1, textAlign: 'right' },
  summaryNote: { fontSize: typography.size.xs, color: colors.gray[400] },
  balanceRow: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  balanceLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  balanceValue: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.gray[700] },
});
