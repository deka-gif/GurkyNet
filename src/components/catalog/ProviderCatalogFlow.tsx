import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';

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
}: ProviderCatalogFlowProps) {
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [step, setStep] = useState<'provider' | 'products'>('provider');
  const [providerQuery, setProviderQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetNo, setTargetNo] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category });
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts, category, returnPath]);

  const providers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; sample?: Product }>();
    for (const p of products) {
      if (p.status !== 'tersedia') continue;
      const name = (p.operatorName || 'Lainnya').trim();
      const key = name.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(key, { name, count: 1, sample: p });
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
          p.status === 'tersedia' &&
          (p.operatorName || '').trim().toLowerCase() === selectedProvider.toLowerCase()
      )
      .sort((a, b) => a.price - b.price);
  }, [products, selectedProvider]);

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
    setStep('products');
    setErrorMsg(null);
  };

  const goBackToProviders = () => {
    setStep('provider');
    setSelectedProvider(null);
    setSelectedProduct(null);
    setErrorMsg(null);
  };

  const handleCheckout = () => {
    if (!selectedProduct || !selectedProvider) {
      setErrorMsg('Pilih provider dan produk terlebih dahulu.');
      return;
    }

    let finalTarget = targetNo.trim();
    if (targetMode === 'none') {
      finalTarget = wallet?.walletNo || 'VOUCHER';
    } else if (!finalTarget) {
      setErrorMsg(`${resolvedTargetLabel} wajib diisi.`);
      return;
    }

    if (targetMode === 'game' && secondaryValue.trim()) {
      finalTarget = `${finalTarget}|${secondaryValue.trim()}`;
    }

    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembelian ini.');
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

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3.5"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-emerald-900 text-sm">Transaksi Berhasil</h5>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500">
              Tutup
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3.5"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-red-900 text-sm">Perhatian</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'provider' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">Pilih Provider</h4>
              <p className="text-xs text-gray-500 mt-0.5">Pilih brand terlebih dahulu sebelum melihat daftar produk.</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={providerQuery}
                onChange={(e) => setProviderQuery(e.target.value)}
                placeholder="Cari provider..."
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
              <p className="text-sm font-extrabold text-gray-700">Provider belum tersedia</p>
              <p className="text-xs text-gray-400 mt-1">
                Katalog kosong. Pastikan sinkronisasi produk provider aktif di Operations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProviders.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectProvider(p.name)}
                  className="text-left p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                >
                  <div className="font-extrabold text-gray-900 text-sm truncate">{p.name}</div>
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
            Ganti provider
          </button>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">{selectedProvider}</h4>
              <p className="text-xs text-gray-500 mt-0.5">Pilih produk, lengkapi data tujuan, lalu lanjut ke konfirmasi.</p>
            </div>

            {targetMode !== 'none' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">{resolvedTargetLabel}</label>
                  <input
                    type="text"
                    value={targetNo}
                    onChange={(e) =>
                      setTargetNo(
                        targetMode === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value
                      )
                    }
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
            )}

            <div className="space-y-2.5">
              <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Daftar Produk</h5>
              {providerProducts.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                  Tidak ada produk aktif untuk provider ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {providerProducts.map((product) => {
                    const active = selectedProduct?.id === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className={`text-left p-4 rounded-2xl border transition-all ${
                          active
                            ? 'border-primary-500 bg-primary-50/40 shadow-sm'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-extrabold text-gray-900 text-sm leading-snug">{product.name}</div>
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

            <button
              type="button"
              onClick={handleCheckout}
              disabled={!selectedProduct}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary-500/10 transition-all"
            >
              Lanjut ke Konfirmasi
            </button>
          </div>
        </div>
      )}

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={resumePin ? 'PIN' : 'SUMMARY'}
          onClose={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
          onSuccess={() => {
            setSuccessMsg('Pembelian berhasil diproses.');
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
