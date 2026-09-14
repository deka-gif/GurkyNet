import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Printer, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { ProductPicker } from '../../components/catalog/ProductPicker';
import { TelkomselZonePicker } from '../../components/catalog/TelkomselZonePicker';
import { CatalogLoadMoreButton } from '../../components/catalog/CatalogLoadMoreButton';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
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
import { useProviderProductPager } from '../../hooks/useProviderProductPager';
import { findCategoryProviderByName } from '../../utils/findCategoryProvider';
import { MobileStickyActionBar, MOBILE_STICKY_ACTION_PAD } from '../../components/catalog/MobileStickyActionBar';

function sortByPrice(rows: Product[]): Product[] {
  return [...rows].sort((a, b) => a.price - b.price);
}

/** Temporary kill-switch — all providers. Flip false to restore purchase UI below. */
const ELEKTRONIK_TEMPORARILY_DISABLED = true;

function VoucherElektronikComingSoon({ zona }: { zona: string }) {
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-8 container mx-auto max-w-lg space-y-4">
      <button
        type="button"
        onClick={() => navigate('/dashboard/voucher-internet')}
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-primary-600"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Voucher Internet
      </button>
      <div className="bg-white rounded-3xl border border-amber-100 shadow-xl shadow-gray-200/40 p-6 space-y-3">
        <span className="inline-flex text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg">
          Sedang Dikerjakan
        </span>
        <h2 className="text-xl font-extrabold text-gray-900">Voucher Elektronik</h2>
        {zona ? <p className="text-xs text-gray-500 font-semibold">Provider: {zona}</p> : null}
        <p className="text-sm text-gray-600 leading-relaxed">
          Voucher Elektronik sedang dalam perbaikan untuk semua provider. Silakan gunakan{' '}
          <span className="font-extrabold text-gray-900">Tembak Langsung</span> atau{' '}
          <span className="font-extrabold text-gray-900">Voucher Fisik</span>, atau coba lagi nanti.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/voucher-internet')}
          className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
        >
          Kembali ke pilihan mode
        </button>
      </div>
    </div>
  );
}

/** Public route entry — temporarily shows Coming Soon; purchase UI kept below. */
export const VoucherElektronikZonaPage = () => {
  const { zona: zonaParam } = useParams<{ zona: string }>();
  const zona = zonaParam ? decodeURIComponent(zonaParam) : '';
  if (ELEKTRONIK_TEMPORARILY_DISABLED) {
    return <VoucherElektronikComingSoon zona={zona} />;
  }
  return <VoucherElektronikZonaPageActive />;
};

/** Voucher Elektronik zona page — providers-first + page-20 (web audit P1). Kept for re-enable. */
function VoucherElektronikZonaPageActive() {
  const navigate = useNavigate();
  const { zona: zonaParam } = useParams<{ zona: string }>();
  const zona = zonaParam ? decodeURIComponent(zonaParam) : '';

  const { wallet, fetchWallet } = useWalletStore();
  const pager = useProviderProductPager();

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
    const pending = consumePendingCheckout(
      `/dashboard/voucher-internet/elektronik/${encodeURIComponent(zona)}`
    );
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, zona]);

  useEffect(() => {
    void productService.getTelkomselVoucherZoneReference().then((res) => {
      if (res.success && res.data?.zones) {
        setTelkomselZoneReference(res.data.zones);
      }
    });
  }, []);

  useEffect(() => {
    if (!zona) return;
    let cancelled = false;
    (async () => {
      const res = await productService.getCategoryProviders('voucher-internet', {
        vi_mode: 'elektronik',
      });
      if (cancelled) return;
      const providers = res.success && Array.isArray(res.data) ? res.data : [];
      const match = findCategoryProviderByName(providers, zona);
      if (!match?.providerId) {
        pager.reset();
        setErrorMsg('Provider tidak ditemukan di katalog voucher elektronik.');
        return;
      }
      const result = await pager.loadInitial({
        category: 'voucher-internet',
        vi_mode: 'elektronik',
        provider_id: match.providerId,
      });
      if (cancelled || !result) return;
      const listed = filterVoucherInternetProducts(result.products).filter(isCatalogListed);
      if (isTelkomselOperator(zona) && telkomselNeedsZoneGate(listed)) {
        await pager.loadAllRemainingPages();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona]);

  const zonaProducts = useMemo(
    () => sortByPrice(filterVoucherInternetProducts(pager.products).filter(isCatalogListed)),
    [pager.products]
  );

  const visibleZonaProducts = useMemo(
    () => sortByPrice(filterVoucherInternetProducts(pager.visibleProducts).filter(isCatalogListed)),
    [pager.visibleProducts]
  );

  const telkomselCatalogActive = !!zona && isTelkomselOperator(zona) && zonaProducts.length > 0;
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
    if (!telkomselZoneGateNeeded) return visibleZonaProducts;
    if (telkomselNationalSelected) {
      return telkomselNationalCatalogProducts.slice(
        0,
        Math.min(visibleZonaProducts.length || 20, telkomselNationalCatalogProducts.length)
      );
    }
    if (telkomselZoneLabel) return telkomselRegionalCatalogProducts;
    return [];
  }, [
    telkomselZoneGateNeeded,
    visibleZonaProducts,
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
    const target = wallet?.walletNo || 'EVOUCHER';
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
      voucherInternetMode: 'elektronik',
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
        <>
          <ProductPicker
            products={catalogProductsToShow}
            selected={selectedProduct}
            onSelect={setSelectedProduct}
          />
          <CatalogLoadMoreButton
            visible={pager.canLoadMore && !telkomselZoneLabel}
            loading={pager.loadingMore}
            onClick={() => void pager.loadMore()}
          />
        </>
      )}

      {checkoutAction}
    </>
  );

  if (!zona) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Provider tidak valid.{' '}
        <button
          type="button"
          onClick={() => navigate('/dashboard/voucher-internet')}
          className="text-primary-600 font-bold"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 space-y-6 container mx-auto max-w-5xl ${selectedProduct ? MOBILE_STICKY_ACTION_PAD : ''}`}>
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
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Voucher Elektronik
              </h2>
              <span className="text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100 uppercase">
                {zona}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Bayar & generate kode voucher — copy atau print setelah sukses.
            </p>
          </div>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        {pager.loading && zonaProducts.length === 0 ? (
          <div className="py-8 text-center">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
          </div>
        ) : zonaProducts.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
            {pager.error || 'Tidak ada produk untuk provider ini.'}
          </div>
        ) : (
          renderCatalogSection(
            <button
              type="button"
              onClick={startCheckout}
              className="max-lg:hidden w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
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
            setResumePin(false);
            fetchWallet();
            const code =
              trx?.notes || trx?.note || trx?.sn || trx?.serial_number || trx?.transactionCode || null;
            if (code) {
              setVoucherCode(String(code));
            }
            setSuccessMsg('Transaksi voucher internet berhasil.');
          }}
        />
      )}

      {selectedProduct ? (
        <MobileStickyActionBar
          meta={`${selectedProduct.name} · ${formatIDR(selectedProduct.price)}`}
          label="Bayar & Generate Kode"
          disabled={!isProductPurchasable(selectedProduct)}
          onClick={startCheckout}
        />
      ) : null}
    </div>
  );
};
