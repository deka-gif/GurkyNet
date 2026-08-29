import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Printer, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { ProductPicker } from '../../components/catalog/ProductPicker';
import { TelkomselZonePicker } from '../../components/catalog/TelkomselZonePicker';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { filterVoucherInternetProducts } from '../../utils/voucherInternetGuard';
import {
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';
import { productService } from '../../services/product/product.service';

export const VoucherElektronikZonaPage = () => {
  const navigate = useNavigate();
  const { zona: zonaParam } = useParams<{ zona: string }>();
  const zona = zonaParam ? decodeURIComponent(zonaParam) : '';

  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [phoneNo, setPhoneNo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);

  const [telkomselNationalSelected, setTelkomselNationalSelected] = useState(false);
  const [telkomselZoneLabel, setTelkomselZoneLabel] = useState<string | null>(null);
  const [telkomselZoneReference, setTelkomselZoneReference] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category: 'voucher-internet' });
    const pending = consumePendingCheckout(`/dashboard/voucher-internet/elektronik/${encodeURIComponent(zona)}`);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts, zona]);

  useEffect(() => {
    void productService.getTelkomselVoucherZoneReference().then((res) => {
      if (res.success && res.data?.zones) {
        setTelkomselZoneReference(res.data.zones);
      }
    });
  }, []);

  const voucherInternetProducts = useMemo(() => filterVoucherInternetProducts(products), [products]);

  const zonaProducts = useMemo(() => {
    if (!zona) return [];
    return voucherInternetProducts
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, zona))
      .sort((a, b) => a.price - b.price);
  }, [voucherInternetProducts, zona]);

  const telkomselCatalogActive =
    !!zona && isTelkomselOperator(zona) && zonaProducts.length > 0;
  const telkomselZoneGateNeeded =
    telkomselCatalogActive && telkomselNeedsZoneGate(zonaProducts);
  const telkomselNationalCatalogProducts = useMemo(
    () => (telkomselCatalogActive ? telkomselNationalProducts(zonaProducts) : []),
    [telkomselCatalogActive, zonaProducts]
  );
  const telkomselRegionalCatalogProducts = useMemo(() => {
    if (!telkomselCatalogActive || !telkomselZoneLabel) return [];
    return filterProductsByZoneLabel(zonaProducts, telkomselZoneLabel);
  }, [telkomselCatalogActive, telkomselZoneLabel, zonaProducts]);
  const catalogProductsToShow = useMemo(() => {
    if (!telkomselZoneGateNeeded) return zonaProducts;
    if (telkomselNationalSelected) return telkomselNationalCatalogProducts;
    if (telkomselZoneLabel) return telkomselRegionalCatalogProducts;
    return [];
  }, [
    telkomselZoneGateNeeded,
    zonaProducts,
    telkomselNationalSelected,
    telkomselNationalCatalogProducts,
    telkomselZoneLabel,
    telkomselRegionalCatalogProducts,
  ]);

  const showProductPicker =
    !telkomselZoneGateNeeded || telkomselNationalSelected || !!telkomselZoneLabel;

  useEffect(() => {
    setTelkomselNationalSelected(false);
    setTelkomselZoneLabel(null);
    setSelectedProduct(null);
    setVoucherCode(null);
  }, [zona]);

  const resetTelkomselZone = () => {
    setTelkomselNationalSelected(false);
    setTelkomselZoneLabel(null);
    setSelectedProduct(null);
    setVoucherCode(null);
    setErrorMsg(null);
  };

  const startCheckout = () => {
    if (!selectedProduct) {
      setErrorMsg('Pilih produk voucher internet terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    const target = phoneNo || wallet?.walletNo || 'EVOUCHER';
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay tidak mencukupi.');
      return;
    }

    setCheckoutData({
      serviceName: 'Voucher Internet',
      productName: selectedProduct.name,
      targetNo: String(target),
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Mode: 'elektronik',
        Zona: zona || '-',
      },
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setSuccessMsg('Kode voucher disalin.');
    } catch {
      setErrorMsg('Gagal menyalin kode.');
    }
  };

  const renderCatalogSection = (checkoutAction?: ReactNode) => (
    <>
      {telkomselZoneGateNeeded && (
        <TelkomselZonePicker
          products={zonaProducts}
          zoneReference={telkomselZoneReference}
          nationalSelected={telkomselNationalSelected}
          selectedZoneLabel={telkomselZoneLabel}
          onNationalSelect={() => {
            setTelkomselNationalSelected(true);
            setTelkomselZoneLabel(null);
            setSelectedProduct(null);
            setVoucherCode(null);
          }}
          onZoneLabelChange={(label) => {
            setTelkomselNationalSelected(false);
            setTelkomselZoneLabel(label);
            setSelectedProduct(null);
            setVoucherCode(null);
          }}
          onReset={resetTelkomselZone}
        />
      )}

      {showProductPicker && catalogProductsToShow.length > 0 && (
        <ProductPicker
          products={catalogProductsToShow}
          selected={selectedProduct}
          onSelect={setSelectedProduct}
        />
      )}

      {checkoutAction}
    </>
  );

  if (!zona) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Provider tidak valid.{' '}
        <button type="button" onClick={() => navigate('/dashboard/voucher-internet')} className="text-primary-600 font-bold">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/voucher-internet')}
            className="mt-1 p-2 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-600"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Elektronik</h2>
              <span className="text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100 uppercase">
                {zona}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Bayar & generate kode voucher — copy atau print setelah sukses.</p>
          </div>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700">Nomor HP (opsional untuk pengiriman)</label>
          <input
            type="tel"
            value={phoneNo}
            onChange={(e) => setPhoneNo(e.target.value.replace(/\D/g, ''))}
            placeholder="08xxxxxxxxxx"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {productsLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
          </div>
        ) : zonaProducts.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
            Tidak ada produk untuk provider ini.
          </div>
        ) : (
          renderCatalogSection(
            <button
              type="button"
              onClick={startCheckout}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
            >
              Bayar & Generate Kode
            </button>
          )
        )}

        {voucherCode && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase text-emerald-800">Kode Voucher</p>
            <p className="text-lg font-black tracking-widest text-gray-900 break-all">{voucherCode}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyCode(voucherCode)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
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
          onSuccess={(trx: any) => {
            setCheckoutData(null);
            setResumePin(false);
            fetchWallet();
            const code = trx?.notes || trx?.note || trx?.sn || trx?.serial_number || trx?.transactionCode || null;
            if (code) {
              setVoucherCode(String(code));
            }
            setSuccessMsg('Transaksi voucher internet berhasil.');
          }}
        />
      )}
    </div>
  );
};
