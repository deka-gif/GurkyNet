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
import { CatalogLoadMoreButton } from './CatalogLoadMoreButton';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { sortProvidersByNameAsc } from '../../utils/sortProvidersByName';
import { useProviderProductPager } from '../../hooks/useProviderProductPager';

/**
 * Streaming / Langganan Digital (DigiFlazz schema SoT).
 * Category API: langganan-digital. No inquiry — schema → customer_no → PIN → POST /transactions.
 * Target inputs ABOVE product grid. VIP SKUs excluded from active UI.
 */

type Props = {
  purchaseBanner?: string | null;
};

type Step = 'brands' | 'buy' | 'confirm';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

function isVipSku(code: string): boolean {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .startsWith('VIP-');
}

function fieldKeysEqual(a: LanggananAccountField[], b: LanggananAccountField[]): boolean {
  if (a.length !== b.length) return false;
  const keysA = a.map((f) => f.key).sort();
  const keysB = b.map((f) => f.key).sort();
  return keysA.every((k, i) => k === keysB[i]);
}

function mergeAccount(
  fields: LanggananAccountField[],
  prev: Record<string, string>,
  preserve: boolean
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of fields) {
    next[f.key] = preserve ? String(prev[f.key] ?? '') : '';
  }
  return next;
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

  const {
    products,
    visibleProducts: pagedProducts,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    error: productsError,
    canLoadMore: productsCanLoadMore,
    loadInitial: loadProductsInitial,
    loadMore: loadProductsMore,
    reset: resetProducts,
  } = useProviderProductPager();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [schema, setSchema] = useState<LanggananAccountSchema | null>(null);
  const [schemaFields, setSchemaFields] = useState<LanggananAccountField[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [account, setAccount] = useState<Record<string, string>>({});
  const accountRef = useRef(account);
  accountRef.current = account;
  const schemaFieldsRef = useRef(schemaFields);
  schemaFieldsRef.current = schemaFields;
  const schemaRequestRef = useRef(0);

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
  const schemaReady =
    !!schema && !schemaError && isKnownDelivery && (isVoucher || schemaFields.length > 0);

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

  const listedProducts = useMemo(
    () => pagedProducts.filter((p) => isCatalogListed(p) && !isVipSku(p.code)),
    [pagedProducts]
  );

  const canLanjut =
    purchaseEnabled &&
    !!selectedProduct &&
    isProductPurchasable(selectedProduct) &&
    !isVipSku(selectedProduct.code) &&
    schemaReady &&
    accountReady &&
    !schemaLoading &&
    !productsLoading;

  const clearSchemaState = useCallback(() => {
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
      resetProducts();
      clearSchemaState();
      setStep('brands');
    }
  }, [step, clearSchemaState, resetProducts]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step === 'brands') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, step, goBackStep]);

  const applySchemaData = useCallback(
    (data: LanggananAccountSchema, preserveAccount: boolean) => {
      const d = String(data.delivery ?? '').trim().toLowerCase();
      if (d !== 'account' && d !== 'voucher') {
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          d === 'unknown' || d === ''
            ? 'Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'
            : `Tipe pengiriman produk tidak didukung (${data.delivery || 'kosong'}).`
        );
        return;
      }
      const fields = Array.isArray(data.fields) ? data.fields : [];
      if (d === 'account' && fields.length === 0) {
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          'Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'
        );
        return;
      }
      const prevFields = schemaFieldsRef.current;
      const preserve =
        preserveAccount && d === 'account' && fieldKeysEqual(prevFields, fields);
      setSchema({ ...data, delivery: d });
      setSchemaFields(fields);
      setSchemaError(null);
      setAccount(d === 'voucher' ? {} : mergeAccount(fields, accountRef.current, preserve));
    },
    []
  );

  const loadSchemaForSku = useCallback(
    async (brandName: string, sku: string, preserveAccount: boolean) => {
      const reqId = ++schemaRequestRef.current;
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const res = await langgananService.accountSchema(brandName, sku);
        if (reqId !== schemaRequestRef.current) return;
        if (res.success && res.data) {
          applySchemaData(res.data, preserveAccount);
        } else {
          setSchema(null);
          setSchemaFields([]);
          setAccount({});
          setSchemaError(res.message || 'Gagal memuat kebutuhan input produk. Silakan coba lagi.');
        }
      } catch (err: unknown) {
        if (reqId !== schemaRequestRef.current) return;
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          parseApiError(err).message || 'Gagal memuat kebutuhan input produk. Silakan coba lagi.'
        );
      } finally {
        if (reqId === schemaRequestRef.current) {
          setSchemaLoading(false);
        }
      }
    },
    [applySchemaData]
  );

  /** First Digi SKU with proven schema (account or voucher). Fail-closed if none. */
  const loadBrandDigiSchema = useCallback(
    async (brandName: string, list: Product[]) => {
      const digi = list.filter((p) => isCatalogListed(p) && !isVipSku(p.code));
      const purchasable = digi.filter((p) => isProductPurchasable(p));
      const pool = (purchasable.length > 0 ? purchasable : digi).slice(0, 12);
      if (pool.length === 0) {
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          'Tidak ada produk DigiFlazz aktif untuk layanan ini. Pembelian tidak dapat dilanjutkan.'
        );
        setSchemaLoading(false);
        return;
      }

      const reqId = ++schemaRequestRef.current;
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        // Prefer Digi account schema (phone/email/…) for target-first UX; voucher only if none.
        let voucherFallback: LanggananAccountSchema | null = null;
        for (const p of pool) {
          if (reqId !== schemaRequestRef.current) return;
          const res = await langgananService.accountSchema(brandName, p.code);
          if (reqId !== schemaRequestRef.current) return;
          if (!res.success || !res.data) continue;
          const d = String(res.data.delivery ?? '').trim().toLowerCase();
          const fields = Array.isArray(res.data.fields) ? res.data.fields : [];
          if (d === 'account' && fields.length > 0) {
            applySchemaData(res.data, false);
            return;
          }
          if (d === 'voucher' && !voucherFallback) {
            voucherFallback = res.data;
          }
        }
        if (voucherFallback) {
          applySchemaData(voucherFallback, false);
          return;
        }
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          'Format target DigiFlazz untuk layanan ini belum terbukti. Pembelian tidak dapat dilanjutkan.'
        );
      } catch (err: unknown) {
        if (reqId !== schemaRequestRef.current) return;
        setSchema(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          parseApiError(err).message || 'Gagal memuat kebutuhan input produk. Silakan coba lagi.'
        );
      } finally {
        if (reqId === schemaRequestRef.current) {
          setSchemaLoading(false);
        }
      }
    },
    [applySchemaData]
  );

  const selectBrand = async (brand: CategoryProviderSummary) => {
    setSelectedBrand(brand);
    setStep('buy');
    resetProducts();
    clearSchemaState();
    setSchemaLoading(true);
    try {
      const result = await loadProductsInitial({
        category: 'langganan-digital',
        provider_id: brand.providerId,
      });
      const loaded = result?.products ?? [];
      if (loaded.length > 0) {
        await loadBrandDigiSchema(brand.name, loaded);
      } else {
        setSchemaLoading(false);
      }
    } catch (err: unknown) {
      setSchemaLoading(false);
      setFormError(parseApiError(err).message || 'Gagal memuat paket.');
    }
  };

  const onSelectProduct = (product: Product) => {
    if (!isProductPurchasable(product) || !purchaseEnabled || !selectedBrand) return;
    if (isVipSku(product.code)) return;
    setSelectedProduct(product);
    setFormError(null);
    void loadSchemaForSku(selectedBrand.name, product.code, true);
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

  // ——— Buy: Digi target ABOVE products ———
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

        {schemaLoading ? (
          <LoadingState label="Memuat kebutuhan input..." />
        ) : schemaError ? (
          <ErrorState
            message={schemaError}
            onRetry={() => {
              if (!selectedBrand) return;
              if (selectedProduct) {
                void loadSchemaForSku(selectedBrand.name, selectedProduct.code, true);
              } else {
                void loadBrandDigiSchema(selectedBrand.name, products);
              }
            }}
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
                  style={styles.underlineInput}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hintWarn}>
            Menunggu schema DigiFlazz untuk menampilkan form target…
          </Text>
        )}

        <Text style={styles.sectionTitle}>Jenis Voucher</Text>

        {productsLoading ? (
          <LoadingState label="Memuat paket..." />
        ) : productsError ? (
          <ErrorState
            message={productsError}
            onRetry={() => selectedBrand && void selectBrand(selectedBrand)}
          />
        ) : listedProducts.length === 0 ? (
          <EmptyState
            title="Belum Ada Paket"
            message="Paket DigiFlazz untuk layanan ini belum tersedia."
          />
        ) : (
          <>
            <ProductCatalogGrid
              products={listedProducts}
              columns={3}
              selectedCode={selectedProduct?.code ?? null}
              onPress={onSelectProduct}
              isDisabled={(p) => !isProductPurchasable(p) || !purchaseEnabled || isVipSku(p.code)}
              renderMeta={(p) =>
                !isProductPurchasable(p) ? (
                  <Text style={styles.productStatus}>
                    {p.status === 'maintenance' ? 'Maintenance' : 'Tidak tersedia'}
                  </Text>
                ) : null
              }
            />
            <CatalogLoadMoreButton
              visible={productsCanLoadMore}
              loading={productsLoadingMore}
              onPress={() => void loadProductsMore()}
            />
          </>
        )}

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
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[300],
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.size.base,
    color: colors.gray[900],
    backgroundColor: 'transparent',
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
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    marginTop: spacing.xs,
  },
  productStatus: {
    fontSize: 10,
    color: colors.gray[500],
    fontWeight: typography.weight.bold,
  },
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
