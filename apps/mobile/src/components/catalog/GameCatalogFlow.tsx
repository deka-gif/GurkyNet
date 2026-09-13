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
  buildGameCustomerNo,
  gameService,
  GameAccountField,
  GameInquiryResult,
  isGameNonPurchaseSku,
} from '../../services/game.service';
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
import { stripGameProductDisplayName } from '../../utils/stripGameProductDisplayName';
import { useProviderProductPager } from '../../hooks/useProviderProductPager';

/**
 * Mobile Game catalog + DigiFlazz purchase (FR catalog game).
 *
 * Flow: game list → buy (target ABOVE products) → Lanjut → review → PIN
 * → POST /transactions → result.
 * VIP get-nickname is optional UX only — never a purchase gate.
 * Schema is Digi/SKU evidence; VIP SKUs and Cek Username utility SKUs are hidden.
 */

type Props = {
  purchaseBanner?: string | null;
};

type Step = 'games' | 'buy' | 'confirm';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

function isVipSku(code: string): boolean {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .startsWith('VIP-');
}

function isAccountReady(fields: GameAccountField[], account: Record<string, string>): boolean {
  return fields.every((f) => {
    if (!f.required) return true;
    return String(account[f.key] ?? '').trim().length > 0;
  });
}

function fieldKeysEqual(a: GameAccountField[], b: GameAccountField[]): boolean {
  if (a.length !== b.length) return false;
  const keysA = a.map((f) => f.key).sort();
  const keysB = b.map((f) => f.key).sort();
  return keysA.every((k, i) => k === keysB[i]);
}

function mergeAccount(
  fields: GameAccountField[],
  prev: Record<string, string>,
  preserve: boolean
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of fields) {
    next[f.key] = preserve ? String(prev[f.key] ?? '') : '';
  }
  return next;
}

