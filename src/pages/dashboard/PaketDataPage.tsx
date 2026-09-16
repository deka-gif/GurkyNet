import { useState, useEffect } from 'react';
import {
  Wifi,
  Smartphone,
  CreditCard,
  Wallet,
  X,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import {
  TelkomselPaketDataCatalog,
  TELKOMSEL_PAKET_CONFIG,
  XL_PAKET_CONFIG,
  INDOSAT_PAKET_CONFIG,
  TRI_PAKET_CONFIG,
  SMARTFREN_PAKET_CONFIG,
  AXIS_PAKET_CONFIG,
  BYU_PAKET_CONFIG,
} from '../../components/catalog/TelkomselPaketDataCatalog';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { isProductPurchasable } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import {
  detectOperatorFromPhone,
  providerBadgeLabel as operatorBadgeLabel,
} from '../../utils/detectOperator';
import { MobileStickyActionBar, MOBILE_STICKY_ACTION_PAD } from '../../components/catalog/MobileStickyActionBar';

/**
 * Paket Data — catalog via TelkomselPaketDataCatalog (scoped provider fetch).
 * Removed redundant parallel fetchProducts({ category: 'data' }) dump (web audit Item 5).
 */
export const PaketDataPage = () => {
  const { wallet, fetchWallet } = useWalletStore();

  const [phoneNo, setPhoneNo] = useState<string>('');
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckoutPanel, setShowCheckoutPanel] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [regionDialog, setRegionDialog] = useState<Product | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [regionOptions, setRegionOptions] = useState<string[]>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  const isTelkomsel = provider === 'Telkomsel';
  const isXl = provider === 'XL Axiata';
  const isIndosat = provider === 'Indosat';
  const isTri = provider === 'Tri (3)';
  const isSmartfren = provider === 'Smartfren';
  const isAxis = provider === 'Axis';
  const isByu = provider === 'by.U';
  const usesMasterCatalog =
    isTelkomsel || isXl || isIndosat || isTri || isSmartfren || isAxis || isByu;
  const catalogConfig = isByu
    ? BYU_PAKET_CONFIG
    : isAxis
      ? AXIS_PAKET_CONFIG
      : isSmartfren
        ? SMARTFREN_PAKET_CONFIG
        : isTri
          ? TRI_PAKET_CONFIG
          : isIndosat
            ? INDOSAT_PAKET_CONFIG
            : isXl
              ? XL_PAKET_CONFIG
              : TELKOMSEL_PAKET_CONFIG;

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout('/dashboard/paket-data');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet]);

  useEffect(() => {
    const op = detectOperatorFromPhone(phoneNo);
    setProvider(op);
    if (!op) {
      setSelectedProduct(null);
      setShowCheckoutPanel(false);
      setRegionOptions([]);
      setSelectedRegion('');
    }
  }, [phoneNo]);

  useEffect(() => {
    if (regionOptions.length > 0) {
      setSelectedRegion((prev) => (regionOptions.includes(prev) ? prev : regionOptions[0]));
    } else {
      setSelectedRegion('');
    }
  }, [regionOptions]);

  const handleCheckout = async () => {
    if (!provider) {
      setErrorMsg('Tolong masukkan nomor HP yang valid terlebih dahulu.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Silakan pilih paket internet terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk membeli paket data ini.');
      return;
    }

    setLoading(true);
    try {
      setCheckoutData({
        serviceName: 'Paket Data',
        productName: selectedProduct.name,
        targetNo: phoneNo,
        amount: selectedProduct.price,
        adminFee: 0,
        skuCode: selectedProduct.code,
        customDetails: {
          Operator: provider,
          ...(selectedProduct.quota ? { Kuota: selectedProduct.quota } : {}),
          ...(selectedProduct.validity ? { 'Masa Aktif': selectedProduct.validity } : {}),
          ...(selectedRegion && selectedProduct.requiresRegion ? { Wilayah: selectedRegion } : {}),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const showSidePanel = Boolean(selectedProduct && showCheckoutPanel);
  const providerBadgeLabel = operatorBadgeLabel(provider);

  return (
    <div className={`dashboard-page space-y-6 container mx-auto max-w-7xl ${showSidePanel ? MOBILE_STICKY_ACTION_PAD : ''}`} id="paket-data-page-root">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Paket Data Internet
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Pilih paket terbaik untuk nomor Anda. Operator terdeteksi otomatis dari prefix.
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
          className={`${showSidePanel ? 'lg:col-span-8' : ''} bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5`}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700">Nomor Handphone</label>
            <div className="relative">
              <Smartphone className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                placeholder="081234567890"
                value={phoneNo}
                onChange={(e) => {
                  setPhoneNo(e.target.value.replace(/\D/g, ''));
                  setSelectedProduct(null);
                  setShowCheckoutPanel(false);
                }}
                className={`w-full pl-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide ${
                  provider ? 'pr-28' : 'pr-4'
                }`}
              />
              {provider && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary-50 text-primary-700 font-extrabold text-[11px] px-2.5 py-1 rounded-lg border border-primary-100 uppercase tracking-wide">
                  {providerBadgeLabel}
                </span>
              )}
            </div>
          </div>

          {!provider && (
            <div className="p-12 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
              <Wifi className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-xs font-semibold">Masukkan nomor HP untuk melihat paket.</p>
            </div>
          )}

          {usesMasterCatalog && (
            <TelkomselPaketDataCatalog
              key={catalogConfig.taxonomyKey}
              config={catalogConfig}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
              onBuy={() => setShowCheckoutPanel(true)}
              onRegionNeeded={(p) => setRegionDialog(p)}
              onRegionOptionsChange={setRegionOptions}
            />
          )}

        </div>

        {showSidePanel && selectedProduct && (
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 h-fit lg:sticky lg:top-6">
            <div className="border-b border-gray-100 pb-4 flex items-start justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-gray-900 text-base">Rincian Belanja</h4>
                <p className="text-xs text-gray-500 mt-1">Konfirmasi paket lalu lanjut ke PIN.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutPanel(false);
                  setSelectedProduct(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                aria-label="Tutup rincian"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-gray-500">
                <span>Nomor</span>
                <span className="text-gray-900">{phoneNo}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-gray-500">
                <span>Operator</span>
                <span className="text-gray-900">{provider}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Paket</span>
                <div className="font-bold text-sm text-gray-900">{selectedProduct.name}</div>
                {(selectedProduct.quota || selectedProduct.validity) && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    {[selectedProduct.quota, selectedProduct.validity].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-center">
                <span className="text-xs font-black text-gray-900">Total</span>
                <span className="text-xl font-black text-primary-600">
                  {formatIDR(selectedProduct.price)}
                </span>
              </div>
            </div>

            <button
              disabled={loading || !selectedProduct}
              onClick={handleCheckout}
              className="max-lg:hidden w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700"
            >
              <CreditCard className="w-4 h-4" />
              Bayar Sekarang
            </button>
          </div>
        )}
      </div>

      {regionDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 border border-gray-100 shadow-2xl">
            <h4 className="font-extrabold text-gray-900 text-sm">Pilih Wilayah</h4>
            <p className="text-xs text-gray-500">
              Paket ini memiliki varian area. Pilih wilayah yang sesuai (hanya jika provider
              mewajibkan).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {regionOptions.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setSelectedRegion(area)}
                  className={`py-2.5 rounded-xl text-xs font-bold border ${
                    selectedRegion === area
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-100'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(regionDialog);
                setShowCheckoutPanel(true);
                setRegionDialog(null);
              }}
              className="w-full py-3 rounded-2xl bg-primary-600 text-white text-sm font-bold"
            >
              Lanjut
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
            setSuccessMsg('Pembelian paket data berhasil diproses.');
            setSelectedProduct(null);
            setShowCheckoutPanel(false);
            setResumePin(false);
            fetchWallet();
          }}
        />
      )}

      {showSidePanel && selectedProduct ? (
        <MobileStickyActionBar
          meta={`${selectedProduct.name} · ${formatIDR(selectedProduct.price)}`}
          label="Bayar Sekarang"
          loading={loading}
          disabled={loading}
          onClick={() => void handleCheckout()}
        />
      ) : null}
    </div>
  );
};
