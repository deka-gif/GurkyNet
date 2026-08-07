import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  QrCode,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { providerApiName, providerBadgeLabel } from '../../utils/detectOperator';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';

const PER_PAGE = 24;
const RETURN_PATH = '/dashboard/telekomunikasi/esim';

export type EsimDeliveryMeta = {
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  msisdn?: string | null;
  iccid?: string | null;
  activationCode?: string | null;
  activationGuide?: string | null;
};

function extractEsimMeta(trx: unknown): EsimDeliveryMeta | null {
  if (!trx || typeof trx !== 'object') return null;
  const t = trx as Record<string, unknown>;
  const nested =
    (t.esim as Record<string, unknown> | undefined) ||
    (t.meta as Record<string, unknown> | undefined) ||
    (t.providerResponse as Record<string, unknown> | undefined) ||
    (t.note && typeof t.note === 'object' ? (t.note as Record<string, unknown>) : undefined);

  const src = nested || t;
  const qrCodeUrl = (src.qr_code_url || src.qrCodeUrl || src.qr_url || src.qrUrl) as string | undefined;
  const qrPayload = (src.qr_payload || src.qrPayload || src.qr_data || src.qrData) as string | undefined;
  const msisdn = (src.msisdn || src.phone || src.nomor_baru || src.newNumber) as string | undefined;
  const iccid = (src.iccid || src.ICCID) as string | undefined;
  const activationCode = (src.activation_code || src.activationCode || src.lpa || src.smdp) as
    | string
    | undefined;
  const activationGuide = (src.activation_guide || src.activationGuide || src.cara_aktivasi) as
    | string
    | undefined;

  if (!qrCodeUrl && !qrPayload && !msisdn && !iccid && !activationCode) {
    return null;
  }

  return {
    qrCodeUrl: qrCodeUrl || null,
    qrPayload: qrPayload || null,
    msisdn: msisdn || null,
    iccid: iccid || null,
    activationCode: activationCode || null,
    activationGuide:
      activationGuide ||
      'Ikuti instruksi aktivasi eSIM dari provider. Buka pengaturan eSIM di ponsel lalu pindai QR atau masukkan activation code.',
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 space-y-3 h-[150px]">
      <div className="h-4 bg-gray-200 rounded w-4/5" />
      <div className="h-5 bg-gray-200 rounded w-1/3" />
      <div className="h-9 bg-gray-100 rounded-xl" />
    </div>
  );
}

/**
 * eSIM: pilih provider → produk → checkout (tanpa nomor HP).
 * Success menampilkan QR/ICCID hanya jika provider mengembalikan data nyata.
 */