export function GameCatalogFlow({ purchaseBanner }: Props) {
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

  const [step, setStep] = useState<Step>('games');
  const [providers, setProviders] = useState<CategoryProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<CategoryProviderSummary | null>(null);

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

  const [schemaFields, setSchemaFields] = useState<GameAccountField[]>([]);
  const [schemaDelivery, setSchemaDelivery] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [account, setAccount] = useState<Record<string, string>>({});
  const accountRef = useRef(account);
  accountRef.current = account;
  const schemaFieldsRef = useRef(schemaFields);
  schemaFieldsRef.current = schemaFields;

  const [inquiry, setInquiry] = useState<GameInquiryResult | null>(null);
  const [inquiring, setInquiring] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const pinLockRef = useRef(false);
  const schemaRequestRef = useRef(0);

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const res = await catalogService.getCategoryProviders('game');
      if (res.success && Array.isArray(res.data)) {
        setProviders(sortProvidersByNameAsc(res.data));
      } else {
        setProviders([]);
        setProvidersError(res.message || 'Gagal memuat daftar game.');
      }
    } catch (err: unknown) {
      setProviders([]);
      setProvidersError(parseApiError(err).message || 'Gagal memuat daftar game.');
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
    void fetchWallet();
  }, [loadProviders, fetchWallet]);

  const filteredGames = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    const list = !q
      ? providers
      : providers.filter((p) => String(p.name ?? '').toLowerCase().includes(q));
    return sortProvidersByNameAsc(list);
  }, [providers, providerQuery]);

  // DigiFlazz-only top-up listing (VIP + Cek Username utility SKUs hidden).
  const listedProducts = useMemo(
    () =>
      pagedProducts.filter(
        (p) => isCatalogListed(p) && !isVipSku(p.code) && !isGameNonPurchaseSku(p.code)
      ),
    [pagedProducts]
  );

  const accountReady = isAccountReady(schemaFields, account);
  const schemaOk =
    schemaDelivery === 'account' &&
    schemaFields.length > 0 &&
    !schemaError &&
    !schemaLoading;

  const canLanjut =
    purchaseEnabled &&
    !!selectedProduct &&
    isProductPurchasable(selectedProduct) &&
    !isVipSku(selectedProduct.code) &&
    !isGameNonPurchaseSku(selectedProduct.code) &&
    schemaOk &&
    accountReady &&
    !productsLoading &&
    !inquiring;

  const invalidateInquiry = useCallback(() => {
    setInquiry(null);
    setInquiryError(null);
  }, []);

  const goBackStep = useCallback(() => {
    setFormError(null);
    setPinOpen(false);
    setPinError(null);
    if (step === 'confirm') {
      invalidateInquiry();
      setStep('buy');
      return;
    }
    if (step === 'buy') {
      setSelectedGame(null);
      resetProducts();
      setSelectedProduct(null);
      setSchemaFields([]);
      setSchemaDelivery(null);
      setSchemaError(null);
      setAccount({});
      invalidateInquiry();
      setStep('games');
    }
  }, [step, invalidateInquiry, resetProducts]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (step === 'games') return;
      if (!isBackAction(e.data.action)) return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, step, goBackStep]);

  const applySchemaResponse = useCallback(
    (
      brand: string,
      sku: string,
      data: { delivery?: string; fields?: GameAccountField[] },
      preserveAccount: boolean
    ) => {
      const delivery = String(data.delivery ?? '').trim().toLowerCase();
      const fields = Array.isArray(data.fields) ? data.fields : [];
      if (delivery !== 'account' || fields.length === 0) {
        setSchemaDelivery(delivery || 'unknown');
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          delivery === 'unknown' || delivery === ''
            ? 'Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'
            : `Format akun produk tidak didukung (${data.delivery || 'kosong'}).`
        );
        return;
      }
      const prevFields = schemaFieldsRef.current;
      const preserve = preserveAccount && fieldKeysEqual(prevFields, fields);
      setSchemaDelivery('account');
      setSchemaFields(fields);
      setSchemaError(null);
      setAccount(mergeAccount(fields, accountRef.current, preserve));
      void brand;
      void sku;
    },
    []
  );

  const loadSchemaForSku = useCallback(
    async (brand: string, sku: string, preserveAccount: boolean) => {
      const reqId = ++schemaRequestRef.current;
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const res = await gameService.accountSchema(brand, sku);
        if (reqId !== schemaRequestRef.current) return;
        if (!res.success || !res.data) {
          setSchemaDelivery(null);
          setSchemaFields([]);
          setAccount({});
          setSchemaError(res.message || 'Format akun produk belum tersedia. Silakan coba lagi.');
          return;
        }
        applySchemaResponse(brand, sku, res.data, preserveAccount);
      } catch (err: unknown) {
        if (reqId !== schemaRequestRef.current) return;
        setSchemaDelivery(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(parseApiError(err).message || 'Gagal memuat form akun game. Silakan coba lagi.');
      } finally {
        if (reqId === schemaRequestRef.current) {
          setSchemaLoading(false);
        }
      }
    },
    [applySchemaResponse]
  );

  /** Load first Digi SKU with proven Digi account schema (fail-closed if none). */
  const loadBrandDigiSchema = useCallback(
    async (brand: string, list: Product[]) => {
      const digi = list.filter(
        (p) => isCatalogListed(p) && !isVipSku(p.code) && !isGameNonPurchaseSku(p.code)
      );
      const purchasable = digi.filter((p) => isProductPurchasable(p));
      const pool = (purchasable.length > 0 ? purchasable : digi).slice(0, 12);
      if (pool.length === 0) {
        setSchemaDelivery('unknown');
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          'Tidak ada produk DigiFlazz aktif untuk game ini. Pembelian tidak dapat dilanjutkan.'
        );
        setSchemaLoading(false);
        return;
      }

      const reqId = ++schemaRequestRef.current;
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        for (const p of pool) {
          if (reqId !== schemaRequestRef.current) return;
          const res = await gameService.accountSchema(brand, p.code);
          if (reqId !== schemaRequestRef.current) return;
          if (!res.success || !res.data) continue;
          const delivery = String(res.data.delivery ?? '').trim().toLowerCase();
          const fields = Array.isArray(res.data.fields) ? res.data.fields : [];
          if (delivery === 'account' && fields.length > 0) {
            applySchemaResponse(brand, p.code, res.data, false);
            return;
          }
        }
        setSchemaDelivery('unknown');
        setSchemaFields([]);
        setAccount({});
        setSchemaError(
          'Format akun DigiFlazz untuk game ini belum terbukti. Pembelian tidak dapat dilanjutkan.'
        );
      } catch (err: unknown) {
        if (reqId !== schemaRequestRef.current) return;
        setSchemaDelivery(null);
        setSchemaFields([]);
        setAccount({});
        setSchemaError(parseApiError(err).message || 'Gagal memuat form akun game. Silakan coba lagi.');
      } finally {
        if (reqId === schemaRequestRef.current) {
          setSchemaLoading(false);
        }
      }
    },
    [applySchemaResponse]
  );

  const selectGame = async (game: CategoryProviderSummary) => {
    setSelectedGame(game);
    setStep('buy');
    resetProducts();
    setSelectedProduct(null);
    setSchemaFields([]);
    setSchemaDelivery(null);
    setSchemaError(null);
    setAccount({});
    invalidateInquiry();
    setFormError(null);
    setSchemaLoading(true);
    try {
      const result = await loadProductsInitial({
        category: 'game',
        provider_id: game.providerId,
      });
      const loaded = result?.products ?? [];
      if (loaded.length > 0) {
        await loadBrandDigiSchema(game.name, loaded);
      } else {
        setSchemaLoading(false);
      }
    } catch (err: unknown) {
      setSchemaLoading(false);
      setFormError(parseApiError(err).message || 'Gagal memuat produk game.');
    }
  };

  const onAccountChange = (key: string, value: string) => {
    invalidateInquiry();
    setAccount((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
    setInquiryError(null);
  };

  const onSelectProduct = (product: Product) => {
    if (!isProductPurchasable(product) || !purchaseEnabled || !selectedGame) return;
    if (isVipSku(product.code) || isGameNonPurchaseSku(product.code)) return;
    if (selectedProduct?.code !== product.code) {
      invalidateInquiry();
    }
    setSelectedProduct(product);
    setFormError(null);
    void loadSchemaForSku(selectedGame.name, product.code, true);
  };

  /** Digi path: build customer_no locally; optional VIP nickname for review only. */
  const runReviewAndConfirm = async () => {
    if (!canLanjut || !selectedProduct || !selectedGame) return;

    setInquiring(true);
    setInquiryError(null);
    setFormError(null);
    setInquiry(null);
    try {
      const payload: Record<string, string> = {};
      for (const f of schemaFields) {
        const v = String(account[f.key] ?? '').trim();
        if (v) payload[f.key] = v;
      }

      let customerNo: string;
      try {
        customerNo = buildGameCustomerNo(schemaFields, payload);
      } catch (e: unknown) {
        setFormError(e instanceof Error ? e.message : 'Data akun game wajib diisi.');
        return;
      }

      const zone =
        payload.zone_id || payload.server_id
          ? String(payload.zone_id || payload.server_id).trim()
          : null;
      const userId =
        payload.user_id ||
        payload.player_id ||
        payload.uid ||
        payload.garena_id ||
        customerNo.split('|')[0];

      let nickname: string | null = null;
      let inquiryRef: string | null = null;
      // Optional VIP lookup — failure must not block Digi purchase.
      try {
        const res = await gameService.inquire(selectedProduct.code, payload);
        if (res.success && res.data) {
          if (res.data.customer_no) {
            customerNo = res.data.customer_no;
          }
          if (res.data.nickname) {
            nickname = res.data.nickname;
          }
          if (res.data.inquiry_ref_id) {
            inquiryRef = res.data.inquiry_ref_id;
          }
        }
      } catch {
        // ignore
      }

      const draft: GameInquiryResult = {
        inquiry_ref_id: inquiryRef,
        sku_code: selectedProduct.code,
        product_name: selectedProduct.name,
        game: selectedGame.name,
        brand: selectedGame.name,
        user_id: userId,
        zone_id: zone,
        customer_no: customerNo,
        id_zone_label: zone ? `${userId} (${zone})` : userId,
        nickname,
        item: selectedProduct.name,
        price: selectedProduct.price,
        found: !!nickname,
        nickname_optional: true,
        expires_in_seconds: 20 * 60,
      };
      setInquiry(draft);
      setStep('confirm');
    } catch (err: unknown) {
      setInquiryError(parseApiError(err).message || 'Gagal menyiapkan review pembelian.');
    } finally {
      setInquiring(false);
    }
  };

  const openPin = () => {
    if (!inquiry || !selectedProduct || !selectedGame) return;
    if (!inquiry.customer_no) {
      setFormError('Data akun belum lengkap. Tekan Kembali dan Lanjut ulang.');
      return;
    }
    if (inquiry.sku_code !== selectedProduct.code) {
      setFormError('Produk berubah. Isi ulang akun.');
      invalidateInquiry();
      setStep('buy');
      return;
    }

    const price = inquiry.price ?? selectedProduct.price;
    const balance = overview?.wallet?.balance;
    if (typeof balance === 'number' && balance < price) {
      setFormError('Saldo GurkyPay Anda tidak mencukupi untuk top up game ini.');
      return;
    }
    if (!purchaseEnabled) {
      setFormError(flags.messages.purchase);
      return;
    }

    startCheckout(selectedProduct);
    setTarget(inquiry.customer_no);
    setPurchaseContext({
      operatorLabel: selectedGame.name,
      selectedRegion: null,
      plnContext: null,
      gameContext: {
        inquiry,
        brand: selectedGame.name,
        expiresAt: Date.now() + 20 * 60 * 1000,
      },
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

  // ——— Game list ———
  if (step === 'games') {
    return (
      <View style={styles.wrap}>
        <TextInput
          placeholder="Ketik nama game yang ingin Anda top up..."
          placeholderTextColor={colors.gray[400]}
          value={providerQuery}
          onChangeText={setProviderQuery}
          style={styles.searchInput}
        />
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}
        {providersLoading && providers.length === 0 ? (
          <LoadingState label="Memuat daftar game..." />
        ) : providersError && providers.length === 0 ? (
          <ErrorState message={providersError} onRetry={loadProviders} />
        ) : filteredGames.length === 0 ? (
          <EmptyState title="Belum Ada Game" message="Game untuk kategori ini belum tersedia." />
        ) : (
          <View style={styles.gameGrid}>
            {filteredGames.map((g) => (
              <TouchableOpacity
                key={g.providerId}
                style={styles.gameTile}
                activeOpacity={0.7}
                onPress={() => void selectGame(g)}
              >
                <Card style={styles.gameCard}>
                  <BrandLogo name={g.name} logo={g.logo} size={40} />
                  <Text style={styles.gameName} numberOfLines={2}>
                    {g.name}
                  </Text>
                  <Text style={styles.gameMeta}>{g.count} produk</Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ——— Buy page: Digi target inputs ABOVE products ———
  if (step === 'buy' && selectedGame) {
    return (
      <View style={styles.wrap}>
        {purchaseBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{purchaseBanner}</Text>
          </View>
        ) : null}

        <Text style={styles.gameTitle}>{selectedGame.name}</Text>

        {!purchaseEnabled ? (
          <PurchaseFlowNotice
            icon="time-outline"
            title="Pembelian Belum Aktif"
            message={purchaseBanner || 'Fitur pembelian produk belum diaktifkan.'}
          />
        ) : null}

        {schemaLoading ? (
          <LoadingState label="Memuat form akun..." />
        ) : schemaError ? (
          <ErrorState
            message={schemaError}
            onRetry={() => {
              if (!selectedGame) return;
              if (selectedProduct) {
                void loadSchemaForSku(selectedGame.name, selectedProduct.code, true);
              } else {
                void loadBrandDigiSchema(selectedGame.name, products);
              }
            }}
          />
        ) : schemaOk ? (
          <View style={styles.accountBlock}>
            <View style={styles.accountLabels}>
              {schemaFields.map((field) => (
                <Text
                  key={`label-${field.key}`}
                  style={[
                    styles.accountLabel,
                    schemaFields.length === 1 ? styles.accountFieldSingle : styles.accountFieldHalf,
                  ]}
                >
                  {field.label}
                  {field.required ? '' : ' (opsional)'}
                </Text>
              ))}
            </View>
            <View style={styles.accountRow}>
              {schemaFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    styles.accountField,
                    schemaFields.length === 1 ? styles.accountFieldSingle : styles.accountFieldHalf,
                  ]}
                >
                  <TextInput
                    value={account[field.key] ?? ''}
                    onChangeText={(t) => onAccountChange(field.key, t)}
                    placeholder={field.label}
                    placeholderTextColor={colors.gray[400]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!inquiring}
                    style={styles.underlineInput}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.hintWarn}>
            Menunggu schema DigiFlazz untuk menampilkan form target…
          </Text>
        )}

        <Text style={styles.sectionTitle}>Jenis Voucher</Text>

        {productsLoading ? (
          <LoadingState label="Memuat produk..." />
        ) : productsError ? (
          <ErrorState
            message={productsError}
            onRetry={() => selectedGame && void selectGame(selectedGame)}
          />
        ) : listedProducts.length === 0 ? (
          <EmptyState title="Belum Ada Produk" message="Produk DigiFlazz untuk game ini belum tersedia." />
        ) : (
          <>
            <ProductCatalogGrid
              products={listedProducts}
              columns={3}
              selectedCode={selectedProduct?.code ?? null}
              onPress={onSelectProduct}
              isDisabled={(p) =>
                !isProductPurchasable(p) ||
                !purchaseEnabled ||
                isVipSku(p.code) ||
                isGameNonPurchaseSku(p.code)
              }
              getDisplayName={(p) =>
                stripGameProductDisplayName(p.name, selectedGame.name || p.operatorName)
              }
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

        {inquiryError ? <Text style={styles.error}>{inquiryError}</Text> : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button
          label={inquiring ? 'Menyiapkan...' : 'Lanjut'}
          onPress={() => void runReviewAndConfirm()}
          loading={inquiring}
          disabled={!canLanjut}
        />
      </View>
    );
  }

  // ——— Confirm (Digi customer_no; nickname optional) ———
  if (step === 'confirm' && inquiry && selectedProduct && selectedGame) {
    const displayProduct =
      inquiry.item ||
      stripGameProductDisplayName(selectedProduct.name, selectedGame.name);
    const total = inquiry.price ?? selectedProduct.price;

    return (
      <View style={styles.wrap}>
        <Text style={styles.gameTitle}>{inquiry.game || selectedGame.name}</Text>

        <Card style={styles.summaryCard}>
          {schemaFields.map((field) => {
            const raw = String(account[field.key] ?? '').trim();
            if (!raw && !field.required) return null;
            const fromInquiry =
              field.key === 'zone_id' || field.key.includes('zone') || field.key.includes('server')
                ? inquiry.zone_id
                : field.key === 'user_id' ||
                    field.key === 'player_id' ||
                    field.key === 'uid' ||
                    field.key === 'garena_id'
                  ? inquiry.user_id
                  : null;
            return (
              <View key={field.key} style={styles.row}>
                <Text style={styles.rowLabel}>{field.label}</Text>
                <Text style={styles.rowValue}>{fromInquiry || raw || '—'}</Text>
              </View>
            );
          })}
          {inquiry.nickname ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Nickname</Text>
              <Text style={[styles.rowValue, styles.rowValueFlex]} numberOfLines={2}>
                {inquiry.nickname}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Produk</Text>
            <Text style={[styles.rowValue, styles.rowValueFlex]} numberOfLines={2}>
              {displayProduct}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total</Text>
            <Text style={styles.rowValue}>{formatIDR(total)}</Text>
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
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  gameTile: { width: '48%' },
  gameCard: {
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
    minHeight: 108,
  },
  gameName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
    lineHeight: 18,
  },
  gameMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  gameTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  accountBlock: { gap: spacing.xs },
  accountLabels: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  accountLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[700],
    minWidth: 0,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  accountField: {
    minWidth: 0,
  },
  accountFieldHalf: {
    flex: 1,
  },
  accountFieldSingle: {
    flex: 1,
    maxWidth: '100%',
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[300],
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.size.base,
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
  rowValueFlex: { flex: 1, textAlign: 'right' },
});
