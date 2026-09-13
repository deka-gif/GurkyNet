import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { catalogService, Product } from '../../services/catalog.service';
import {
  isEwalletInquiryValid,
  useEwalletTransferStore,
} from '../../store/ewalletTransfer.store';
import { useCheckoutStore } from '../../store/checkout.store';
import { useWalletStore } from '../../store/wallet.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { CATALOG_FETCH } from '../../config/catalogFetchLimits';
import {
  ScreenContainer,
  Button,
  LoadingState,
  BrandLogo,
  PinConfirmModal,
  PurchaseFlowNotice,
} from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { parseApiError } from '../../api/client';
import {
  validateEwalletOpenAmount,
  resolveEwalletOpenAmountProduct,
  openAmountLimitsForBrand,
} from '../../utils/ewalletBrand';

/** Same mental model as Sesama GurkyPay: nomor + nominal manual → validate → confirm → PIN. */
type Step = 'input' | 'confirm';

const CATEGORY = 'topup-digital';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDigitsToRupiahDisplay(digits: string): string {
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('id-ID');
}

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

export type EwalletFlowEntry = 'transfer' | 'layanan';

type Props = {
  /** Entry point — same PPOB engine; only copy/fallback differ. */
  entry?: EwalletFlowEntry;
};

/**
 * E-Wallet purchase flow (Transfer + Layanan) — UX mirrors Sesama GurkyPay.
 * Engine = PPOB: resolve SKU internally → POST /ewallet/inquiry → POST /transactions.
 * Never POST /wallet/transfer. Never render product/SKU chips.
 */
