import React, { useEffect, useState } from 'react';
import {
  Ticket,
  Percent,
  Tag,
  Search,
  Filter,
  Eye,
  Edit,
  Ban,
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
  Image as ImageIcon
} from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { useMarketingStore } from '../../store/marketing.store';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { Media } from '../../types';
import { resolveMediaUrl, resolveMediaSrc } from '../../utils/mediaUrl';

export const MarketingVoucherManagement: React.FC = () => {
  const user = storageService.getUser();
  const {
    vouchers,
    vouchersPagination,
    vouchersLoading,
    vouchersError,
    fetchVouchers,
    createVoucher,
    updateVoucher,
    deleteVoucher,
  } = useMarketingStore();

  // Filter States
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected Voucher Detail Drawer
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);

  // Form & Media Selection states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | number | null>(null);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [chooserKey, setChooserKey] = useState<'image' | 'mobileImage' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);

  const [formState, setFormState] = useState<{
    code: string;
    title: string;
    type: string;
    category: string;
    description: string;
    discount_value: string;
    max_discount: string;
    min_transaction: string;
    claim_limit: number;
    start_date: string;
    expiry_date: string;
    is_active: boolean;
    image_media_id?: number;
    mobile_image_media_id?: number;
    image_media?: Media;
    mobile_image_media?: Media;
    image_url?: string;
    mobile_image_url?: string;
  }>({
    code: '',
    title: '',
    type: 'Percentage Discount',
    category: 'PLN Token & Data',
    description: '',
    discount_value: '',
    max_discount: '',
    min_transaction: '',
    claim_limit: 1000,
    start_date: '',
    expiry_date: '',
    is_active: true,
    image_media_id: undefined,
    mobile_image_media_id: undefined,
    image_media: undefined,
    mobile_image_media: undefined,
    image_url: '',
    mobile_image_url: '',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchVouchers({
      search: keywordSearch || undefined,
      type: typeFilter !== 'All' ? typeFilter : undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      page: currentPage,
    });
  }, [fetchVouchers, keywordSearch, typeFilter, statusFilter, categoryFilter, currentPage]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
  };

  const handleOpenAdd = () => {
    setEditingVoucherId(null);
    setFormState({
      code: '',
      title: '',
      type: 'Percentage Discount',
      category: 'PLN Token & Data',
      description: '',
      discount_value: '',
      max_discount: '',
      min_transaction: '',
      claim_limit: 1000,
      start_date: '',
      expiry_date: '',
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

  const handleOpenEdit = (vouch: any) => {
    setEditingVoucherId(vouch.id);
    setFormState({
      code: vouch.code || '',
      title: vouch.title || vouch.name || '',
      type: vouch.type || 'Percentage Discount',
      category: vouch.category || 'PLN Token & Data',
      description: vouch.description || '',
      discount_value: vouch.discount_value || vouch.discountValue || '',
      max_discount: vouch.max_discount || vouch.maxDiscount || '',
      min_transaction: vouch.min_transaction || vouch.minTransaction || '',
      claim_limit: vouch.claim_limit || vouch.claimLimit || 1000,
      start_date: vouch.start_date || vouch.startDate || '',
      expiry_date: vouch.expiry_date || vouch.expiryDate || '',
      is_active: vouch.is_active ?? vouch.status === 'Active',
      image_media_id: vouch.image_media_id || vouch.imageMediaId,
      mobile_image_media_id: vouch.mobile_image_media_id || vouch.mobileImageMediaId,
      image_media: vouch.image_media || vouch.imageMedia,
      mobile_image_media: vouch.mobile_image_media || vouch.mobileImageMedia,
      image_url: vouch.image_url || vouch.image || '',
      mobile_image_url: vouch.mobile_image_url || vouch.mobileImage || '',
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

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: formState.code,
      title: formState.title,
      name: formState.title,
      type: formState.type,
      category: formState.category,
      description: formState.description,
      discount_value: formState.discount_value,
      discountValue: formState.discount_value,
      max_discount: formState.max_discount,
      maxDiscount: formState.max_discount,
      min_transaction: formState.min_transaction,
      minTransaction: formState.min_transaction,
      claim_limit: formState.claim_limit,
      claimLimit: formState.claim_limit,
      start_date: formState.start_date,
      expiry_date: formState.expiry_date,
      expiryDate: formState.expiry_date,
      is_active: formState.is_active,
      image_media_id: formState.image_media_id,
      mobile_image_media_id: formState.mobile_image_media_id,
      image_url: formState.image_url,
      mobile_image_url: formState.mobile_image_url,
    };

    let result;
    if (editingVoucherId) {
      result = await updateVoucher(editingVoucherId, payload);
    } else {
      result = await createVoucher(payload);
    }

    if (result.success) {
      setIsFormModalOpen(false);
      showNotification(result.message || 'Voucher berhasil disimpan.');
      fetchVouchers({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menyimpan voucher.');
    }
  };

  const handleDeleteVoucher = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteVoucher(deleteConfirmId);
    setDeleteConfirmId(null);
    if (result.success) {
      showNotification(result.message || 'Voucher berhasil dihapus.');
      fetchVouchers({ page: currentPage });
    } else {
      showNotification(result.message || 'Gagal menghapus voucher.');
    }
  };

  const totalVouchers = vouchersPagination?.total ?? vouchers.length;
  const activeCount = vouchers.filter((v) => v.is_active || v.status === 'Active').length;
  const scheduledCount = vouchers.filter((v) => v.status === 'Scheduled').length;
  const expiredCount = vouchers.filter((v) => v.status === 'Expired').length;
  const totalClaims = vouchers.reduce((acc, curr) => acc + (curr.claims_used || curr.claimsUsed || 0), 0);

  const getStatusBadge = (vouch: any) => {
    const status = vouch.status || (vouch.is_active ? 'Active' : 'Disabled');
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
      case 'Disabled':
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban className="w-3.5 h-3.5 text-rose-600" />
            Disabled
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
      case 'Percentage Discount':
        return (
          <span className="px-2.5 py-0.5 rounded bg-pink-50 text-pink-700 font-extrabold text-[10px] border border-pink-100 inline-flex items-center gap-1">
            <Percent className="w-3 h-3 text-pink-600" />
            Percentage Discount
          </span>
        );
      case 'Fixed Discount':
        return (
          <span className="px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[10px] border border-purple-100 inline-flex items-center gap-1">
            <Tag className="w-3 h-3 text-purple-600" />
            Fixed Discount
          </span>
        );
      case 'Cashback':
        return (
          <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-100 inline-flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            Cashback
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-100 inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-600" />
            {type || 'Free Admin Fee'}
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
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-indigo-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-xs text-[11px] font-bold text-indigo-200 border border-indigo-400/30">
              <Ticket className="w-3.5 h-3.5 text-purple-400" />
              GurkyNet Marketing Voucher & Coupon Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Voucher Management Center
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
              Pengelolaan kode kupon diskon, batas kuota penggunaan, pengaturan batas minimum transaksi, dan aktivasi klaim otomatis pelanggan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-md hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Voucher</span>
            </button>
            <button
              onClick={() => {
                fetchVouchers({ page: currentPage });
                showNotification('Data voucher telah direfresh.');
              }}
              disabled={vouchersLoading}
              className="px-4 py-2.5 bg-white text-slate-950 rounded-2xl font-black text-xs shadow-md hover:bg-indigo-50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${vouchersLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {vouchersError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{vouchersError}</span>
          </div>
          <button
            onClick={() => fetchVouchers({ page: currentPage })}
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
            <span>Active Vouchers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{activeCount} Kode Kupon</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Siap digunakan di checkout</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm space-y-2 bg-gradient-to-br from-blue-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase">
            <span>Scheduled Vouchers</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800">{scheduledCount} Terjadwal</div>
          <div className="text-[11px] text-blue-700 font-semibold">Rilis otomatis sesuai waktu</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-2 bg-gradient-to-br from-gray-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Expired Vouchers</span>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-700">{expiredCount} Kedaluwarsa</div>
          <div className="text-[11px] text-gray-500 font-medium">Masa klaim telah habis</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm space-y-2 bg-gradient-to-br from-purple-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700 uppercase">
            <span>Total Claim Volume</span>
            <Ticket className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-800">{totalClaims.toLocaleString('id-ID')} Klaim</div>
          <div className="text-[11px] text-purple-700 font-semibold">Total penggunaan oleh pengguna</div>
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-extrabold text-gray-900">Voucher Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {vouchers.length} of {totalVouchers} Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Voucher Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">Semua Tipe Diskon</option>
              <option value="Percentage Discount">Percentage Discount</option>
              <option value="Fixed Discount">Fixed Discount</option>
              <option value="Cashback">Cashback</option>
              <option value="Free Admin Fee">Free Admin Fee</option>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
              <option value="Disabled">Disabled</option>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                placeholder="Cari kode, nama kupon, deskripsi..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* VOUCHERS TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Voucher Catalog Table</h2>
            <p className="text-xs text-gray-500">Klik ikon Preview untuk membuka Detail Drawer & Informasi Kuota Klaim</p>
          </div>
          <span className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono">
            {vouchers.length} Vouchers Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Code & Voucher Name</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Discount Value</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Claims Progress</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {vouchersLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Memuat data voucher...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Tidak ada data voucher yang memenuhi kriteria filter.
                  </td>
                </tr>
              ) : (
                vouchers.map((item) => {
                  const claimsUsed = item.claims_used || item.claimsUsed || 0;
                  const claimLimit = item.claim_limit || item.claimLimit || 1;
                  const usagePercent = Math.min(100, Math.round((claimsUsed / claimLimit) * 100));

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded font-mono font-black bg-slate-900 text-yellow-300 text-[11px] mb-1">
                          {item.code || item.id}
                        </span>
                        <div className="font-extrabold text-gray-900 max-w-xs truncate">{item.title || item.name}</div>
                      </td>
                      <td className="py-3.5 px-4">{getTypeBadge(item.type || 'Percentage Discount')}</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-indigo-900">
                        {item.discount_value || item.discountValue || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-[10px]">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 w-28">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-gray-500 font-bold">{claimsUsed}</span>
                            <span className="text-gray-400">/ {claimLimit}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${usagePercent >= 90 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(item)}</td>
                      <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                        {item.expiry_date || item.expiryDate || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucher(item)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 transition"
                            title="Preview Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                            title="Edit Voucher"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-rose-600 hover:text-white text-gray-600 transition"
                            title="Hapus Voucher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {vouchersPagination && vouchersPagination.lastPage > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Halaman <strong>{vouchersPagination.currentPage}</strong> dari <strong>{vouchersPagination.lastPage}</strong> (Total {vouchersPagination.total} item)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={vouchersPagination.currentPage <= 1 || vouchersLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-bold disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                disabled={vouchersPagination.currentPage >= vouchersPagination.lastPage || vouchersLoading}
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
      {selectedVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-yellow-300 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedVoucher.code || selectedVoucher.id}
                  </span>
                  {getStatusBadge(selectedVoucher)}
                </div>
                <h2 className="text-lg font-extrabold">{selectedVoucher.title || selectedVoucher.name}</h2>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              {(selectedVoucher.image_url || selectedVoucher.image) && (
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Voucher Banner Image</span>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 aspect-video">
                    <img
                      src={resolveMediaSrc(selectedVoucher.image_url || selectedVoucher.image)}
                      alt="Voucher Banner"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Voucher Type</span>
                  <div className="mt-1">{getTypeBadge(selectedVoucher.type || 'Percentage Discount')}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Applicable Category</span>
                  <span className="font-extrabold text-gray-900">{selectedVoucher.category || 'General'}</span>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Deskripsi Voucher:</h3>
                <p className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed font-medium">
                  {selectedVoucher.description || '-'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">Discount Value</span>
                  <span className="font-mono font-black text-indigo-900 text-xs mt-0.5 block">
                    {selectedVoucher.discount_value || selectedVoucher.discountValue || '-'}
                  </span>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <span className="text-[10px] text-purple-600 font-bold block uppercase">Max Discount</span>
                  <span className="font-mono font-black text-purple-900 text-xs mt-0.5 block">
                    {selectedVoucher.max_discount || selectedVoucher.maxDiscount || '-'}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-blue-600 font-bold block uppercase">Min Transaction</span>
                  <span className="font-mono font-black text-blue-900 text-xs mt-0.5 block">
                    {selectedVoucher.min_transaction || selectedVoucher.minTransaction || '-'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Start Date</span>
                  <div className="font-mono font-extrabold text-gray-900 mt-0.5">{selectedVoucher.start_date || selectedVoucher.startDate || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Expiry Date</span>
                  <div className="font-mono font-extrabold text-gray-900 mt-0.5">{selectedVoucher.expiry_date || selectedVoucher.expiryDate || '-'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  const v = selectedVoucher;
                  setSelectedVoucher(null);
                  handleOpenEdit(v);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold text-xs transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4 text-indigo-700" />
                <span>Edit Voucher</span>
              </button>

              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT VOUCHER MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">
                    {editingVoucherId ? 'Edit Voucher' : 'Tambah Voucher Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">Atur kupon diskon dan pilih konten visual dari Library.</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Kode Kupon</label>
                  <input
                    type="text"
                    required
                    value={formState.code}
                    onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Contoh: MERDEKA50"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono font-bold outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tipe Voucher</label>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  >
                    <option value="Percentage Discount">Percentage Discount</option>
                    <option value="Fixed Discount">Fixed Discount</option>
                    <option value="Cashback">Cashback</option>
                    <option value="Free Admin Fee">Free Admin Fee</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Nama Voucher</label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: Voucher Diskon 50% Token PLN"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Nilai Diskon</label>
                  <input
                    type="text"
                    value={formState.discount_value}
                    onChange={(e) => setFormState((prev) => ({ ...prev, discount_value: e.target.value }))}
                    placeholder="50% / Rp 10.000"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Max Diskon</label>
                  <input
                    type="text"
                    value={formState.max_discount}
                    onChange={(e) => setFormState((prev) => ({ ...prev, max_discount: e.target.value }))}
                    placeholder="Rp 20.000"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Min Transaksi</label>
                  <input
                    type="text"
                    value={formState.min_transaction}
                    onChange={(e) => setFormState((prev) => ({ ...prev, min_transaction: e.target.value }))}
                    placeholder="Rp 30.000"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Batas Kuota Klaim</label>
                  <input
                    type="number"
                    value={formState.claim_limit}
                    onChange={(e) => setFormState((prev) => ({ ...prev, claim_limit: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Kategori Target</label>
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="PLN Token & Data"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
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
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Tanggal Kadaluwarsa</label>
                  <input
                    type="date"
                    value={formState.expiry_date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Deskripsi Voucher</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider">Integrasi Media Library</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Voucher Image</label>
                    {formState.image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={resolveMediaUrl(formState.image_url)}
                          alt="Voucher"
                          className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                        />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-gray-800 truncate max-w-[80px]">
                            {formState.image_media?.filename || 'Gambar Voucher'}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMediaChooser('image')}
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
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
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-indigo-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Pilih Gambar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Mobile Voucher Image</label>
                    {formState.mobile_image_url ? (
                      <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                        <img
                          src={resolveMediaUrl(formState.mobile_image_url)}
                          alt="Mobile Voucher"
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
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
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
                        className="w-full h-24 border border-dashed border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-indigo-600 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition" />
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
                  disabled={vouchersLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {editingVoucherId ? 'Simpan Perubahan' : 'Buat Voucher'}
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
              <h3 className="font-extrabold text-gray-900 text-base">Hapus Voucher?</h3>
              <p className="text-xs text-gray-500">
                Apakah Anda yakin ingin menghapus voucher ini? Tindakan ini tidak dapat dibatalkan.
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
                onClick={handleDeleteVoucher}
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
