import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Search,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import {
  detectOperatorFromPhone,
  providerApiName,
  providerBadgeLabel,
} from '../../utils/detectOperator';

type Props = {
  category: string;
  title: string;
  subtitle: string;
  serviceName: string;
  returnPath: string;
  searchPlaceholder?: string;
};

const PER_PAGE = 24;

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 space-y-3 h-[160px]">
      <div className="h-4 bg-gray-200 rounded w-4/5" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-5 bg-gray-200 rounded w-1/3 mt-auto" />
      <div className="h-9 bg-gray-100 rounded-xl" />
    </div>
  );
}

/**
 * Telekomunikasi PPOB flow: Nomor HP → detect operator → products (API) → checkout.
 * No provider picker. Products from Digiflazz/VIP via GET /products.
 */
export function PhoneOperatorCatalogFlow({
  category,
  title,
  subtitle,
  serviceName,
  returnPath,
  searchPlaceholder = 'Cari paket...',
}: Props) {
  const { wallet, fetchWallet } = useWalletStore();

  const [phoneNo, setPhoneNo] = useState('');
  const [provider, setProvider] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckoutPanel, setShowCheckoutPanel] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, returnPath]);

  useEffect(() => {
    const op = detectOperatorFromPhone(phoneNo);
    setProvider(op);
    if (!op) {
      setProducts([]);
      setSelectedProduct(null);
      setShowCheckoutPanel(false);
    }
  }, [phoneNo]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadProducts = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!provider) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await productService.getProducts({
          category,
          provider: providerApiName(provider),
          keyword: debouncedSearch || undefined,
          page: pageNum,
          per_page: PER_PAGE,
          sort: 'price_asc',
        });
        if (!res.success) {
          setLoadError(res.message || 'Gagal memuat produk.');
          if (!append) setProducts([]);
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        const pag = res.pagination;
        if (pag) {
          setPage(pag.currentPage ?? pag.current_page ?? pageNum);
          setLastPage(pag.lastPage ?? pag.last_page ?? 1);
        } else {
          setPage(pageNum);
          setLastPage(1);
        }
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : 'Gagal memuat produk.');
        if (!append) setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [provider, category, debouncedSearch]
  );

  useEffect(() => {
    if (!provider) return;
    setProducts([]);
    loadProducts(1, false);
  }, [provider, loadProducts]);

  const handleCheckout = () => {
    if (!provider || !selectedProduct) {
      setErrorMsg('Pilih paket terlebih dahulu.');
      return;
    }
    if (phoneNo.replace(/\D/g, '').length < 10) {
      setErrorMsg('Nomor HP tidak valid.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi.');
      return;
    }
    setCheckoutData({
      serviceName,
      productName: selectedProduct.name,
      targetNo: phoneNo.replace(/\D/g, ''),
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Operator: provider,
      },
    });
  };

  const showSidePanel = Boolean(selectedProduct && showCheckoutPanel);
  const badge = providerBadgeLabel(provider);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
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
              <h5 className="font-bold text-emerald-900 text-sm">Transaksi berhasil</h5>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500">
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
            <button type="button" onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid grid-cols-1 gap-6 ${showSidePanel ? 'lg:grid-cols-12' : ''}`}>
        <div
          className={`${showSidePanel ? 'lg:col-span-8' : ''} bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5`}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700">Nomor Handphone</label>
            <div className="relative">
              <Smartphone className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneNo}
                onChange={(e) => {
                  setPhoneNo(e.target.value.replace(/\D/g, ''));
                  setSelectedProduct(null);
                  setShowCheckoutPanel(false);
                }}
                placeholder="08xxxxxxxxxx"
                className={`w-full pl-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white ${
                  provider ? 'pr-28' : 'pr-4'
                }`}
              />
              {provider && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary-50 text-primary-700 font-extrabold text-[11px] px-2.5 py-1 rounded-lg border border-primary-100 uppercase tracking-wide">
                  {badge}
                </span>
              )}
            </div>
          </div>

          {!provider && (
            <div className="p-12 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 text-xs font-semibold">
              Masukkan nomor HP untuk menampilkan paket.
            </div>
          )}

          {provider && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {loadError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 font-semibold">
                  {loadError}
                </div>
              )}

              {loading && products.length === 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="py-14 text-center border border-dashed border-gray-200 rounded-3xl text-sm font-bold text-gray-600">
                  Tidak ada produk untuk operator ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {products.map((p) => {
                    const active = selectedProduct?.id === p.id || selectedProduct?.code === p.code;
                    return (
                      <article
                        key={p.id || p.code}
                        className={`flex flex-col rounded-2xl border bg-white p-4 transition-all ${
                          active
                            ? 'border-primary-500 ring-2 ring-primary-500/20'
                            : 'border-gray-100 shadow-sm hover:border-primary-200'
                        }`}
                      >
                        <h4 className="font-extrabold text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                          {p.name}
                        </h4>
                        {(p.quota || p.validity) && (
                          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-[11px] font-bold text-gray-600">
                            {p.quota && <span>{p.quota}</span>}
                            {p.validity && <span>{p.validity}</span>}
                          </div>
                        )}
                        {p.description && (
                          <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 flex-1">{p.description}</p>
                        )}
                        <span className="mt-3 text-base font-black text-red-600">{formatIDR(p.price)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(p);
                            setShowCheckoutPanel(true);
                          }}
                          className="mt-3 w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black"
                        >
                          Beli
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              {page < lastPage && !loading && (
                <button
                  type="button"
                  onClick={() => loadProducts(page + 1, true)}
                  className="w-full py-3 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 hover:border-primary-200"
                >
                  Muat lebih banyak
                </button>
              )}
              {loading && products.length > 0 && (
                <div className="flex justify-center py-2">
                  <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        {showSidePanel && selectedProduct && (
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl h-fit lg:sticky lg:top-6 space-y-5">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-extrabold text-gray-900">Rincian Belanja</h4>
                <p className="text-xs text-gray-500 mt-1">Konfirmasi lalu lanjut ke PIN.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutPanel(false);
                  setSelectedProduct(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs font-bold text-gray-500">
              <div className="flex justify-between">
                <span>Nomor</span>
                <span className="text-gray-900">{phoneNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Operator</span>
                <span className="text-gray-900">{provider}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="font-bold text-sm text-gray-900">{selectedProduct.name}</div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100">
                <span className="text-gray-900">Total</span>
                <span className="text-xl font-black text-primary-600">{formatIDR(selectedProduct.price)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-primary-600 hover:bg-primary-700 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Bayar Sekarang
            </button>
          </div>
        )}
      </div>

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
            setSelectedProduct(null);
            setShowCheckoutPanel(false);
            setCheckoutData(null);
            setResumePin(false);
            fetchWallet();
          }}
        />
      )}
    </div>
  );
}
