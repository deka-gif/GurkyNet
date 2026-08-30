import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  LayoutGrid,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import {
  DASHBOARD_SERVICE_CATEGORIES,
  HUB_CATEGORY_SLUGS,
} from '../../config/catalogCategories';
import { marketingService } from '../../services/marketing.service';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';
import { toastError, toastSuccess } from '../../hooks/useToast';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type BrandLogoItem = {
  id: number;
  name: string;
  logo: string | null;
  productCount: number;
  categories: string[];
  categorySlugs: string[];
};

type CategoryIconChild = {
  key: string;
  label: string;
  iconPath: string | null;
};

type CategoryIconHub = {
  hubId: string;
  hubLabel: string;
  hubKey: string;
  hubIconPath: string | null;
  children: CategoryIconChild[];
};

const MARKETING_HUB_IDS = [
  'telco',
  'tagihan',
  'topup-digital',
  'game',
  'voucher',
  'langganan',
  'international',
] as const;

const ALL_HUB_SLUGS = new Set(Object.values(HUB_CATEGORY_SLUGS).flat());

function brandInHub(brand: BrandLogoItem, hubId: string): boolean {
  const slugs = HUB_CATEGORY_SLUGS[hubId] ?? [];
  return brand.categorySlugs.some((s) => slugs.includes(s));
}

function brandInLainnya(brand: BrandLogoItem): boolean {
  if (brand.categorySlugs.length === 0) return true;
  return !brand.categorySlugs.some((s) => ALL_HUB_SLUGS.has(s));
}

function hubMeta(hubId: string) {
  return DASHBOARD_SERVICE_CATEGORIES.find((c) => c.id === hubId);
}

function subLucideByKey(): Record<string, LucideIcon> {
  const map: Record<string, LucideIcon> = {};
  for (const hub of DASHBOARD_SERVICE_CATEGORIES) {
    for (const child of hub.hubChildren ?? []) {
      map[child.key] = child.icon;
    }
  }
  return map;
}

const SUB_LUCIDE = subLucideByKey();