export function EwalletTransferFlow({ entry = 'transfer' }: Props = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const flags = useFeaturesStore((s) => s.flags);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);
  const balance = useWalletStore((s) => s.overview?.wallet?.balance);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const brandName = useEwalletTransferStore((s) => s.brandName);
  const brandLogo = useEwalletTransferStore((s) => s.brandLogo);
  const providerIds = useEwalletTransferStore((s) => s.providerIds);
  const minAmount = useEwalletTransferStore((s) => s.minAmount);
  const maxAmount = useEwalletTransferStore((s) => s.maxAmount);
  const skuCode = useEwalletTransferStore((s) => s.skuCode);
  const product = useEwalletTransferStore((s) => s.product);
  const customerNo = useEwalletTransferStore((s) => s.customerNo);
  const storedAmount = useEwalletTransferStore((s) => s.amount);
  const inquiry = useEwalletTransferStore((s) => s.inquiry);
  const inquiryExpiresAt = useEwalletTransferStore((s) => s.inquiryExpiresAt);
  const inquiring = useEwalletTransferStore((s) => s.inquiring);
  const inquiryError = useEwalletTransferStore((s) => s.inquiryError);
  const submitting = useEwalletTransferStore((s) => s.submitting);
  const submitError = useEwalletTransferStore((s) => s.submitError);
  const setAmount = useEwalletTransferStore((s) => s.setAmount);
  const setCustomerNo = useEwalletTransferStore((s) => s.setCustomerNo);
  const runInquiry = useEwalletTransferStore((s) => s.runInquiry);
  const clearInquiry = useEwalletTransferStore((s) => s.clearInquiry);
  const applyOpenAmountMeta = useEwalletTransferStore((s) => s.applyOpenAmountMeta);
  const submitPurchase = useEwalletTransferStore((s) => s.submitPurchase);
  const clearSubmitError = useEwalletTransferStore((s) => s.clearSubmitError);

  const setCheckoutTransaction = useCheckoutStore((s) => s.setTransaction);
  const setCheckoutStatus = useCheckoutStore((s) => s.setStatus);

  const [step, setStep] = useState<Step>('input');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [amountDigits, setAmountDigits] = useState(
    storedAmount > 0 ? String(storedAmount) : ''
  );
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    void fetchFeatures();
    void fetchWallet();
  }, [fetchFeatures, fetchWallet]);

  useEffect(() => {
    if (!brandName || providerIds.length === 0) {
      if (entry === 'layanan') {
        router.replace({
          pathname: '/produk/[slug]',
          params: { slug: 'topup-digital', name: 'E-Wallet' },
        });
      } else {
        router.replace('/transfer');
      }
    }
  }, [brandName, providerIds, router, entry]);

  /** Internal catalog load for SKU resolution only — never rendered as product list. */
  const loadCatalog = useCallback(async () => {
    if (providerIds.length === 0) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const batches = await Promise.all(
        providerIds.map((providerId) =>
          catalogService.getProducts({
            category: CATEGORY,
            provider_id: providerId,
            per_page: CATALOG_FETCH.PROVIDER_SCOPED,
          })
        )
      );
      const merged = new Map<string, Product>();
      for (const res of batches) {
        if (!res.success || !Array.isArray(res.data)) continue;
        for (const p of res.data) {
          if (p?.code && !merged.has(p.code)) merged.set(p.code, p);
        }
      }
      if (merged.size === 0) {
        const firstErr = batches.find((b) => !b.success)?.message;
        setCatalogProducts([]);
        setCatalogError(firstErr || 'Gagal memuat data E-Wallet.');
      } else {
        setCatalogProducts(Array.from(merged.values()));
      }
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setCatalogProducts([]);
      setCatalogError(parsed.message || 'Gagal memuat data E-Wallet.');
    } finally {
      setCatalogLoading(false);
    }
  }, [providerIds]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Legacy provider summary may omit sku/min/max — resolve from Bebas Nominal catalog SKU.
  useEffect(() => {
    if (catalogProducts.length === 0) return;
    const open = resolveEwalletOpenAmountProduct(catalogProducts, skuCode);
    if (!open?.code) return;
    const fallback = brandName ? openAmountLimitsForBrand(brandName) : null;
    const nextMin =
      typeof open.min_amount === 'number' && open.min_amount > 0
        ? open.min_amount
        : minAmount ?? fallback?.min ?? null;
    const nextMax =
      typeof open.max_amount === 'number' && open.max_amount > 0
        ? open.max_amount
        : maxAmount ?? fallback?.max ?? null;
    if (
      open.code !== skuCode ||
      nextMin !== minAmount ||
      nextMax !== maxAmount
    ) {
      applyOpenAmountMeta({
        skuCode: open.code,
        minAmount: nextMin,
        maxAmount: nextMax,
      });
    }
  }, [catalogProducts, skuCode, minAmount, maxAmount, brandName, applyOpenAmountMeta]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isBackAction(e.data.action)) return;
      if (step === 'input') return;
      e.preventDefault();
      if (step === 'confirm') {
        setStep('input');
        setPinOpen(false);
        clearInquiry();
      }
    });
    return unsub;
  }, [navigation, step, clearInquiry]);

  const phoneDigits = customerNo.replace(/\D/g, '');
  const phoneOk = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  const amount = amountDigits ? Number(amountDigits) : 0;
  const resolvedOpen = useMemo(
    () => resolveEwalletOpenAmountProduct(catalogProducts, skuCode),
    [catalogProducts, skuCode]
  );
  const brandFallbackLimits = useMemo(
    () => (brandName ? openAmountLimitsForBrand(brandName) : null),
    [brandName]
  );
  const effectiveMin =
    minAmount ??
    (typeof resolvedOpen?.min_amount === 'number' ? resolvedOpen.min_amount : null) ??
    brandFallbackLimits?.min ??
    null;
  const effectiveMax =
    maxAmount ??
    (typeof resolvedOpen?.max_amount === 'number' ? resolvedOpen.max_amount : null) ??
    brandFallbackLimits?.max ??
    null;
  const effectiveSku = skuCode || resolvedOpen?.code || null;
  const amountValidation = amountDigits
    ? validateEwalletOpenAmount(amount, effectiveMin, effectiveMax)
    : null;
  const amountOk = amountDigits.length > 0 && amountValidation === null;
  const limitsReady =
    effectiveMin != null && effectiveMax != null && Boolean(effectiveSku);

  const phoneError = useMemo(() => {
    if (!phoneTouched) return null;
    if (!phoneDigits) return 'Nomor HP e-wallet wajib diisi.';
    if (!phoneOk) return 'Nomor HP e-wallet harus 10–15 digit.';
    return null;
  }, [phoneTouched, phoneDigits, phoneOk]);

  const amountError = useMemo(() => {
    if (!amountTouched) return null;
    if (!amountDigits) return 'Masukkan nominal transfer';
    return amountValidation;
  }, [amountTouched, amountDigits, amountValidation]);

  const limitHint =
    effectiveMin != null && effectiveMax != null
      ? `Min. ${formatIDR(effectiveMin)} — Maks. ${formatIDR(effectiveMax)}`
      : null;

  const canContinue =
    phoneOk &&
    amountOk &&
    limitsReady &&
    !inquiring &&
    !catalogLoading &&
    catalogProducts.length > 0;

  const onContinue = async () => {
    setPhoneTouched(true);
    setAmountTouched(true);
    setPageError(null);
    if (!phoneOk || !amountOk || lockRef.current || inquiring) return;
    if (catalogError || catalogProducts.length === 0) {
      setPageError(catalogError || 'Data transfer E-Wallet belum siap. Coba lagi.');
      return;
    }

    lockRef.current = true;
    setAmount(amount);
    try {
      const result = await runInquiry(catalogProducts);
      if (!result.ok) return;
      setStep('confirm');
    } finally {
      lockRef.current = false;
    }
  };

  const inquiryValid = isEwalletInquiryValid(
    inquiry,
    inquiryExpiresAt,
    product?.code ?? null,
    customerNo
  );

  const nominal = inquiry
    ? Number(inquiry.nominal_amount ?? inquiry.bill_amount ?? 0)
    : 0;
  const total = inquiry ? Number(inquiry.selling_price ?? 0) : 0;
  const transferFee =
    inquiry && Math.abs(total - nominal - Number(inquiry.admin_fee ?? 0)) < 0.009
      ? Number(inquiry.admin_fee ?? 0)
      : Math.max(0, total - nominal);

  const insufficient =
    typeof balance === 'number' && inquiryValid && total > 0 && balance < total;

  const openPin = () => {
    setPageError(null);
    clearSubmitError();
    if (!purchaseEnabled) {
      setPageError(flags.messages.purchase);
      return;
    }
    if (!inquiryValid) {
      setPageError('Sesi inquiry tidak valid atau kedaluwarsa. Silakan inquiry ulang.');
      return;
    }
    if (insufficient) {
      setPageError('Saldo GurkyPay Anda tidak mencukupi untuk transfer ini.');
      return;
    }
    setPinOpen(true);
  };

  const onPinSubmit = async (pin: string) => {
    if (lockRef.current || submitting) return;
    lockRef.current = true;
    try {
      const result = await submitPurchase(pin);
      if (result.ok) {
        const tx = useEwalletTransferStore.getState().transaction;
        if (tx) {
          setCheckoutTransaction(tx);
          setCheckoutStatus(tx.status);
        }
        setPinOpen(false);
        router.replace('/checkout/result');
        return;
      }
      if (result.code === 'pin') {
        return;
      }
      setPinOpen(false);
      setPageError(result.message || 'Transaksi gagal diproses.');
    } finally {
      lockRef.current = false;
    }
  };

  if (!brandName) {
    return (
      <ScreenContainer belowHeader>
        <Stack.Screen options={{ headerShown: true, title: 'Transfer', headerBackTitle: 'Kembali' }} />
        <LoadingState label="Menyiapkan transfer..." />
      </ScreenContainer>
    );
  }

  if (!purchaseEnabled) {
    return (
      <ScreenContainer belowHeader>
        <Stack.Screen
          options={{
            headerShown: true,
            title: entry === 'layanan' ? brandName : `Transfer ke ${brandName}`,
            headerBackTitle: 'Kembali',
          }}
        />
        <PurchaseFlowNotice
          icon="time-outline"
          title="Pembelian Belum Aktif"
          message={flags.messages.purchase}
        />
      </ScreenContainer>
    );
  }

  const headerTitle =
    step === 'confirm'
      ? entry === 'layanan'
        ? 'Konfirmasi'
        : 'Konfirmasi Transfer'
      : entry === 'layanan'
        ? brandName
        : `Transfer ke ${brandName}`;

  return (
    <ScreenContainer belowHeader scroll>
      <Stack.Screen options={{ headerShown: true, title: headerTitle, headerBackTitle: 'Kembali' }} />

      {step === 'input' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.brandHeader}>
            <BrandLogo name={brandName} logo={brandLogo} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>{brandName}</Text>
              <Text style={styles.brandSub}>
                {entry === 'layanan' ? `Top up ${brandName}` : `Transfer ke ${brandName}`}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nomor HP {brandName}</Text>
            <TextInput
              value={customerNo}
              onChangeText={(t) => setCustomerNo(digitsOnly(t))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="08xxxxxxxxxx"
              placeholderTextColor={colors.gray[400]}
              keyboardType="number-pad"
              editable={!inquiring}
              style={[styles.input, phoneError ? styles.inputError : null]}
              accessibilityLabel={`Nomor HP ${brandName}`}
            />
            {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nominal</Text>
            <View style={[styles.amountRow, amountError ? styles.inputError : null]}>
              <Text style={styles.rpPrefix}>Rp</Text>
              <TextInput
                value={formatDigitsToRupiahDisplay(amountDigits)}
                onChangeText={(t) => {
                  setAmountDigits(digitsOnly(t));
                  setAmount(Number(digitsOnly(t) || 0));
                }}
                onBlur={() => setAmountTouched(true)}
                placeholder="0"
                placeholderTextColor={colors.gray[400]}
                keyboardType="number-pad"
                editable={!inquiring}
                style={styles.amountInput}
                accessibilityLabel="Nominal transfer"
              />
            </View>
            {amountError ? <Text style={styles.error}>{amountError}</Text> : null}
            {limitHint ? <Text style={styles.hint}>{limitHint}</Text> : null}
          </View>

          {catalogError ? <Text style={styles.error}>{catalogError}</Text> : null}
          {inquiryError ? <Text style={styles.error}>{inquiryError}</Text> : null}
          {pageError ? <Text style={styles.error}>{pageError}</Text> : null}

          <View style={styles.cta}>
            <Button
              label="Selanjutnya"
              onPress={() => void onContinue()}
              loading={inquiring || catalogLoading}
              disabled={!canContinue}
            />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {step === 'confirm' && inquiry ? (
        <View style={styles.block}>
          <View style={styles.brandHeader}>
            <BrandLogo name={brandName} logo={brandLogo} size={44} />
            <Text style={styles.brandTitle}>{brandName}</Text>
          </View>

          <View style={styles.confirmCard}>
            {/* Show Digiflazz customer_name as-is (may already contain provider asterisks).
                Empty name is allowed after successful Digi inquiry — never mask/hide for privacy. */}
            <Row
              label="Nama Tujuan"
              value={
                inquiry.customer_name?.trim()
                  ? inquiry.customer_name.trim()
                  : 'Nama pelanggan tidak tersedia dari provider, pastikan nomor tujuan sudah benar'
              }
              emphasizeName={Boolean(inquiry.customer_name?.trim())}
            />
            <Row label="No. Tujuan" value={inquiry.customer_no} />
            <Row label="Nominal" value={formatIDR(nominal)} />
            <Row label="Biaya Transfer" value={formatIDR(transferFee)} />
            <View style={styles.divider} />
            <Row label="Total" value={formatIDR(total)} emphasize />
          </View>

          {typeof balance === 'number' ? (
            <Text style={styles.balanceHint}>Saldo GurkyPay: {formatIDR(balance)}</Text>
          ) : null}
          {insufficient ? (
            <Text style={styles.error}>Saldo GurkyPay Anda tidak mencukupi untuk transfer ini.</Text>
          ) : null}
          {pageError ? <Text style={styles.pageError}>{pageError}</Text> : null}

          <View style={styles.cta}>
            <Button
              label="Konfirmasi"
              onPress={openPin}
              disabled={submitting || insufficient || !inquiryValid}
            />
          </View>

          <PinConfirmModal
            visible={pinOpen}
            title="Masukkan PIN"
            subtitle="Masukkan 6 digit PIN kamu"
            loading={submitting}
            error={
              submitError
                ? submitError.toLowerCase().includes('pin')
                  ? 'PIN salah\nSilakan coba lagi.'
                  : submitError
                : null
            }
            dismissible={!submitting}
            onClose={() => {
              if (!submitting) {
                setPinOpen(false);
                clearSubmitError();
              }
            }}
            onEditing={() => clearSubmitError()}
            onSubmit={onPinSubmit}
            onForgotPin={() => {
              if (submitting) return;
              setPinOpen(false);
              clearSubmitError();
              router.push('/akun/pin/forgot');
            }}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function Row({
  label,
  value,
  emphasize,
  emphasizeName,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  emphasizeName?: boolean;
}) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          emphasize && styles.rowEmphasize,
          emphasizeName && styles.rowName,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.md },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  brandTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  brandSub: {
    fontSize: typography.size.sm,
    color: colors.gray[500],
    marginTop: 2,
  },
  field: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.gray[900],
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  rpPrefix: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.gray[900],
  },
  inputError: {
    borderColor: colors.status.failed,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
  pageError: {
    fontSize: typography.size.sm,
    color: colors.status.failed,
    backgroundColor: colors.status.failedBg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cta: {
    marginTop: spacing.md,
  },
  confirmCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: { fontSize: typography.size.sm, color: colors.gray[500] },
  rowValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right',
  },
  rowName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  rowEmphasize: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
  },
  balanceHint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
  },
});
