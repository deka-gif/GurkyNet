import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CreditCard,
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
import {
  DetectedOperator,
  detectOperatorFromSerial,
  providerApiName,
  providerBadgeLabel,
} from '../../utils/detectOperator';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';

const PER_PAGE = 24;
const RETURN_PATH = '/dashboard/telekomunikasi/aktivasi-perdana';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 space-y-3 h-[150px]">
      <div className="h-4 bg-gray-200 rounded w-4/5" />
      <div className="h-5 bg-gray-200 rounded w-1/3 mt-auto" />
      <div className="h-9 bg-gray-100 rounded-xl" />
    </div>
  );
}

/**
 * Aktivasi Perdana (agen): Serial / barcode → operator → products → checkout.
 * Products only from GET /products?category=aktivasi-perdana.
 */
export function AktivasiPerdanaFlow() {
  const { wallet, fetchWallet } = useWalletStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  const [serial, setSerial] = useState('');
  const [provider, setProvider] = useState<DetectedOperator | string | null>(null);
  const [manualOperator, setManualOperator] = useState<string | null>(null);
  const [catalogOperators, setCatalogOperators] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSupported, setScanSupported] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckoutPanel, setShowCheckoutPanel] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout(RETURN_PATH);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
    setScanSupported(
      typeof window !== 'undefined' &&
        'BarcodeDetector' in window &&
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia
    );
    return () => stopScan();
  }, [fetchWallet]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const cleaned = serial.trim();
    if (cleaned.length < 6) {
      setProvider(null);
      setManualOperator(null);
      setProducts([]);
      return;
    }
    const detected = detectOperatorFromSerial(cleaned);
    setProvider(detected);
    if (detected) setManualOperator(null);
  }, [serial]);

  const activeOperator = manualOperator || provider;

  // Load operators that have aktivasi-perdana products (fallback when SN can't detect).
  useEffect(() => {
    if (serial.trim().length < 6 || activeOperator) return;
    let cancelled = false;
    (async () => {
      const res = await productService.getProducts({
        category: 'aktivasi-perdana',
        per_page: 200,
        page: 1,
      });
      if (cancelled || !res.success || !Array.isArray(res.data)) return;
      const names = Array.from(
        new Set(
          res.data
            .filter((p) => isCatalogListed(p))
            .map((p) => (p.operatorName || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'id'));
      setCatalogOperators(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [serial, activeOperator]);

  const loadProducts = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!activeOperator) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await productService.getProducts({
          category: 'aktivasi-perdana',
          provider: providerApiName(activeOperator),
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
        let rows = Array.isArray(res.data) ? res.data : [];
        // Soft client filter if provider LIKE is loose
        rows = rows.filter((p) => operatorsMatch(p.operatorName, activeOperator));
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
    [activeOperator, debouncedSearch]
  );

  useEffect(() => {
    if (!activeOperator) {
      setProducts([]);
      return;
    }
    setProducts([]);
    loadProducts(1, false);
  }, [activeOperator, loadProducts]);

  const stopScan = () => {
    if (scanTimer.current) {
      window.clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startScan = async () => {
    setErrorMsg(null);
    if (!scanSupported) {
      setErrorMsg('Kamera / BarcodeDetector tidak didukung di browser ini. Ketik nomor serial manual.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      await new Promise((r) => setTimeout(r, 50));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // BarcodeDetector is experimental in Chromium
      type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
        detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
      const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!BD) {
        stopScan();
        setErrorMsg('BarcodeDetector tidak tersedia di browser ini.');
        return;
      }
      const detector = new BD({
        formats: ['qr_code', 'ean_13', 'code_128', 'code_39'],
      });
      scanTimer.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            setSerial(String(codes[0].rawValue).replace(/\s+/g, ''));
            stopScan();
          }
        } catch {
          /* keep scanning */
        }
      }, 500);
    } catch {
      stopScan();
      setErrorMsg('Tidak dapat mengakses kamera. Izinkan kamera atau ketik serial manual.');
    }
  };

  const handleCheckout = () => {
    if (!activeOperator || !selectedProduct) {
      setErrorMsg('Pilih produk aktivasi terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    if (serial.trim().length < 6) {
      setErrorMsg('Nomor serial perdana wajib diisi.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi.');
      return;
    }
    setCheckoutData({
      serviceName: 'Aktivasi Perdana',
      productName: selectedProduct.name,
      targetNo: serial.trim(),
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Operator: String(activeOperator),
        'Nomor Serial': serial.trim(),
      },
    });
  };

  const showSidePanel = Boolean(selectedProduct && showCheckoutPanel);
  const needsOperatorPick = serial.trim().length >= 6 && !activeOperator;

  const operatorChips = useMemo(() => catalogOperators, [catalogOperators]);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Aktivasi Perdana
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Untuk agen PPOB — masukkan nomor serial atau scan barcode, lalu pilih paket aktivasi.
          </p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${showSidePanel ? 'lg:grid-cols-12' : ''}`}>
        <div
          className={`${showSidePanel ? 'lg:col-span-8' : ''} bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-xl space-y-5`}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700">Nomor Serial Perdana</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => {
                    setSerial(e.target.value.replace(/\s+/g, ''));
                    setSelectedProduct(null);
                    setShowCheckoutPanel(false);
                  }}
                  placeholder="Scan atau ketik nomor serial / ICCID"
                  className={`w-full py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 px-4 ${
                    activeOperator ? 'pr-28' : ''
                  }`}
                />
                {activeOperator && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary-50 text-primary-700 font-extrabold text-[11px] px-2.5 py-1 rounded-lg border border-primary-100 uppercase">
                    {providerBadgeLabel(activeOperator)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => (scanning ? stopScan() : startScan())}
                className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-xs font-bold text-gray-800 hover:border-primary-300"
              >
                <Camera className="w-4 h-4" />
                {scanning ? 'Stop Scan' : 'Scan Barcode'}
              </button>
            </div>
            {!scanSupported && (
              <p className="text-[11px] text-gray-400 font-semibold">
                Scan kamera tersedia di browser yang mendukung BarcodeDetector.
              </p>
            )}
          </div>

          {scanning && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black">
              <video ref={videoRef} className="w-full max-h-64 object-cover" muted playsInline />
            </div>
          )}

          {needsOperatorPick && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-600">Pilih operator (produk dari katalog):</p>
              <div className="flex flex-wrap gap-2">
                {operatorChips.length === 0 ? (
                  <span className="text-xs text-gray-400">Memuat operator…</span>
                ) : (
                  operatorChips.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setManualOperator(name)}
                      className="px-4 py-2 rounded-full text-xs font-bold border border-gray-200 bg-white hover:border-primary-300"
                    >
                      {name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {activeOperator && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari paket aktivasi..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {loadError && (
                <div className="p-3 rounded-2xl bg-red-50 text-xs text-red-700 font-semibold">{loadError}</div>
              )}

              {loading && products.length === 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center border border-dashed rounded-3xl text-sm font-bold text-gray-600">
                  Tidak ada produk aktivasi untuk operator ini.
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
                      } ${!isProductPurchasable(p) ? 'opacity-70' : ''}`}
                    >
                      <h4 className="font-extrabold text-sm text-gray-900 line-clamp-2 min-h-[2.5rem]">{p.name}</h4>
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
              {loading && products.length > 0 && (
                <RefreshCw className="w-5 h-5 mx-auto text-gray-300 animate-spin" />
              )}
            </>
          )}

          {serial.trim().length < 6 && (
            <div className="p-10 border border-dashed rounded-3xl text-center text-xs text-gray-400 font-semibold">
              Masukkan nomor serial perdana untuk menampilkan paket aktivasi.
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
              <div className="flex justify-between"><span>Serial</span><span className="text-gray-900 break-all ml-4">{serial}</span></div>
              <div className="flex justify-between"><span>Operator</span><span className="text-gray-900">{activeOperator}</span></div>
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
          onSuccess={() => {
            setSuccessMsg('Aktivasi perdana berhasil diproses.');
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