export const MarketingBrandLogoManagement: React.FC = () => {
  const isOwnerReadOnly = useOwnerReadOnly();
  const [brands, setBrands] = useState<BrandLogoItem[]>([]);
  const [categoryIconHubs, setCategoryIconHubs] = useState<CategoryIconHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyIconKey, setBusyIconKey] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<BrandLogoItem | null>(null);
  const [iconUploadKey, setIconUploadKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [brandRes, iconRes] = await Promise.all([
        marketingService.getBrandLogos(),
        marketingService.getCategoryIcons(),
      ]);
      const list = Array.isArray(brandRes?.data) ? brandRes.data : [];
      setBrands(
        list.map((b: BrandLogoItem) => ({
          ...b,
          categorySlugs: Array.isArray(b.categorySlugs) ? b.categorySlugs : [],
        }))
      );
      setCategoryIconHubs(Array.isArray(iconRes?.data) ? iconRes.data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data.';
      toastError('Gagal Memuat', message);
      setBrands([]);
      setCategoryIconHubs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const hubBrandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const hubId of MARKETING_HUB_IDS) {
      counts[hubId] = brands.filter((b) => brandInHub(b, hubId)).length;
    }
    counts.lainnya = brands.filter((b) => brandInLainnya(b)).length;
    return counts;
  }, [brands]);

  const currentHubIcons = useMemo(
    () => categoryIconHubs.find((h) => h.hubId === selectedHub) ?? null,
    [categoryIconHubs, selectedHub]
  );

  const filteredBrands = useMemo(() => {
    if (!selectedHub) return [];
    const q = searchKeyword.trim().toLowerCase();
    return brands.filter((brand) => {
      const matchesSearch = !q || brand.name.toLowerCase().includes(q);
      const matchesHub =
        selectedHub === 'lainnya' ? brandInLainnya(brand) : brandInHub(brand, selectedHub);
      return matchesSearch && matchesHub;
    });
  }, [brands, searchKeyword, selectedHub]);

  const handleLogoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const brand = uploadTarget;
    e.target.value = '';
    setUploadTarget(null);
    if (!file || !brand) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toastError('Format Tidak Valid', 'Format logo harus PNG, JPEG, WebP, atau SVG.');
      return;
    }

    setBusyId(brand.id);
    try {
      const uploadRes = await marketingService.uploadBrandLogoFile(file);
      const path = uploadRes?.data?.path;
      if (!path) {
        toastError('Upload Gagal', 'Path media tidak ditemukan.');
        return;
      }

      const setRes = await marketingService.setBrandLogo(brand.id, path);
      if (setRes && setRes.success === false) {
        toastError('Gagal Memperbarui', setRes.message || 'Logo brand gagal disimpan.');
        return;
      }

      const newLogo = setRes?.data?.logo ?? path;
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, logo: newLogo } : b)));
      toastSuccess('Berhasil', 'Logo berhasil diperbarui.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upload logo gagal. Silakan coba lagi.';
      toastError('Upload Gagal', message);
    } finally {
      setBusyId(null);
    }
  };

  const handleIconFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = iconUploadKey;
    e.target.value = '';
    setIconUploadKey(null);
    if (!file || !key) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toastError('Format Tidak Valid', 'Format icon harus PNG, JPEG, WebP, atau SVG.');
      return;
    }

    setBusyIconKey(key);
    try {
      const uploadRes = await marketingService.uploadCategoryIconFile(file);
      const path = uploadRes?.data?.path;
      if (!path) {
        toastError('Upload Gagal', 'Path media tidak ditemukan.');
        return;
      }

      const setRes = await marketingService.setCategoryIcon(key, path);
      if (setRes && setRes.success === false) {
        toastError('Gagal Memperbarui', setRes.message || 'Icon kategori gagal disimpan.');
        return;
      }

      setCategoryIconHubs((prev) =>
        prev.map((hub) => {
          if (hub.hubKey === key) {
            return { ...hub, hubIconPath: path };
          }
          return {
            ...hub,
            children: hub.children.map((child) =>
              child.key === key ? { ...child, iconPath: path } : child
            ),
          };
        })
      );
      toastSuccess('Berhasil', 'Icon kategori berhasil diperbarui.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upload icon gagal. Silakan coba lagi.';
      toastError('Upload Gagal', message);
    } finally {
      setBusyIconKey(null);
    }
  };

  const renderIconPreview = (
    customPath: string | null | undefined,
    FallbackIcon: LucideIcon,
    label: string,
    sizeClass = 'w-16 h-16'
  ) => {
    const url = customPath ? resolveMediaUrl(customPath) : '';
    if (url) {
      return <img src={url} alt={label} className={`${sizeClass} object-contain rounded-xl`} />;
    }
    return <FallbackIcon className="w-8 h-8 text-gray-400" strokeWidth={1.6} />;
  };

  const hubLabel = (hubId: string) => {
    if (hubId === 'lainnya') return 'Lainnya';
    return hubMeta(hubId)?.label ?? hubId;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Logo Brand
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Kelola logo brand & icon kategori — dikelompokkan sesuai 7 menu utama customer.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-primary-900 leading-relaxed">
          Perubahan logo dan icon di sini langsung berubah di tampilan customer — tidak perlu deploy
          atau approval apa pun.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-start gap-3">
        <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Hanya brand yang <span className="font-bold">aktif</span> dan memiliki minimal{' '}
          <span className="font-bold">satu produk live/operasional</span> yang muncul di daftar brand
          — filter visibility sama dengan picker brand di sisi customer.
        </p>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => void handleLogoFileSelected(e)}
      />
      <input
        ref={iconInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => void handleIconFileSelected(e)}
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse space-y-3"
            >
              <div className="w-16 h-16 rounded-xl bg-gray-100 mx-auto" />
              <div className="h-4 bg-gray-100 rounded-lg w-3/4 mx-auto" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      ) : brands.length === 0 && categoryIconHubs.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-gray-200 rounded-3xl bg-white">
          <Palette className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-extrabold text-gray-700">
            Belum ada brand aktif dengan produk live saat ini.
          </p>
        </div>
      ) : selectedHub === null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {MARKETING_HUB_IDS.map((hubId) => {
            const meta = hubMeta(hubId);
            const iconHub = categoryIconHubs.find((h) => h.hubId === hubId);
            const DefaultIcon = meta?.icon ?? LayoutGrid;
            const customUrl = iconHub?.hubIconPath ? resolveMediaUrl(iconHub.hubIconPath) : '';
            return (
              <button
                key={hubId}
                type="button"
                onClick={() => {
                  setSelectedHub(hubId);
                  setSearchKeyword('');
                }}
                className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col items-center gap-2 hover:border-primary-300 hover:shadow-md transition-all"
              >
                {customUrl ? (
                  <img src={customUrl} alt={hubLabel(hubId)} className="w-10 h-10 object-contain" />
                ) : (
                  <DefaultIcon className="w-7 h-7 text-gray-400" strokeWidth={1.6} />
                )}
                <span className="text-xs font-extrabold text-gray-900 text-center">
                  {hubLabel(hubId)}
                </span>
                <span className="text-[10px] text-gray-400 font-semibold">
                  {hubBrandCounts[hubId] ?? 0} brand
                </span>
              </button>
            );
          })}
          {(hubBrandCounts.lainnya ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedHub('lainnya');
                setSearchKeyword('');
              }}
              className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col items-center gap-2 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <LayoutGrid className="w-7 h-7 text-gray-400" strokeWidth={1.6} />
              <span className="text-xs font-extrabold text-gray-900 text-center">Lainnya</span>
              <span className="text-[10px] text-gray-400 font-semibold">
                {hubBrandCounts.lainnya} brand
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedHub(null)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Logo Brand
            <span className="text-gray-400 font-semibold">/ {hubLabel(selectedHub)}</span>
          </button>

          {selectedHub !== 'lainnya' && currentHubIcons && (
            <>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100">
                  {renderIconPreview(
                    currentHubIcons.hubIconPath,
                    hubMeta(selectedHub)?.icon ?? LayoutGrid,
                    currentHubIcons.hubLabel
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Icon Menu: {currentHubIcons.hubLabel}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Ditampilkan di tile utama dashboard customer untuk kategori ini.
                  </p>
                </div>
                {!isOwnerReadOnly && (
                  <button
                    type="button"
                    disabled={busyIconKey === currentHubIcons.hubKey}
                    onClick={() => {
                      setIconUploadKey(currentHubIcons.hubKey);
                      iconInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-extrabold hover:bg-primary-100 disabled:opacity-50"
                  >
                    {busyIconKey === currentHubIcons.hubKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {currentHubIcons.hubIconPath ? 'Ganti Icon' : 'Upload Icon'}
                  </button>
                )}
              </div>

              {currentHubIcons.children.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">
                    Icon Sub-Kategori
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {currentHubIcons.children.map((child) => {
                      const childKeyParts = child.key.split(':');
                      const childSlug = childKeyParts[2] ?? '';
                      const FallbackIcon = SUB_LUCIDE[childSlug] ?? LayoutGrid;
                      const busy = busyIconKey === child.key;
                      return (
                        <div
                          key={child.key}
                          className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col items-center gap-2"
                        >
                          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gray-50">
                            {renderIconPreview(child.iconPath, FallbackIcon, child.label, 'w-10 h-10')}
                          </div>
                          <span className="text-[11px] font-extrabold text-gray-900 text-center">
                            {child.label}
                          </span>
                          {!isOwnerReadOnly && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setIconUploadKey(child.key);
                                iconInputRef.current?.click();
                              }}
                              className="w-full inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 text-[10px] font-extrabold hover:bg-primary-100 disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              {child.iconPath ? 'Ganti' : 'Upload'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">
              Logo Brand
            </h4>

            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Cari nama brand..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {filteredBrands.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-gray-200 rounded-3xl bg-white">
                <p className="text-sm font-extrabold text-gray-700">Tidak ada brand di hub ini.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {searchKeyword.trim()
                    ? 'Coba kata kunci pencarian lain.'
                    : 'Belum ada brand live untuk hub ini.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredBrands.map((brand) => {
                  const busy = busyId === brand.id;
                  const logoUrl = brand.logo ? resolveMediaUrl(brand.logo) : '';
                  return (
                    <div
                      key={brand.id}
                      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                      <div className="flex justify-center mb-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={brand.name}
                            className="w-16 h-16 object-contain rounded-xl"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                            <span className="text-xl font-black text-gray-400">
                              {brand.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-gray-900 text-center truncate">
                        {brand.name}
                      </h3>
                      <p className="text-[11px] text-gray-500 font-semibold text-center mt-1">
                        {brand.productCount} produk aktif
                      </p>
                      {!isOwnerReadOnly && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setUploadTarget(brand);
                            logoInputRef.current?.click();
                          }}
                          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-extrabold hover:bg-primary-100 disabled:opacity-50 transition-colors"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {brand.logo ? 'Ganti Logo' : 'Upload Logo'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
