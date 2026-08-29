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
          <div className="space-y-2">
            {showNationalMenu && (
              <button
                type="button"
                onClick={() => {
                  onNationalSelect();
                  setStep('menu');
                }}
                className="w-full p-3 rounded-xl border border-amber-200 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-amber-400"
              >
                Voucher Nasional (Berlaku Semua Wilayah)
              </button>
            )}

            {regions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => openCategory(region)}
                className="w-full p-3 rounded-xl border border-amber-200 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-amber-400"
              >
                {TELKOMSEL_REGION_MENU_LABELS[region]}
              </button>
            ))}

            {orphans.length > 0 && (
              <button
                type="button"
                onClick={() => openCategory('orphan')}
                className="w-full p-3 rounded-xl border border-amber-200 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-amber-400"
              >
                Voucher Wilayah Lainnya
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
