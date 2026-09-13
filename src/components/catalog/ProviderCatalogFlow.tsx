import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { parseApiError } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ewalletService, EwalletInquiryResult } from '../../services/ewallet/ewallet.service';
import { CategoryProviderSummary, productService } from '../../services/product/product.service';
import {
  CATALOG_PRODUCT_PAGE_SIZE,
  mergeCatalogProductPages,
  shouldPaginateCatalogProducts,
  unwrapCatalogPagination,
} from '../../utils/catalogProductPaging';
import {
  gameService,
  GameAccountField,
  GameInquiryResult,
  buildGameCustomerNo,
  isGameNonPurchaseSku,
} from '../../services/game/game.service';
import {
  langgananService,
  LanggananAccountField,
  buildLanggananCustomerNo,
  langgananAccountReady as isLanggananAccountReady,
} from '../../services/langganan/langganan.service';
import {
  catalogStatusLabel,
  isCatalogListed,
  isProductPurchasable,
} from '../../utils/catalogAvailability';
import { BrandAvatar, providerLogoFromProduct } from './BrandAvatar';

export type CatalogTargetMode = 'phone' | 'game' | 'customer' | 'none';

export interface ProviderCatalogFlowProps {
  category: string;
  title: string;
  subtitle: string;
  serviceName: string;
  returnPath: string;
  targetMode: CatalogTargetMode;
  targetLabel?: string;
  targetPlaceholder?: string;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  providerSearchPlaceholder?: string;
  /** Digiflazz E-Money / VIP game nickname / voucher|langganan summary before PIN. */
  inquiryMode?: 'none' | 'ewallet' | 'game' | 'voucher' | 'langganan';
}

const TECHNICAL_ERROR_PATTERNS = [
  /^server error$/i,
  /^internal server error$/i,
  /request failed with status code/i,
  /^network error$/i,
  /^axios/i,
];

/** NFR 8.5 — jangan tampilkan pesan teknis mentah ke user. */
function humanizeCatalogError(raw: unknown, fallback: string): string {
  const msg = String(raw ?? '').trim();
  if (!msg) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((re) => re.test(msg))) return fallback;
  return msg;
}

function resolveInquiryError(err: unknown, fallback: string): string {
  const parsed = parseApiError(err);
  const fromField =
    parsed.errors?.inquiry?.[0] ||
    parsed.errors?.sku_code?.[0] ||
    parsed.errors?.customer_no?.[0];
  return humanizeCatalogError(fromField || parsed.message, fallback);
}

/**
 * Production PPOB pattern: Provider → Produk → Target → Checkout (PIN via CheckoutSummary).
 * Products: step 1 GET /products/providers?category=..., step 2 GET /products?category=...&provider_id=...
 */
