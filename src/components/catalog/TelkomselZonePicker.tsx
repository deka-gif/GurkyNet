import { useMemo, useState } from 'react';
import { AlertTriangle, MapPin, Search, X } from 'lucide-react';
import type { Product } from '../../types';
import {
  availableTelkomselRegions,
  buildCityZoneListForRegion,
  categoryWarningLabel,
  collectTelkomselZoneLabels,
  filterCities,
  hasTelkomselNationalProducts,
  orphanZoneLabels,
  TELKOMSEL_REGION_LABELS,
  TELKOMSEL_REGION_MENU_LABELS,
  uniqueCityNamesForRegion,
  zoneLabelsForCity,
  zoneLabelsForRegion,
  zoneLabelsWithoutCityData,
  type TelkomselCategoryKey,
  type TelkomselRegionKey,
} from '../../utils/telkomselVoucherZone';

type Props = {
  products: Product[];
  zoneReference: Record<string, string[]>;
  nationalSelected: boolean;
  selectedZoneLabel: string | null;
  onNationalSelect: () => void;
  onZoneLabelChange: (zoneLabel: string | null) => void;
  onReset: () => void;
};

type PickerStep = 'menu' | 'city' | 'zone-choice';

export function TelkomselZonePicker({
  products,
  zoneReference,
  nationalSelected,
  selectedZoneLabel,
  onNationalSelect,
  onZoneLabelChange,
  onReset,
}: Props) {
  const [step, setStep] = useState<PickerStep>('menu');
  const [pendingCategory, setPendingCategory] = useState<TelkomselCategoryKey | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [pendingCity, setPendingCity] = useState<string | null>(null);
  const [pendingZoneChoices, setPendingZoneChoices] = useState<string[]>([]);

  const zoneLabels = useMemo(() => collectTelkomselZoneLabels(products), [products]);
  const regions = useMemo(() => availableTelkomselRegions(zoneLabels), [zoneLabels]);
  const orphans = useMemo(() => orphanZoneLabels(zoneLabels), [zoneLabels]);
  const showNationalMenu = hasTelkomselNationalProducts(products);

  const activeCategory = pendingCategory;
  const activeRegion = activeCategory && activeCategory !== 'orphan' ? activeCategory : null;

  const regionZoneLabels = useMemo(
    () => (activeRegion ? zoneLabelsForRegion(zoneLabels, activeRegion) : []),
    [zoneLabels, activeRegion]
  );

  const cityNames = useMemo(
    () => (activeRegion ? uniqueCityNamesForRegion(zoneReference, zoneLabels, activeRegion) : []),
    [activeRegion, zoneReference, zoneLabels]
  );

  const filteredCities = useMemo(() => filterCities(cityNames, citySearch), [cityNames, citySearch]);

  const zonesWithoutCity = useMemo(
    () => (activeRegion ? zoneLabelsWithoutCityData(zoneReference, zoneLabels, activeRegion) : []),
    [activeRegion, zoneReference, zoneLabels]
  );

  const resetToMenu = () => {
    setStep('menu');
    setPendingCategory(null);
    setShowWarningModal(false);
    setCitySearch('');
    setPendingCity(null);
    setPendingZoneChoices([]);
    onReset();
  };

  const openCategory = (category: TelkomselCategoryKey) => {
    setPendingCategory(category);
    setShowWarningModal(true);
    setCitySearch('');
    setPendingCity(null);
    setPendingZoneChoices([]);
  };

  const handleConfirmWarning = () => {
    setShowWarningModal(false);
    if (pendingCategory === 'orphan') {
      setStep('city');
      return;
    }
    const region = pendingCategory as TelkomselRegionKey;
    const hasCityData = buildCityZoneListForRegion(zoneReference, zoneLabels, region).length > 0;
    const directZones = zoneLabelsWithoutCityData(zoneReference, zoneLabels, region);
    if (!hasCityData && directZones.length > 0) {
      setStep('city');
      return;
    }
    setStep('city');
  };

  const handleCancelWarning = () => {
    setShowWarningModal(false);
    setPendingCategory(null);
    setStep('menu');
  };

  const handleCityClick = (city: string) => {
    if (!activeRegion) return;
    const matches = zoneLabelsForCity(city, zoneReference, regionZoneLabels);
    if (matches.length === 0) return;
    if (matches.length === 1) {
      onZoneLabelChange(matches[0]);
      return;
    }
    setPendingCity(city);
    setPendingZoneChoices(matches);
    setStep('zone-choice');
  };

  const handleDirectZoneClick = (zoneLabel: string) => {
    onZoneLabelChange(zoneLabel);
  };

  const handleBackToCityStep = () => {
    setPendingCity(null);
    setPendingZoneChoices([]);
    setStep('city');
  };

  const selectionLabel = nationalSelected
    ? 'Voucher Nasional (Berlaku Semua Wilayah)'
    : selectedZoneLabel
      ? selectedZoneLabel
      : null;

  const showMenu = step === 'menu' && !nationalSelected && !selectedZoneLabel;

  return (
    <>
      <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600" />
              Pilih Kategori Voucher Telkomsel
            </h4>
            <p className="text-[11px] text-amber-800/80 mt-1">
              Pilih kategori voucher sesuai lokasi kartu SIM. Voucher zona salah tidak akan aktif dan saldo tidak bisa
              dikembalikan.
            </p>
          </div>
          {selectionLabel && (
            <button type="button" onClick={resetToMenu} className="text-[10px] font-bold text-amber-700 whitespace-nowrap">
              Ganti kategori
            </button>
          )}
        </div>

        {selectionLabel && (
          <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs">
            <span className="font-bold text-gray-600">Kategori dipilih: </span>
            <span className="font-extrabold text-primary-700">{selectionLabel}</span>
          </div>
        )}

        {showMenu && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {showNationalMenu && (
              <button
                type="button"
                onClick={() => {
                  onNationalSelect();
                  setStep('menu');
                }}
                className="relative text-left bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-2xl p-4 transition-all duration-200 hover:border-primary-400 hover:shadow-lg hover:shadow-primary-900/10 hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] text-primary-600 mb-2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
                </svg>
                <div className="text-xs font-extrabold text-gray-900 leading-snug">Voucher Nasional</div>
                <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Berlaku semua wilayah</div>
              </button>
            )}

            {regions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => openCategory(region)}
                className="relative text-left bg-white border border-gray-200 rounded-2xl p-4 transition-all duration-200 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/10 hover:-translate-y-0.5"
              >
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary-400" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] text-primary-600 mb-2">
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                  <circle cx="12" cy="10" r="2.4" />
                </svg>
                <div className="text-xs font-extrabold text-gray-900 leading-snug">{TELKOMSEL_REGION_LABELS[region]}</div>
                <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Tersedia</div>
              </button>
            ))}

            {orphans.length > 0 && (
              <button
                type="button"
                onClick={() => openCategory('orphan')}
                className="relative text-left bg-white border border-gray-200 rounded-2xl p-4 transition-all duration-200 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-900/10 hover:-translate-y-0.5"
              >
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary-400" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px] text-primary-600 mb-2">
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.6.5-1.2 1.1-1.2 2.2V14" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
                </svg>
                <div className="text-xs font-extrabold text-gray-900 leading-snug">Lainnya</div>
                <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Wilayah Lainnya</div>
              </button>
            )}
          </div>
        )}

        {step === 'city' && activeCategory && !nationalSelected && !selectedZoneLabel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-800">
                {activeCategory === 'orphan'
                  ? 'Pilih zona wilayah'
                  : `Pilih kota/kabupaten — ${TELKOMSEL_REGION_MENU_LABELS[activeCategory]}`}
              </p>
              <button type="button" onClick={resetToMenu} className="text-[10px] font-bold text-primary-600">
                Ganti kategori
              </button>
            </div>

            {activeCategory === 'orphan' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {orphans.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleDirectZoneClick(label)}
                    className="p-3 rounded-xl border border-gray-100 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-gray-300"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {cityNames.length > 0 && (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Cari kabupaten/kota..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredCities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleCityClick(city)}
                          className="p-3 rounded-xl border border-gray-100 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-primary-300 hover:bg-primary-50/40"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {zonesWithoutCity.length > 0 && (
                  <div className="space-y-2">
                    {cityNames.length > 0 && (
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Zona tanpa daftar kota</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {zonesWithoutCity.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleDirectZoneClick(label)}
                          className="p-3 rounded-xl border border-gray-100 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-gray-300"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'zone-choice' && pendingCity && pendingZoneChoices.length > 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-800">
                {pendingCity} — pilih zona (lebih dari satu zona cocok)
              </p>
              <button type="button" onClick={handleBackToCityStep} className="text-[10px] font-bold text-primary-600">
                Kembali ke daftar kota
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pendingZoneChoices.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleDirectZoneClick(label)}
                  className="p-3 rounded-xl border border-primary-200 bg-white text-left text-xs font-extrabold text-primary-700 hover:border-primary-400"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showWarningModal && pendingCategory && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="telkomsel-zone-warning-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <h3 id="telkomsel-zone-warning-title" className="text-sm font-extrabold text-gray-900">
                  Bijak Memilih Zona Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelWarning}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-700 leading-relaxed">
                Voucher ini hanya aktif untuk nomor yang dipakai di wilayah{' '}
                <span className="font-extrabold">{categoryWarningLabel(pendingCategory)}</span>. Kalau salah pilih zona,
                voucher <span className="font-extrabold">TIDAK AKAN AKTIF</span> dan saldo yang sudah terpotong tidak
                bisa dikembalikan. Pastikan kamu tahu lokasi kartu SIM sebelum lanjut.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelWarning}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWarning}
                  className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-extrabold hover:bg-primary-700"
                >
                  Mengerti, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
