import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Smartphone,
  AlertCircle,
  CreditCard,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { operatorsMatch } from '../../utils/operatorMatch';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import {
  detectOperatorFromPhone,
  providerApiName,
  providerBadgeLabel,
} from '../../utils/detectOperator';
import { MobileStickyActionBar, MOBILE_STICKY_ACTION_PAD } from '../../components/catalog/MobileStickyActionBar';

/**
 * Pulsa web — detect operator from phone, then scoped GET /products?provider=…
 * (mirror mobile PulsaCatalogFlow). No full-category dump. Web audit Item 4.
 */
export const PulsaPage = () => {
  const { wallet, fetchWallet } = useWalletStore();

  const [phoneNo, setPhoneNo] = useState('');
  const [scopedProducts, setScopedProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadSeq = useRef(0);

  const provider = useMemo(() => detectOperatorFromPhone(phoneNo), [phoneNo]);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    if (loadError) toastError('Terjadi Kesalahan', loadError);
  }, [loadError]);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout('/dashboard/pulsa');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet]);

  const loadPulsaForOperator = useCallback(async (op: NonNullable<typeof provider>) => {
    const seq = ++loadSeq.current;
    const apiProvider = providerApiName(op);
    if (!apiProvider) {
      setScopedProducts([]);
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    setLoadError(null);
    try {
      const res = await productService.getProducts({
        category: 'pulsa',
        provider: apiProvider,
        per_page: 500,
        sort: 'price_asc',
      });
      if (seq !== loadSeq.current) return;
      if (res.success && Array.isArray(res.data)) {
        setScopedProducts(res.data);
      } else {
        setLoadError(res.message || 'Gagal memuat produk.');
        setScopedProducts([]);
      }
    } catch (e: unknown) {
      if (seq !== loadSeq.current) return;
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat produk.');
      setScopedProducts([]);
    } finally {
      if (seq === loadSeq.current) setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedProduct(null);
    if (!provider) {
      loadSeq.current += 1;
      setScopedProducts([]);
      setLoadError(null);
      setProductsLoading(false);
      return;
    }
    void loadPulsaForOperator(provider);
  }, [provider, loadPulsaForOperator]);

  const displayProducts = useMemo(() => {
    if (!provider) return [];
    return scopedProducts
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, provider))
      .sort((a, b) => a.price - b.price);
  }, [scopedProducts, provider]);

  const handleCheckout = async () => {
    if (!provider) {
      setErrorMsg('Tolong masukkan nomor HP yang valid terlebih dahulu.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Pilih nominal pulsa yang ingin Anda beli.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembelian ini.');
      return;
    }

    const nominalString = selectedProduct.name.replace(/\D/g, '');
    const nominal = nominalString ? parseInt(nominalString, 10) : selectedProduct.price;

    setCheckoutData({
      serviceName: 'Pulsa',
      productName: selectedProduct.name,
      targetNo: phoneNo,
      amount: nominal,
      adminFee: selectedProduct.price - nominal,
      skuCode: selectedProduct.code,
      customDetails: {
        Operator: selectedProduct.operatorName,
      },
    });
  };

  return (
    <div className={`dashboard-page space-y-6 container mx-auto max-w-5xl ${selectedProduct ? MOBILE_STICKY_ACTION_PAD : ''}`} id="pulsa-page-root">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Isi Pulsa Seluler</h2>
          <p className="text-sm text-gray-500">
            Beli pulsa instan ke semua operator Indonesia dengan harga agen paling murah.
          </p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
          <div className="space-y-2">
            <h4 className="font-extrabold text-gray-900 text-base">Detail Nomor Penerima</h4>
            <p className="text-xs text-gray-500">
              Provider dideteksi otomatis; produk dimuat hanya untuk operator tersebut.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">Nomor Handphone</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Smartphone className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
              />
              {provider && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="bg-primary-50 text-primary-700 font-extrabold text-xs px-3 py-1.5 rounded-xl border border-primary-100">
                    {providerBadgeLabel(provider)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="font-extrabold text-gray-900 text-sm">Pilih Nominal Pulsa</h5>

            {!provider ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <Smartphone className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-medium">
                  Ketik nomor HP Anda terlebih dahulu untuk memunculkan daftar nominal.
                </p>
              </div>
            ) : productsLoading ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
                <p className="text-xs font-medium">Memuat daftar produk...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-medium">Produk tidak tersedia untuk operator ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                {displayProducts.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedProduct(opt)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                      selectedProduct?.id === opt.id
                        ? 'bg-primary-50/40 border-primary-500 ring-2 ring-primary-500/20 shadow-md'
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-300 hover:bg-white'
                    } ${!isProductPurchasable(opt) ? 'opacity-70' : ''}`}
                  >
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {opt.operatorName}
                      </span>
                      <h4 className="font-extrabold text-gray-900 text-sm mt-0.5 leading-tight">{opt.name}</h4>
                      {!isProductPurchasable(opt) && (
                        <p className="text-[10px] font-bold text-amber-700 mt-1">Sedang maintenance</p>
                      )}
                    </div>
                    <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between w-full">
                      <span className="text-[10px] text-gray-500">Harga Agen</span>
                      <span className="text-xs font-black text-primary-600">{formatIDR(opt.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 flex flex-col justify-between h-fit">
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <h4 className="font-extrabold text-gray-900 text-base">Ringkasan Pembelian</h4>
              <p className="text-xs text-gray-500 mt-1">
                Verifikasi kembali pesanan pulsa Anda sebelum melunasi pembayaran.
              </p>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Nomor Tujuan</span>
                  <span className="text-gray-900">{phoneNo || '-'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Operator</span>
                  <span className="text-gray-900">{selectedProduct.operatorName}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Produk</span>
                  <span className="text-gray-900 text-right ml-4">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Metode Pembayaran</span>
                  <span className="text-primary-600">Saldo GurkyPay</span>
                </div>

                <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">Total Tagihan</span>
                  <span className="text-xl font-black text-primary-600">
                    {formatIDR(selectedProduct.price)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 space-y-1.5">
                <p className="text-xs font-medium">
                  Silakan pilih nomor HP dan nominal pulsa di panel kiri untuk melihat rincian checkout.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={loading || !selectedProduct || !isProductPurchasable(selectedProduct)}
            onClick={() => void handleCheckout()}
            className={`max-lg:hidden w-full mt-6 py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-primary-400 cursor-not-allowed'
                : selectedProduct && isProductPurchasable(selectedProduct)
                  ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/10'
                  : 'bg-gray-200 cursor-not-allowed text-gray-400'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Transaksi...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Beli Sekarang</span>
              </>
            )}
          </button>
        </div>
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
            setPhoneNo('');
            setSelectedProduct(null);
            setResumePin(false);
          }}
        />
      )}

      {selectedProduct ? (
        <MobileStickyActionBar
          meta={`${selectedProduct.name} · ${formatIDR(selectedProduct.price)}`}
          label="Beli Sekarang"
          loading={loading}
          disabled={loading || !isProductPurchasable(selectedProduct)}
          onClick={() => void handleCheckout()}
        />
      ) : null}
    </div>
  );
};
