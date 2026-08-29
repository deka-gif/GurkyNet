import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Printer,
  RefreshCw,
  Smartphone,
  Store,
  Trash2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout, savePendingCheckout, buildCreatePinUrl } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { detectOperatorFromPhone } from '../../utils/detectOperator';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { filterVoucherInternetProducts } from '../../utils/voucherInternetGuard';
import {
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
  type TelkomselRegionKey,
} from '../../utils/telkomselVoucherZone';
import { TelkomselZonePicker } from '../../components/catalog/TelkomselZonePicker';
import { productService } from '../../services/product/product.service';
import {
  addScannedSerials,
  clearPendingScan,
  expandSnRange,
  loadPendingScan,
  removeScannedSerial,
  savePendingScan,
  type ScannedSerial,
} from '../../utils/voucherPhysicalScan';
import {
  voucherPhysicalBatchService,
  type VoucherPhysicalBatch,
  type VoucherPhysicalBatchItem,
} from '../../services/voucherPhysicalBatch/voucherPhysicalBatch.service';
import { getOrCreateIdempotencyKeyForLogicalAction, clearIdempotencyKeyForLogicalAction } from '../../utils/idempotency';

type Mode = 'tembak' | 'elektronik' | 'fisik';
type FisikStage = 'scan' | 'review';

const MAX_BATCH_ITEMS = 200;
const PHYSICAL_BATCH_LOGICAL_ID = 'voucher-internet-physical-batch';

