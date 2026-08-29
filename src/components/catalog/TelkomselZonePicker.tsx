import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { Product } from '../../types';
import {
  availableTelkomselRegions,
  collectTelkomselZoneLabels,
  regionHasCitySearch,
  searchCityForZoneLabel,
  TELKOMSEL_REGION_LABELS,
  type TelkomselRegionKey,
  zoneLabelsForRegion,
} from '../../utils/telkomselVoucherZone';

type Props = {
  products: Product[];
  zoneReference: Record<string, string[]>;
  selectedRegion: TelkomselRegionKey | null;
  selectedZoneLabel: string | null;
  onRegionChange: (region: TelkomselRegionKey | null) => void;
  onZoneLabelChange: (zoneLabel: string | null) => void;
};

export function TelkomselZonePicker({
  products,
  zoneReference,
  selectedRegion,
  selectedZoneLabel,
  onRegionChange,
  onZoneLabelChange,
}: Props) {
  const [citySearch, setCitySearch] = useState('');
  const [highlightZone, setHighlightZone] = useState<string | null>(null);
  const zoneRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const zoneLabels = useMemo(() => collectTelkomselZoneLabels(products), [products]);
  const regions = useMemo(() => availableTelkomselRegions(zoneLabels), [zoneLabels]);
  const regionZoneLabels = useMemo(
    () => (selectedRegion ? zoneLabelsForRegion(zoneLabels, selectedRegion) : []),
    [zoneLabels, selectedRegion]
  );

  useEffect(() => {
    if (!selectedRegion) return;
    const match = searchCityForZoneLabel(citySearch, zoneReference, regionZoneLabels);
    setHighlightZone(match);
    if (match && zoneRefs.current[match]) {
      zoneRefs.current[match]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [citySearch, zoneReference, regionZoneLabels, selectedRegion]);

  const handleResetWilayah = () => {
    onRegionChange(null);
    onZoneLabelChange(null);
    setCitySearch('');
    setHighlightZone(null);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-600" />
            Pilih Wilayah Voucher Telkomsel
          </h4>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Voucher Telkomsel hanya aktif di zona yang sesuai. Pilih wilayah &amp; zona sebelum memilih paket.
          </p>
        </div>
        {(selectedRegion || selectedZoneLabel) && (
          <button
            type="button"
            onClick={handleResetWilayah}
            className="text-[10px] font-bold text-amber-700 whitespace-nowrap"
          >
            Ganti wilayah
          </button>
        )}
      </div>

      {!selectedRegion && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {regions.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => {
                onRegionChange(region);
                onZoneLabelChange(null);
                setCitySearch('');
                setHighlightZone(null);
              }}
              className="p-3 rounded-xl border border-amber-200 bg-white text-left text-xs font-extrabold text-gray-900 hover:border-amber-400"
            >
              {TELKOMSEL_REGION_LABELS[region]}
            </button>
          ))}
        </div>
      )}

      {selectedRegion && !selectedZoneLabel && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-800">
              Wilayah: {TELKOMSEL_REGION_LABELS[selectedRegion]} — pilih zona
            </p>
            <button
              type="button"
              onClick={() => onRegionChange(null)}
              className="text-[10px] font-bold text-primary-600"
            >
              Ubah wilayah
            </button>
          </div>

          {regionHasCitySearch(selectedRegion) && (
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
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {regionZoneLabels.map((label) => (
              <button
                key={label}
                ref={(el) => {
                  zoneRefs.current[label] = el;
                }}
                type="button"
                onClick={() => onZoneLabelChange(label)}
                className={`p-3 rounded-xl border text-left text-xs font-extrabold transition-colors ${
                  highlightZone === label
                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                    : 'border-gray-100 bg-white text-gray-900 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedZoneLabel && (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-gray-600">Zona dipilih:</span>
          <span className="font-extrabold text-primary-700">{selectedZoneLabel}</span>
          <button
            type="button"
            onClick={() => onZoneLabelChange(null)}
            className="text-[10px] font-bold text-primary-600 ml-auto"
          >
            Ganti zona
          </button>
        </div>
      )}
    </div>
  );
}
