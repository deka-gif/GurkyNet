import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, Loader2, Palette, RefreshCw, Search, Upload } from 'lucide-react';
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
};

export const MarketingBrandLogoManagement: React.FC = () => {
  const isOwnerReadOnly = useOwnerReadOnly();
  const [brands, setBrands] = useState<BrandLogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [busyId, setBusyId] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<BrandLogoItem | null>(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketingService.getBrandLogos();
      const list = Array.isArray(res?.data) ? res.data : [];
      setBrands(list as BrandLogoItem[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat daftar brand.';
      toastError('Gagal Memuat', message);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const brand of brands) {
      for (const cat of brand.categories) {
        set.add(cat);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [brands]);

  const filteredBrands = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return brands.filter((brand) => {
      const matchesSearch = !q || brand.name.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'Semua' || brand.categories.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [brands, searchKeyword, selectedCategory]);

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
      setBrands((prev) =>
        prev.map((b) => (b.id === brand.id ? { ...b, logo: newLogo } : b))
      );
      toastSuccess('Berhasil', 'Logo berhasil diperbarui.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upload logo gagal. Silakan coba lagi.';
      toastError('Upload Gagal', message);
    } finally {
      setBusyId(null);
    }
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
                Kelola logo brand yang tampil di E-Wallet, Game, Voucher Digital, dan Langganan
                Digital.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadBrands()}
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
          Perubahan logo di sini langsung berubah di tampilan customer — tidak perlu menunggu deploy
          atau approval apa pun.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-start gap-3">
        <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Hanya brand yang <span className="font-bold">aktif</span> dan memiliki minimal{' '}
          <span className="font-bold">satu produk live/operasional</span> yang muncul di daftar ini
          — bukan katalog mentah vendor Digiflazz/VIP. Filter ini sama dengan gate visibility yang
          dipakai picker brand di sisi customer.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Cari nama brand..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="Semua"
            active={selectedCategory === 'Semua'}
            onClick={() => setSelectedCategory('Semua')}
          />
          {allCategories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            />
          ))}
        </div>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => void handleLogoFileSelected(e)}
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
      ) : filteredBrands.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-gray-200 rounded-3xl bg-white">
          <Palette className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-extrabold text-gray-700">
            Belum ada brand aktif dengan produk live saat ini.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {searchKeyword.trim() || selectedCategory !== 'Semua'
              ? 'Coba ubah filter pencarian atau kategori.'
              : 'Brand akan muncul setelah ada produk operasional di katalog customer.'}
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
                {brand.categories.length > 0 && (
                  <p className="text-[10px] text-gray-400 text-center mt-1 line-clamp-2">
                    {brand.categories.join(' · ')}
                  </p>
                )}
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
  );
};

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-colors ${
        active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-200 hover:text-primary-700'
      }`}
    >
      {label}
    </button>
  );
}