export function ProviderCatalogFlow({
  category,
  title,
  subtitle,
  serviceName,
  returnPath,
  targetMode,
  targetLabel,
  targetPlaceholder,
  secondaryLabel = 'Server / Zone ID',
  secondaryPlaceholder = 'Contoh: 1234',
  providerSearchPlaceholder = 'Cari provider...',
  inquiryMode = 'none',
}: ProviderCatalogFlowProps) {
  const isEwalletInquiry = inquiryMode === 'ewallet';
  const isGameInquiry = inquiryMode === 'game';
  const isVoucherMode = inquiryMode === 'voucher';
  const isLanggananMode = inquiryMode === 'langganan';
  /** No customer inquiry — summary popup then PIN (voucher only). */
  const isSummaryCheckoutMode = isVoucherMode;
  const { wallet, fetchWallet, syncAuthoritativeBalance } = useWalletStore();
  const {
    fetchProducts,
    categoryProviders,
    categoryProvidersLoading,
    fetchCategoryProviders,
  } = useProductStore();
  const toast = useToast();

  /** Providers-first paged list (threshold 30 / page 20) — not the global store dump. */
  const [pagedProducts, setPagedProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productLastPage, setProductLastPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);

  const showFlowError = useCallback(
    (description: string) => {
      toast.error('Perhatian', description, 'provider-catalog-flow');
    },
    [toast]
  );

  const showFlowSuccess = useCallback(
    (description: string) => {
      toast.success('Transaksi Berhasil', description, 'provider-catalog-flow');
    },
    [toast]
  );

  const [step, setStep] = useState<'provider' | 'products'>('provider');
  const [providerQuery, setProviderQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedProviderMeta, setSelectedProviderMeta] = useState<CategoryProviderSummary | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetNo, setTargetNo] = useState('');
  const [ewalletAmount, setEwalletAmount] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [inquiring, setInquiring] = useState(false);
  const [ewalletInquiry, setEwalletInquiry] = useState<EwalletInquiryResult | null>(null);
  const [gameInquiry, setGameInquiry] = useState<GameInquiryResult | null>(null);
  const [gameFields, setGameFields] = useState<GameAccountField[]>([]);
  const [gameAccount, setGameAccount] = useState<Record<string, string>>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [langgananFields, setLanggananFields] = useState<LanggananAccountField[]>([]);
  const [langgananAccount, setLanggananAccount] = useState<Record<string, string>>({});
  const [langgananDelivery, setLanggananDelivery] = useState<string>('unknown');
  const [langgananSchemaLoading, setLanggananSchemaLoading] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchCategoryProviders(category);
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchCategoryProviders, category, returnPath]);

  useEffect(() => {
    if (!isGameInquiry || !selectedProvider || !selectedProduct || step !== 'products') {
      if (!selectedProduct && isGameInquiry) {
        setGameFields([]);
        setGameAccount({});
      }
      return;
    }
    let cancelled = false;
    setSchemaLoading(true);
    setGameFields([]);
    setGameAccount({});
    void gameService
      .accountSchema(selectedProvider, selectedProduct.code)
      .then((res) => {
        if (cancelled) return;
        const delivery = String(res.data?.delivery ?? '').trim().toLowerCase();
        const fields = Array.isArray(res.data?.fields) ? res.data.fields : [];
        if (res.success && delivery === 'account' && fields.length > 0) {
          setGameFields(fields);
        } else {
          setGameFields([]);
        }
      })
      .catch(() => {
        if (!cancelled) setGameFields([]);
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGameInquiry, selectedProvider, selectedProduct, step]);

  useEffect(() => {
    if (!isLanggananMode || !selectedProvider || !selectedProduct || step !== 'products') {
      if (!selectedProduct && isLanggananMode) {
        setLanggananFields([]);
        setLanggananAccount({});
        setLanggananDelivery('unknown');
      }
      return;
    }
    let cancelled = false;
    setLanggananSchemaLoading(true);
    setLanggananFields([]);
    setLanggananAccount({});
    void langgananService
      .accountSchema(selectedProvider, selectedProduct.code)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const d = String(res.data.delivery ?? '').trim().toLowerCase();
          setLanggananFields(res.data.fields || []);
          setLanggananDelivery(d || 'unknown');
        } else {
          setLanggananFields([]);
          setLanggananDelivery('unknown');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanggananFields([]);
          setLanggananDelivery('unknown');
        }
      })
      .finally(() => {
        if (!cancelled) setLanggananSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLanggananMode, selectedProvider, selectedProduct, step]);

  const providers = useMemo(() => {
    return categoryProviders.map((cp) => ({
      providerId: cp.providerId,
      name: cp.name,
      count: cp.count,
      logo: providerLogoFromProduct({ providerDetails: { logo: cp.logo } }),
    }));
  }, [categoryProviders]);

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => String(p.name ?? '').toLowerCase().includes(q));
  }, [providers, providerQuery]);

  const providerProducts = useMemo(() => {
    if (!selectedProvider) return [];
    return pagedProducts
      .filter(
        (p) =>
          isCatalogListed(p) &&
          isProductPurchasable(p) &&
          String(p.operatorName ?? '').trim().toLowerCase() === selectedProvider.toLowerCase() &&
          !(isGameInquiry && (String(p.code ?? '').toUpperCase().startsWith('VIP-') || isGameNonPurchaseSku(p.code))) &&
          // E-Wallet: Digiflazz Bebas Nominal / Pascabayar only — never prepaid fixed denoms.
          (!isEwalletInquiry ||
            p.is_open_amount === true ||
            /bebas\s*nominal/i.test(String(p.name ?? '')))
      )
      .sort((a, b) => a.price - b.price);
  }, [pagedProducts, selectedProvider, isGameInquiry, isEwalletInquiry]);

  const productsCanLoadMore =
    shouldPaginateCatalogProducts(productTotal) && productPage < productLastPage;

  const phoneReady = !isEwalletInquiry || targetNo.replace(/\D/g, '').length >= 10;
  const gameAccountReady =
    !isGameInquiry ||
    (gameFields.length > 0 &&
      gameFields.every((f) => !f.required || (gameAccount[f.key] || '').trim() !== ''));
  const langgananReady =
    !isLanggananMode ||
    !selectedProduct ||
    (
      !langgananSchemaLoading &&
      (
        langgananDelivery === 'voucher' ||
        (langgananDelivery === 'account' &&
          langgananFields.length > 0 &&
          isLanggananAccountReady(langgananFields, langgananAccount))
      )
    );
  // Game schema is SKU-specific — always show products; gate Lanjut via gameAccountReady.
  const showProducts = !isEwalletInquiry || phoneReady;

  const resolvedTargetLabel =
    targetLabel ||
    (targetMode === 'phone'
      ? 'Nomor HP'
      : targetMode === 'game'
        ? 'ID Game'
        : targetMode === 'customer'
          ? 'No. Pelanggan / Tujuan'
          : 'Target');

  const resolvedTargetPlaceholder =
    targetPlaceholder ||
    (targetMode === 'phone'
      ? '08xxxxxxxxxx'
      : targetMode === 'game'
        ? 'Masukkan ID Game'
        : 'Masukkan nomor tujuan');

  const selectProvider = async (cp: CategoryProviderSummary) => {
    setSelectedProvider(cp.name);
    setSelectedProviderMeta(cp);
    setSelectedProduct(null);
    setEwalletInquiry(null);
    setEwalletAmount('');
    setGameInquiry(null);
    setTargetNo('');
    setSecondaryValue('');
    setGameAccount({});
    setLanggananFields([]);
    setLanggananAccount({});
    setLanggananDelivery('unknown');
    setStep('products');
    setPagedProducts([]);
    setProductPage(1);
    setProductLastPage(1);
    setProductTotal(0);
    setProductsLoading(true);
    try {
      const res = await productService.getProducts({
        category,
        provider_id: cp.providerId,
        page: 1,
        per_page: CATALOG_PRODUCT_PAGE_SIZE,
      });
      const rows = res.success && Array.isArray(res.data) ? res.data : [];
      const pag = unwrapCatalogPagination(res);
      const total = pag?.total ?? rows.length;
      const lastPage = pag?.lastPage ?? 1;
      if (!shouldPaginateCatalogProducts(total)) {
        if (total > rows.length) {
          const full = await productService.getProducts({
            category,
            provider_id: cp.providerId,
            page: 1,
            per_page: Math.max(total, 30),
          });
          const all = full.success && Array.isArray(full.data) ? full.data : rows;
          setPagedProducts(all);
          setProductTotal(all.length);
          setProductPage(1);
          setProductLastPage(1);
        } else {
          setPagedProducts(rows);
          setProductTotal(total);
          setProductPage(1);
          setProductLastPage(1);
        }
      } else {
        setPagedProducts(rows);
        setProductTotal(total);
        setProductPage(pag?.currentPage ?? 1);
        setProductLastPage(lastPage);
      }
      // Keep store warm for any legacy readers in this flow.
      void fetchProducts({ category, provider_id: cp.providerId, per_page: CATALOG_PRODUCT_PAGE_SIZE, page: 1 });
    } finally {
      setProductsLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (!selectedProviderMeta || !productsCanLoadMore || productsLoadingMore) return;
    setProductsLoadingMore(true);
    try {
      const nextPage = productPage + 1;
      const res = await productService.getProducts({
        category,
        provider_id: selectedProviderMeta.providerId,
        page: nextPage,
        per_page: CATALOG_PRODUCT_PAGE_SIZE,
      });
      const rows = res.success && Array.isArray(res.data) ? res.data : [];
      const pag = unwrapCatalogPagination(res);
      setPagedProducts((prev) => mergeCatalogProductPages(prev, rows));
      setProductPage(pag?.currentPage ?? nextPage);
      setProductLastPage(pag?.lastPage ?? productLastPage);
      setProductTotal(pag?.total ?? productTotal);
    } finally {
      setProductsLoadingMore(false);
    }
  };

  const goBackToProviders = () => {
    setStep('provider');
    setSelectedProvider(null);
    setSelectedProviderMeta(null);
    setSelectedProduct(null);
    setPagedProducts([]);
    setProductPage(1);
    setProductLastPage(1);
    setProductTotal(0);
    setEwalletInquiry(null);
    setEwalletAmount('');
    setGameInquiry(null);
    setGameFields([]);
    setGameAccount({});
    setLanggananFields([]);
    setLanggananAccount({});
    setLanggananDelivery('unknown');
  };

  const handleCheckout = () => {
    if (!selectedProduct || !selectedProvider) {
      showFlowError('Pilih provider dan produk terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      showFlowError('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }

    let finalTarget = targetNo.trim();
    if (targetMode === 'none') {
      finalTarget = wallet?.walletNo || 'VOUCHER';
    } else if (!finalTarget) {
      showFlowError(`${resolvedTargetLabel} wajib diisi.`);
      return;
    }

    if (targetMode === 'game' && secondaryValue.trim()) {
      finalTarget = `${finalTarget}|${secondaryValue.trim()}`;
    }

    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk pembelian ini.');
      return;
    }

    const customDetails: Record<string, string> = {
      Provider: selectedProvider,
    };
    if (targetMode === 'game' && secondaryValue.trim()) {
      customDetails['Server'] = secondaryValue.trim();
    }

    setCheckoutData({
      serviceName,
      productName: selectedProduct.name,
      targetNo: finalTarget,
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails,
    });
  };

  const handleEwalletNext = async () => {
    if (!selectedProvider) {
      showFlowError('Pilih provider terlebih dahulu.');
      return;
    }
    const openProduct =
      selectedProduct ||
      providerProducts.find(
        (p) => p.is_open_amount === true || /bebas\s*nominal/i.test(String(p.name ?? ''))
      ) ||
      null;
    const sku =
      openProduct?.code ||
      (typeof selectedProviderMeta?.sku_code === 'string' ? selectedProviderMeta.sku_code : '');
    if (!sku) {
      showFlowError('Produk Bebas Nominal tidak tersedia untuk brand ini.');
      return;
    }
    const phone = targetNo.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      showFlowError('Nomor HP e-wallet harus 10–15 digit.');
      return;
    }
    const amount = Number(String(ewalletAmount).replace(/\D/g, ''));
    const minAmount =
      openProduct?.min_amount ?? selectedProviderMeta?.min_amount ?? null;
    const maxAmount =
      openProduct?.max_amount ?? selectedProviderMeta?.max_amount ?? null;
    if (!Number.isFinite(amount) || amount <= 0) {
      showFlowError('Masukkan nominal top up.');
      return;
    }
    if (minAmount != null && amount < minAmount) {
      showFlowError(`Minimal ${formatIDR(minAmount)}`);
      return;
    }
    if (maxAmount != null && amount > maxAmount) {
      showFlowError(`Maksimal ${formatIDR(maxAmount)}`);
      return;
    }

    setInquiring(true);
    try {
      if (openProduct) setSelectedProduct(openProduct);
      const res = await ewalletService.inquire(sku, phone, amount);
      if (!res.success || !res.data) {
        showFlowError(
          humanizeCatalogError(
            res.message,
            'Gagal inquiry top up digital. Silakan coba lagi.'
          )
        );
        return;
      }
      setEwalletInquiry(res.data);
    } catch (err: unknown) {
      showFlowError(
        resolveInquiryError(err, 'Gagal inquiry top up digital. Silakan coba lagi.')
      );
    } finally {
      setInquiring(false);
    }
  };

  /** Digi path: customer_no from schema; VIP nickname optional (not a purchase gate). */
  const handleGameNext = async () => {
    setGameInquiry(null);
    if (!selectedProduct || !selectedProvider) {
      showFlowError('Pilih game dan produk terlebih dahulu.');
      return;
    }
    if (!gameAccountReady) {
      showFlowError('Lengkapi data akun game terlebih dahulu.');
      return;
    }

    const account: Record<string, string> = {};
    for (const f of gameFields) {
      const v = (gameAccount[f.key] || '').trim();
      if (v) account[f.key] = v;
    }

    setInquiring(true);
    try {
      let customerNo: string;
      try {
        customerNo = buildGameCustomerNo(gameFields, account);
      } catch (e: unknown) {
        showFlowError(e instanceof Error ? e.message : 'Data akun game wajib diisi.');
        return;
      }

      const zone =
        account.zone_id || account.server_id
          ? String(account.zone_id || account.server_id).trim()
          : null;
      const userId =
        account.user_id ||
        account.player_id ||
        account.uid ||
        account.garena_id ||
        customerNo.split('|')[0];

      let nickname: string | null = null;
      let inquiryRef: string | null = null;
      try {
        const res = await gameService.inquire(selectedProduct.code, account);
        if (res.success && res.data) {
          if (res.data.customer_no) customerNo = res.data.customer_no;
          if (res.data.nickname) nickname = res.data.nickname;
          if (res.data.inquiry_ref_id) inquiryRef = res.data.inquiry_ref_id;
        }
      } catch {
        // Optional VIP lookup failure must not block Digi purchase.
      }

      setGameInquiry({
        inquiry_ref_id: inquiryRef,
        sku_code: selectedProduct.code,
        product_name: selectedProduct.name,
        game: selectedProvider,
        brand: selectedProvider,
        user_id: userId,
        zone_id: zone,
        customer_no: customerNo,
        id_zone_label: zone ? `${userId} (${zone})` : userId,
        nickname,
        item: selectedProduct.name,
        price: selectedProduct.price,
        sell_price: selectedProduct.price,
        admin_fee: selectedProduct.adminFee ?? 0,
        found: !!nickname,
        nickname_optional: true,
        expires_in_seconds: 20 * 60,
      });
    } catch (err: unknown) {
      showFlowError(
        resolveInquiryError(err, 'Gagal menyiapkan review pembelian game.')
      );
    } finally {
      setInquiring(false);
    }
  };

  const handleCancelEwalletInquiry = () => setEwalletInquiry(null);
  const handleCancelGameInquiry = () => setGameInquiry(null);

  const handleEwalletLanjutBayar = () => {
    if (!ewalletInquiry || !selectedProduct || !selectedProvider) return;

    if (!wallet || wallet.balance < ewalletInquiry.selling_price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk top up ini.');
      setEwalletInquiry(null);
      return;
    }

    const nominal = ewalletInquiry.nominal_amount ?? ewalletInquiry.bill_amount;
    const adminFee =
      Math.abs(ewalletInquiry.selling_price - nominal - ewalletInquiry.admin_fee) < 0.009
        ? ewalletInquiry.admin_fee
        : Math.max(0, ewalletInquiry.selling_price - nominal);

    setCheckoutData({
      serviceName,
      productName: ewalletInquiry.product_name || selectedProduct.name,
      targetNo: ewalletInquiry.customer_no,
      amount: nominal,
      adminFee,
      skuCode: ewalletInquiry.sku_code || selectedProduct.code,
      inquiryRefId: ewalletInquiry.inquiry_ref_id,
      customDetails: {
        'E-Wallet': selectedProvider,
        'Nomor HP': ewalletInquiry.customer_no,
        'Nama Akun': ewalletInquiry.customer_name,
        Nominal: formatIDR(nominal),
        Harga: formatIDR(ewalletInquiry.selling_price),
      },
    });
    setEwalletInquiry(null);
  };

  const handleGameLanjutBayar = () => {
    if (!gameInquiry || !selectedProduct || !selectedProvider) return;
    if (!gameInquiry.customer_no) return;

    if (!wallet || wallet.balance < gameInquiry.price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk top up game ini.');
      setGameInquiry(null);
      return;
    }

    setCheckoutData({
      serviceName,
      productName: gameInquiry.product_name || selectedProduct.name,
      targetNo: gameInquiry.customer_no,
      amount: gameInquiry.sell_price ?? gameInquiry.price,
      adminFee: gameInquiry.admin_fee ?? 0,
      skuCode: gameInquiry.sku_code || selectedProduct.code,
      customDetails: {
        Game: gameInquiry.game || selectedProvider,
        ...(gameInquiry.nickname ? { Nickname: gameInquiry.nickname } : {}),
        'ID Akun': gameInquiry.id_zone_label || gameInquiry.user_id,
        ...(gameInquiry.zone_id ? { 'Zone ID': gameInquiry.zone_id } : {}),
        Item: gameInquiry.item || selectedProduct.name,
      },
    });
    setGameInquiry(null);
  };

  const handleLanggananLanjutBayar = () => {
    if (!selectedProduct || !selectedProvider) return;
    if (langgananDelivery !== 'voucher' && langgananDelivery !== 'account') {
      showFlowError('Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.');
      return;
    }
    if (
      langgananDelivery === 'account' &&
      (langgananFields.length === 0 || !isLanggananAccountReady(langgananFields, langgananAccount))
    ) {
      showFlowError('Lengkapi data tujuan langganan terlebih dahulu.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.');
      return;
    }

    const target = buildLanggananCustomerNo(langgananFields, langgananAccount, langgananDelivery);
    if (!target) {
      showFlowError('Tujuan transaksi tidak valid.');
      return;
    }
    const customDetails: Record<string, string> = {
      Kategori: 'LANGGANAN DIGITAL',
      Aplikasi: selectedProvider,
      Varian: selectedProduct.name,
    };
    if (langgananDelivery === 'account' && langgananFields.length > 0) {
      langgananFields.forEach((f) => {
        const val = (langgananAccount[f.key] || '').trim();
        if (val) customDetails[f.label] = val;
      });
    } else {
      customDetails['Pengiriman'] = 'Kode aktivasi via provider setelah pembayaran';
    }

    setCheckoutData({
      serviceName,
      productName: selectedProduct.name,
      targetNo: target,
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails,
    });
  };

  const handleSummaryNext = () => {
    if (!selectedProduct || !selectedProvider) {
      showFlowError(
        isLanggananMode
          ? 'Pilih aplikasi dan paket terlebih dahulu.'
          : 'Pilih brand dan nominal voucher terlebih dahulu.'
      );
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError(
        isLanggananMode
          ? 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.'
          : 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian voucher ini.'
      );
      return;
    }
  };

  const handleSummaryLanjutBayar = () => {
    if (!selectedProduct || !selectedProvider) return;
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError(
        isLanggananMode
          ? 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.'
          : 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian voucher ini.'
      );
      return;
    }

    const target =
      wallet.walletNo ||
      (typeof (wallet as { wallet_number?: string }).wallet_number === 'string'
        ? (wallet as { wallet_number?: string }).wallet_number
        : null) ||
      (isLanggananMode ? 'LANGGANAN' : 'VOUCHER');

    setCheckoutData({
      serviceName,
      productName: selectedProduct.name,
      targetNo: String(target),
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: isLanggananMode
        ? {
            Kategori: 'LANGGANAN DIGITAL',
            Aplikasi: selectedProvider,
            Varian: selectedProduct.name,
          }
        : {
            Kategori: 'VOUCHER DIGITAL',
            Brand: selectedProvider,
            Varian: selectedProduct.name,
          },
    });
  };

  const handleSummaryProceedToPin = () => {
    if (!selectedProduct || !selectedProvider) {
      showFlowError(
        isLanggananMode
          ? 'Pilih aplikasi dan paket terlebih dahulu.'
          : 'Pilih brand dan nominal voucher terlebih dahulu.'
      );
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError(
        isLanggananMode
          ? 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.'
          : 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian voucher ini.'
      );
      return;
    }
    handleSummaryLanjutBayar();
  };

  const inquiryNextDisabled =
    !selectedProduct ||
    !isProductPurchasable(selectedProduct) ||
    inquiring ||
    (isEwalletInquiry && !phoneReady) ||
    (isGameInquiry && !gameAccountReady);

  const renderSummaryPanel = () => {
    if (!selectedProduct) {
      return (
        <SummaryPanelShell>
          <div className="py-10 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-white/30" />
            <p className="text-sm font-semibold text-white/60">Pilih produk untuk melihat ringkasan</p>
          </div>
        </SummaryPanelShell>
      );
    }

    if (isLanggananMode && selectedProduct) {
      return (
        <SummaryPanelShell>
          <p className="text-[10px] font-black tracking-widest text-white/50 uppercase mb-3">
            Ringkasan Langganan
          </p>
          <SummaryRow label="Kategori" value="LANGGANAN DIGITAL" />
          <SummaryRow label="Aplikasi" value={selectedProvider || '-'} />
          <SummaryRow label="Varian" value={selectedProduct.name} />
          {langgananDelivery === 'account' && langgananFields.length > 0 ? (
            langgananFields.map((f) => (
              <SummaryRow
                key={f.key}
                label={f.label}
                value={(langgananAccount[f.key] || '').trim() || '-'}
              />
            ))
          ) : langgananDelivery === 'voucher' ? (
            <SummaryRow label="Pengiriman" value="Kode aktivasi via provider" />
          ) : (
            <SummaryRow label="Status" value="Format akun belum tersedia" />
          )}
          <SummaryRow label="Harga" value={formatIDR(selectedProduct.price)} large />
          <PanelActions>
            <button
              type="button"
              onClick={handleLanggananLanjutBayar}
              disabled={!isProductPurchasable(selectedProduct) || !langgananReady}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Lanjut Konfirmasi
            </button>
          </PanelActions>
        </SummaryPanelShell>
      );
    }

    if (isSummaryCheckoutMode) {
      return (
        <SummaryPanelShell>
          <p className="text-[10px] font-black tracking-widest text-white/50 uppercase mb-3">
            Ringkasan Voucher
          </p>
          <SummaryRow label="Kategori" value="VOUCHER DIGITAL" />
          <SummaryRow label="Brand" value={selectedProvider || '-'} />
          <SummaryRow label="Varian" value={selectedProduct.name} />
          <SummaryRow label="Harga" value={formatIDR(selectedProduct.price)} large />
          <PanelActions>
            <button
              type="button"
              onClick={handleSummaryProceedToPin}
              disabled={!isProductPurchasable(selectedProduct)}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Lanjutkan ke PIN
            </button>
          </PanelActions>
        </SummaryPanelShell>
      );
    }

    if (isEwalletInquiry && ewalletInquiry) {
      const nominal = ewalletInquiry.nominal_amount ?? ewalletInquiry.bill_amount;
      const adminFee =
        Math.abs(ewalletInquiry.selling_price - nominal - ewalletInquiry.admin_fee) < 0.009
          ? ewalletInquiry.admin_fee
          : Math.max(0, ewalletInquiry.selling_price - nominal);

      return (
        <SummaryPanelShell>
          <p className="text-[10px] font-black tracking-widest text-white/50 uppercase mb-3">
            Konfirmasi E-Wallet
          </p>
          <SummaryRow label="E-Wallet" value={selectedProvider || ewalletInquiry.provider_name || '-'} />
          <SummaryRow label="Nomor HP" value={ewalletInquiry.customer_no} />
          <SummaryRow label="Nama Akun" value={ewalletInquiry.customer_name} emphasize />
          <SummaryRow label="Nominal" value={formatIDR(nominal)} />
          {adminFee > 0 && <SummaryRow label="Biaya Admin" value={formatIDR(adminFee)} />}
          <SummaryRow label="Total" value={formatIDR(ewalletInquiry.selling_price)} large />
          <PanelActions>
            <button
              type="button"
              onClick={handleCancelEwalletInquiry}
              className="w-full py-2.5 rounded-2xl border border-white/20 text-white/80 font-bold text-xs hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleEwalletLanjutBayar}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 transition-colors"
            >
              Lanjut Bayar (PIN)
            </button>
          </PanelActions>
        </SummaryPanelShell>
      );
    }

    if (isGameInquiry && gameInquiry) {
      return (
        <SummaryPanelShell>
          <p className="text-[10px] font-black tracking-widest text-white/50 uppercase mb-3">
            Review Game
          </p>
          <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5 flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white/90" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate">
                {gameInquiry.nickname || gameInquiry.id_zone_label || gameInquiry.user_id}
              </p>
              <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {gameInquiry.nickname ? 'Nickname terverifikasi' : 'Siap dibayar via Digiflazz'}
              </p>
            </div>
          </div>
          <SummaryRow label="Game" value={gameInquiry.game || selectedProvider || '-'} />
          <SummaryRow label="ID Akun" value={gameInquiry.id_zone_label || gameInquiry.customer_no} />
          <SummaryRow label="Item" value={gameInquiry.item || selectedProduct.name} />
          <SummaryRow label="Harga" value={formatIDR(gameInquiry.price)} large />
          <PanelActions>
            <button
              type="button"
              onClick={handleCancelGameInquiry}
              className="w-full py-2.5 rounded-2xl border border-white/20 text-white/80 font-bold text-xs hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleGameLanjutBayar}
              disabled={!gameInquiry.customer_no}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Lanjut Bayar (PIN)
            </button>
          </PanelActions>
        </SummaryPanelShell>
      );
    }

    const previewPrice = selectedProduct.price;

    return (
      <SummaryPanelShell>
        <p className="text-[10px] font-black tracking-widest text-white/50 uppercase mb-3">
          Ringkasan
        </p>
        <SummaryRow label="Provider" value={selectedProvider || '-'} />
        <SummaryRow label="Produk" value={selectedProduct.name} />
        <SummaryRow label="Harga" value={formatIDR(previewPrice)} large />
        <PanelActions>
          {isEwalletInquiry ? (
            <button
              type="button"
              onClick={() => void handleEwalletNext()}
              disabled={inquiryNextDisabled}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {inquiring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Memeriksa akun...
                </>
              ) : (
                'Lanjutkan'
              )}
            </button>
          ) : isGameInquiry ? (
            <button
              type="button"
              onClick={() => void handleGameNext()}
              disabled={inquiryNextDisabled}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {inquiring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Memvalidasi akun...
                </>
              ) : (
                'Lanjutkan'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!isProductPurchasable(selectedProduct)}
              className="w-full py-3.5 bg-white text-primary-900 rounded-2xl font-extrabold text-sm hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Lanjut ke Konfirmasi
            </button>
          )}
        </PanelActions>
      </SummaryPanelShell>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {step === 'provider' && (
        <div className="dashboard-panel space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">
                {isGameInquiry
                  ? 'Pilih Game'
                  : isLanggananMode
                    ? 'Pilih Aplikasi'
                    : isVoucherMode
                      ? 'Pilih Brand'
                      : 'Pilih Provider'}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {isGameInquiry
                  ? 'Pilih game terlebih dahulu sebelum mengisi akun dan produk.'
                  : isLanggananMode
                    ? 'Pilih aplikasi streaming / produktivitas dari katalog provider.'
                    : isVoucherMode
                      ? 'Pilih brand voucher / e-gift dari katalog provider.'
                      : 'Pilih brand terlebih dahulu sebelum melihat daftar produk.'}
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={providerQuery}
                onChange={(e) => setProviderQuery(e.target.value)}
                placeholder={providerSearchPlaceholder}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {categoryProvidersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="p-4 rounded-3xl border border-gray-100 bg-white animate-pulse space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto" />
                  <div className="h-3 bg-gray-100 rounded w-3/4 mx-auto" />
                </div>
              ))}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
              <p className="text-sm font-extrabold text-gray-700">
                {providerQuery.trim()
                  ? isLanggananMode
                    ? 'Aplikasi tidak ditemukan'
                    : isVoucherMode
                      ? 'Brand tidak ditemukan'
                      : isGameInquiry
                        ? 'Game tidak ditemukan'
                        : 'Provider tidak ditemukan'
                  : 'Provider belum tersedia'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {providerQuery.trim()
                  ? 'Coba kata kunci lain, atau hapus pencarian.'
                  : 'Katalog kosong. Pastikan sinkronisasi produk provider aktif di Operations.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProviders.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    const meta =
                      categoryProviders.find((cp) => cp.providerId === p.providerId && cp.name === p.name) ||
                      categoryProviders.find((cp) => cp.name === p.name);
                    if (meta) selectProvider(meta);
                  }}
                  className="group text-left p-4 rounded-3xl border border-gray-100 bg-white hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/8 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <BrandAvatar name={p.name} logoUrl={p.logo} size="md" className="mb-3" />
                  <div className="font-extrabold text-gray-900 text-sm truncate group-hover:text-primary-700 transition-colors">
                    {p.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'products' && selectedProvider && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={goBackToProviders}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-600"
          >
            <ChevronLeft className="w-4 h-4" />
            {isGameInquiry
              ? 'Ganti game'
              : isLanggananMode
                ? 'Ganti aplikasi'
                : isVoucherMode
                  ? 'Ganti brand'
                  : 'Ganti provider'}
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-5 items-start">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
              <div>
                <h4 className="font-extrabold text-gray-900 text-base">{selectedProvider}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isGameInquiry
                    ? 'Isi data akun, lalu pilih produk dari katalog.'
                    : isEwalletInquiry
                      ? 'Masukkan nomor HP dan nominal Bebas Nominal.'
                      : isLanggananMode
                        ? 'Pilih paket langganan. Setelah paket dipilih, lengkapi data tujuan jika diperlukan.'
                        : isVoucherMode
                          ? 'Pilih nominal voucher dari katalog.'
                          : 'Pilih produk, lengkapi data tujuan, lalu lanjut ke konfirmasi.'}
                </p>
              </div>

              {isSummaryCheckoutMode ? null : isLanggananMode ? null : isGameInquiry ? (
                <div className="space-y-3">
                  {!selectedProduct ? (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                      Pilih produk terlebih dahulu untuk menampilkan form akun.
                    </p>
                  ) : schemaLoading ? (
                    <div className="py-6 text-center">
                      <RefreshCw className="w-5 h-5 mx-auto text-gray-300 animate-spin" />
                    </div>
                  ) : gameFields.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 font-semibold">
                      Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gameFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700">
                            {field.label}
                            {field.required ? '' : ' (opsional)'}
                          </label>
                          <input
                            type="text"
                            value={gameAccount[field.key] || ''}
                            onChange={(e) => {
                              setGameAccount((prev) => ({ ...prev, [field.key]: e.target.value }));
                              setGameInquiry(null);
                            }}
                            placeholder={field.label}
                            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : targetMode !== 'none' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">{resolvedTargetLabel}</label>
                    <input
                      type="text"
                      value={targetNo}
                      onChange={(e) => {
                        setTargetNo(
                          targetMode === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value
                        );
                        if (isEwalletInquiry) {
                          setEwalletInquiry(null);
                        }
                      }}
                      placeholder={resolvedTargetPlaceholder}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {targetMode === 'game' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">{secondaryLabel}</label>
                      <input
                        type="text"
                        value={secondaryValue}
                        onChange={(e) => setSecondaryValue(e.target.value)}
                        placeholder={secondaryPlaceholder}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {showProducts && isEwalletInquiry ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Nominal</label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200">
                      <span className="text-sm font-bold text-gray-500">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ewalletAmount}
                        onChange={(e) => {
                          setEwalletAmount(e.target.value.replace(/\D/g, ''));
                          setEwalletInquiry(null);
                        }}
                        placeholder="0"
                        className="flex-1 bg-transparent text-sm font-bold focus:outline-none"
                      />
                    </div>
                    {(selectedProviderMeta?.min_amount != null ||
                      selectedProviderMeta?.max_amount != null) && (
                      <p className="text-xs text-gray-500 font-semibold">
                        Min.{' '}
                        {formatIDR(selectedProviderMeta?.min_amount ?? 0)}
                        {' — '}
                        Maks.{' '}
                        {formatIDR(selectedProviderMeta?.max_amount ?? 0)}
                      </p>
                    )}
                  </div>
                </div>
              ) : showProducts ? (
                <div className="space-y-2.5">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    {isVoucherMode
                      ? 'Pilih Nominal'
                      : isLanggananMode
                        ? 'Pilih Paket'
                        : isGameInquiry
                          ? 'Pilih Produk'
                          : 'Daftar Produk'}
                  </h5>
                  {productsLoading && providerProducts.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/80 animate-pulse space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-2/3" />
                          <div className="h-5 bg-gray-200 rounded w-1/3" />
                        </div>
                      ))}
                    </div>
                  ) : providerProducts.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                      Tidak ada produk aktif untuk provider ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                      {providerProducts.map((product) => {
                        const active = selectedProduct?.id === product.id;
                        const purchasable = isProductPurchasable(product);
                        const statusLabel = catalogStatusLabel(product);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(product);
                              if (isEwalletInquiry) setEwalletInquiry(null);
                              if (isGameInquiry) setGameInquiry(null);
                              if (isLanggananMode) {
                                setLanggananAccount({});
                              }
                            }}
                            className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                              active
                                ? 'border-primary-500 bg-primary-50/50 shadow-md shadow-primary-900/5 ring-1 ring-primary-200'
                                : 'border-gray-100 bg-gray-50/80 hover:border-gray-300 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-extrabold text-gray-900 text-sm leading-snug min-w-0">
                                {product.name}
                              </div>
                              <span
                                className={`shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  purchasable
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-base font-black text-primary-600">
                                {formatIDR(product.price)}
                              </span>
                              {active && <ChevronRight className="w-4 h-4 text-primary-600" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {productsCanLoadMore ? (
                    <button
                      type="button"
                      disabled={productsLoadingMore}
                      onClick={() => void loadMoreProducts()}
                      className="w-full py-3 rounded-2xl border text-xs font-bold text-primary-700 disabled:opacity-50"
                    >
                      {productsLoadingMore ? 'Memuat…' : 'Muat lebih banyak'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-xs text-gray-500 font-semibold">
                    {isGameInquiry
                      ? 'Lengkapi data akun terlebih dahulu untuk menampilkan daftar produk.'
                      : 'Masukkan nomor HP terlebih dahulu untuk menampilkan daftar nominal.'}
                  </p>
                </div>
              )}

              {isLanggananMode && selectedProduct ? (
                <div className="space-y-3 border-t border-gray-100 pt-5">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Data Tujuan — {selectedProduct.name}
                  </h5>
                  {langgananSchemaLoading ? (
                    <div className="py-6 text-center">
                      <RefreshCw className="w-5 h-5 mx-auto text-gray-300 animate-spin" />
                      <p className="text-[10px] text-gray-400 mt-2 font-semibold">Memuat kebutuhan input produk…</p>
                    </div>
                  ) : langgananFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {langgananFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700">
                            {field.label}
                            {field.required ? '' : ' (opsional)'}
                          </label>
                          <input
                            type={field.input === 'email' ? 'email' : field.input === 'phone' ? 'tel' : 'text'}
                            value={langgananAccount[field.key] || ''}
                            onChange={(e) => {
                              const val =
                                field.input === 'phone'
                                  ? e.target.value.replace(/\D/g, '')
                                  : e.target.value;
                              setLanggananAccount((prev) => ({ ...prev, [field.key]: val }));
                            }}
                            placeholder={field.label}
                            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      ))}
                    </div>
                  ) : langgananDelivery === 'voucher' ? (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                      Paket ini mengirim kode aktivasi otomatis setelah pembayaran — tidak perlu mengisi
                      email, nomor HP, atau ID tujuan.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 font-semibold">
                      Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-6">{renderSummaryPanel()}</div>
          </div>
        </div>
      )}

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={
            resumePin || isEwalletInquiry || isGameInquiry || isVoucherMode ? 'PIN' : 'SUMMARY'
          }
          onClose={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
          onSuccess={() => {
            setCheckoutData(null);
            setResumePin(false);
            setSelectedProduct(null);
            void syncAuthoritativeBalance();
          }}
        />
      )}
    </div>
  );
}

function SummaryPanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary-900 via-primary-950 to-gray-950 text-white p-5 shadow-xl shadow-primary-900/25 border border-primary-800/50">
      {children}
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-[10px] text-white/65 leading-relaxed">
          Produk terverifikasi tersedia saat ini. Jika transaksi gagal diproses, saldo GurkyPay otomatis
          dikembalikan.
        </p>
      </div>
    </div>
  );
}

function PanelActions({ children }: { children: ReactNode }) {
  return <div className="mt-4 space-y-2">{children}</div>;
}

function SummaryRow({
  label,
  value,
  emphasize = false,
  large = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 py-1.5 ${large ? 'pt-2 mt-1 border-t border-white/10' : ''}`}>
      <span className="text-[11px] font-semibold text-white/55 shrink-0">{label}</span>
      <span
        className={`text-right font-extrabold ${
          large ? 'text-lg text-white' : emphasize ? 'text-sm text-white uppercase tracking-wide' : 'text-xs text-white/90'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
