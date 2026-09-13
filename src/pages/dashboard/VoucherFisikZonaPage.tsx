import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { ProductPicker } from '../../components/catalog/ProductPicker';
import { PhysicalBatchCheckout } from '../../components/catalog/PhysicalBatchCheckout';
import { VoucherCameraScan } from '../../components/catalog/VoucherCameraScan';
import { CatalogLoadMoreButton } from '../../components/catalog/CatalogLoadMoreButton';
import { Product } from '../../types';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed } from '../../utils/catalogAvailability';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { filterVoucherInternetProducts } from '../../utils/voucherInternetGuard';
import {
  collectTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  orphanZoneLabels,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';
import {
  addCodesToScan,
  clearPendingScan,
  expandSnRange,
  loadPendingScan,
  removeScannedSerial,
  savePendingScan,
  type ScannedSerial,
} from '../../utils/voucherPhysicalScan';
import { productService } from '../../services/product/product.service';
import { useProviderProductPager } from '../../hooks/useProviderProductPager';
import { findCategoryProviderByName } from '../../utils/findCategoryProvider';

type FisikStage = 'type' | 'zone' | 'scan' | 'pilih-produk';
type PhysicalType = 'nasional' | 'perWilayah';

const MAX_BATCH_ITEMS = 200;

const ZONE_WARN =
  'Kartu fisik berzona hanya aktif di wilayah tertentu. Pastikan SEMUA kartu yang kamu input sesuai wilayah ini. Kartu yang salah wilayah akan gagal dan harus di-retry satu per satu.';

function sortByPrice(rows: Product[]): Product[] {
  return [...rows].sort((a, b) => a.price - b.price);
}

/**
 * Voucher Fisik — providers-first + Per Wilayah parity with mobile (web audit Item 3).
 * QR/SN has no zone field → mandatory checkbox before SN input when Per Wilayah.
 */
export const VoucherFisikZonaPage = () => {
  const navigate = useNavigate();
  const { zona: zonaParam } = useParams<{ zona: string }>();
  const brand = zonaParam ? decodeURIComponent(zonaParam) : '';

  const { wallet, fetchWallet } = useWalletStore();
  const pager = useProviderProductPager();

  const [stage, setStage] = useState<FisikStage>('scan');
  const [physicalType, setPhysicalType] = useState<PhysicalType | null>(null);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);
  const [scanZoneAck, setScanZoneAck] = useState(false);
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
    if (!restoredScanOnce.current) {
      restoredScanOnce.current = true;
      const pendingScan = loadPendingScan();
      if (pendingScan && pendingScan.list.length > 0 && operatorsMatch(pendingScan.zona, brand)) {
        setScannedList(pendingScan.list);
      }
    }
  }, [fetchWallet, brand]);

  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    (async () => {
      const res = await productService.getCategoryProviders('voucher-internet', { vi_mode: 'fisik' });
      if (cancelled) return;
      const providers = res.success && Array.isArray(res.data) ? res.data : [];
      const match = findCategoryProviderByName(providers, brand);
      if (!match?.providerId) {
        pager.reset();
        setErrorMsg('Provider tidak ditemukan di katalog voucher fisik.');
        return;
      }
      const result = await pager.loadInitial({
        category: 'voucher-internet',
        vi_mode: 'fisik',
        provider_id: match.providerId,
      });
      if (cancelled || !result) return;
      const listed = filterVoucherInternetProducts(result.products).filter(isCatalogListed);
      const needsZone = isTelkomselOperator(brand) && telkomselNeedsZoneGate(listed);
      if (needsZone) {
        await pager.loadAllRemainingPages();
        if (cancelled) return;
        setPhysicalType(null);
        setZoneLabel(null);
        setScanZoneAck(false);
        setStage('type');
      } else {
        setPhysicalType('nasional');
        setZoneLabel(null);
        setScanZoneAck(true);
        setStage('scan');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  useEffect(() => {
    if (scannedList.length === 0) {
      clearPendingScan();
      return;
    }
    savePendingScan({ zona: brand, skuCode: selectedProduct?.code ?? null, list: scannedList });
  }, [brand, selectedProduct, scannedList]);

  const allBrandProducts = useMemo(
    () => sortByPrice(filterVoucherInternetProducts(pager.products).filter(isCatalogListed)),
    [pager.products]
  );

  const zoneLabels = useMemo(() => collectTelkomselZoneLabels(allBrandProducts), [allBrandProducts]);
  const orphanLabels = useMemo(() => orphanZoneLabels(zoneLabels), [zoneLabels]);
  const geoLabels = useMemo(
    () => zoneLabels.filter((l) => !orphanLabels.includes(l)),
    [zoneLabels, orphanLabels]
  );

  const isZonalBatch = physicalType === 'perWilayah' && !!zoneLabel;

  const catalogProductsToShow = useMemo(() => {
    if (physicalType === 'perWilayah' && zoneLabel) {
      return sortByPrice(filterProductsByZoneLabel(allBrandProducts, zoneLabel));
    }
    if (isTelkomselOperator(brand)) {
      return sortByPrice(telkomselNationalProducts(allBrandProducts));
    }
    return allBrandProducts;
  }, [physicalType, zoneLabel, allBrandProducts, brand]);

  const physicalTotal = selectedProduct ? selectedProduct.price * scannedList.length : 0;

  const selectNasional = () => {
    setPhysicalType('nasional');
    setZoneLabel(null);
    setScanZoneAck(true);
    setSelectedProduct(null);
    setScannedList([]);
    setScanInput('');
    setStage('scan');
  };

  const selectPerWilayah = () => {
    setPhysicalType('perWilayah');
    setZoneLabel(null);
    setScanZoneAck(false);
    setSelectedProduct(null);
    setScannedList([]);
    setScanInput('');
    setStage('zone');
  };

  const selectZone = (label: string) => {
    setZoneLabel(label);
    setScanZoneAck(false);
    setSelectedProduct(null);
    setScannedList([]);
    setScanInput('');
    setStage('scan');
  };

  const handleScanSubmit = () => {
    if (isZonalBatch && !scanZoneAck) {
      setScanNotice('Centang konfirmasi zona sebelum input SN.');
      return;
    }
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
    if (isZonalBatch && !scanZoneAck) return 'ignored';
    const serial = text.trim();
    if (!serial) return 'ignored';

    const now = Date.now();
    const last = lastCameraDetectRef.current;
    if (last && last.serial === serial && now - last.at < 1500) {
      return 'ignored';
    }
    lastCameraDetectRef.current = { serial, at: now };

    const before = scannedList.length;
    const result = addCodesToScan(scannedList, [serial], MAX_BATCH_ITEMS);
    setScannedList(result.list);
    if (result.noticeParts.length) {
      setScanNotice(result.noticeParts.join(', ') + '.');
    }
    if (result.list.length > before) return 'added';
    if (result.duplicates > 0) return 'duplicate';
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

  const goBack = () => {
    if (stage === 'pilih-produk') {
      setStage('scan');
      setSelectedProduct(null);
      return;
    }
    if (stage === 'scan') {
      if (physicalType === 'perWilayah') {
        setStage('zone');
        setScanZoneAck(false);
        setScannedList([]);
        return;
      }
      if (physicalType === 'nasional' && isTelkomselOperator(brand) && telkomselNeedsZoneGate(allBrandProducts)) {
        setStage('type');
        setPhysicalType(null);
        setScannedList([]);
        return;
      }
      navigate('/dashboard/voucher-internet');
      return;
    }
    if (stage === 'zone') {
      setStage('type');
      setZoneLabel(null);
      return;
    }
    navigate('/dashboard/voucher-internet');
  };

  const typeLabel =
    physicalType === 'perWilayah' ? 'Per Wilayah' : physicalType === 'nasional' ? 'Nasional' : null;

  if (!brand) {
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
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl pb-28">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={goBack}
            className="mt-1 p-2 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-600"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Fisik</h2>
              <span className="text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100 uppercase">
                {[brand, typeLabel, zoneLabel].filter(Boolean).join(' · ')}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stage === 'type' && 'Pilih tipe voucher fisik'}
              {stage === 'zone' && 'Pilih wilayah kartu'}
              {stage === 'scan' && 'Input serial number voucher'}
              {stage === 'pilih-produk' && 'Pilih nominal, lalu bayar'}
            </p>
          </div>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {pager.loading && allBrandProducts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-gray-100">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
        </div>
      ) : null}

      {stage === 'type' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-3">
          <h4 className="font-extrabold text-gray-900 text-sm">Pilih Tipe</h4>
          <button
            type="button"
            onClick={selectNasional}
            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-primary-300 bg-gray-50"
          >
            <div className="font-extrabold text-gray-900 text-sm">Nasional</div>
            <div className="text-xs text-gray-500 mt-0.5">Berlaku di semua wilayah</div>
          </button>
          <button
            type="button"
            onClick={selectPerWilayah}
            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-primary-300 bg-gray-50"
          >
            <div className="font-extrabold text-gray-900 text-sm">Per Wilayah</div>
            <div className="text-xs text-gray-500 mt-0.5">Hanya aktif di zona tertentu</div>
          </button>
        </div>
      )}

      {stage === 'zone' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-4">
          <h4 className="font-extrabold text-gray-900 text-sm">Pilih Wilayah</h4>
          <div className="flex gap-2 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-xs font-bold text-gray-900">
            <span aria-hidden>⚠</span>
            <span>{ZONE_WARN}</span>
          </div>
          {geoLabels.length === 0 && orphanLabels.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-2xl">
              Belum ada voucher berzona untuk provider ini.
            </p>
          ) : (
            <>
              {geoLabels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {geoLabels.map((label) => {
                    const count = filterProductsByZoneLabel(allBrandProducts, label).length;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => selectZone(label)}
                        className="text-left p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-primary-300"
                      >
                        <div className="text-xs font-extrabold text-gray-900">{label}</div>
                        <div className="text-[10px] text-gray-400 font-semibold">{count} produk</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {orphanLabels.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold text-gray-700">Wilayah Lainnya</p>
                  <p className="text-[10px] text-gray-400">
                    Zona Digiflazz yang belum dikelompokkan ke daftar wilayah utama.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {orphanLabels.map((label) => {
                      const count = filterProductsByZoneLabel(allBrandProducts, label).length;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => selectZone(label)}
                          className="text-left p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-primary-300"
                        >
                          <div className="text-xs font-extrabold text-gray-900">{label}</div>
                          <div className="text-[10px] text-gray-400 font-semibold">{count} produk</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {stage === 'scan' && (
        <div className="relative bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
          <div className="p-6 space-y-4 pb-28">
            {isZonalBatch && zoneLabel ? (
              <>
                <div className="rounded-2xl border-2 border-primary-600 bg-primary-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-primary-700">
                    Zona yang dipilih
                  </p>
                  <p className="text-lg font-black text-gray-900">{zoneLabel}</p>
                </div>
                <div className="flex gap-2 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-xs font-bold text-gray-900">
                  <span aria-hidden>⚠</span>
                  <span>{ZONE_WARN}</span>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanZoneAck}
                    onChange={(e) => {
                      setScanZoneAck(e.target.checked);
                      setScanNotice(null);
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xs font-semibold text-gray-800 leading-relaxed">
                    Saya yakin kartu yang akan di-scan/diinput untuk zona {zoneLabel}
                  </span>
                </label>
                {!scanZoneAck ? (
                  <p className="text-xs font-semibold text-amber-700">
                    Centang konfirmasi zona di atas sebelum kamera atau input SN aktif.
                  </p>
                ) : null}
              </>
            ) : null}

            {(!isZonalBatch || scanZoneAck) ? (
              <>
                {scanInputTab === 'camera' ? (
                  <>
                    <VoucherCameraScan
                      active={scannedList.length < MAX_BATCH_ITEMS && (!isZonalBatch || scanZoneAck)}
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
                      placeholder={
                        'Scan barcode atau input SN, lalu Enter.\nContoh range: ABC1000-ABC1010\nAtau list: SN1, SN2, SN3'
                      }
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
              </>
            ) : null}
          </div>

          <div className="sticky bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm p-4 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold text-gray-900">{scannedList.length} voucher siap</p>
            <button
              type="button"
              onClick={() => {
                if (isZonalBatch && !scanZoneAck) {
                  setScanNotice('Centang konfirmasi zona sebelum lanjut.');
                  return;
                }
                if (scannedList.length === 0) {
                  setScanNotice('Input minimal 1 voucher terlebih dahulu.');
                  return;
                }
                setStage('pilih-produk');
              }}
              disabled={isZonalBatch && !scanZoneAck}
              className="py-3 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shrink-0"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {stage === 'pilih-produk' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-gray-900 text-sm">
              Pilih Nominal{zoneLabel ? ` · ${zoneLabel}` : physicalType === 'nasional' ? ' · Nasional' : ''}
            </h4>
            <button type="button" onClick={() => setStage('scan')} className="text-[10px] font-bold text-primary-600">
              Kembali ke Input SN
            </button>
          </div>

          {catalogProductsToShow.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-2xl">
              Belum ada voucher untuk pilihan ini.
            </p>
          ) : (
            <>
              <ProductPicker
                products={catalogProductsToShow}
                selected={selectedProduct}
                onSelect={setSelectedProduct}
              />
              <CatalogLoadMoreButton
                visible={pager.canLoadMore && physicalType !== 'perWilayah'}
                loading={pager.loadingMore}
                onClick={() => void pager.loadMore()}
              />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (!selectedProduct) {
                setErrorMsg('Pilih nominal paket terlebih dahulu.');
                return;
              }
              setBatchCheckoutOpen(true);
            }}
            disabled={!selectedProduct || scannedList.length === 0}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm"
          >
            Lanjut Bayar · {formatIDR(physicalTotal)}
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
            handleResetScan();
            setSelectedProduct(null);
            setStage(isTelkomselOperator(brand) && telkomselNeedsZoneGate(allBrandProducts) ? 'type' : 'scan');
            setPhysicalType(
              isTelkomselOperator(brand) && telkomselNeedsZoneGate(allBrandProducts) ? null : 'nasional'
            );
            setZoneLabel(null);
            setScanZoneAck(!(isTelkomselOperator(brand) && telkomselNeedsZoneGate(allBrandProducts)));
            fetchWallet();
            setSuccessMsg('Batch voucher fisik diproses.');
          }}
        />
      )}
    </div>
  );
};
