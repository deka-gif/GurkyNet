import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, Smartphone, Store, Wifi, Zap } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { ProductPicker } from '../../components/catalog/ProductPicker';
import { TelkomselZonePicker } from '../../components/catalog/TelkomselZonePicker';
import { CatalogLoadMoreButton } from '../../components/catalog/CatalogLoadMoreButton';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { detectOperatorFromPhone } from '../../utils/detectOperator';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { filterVoucherInternetProducts } from '../../utils/voucherInternetGuard';
import {
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';
import {
  productService,
  type CategoryProviderSummary,
} from '../../services/product/product.service';
import { useProviderProductPager } from '../../hooks/useProviderProductPager';
import { findCategoryProviderByName } from '../../utils/findCategoryProvider';
import { MobileStickyActionBar, MOBILE_STICKY_ACTION_PAD } from '../../components/catalog/MobileStickyActionBar';

type Mode = 'tembak' | 'elektronik' | 'fisik';

function sortByPrice(rows: Product[]): Product[] {
  return [...rows].sort((a, b) => a.price - b.price);
}

/**
 * Voucher Internet hub — providers-first + page-20 load-more (web audit P1).
 * Modes elektronik/fisik navigate to zona pages; tembak loads products on-demand by operator.
 */
export const VoucherInternetPage = () => {
  const navigate = useNavigate();
  const { wallet, fetchWallet } = useWalletStore();
  const pager = useProviderProductPager();

  const [mode, setMode] = useState<Mode>('tembak');
  const [brandProviders, setBrandProviders] = useState<CategoryProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [zona, setZona] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState('');
  const [autoProvider, setAutoProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [telkomselNationalSelected, setTelkomselNationalSelected] = useState(false);
  const [telkomselZoneLabel, setTelkomselZoneLabel] = useState<string | null>(null);
  const [telkomselZoneReference, setTelkomselZoneReference] = useState<Record<string, string[]>>({});
  /** Provider label we last tried to load — drives empty-state without flashing pre-fetch. */
  const [catalogAttemptedFor, setCatalogAttemptedFor] = useState<string | null>(null);

  const viMode = mode === 'fisik' ? 'fisik' : mode === 'elektronik' ? 'elektronik' : 'tembak';

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout('/dashboard/voucher-internet');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet]);

  useEffect(() => {
    void productService.getTelkomselVoucherZoneReference().then((res) => {
      if (res.success && res.data?.zones) {
        setTelkomselZoneReference(res.data.zones);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    setBrandProviders([]);
    pager.reset();
    void productService
      .getCategoryProviders('voucher-internet', { vi_mode: viMode })
      .then((res) => {
        if (cancelled) return;
        const rows =
          res.success && Array.isArray(res.data)
            ? [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'id'))
            : [];
        setBrandProviders(rows);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/load on mode only
  }, [viMode]);

  useEffect(() => {
    if (mode === 'tembak') {
      setAutoProvider(detectOperatorFromPhone(phoneNo));
    }
  }, [phoneNo, mode]);

  const activeCatalogProvider = mode === 'tembak' ? autoProvider || zona : zona;

  const loadOperatorCatalog = useCallback(
    async (providerLabel: string) => {
      const match = findCategoryProviderByName(brandProviders, providerLabel);
      setCatalogAttemptedFor(providerLabel);
      if (!match?.providerId) {
        pager.reset();
        setErrorMsg('Provider tidak ditemukan di katalog voucher internet.');
        return;
      }
      setErrorMsg(null);
      const result = await pager.loadInitial({
        category: 'voucher-internet',
        vi_mode: 'tembak',
        provider_id: match.providerId,
      });
      if (!result) return;
      const listed = filterVoucherInternetProducts(result.products).filter(isCatalogListed);
      // Zone gate needs full set for Telkomsel labels.
      if (isTelkomselOperator(providerLabel) && telkomselNeedsZoneGate(listed)) {
        await pager.loadAllRemainingPages();
      }
    },
    [brandProviders, pager]
  );

  useEffect(() => {
    if (mode !== 'tembak') return;
    if (!activeCatalogProvider) {
      pager.reset();
      setCatalogAttemptedFor(null);
      return;
    }
    if (providersLoading || brandProviders.length === 0) return;
    void loadOperatorCatalog(activeCatalogProvider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeCatalogProvider, brandProviders, providersLoading]);

  const catalogBaseProducts = useMemo(
    () => sortByPrice(filterVoucherInternetProducts(pager.products).filter(isCatalogListed)),
    [pager.products]
  );

  const visibleBaseProducts = useMemo(() => {
    const listed = filterVoucherInternetProducts(pager.visibleProducts).filter(isCatalogListed);
    return sortByPrice(listed);
  }, [pager.visibleProducts]);

  const telkomselCatalogActive =
    !!activeCatalogProvider && isTelkomselOperator(activeCatalogProvider) && catalogBaseProducts.length > 0;
  const telkomselZoneGateNeeded =
    telkomselCatalogActive && telkomselNeedsZoneGate(catalogBaseProducts);
  const telkomselNationalCatalogProducts = useMemo(
    () => (telkomselCatalogActive ? telkomselNationalProducts(catalogBaseProducts) : []),
    [telkomselCatalogActive, catalogBaseProducts]
  );
  const telkomselRegionalCatalogProducts = useMemo(() => {
    if (!telkomselCatalogActive || !telkomselZoneLabel) return [];
    return filterProductsByZoneLabel(catalogBaseProducts, telkomselZoneLabel);
  }, [telkomselCatalogActive, telkomselZoneLabel, catalogBaseProducts]);

  const telkomselCatalogProductsToShow = useMemo(() => {
    if (!telkomselZoneGateNeeded) return visibleBaseProducts;
    if (telkomselNationalSelected) {
      const national = telkomselNationalCatalogProducts;
      const limit = visibleBaseProducts.length || national.length;
      return national.slice(0, Math.min(limit, national.length));
    }
    if (telkomselZoneLabel) return telkomselRegionalCatalogProducts;
    return [];
  }, [
    telkomselZoneGateNeeded,
    visibleBaseProducts,
    telkomselNationalSelected,
    telkomselNationalCatalogProducts,
    telkomselZoneLabel,
    telkomselRegionalCatalogProducts,
  ]);

  const showTelkomselProductPicker =
    !telkomselZoneGateNeeded || telkomselNationalSelected || !!telkomselZoneLabel;

  useEffect(() => {
    setTelkomselNationalSelected(false);
    setTelkomselZoneLabel(null);
  }, [activeCatalogProvider, mode]);

  const resetTelkomselZone = () => {
    setTelkomselNationalSelected(false);
    setTelkomselZoneLabel(null);
  };

  const providerMismatchError = useMemo(() => {
    if (mode !== 'tembak' || !selectedProduct || !autoProvider) return null;
    if (operatorsMatch(selectedProduct.operatorName, autoProvider)) return null;
    return `Nomor ini terdeteksi ${autoProvider}, tidak sesuai dengan produk ${selectedProduct.operatorName} yang dipilih.`;
  }, [mode, selectedProduct, autoProvider]);

  const resetSelection = () => {
    setSelectedProduct(null);
    setErrorMsg(null);
  };

  const switchMode = (next: Mode) => {
    // Elektronik temporarily disabled (all providers) — keep mode card visible as "Sedang Dikerjakan".
    if (next === 'elektronik') return;
    setMode(next);
    setZona(null);
    setPhoneNo('');
    setAutoProvider(null);
    resetTelkomselZone();
    resetSelection();
    pager.reset();
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
    if (phoneNo.replace(/\D/g, '').length < 10) {
      setErrorMsg('Nomor HP penerima tidak valid.');
      return;
    }
    if (providerMismatchError) {
      setErrorMsg(providerMismatchError);
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay tidak mencukupi.');
      return;
    }

    setCheckoutData({
      serviceName: 'Voucher Internet',
      productName: selectedProduct.name,
      targetNo: phoneNo,
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Mode: isTelkomselOperator(activeCatalogProvider || '') ? 'Beli Kode Voucher' : 'tembak',
        Zona: zona || autoProvider || '-',
      },
      voucherInternetMode: 'tembak',
    });
  };

  const phoneDigits = phoneNo.replace(/\D/g, '');
  const phoneReady = phoneDigits.length >= 10;
  const tembakShowProducts = phoneReady && !!(autoProvider || zona);

  const productsForPicker = telkomselZoneGateNeeded
    ? telkomselCatalogProductsToShow
    : visibleBaseProducts;

  const catalogBusy = pager.loading || providersLoading;
  const catalogEmptySettled =
    !catalogBusy &&
    catalogBaseProducts.length === 0 &&
    !pager.error &&
    !!activeCatalogProvider &&
    (catalogAttemptedFor === activeCatalogProvider ||
      (!providersLoading && brandProviders.length === 0));
  const payDisabled =
    !selectedProduct ||
    !!providerMismatchError ||
    (selectedProduct ? !isProductPurchasable(selectedProduct) : false);

  const renderCatalogProductSection = (checkoutAction?: ReactNode) => (
    <>
      {catalogBusy && catalogBaseProducts.length === 0 ? (
        <div className="py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
          <p className="text-xs font-medium text-gray-400 mt-2">Memuat daftar produk...</p>
        </div>
      ) : null}

      {pager.error ? (
        <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {pager.error}
        </p>
      ) : null}

      {/* Empty state — same idea as PulsaPage when operator products never arrive. */}
      {catalogEmptySettled ? (
        <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
          <p className="text-xs font-medium">
            Produk tidak tersedia untuk nomor ini. Coba muat ulang atau pilih operator manual.
          </p>
          <button
            type="button"
            onClick={() => {
              if (activeCatalogProvider) void loadOperatorCatalog(activeCatalogProvider);
            }}
            className="text-xs font-bold text-primary-600 hover:text-primary-700"
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {telkomselZoneGateNeeded && (
        <TelkomselZonePicker
          products={catalogBaseProducts}
          zoneReference={telkomselZoneReference}
          nationalSelected={telkomselNationalSelected}
          selectedZoneLabel={telkomselZoneLabel}
          onNationalSelect={() => {
            setTelkomselNationalSelected(true);
            setTelkomselZoneLabel(null);
            resetSelection();
          }}
          onZoneLabelChange={(label) => {
            setTelkomselNationalSelected(false);
            setTelkomselZoneLabel(label);
            resetSelection();
          }}
          onReset={resetTelkomselZone}
        />
      )}

      {showTelkomselProductPicker && productsForPicker.length > 0 && (
        <>
          <ProductPicker
            products={productsForPicker}
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

  return (
    <div className={`dashboard-page space-y-6 container mx-auto max-w-5xl ${mode === 'tembak' && tembakShowProducts ? MOBILE_STICKY_ACTION_PAD : ''}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Internet</h2>
          <p className="text-sm text-gray-500">
            Tembak langsung atau aktivasi voucher fisik kosongan — alur terpisah sesuai bisnis PPOB.
          </p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(
          [
            {
              key: 'tembak' as const,
              label: 'Tembak Langsung',
              icon: Zap,
              desc: 'Beli kode voucher via nomor HP',
              disabled: false,
              badge: null as string | null,
            },
            {
              key: 'elektronik' as const,
              label: 'Voucher Elektronik',
              icon: Wifi,
              desc: 'Sementara tidak tersedia',
              disabled: true,
              badge: 'Sedang Dikerjakan',
            },
            {
              key: 'fisik' as const,
              label: 'Voucher Fisik',
              icon: Store,
              desc: 'Scan/SN bulk activation',
              disabled: false,
              badge: null as string | null,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.key;
          return (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => switchMode(item.key)}
              aria-disabled={item.disabled}
              title={item.disabled ? 'Sedang Dikerjakan' : undefined}
              className={`text-left p-4 rounded-2xl border transition-all relative ${
                item.disabled
                  ? 'border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed'
                  : active
                    ? 'border-primary-500 bg-primary-50/40'
                    : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
            >
              {item.badge ? (
                <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                  {item.badge}
                </span>
              ) : null}
              <Icon className={`w-5 h-5 ${active && !item.disabled ? 'text-primary-600' : 'text-gray-400'}`} />
              <div className="font-extrabold text-gray-900 text-sm mt-2">{item.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        {mode !== 'tembak' && (
          <div className="space-y-2.5">
            <h4 className="font-extrabold text-gray-900 text-sm">1. Pilih Zona / Provider</h4>
            {providersLoading ? (
              <div className="py-8 text-center">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
              </div>
            ) : brandProviders.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                Katalog voucher internet kosong. Sinkronkan produk provider (kategori voucher-internet) di Operations.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {brandProviders.map((z) => (
                  <button
                    key={z.providerId}
                    type="button"
                    onClick={() => {
                      if (mode === 'elektronik') {
                        navigate(`/dashboard/voucher-internet/elektronik/${encodeURIComponent(z.name)}`);
                        return;
                      }
                      if (mode === 'fisik') {
                        navigate(`/dashboard/voucher-internet/fisik/${encodeURIComponent(z.name)}`);
                        return;
                      }
                      setZona(z.name);
                      resetTelkomselZone();
                      resetSelection();
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-extrabold ${
                      zona === z.name ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    {z.name}
                    <div className="text-[10px] font-semibold text-gray-400 mt-0.5">{z.count} produk</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'tembak' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">1. Nomor HP</h4>
            <div className="relative">
              <Smartphone className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneNo}
                onChange={(e) => {
                  setPhoneNo(e.target.value.replace(/\D/g, ''));
                  resetSelection();
                }}
                placeholder="08xxxxxxxxxx"
                className="w-full pl-12 pr-28 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {autoProvider && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100">
                  {autoProvider}
                </span>
              )}
            </div>

            {phoneReady && !autoProvider && (
              <div className="space-y-2.5">
                <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Operator tidak terdeteksi otomatis, pilih manual:
                </p>
                {providersLoading ? (
                  <div className="py-6 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {brandProviders.map((z) => (
                      <button
                        key={z.providerId}
                        type="button"
                        onClick={() => {
                          setZona(z.name);
                          resetTelkomselZone();
                          resetSelection();
                        }}
                        className={`p-3 rounded-xl border text-left text-xs font-extrabold ${
                          zona === z.name ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        {z.name}
                        <div className="text-[10px] font-semibold text-gray-400 mt-0.5">{z.count} produk</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tembakShowProducts && isTelkomselOperator(activeCatalogProvider || '') && (
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-2xl space-y-1">
                <p className="text-xs font-extrabold text-amber-900">Beli Kode Voucher Telkomsel</p>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Hasil pembelian berupa kode redeem (bukan isi kuota otomatis). Setelah sukses, tukar kode via{' '}
                  <span className="font-black">*133#</span> atau aplikasi MyTelkomsel.
                </p>
              </div>
            )}

            {tembakShowProducts && (
              <>
                {renderCatalogProductSection(
                  <>
                    {providerMismatchError && (
                      <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800 font-semibold">{providerMismatchError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => startCheckout()}
                      disabled={payDisabled}
                      className="max-lg:hidden w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm"
                    >
                      Lanjut Bayar (PIN)
                    </button>
                  </>
                )}
              </>
            )}
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
            setResumePin(false);
            fetchWallet();
            setSuccessMsg('Transaksi voucher internet berhasil.');
          }}
        />
      )}

      {mode === 'tembak' && tembakShowProducts ? (
        <MobileStickyActionBar
          meta={
            selectedProduct
              ? `${selectedProduct.name} · ${formatIDR(selectedProduct.price)}`
              : 'Pilih produk terlebih dahulu'
          }
          label="Lanjut Bayar (PIN)"
          disabled={payDisabled}
          onClick={() => startCheckout()}
        />
      ) : null}
    </div>
  );
};
