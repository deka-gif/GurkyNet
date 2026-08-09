import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Search,
  Filter,
  Eye,
  Edit,
  Copy,
  Archive,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  X,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  Users,
  Shield,
  Layers,
  Megaphone,
  UserCheck,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { marketingService } from '../../services/marketing.service';
import { useMarketingStore } from '../../store/marketing.store';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { Media } from '../../types';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'announcement' | 'broadcast' | 'system';
  coverMediaId?: number | null;
  coverImage?: {
    id: number;
    url: string;
    name: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  lastUpdated: string;
}

export const MarketingAnnouncementCenter: React.FC = () => {
  const user = storageService.getUser();
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();

  const {
    announcements,
    announcementsPagination,
    announcementsLoading,
    announcementsError,
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  } = useMarketingStore();

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All'); // 'All', 'active', 'inactive'
  const [typeFilter, setTypeFilter] = useState<string>('All'); // 'All', 'announcement', 'broadcast', 'system'
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Selected Announcement Detail Drawer
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  // Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<'announcement' | 'broadcast' | 'system'>('announcement');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formCoverMediaId, setFormCoverMediaId] = useState<number | null>(null);
  const [formCoverImageUrl, setFormCoverImageUrl] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isMediaOpen, setIsMediaOpen] = useState<boolean>(false);

  // Delete Confirmation State
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingTitle, setDeletingTitle] = useState<string>('');
  const [deleting, setDeleting] = useState<boolean>(false);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch announcements from API
  const handleFetchAnnouncements = async (pageToFetch = currentPage) => {
    fetchAnnouncements({
      page: pageToFetch,
      per_page: 10,
      search: searchQuery.trim() || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
    });
  };

  // Trigger fetch on filter change
  useEffect(() => {
    handleFetchAnnouncements(1);
  }, [searchQuery, statusFilter]);

  // Client-side filtering for Type
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      if (typeFilter !== 'All' && item.type !== typeFilter) return false;
      return true;
    });
  }, [announcements, typeFilter]);

  // Compute stats dynamically from loaded items
  const activeCount = useMemo(() => announcements.filter((a) => a.isActive).length, [announcements]);
  const inactiveCount = useMemo(() => announcements.filter((a) => !a.isActive).length, [announcements]);
  const broadcastCount = useMemo(() => announcements.filter((a) => a.type === 'broadcast').length, [announcements]);
  const systemCount = useMemo(() => announcements.filter((a) => a.type === 'system').length, [announcements]);

  // Open Form for Create
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingAnnouncement(null);
    setFormTitle('');
    setFormType('announcement');
    setFormMessage('');
    setFormIsActive(true);
    setFormCoverMediaId(null);
    setFormCoverImageUrl(null);
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (announcement: Announcement) => {
    setFormMode('edit');
    setEditingAnnouncement(announcement);
    setFormTitle(announcement.title);
    setFormType(announcement.type);
    setFormMessage(announcement.message);
    setFormIsActive(announcement.isActive);
    setFormCoverMediaId(announcement.coverMediaId || null);
    setFormCoverImageUrl(announcement.coverImage?.url || null);
    setIsFormOpen(true);
  };

  // Submit Form (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showNotification('Judul pengumuman wajib diisi.');
      return;
    }
    if (!formMessage.trim()) {
      showNotification('Isi pesan pengumuman wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        message: formMessage.trim(),
        type: formType,
        cover_media_id: formCoverMediaId,
        is_active: formIsActive,
      };

      if (formMode === 'create') {
        const res = await createAnnouncement(payload);
        if (res.success) {
          showNotification(res.message || 'Pengumuman baru berhasil dibuat.');
          setIsFormOpen(false);
          handleFetchAnnouncements(1);
        } else {
          showNotification(res.message || 'Gagal membuat pengumuman.');
        }
      } else {
        if (!editingAnnouncement) return;
        const res = await updateAnnouncement(editingAnnouncement.id, payload);
        if (res.success) {
          showNotification(res.message || 'Pengumuman berhasil diperbarui.');
          setIsFormOpen(false);
          handleFetchAnnouncements(currentPage);
        } else {
          showNotification(res.message || 'Gagal memperbarui pengumuman.');
        }
      }
    } catch (err: any) {
      showNotification(err?.message || 'Gagal menyimpan pengumuman.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (announcement: Announcement) => {
    setDeletingId(announcement.id);
    setDeletingTitle(announcement.title);
    setIsDeleteOpen(true);
  };

  // Confirm Delete
  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await deleteAnnouncement(deletingId);
      if (res.success) {
        showNotification(res.message || 'Pengumuman berhasil dihapus.');
        setIsDeleteOpen(false);
        const isLastItem = filteredAnnouncements.length === 1 && currentPage > 1;
        handleFetchAnnouncements(isLastItem ? currentPage - 1 : currentPage);
      } else {
        showNotification(res.message || 'Gagal menghapus pengumuman.');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Gagal menghapus pengumuman.');
    } finally {
      setDeleting(false);
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (announcement: Announcement) => {
    try {
      const payload = {
        title: `${announcement.title} (Duplikasi)`,
        message: announcement.message,
        type: announcement.type,
        cover_media_id: announcement.coverMediaId || null,
        is_active: false,
      };
      const res = await createAnnouncement(payload);
      if (res.success) {
        showNotification(res.message || 'Pengumuman berhasil diduplikasi ke status Inaktif.');
        handleFetchAnnouncements(1);
      } else {
        showNotification(res.message || 'Gagal menduplikasi pengumuman.');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Gagal menduplikasi pengumuman.');
    }
  };

  // Media Selection Handler
  const handleMediaSelect = (url: string, mediaItem?: Media) => {
    if (mediaItem) {
      setFormCoverMediaId(mediaItem.id);
      setFormCoverImageUrl(url);
    }
  };

  // Badges & Labels helpers
  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200">
        <Archive className="w-3.5 h-3.5 text-gray-400" />
        Inactive
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'broadcast':
        return (
          <span className="px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[10px] border border-purple-100 inline-flex items-center gap-1">
            <Megaphone className="w-3 h-3 text-purple-600" />
            Broadcast
          </span>
        );
      case 'system':
        return (
          <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 font-extrabold text-[10px] border border-amber-100 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            System
          </span>
        );
      case 'announcement':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-100 inline-flex items-center gap-1">
            <Info className="w-3 h-3 text-blue-600" />
            Announcement
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-blue-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-[11px] font-bold text-blue-200 border border-blue-400/30">
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              GurkyNet Marketing Announcement Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Announcement & Broadcast Center
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
              Pengelolaan siaran informasi sistem, pemberitahuan publikasi promo, pemeliharaan server, dan komunikasi segmen pengguna aplikasi GurkyNet secara live.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleFetchAnnouncements()}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs shadow-md transition flex items-center gap-2 border border-white/15"
            >
              <RefreshCw className={`w-4 h-4 text-blue-300 ${announcementsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
            {!isOwnerReadOnly && (
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs shadow-md transition flex items-center gap-2 border border-blue-500/35"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Pengumuman</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Announcements */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-2 bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase">
            <span>Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800">{activeCount} Aktif</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Tampil pada feed berita aplikasi</div>
        </div>

        {/* Inactive Announcements */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-2 bg-gradient-to-br from-gray-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Inactive</span>
            <Archive className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-700">{inactiveCount} Inaktif</div>
          <div className="text-[11px] text-gray-500 font-medium">Arsip pengumuman tidak aktif</div>
        </div>

        {/* Broadcast Type */}
        <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm space-y-2 bg-gradient-to-br from-purple-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700 uppercase">
            <span>Broadcasts</span>
            <Megaphone className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-800">{broadcastCount} Siaran</div>
          <div className="text-[11px] text-purple-700 font-semibold">Tipe pengumuman broadcast</div>
        </div>

        {/* System Type */}
        <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm space-y-2 bg-gradient-to-br from-amber-50/40 to-white">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 uppercase">
            <span>System Announcements</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">{systemCount} Sistem</div>
          <div className="text-[11px] text-amber-700 font-semibold">Informasi maintenance & teknis</div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-extrabold text-gray-900">Announcement Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {filteredAnnouncements.length} of {totalItems} total items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Category Type (Client Filter)</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Kategori</option>
              <option value="announcement">Announcement</option>
              <option value="broadcast">Broadcast</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Keyword Search */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keyword Search (Server Query)</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul pengumuman, pesan, isi siaran..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* API CONTENT HANDLERS */}
      {announcementsLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-900">Memuat Pengumuman...</p>
            <p className="text-xs text-gray-400">Menghubungi API server backend GurkyNet.</p>
          </div>
        </div>
      ) : announcementsError ? (
        <div className="bg-white p-12 rounded-3xl border border-red-100 shadow-sm flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-extrabold text-gray-900">Gagal Memuat Data</p>
            <p className="text-xs text-red-600 max-w-md">{announcementsError}</p>
          </div>
          <button
            onClick={() => handleFetchAnnouncements()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition"
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-gray-100 text-gray-400 rounded-2xl">
            <Bell className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-extrabold text-gray-900">Belum Ada Pengumuman</p>
            <p className="text-xs text-gray-400">Tidak ada pengumuman yang sesuai dengan filter saat ini.</p>
          </div>
          {!isOwnerReadOnly && (
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition"
            >
              Buat Pengumuman Baru
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ANNOUNCEMENT TABLE */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-gray-900">Announcement Broadcast Table</h2>
                <p className="text-xs text-gray-500">Pratinjau, sunting, gandakan, atau hapus siaran pengumuman live.</p>
              </div>
              <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
                {filteredAnnouncements.length} of {totalItems} Items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Title</th>
                    <th className="py-3.5 px-4">Cover Image</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Created At</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {filteredAnnouncements.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-gray-900 max-w-xs truncate">{item.title}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {item.id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.coverImage?.url ? (
                          <img
                            src={item.coverImage.url}
                            alt={item.title}
                            className="w-12 h-8 object-cover rounded-md border border-gray-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-gray-400 text-[11px] font-mono italic">No Cover</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getTypeBadge(item.type)}</td>
                      <td className="py-3.5 px-4">{getStatusBadge(item.isActive)}</td>
                      <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Preview */}
                          <button
                            type="button"
                            onClick={() => setSelectedAnnouncement(item)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          {!isOwnerReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-purple-600 hover:text-white text-gray-600 transition"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Duplicate */}
                          {!isOwnerReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleDuplicate(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-600 transition"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {!isOwnerReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-600 hover:text-white text-gray-600 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-gray-500">
                  Halaman <strong className="text-gray-900">{currentPage}</strong> dari{' '}
                  <strong className="text-gray-900">{totalPages}</strong> ({totalItems} total data)
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handleFetchAnnouncements(currentPage - 1)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs disabled:opacity-50 transition"
                  >
                    Sebelumnya
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handleFetchAnnouncements(pageNum)}
                        className={`w-8 h-8 rounded-xl font-bold text-xs transition ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => handleFetchAnnouncements(currentPage + 1)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs disabled:opacity-50 transition"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* DETAIL DRAWER */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-300 bg-slate-800 px-2.5 py-0.5 rounded">
                    ID: {selectedAnnouncement.id}
                  </span>
                  {getStatusBadge(selectedAnnouncement.isActive)}
                </div>
                <h2 className="text-lg font-extrabold leading-snug">{selectedAnnouncement.title}</h2>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              {/* Category */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Category Type</span>
                  <div className="mt-1">{getTypeBadge(selectedAnnouncement.type)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Last Updated</span>
                  <span className="font-mono font-bold text-gray-900 block mt-1">
                    {selectedAnnouncement.lastUpdated ? new Date(selectedAnnouncement.lastUpdated).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }) : '-'}
                  </span>
                </div>
              </div>

              {/* Cover Image */}
              {selectedAnnouncement.coverImage?.url && (
                <div>
                  <h3 className="font-extrabold text-gray-900 text-xs mb-1.5">Cover Image:</h3>
                  <img
                    src={selectedAnnouncement.coverImage.url}
                    alt={selectedAnnouncement.title}
                    className="w-full h-48 object-cover rounded-2xl border border-gray-200 shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Message Content */}
              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1.5">Isi Pesan:</h3>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-800 leading-relaxed font-medium whitespace-pre-line">
                  {selectedAnnouncement.message}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Created At</span>
                  <div className="font-mono font-bold text-gray-900 mt-0.5">
                    {selectedAnnouncement.createdAt ? new Date(selectedAnnouncement.createdAt).toLocaleString('id-ID') : '-'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Created By</span>
                  <div className="font-bold text-gray-800 mt-0.5">Marketing Admin</div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
              {!isOwnerReadOnly && (
                <button
                  onClick={() => {
                    handleDuplicate(selectedAnnouncement);
                    setSelectedAnnouncement(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-blue-700" />
                  <span>Duplicate</span>
                </button>
              )}

              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL (CREATE / EDIT) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white max-w-xl w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-gray-100 animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-base">
                  {formMode === 'create' ? 'Buat Pengumuman Baru' : 'Sunting Pengumuman'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-gray-800 overflow-y-auto flex-1">
              {/* Title */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Masukkan judul siaran informasi..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
                />
              </div>

              {/* Type Select */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Kategori Tipe</label>
                <select
                  value={formType}
                  onChange={(e: any) => setFormType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
                >
                  <option value="announcement">Announcement (Info Umum)</option>
                  <option value="broadcast">Broadcast (Segmen Khusus)</option>
                  <option value="system">System (Teknis & Maintenance)</option>
                </select>
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Isi Pesan / Informasi</label>
                <textarea
                  required
                  rows={5}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Ketik rincian pesan lengkap yang ingin disiarkan ke pengguna..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs leading-relaxed"
                />
              </div>

              {/* Cover Image (Media Chooser Integration) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Cover Image (Optional)</label>
                {formCoverImageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 group h-36">
                    <img
                      src={formCoverImageUrl}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition duration-200">
                      <button
                        type="button"
                        onClick={() => setIsMediaOpen(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] rounded-lg shadow-sm"
                      >
                        Ganti Gambar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormCoverMediaId(null);
                          setFormCoverImageUrl(null);
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] rounded-lg shadow-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsMediaOpen(true)}
                    className="w-full py-8 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500 transition bg-gray-50/50"
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="font-extrabold">Pilih Gambar Cover dari Media Library</span>
                  </button>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-gray-900 block">Status Aktif</span>
                  <span className="text-gray-400 block text-[10px]">Tentukan apakah pengumuman ini langsung ditayangkan</span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-blue-500 transition shrink-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-extrabold transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? 'Menyimpan...' : 'Simpan Pengumuman'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-gray-900 text-base">Hapus Pengumuman?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus pengumuman <strong className="text-gray-900">"{deletingTitle}"</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA CHOOSER MODAL */}
      <MediaChooserModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        onSelect={handleMediaSelect}
        allowedFolder="banner"
        title="Pilih Gambar Cover Pengumuman"
      />
    </div>
  );
};
