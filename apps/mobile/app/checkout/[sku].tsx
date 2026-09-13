import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogStore } from '../../src/store/catalog.store';
import {
  isPlnContextValid,
  isGameContextValid,
  isTagihanContextValid,
  useCheckoutStore,
} from '../../src/store/checkout.store';
import { useWalletStore } from '../../src/store/wallet.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../src/store/features.store';
import { transactionService } from '../../src/services/transaction.service';
import { parseApiError } from '../../src/api/client';
import {
  ScreenContainer,
  Card,
  Button,
  LoadingState,
  ErrorState,
  PurchaseFlowNotice,
  PinConfirmModal,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatIDR } from '../../src/utils/currency';
import {
  INQUIRY_FLOW_NOTICE,
  isDirectPurchaseCategory,
  isEsimCategory,
  isGameCategory,
  isGasPrepaidCategory,
  isInquiryRequiredCategory,
  isLiteralTargetCategory,
  isPhoneTargetCategory,
  isPlnPrepaidCategory,
  isSerialTargetCategory,
  isTagihanBillCategory,
  isVoucherInternetCategory,
  literalTargetForCategory,
} from '../../src/utils/purchaseCategory';
import { buildTagihanCheckoutPriceLines } from '../../src/utils/tagihanCheckout';
import { isValidPhoneTarget, phoneTargetError } from '../../src/utils/targetValidation';
import { stripGameProductDisplayName } from '../../src/utils/stripGameProductDisplayName';

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
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const operatorLabel = useCheckoutStore((s) => s.operatorLabel);
  const selectedRegion = useCheckoutStore((s) => s.selectedRegion);
  const plnContext = useCheckoutStore((s) => s.plnContext);
  const gameContext = useCheckoutStore((s) => s.gameContext);
  const tagihanContext = useCheckoutStore((s) => s.tagihanContext);
  const voucherInternetMode = useCheckoutStore((s) => s.voucherInternetMode);
  const clearPlnContext = useCheckoutStore((s) => s.clearPlnContext);
  const clearGameContext = useCheckoutStore((s) => s.clearGameContext);
  const clearTagihanContext = useCheckoutStore((s) => s.clearTagihanContext);
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const idempotencyKey = useCheckoutStore((s) => s.idempotencyKey);
  const submitting = useCheckoutStore((s) => s.submitting);
  const setSubmitting = useCheckoutStore((s) => s.setSubmitting);
  const setTransaction = useCheckoutStore((s) => s.setTransaction);
  const setStatus = useCheckoutStore((s) => s.setStatus);
  const flags = useFeaturesStore((s) => s.flags);
  const flagsLoading = useFeaturesStore((s) => s.loading);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const pinLockRef = useRef(false);

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
  const plnPrepaid = isPlnPrepaidCategory(categorySlug);
  const plnValid = isPlnContextValid(plnContext, targetNumber);
  const plnExpired = !!plnContext && Date.now() >= (plnContext.expiresAt || 0);
  const gameCat = isGameCategory(categorySlug);
  const gameValid = isGameContextValid(gameContext, targetNumber, sku || skuCode);
  const gameExpired = !!gameContext && Date.now() >= (gameContext.expiresAt || 0);
  const tagihanCat = isTagihanBillCategory(categorySlug);
  const tagihanValid = isTagihanContextValid(tagihanContext, targetNumber, sku || skuCode);
  const tagihanExpired = !!tagihanContext && Date.now() >= (tagihanContext.expiresAt || 0);
  const literalCat = isLiteralTargetCategory(categorySlug);
  const serialCat = isSerialTargetCategory(categorySlug);
  const gasPrepaid = isGasPrepaidCategory(categorySlug);
  const esimCat = isEsimCategory(categorySlug);

  useEffect(() => {
    if (literalCat && !targetNumber) {
      setTarget(literalTargetForCategory(categorySlug));
    }
  }, [literalCat, categorySlug, targetNumber, setTarget]);

  const inquiryBlocked =
    isInquiryRequiredCategory(categorySlug) &&
    !(gameCat && gameValid) &&
    !(tagihanCat && tagihanValid);
  const directAllowed =
    isDirectPurchaseCategory(categorySlug) || literalCat || serialCat;
  const viTembak = isVoucherInternetCategory(categorySlug) && voucherInternetMode === 'tembak';
  const viElektronik = isVoucherInternetCategory(categorySlug) && voucherInternetMode === 'elektronik';

  const categoryBlocked =
    inquiryBlocked ||
    (!!categorySlug &&
      !directAllowed &&
      !plnPrepaid &&
      !(gameCat && gameValid) &&
      !(tagihanCat && tagihanValid)) ||
    (plnPrepaid && !plnValid) ||
    (gameCat && !gameValid) ||
    (tagihanCat && !tagihanValid);

  const phoneCategory = isPhoneTargetCategory(categorySlug) || viTembak;

  const tagihanPriceLines =
    tagihanCat && tagihanContext?.inquiry
      ? buildTagihanCheckoutPriceLines(tagihanContext.inquiry)
      : null;
  const estimatedTotal =
    tagihanPriceLines != null
      ? tagihanPriceLines.total
      : productDetail != null
        ? productDetail.price + (productDetail.adminFee || 0)
        : 0;
  const balance = overview?.wallet?.balance;
  const insufficientBalance =
    typeof balance === 'number' && productDetail != null && balance < estimatedTotal;

  const targetError = plnPrepaid
    ? !plnValid
      ? plnExpired
        ? 'Sesi cek meteran sudah kedaluwarsa. Silakan cek meteran ulang.'
        : 'Silakan cek meteran terlebih dahulu dari menu Token PLN.'
      : null
    : gameCat
      ? !gameValid
        ? gameExpired
          ? 'Sesi validasi akun game sudah kedaluwarsa. Validasi ulang dari menu Game.'
          : 'Silakan validasi akun game terlebih dahulu dari menu Game.'
        : null
      : tagihanCat
        ? !tagihanValid
          ? tagihanExpired
            ? 'Sesi inquiry tagihan sudah kedaluwarsa. Cek tagihan ulang.'
            : 'Silakan cek tagihan terlebih dahulu.'
          : null
        : literalCat || viElektronik
          ? targetNumber.trim().length === 0
            ? 'Tujuan transaksi tidak valid. Kembali dan mulai ulang.'
            : null
          : serialCat
            ? targetNumber.trim().length < 4
              ? 'Nomor serial / barcode wajib diisi.'
              : null
            : phoneCategory
              ? phoneTargetError(targetNumber)
              : targetNumber.trim().length === 0
                ? 'Nomor tujuan wajib diisi.'
                : null;

  const targetOk = plnPrepaid
    ? plnValid
    : gameCat
      ? gameValid
      : tagihanCat
        ? tagihanValid
        : literalCat || viElektronik
          ? targetNumber.trim().length > 0
          : serialCat
            ? targetNumber.trim().length >= 4
            : phoneCategory
              ? categorySlug === 'international'
                ? targetNumber.replace(/\D/g, '').length >= 8
                : isValidPhoneTarget(targetNumber)
              : targetNumber.trim().length > 0;

  const canContinue =
    purchaseEnabled &&
    !flagsLoading &&
    !categoryBlocked &&
    targetOk &&
    !insufficientBalance &&
    !!productDetail;

  const openPinModal = () => {
    if (!canContinue) return;
    if (plnPrepaid && !isPlnContextValid(plnContext, targetNumber)) {
      clearPlnContext();
      return;
    }
    if (gameCat && !isGameContextValid(gameContext, targetNumber, sku || skuCode)) {
      clearGameContext();
      return;
    }
    if (tagihanCat && !isTagihanContextValid(tagihanContext, targetNumber, sku || skuCode)) {
      clearTagihanContext();
      return;
    }
    setPinError(null);
    setPinOpen(true);
  };

  const handlePinSubmit = async (enteredPin: string) => {
    if (pinLockRef.current || submitting) return;
    if (!skuCode || !idempotencyKey) {
      setPinError('Sesi checkout tidak valid. Silakan mulai ulang dari detail produk.');
      return;
    }

    pinLockRef.current = true;
    setSubmitting(true);
    setPinError(null);

    try {
      const response = await transactionService.create({
        sku_code: skuCode,
        target_number: targetNumber,
        pin: enteredPin,
        idempotency_key: idempotencyKey,
        ...(tagihanCat && tagihanContext?.inquiry?.inquiry_ref_id
          ? { inquiry_ref_id: tagihanContext.inquiry.inquiry_ref_id }
          : {}),
        ...(voucherInternetMode ? { voucher_internet_mode: voucherInternetMode } : {}),
      });

      if (response.success && response.data) {
        setTransaction(response.data);
        setStatus(response.data.status);
        setSubmitting(false);
        setPinOpen(false);
        router.replace({ pathname: '/checkout/result', params: { sku } });
        return;
      }

      setSubmitting(false);
      setPinError(response.message || 'Transaksi gagal diproses.');
    } catch (err: unknown) {
      setSubmitting(false);
      const parsed = parseApiError(err);
      setPinError(parsed.message || 'Gagal memproses transaksi. Silakan coba lagi.');
      if (
        typeof parsed.message === 'string' &&
        parsed.message.toLowerCase().includes('pin transaksi salah')
      ) {
        useCheckoutStore.getState().rotateIdempotencyKey();
      }
      if (
        typeof parsed.message === 'string' &&
        (parsed.message.toLowerCase().includes('cek meteran') ||
          parsed.message.toLowerCase().includes('kedaluwarsa') ||
          parsed.message.toLowerCase().includes('inquiry') ||
          parsed.message.toLowerCase().includes('validasi akun game') ||
          parsed.message.toLowerCase().includes('akun game'))
      ) {
        clearPlnContext();
        clearGameContext();
        clearTagihanContext();
      }
    } finally {
      pinLockRef.current = false;
    }
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

  if (productDetail && gameCat && !gameValid) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />
        <PurchaseFlowNotice
          icon="game-controller-outline"
          title={gameExpired ? 'Sesi Validasi Kedaluwarsa' : 'Validasi Akun Diperlukan'}
          message={
            gameExpired
              ? 'Sesi pembelian game sudah habis. Silakan kembali ke menu Game, pilih produk, isi akun, lalu lanjutkan.'
              : 'Pembelian game dilakukan dari menu Game: pilih game, isi akun sesuai schema DigiFlazz, lalu konfirmasi & PIN.'
          }
        />
      </ScreenContainer>
    );
  }

  if (productDetail && categoryBlocked && !inquiryBlocked && !plnPrepaid && !gameCat) {
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
  const gameInquiry = gameContext?.inquiry;
  const gameBrand = gameContext?.brand || operatorLabel || productDetail?.operatorName || '';

  return (
    <ScreenContainer belowHeader>
      <Stack.Screen options={{ headerShown: true, title: 'Konfirmasi', headerBackTitle: 'Kembali' }} />

      {productDetailLoading && !productDetail ? (
        <LoadingState label="Memuat produk..." />
      ) : productDetailError ? (
        <ErrorState message={productDetailError} onRetry={() => fetchProductDetail(sku)} />
      ) : !productDetail ? (
        <ErrorState message="Produk tidak ditemukan." />
      ) : (
        <View style={styles.contentUp}>
          <Card style={styles.productCard}>
            {(gameBrand || productDetail.operatorName) ? (
              <Text style={styles.operator}>{gameBrand || productDetail.operatorName}</Text>
            ) : null}
            <Text style={styles.name}>
              {gameCat
                ? stripGameProductDisplayName(productDetail.name, gameBrand)
                : productDetail.name}
            </Text>
            {(productDetail.quota || productDetail.validity) && (
              <Text style={styles.meta}>
                {[productDetail.quota, productDetail.validity].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Card>

          {/* PLACEHOLDER target (eSIM) is internal only — never show as "Nomor Tujuan". */}
          {!esimCat ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {plnPrepaid
                ? 'ID Pelanggan PLN'
                : gameCat
                  ? 'Akun Game'
                  : gasPrepaid
                    ? 'ID Pelanggan / Nomor'
                    : serialCat
                      ? 'Nomor Serial / Barcode'
                      : viElektronik
                        ? 'Tujuan (kode voucher)'
                        : 'Nomor Tujuan'}
            </Text>
            <TextInput
              value={
                gameCat && gameInquiry
                  ? gameInquiry.nickname
                    ? `${gameInquiry.nickname} (${gameInquiry.id_zone_label || gameInquiry.customer_no})`
                    : gameInquiry.customer_no
                  : viElektronik
                    ? targetNumber.startsWith('08') && targetNumber.length >= 10
                      ? targetNumber
                      : 'Kode voucher ke akun Anda'
                    : targetNumber
              }
              editable={false}
              selectTextOnFocus={false}
              placeholder={
                plnPrepaid
                  ? 'Dari hasil cek meteran'
                  : gameCat
                    ? 'Dari hasil validasi akun'
                    : gasPrepaid
                      ? 'ID pelanggan / nomor'
                      : serialCat
                        ? 'Dari halaman provider'
                        : 'Nomor tujuan'
              }
              placeholderTextColor={colors.gray[400]}
              style={[styles.input, styles.inputLocked]}
            />
            <Text style={styles.lockHint}>
              {plnPrepaid
                ? 'Nomor terkunci dari hasil cek meteran. Ubah meter di layar sebelumnya dan cek ulang jika perlu.'
                : gameCat
                  ? 'Akun terkunci dari hasil validasi nickname. Tekan Kembali untuk mengubah User ID.'
                  : serialCat
                    ? 'Serial terkunci dari halaman provider. Tekan Kembali untuk mengubah serial / barcode.'
                    : viElektronik
                      ? 'Kode voucher akan ditampilkan setelah transaksi berhasil dan tersimpan di Riwayat.'
                      : 'Nomor tujuan tidak bisa diubah di sini. Tekan Kembali untuk mengubah nomor.'}
            </Text>
            {targetError ? <Text style={styles.fieldError}>{targetError}</Text> : null}
          </View>
          ) : targetError ? (
            <Text style={styles.fieldError}>{targetError}</Text>
          ) : null}

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
            ) : gameInquiry ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Game</Text>
                  <Text style={styles.summaryValue}>
                    {gameInquiry.game || gameBrand || '—'}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Nickname</Text>
                  <Text style={[styles.summaryValue, styles.summaryValueFlex]} numberOfLines={2}>
                    {gameInquiry.nickname}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>User ID</Text>
                  <Text style={styles.summaryValue}>
                    {gameInquiry.user_id || gameInquiry.id_zone_label || '—'}
                  </Text>
                </View>
                {gameInquiry.zone_id ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Zone ID</Text>
                    <Text style={styles.summaryValue}>{gameInquiry.zone_id}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {esimCat ? 'Negara / Provider' : 'Operator'}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {operatorLabel || productDetail.operatorName || '—'}
                  </Text>
                </View>
                {!esimCat ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {viElektronik ? 'Mode' : serialCat ? 'Nomor Serial' : 'Nomor Tujuan'}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {viElektronik
                      ? targetNumber.startsWith('08') && targetNumber.length >= 10
                        ? targetNumber
                        : 'Voucher Elektronik'
                      : targetNumber || '—'}
                  </Text>
                </View>
                ) : null}
                {selectedRegion ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      {viTembak || viElektronik ? 'Zona' : 'Wilayah'}
                    </Text>
                    <Text style={styles.summaryValue}>{selectedRegion}</Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Produk</Text>
              <Text style={[styles.summaryValue, styles.summaryValueFlex]} numberOfLines={2}>
                {gameCat
                  ? stripGameProductDisplayName(productDetail.name, gameBrand)
                  : productDetail.name}
              </Text>
            </View>
            {tagihanPriceLines ? (
              <>
                {tagihanPriceLines.billAmount != null ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tagihan</Text>
                    <Text style={styles.summaryValue}>
                      {formatIDR(tagihanPriceLines.billAmount)}
                    </Text>
                  </View>
                ) : null}
                {tagihanPriceLines.adminFee != null && tagihanPriceLines.adminFee > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Biaya Admin</Text>
                    <Text style={styles.summaryValue}>
                      {formatIDR(tagihanPriceLines.adminFee)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Total</Text>
                  <Text style={styles.summaryValueBold}>
                    {formatIDR(tagihanPriceLines.total)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Harga</Text>
                  <Text style={styles.summaryValue}>{formatIDR(productDetail.price)}</Text>
                </View>
                {productDetail.adminFee > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Biaya Admin</Text>
                    <Text style={styles.summaryValue}>{formatIDR(productDetail.adminFee)}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Total</Text>
                  <Text style={styles.summaryValueBold}>{formatIDR(estimatedTotal)}</Text>
                </View>
              </>
            )}
            {typeof balance === 'number' ? (
              <View style={[styles.summaryRow, styles.balanceRow]}>
                <Text style={styles.balanceLabel}>Saldo GurkyPay</Text>
                <Text
                  style={[
                    styles.balanceValue,
                    insufficientBalance && styles.balanceValueWarn,
                  ]}
                >
                  {formatIDR(balance)}
                </Text>
              </View>
            ) : null}
            {insufficientBalance ? (
              <Text style={styles.balanceHint}>
                Saldo GurkyPay kurang, lakukan isi ulang saldo
              </Text>
            ) : null}
          </Card>

          <Button
            label={flagsLoading ? 'Memuat...' : 'Lanjut Bayar (PIN)'}
            onPress={openPinModal}
            disabled={!canContinue || submitting}
          />

          <PinConfirmModal
            visible={pinOpen}
            title="Masukkan PIN"
            subtitle="Masukkan 6 digit PIN kamu"
            loading={submitting}
            error={
              pinError
                ? pinError.toLowerCase().includes('pin')
                  ? 'PIN salah\nSilakan coba lagi.'
                  : pinError
                : null
            }
            dismissible={!submitting}
            onClose={() => {
              if (!submitting) {
                setPinOpen(false);
                setPinError(null);
              }
            }}
            onEditing={() => setPinError(null)}
            onSubmit={handlePinSubmit}
            onForgotPin={() => {
              if (submitting) return;
              setPinOpen(false);
              setPinError(null);
              router.push('/akun/pin/forgot');
            }}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Sedikit naik (tidak terlalu tinggi).
  contentUp: {
    marginTop: -8,
    gap: spacing.md,
  },
  productCard: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  operator: {
    fontSize: 11,
    color: colors.primary[600],
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
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
  lockHint: { fontSize: typography.size.xs, color: colors.gray[500], lineHeight: 16 },
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
  balanceRow: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  balanceLabel: { fontSize: typography.size.sm, color: colors.gray[600] },
  balanceValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  balanceValueWarn: { color: colors.status.failed },
  balanceHint: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    lineHeight: 16,
  },
});
