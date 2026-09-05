import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Percent,
  Gift,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  X,
  RefreshCw,
  Zap,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { useMarketingStore } from '../../store/marketing.store';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { Media } from '../../types';
import { resolveMediaUrl, resolveMediaSrc } from '../../utils/mediaUrl';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

export const MarketingPromotionManagement: React.FC = () => {
  const user = storageService.getUser();
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();
  const {
    promotions,
    promotionsPagination,
    promotionsLoading,
    promotionsError,
    fetchPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
  } = useMarketingStore();

  // Filter States
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected Detail Drawer
  const [selectedPromo, setSelectedPromo] = useState<any | null>(null);

  // Form & Media Selection states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | number | null>(null);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [chooserKey, setChooserKey] = useState<'image' | 'mobileImage' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  const [formState, setFormState] = useState<{
    title: string;
    type: string;
    category: string;
    description: string;
    discount_value: string;
    min_transaction: string;
    usage_limit: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    image_media_id?: number;
    mobile_image_media_id?: number;
    image_media?: Media;
    mobile_image_media?: Media;
    image_url?: string;
    mobile_image_url?: string;
    terms_and_conditions?: string[];
  }>({
    title: '',
    type: 'Discount',
    category: 'PLN Token & Data',
    description: '',
    discount_value: '',
    min_transaction: '',
    usage_limit: '',
    start_date: '',
    end_date: '',
    is_active: true,
    image_media_id: undefined,
    mobile_image_media_id: undefined,
    image_media: undefined,
    mobile_image_media: undefined,
    image_url: '',
    mobile_image_url: '',
    terms_and_conditions: [],
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPromotions({
      search: keywordSearch || undefined,
      type: typeFilter !== 'All' ? typeFilter : undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      page: currentPage,
    });
  }, [fetchPromotions, keywordSearch, typeFilter, statusFilter, categoryFilter, currentPage]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
  };

  const handleOpenAdd = () => {
    setEditingPromoId(null);
    setFormState({
      title: '',
      type: 'Discount',
      category: 'PLN Token & Data',
      description: '',
      discount_value: '',
      min_transaction: '',
      usage_limit: '',
      start_date: '',
      end_date: '',
      is_active: true,
      image_media_id: undefined,
      mobile_image_media_id: undefined,
      image_media: undefined,
      mobile_image_media: undefined,
      image_url: '',
      mobile_image_url: '',
      terms_and_conditions: [],
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (promo: any) => {
    setEditingPromoId(promo.id);
    setFormState({
      title: promo.title || promo.name || '',
      type: promo.type || 'Discount',
      category: promo.category || 'PLN Token & Data',
      description: promo.description || '',
      discount_value: promo.discount_value || promo.discountValue || '',
      min_transaction: promo.min_transaction || promo.minTransaction || '',
      usage_limit: promo.usage_limit || promo.usageLimit || '',
      start_date: promo.start_date || promo.startDate || '',
      end_date: promo.end_date || promo.endDate || '',
      is_active: promo.is_active ?? promo.status === 'Active',
      image_media_id: promo.image_media_id || promo.imageMediaId,
      mobile_image_media_id: promo.mobile_image_media_id || promo.mobileImageMediaId,
      image_media: promo.image_media || promo.imageMedia,
      mobile_image_media: promo.mobile_image_media || promo.mobileImageMedia,
      image_url: promo.image_url || promo.image || '',
      mobile_image_url: promo.mobile_image_url || promo.mobileImage || '',
      terms_and_conditions: promo.terms_and_conditions || promo.termsAndConditions || [],
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

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: formState.title,
      name: formState.title,
      type: formState.type,
      category: formState.category,
      description: formState.description,
      discount_value: formState.discount_value,
      discountValue: formState.discount_value,
      min_transaction: formState.min_transaction,
      minTransaction: formState.min_transaction,
      usage_limit: formState.usage_limit,
      usageLimit: formState.usage_limit,
      start_date: formState.start_date,
      end_date: formState.end_date,
      is_active: formState.is_active,
      image_media_id: formState.image_media_id,
      mobile_image_media_id: formState.mobile_image_media_id,
      image_url: formState.image_url,
      mobile_image_url: formState.mobile_image_url,
    };

    let result;
    if (editingPromoId) {
      result = await updatePromotion(editingPromoId, payload);
    } else {
      result = await createPromotion(payload);
    }

    if (result.success) {
      setIsFormModalOpen(false);
      showNotification(result.message || 'Promosi berhasil disimpan.');
      fetchPromotions({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menyimpan promosi.');
    }
  };

  const handleDeletePromo = async () => {
    if (!deleteConfirmId) return;
    const result = await deletePromotion(deleteConfirmId);
    setDeleteConfirmId(null);
    if (result.success) {
      showNotification(result.message || 'Promosi berhasil dihapus.');
      fetchPromotions({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menghapus promosi.');
    }
  };

  const totalPromotions = promotionsPagination?.total ?? promotions.length;
  const activeCount = promotions.filter((p) => p.is_active || p.status === 'Active').length;
  const scheduledCount = promotions.filter((p) => p.status === 'Scheduled').length;
  const expiredCount = promotions.filter((p) => p.status === 'Expired').length;
  const draftCount = promotions.filter((p) => p.status === 'Draft').length;

  const getStatusBadge = (promo: any) => {
    const status = promo.status || (promo.is_active ? 'Active' : 'Paused');
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
      case 'Paused':
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" />
            Paused
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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Discount':
        return (
          <span className="px-2.5 py-0.5 rounded bg-pink-50 text-pink-700 font-extrabold text-[10px] border border-pink-100 inline-flex items-center gap-1">
            <Percent className="w-3 h-3 text-pink-600" />
            Discount
          </span>
        );
      case 'Cashback':
        return (
          <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-100 inline-flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            Cashback
          </span>
        );
      case 'Bonus':
        return (
          <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 font-extrabold text-[10px] border border-amber-100 inline-flex items-center gap-1">
            <Gift className="w-3 h-3 text-amber-600" />
            Bonus
          </span>
        );
      case 'Free Admin Fee':
        return (
          <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-100 inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-600" />
            Free Admin Fee
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[10px] border border-purple-100 inline-flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-600" />
            {type || 'Bundle'}
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
      <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-pink-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-purple-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 backdrop-blur-xs text-[11px] font-bold text-purple-200 border border-purple-400/30">
              <Megaphone className="w-3.5 h-3.5 text-pink-400" />
              GurkyNet Marketing Promotion Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Promotion
            </h1>
            <p className="text-xs sm:text-sm text-purple-100/90 leading-relaxed max-w-2xl">
              Kelola campaign promosi dan diskon.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isOwnerReadOnly && (
              <button
                onClick={() => handleOpenAdd()}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-2xl font-black text-xs shadow-md hover:bg-purple-700 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Promosi</span>
              </button>
            )}
            <button
              onClick={() => {
                fetchPromotions({ page: currentPage });
                showNotification('Data promosi telah direfresh.');
              }}
              disabled={promotionsLoading}
              className="px-4 py-2.5 bg-white text-slate-950 rounded-2xl font-black text-xs shadow-md hover:bg-purple-50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-purple-600 ${promotionsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {promotionsError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{promotionsError}</span>
          </div>
          <button
            onClick={() => fetchPromotions({ page: currentPage })}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-2 bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase">
            <span>Active Promotions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{activeCount} Kampanye</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Aktif berlaku pada aplikasi publik</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm space-y-2 bg-gradient-to-br from-blue-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase">
            <span>Scheduled Promotions</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800">{scheduledCount} Terjadwal</div>
          <div className="text-[11px] text-blue-700 font-semibold">Rilis otomatis sesuai jadwal</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-2 bg-gradient-to-br from-gray-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Expired Promotions</span>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-700">{expiredCount} Kedaluwarsa</div>
          <div className="text-[11px] text-gray-500 font-medium">Masa berlaku kampanye telah selesai</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm space-y-2 bg-gradient-to-br from-amber-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 uppercase">
            <span>Draft Promotions</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">{draftCount} Draf</div>
          <div className="text-[11px] text-amber-700 font-semibold">Membutuhkan verifikasi lanjutan</div>
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-extrabold text-gray-900">Promotion Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {promotions.length} of {totalPromotions} Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Promotion Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="All">Semua Tipe Promo</option>
              <option value="Discount">Discount</option>
              <option value="Cashback">Cashback</option>
              <option value="Bonus">Bonus</option>
              <option value="Free Admin Fee">Free Admin Fee</option>
              <option value="Bundle">Bundle</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Paused">Paused</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="All">Semua Kategori</option>
              <option value="PLN">PLN Token</option>
              <option value="Pulsa">Pulsa & Data</option>
              <option value="Game">Game Voucher</option>
              <option value="E-Wallet">E-Wallet</option>
              <option value="BPJS">BPJS & PPOB</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keyword Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={keywordSearch}
                onChange={(e) => {
                  setKeywordSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama promo, ID, deskripsi..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PROMOTION TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Promotion Campaigns Table</h2>
            <p className="text-xs text-gray-500">Klik tombol Preview untuk membuka Detail Drawer & Syarat Ketentuan</p>
          </div>
          <span className="text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 font-mono">
            {promotions.length} Campaigns Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Promotion Name</th>
                <th className="py-3.5 px-4">Promotion Type</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Start Date</th>
                <th className="py-3.5 px-4">End Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {promotionsLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                    Memuat data promosi...
                  </td>
                </tr>
              ) : promotions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Tidak ada data kampanye promosi yang memenuhi kriteria filter.
                  </td>
                </tr>
              ) : (
                promotions.map((item) => (
                  <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-gray-900 max-w-xs truncate">{item.title || item.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{item.id}</div>
                    </td>
                    <td className="py-3.5 px-4">{getTypeBadge(item.type || 'Discount')}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-[10px]">
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">{item.start_date || item.startDate || '-'}</td>
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">{item.end_date || item.endDate || '-'}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(item)}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] text-gray-600">{item.updated_at || item.lastUpdated || '-'}</div>
                      <div className="text-[10px] text-gray-400">by {item.updated_by || item.updatedBy || 'System'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPromo(item)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-purple-600 hover:text-white text-gray-600 transition"
                          title="Preview Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isOwnerReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                            title="Edit Promotion"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isOwnerReadOnly && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-rose-600 hover:text-white text-gray-600 transition"
                            title="Hapus Promotion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {promotionsPagination && promotionsPagination.lastPage > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Halaman <strong>{promotionsPagination.currentPage}</strong> dari <strong>{promotionsPagination.lastPage}</strong> (Total {promotionsPagination.total} item)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={promotionsPagination.currentPage <= 1 || promotionsLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                disabled={promotionsPagination.currentPage >= promotionsPagination.lastPage || promotionsLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedPromo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-pink-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedPromo.id}
                  </span>
                  {getStatusBadge(selectedPromo)}
                </div>
                <h2 className="text-lg font-extrabold">{selectedPromo.title || selectedPromo.name}</h2>
              </div>
              <button
                onClick={() => setSelectedPromo(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              {(selectedPromo.image_url || selectedPromo.image) && (
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Promotion Image</span>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 aspect-video">
                    <img
                      src={resolveMediaSrc(selectedPromo.image_url || selectedPromo.image)}
                      alt="Promotion Banner"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Promotion Type</span>
                  <div className="mt-1">{getTypeBadge(selectedPromo.type || 'Discount')}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Applicable Categories</span>
                  <span className="font-extrabold text-gray-900">{selectedPromo.category || 'General'}</span>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Deskripsi Kampanye:</h3>
                <p className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed font-medium">
                  {selectedPromo.description || '-'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <span className="text-[10px] text-purple-600 font-bold block uppercase">Discount Value</span>
                  <span className="font-mono font-black text-purple-900 text-xs mt-0.5 block">
                    {selectedPromo.discount_value || selectedPromo.discountValue || '-'}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-blue-600 font-bold block uppercase">Min Transaction</span>
                  <span className="font-mono font-black text-blue-900 text-xs mt-0.5 block">
                    {selectedPromo.min_transaction || selectedPromo.minTransaction || '-'}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 font-bold block uppercase">Usage Limit</span>
                  <span className="font-mono font-black text-emerald-900 text-xs mt-0.5 block">
                    {selectedPromo.usage_limit || selectedPromo.usageLimit || '-'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Start Date</span>
                  <div className="font-mono font-extrabold text-gray-900 mt-0.5">{selectedPromo.start_date || selectedPromo.startDate || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">End Date</span>
                  <div className="font-mono font-extrabold text-gray-900 mt-0.5">{selectedPromo.end_date || selectedPromo.endDate || '-'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
              {!isOwnerReadOnly && (
                <button
                  onClick={() => {
                    const p = selectedPromo;
                    setSelectedPromo(null);
                    handleOpenEdit(p);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4 text-purple-700" />
                  <span>Edit Promo</span>
                </button>
              )}

              <button
                onClick={() => setSelectedPromo(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PROMOTION MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">
                    {editingPromoId ? 'Edit Promosi' : 'Tambah Promosi Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">Atur promo dan pilih konten visual dari Library.</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Nama Kampanye</label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tipe Promo</label>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  >
                    <option value="Discount">Discount</option>
                    <option value="Cashback">Cashback</option>
                    <option value="Bonus">Bonus</option>
                    <option value="Free Admin Fee">Free Admin Fee</option>
                    <option value="Bundle">Bundle</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Kategori Target</label>
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Contoh: PLN Token & Data"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Discount Value</label>
                  <input
                    type="text"
                    value={formState.discount_value}
                    onChange={(e) => setFormState((prev) => ({ ...prev, discount_value: e.target.value }))}
                    placeholder="50% (Max Rp 15k)"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Min Transaksi</label>
                  <input
                    type="text"
                    value={formState.min_transaction}
                    onChange={(e) => setFormState((prev) => ({ ...prev, min_transaction: e.target.value }))}
                    placeholder="Rp 30.000"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Batas Kuota</label>
                  <input
                    type="text"
                    value={formState.usage_limit}
                    onChange={(e) => setFormState((prev) => ({ ...prev, usage_limit: e.target.value }))}
                    placeholder="10.000 / Hari"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
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
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formState.end_date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Deskripsi Kampanye</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <ImageIcon className="w-4 h-4 text-purple-500" />
                  <span className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider">Integrasi Media Library</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Promo Image</label>
                    {formState.image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={resolveMediaUrl(formState.image_url)}
                          alt="Promo"
                          className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                        />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gray-800 truncate max-w-[80px]">
                            {formState.image_media?.filename || 'Gambar Promo'}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMediaChooser('image')}
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-purple-600 transition"
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
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-purple-500 hover:bg-purple-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-purple-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Pilih Gambar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Mobile Promo Image</label>
                    {formState.mobile_image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={resolveMediaUrl(formState.mobile_image_url)}
                          alt="Mobile Promo"
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
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-purple-600 transition"
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
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-purple-500 hover:bg-purple-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-purple-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition" />
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
                  disabled={promotionsLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {editingPromoId ? 'Simpan Perubahan' : 'Buat Promosi'}
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
              <h3 className="font-extrabold text-gray-900 text-base">Hapus Promosi?</h3>
              <p className="text-xs text-gray-500">
                Apakah Anda yakin ingin menghapus promosi ini? Tindakan ini tidak dapat dibatalkan.
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
                onClick={handleDeletePromo}
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

