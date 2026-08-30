import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { ProductPicker } from '../../components/catalog/ProductPicker';
import { PhysicalBatchCheckout } from '../../components/catalog/PhysicalBatchCheckout';
import { VoucherCameraScan } from '../../components/catalog/VoucherCameraScan';
import { Product } from '../../types';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { filterVoucherInternetProducts } from '../../utils/voucherInternetGuard';
import { isTelkomselOperator, telkomselNationalProducts } from '../../utils/telkomselVoucherZone';
import {
  addCodesToScan,
  clearPendingScan,
  expandSnRange,
  loadPendingScan,
  removeScannedSerial,
  savePendingScan,
  type ScannedSerial,
} from '../../utils/voucherPhysicalScan';

type FisikStage = 'scan' | 'pilih-produk';

const MAX_BATCH_ITEMS = 200;

export const VoucherFisikZonaPage = () => {
  const navigate = useNavigate();
  const { zona: zonaParam } = useParams<{ zona: string }>();
  const zona = zonaParam ? decodeURIComponent(zonaParam) : '';

  const { wallet, fetchWallet } = useWalletStore();
  const { products, fetchProducts } = useProductStore();

  const [stage, setStage] = useState<FisikStage>('scan');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [scannedList, setScannedList] = useState<ScannedSerial[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [scanInputTab, setScanInputTab] = useState<'camera' | 'manual'>('camera');
  const [snListExpanded, setSnListExpanded] = useState(false);
  const lastCameraDetectRef = useRef<{ serial: string; at: number } | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);

  const restoredScanOnce = useRef(false);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    if (scanNotice) toastError('Perhatian', scanNotice);
  }, [scanNotice]);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category: 'voucher-internet' });

    if (!restoredScanOnce.current) {
      restoredScanOnce.current = true;
      const pendingScan = loadPendingScan();
      if (pendingScan && pendingScan.list.length > 0 && operatorsMatch(pendingScan.zona, zona)) {
        setScannedList(pendingScan.list);
        setStage('scan');
      }
    }
  }, [fetchWallet, fetchProducts, zona]);

  useEffect(() => {
    if (scannedList.length === 0) {
      clearPendingScan();
      return;
    }
    savePendingScan({ zona, skuCode: selectedProduct?.code ?? null, list: scannedList });
  }, [zona, selectedProduct, scannedList]);

  const voucherInternetProducts = useMemo(() => filterVoucherInternetProducts(products), [products]);

  const zonaProducts = useMemo(() => {
    if (!zona) return [];
    return voucherInternetProducts
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, zona))
      .sort((a, b) => a.price - b.price);
  }, [voucherInternetProducts, zona]);

  // Voucher Fisik is national-only — Telkomsel regional-zone products are always excluded here,
  // regardless of whether the shared zone-gate would normally require picking a region.
  const telkomselCatalogActive = !!zona && isTelkomselOperator(zona) && zonaProducts.length > 0;
  const catalogProductsToShow = useMemo(
    () => (telkomselCatalogActive ? telkomselNationalProducts(zonaProducts) : zonaProducts),
    [telkomselCatalogActive, zonaProducts]
  );

  const physicalTotal = selectedProduct ? selectedProduct.price * scannedList.length : 0;

  const handleScanSubmit = () => {
    const raw = scanInput.trim();
    if (!raw) {
      setScanNotice('Masukkan barcode / serial number / range SN.');
      return;
    }
    const sns = expandSnRange(raw);
    const result = addCodesToScan(scannedList, sns, MAX_BATCH_ITEMS);
    setScannedList(result.list);
    setScanInput('');
    setScanNotice(result.noticeParts.length ? result.noticeParts.join(', ') + '.' : null);
  };

  const addCodesFromCamera = (text: string): 'added' | 'duplicate' | 'ignored' => {
    const serial = text.trim();
    if (!serial) return 'ignored';

    const now = Date.now();
    if (lastCameraDetectRef.current?.serial === serial && now - lastCameraDetectRef.current.at < 1500) {
      return 'ignored';
    }
    lastCameraDetectRef.current = { serial, at: now };

    const result = addCodesToScan(scannedList, [serial], MAX_BATCH_ITEMS);
    if (result.atCapacity && result.added === 0) {
      setScanNotice(result.noticeParts[0] ?? `Batch sudah mencapai maksimal ${MAX_BATCH_ITEMS} SN.`);
      return 'ignored';
    }

    setScannedList(result.list);

    if (result.added > 0) {
      if (result.overflow > 0) {
        setScanNotice(result.noticeParts.join(', ') + '.');
      } else {
        setScanNotice(null);
      }
      return 'added';
    }

    if (result.duplicates > 0) {
      return 'duplicate';
    }

    return 'ignored';
  };

  const handleRemoveScanned = (serial: string) => {
    setScannedList((prev) => removeScannedSerial(prev, serial));
  };

  const handleResetScan = () => {
    setScannedList([]);
    setScanInput('');
    setScanNotice(null);
    setSnListExpanded(false);
    lastCameraDetectRef.current = null;
    clearPendingScan();
  };

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
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl pb-28">
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
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Fisik</h2>
              <span className="text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100 uppercase">
                {zona}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stage === 'scan' && 'Tahap 1 dari 2 — Scan serial number voucher'}
              {stage === 'pilih-produk' && 'Tahap 2 dari 2 — Pilih nominal, lalu bayar'}
            </p>
          </div>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {stage === 'scan' && (
        <div className="relative bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
          <div className="p-6 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pb-28">
            {scanInputTab === 'camera' ? (
              <>
                <VoucherCameraScan
                  active={scannedList.length < MAX_BATCH_ITEMS}
                  scanCount={scannedList.length}
                  onDetected={addCodesFromCamera}
                />
                <button
                  type="button"
                  onClick={() => setScanInputTab('manual')}
                  className="text-[11px] font-bold text-primary-600 hover:text-primary-700"
                >
                  + Input Manual
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setScanInputTab('camera')}
                  className="text-[11px] font-bold text-primary-600 hover:text-primary-700"
                >
                  ← Kembali ke Kamera
                </button>
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
              </>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-gray-900">{scannedList.length} voucher siap</p>
              {scannedList.length > 0 && (
                <button type="button" onClick={handleResetScan} className="text-[10px] font-bold text-red-500">
                  Reset Semua
                </button>
              )}
            </div>

            {scannedList.length > 0 && (
              <div className="space-y-1.5">
                {(snListExpanded ? scannedList : scannedList.slice(0, 3)).map((s) => (
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
                {!snListExpanded && scannedList.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setSnListExpanded(true)}
                    className="w-full text-center text-[11px] font-bold text-gray-400 py-1.5"
                  >
                    + {scannedList.length - 3} lainnya · lihat semua
                  </button>
                )}
                {snListExpanded && scannedList.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setSnListExpanded(false)}
                    className="w-full text-center text-[11px] font-bold text-gray-400 py-1.5"
                  >
                    Sembunyikan
                  </button>
                )}
              </div>
            )}

            <p className="text-[10px] text-gray-500">
              Satu batch hanya untuk satu nominal GB yang sama. Untuk nominal campuran, buat batch terpisah.
            </p>
          </div>

          <div className="sticky bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm p-4 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold text-gray-900">{scannedList.length} voucher siap</p>
            <button
              type="button"
              onClick={() => {
                if (scannedList.length === 0) {
                  setScanNotice('Scan minimal 1 voucher terlebih dahulu.');
                  return;
                }
                setStage('pilih-produk');
              }}
              className="py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm shrink-0"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {stage === 'pilih-produk' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-gray-900 text-sm">Pilih Nominal</h4>
            <button type="button" onClick={() => setStage('scan')} className="text-[10px] font-bold text-primary-600">
              Kembali ke Scan
            </button>
          </div>

          <ProductPicker
            products={catalogProductsToShow}
            selected={selectedProduct}
            onSelect={setSelectedProduct}
          />

          <button
            type="button"
            onClick={() => {
              if (!selectedProduct) {
                setErrorMsg('Pilih nominal paket terlebih dahulu.');
                return;
              }
              setBatchCheckoutOpen(true);
            }}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
          >
            Lanjut Bayar
          </button>
        </div>
      )}

      {batchCheckoutOpen && selectedProduct && (
        <PhysicalBatchCheckout
          product={selectedProduct}
          serials={scannedList}
          insufficientBalance={!wallet || wallet.balance < physicalTotal}
          onClose={() => setBatchCheckoutOpen(false)}
          onSettled={() => {
            setBatchCheckoutOpen(false);
            setScannedList([]);
            setStage('scan');
            clearPendingScan();
            fetchWallet();
            setSuccessMsg('Batch voucher fisik selesai diproses.');
          }}
        />
      )}
    </div>
  );
};
