import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Wallet,
  X,
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
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
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
 * Products always come from GET /products?category=...
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
  /** No customer inquiry — summary popup then PIN (voucher / langganan). */
  const isSummaryCheckoutMode = isVoucherMode || isLanggananMode;
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();
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
  const [catalogSummaryOpen, setCatalogSummaryOpen] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category });
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts, category, returnPath]);

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

  const providers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; sample?: Product; logo?: string | null }>();
    for (const p of products) {
      if (!isCatalogListed(p)) continue;
      const name = (p.operatorName || 'Lainnya').trim();
      const key = name.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        const ext = p as Product & { providerDetails?: { logo?: string | null } };
        map.set(key, {
          name,
          count: 1,
          sample: p,
          logo: providerLogoFromProduct(ext),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [products]);

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(q));
  }, [providers, providerQuery]);

  const providerProducts = useMemo(() => {
    if (!selectedProvider) return [];
    return products
      .filter(
        (p) =>
          isCatalogListed(p) &&
          (p.operatorName || '').trim().toLowerCase() === selectedProvider.toLowerCase()
      )
      .sort((a, b) => a.price - b.price);
  }, [products, selectedProvider]);

  const phoneReady = !isEwalletInquiry || targetNo.replace(/\D/g, '').length >= 10;
  const gameAccountReady =
    !isGameInquiry ||
    (gameFields.length > 0 &&
      gameFields.every((f) => !f.required || (gameAccount[f.key] || '').trim() !== ''));
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

  const selectProvider = (name: string) => {
    setSelectedProvider(name);
    setSelectedProduct(null);
    setEwalletInquiry(null);
    setGameInquiry(null);
    setCatalogSummaryOpen(false);
    setTargetNo('');
    setSecondaryValue('');
    setGameAccount({});
    setStep('products');
  };

  const goBackToProviders = () => {
    setStep('provider');
    setSelectedProvider(null);
    setSelectedProduct(null);
    setEwalletInquiry(null);
    setGameInquiry(null);
    setCatalogSummaryOpen(false);
    setGameFields([]);
    setGameAccount({});
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
    setCatalogSummaryOpen(true);
  };

  const handleSummaryLanjutBayar = () => {
    if (!selectedProduct || !selectedProvider) return;
    if (!wallet || wallet.balance < selectedProduct.price) {
      showFlowError(
        isLanggananMode
          ? 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian langganan ini.'
          : 'Saldo GurkyPay Anda tidak mencukupi untuk pembelian voucher ini.'
      );
      setCatalogSummaryOpen(false);
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
    setCatalogSummaryOpen(false);
  };

  const nextDisabled =
    !selectedProduct ||
    !isProductPurchasable(selectedProduct) ||
    inquiring ||
    (isEwalletInquiry && !phoneReady) ||
    (isGameInquiry && !gameAccountReady);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
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

          {productsLoading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
              <p className="text-xs text-gray-400 font-bold">Memuat katalog dari server...</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProviders.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectProvider(p.name)}
                  className="group text-left p-3.5 rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-primary-50/30 hover:border-primary-300 hover:shadow-md hover:shadow-primary-900/5 transition-all duration-200"
                >
                  <BrandAvatar name={p.name} logoUrl={p.logo} size="md" className="mb-2.5" />
                  <div className="font-extrabold text-gray-900 text-sm truncate group-hover:text-primary-700 transition-colors">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">{p.count} produk</div>
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

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">{selectedProvider}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {isGameInquiry
                  ? 'Isi data akun, pilih produk dari katalog, lalu tekan NEXT.'
                  : isEwalletInquiry
                    ? 'Masukkan nomor HP, pilih nominal dari katalog, lalu tekan NEXT.'
                    : isLanggananMode
                      ? 'Pilih paket langganan dari katalog, lalu tekan NEXT.'
                      : isVoucherMode
                        ? 'Pilih nominal voucher dari katalog, lalu tekan NEXT.'
                        : 'Pilih produk, lengkapi data tujuan, lalu lanjut ke konfirmasi.'}
              </p>
            </div>

            {isSummaryCheckoutMode ? null : isGameInquiry ? (
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
                {providerProducts.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                    Tidak ada produk aktif untuk provider ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {providerProducts.map((product) => {
                      const active = selectedProduct?.id === product.id;
                      const purchasable = isProductPurchasable(product);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className={`text-left p-4 rounded-2xl border transition-all ${
                            active
                              ? 'border-primary-500 bg-primary-50/40 shadow-sm'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                          } ${!purchasable ? 'opacity-70' : ''}`}
                        >
                          <div className="font-extrabold text-gray-900 text-sm leading-snug">{product.name}</div>
                          {!purchasable && (
                            <div className="mt-1 text-[10px] font-bold text-amber-700">Sedang maintenance</div>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-black text-primary-600">{formatIDR(product.price)}</span>
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

            <button
              type="button"
              onClick={() => {
                if (isEwalletInquiry) void handleEwalletNext();
                else if (isGameInquiry) void handleGameNext();
                else if (isSummaryCheckoutMode) handleSummaryNext();
                else handleCheckout();
              }}
              disabled={nextDisabled}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary-500/10 transition-all inline-flex items-center justify-center gap-2"
            >
              {isEwalletInquiry || isGameInquiry || isSummaryCheckoutMode ? (
                inquiring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {isGameInquiry ? 'Memvalidasi akun...' : 'Memeriksa akun...'}
                  </>
                ) : (
                  'NEXT'
                )
              ) : (
                'Lanjut ke Konfirmasi'
              )}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {ewalletInquiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    Konfirmasi E-Wallet
                  </p>
                  <h3 className="text-base font-extrabold text-gray-900 mt-1">
                    {(selectedProvider || ewalletInquiry.provider_name || 'E-Wallet').toUpperCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEwalletInquiry}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                <ConfirmRow label="E-Wallet" value={selectedProvider || ewalletInquiry.provider_name || '-'} />
                <ConfirmRow label="Nomor HP" value={ewalletInquiry.customer_no} />
                <ConfirmRow label="Nama Akun" value={ewalletInquiry.customer_name} emphasize />
                <ConfirmRow
                  label="Nominal"
                  value={formatIDR(ewalletInquiry.nominal_amount ?? ewalletInquiry.bill_amount)}
                />
                <ConfirmRow label="Harga" value={formatIDR(ewalletInquiry.selling_price)} />
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelEwalletInquiry}
                  className="py-3 rounded-2xl border border-gray-200 font-extrabold text-sm text-gray-700 hover:bg-gray-50"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleEwalletLanjutBayar}
                  className="py-3 rounded-2xl bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700"
                >
                  LANJUT BAYAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameInquiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-validasi-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    Validasi Game
                  </p>
                  <h3 id="game-validasi-title" className="text-base font-extrabold text-gray-900 mt-1">
                    {(gameInquiry.game || selectedProvider || 'GAME').toUpperCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancelGameInquiry}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                <ConfirmRow label="Game" value={gameInquiry.game || selectedProvider || '-'} />
                <ConfirmRow label="ID / Zone" value={gameInquiry.id_zone_label || gameInquiry.customer_no} />
                <ConfirmRow label="Nickname" value={gameInquiry.nickname} emphasize />
                <ConfirmRow label="Item" value={gameInquiry.item || selectedProduct?.name || '-'} />
                <ConfirmRow label="Harga" value={formatIDR(gameInquiry.price)} />
              </div>
              <p className="px-5 py-3 text-[11px] text-amber-800 bg-amber-50/80 border-y border-amber-100 leading-relaxed">
                Pastikan <span className="font-extrabold">NICKNAME</span> sudah sesuai sebelum melanjutkan
                pembayaran.
              </p>
              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelGameInquiry}
                  className="py-3 rounded-2xl border border-gray-200 font-extrabold text-sm text-gray-700 hover:bg-gray-50"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleGameLanjutBayar}
                  disabled={!gameInquiry.nickname}
                  className="py-3 rounded-2xl bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  LANJUT BAYAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {catalogSummaryOpen && selectedProduct && selectedProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-summary-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    {isLanggananMode ? 'Ringkasan Langganan Digital' : 'Ringkasan Pembelian Voucher'}
                  </p>
                  <h3 id="catalog-summary-title" className="text-base font-extrabold text-gray-900 mt-1">
                    {selectedProvider.toUpperCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCatalogSummaryOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                <ConfirmRow
                  label="Kategori"
                  value={isLanggananMode ? 'LANGGANAN DIGITAL' : 'VOUCHER DIGITAL'}
                />
                <ConfirmRow
                  label={isLanggananMode ? 'Aplikasi' : 'Brand'}
                  value={selectedProvider}
                />
                <ConfirmRow label="Varian" value={selectedProduct.name} />
                <ConfirmRow label="Harga" value={formatIDR(selectedProduct.price)} emphasize />
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCatalogSummaryOpen(false)}
                  className="py-3 rounded-2xl border border-gray-200 font-extrabold text-sm text-gray-700 hover:bg-gray-50"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleSummaryLanjutBayar}
                  className="py-3 rounded-2xl bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700"
                >
                  LANJUT BAYAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={
            resumePin || isEwalletInquiry || isGameInquiry || isSummaryCheckoutMode ? 'PIN' : 'SUMMARY'
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

function ConfirmRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-right text-xs font-extrabold ${
          emphasize ? 'text-primary-800 uppercase tracking-wide' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
