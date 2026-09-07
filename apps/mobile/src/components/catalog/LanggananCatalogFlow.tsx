import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import {
  catalogService,
  CategoryProviderSummary,
  Product,
} from '../../services/catalog.service';
import {
  buildLanggananCustomerNo,
  langgananAccountReady,
  langgananService,
  LanggananAccountField,
  LanggananAccountSchema,
} from '../../services/langganan.service';
import { transactionService } from '../../services/transaction.service';
import { useCheckoutStore } from '../../store/checkout.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { useWalletStore } from '../../store/wallet.store';
import { parseApiError } from '../../api/client';
import {
  BrandLogo,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PinConfirmModal,
  PurchaseFlowNotice,
} from '../ui';
import { ProductCatalogGrid } from './ProductCatalogGrid';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { sortProvidersByNameAsc } from '../../utils/sortProvidersByName';

/**
 * Streaming / Langganan Digital purchase (Stage 2).
 * Category API: langganan-digital. No inquiry — schema → customer_no → PIN → POST /transactions.
 * Voucher delivery uses target_number "LANGGANAN" (Web parity).
 */

type Props = {
  purchaseBanner?: string | null;
};

type Step = 'brands' | 'buy' | 'confirm';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

export function LanggananCatalogFlow({ purchaseBanner }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const startCheckout = useCheckoutStore((s) => s.startCheckout);
  const setTarget = useCheckoutStore((s) => s.setTarget);
  const setPurchaseContext = useCheckoutStore((s) => s.setPurchaseContext);
  const setTransaction = useCheckoutStore((s) => s.setTransaction);
  const setStatus = useCheckoutStore((s) => s.setStatus);
  const setSubmitting = useCheckoutStore((s) => s.setSubmitting);
  const rotateIdempotencyKey = useCheckoutStore((s) => s.rotateIdempotencyKey);
  const submitting = useCheckoutStore((s) => s.submitting);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const flags = useFeaturesStore((s) => s.flags);
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [step, setStep] = useState<Step>('brands');
  const [brands, setBrands] = useState<CategoryProviderSummary[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<CategoryProviderSummary | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [schema, setSchema] = useState<LanggananAccountSchema | null>(null);
  const [schemaFields, setSchemaFields] = useState<LanggananAccountField[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [account, setAccount] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const pinLockRef = useRef(false);

  const deliveryRaw = String(schema?.delivery ?? '').trim().toLowerCase();
  const isKnownDelivery = deliveryRaw === 'account' || deliveryRaw === 'voucher';
  const isVoucher = isKnownDelivery && deliveryRaw === 'voucher';
  const isAccount = isKnownDelivery && deliveryRaw === 'account';
  const accountReady =
    isVoucher ||
    (isAccount && schemaFields.length > 0 && langgananAccountReady(schemaFields, account));
  const schemaReady = !!schema && !schemaError && isKnownDelivery && (isVoucher || schemaFields.length > 0);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    setBrandsError(null);
    try {
      const res = await catalogService.getCategoryProviders('langganan-digital');
      if (res.success && Array.isArray(res.data)) {
        setBrands(sortProvidersByNameAsc(res.data));
      } else {
        setBrands([]);
        setBrandsError(res.message || 'Gagal memuat daftar layanan.');
      }
    } catch (err: unknown) {
      setBrands([]);
      setBrandsError(parseApiError(err).message || 'Gagal memuat daftar layanan.');
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
    void fetchWallet();
  }, [loadBrands, fetchWallet]);

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    const list = !q
      ? brands
      : brands.filter((b) => String(b.name ?? '').toLowerCase().includes(q));
    return sortProvidersByNameAsc(list);
  }, [brands, brandQuery]);

  const listedProducts = useMemo(() => products.filter((p) => isCatalogListed(p)), [products]);

  const canLanjut =
    purchaseEnabled &&
    !!selectedProduct &&
    isProductPurchasable(selectedProduct) &&
    schemaReady &&
    accountReady &&
    !schemaLoading &&
    !productsLoading;

  const clearProductSchema = useCallback(() => {
    setSelectedProduct(null);
    setSchema(null);
    setSchemaFields([]);
    setSchemaError(null);
    setAccount({});
    setFormError(null);
  }, []);

  const goBackStep = useCallback(() => {
    setFormError(null);
    setPinOpen(false);
    setPinError(null);
    if (step === 'confirm') {
      setStep('buy');
      return;
    }
    if (step === 'buy') {
      setSelectedBrand(null);
      setProducts([]);
      setProductsError(null);
      clearProductSchema();
      setStep('brands');
    }
  }, [step, clearProductSchema]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step === 'brands') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, step, goBackStep]);

  const selectBrand = async (brand: CategoryProviderSummary) => {
    setSelectedBrand(brand);
    setStep('buy');
    setProducts([]);
    setProductsError(null);
    clearProductSchema();
    setProductsLoading(true);
    try {
      const res = await catalogService.getProducts({
        category: 'langganan-digital',
        provider_id: brand.providerId,
        per_page: 5000,
      });
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
        setProductsError(res.message || 'Gagal memuat paket.');
      }
    } catch (err: unknown) {
      setProducts([]);
      setProductsError(parseApiError(err).message || 'Gagal memuat paket.');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadSchema = async (brandName: string, sku: string) => {
    setSchemaLoading(true);
    setSchemaError(null);
    setSchema(null);
    setSchemaFields([]);
    setAccount({});
    try {
      const res = await langgananService.accountSchema(brandName, sku);
      if (res.success && res.data) {
        const d = String(res.data.delivery ?? '').trim().toLowerCase();
        if (d !== 'account' && d !== 'voucher') {
          setSchema(null);
          setSchemaFields([]);
          setSchemaError(
            d === 'unknown' || d === ''
              ? 'Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'
              : `Tipe pengiriman produk tidak didukung (${res.data.delivery || 'kosong'}).`
          );
          return;
        }
        const fields = Array.isArray(res.data.fields) ? res.data.fields : [];
        if (d === 'account' && fields.length === 0) {
          setSchema(null);
          setSchemaFields([]);
          setSchemaError(
            'Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'
          );
          return;
        }
        setSchema({ ...res.data, delivery: d });
        setSchemaFields(fields);
        const initial: Record<string, string> = {};
        for (const f of fields) initial[f.key] = '';
        setAccount(initial);
      } else {
        setSchema(null);
        setSchemaFields([]);
        setSchemaError(res.message || 'Gagal memuat kebutuhan input produk. Silakan coba lagi.');
      }
    } catch (err: unknown) {
      setSchema(null);
      setSchemaFields([]);
      setSchemaError(
        parseApiError(err).message || 'Gagal memuat kebutuhan input produk. Silakan coba lagi.'
      );
    } finally {
      setSchemaLoading(false);
    }
  };

  const onSelectProduct = (product: Product) => {
    if (!isProductPurchasable(product) || !purchaseEnabled || !selectedBrand) return;
    setSelectedProduct(product);
    setFormError(null);
    void loadSchema(selectedBrand.name, product.code);
  };

  const onAccountChange = (key: string, value: string, input: string) => {
    const next = input === 'phone' ? value.replace(/\D/g, '') : value;
    setAccount((prev) => ({ ...prev, [key]: next }));
    setFormError(null);
  };

  const goToConfirm = () => {
    if (!canLanjut || !selectedProduct || !selectedBrand || !schemaReady) return;
    if (!accountReady) {
      setFormError('Lengkapi data tujuan langganan terlebih dahulu.');
      return;
    }
    setStep('confirm');
  };

  const openPin = () => {
    if (!selectedProduct || !selectedBrand || !schemaReady || !schema) return;
    if (!accountReady) {
      setFormError('Lengkapi data tujuan langganan terlebih dahulu.');
      return;
    }

    const balance = overview?.wallet?.balance;
    if (typeof balance === 'number' && balance < selectedProduct.price) {
      setFormError('Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.');
      return;
    }
    if (!purchaseEnabled) {
      setFormError(flags.messages.purchase);
      return;
    }

    const target = buildLanggananCustomerNo(schemaFields, account, deliveryRaw);
    if (!target) {
      setFormError('Tujuan transaksi tidak valid.');
      return;
    }

    startCheckout(selectedProduct);
    setTarget(target);
    setPurchaseContext({
      operatorLabel: selectedBrand.name,
      selectedRegion: null,
      plnContext: null,
      gameContext: null,
    });
    setPinError(null);
    setPinOpen(true);
  };

  const onPinSubmit = async (enteredPin: string) => {
    if (pinLockRef.current || submitting) return;
    const state = useCheckoutStore.getState();
    if (!state.skuCode || !state.idempotencyKey || !state.targetNumber) {
      setPinError('Sesi checkout tidak valid. Silakan mulai ulang.');
      return;
    }

    pinLockRef.current = true;
    setSubmitting(true);
    setPinError(null);
    try {
      const response = await transactionService.create({
        sku_code: state.skuCode,
        target_number: state.targetNumber,
        pin: enteredPin,
        idempotency_key: state.idempotencyKey,
      });

      if (response.success && response.data) {
        setTransaction(response.data);
        setStatus(response.data.status);
        setSubmitting(false);
        setPinOpen(false);
        router.replace({
          pathname: '/checkout/result',
          params: { sku: state.skuCode },
        });
        return;
      }

      setSubmitting(false);
      setPinError(response.message || 'Transaksi gagal diproses.');
    } catch (err: unknown) {
      setSubmitting(false);
      const parsed = parseApiError(err);
      const msg = parsed.message || 'Gagal memproses transaksi. Silakan coba lagi.';
      setPinError(
        msg.toLowerCase().includes('pin') ? 'PIN salah\nSilakan coba lagi.' : msg
      );
      if (msg.toLowerCase().includes('pin transaksi salah')) {
        rotateIdempotencyKey();
      }
    } finally {
      pinLockRef.current = false;
    }
  };

  // ——— Brands ———
  if (step === 'brands') {
    return (
      <View style={styles.wrap}>
        <TextInput
          placeholder="Ketik nama aplikasi streaming atau produktivitas..."
          placeholderTextColor={colors.gray[400]}
          value={brandQuery}
          onChangeText={setBrandQuery}
          style={styles.searchInput}
        />
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}
        {brandsLoading && brands.length === 0 ? (
          <LoadingState label="Memuat layanan..." />
        ) : brandsError && brands.length === 0 ? (
          <ErrorState message={brandsError} onRetry={loadBrands} />
        ) : filteredBrands.length === 0 ? (
          <EmptyState title="Belum Ada Layanan" message="Layanan streaming belum tersedia." />
        ) : (
          <View style={styles.brandGrid}>
            {filteredBrands.map((b) => (
              <TouchableOpacity
                key={b.providerId}
                style={styles.brandTile}
                activeOpacity={0.7}
                onPress={() => void selectBrand(b)}
              >
                <Card style={styles.brandCard}>
                  <BrandLogo name={b.name} logo={b.logo} size={40} />
                  <Text style={styles.brandName} numberOfLines={2}>
                    {b.name}
                  </Text>
                  <Text style={styles.brandMeta}>{b.count} paket</Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ——— Buy: products + schema ———
  if (step === 'buy' && selectedBrand) {
    return (
      <View style={styles.wrap}>
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{selectedBrand.name}</Text>

        {!purchaseEnabled ? (
          <PurchaseFlowNotice
            icon="time-outline"
            title="Pembelian Belum Aktif"
            message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
          />
        ) : null}

        <Text style={styles.sectionTitle}>Pilih Paket</Text>

        {productsLoading ? (
          <LoadingState label="Memuat paket..." />
        ) : productsError ? (
          <ErrorState
            message={productsError}
            onRetry={() => selectedBrand && void selectBrand(selectedBrand)}
          />
        ) : listedProducts.length === 0 ? (
          <EmptyState title="Belum Ada Paket" message="Paket untuk layanan ini belum tersedia." />
        ) : (
          <ProductCatalogGrid
            products={listedProducts}
            columns={2}
            selectedCode={selectedProduct?.code ?? null}
            onPress={onSelectProduct}
            isDisabled={(p) => !isProductPurchasable(p) || !purchaseEnabled}
            renderMeta={(p) =>
              !isProductPurchasable(p) ? (
                <Text style={styles.productStatus}>
                  {p.status === 'maintenance' ? 'Maintenance' : 'Tidak tersedia'}
                </Text>
              ) : null
            }
          />
        )}

        {selectedProduct ? (
          <View style={styles.schemaBlock}>
            <Text style={styles.sectionTitle}>Data Tujuan — {selectedProduct.name}</Text>
            {schemaLoading ? (
              <LoadingState label="Memuat kebutuhan input..." />
            ) : schemaError ? (
              <ErrorState
                message={schemaError}
                onRetry={() =>
                  selectedBrand &&
                  selectedProduct &&
                  void loadSchema(selectedBrand.name, selectedProduct.code)
                }
              />
            ) : isVoucher ? (
              <Text style={styles.voucherHint}>
                Paket ini mengirim kode aktivasi otomatis setelah pembayaran — tidak perlu mengisi
                email, nomor HP, atau ID tujuan.
              </Text>
            ) : isAccount && schemaFields.length > 0 ? (
              <View style={styles.fields}>
                {schemaFields.map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.label}>
                      {field.label}
                      {field.required ? '' : ' (opsional)'}
                    </Text>
                    <TextInput
                      value={account[field.key] ?? ''}
                      onChangeText={(t) => onAccountChange(field.key, t, field.input)}
                      placeholder={field.label}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType={
                        field.input === 'email'
                          ? 'email-address'
                          : field.input === 'phone'
                            ? 'phone-pad'
                            : 'default'
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.searchInput}
                    />
                  </View>
                ))}
              </View>
            ) : isAccount ? (
              <Text style={styles.hintWarn}>
                Schema akun kosong untuk produk ini. Hubungi support jika masalah berlanjut.
              </Text>
            ) : null}
          </View>
        ) : null}

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button label="Lanjut" onPress={goToConfirm} disabled={!canLanjut} />
      </View>
    );
  }

  // ——— Confirm ———
  if (step === 'confirm' && selectedProduct && selectedBrand && schemaReady && schema) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Konfirmasi</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Layanan</Text>
            <Text style={styles.rowValue}>{selectedBrand.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Produk</Text>
            <Text style={[styles.rowValue, styles.rowFlex]} numberOfLines={2}>
              {selectedProduct.name}
            </Text>
          </View>
          {isVoucher ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Pengiriman</Text>
              <Text style={[styles.rowValue, styles.rowFlex]} numberOfLines={2}>
                Kode aktivasi setelah pembayaran
              </Text>
            </View>
          ) : (
            schemaFields.map((f) => {
              const val = (account[f.key] || '').trim();
              if (!val && !f.required) return null;
              return (
                <View key={f.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  <Text style={[styles.rowValue, styles.rowFlex]} numberOfLines={2}>
                    {val || '—'}
                  </Text>
                </View>
              );
            })
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total</Text>
            <Text style={styles.rowValue}>{formatIDR(selectedProduct.price)}</Text>
          </View>
        </Card>

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button label="Konfirmasi" onPress={openPin} disabled={!purchaseEnabled || submitting} />

        <PinConfirmModal
          visible={pinOpen}
          title="Masukkan PIN"
          subtitle="Masukkan 6 digit PIN kamu"
          loading={submitting}
          error={pinError}
          dismissible={!submitting}
          onClose={() => {
            if (!submitting) {
              setPinOpen(false);
              setPinError(null);
            }
          }}
          onEditing={() => setPinError(null)}
          onSubmit={onPinSubmit}
          onForgotPin={() => {
            if (submitting) return;
            setPinOpen(false);
            setPinError(null);
            router.push('/akun/pin/forgot');
          }}
        />
      </View>
    );
  }

  return <LoadingState label="Memuat..." />;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
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
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    backgroundColor: colors.white,
    color: colors.gray[900],
  },
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  brandTile: { width: '48%' },
  brandCard: {
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
    minHeight: 108,
  },
  brandName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 18,
  },
  brandMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  productStatus: {
    fontSize: 10,
    color: colors.gray[500],
    fontWeight: typography.weight.bold,
  },
  schemaBlock: { gap: spacing.sm, marginTop: spacing.xs },
  fields: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
  },
  voucherHint: {
    fontSize: typography.size.xs,
    color: colors.gray[600],
    lineHeight: 18,
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
    padding: spacing.md,
  },
  hintWarn: {
    fontSize: typography.size.xs,
    color: colors.status.pending,
    lineHeight: 16,
  },
  error: { fontSize: typography.size.xs, color: colors.status.failed },
  summaryCard: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowLabel: { fontSize: typography.size.sm, color: colors.gray[500] },
  rowValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowFlex: { flex: 1, textAlign: 'right' },
});
