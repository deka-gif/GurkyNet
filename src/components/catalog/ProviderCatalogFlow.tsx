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
import {
  gameService,
  GameAccountField,
  GameInquiryResult,
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
  const { wallet, fetchWallet } = useWalletStore();
  const {
    products,
    loading: productsLoading,
    fetchProducts,
    categoryProviders,
    categoryProvidersLoading,
    fetchCategoryProviders,
  } = useProductStore();
  const toast = useToast();

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetNo, setTargetNo] = useState('');
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
  const [langgananDelivery, setLanggananDelivery] = useState<string>('voucher');
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
    if (!isGameInquiry || !selectedProvider || step !== 'products') return;
    let cancelled = false;
    setSchemaLoading(true);
    setGameFields([]);
    setGameAccount({});
    void gameService
      .accountSchema(selectedProvider)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.fields?.length) {
          setGameFields(res.data.fields);
        } else {
          setGameFields([
            { key: 'player_id', label: 'Player ID', required: true },
            { key: 'zone_id', label: 'Zone / Server ID', required: false },
          ]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGameFields([
            { key: 'player_id', label: 'Player ID', required: true },
            { key: 'zone_id', label: 'Zone / Server ID', required: false },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGameInquiry, selectedProvider, step]);

  useEffect(() => {
    if (!isLanggananMode || !selectedProvider || !selectedProduct || step !== 'products') {
      if (!selectedProduct && isLanggananMode) {
        setLanggananFields([]);
        setLanggananAccount({});
        setLanggananDelivery('voucher');
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
          setLanggananFields(res.data.fields || []);
          setLanggananDelivery(res.data.delivery || 'voucher');
        } else {
          setLanggananFields([]);
          setLanggananDelivery('voucher');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanggananFields([]);
          setLanggananDelivery('voucher');
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
    return products
      .filter(
        (p) =>
          isCatalogListed(p) &&
          String(p.operatorName ?? '').trim().toLowerCase() === selectedProvider.toLowerCase()
      )
      .sort((a, b) => a.price - b.price);
  }, [products, selectedProvider]);

  const phoneReady = !isEwalletInquiry || targetNo.replace(/\D/g, '').length >= 10;
  const gameAccountReady =
    !isGameInquiry ||
    (gameFields.length > 0 &&
      gameFields.every((f) => !f.required || (gameAccount[f.key] || '').trim() !== ''));
  const langgananReady =
    !isLanggananMode ||
    !selectedProduct ||
    langgananSchemaLoading ||
    langgananFields.length === 0 ||
    isLanggananAccountReady(langgananFields, langgananAccount);
  const showProducts =
    (!isEwalletInquiry || phoneReady) && (!isGameInquiry || gameAccountReady);

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

  const selectProvider = (name: string, providerId: number) => {
    setSelectedProvider(name);
    setSelectedProduct(null);
    setEwalletInquiry(null);
    setGameInquiry(null);
    setTargetNo('');
    setSecondaryValue('');
    setGameAccount({});
    setLanggananFields([]);
    setLanggananAccount({});
    setLanggananDelivery('voucher');
    setStep('products');
    void fetchProducts({ category, provider_id: providerId });
  };

  const goBackToProviders = () => {
    setStep('provider');
    setSelectedProvider(null);
    setSelectedProduct(null);
    setEwalletInquiry(null);
    setGameInquiry(null);
    setGameFields([]);
    setGameAccount({});
    setLanggananFields([]);
    setLanggananAccount({});
    setLanggananDelivery('voucher');
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
    if (!selectedProduct || !selectedProvider) {
      showFlowError('Pilih provider dan nominal terlebih dahulu.');
      return;
    }
    const phone = targetNo.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      showFlowError('Nomor HP e-wallet harus 10–15 digit.');
      return;
    }

    setInquiring(true);
    try {
      const res = await ewalletService.inquire(selectedProduct.code, phone);
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
      const res = await gameService.inquire(selectedProduct.code, account);
      if (!res.success || !res.data?.found || !res.data.nickname) {
        showFlowError(
          humanizeCatalogError(
            res.message,
            'Player ID Tidak Ditemukan. Periksa kembali data akun Anda.'
          )
        );
        return;
      }
      setGameInquiry(res.data);
    } catch (err: unknown) {
      showFlowError(
        resolveInquiryError(
          err,
          'Player ID Tidak Ditemukan. Periksa kembali data akun Anda.'
        )
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
    if (!gameInquiry.nickname) return;

    if (!wallet || wallet.balance < gameInquiry.price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk top up game ini.');
      setGameInquiry(null);
      return;
    }

    setCheckoutData({
      serviceName,
      productName: gameInquiry.product_name || selectedProduct.name,
      targetNo: gameInquiry.customer_no,
      amount: gameInquiry.sell_price,
      adminFee: gameInquiry.admin_fee,
      skuCode: gameInquiry.sku_code || selectedProduct.code,
      customDetails: {
        Game: gameInquiry.game || selectedProvider,
        Nickname: gameInquiry.nickname,
        'User ID': gameInquiry.user_id,
        ...(gameInquiry.zone_id ? { 'Zone ID': gameInquiry.zone_id } : {}),
        Item: gameInquiry.item || selectedProduct.name,
      },
    });
    setGameInquiry(null);
  };

  const handleLanggananLanjutBayar = () => {
    if (!selectedProduct || !selectedProvider) return;
    if (!isLanggananAccountReady(langgananFields, langgananAccount)) {
      showFlowError('Lengkapi data tujuan langganan terlebih dahulu.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError('Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.');
      return;
    }

    const target = buildLanggananCustomerNo(langgananFields, langgananAccount, langgananDelivery);
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
          ) : (
            <SummaryRow label="Pengiriman" value="Kode aktivasi via provider" />
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
            Validasi Game
          </p>
          <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5 flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white/90" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate">{gameInquiry.nickname}</p>
              <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Nickname terverifikasi
              </p>
            </div>
          </div>
          <SummaryRow label="Game" value={gameInquiry.game || selectedProvider || '-'} />
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
              disabled={!gameInquiry.nickname}
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
                  onClick={() => selectProvider(p.name, p.providerId)}
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
                      ? 'Masukkan nomor HP, lalu pilih nominal dari katalog.'
                      : isLanggananMode
                        ? 'Pilih paket langganan. Setelah paket dipilih, lengkapi data tujuan jika diperlukan.'
                        : isVoucherMode
                          ? 'Pilih nominal voucher dari katalog.'
                          : 'Pilih produk, lengkapi data tujuan, lalu lanjut ke konfirmasi.'}
                </p>
              </div>

              {isSummaryCheckoutMode ? null : isLanggananMode ? null : isGameInquiry ? (
                <div className="space-y-3">
                  {schemaLoading ? (
                    <div className="py-6 text-center">
                      <RefreshCw className="w-5 h-5 mx-auto text-gray-300 animate-spin" />
                    </div>
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
                              setSelectedProduct(null);
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
                          setSelectedProduct(null);
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

              {showProducts ? (
                <div className="space-y-2.5">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    {isEwalletInquiry || isVoucherMode
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
                  ) : (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                      Paket ini mengirim kode aktivasi otomatis setelah pembayaran — tidak perlu mengisi
                      email, nomor HP, atau ID tujuan.
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
          onSuccess={(trx) => {
            showFlowSuccess(
              trx?.invoice_number
                ? `Transaksi berhasil. Invoice ${trx.invoice_number}.`
                : 'Transaksi berhasil diproses.'
            );
            setCheckoutData(null);
            setResumePin(false);
            setSelectedProduct(null);
            fetchWallet();
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