export const VoucherInternetPage = () => {
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [mode, setMode] = useState<Mode>('tembak');
  const [zona, setZona] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState('');
  const [autoProvider, setAutoProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);

  // Voucher Fisik (Metode 3) — local scan state, never a network call per scan.
  const [fisikStage, setFisikStage] = useState<FisikStage>('scan');
  const [scannedList, setScannedList] = useState<ScannedSerial[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);

  const [telkomselRegion, setTelkomselRegion] = useState<TelkomselRegionKey | null>(null);
  const [telkomselZoneLabel, setTelkomselZoneLabel] = useState<string | null>(null);
  const [telkomselZoneReference, setTelkomselZoneReference] = useState<Record<string, string[]>>({});

  const restoredScanOnce = useRef(false);

  useEffect(() => {
    fetchWallet();
    // Prefer dedicated voucher-internet family; also load data as fallback katalog kuota.
    fetchProducts({ category: 'voucher-internet' }).then(() => {
      // no-op; store replaces list. If empty UI will say sync needed.
    });
    const pending = consumePendingCheckout('/dashboard/voucher-internet');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }

    // Restore an in-progress physical voucher scan across an accidental refresh. The
    // selected product itself is not restored (re-pick from the — already zona-filtered —
    // picker) to avoid a stale-product race with the catalog fetch above.
    if (!restoredScanOnce.current) {
      restoredScanOnce.current = true;
      const pendingScan = loadPendingScan();
      if (pendingScan && pendingScan.list.length > 0) {
        setMode('fisik');
        setZona(pendingScan.zona);
        setScannedList(pendingScan.list);
      }
    }
  }, [fetchWallet, fetchProducts]);

  useEffect(() => {
    void productService.getTelkomselVoucherZoneReference().then((res) => {
      if (res.success && res.data?.zones) {
        setTelkomselZoneReference(res.data.zones);
      }
    });
  }, []);

  useEffect(() => {
    if (mode === 'tembak') {
      setAutoProvider(detectOperatorFromPhone(phoneNo));
    }
  }, [phoneNo, mode]);

  useEffect(() => {
    if (mode !== 'fisik') return;
    if (scannedList.length === 0) {
      clearPendingScan();
      return;
    }
    savePendingScan({ zona, skuCode: selectedProduct?.code ?? null, list: scannedList });
  }, [mode, zona, selectedProduct, scannedList]);

  // Defense in depth: the store already fetches category='voucher-internet', but never
  // trust the API result blindly — a catalog sync bug or stale cache could leak other
  // categories into this list, and rendering them here is exactly what's forbidden.
  const voucherInternetProducts = useMemo(() => filterVoucherInternetProducts(products), [products]);

  const zonas = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of voucherInternetProducts) {
      if (!isCatalogListed(p)) continue;
      const name = (p.operatorName || 'Umum').trim();
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [voucherInternetProducts]);

  const zonaProducts = useMemo(() => {
    if (!zona) return [];
    return voucherInternetProducts
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, zona))
      .sort((a, b) => a.price - b.price);
  }, [voucherInternetProducts, zona]);

  const tembakProducts = useMemo(() => {
    const provider = autoProvider || zona;
    if (!provider) return [];
    return voucherInternetProducts
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, provider))
      .sort((a, b) => a.price - b.price);
  }, [voucherInternetProducts, autoProvider, zona]);

  const phoneDigits = phoneNo.replace(/\D/g, '');
  const phoneReady = phoneDigits.length >= 10;
  const tembakShowProducts = phoneReady && !!(autoProvider || zona);

  const activeCatalogProvider = mode === 'tembak' ? autoProvider || zona : zona;
  const catalogBaseProducts = mode === 'tembak' ? tembakProducts : zonaProducts;
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
  const canPickTelkomselRegionalProducts = !telkomselZoneGateNeeded || !!telkomselZoneLabel;

  useEffect(() => {
    setTelkomselRegion(null);
    setTelkomselZoneLabel(null);
  }, [activeCatalogProvider, mode]);

  const resetTelkomselZone = () => {
    setTelkomselRegion(null);
    setTelkomselZoneLabel(null);
  };

  // Spec step 4 (Tembak Langsung): block checkout when the phone's detected operator
  // doesn't match the selected product's operator — this is a UX guard, not a security
  // boundary (the backend re-validates SKU/target independently at purchase time).
  const providerMismatchError = useMemo(() => {
    if (mode !== 'tembak' || !selectedProduct || !autoProvider) return null;
    if (operatorsMatch(selectedProduct.operatorName, autoProvider)) return null;
    return `Nomor ini terdeteksi ${autoProvider}, tidak sesuai dengan produk ${selectedProduct.operatorName} yang dipilih.`;
  }, [mode, selectedProduct, autoProvider]);

  const resetSelection = () => {
    setSelectedProduct(null);
    setVoucherCode(null);
    setErrorMsg(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setZona(null);
    setPhoneNo('');
    setAutoProvider(null);
    setFisikStage('scan');
    resetTelkomselZone();
    resetSelection();
  };

  const startCheckout = (opts?: { targetOverride?: string }) => {
    if (!selectedProduct) {
      setErrorMsg('Pilih produk voucher internet terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    const target =
      opts?.targetOverride || (mode === 'tembak' ? phoneNo : phoneNo || wallet?.walletNo || 'EVOUCHER');

    if (mode === 'tembak' && phoneNo.replace(/\D/g, '').length < 10) {
      setErrorMsg('Nomor HP penerima tidak valid.');
      return;
    }
    if (mode === 'tembak' && providerMismatchError) {
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
      targetNo: String(target),
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Mode: mode,
        Zona: zona || autoProvider || '-',
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

  // --- Voucher Fisik: Tahap B (scan) ---
  const handleScanSubmit = () => {
    const raw = scanInput.trim();
    if (!raw) {
      setScanNotice('Masukkan barcode / serial number / range SN.');
      return;
    }
    const sns = expandSnRange(raw);
    const room = MAX_BATCH_ITEMS - scannedList.length;
    if (room <= 0) {
      setScanNotice(`Batch sudah mencapai maksimal ${MAX_BATCH_ITEMS} SN.`);
      return;
    }
    const overflow = Math.max(0, sns.length - room);
    const toAdd = sns.slice(0, room);
    const result = addScannedSerials(scannedList, toAdd);
    setScannedList(result.list);
    setScanInput('');

    const parts: string[] = [];
    if (result.added > 0) parts.push(`${result.added} SN ditambahkan`);
    if (result.duplicates > 0) parts.push(`${result.duplicates} SN sudah pernah discan (dilewati)`);
    if (overflow > 0) parts.push(`${overflow} SN dilewati (melebihi maksimal ${MAX_BATCH_ITEMS})`);
    setScanNotice(parts.length ? parts.join(', ') + '.' : null);
  };

  const handleRemoveScanned = (serial: string) => {
    setScannedList((prev) => removeScannedSerial(prev, serial));
  };

  const handleResetScan = () => {
    setScannedList([]);
    setScanInput('');
    setScanNotice(null);
    clearPendingScan();
  };

  const physicalTotal = selectedProduct ? selectedProduct.price * scannedList.length : 0;

  const renderCatalogProductSection = (checkoutAction?: ReactNode) => (
    <>
      {telkomselZoneGateNeeded && (
        <TelkomselZonePicker
          products={catalogBaseProducts}
          zoneReference={telkomselZoneReference}
          selectedRegion={telkomselRegion}
          selectedZoneLabel={telkomselZoneLabel}
          onRegionChange={setTelkomselRegion}
          onZoneLabelChange={(label) => {
            setTelkomselZoneLabel(label);
            resetSelection();
          }}
        />
      )}

      {telkomselZoneGateNeeded && telkomselNationalCatalogProducts.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-gray-700">Berlaku semua wilayah</h5>
          <ProductPicker
            products={telkomselNationalCatalogProducts}
            selected={selectedProduct}
            onSelect={setSelectedProduct}
          />
        </div>
      )}

      {canPickTelkomselRegionalProducts && (
        <ProductPicker
          products={telkomselZoneGateNeeded ? telkomselRegionalCatalogProducts : catalogBaseProducts}
          selected={selectedProduct}
          onSelect={setSelectedProduct}
        />
      )}

      {checkoutAction}
    </>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Internet</h2>
          <p className="text-sm text-gray-500">
            Tembak langsung, voucher elektronik, atau aktivasi voucher fisik kosongan — alur terpisah sesuai bisnis PPOB.
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
            { key: 'tembak' as const, label: 'Tembak Langsung', icon: Zap, desc: 'Kuota aktif ke nomor HP' },
            { key: 'elektronik' as const, label: 'Voucher Elektronik', icon: Wifi, desc: 'Kode voucher bisa copy/print' },
            { key: 'fisik' as const, label: 'Voucher Fisik', icon: Store, desc: 'Scan/SN bulk activation' },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => switchMode(item.key)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                active ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
              <div className="font-extrabold text-gray-900 text-sm mt-2">{item.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 text-xs text-emerald-800 font-semibold">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-600">
              Tutup
            </button>
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
            <div className="flex-1 text-xs text-red-800 font-semibold">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-600">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        {mode !== 'tembak' && (
          <div className="space-y-2.5">
            <h4 className="font-extrabold text-gray-900 text-sm">1. Pilih Zona / Provider</h4>
            {productsLoading ? (
              <div className="py-8 text-center">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
              </div>
            ) : zonas.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                Katalog voucher internet kosong. Sinkronkan produk provider (kategori voucher-internet) di Operations.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {zonas.map((z) => (
                  <button
                    key={z.name}
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
                {productsLoading ? (
                  <div className="py-6 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {zonas.map((z) => (
                      <button
                        key={z.name}
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
                      disabled={!!providerMismatchError}
                      className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm"
                    >
                      Lanjut Bayar (PIN)
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {zona && mode === 'elektronik' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">2. Produk</h4>
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
            {renderCatalogProductSection(
              <button
                type="button"
                onClick={() => startCheckout()}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
              >
                Bayar & Generate Kode
              </button>
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
        )}

        {zona && mode === 'fisik' && fisikStage === 'scan' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">2. Scan / Input SN</h4>
            <textarea
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleScanSubmit();
                }
              }}
              rows={3}
              placeholder={'Scan barcode atau input SN, lalu Enter.\nContoh range: ABC1000-ABC1010\nAtau list: SN1, SN2, SN3'}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={handleScanSubmit}
              className="w-full py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-extrabold"
            >
              Tambahkan ke Batch
            </button>
            {scanNotice && <p className="text-[11px] text-gray-500">{scanNotice}</p>}

            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-gray-900">{scannedList.length} voucher siap</p>
              {scannedList.length > 0 && (
                <button type="button" onClick={handleResetScan} className="text-[10px] font-bold text-red-500">
                  Reset Semua
                </button>
              )}
            </div>
            {scannedList.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-100 rounded-2xl p-2">
                {scannedList.map((s) => (
                  <div
                    key={s.serial}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 text-xs"
                  >
                    <span className="font-mono font-bold text-gray-800 truncate mr-2">{s.serial}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScanned(s.serial)}
                      className="text-gray-400 hover:text-red-500 shrink-0"
                      aria-label={`Hapus ${s.serial}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {renderCatalogProductSection()}
            <p className="text-[10px] text-gray-500">
              Satu batch hanya untuk satu nominal GB yang sama. Untuk nominal campuran, buat batch terpisah.
            </p>
            <button
              type="button"
              onClick={() => {
                if (scannedList.length === 0) {
                  setScanNotice('Scan minimal 1 voucher terlebih dahulu.');
                  return;
                }
                if (!selectedProduct) {
                  setScanNotice('Pilih nominal paket terlebih dahulu.');
                  return;
                }
                setFisikStage('review');
              }}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
            >
              Selesai Scan — Lanjut ({scannedList.length} SN)
            </button>
          </div>
        )}

        {zona && mode === 'fisik' && fisikStage === 'review' && selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-gray-900 text-sm">3. Ringkasan &amp; Bayar</h4>
              <button
                type="button"
                onClick={() => setFisikStage('scan')}
                className="text-[10px] font-bold text-primary-600"
              >
                Kembali / Scan Ulang
              </button>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Produk</span>
                <span className="font-extrabold text-gray-900">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jumlah Voucher</span>
                <span className="font-extrabold text-gray-900">{scannedList.length} SN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Harga / SN</span>
                <span className="font-extrabold text-gray-900">{formatIDR(selectedProduct.price)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-dashed border-gray-200">
                <span className="text-gray-700 font-bold">Total</span>
                <span className="font-black text-primary-700">{formatIDR(physicalTotal)}</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-2xl p-2">
              {scannedList.map((s) => (
                <div key={s.serial} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 text-xs">
                  <span className="font-mono font-bold text-gray-800 truncate mr-2">{s.serial}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveScanned(s.serial)}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                    aria-label={`Hapus ${s.serial}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {(!wallet || wallet.balance < physicalTotal) && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 font-semibold">Saldo GurkyPay tidak mencukupi untuk batch ini.</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setBatchCheckoutOpen(true)}
              disabled={!wallet || wallet.balance < physicalTotal || scannedList.length === 0}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm"
            >
              Bayar &amp; Aktivasi ({scannedList.length} SN)
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
          onSuccess={(trx: any) => {
            setCheckoutData(null);
            setResumePin(false);
            fetchWallet();
            const code = trx?.notes || trx?.note || trx?.sn || trx?.serial_number || trx?.transactionCode || null;
            if (mode === 'elektronik' && code) {
              setVoucherCode(String(code));
            }
            setSuccessMsg('Transaksi voucher internet berhasil.');
          }}
        />
      )}

      {batchCheckoutOpen && selectedProduct && (
        <PhysicalBatchCheckout
          product={selectedProduct}
          serials={scannedList}
          onClose={() => setBatchCheckoutOpen(false)}
          onSettled={() => {
            setBatchCheckoutOpen(false);
            setScannedList([]);
            setFisikStage('scan');
            clearPendingScan();
            fetchWallet();
          }}
        />
      )}
    </div>
  );
};

function ProductPicker({
  products,
  selected,
  onSelect,
}: {
  products: Product[];
  selected: Product | null;
  onSelect: (p: Product) => void;
}) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-bold text-gray-700">Pilih Paket</h5>
      {products.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          Tidak ada produk untuk zona ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={`text-left p-3 rounded-xl border ${
                selected?.id === p.id ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="text-xs font-extrabold text-gray-900">{p.name}</div>
              <div className="text-sm font-black text-primary-600 mt-1">{formatIDR(p.price)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type BatchCheckoutStep = 'SUMMARY' | 'PIN' | 'LOADING' | 'RESULT';

const ITEM_STATUS_LABEL: Record<string, string> = {
  queued: 'Menunggu',
  processing: 'Diproses',
  success: 'Berhasil',
  failed: 'Gagal',
  refunded: 'Gagal',
};

const ITEM_STATUS_CLASS: Record<string, string> = {
  queued: 'text-gray-400',
  processing: 'text-amber-600',
  success: 'text-emerald-600',
  failed: 'text-red-600',
  refunded: 'text-red-600',
};

/**
 * Dedicated (not shared) PIN → submit → poll flow for a Voucher Fisik batch. Not built
 * on top of <CheckoutSummary/> because that component posts to POST /transactions —
 * a single-SKU/single-target shape this batch (POST /voucher-internet/physical-batches,
 * N serials) does not fit. Every other PPOB page keeps using CheckoutSummary unchanged.
 */
function PhysicalBatchCheckout({
  product,
  serials,
  onClose,
  onSettled,
}: {
  product: Product;
  serials: ScannedSerial[];
  onClose: () => void;
  onSettled: () => void;
}) {
  const { user } = useAuth();
  const { flags: featureFlags } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<BatchCheckoutStep>('SUMMARY');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batch, setBatch] = useState<VoucherPhysicalBatch | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = product.price * serials.length;
  const isTerminal = batch ? batch.status === 'completed' || batch.status === 'completed_with_failures' : false;

  useEffect(() => {
    if (!batch || isTerminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await voucherPhysicalBatchService.getById(batch.id);
        if (res?.data) setBatch(res.data);
      } catch {
        // transient poll failure — next tick retries; the batch itself is unaffected.
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batch?.id, batch?.status, isTerminal]);

  useEffect(() => {
    if (isTerminal) {
      clearIdempotencyKeyForLogicalAction(PHYSICAL_BATCH_LOGICAL_ID);
    }
  }, [isTerminal]);

  const goToPin = () => {
    if (!user?.hasPin) {
      // Scan list already persisted via savePendingScan (continuous), so returning here
      // after Create PIN naturally restores progress; only the PIN modal itself is lost.
      savePendingCheckout(
        {
          serviceName: 'Voucher Internet',
          productName: product.name,
          targetNo: 'BATCH',
          amount: total,
          adminFee: 0,
          skuCode: product.code,
        },
        location.pathname
      );
      navigate(buildCreatePinUrl(location.pathname));
      return;
    }
    setStep('PIN');
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setPinError(null);
    if (cleaned.length === 6 && !submittingRef.current) {
      submittingRef.current = true;
      setStep('LOADING');
      void submit(cleaned);
    }
  };

  const submit = async (enteredPin: string) => {
    setSubmitError(null);
    try {
      const idempotencyKey = getOrCreateIdempotencyKeyForLogicalAction(PHYSICAL_BATCH_LOGICAL_ID);
      const res = await voucherPhysicalBatchService.create({
        sku_code: product.code,
        serials: serials.map((s) => ({ serial_number: s.serial, scanned_at: s.scannedAt })),
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });
      submittingRef.current = false;
      if (res?.data) {
        setBatch(res.data);
        setStep('RESULT');
      } else {
        setSubmitError('Gagal membuat batch voucher fisik.');
        setStep('SUMMARY');
      }
    } catch (err: any) {
      submittingRef.current = false;
      const message: string =
        err?.response?.data?.message || err?.message || 'Gagal memproses batch voucher fisik.';
      if (/pin/i.test(message)) {
        setPin('');
        setPinError(message);
        setStep('PIN');
      } else {
        setSubmitError(message);
        setStep('SUMMARY');
      }
    }
  };

  const handleRetryItem = async (item: VoucherPhysicalBatchItem) => {
    if (!batch) return;
    setRetryingId(item.id);
    try {
      await voucherPhysicalBatchService.retryItem(batch.id, item.id);
      const res = await voucherPhysicalBatchService.getById(batch.id);
      if (res?.data) setBatch(res.data);
    } catch {
      // surfaced implicitly — item stays 'failed' and Retry remains available
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-gray-900">Aktivasi Voucher Fisik</h3>
          {step !== 'LOADING' && (
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {step === 'SUMMARY' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Produk</span>
                <span className="font-extrabold text-gray-900">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jumlah</span>
                <span className="font-extrabold text-gray-900">{serials.length} SN</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-dashed border-gray-200">
                <span className="text-gray-700 font-bold">Total Bayar</span>
                <span className="font-black text-primary-700">{formatIDR(total)}</span>
              </div>
            </div>
            {submitError && <p className="text-xs text-red-600 font-semibold">{submitError}</p>}
            {!featureFlags.purchase_enabled && (
              <p className="text-xs text-amber-600 font-semibold">{featureFlags.messages.purchase}</p>
            )}
            <button
              type="button"
              onClick={goToPin}
              disabled={!featureFlags.purchase_enabled}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm"
            >
              Bayar Sekarang
            </button>
          </div>
        )}

        {step === 'PIN' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 text-center">Masukkan PIN transaksi 6 digit</p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              maxLength={6}
              className="w-full text-center tracking-[0.6em] text-2xl font-black py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••"
            />
            {pinError && <p className="text-xs text-red-600 font-semibold text-center">{pinError}</p>}
          </div>
        )}

        {step === 'LOADING' && (
          <div className="py-10 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary-500" />
            <p className="text-xs text-gray-500">Memproses pembayaran batch...</p>
          </div>
        )}

        {step === 'RESULT' && batch && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-black text-emerald-600 text-lg">{batch.successCount}</div>
                <div className="text-gray-500">Berhasil</div>
              </div>
              <div>
                <div className="font-black text-red-600 text-lg">{batch.failedCount}</div>
                <div className="text-gray-500">Gagal</div>
              </div>
              <div>
                <div className="font-black text-gray-900 text-lg">{batch.totalSerials}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
            {!isTerminal && (
              <p className="text-[11px] text-amber-600 font-semibold text-center">
                Memproses aktivasi... status akan diperbarui otomatis.
              </p>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {(batch.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                >
                  <span className="font-mono font-bold text-gray-800 truncate mr-2">{item.serialNumber}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-black uppercase text-[10px] ${ITEM_STATUS_CLASS[item.status] || 'text-gray-400'}`}>
                      {ITEM_STATUS_LABEL[item.status] || item.status}
                    </span>
                    {item.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item)}
                        disabled={retryingId === item.id}
                        className="text-[10px] font-bold text-primary-600 underline disabled:opacity-50"
                      >
                        {retryingId === item.id ? '...' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isTerminal && (
              <button
                type="button"
                onClick={onSettled}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
              >
                Selesai
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
