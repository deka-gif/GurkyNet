import React, { useEffect, useState } from 'react';
import {
  ImageIcon,
  Search,
  Filter,
  Eye,
  Edit,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Layers,
  Smartphone,
  Monitor,
  Maximize2,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { useMarketingStore } from '../../store/marketing.store';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { Media } from '../../types';

export const MarketingBannerManagement: React.FC = () => {
  const user = storageService.getUser();
  const {
    banners,
    bannersPagination,
    bannersLoading,
    bannersError,
    fetchBanners,
    createBanner,
    updateBanner,
    deleteBanner,
  } = useMarketingStore();

  // Filters & Search
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPosition, setSelectedPosition] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Drawer / Preview state
  const [selectedBanner, setSelectedBanner] = useState<any | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'popup'>('desktop');

  // Form State for Add / Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | number | null>(null);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [chooserKey, setChooserKey] = useState<'image' | 'mobileImage' | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formState, setFormState] = useState<{
    title: string;
    position: string;
    description: string;
    link_url: string;
    tagline: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    image_media_id?: number;
    mobile_image_media_id?: number;
    image_media?: Media;
    mobile_image_media?: Media;
    image_url?: string;
    mobile_image_url?: string;
  }>({
    title: '',
    position: 'Homepage Carousel',
    description: '',
    link_url: '',
    tagline: '',
    start_date: '',
    end_date: '',
    is_active: true,
    image_media_id: undefined,
    mobile_image_media_id: undefined,
    image_media: undefined,
    mobile_image_media: undefined,
    image_url: '',
    mobile_image_url: '',
  });

  useEffect(() => {
    fetchBanners({
      search: searchKeyword || undefined,
      status: selectedStatus !== 'All' ? selectedStatus : undefined,
      position: selectedPosition !== 'All' ? selectedPosition : undefined,
      page: currentPage,
    });
  }, [fetchBanners, searchKeyword, selectedStatus, selectedPosition, currentPage]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
  };

  const handleOpenAdd = () => {
    setEditingBannerId(null);
    setFormState({
      title: '',
      position: 'Homepage Carousel',
      description: '',
      link_url: '',
      tagline: '',
      start_date: '',
      end_date: '',
      is_active: true,
      image_media_id: undefined,
      mobile_image_media_id: undefined,
      image_media: undefined,
      mobile_image_media: undefined,
      image_url: '',
      mobile_image_url: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (banner: any) => {
    setEditingBannerId(banner.id);
    setFormState({
      title: banner.title || banner.name || '',
      position: banner.position || 'Homepage Carousel',
      description: banner.description || '',
      link_url: banner.link_url || banner.clickUrl || '',
      tagline: banner.tagline || '',
      start_date: banner.start_date || banner.startDate || '',
      end_date: banner.end_date || banner.endDate || '',
      is_active: banner.is_active ?? banner.status === 'Active',
      image_media_id: banner.image_media_id || banner.imageMediaId,
      mobile_image_media_id: banner.mobile_image_media_id || banner.mobileImageMediaId,
      image_media: banner.image_media || banner.imageMedia,
      mobile_image_media: banner.mobile_image_media || banner.mobileImageMedia,
      image_url: banner.image_url || banner.image || '',
      mobile_image_url: banner.mobile_image_url || banner.mobileImage || '',
    });
    setIsFormModalOpen(true);
  };

  const openMediaChooser = (key: 'image' | 'mobileImage') => {
    setChooserKey(key);
    setIsChooserOpen(true);
  };

  const handleMediaSelect = (url: string, mediaItem?: Media) => {
    if (chooserKey === 'image') {
      setFormState((prev) => ({
        ...prev,
        image_media_id: mediaItem?.id,
        image_media: mediaItem,
        image_url: url,
      }));
    } else if (chooserKey === 'mobileImage') {
      setFormState((prev) => ({
        ...prev,
        mobile_image_media_id: mediaItem?.id,
        mobile_image_media: mediaItem,
        mobile_image_url: url,
      }));
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: formState.title,
      name: formState.title,
      position: formState.position,
      description: formState.description,
      link_url: formState.link_url,
      clickUrl: formState.link_url,
      tagline: formState.tagline,
      start_date: formState.start_date,
      end_date: formState.end_date,
      is_active: formState.is_active,
      image_media_id: formState.image_media_id,
      mobile_image_media_id: formState.mobile_image_media_id,
      image_url: formState.image_url,
      mobile_image_url: formState.mobile_image_url,
    };

    let result;
    if (editingBannerId) {
      result = await updateBanner(editingBannerId, payload);
    } else {
      result = await createBanner(payload);
    }

    if (result.success) {
      setIsFormModalOpen(false);
      showNotification(result.message || 'Banner berhasil disimpan.');
      fetchBanners({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menyimpan banner.');
    }
  };

  const handleDeleteBanner = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteBanner(deleteConfirmId);
    setDeleteConfirmId(null);
    if (result.success) {
      showNotification(result.message || 'Banner berhasil dihapus.');
      fetchBanners({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menghapus banner.');
    }
  };

  const handleToggleActive = async (banner: any) => {
    const result = await updateBanner(banner.id, {
      is_active: !banner.is_active,
    });
    if (result.success) {
      showNotification(`Status banner "${banner.title || banner.name}" diperbarui.`);
      fetchBanners({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal mengubah status banner.');
    }
  };

  const totalBanners = bannersPagination?.total ?? banners.length;
  const activeBanners = banners.filter((b) => b.is_active || b.status === 'Active').length;
  const scheduledBanners = banners.filter((b) => b.status === 'Scheduled').length;
  const expiredBanners = banners.filter((b) => b.status === 'Expired').length;

  const getStatusBadge = (banner: any) => {
    const status = banner.status || (banner.is_active ? 'Active' : 'Hidden');
    switch (status) {
      case 'Active':
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Active
          </span>
        );
      case 'Scheduled':
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Scheduled
          </span>
        );
      case 'Draft':
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            Draft
          </span>
        );
      case 'Hidden':
      case 'hidden':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            <EyeOff className="w-3.5 h-3.5 text-purple-600" />
            Hidden
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200">
            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-pink-950 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-pink-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 backdrop-blur-xs text-[11px] font-bold text-pink-200 border border-pink-400/30">
              <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
              GurkyNet Marketing CMS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Homepage Banner Management
            </h1>
            <p className="text-xs sm:text-sm text-pink-100/90 leading-relaxed max-w-2xl">
              Pengelolaan spanduk promosi visual, banner carousel homepage, header kategori, dan popup modal pemberitahuan pada aplikasi publik GurkyNet.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenAdd()}
              className="px-4 py-2.5 bg-pink-600 text-white rounded-2xl font-black text-xs shadow-md hover:bg-pink-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Banner</span>
            </button>
            <button
              onClick={() => {
                fetchBanners({ page: currentPage });
                showNotification('Daftar banner berhasil diperbarui.');
              }}
              disabled={bannersLoading}
              className="px-4 py-2.5 bg-white text-slate-950 rounded-2xl font-black text-xs shadow-md hover:bg-pink-50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-pink-600 ${bannersLoading ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>
      </div>

      {bannersError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{bannersError}</span>
          </div>
          <button
            onClick={() => fetchBanners({ page: currentPage })}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Total Banners</span>
            <ImageIcon className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalBanners} Spanduk</div>
          <div className="text-[11px] text-gray-500 font-medium">Terdaftar dalam pustaka promosi</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-2 bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase">
            <span>Active Banners</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{activeBanners} Tayang</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Sedang ditampilkan pada aplikasi</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm space-y-2 bg-gradient-to-br from-blue-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase">
            <span>Scheduled Banners</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800">{scheduledBanners} Terjadwal</div>
          <div className="text-[11px] text-blue-700 font-semibold">Akan tayang otomatis sesuai tanggal</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-2 bg-gradient-to-br from-gray-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Expired Banners</span>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-700">{expiredBanners} Kedaluwarsa</div>
          <div className="text-[11px] text-gray-500 font-medium">Selesai masa tayang & diarsipkan</div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-sm text-gray-900">
            <Filter className="w-4 h-4 text-pink-600" />
            <span>Filter & Keyword Search</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {banners.length} of {totalBanners} Banners
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-gray-500 uppercase">Keyword Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama banner, ID, deskripsi..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-gray-500 uppercase">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none bg-white font-medium text-gray-800"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Hidden">Hidden</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-gray-500 uppercase">Banner Position</label>
            <select
              value={selectedPosition}
              onChange={(e) => {
                setSelectedPosition(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none bg-white font-medium text-gray-800"
            >
              <option value="All">All Positions</option>
              <option value="Homepage Carousel">Homepage Carousel</option>
              <option value="Category Header">Category Header</option>
              <option value="Popup Modal">Popup Modal</option>
              <option value="Footer Banner">Footer Banner</option>
              <option value="Sidebar Banner">Sidebar Banner</option>
            </select>
          </div>
        </div>
      </div>

      {/* BANNER TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Promotional Banner Library</h2>
            <p className="text-xs text-gray-500">Daftar lengkap spanduk promosi visual yang terdaftar di sistem</p>
          </div>
          <span className="text-xs font-bold text-pink-700 bg-pink-50 px-3 py-1 rounded-lg border border-pink-100">
            {banners.length} Items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Banner Name</th>
                <th className="py-3.5 px-4">Position</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Start Date</th>
                <th className="py-3.5 px-4">End Date</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {bannersLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-pink-500" />
                    Memuat data banner...
                  </td>
                </tr>
              ) : banners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    Tidak ada banner yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-gray-900 max-w-xs truncate">{banner.title || banner.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{banner.id}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-[10px] inline-flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-500" />
                        {banner.position || 'Homepage Carousel'}
                      </span>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(banner)}</td>
                    <td className="py-4 px-4 font-mono text-gray-600 text-[11px]">{banner.start_date || banner.startDate || '-'}</td>
                    <td className="py-4 px-4 font-mono text-gray-600 text-[11px]">{banner.end_date || banner.endDate || '-'}</td>
                    <td className="py-4 px-4">
                      <div className="font-mono text-gray-600 text-[11px]">{banner.updated_at || banner.lastUpdated || '-'}</div>
                      <div className="text-[10px] text-gray-400">by {banner.updated_by || banner.updatedBy || 'System'}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                        <button
                          onClick={() => setSelectedBanner(banner)}
                          title="Preview Banner"
                          className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:text-pink-600 shadow-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(banner)}
                          title="Edit Banner"
                          className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:text-blue-600 shadow-xs transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(banner)}
                          title={banner.is_active ? 'Sembunyikan Banner' : 'Tampilkan Banner'}
                          className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:text-purple-600 shadow-xs transition"
                        >
                          {banner.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(banner.id)}
                          title="Hapus Banner"
                          className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:text-rose-600 shadow-xs transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {bannersPagination && bannersPagination.lastPage > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Halaman <strong>{bannersPagination.currentPage}</strong> dari <strong>{bannersPagination.lastPage}</strong> (Total {bannersPagination.total} item)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={bannersPagination.currentPage <= 1 || bannersLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                disabled={bannersPagination.currentPage >= bannersPagination.lastPage || bannersLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BANNER PREVIEWS SECTION */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-pink-400 font-extrabold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Multi-Device Banner Display Previews</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulasi tampilan visual banner di berbagai versi viewport perangkat aplikasi GurkyNet
            </p>
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-slate-800 border border-slate-700 text-xs">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition ${
                previewMode === 'desktop' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition ${
                previewMode === 'mobile' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile App
            </button>
            <button
              onClick={() => setPreviewMode('popup')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition ${
                previewMode === 'popup' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Popup Modal
            </button>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col items-center justify-center min-h-[260px]">
          {previewMode === 'desktop' && (
            <div className="w-full max-w-4xl space-y-3">
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>[ Desktop Header Banner Carousel - Aspect Ratio 16:9 / Wide ]</span>
                <span className="text-pink-400 font-bold">Resolution: 1920 x 600 px</span>
              </div>
              <div className="w-full rounded-2xl p-8 bg-gradient-to-r from-purple-900 via-pink-900 to-rose-950 border border-pink-500/30 shadow-2xl relative overflow-hidden space-y-4">
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-pink-500/30 text-pink-200 border border-pink-400/40 inline-block uppercase">
                  MERDEKA 50% CASHBACK
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white max-w-lg leading-tight">
                  Promo Kemerdekaan RI ke-81: Diskon & Cashback Saldo PPOB Hingga 50%
                </h3>
                <p className="text-xs text-pink-100/80 max-w-md">
                  Gunakan kode promo <span className="font-mono font-bold text-amber-300">MERDEKA50</span> saat transaksi pulsa, paket data, & token PLN.
                </p>
              </div>
            </div>
          )}

          {previewMode === 'mobile' && (
            <div className="w-full max-w-xs space-y-3">
              <div className="text-[10px] font-mono text-slate-400 text-center">
                [ Mobile App Screen Card Banner ]
              </div>
              <div className="w-full rounded-3xl p-5 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-950 border border-purple-500/30 shadow-2xl space-y-3 text-center">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-300/30 uppercase">
                  GURKYGAJIAN SPECIAL
                </span>
                <h3 className="text-sm font-black text-white leading-snug">
                  Cashback Rp 25.000 Pembayaran Tagihan Akhir Bulan
                </h3>
              </div>
            </div>
          )}

          {previewMode === 'popup' && (
            <div className="w-full max-w-md space-y-3">
              <div className="text-[10px] font-mono text-slate-400 text-center">
                [ Center Screen System Notification Popup Modal ]
              </div>
              <div className="w-full rounded-3xl p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 text-center relative">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">Pemberitahuan Pemeliharaan Sistem</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Provider PLN Prabayar sedang mengalami perbaikan berkala.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedBanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 transition-opacity">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-pink-700 font-bold">{selectedBanner.id}</span>
                  {getStatusBadge(selectedBanner)}
                </div>
                <h2 className="text-lg font-black text-gray-900">{selectedBanner.title || selectedBanner.name}</h2>
              </div>
              <button
                onClick={() => setSelectedBanner(null)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs text-gray-700">
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Visual Banner Preview
                </label>
                <div className="w-full min-h-[160px] rounded-2xl p-6 text-white shadow-md bg-gradient-to-br from-purple-900 via-pink-900 to-slate-900 space-y-3 relative overflow-hidden flex flex-col justify-between">
                  {(selectedBanner.image_url || selectedBanner.image) && (
                    <img
                      src={selectedBanner.image_url || selectedBanner.image}
                      alt="Banner Content"
                      className="absolute inset-0 w-full h-full object-cover opacity-50 z-0"
                    />
                  )}
                  <div className="relative z-10 space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-white/20 text-white border border-white/30 uppercase inline-block">
                      {selectedBanner.tagline || 'PROMOTION'}
                    </span>
                    <h3 className="text-base font-black leading-snug">{selectedBanner.title || selectedBanner.name}</h3>
                    <p className="text-[11px] text-white/85">{selectedBanner.description}</p>
                  </div>
                  <div className="relative z-10 pt-2 border-t border-white/10 flex justify-between items-center text-[9px] font-mono text-white/70">
                    <span>Click Target: {selectedBanner.link_url || selectedBanner.clickUrl || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Position</span>
                  <span className="font-extrabold text-gray-900">{selectedBanner.position || 'Homepage Carousel'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Start Date</span>
                  <span className="font-mono font-bold text-gray-800">{selectedBanner.start_date || selectedBanner.startDate || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">End Date</span>
                  <span className="font-mono font-bold text-gray-800">{selectedBanner.end_date || selectedBanner.endDate || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Status</span>
                  <span className="font-bold text-gray-800">{selectedBanner.is_active ? 'Active' : 'Non-Aktif'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 sticky bottom-0 bg-white z-10 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedBanner(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const b = selectedBanner;
                  setSelectedBanner(null);
                  handleOpenEdit(b);
                }}
                className="px-4 py-2.5 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition shadow-sm"
              >
                Edit Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT BANNER MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">
                    {editingBannerId ? 'Edit Banner' : 'Tambah Banner Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">Ubah spanduk dan pilih media dari Library.</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Judul / Nama Banner</label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Position</label>
                  <select
                    value={formState.position}
                    onChange={(e) => setFormState((prev) => ({ ...prev, position: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  >
                    <option value="Homepage Carousel">Homepage Carousel</option>
                    <option value="Category Header">Category Header</option>
                    <option value="Popup Modal">Popup Modal</option>
                    <option value="Footer Banner">Footer Banner</option>
                    <option value="Sidebar Banner">Sidebar Banner</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tagline</label>
                  <input
                    type="text"
                    value={formState.tagline}
                    onChange={(e) => setFormState((prev) => ({ ...prev, tagline: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formState.start_date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formState.end_date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Target URL</label>
                <input
                  type="text"
                  value={formState.link_url}
                  onChange={(e) => setFormState((prev) => ({ ...prev, link_url: e.target.value }))}
                  placeholder="https://gurkynet.id/promo/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Deskripsi</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <ImageIcon className="w-4 h-4 text-pink-500" />
                  <span className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider">Integrasi Media Library</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Banner Image</label>
                    {formState.image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={formState.image_url}
                          alt="Banner"
                          className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                        />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gray-800 truncate max-w-[80px]">
                            {formState.image_media?.filename || 'Gambar Banner'}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMediaChooser('image')}
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-pink-600 transition"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormState((prev) => ({
                                  ...prev,
                                  image_url: '',
                                  image_media_id: undefined,
                                  image_media: undefined,
                                }));
                              }}
                              className="p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openMediaChooser('image')}
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-pink-500 hover:bg-pink-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-pink-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-pink-500 transition" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Pilih Gambar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Mobile Banner Image</label>
                    {formState.mobile_image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={formState.mobile_image_url}
                          alt="Mobile Banner"
                          className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                        />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gray-800 truncate max-w-[80px]">
                            {formState.mobile_image_media?.filename || 'Gambar Mobile'}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMediaChooser('mobileImage')}
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-pink-600 transition"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormState((prev) => ({
                                  ...prev,
                                  mobile_image_url: '',
                                  mobile_image_media_id: undefined,
                                  mobile_image_media: undefined,
                                }));
                              }}
                              className="p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openMediaChooser('mobileImage')}
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-pink-500 hover:bg-pink-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-pink-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-pink-500 transition" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Pilih Mobile</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bannersLoading}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {editingBannerId ? 'Simpan Perubahan' : 'Buat Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-gray-900 text-base">Hapus Banner?</h3>
              <p className="text-xs text-gray-500">
                Apakah Anda yakin ingin menghapus banner ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteBanner}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Chooser Modal */}
      <MediaChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
};