export function EsimCatalogFlow() {
  const { wallet, fetchWallet } = useWalletStore();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
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
  const [esimMeta, setEsimMeta] = useState<EsimDeliveryMeta | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout(RETURN_PATH);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
    (async () => {
      setProvidersLoading(true);
      try {
        const res = await productService.getProducts({
          category: 'esim',
          per_page: 500,
          page: 1,
        });
        if (res.success && Array.isArray(res.data)) {
          setAllProducts(res.data.filter((p) => isCatalogListed(p)));
        }
      } finally {
        setProvidersLoading(false);
      }
    })();
  }, [fetchWallet]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const providers = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      const name = (p.operatorName || '').trim();
      if (!name) continue;
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [allProducts]);

  const loadProducts = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!selectedProvider) return;
      setLoading(true);
      try {
        const res = await productService.getProducts({
          category: 'esim',
          provider: providerApiName(selectedProvider) || selectedProvider,
          keyword: debouncedSearch || undefined,
          page: pageNum,
          per_page: PER_PAGE,
          sort: 'price_asc',
        });
        if (!res.success) {
          if (!append) setProducts([]);
          return;
        }
        let rows = Array.isArray(res.data) ? res.data : [];
        rows = rows.filter((p) => operatorsMatch(p.operatorName, selectedProvider));
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        const pag = res.pagination;
        if (pag) {
          setPage(pag.currentPage ?? pag.current_page ?? pageNum);
          setLastPage(pag.lastPage ?? pag.last_page ?? 1);
        } else {
          setPage(pageNum);
          setLastPage(1);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedProvider, debouncedSearch]
  );

  useEffect(() => {
    if (!selectedProvider) {
      setProducts([]);
      return;
    }
    setProducts([]);
    loadProducts(1, false);
  }, [selectedProvider, loadProducts]);

  const handleCheckout = () => {
    if (!selectedProvider || !selectedProduct) {
      setErrorMsg('Pilih provider dan paket eSIM terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi.');
      return;
    }
    // eSIM: target is placeholder — provider issues new number after fulfillment.
    setCheckoutData({
      serviceName: 'eSIM',
      productName: selectedProduct.name,
      targetNo: wallet.walletNo || 'ESIM',
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Provider: selectedProvider,
        Tipe: 'eSIM',
      },
    });
  };

  const copyText = async (label: string, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyHint(`${label} disalin`);
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setErrorMsg('Gagal menyalin ke clipboard.');
    }
  };

  const downloadQr = () => {
    if (!esimMeta?.qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = esimMeta.qrCodeUrl;
    a.download = 'esim-qr.png';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const showSidePanel = Boolean(selectedProduct && showCheckoutPanel);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">eSIM</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pilih provider dan paket. Nomor baru & QR dikirim setelah transaksi sukses (jika API
            provider mendukung).
          </p>
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
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3"
          >
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <h5 className="font-bold text-emerald-900 text-sm">Transaksi eSIM berhasil</h5>
                <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
              </div>
              <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500">
                Tutup
              </button>
            </div>

            {esimMeta ? (
              <div className="bg-white rounded-2xl border border-emerald-100 p-4 space-y-3">
                {(esimMeta.qrCodeUrl || esimMeta.qrPayload) && (
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-40 h-40 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {esimMeta.qrCodeUrl ? (
                        <img src={esimMeta.qrCodeUrl} alt="QR eSIM" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center p-3">
                          <QrCode className="w-8 h-8 mx-auto text-gray-400" />
                          <p className="text-[10px] text-gray-500 mt-2 font-semibold break-all">
                            {esimMeta.qrPayload}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 text-xs">
                      {esimMeta.msisdn && (
                        <div>
                          <span className="font-bold text-gray-500">Nomor Baru</span>
                          <p className="font-black text-gray-900">{esimMeta.msisdn}</p>
                        </div>
                      )}
                      {esimMeta.iccid && (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-500">ICCID</span>
                            <p className="font-mono text-gray-900 break-all">{esimMeta.iccid}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText('ICCID', esimMeta.iccid)}
                            className="p-2 rounded-lg border border-gray-100"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {esimMeta.activationCode && (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-500">Activation Code</span>
                            <p className="font-mono text-gray-900 break-all">{esimMeta.activationCode}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyText('Activation', esimMeta.activationCode)}
                            className="p-2 rounded-lg border border-gray-100"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {esimMeta.activationGuide && (
                        <p className="text-gray-600 leading-relaxed">{esimMeta.activationGuide}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {esimMeta.qrCodeUrl && (
                          <button
                            type="button"
                            onClick={downloadQr}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 text-white text-[11px] font-bold"
                          >
                            <Download className="w-3.5 h-3.5" /> Download QR
                          </button>
                        )}
                      </div>
                      {copyHint && <p className="text-primary-600 font-bold">{copyHint}</p>}
                    </div>
                  </div>
                )}
                {!esimMeta.qrCodeUrl && !esimMeta.qrPayload && (
                  <p className="text-xs text-amber-700 font-semibold">
                    Provider belum mengembalikan QR/ICCID pada respons transaksi. Data aktivasi akan
                    tampil di sini ketika API provider mendukungnya.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                QR, nomor baru, ICCID, dan activation code belum tersedia dari provider. Struktur
                halaman sudah siap — tanpa data palsu.
              </p>
            )}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1 text-xs text-red-700 font-semibold">{errorMsg}</div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid grid-cols-1 gap-6 ${showSidePanel ? 'lg:grid-cols-12' : ''}`}>
        <div
          className={`${showSidePanel ? 'lg:col-span-8' : ''} bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-xl space-y-5`}
        >
          <div>
            <p className="text-xs font-black text-gray-700 mb-2">Pilih Provider</p>
            {providersLoading ? (
              <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
            ) : providers.length === 0 ? (
              <p className="text-xs text-gray-400 font-semibold">Belum ada produk eSIM di katalog.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => {
                  const active = selectedProvider === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(p.name);
                        setSelectedProduct(null);
                        setShowCheckoutPanel(false);
                      }}
                      className={`px-4 py-2.5 rounded-full text-xs font-bold border ${
                        active
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                      }`}
                    >
                      {providerBadgeLabel(p.name) || p.name}
                      <span className="ml-1 opacity-70">({p.count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedProvider && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari paket eSIM..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {loading && products.length === 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center border border-dashed rounded-3xl text-sm font-bold text-gray-600">
                  Tidak ada paket eSIM untuk provider ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {products.map((p) => (
                    <article
                      key={p.id || p.code}
                      className={`flex flex-col rounded-2xl border p-4 bg-white ${
                        selectedProduct?.code === p.code
                          ? 'border-primary-500 ring-2 ring-primary-500/20'
                          : 'border-gray-100 shadow-sm'
                      }`}
                    >
                      <h4 className="font-extrabold text-sm text-gray-900 line-clamp-2 min-h-[2.5rem]">{p.name}</h4>
                      {p.description && (
                        <p className="text-[11px] text-gray-500 mt-2 line-clamp-2">{p.description}</p>
                      )}
                      {!isProductPurchasable(p) && (
                        <p className="text-[10px] font-bold text-amber-700 mt-1">Sedang maintenance</p>
                      )}
                      <span className="mt-3 text-base font-black text-red-600">{formatIDR(p.price)}</span>
                      <button
                        type="button"
                        disabled={!isProductPurchasable(p)}
                        onClick={() => {
                          if (!isProductPurchasable(p)) return;
                          setSelectedProduct(p);
                          setShowCheckoutPanel(true);
                        }}
                        className="mt-3 w-full py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProductPurchasable(p) ? 'Beli' : 'Maintenance'}
                      </button>
                    </article>
                  ))}
                </div>
              )}

              {page < lastPage && !loading && (
                <button
                  type="button"
                  onClick={() => loadProducts(page + 1, true)}
                  className="w-full py-3 rounded-2xl border text-xs font-bold"
                >
                  Muat lebih banyak
                </button>
              )}
            </>
          )}

          {!selectedProvider && !providersLoading && (
            <div className="p-10 border border-dashed rounded-3xl text-center text-xs text-gray-400 font-semibold">
              Pilih provider untuk menampilkan paket eSIM. Tidak perlu memasukkan nomor HP.
            </div>
          )}
        </div>

        {showSidePanel && selectedProduct && (
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border shadow-xl h-fit lg:sticky lg:top-6 space-y-5">
            <div className="flex justify-between border-b pb-4">
              <h4 className="font-extrabold">Rincian Belanja</h4>
              <button type="button" onClick={() => { setShowCheckoutPanel(false); setSelectedProduct(null); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="text-xs font-bold text-gray-500 space-y-2">
              <div className="flex justify-between">
                <span>Provider</span>
                <span className="text-gray-900">{selectedProvider}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-900">{selectedProduct.name}</div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-900">Total</span>
                <span className="text-xl font-black text-primary-600">{formatIDR(selectedProduct.price)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={!isProductPurchasable(selectedProduct)}
              onClick={handleCheckout}
              className="w-full py-3.5 rounded-2xl bg-primary-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" /> Bayar Sekarang
            </button>
          </div>
        )}
      </div>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={resumePin ? 'PIN' : 'SUMMARY'}
          onClose={() => { setCheckoutData(null); setResumePin(false); }}
          onSuccess={(trx) => {
            const meta = extractEsimMeta(trx);
            setEsimMeta(meta);
            setSuccessMsg(
              meta
                ? 'eSIM diproses. Detail aktivasi dari provider ditampilkan di bawah.'
                : 'eSIM diproses. Detail QR/ICCID akan muncul bila provider mengembalikannya.'
            );
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
