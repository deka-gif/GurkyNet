import React, { useState, useEffect } from 'react';
import { 
  Search, Grid, List, Plus, Copy, Check, Eye, Trash2, RefreshCw, 
  Folder, FileImage, Info, X, Upload, Edit3, Loader2, AlertCircle, 
  ArrowLeft, ArrowRight, ShieldAlert, Image as ImageIcon
} from 'lucide-react';
import { useMediaStore } from '../../store/media.store';
import { useAuthStore } from '../../store/auth.store'; // Auth store for checking role authorization
import { DashboardHeader } from '../../components/common/DashboardHeader';
import { Media } from '../../types';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

export const MarketingMediaLibrary = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();
  const { user } = useAuthStore() as any; // Retrieve logged in user to verify role authorization
  const { 
    items, loading, error, filters, pagination, 
    setFilters, fetchMedia, uploadMedia, updateMedia, deleteMedia, replaceMedia 
  } = useMediaStore();

  // Dialog / Modal States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active Folder Filter
  const [activeFolder, setActiveFolder] = useState('');

  // Form states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadFolder, setUploadFolder] = useState('general');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Rename form states
  const [renameFilename, setRenameFilename] = useState('');
  const [renameAlt, setRenameAlt] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  // Copy URL state feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Authorization validation
  const isAuthorized = user && ['Super Admin', 'Marketing', 'Owner'].includes(user.role);
  // Owner can view/browse the library but cannot upload/delete/rename (read-only guard).
  const canManageMedia = isAuthorized && !isOwnerReadOnly;

  useEffect(() => {
    // Sync filters with store and trigger API
    setFilters({ 
      keyword: searchQuery, 
      folder: activeFolder,
      page: 1 // reset to first page on search/filter change
    });
  }, [searchQuery, activeFolder]);

  useEffect(() => {
    // Whenever filters change, trigger fetch
    fetchMedia();
  }, [filters]);

  const handlePageChange = (newPage: number) => {
    if (pagination && newPage >= 1 && newPage <= pagination.lastPage) {
      setFilters({ page: newPage });
    }
  };

  const folders = [
    { value: '', label: 'Semua Folder' },
    { value: 'logo', label: 'Logo Website' },
    { value: 'favicon', label: 'Favicon' },
    { value: 'banner', label: 'Banner Slider' },
    { value: 'promotion', label: 'Promo Image' },
    { value: 'static-page', label: 'Halaman Statis' },
    { value: 'general', label: 'Umum' }
  ];

  // Copy to clipboard
  const handleCopyUrl = (url: string, id: number) => {
    navigator.clipboard.writeText(resolveMediaUrl(url));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Upload handles
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);
      setFormError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setFormError('Silakan pilih berkas gambar terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await uploadMedia(uploadFile, {
        altText: uploadAlt || uploadFile.name.split('.')[0],
        folder: uploadFolder
      });
      // Reset upload form
      setUploadFile(null);
      setUploadAlt('');
      setUploadFolder('general');
      setIsUploadOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengunggah gambar.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handle
  const handleDelete = async (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus gambar ini secara permanen? Semua layout yang merujuk pada gambar ini mungkin akan mengalami patah tautan.')) {
      try {
        await deleteMedia(id);
        if (selectedMedia?.id === id) {
          setIsPreviewOpen(false);
          setSelectedMedia(null);
        }
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus media.');
      }
    }
  };

  // Replace handle
  const handleReplace = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (window.confirm(`Ganti gambar "${selectedMedia?.filename}" dengan "${file.name}"? Tautan URL gambar lama akan merujuk pada gambar yang baru.`)) {
        setSubmitting(true);
        try {
          const updated = await replaceMedia(id, file);
          setSelectedMedia(updated);
        } catch (err: any) {
          alert(err.message || 'Gagal menggantikan gambar.');
        } finally {
          setSubmitting(false);
        }
      }
    }
  };

  // Rename modal opens
  const openRenameModal = (media: Media) => {
    setSelectedMedia(media);
    const nameWithoutExt = media.filename.substring(0, media.filename.lastIndexOf('.')) || media.filename;
    setRenameFilename(nameWithoutExt);
    setRenameAlt(media.altText || '');
    setRenameError(null);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) return;
    if (!renameFilename.trim()) {
      setRenameError('Nama berkas tidak boleh kosong.');
      return;
    }

    setRenaming(true);
    setRenameError(null);

    try {
      const updated = await updateMedia(selectedMedia.id, {
        filename: renameFilename.trim(),
        altText: renameAlt.trim()
      });
      setSelectedMedia(updated);
      setIsRenameOpen(false);
    } catch (err: any) {
      setRenameError(err.message || 'Gagal mengubah nama media.');
    } finally {
      setRenaming(false);
    }
  };

  const openPreview = (media: Media) => {
    setSelectedMedia(media);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <DashboardHeader 
        title="Media Library & File Management" 
        subtitle="Kelola semua aset gambar, logo, favicon, dan banner promosi website secara terpusat."
      />

      {/* Role Authorization Guard Warning UI */}
      {!isAuthorized && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-amber-800 text-sm">Mode Pratinjau Terbatas</h4>
              <p className="text-xs text-amber-700 leading-relaxed mt-1">Anda masuk sebagai role <span className="font-bold underline uppercase">{user?.role || 'Guest'}</span>. Pengelolaan media (unggah, edit, hapus) membutuhkan hak akses Super Admin, Marketing, atau Owner. Anda hanya dapat melihat file.</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
            <input
              type="text"
              placeholder="Cari file berdasarkan nama atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
            />
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Switcher */}
            <div className="bg-gray-50 p-1 rounded-xl border border-gray-100 flex gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button 
              onClick={() => fetchMedia(true)}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl transition-all cursor-pointer"
              title="Refresh Media"
            >
              <RefreshCw className="w-4.5 h-4.5" />
            </button>

            {/* Add Media Button */}
            {canManageMedia && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md shadow-primary-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Unggah Media</span>
              </button>
            )}
          </div>
        </div>

        {/* Folder Categories Tab Bar */}
        <div className="border-t border-gray-50 pt-4 flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {folders.map((folder) => {
            const isActive = activeFolder === folder.value;
            return (
              <button
                key={folder.value}
                onClick={() => setActiveFolder(folder.value)}
                className={`px-4 py-2 text-xs font-extrabold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-500/10' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-100'
                }`}
              >
                {folder.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Listing View (Grid or List) */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
            <h4 className="font-bold text-gray-800">Menyinkronkan Media Library...</h4>
            <p className="text-sm text-gray-500 max-w-xs">Sedang menghubungkan ke server untuk menarik daftar aset gambar terbaru.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center shadow-xs">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Tidak Ada File Media</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2">
            {searchQuery 
              ? 'Tidak ada berkas media yang cocok dengan kata kunci pencarian Anda.' 
              : 'Belum ada gambar yang diunggah di folder ini. Mulai dengan mengunggah aset gambar pertama Anda.'}
          </p>
          {canManageMedia && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="mt-6 inline-flex items-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold px-5 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
            >
              <Upload className="w-4.5 h-4.5" />
              <span>Unggah Berkas</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((media) => (
            <div 
              key={media.id} 
              className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs flex flex-col group relative transition-all hover:shadow-md hover:border-gray-200"
            >
              {/* Thumbnail Stage */}
              <div className="relative aspect-square bg-gray-50 overflow-hidden cursor-pointer" onClick={() => openPreview(media)}>
                <img
                  src={resolveMediaUrl(media.url)}
                  alt={media.altText || media.filename}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                
                {/* Folder Overlay Pill */}
                <div className="absolute top-2.5 left-2.5 bg-black/50 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {media.folder}
                </div>
              </div>

              {/* Title Info */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 
                    className="font-bold text-gray-800 text-xs truncate cursor-pointer hover:text-primary-600"
                    title={media.filename}
                    onClick={() => openPreview(media)}
                  >
                    {media.filename}
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {media.width}x{media.height} px • {(media.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {/* Grid card action buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-3 mt-2 border-t border-gray-50">
                  <button
                    onClick={() => handleCopyUrl(media.url, media.id)}
                    className="p-1.5 hover:bg-gray-50 text-gray-500 hover:text-primary-600 rounded-lg transition-colors cursor-pointer"
                    title={copiedId === media.id ? 'Tersalin!' : 'Salin Tautan URL'}
                  >
                    {copiedId === media.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => openPreview(media)}
                    className="p-1.5 hover:bg-gray-50 text-gray-500 hover:text-primary-600 rounded-lg transition-colors cursor-pointer"
                    title="Pratinjau Detail"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {canManageMedia && (
                    <>
                      <button
                        onClick={() => openRenameModal(media)}
                        className="p-1.5 hover:bg-gray-50 text-gray-500 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                        title="Ubah Nama"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(media.id)}
                        className="p-1.5 hover:bg-gray-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Permanen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW (TABLE) */
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-100">
                  <th className="py-4 px-6">Pratinjau</th>
                  <th className="py-4 px-6">Nama File / Original</th>
                  <th className="py-4 px-6">Folder</th>
                  <th className="py-4 px-6">Ukuran</th>
                  <th className="py-4 px-6">Dimensi</th>
                  <th className="py-4 px-6">Ekstensi</th>
                  <th className="py-4 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {items.map((media) => (
                  <tr key={media.id} className="hover:bg-gray-50/50">
                    <td className="py-3.5 px-6">
                      <div 
                        className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden cursor-pointer border border-gray-100"
                        onClick={() => openPreview(media)}
                      >
                        <img 
                          src={resolveMediaUrl(media.url)} 
                          alt={media.altText || media.filename} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-extrabold text-gray-900 truncate max-w-xs cursor-pointer hover:text-primary-600" onClick={() => openPreview(media)}>
                        {media.filename}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-xs">
                        Orig: {media.originalName}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="bg-gray-50 text-gray-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-[9px] border border-gray-100">
                        {media.folder}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-gray-600">
                      {(media.size / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-6 text-gray-600">
                      {media.width} x {media.height} px
                    </td>
                    <td className="py-3.5 px-6 font-bold text-gray-500 uppercase">
                      {media.extension}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopyUrl(media.url, media.id)}
                          className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-primary-600 rounded-lg transition-all cursor-pointer"
                          title="Salin Tautan URL"
                        >
                          {copiedId === media.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => openPreview(media)}
                          className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-primary-600 rounded-lg transition-all cursor-pointer"
                          title="Pratinjau"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canManageMedia && (
                          <>
                            <button
                              onClick={() => openRenameModal(media)}
                              className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-amber-600 rounded-lg transition-all cursor-pointer"
                              title="Ubah Nama"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDelete(media.id)}
                              className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Stage */}
      {pagination && pagination.lastPage > 1 && (
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-xs">
          <p className="text-xs text-gray-500 font-medium">
            Menampilkan <span className="font-bold text-gray-900">{items.length}</span> dari <span className="font-bold text-gray-900">{pagination.total}</span> media
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            
            <span className="text-xs font-bold text-gray-700 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
              Halaman {pagination.currentPage} dari {pagination.lastPage}
            </span>

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.lastPage}
              className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          UPLOAD DIALOG / MODAL
          ====================================================== */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-gray-900">Unggah Gambar Baru</h3>
              <button onClick={() => setIsUploadOpen(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* File Select */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pilih File Gambar</label>
                <div className="border-2 border-dashed border-gray-200 hover:border-primary-500/50 rounded-2xl p-6 text-center transition-colors relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-xs font-bold text-gray-700">
                      {uploadFile ? uploadFile.name : 'Tarik file ke sini atau Klik untuk memilih'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Format: .jpg, .jpeg, .png, .svg, .webp (Maksimal 5MB)
                    </span>
                  </div>
                </div>
              </div>

              {/* Alt description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alt Text / Deskripsi</label>
                <input
                  type="text"
                  placeholder="Misal: Banner Promo Cashback Agustus"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                />
              </div>

              {/* Target Folder */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Folder Tujuan</label>
                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white outline-none transition-all cursor-pointer"
                >
                  <option value="general">Umum (general)</option>
                  <option value="logo">Logo Website</option>
                  <option value="favicon">Favicon</option>
                  <option value="banner">Banner Slider</option>
                  <option value="promotion">Promo Image</option>
                  <option value="static-page">Halaman Statis</option>
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit triggers */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-2xl text-center text-sm cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-2xl text-center text-sm shadow-md shadow-primary-500/10 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunggah...</span>
                    </span>
                  ) : (
                    <span>Unggah Berkas</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          RENAME IMAGE MODAL
          ====================================================== */}
      {isRenameOpen && selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-gray-900">Ubah Informasi Berkas</h3>
              <button onClick={() => setIsRenameOpen(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nama Berkas (Tanpa Ekstensi)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={renameFilename}
                    onChange={(e) => setRenameFilename(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold uppercase">
                    .{selectedMedia.extension}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alt Text / Deskripsi Aksesibilitas</label>
                <input
                  type="text"
                  value={renameAlt}
                  onChange={(e) => setRenameAlt(e.target.value)}
                  placeholder="Deskripsi penjelas gambar"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                />
              </div>

              {renameError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{renameError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameOpen(false)}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-2xl text-center text-sm cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-2xl text-center text-sm shadow-md shadow-primary-500/10 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {renaming ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          PREVIEW DETAILED DIALOG
          ====================================================== */}
      {isPreviewOpen && selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900">Detail & Pratinjau Media</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedMedia.filename}</p>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Image Preview Canvas */}
              <div className="flex-1 bg-gray-950 flex items-center justify-center p-6 relative">
                <img
                  src={resolveMediaUrl(selectedMedia.url)}
                  alt={selectedMedia.altText}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                
                {/* Resolution overlays */}
                <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold">
                  {selectedMedia.width} x {selectedMedia.height} px
                </div>
              </div>

              {/* Sidebar metadata specifications */}
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 p-6 overflow-y-auto space-y-6 bg-gray-50/50">
                <div className="space-y-4">
                  <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-primary-500" />
                    <span>Spesifikasi File</span>
                  </h4>
                  
                  <div className="space-y-3.5 text-xs text-gray-600">
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Nama Berkas:</span>
                      <span className="break-all">{selectedMedia.filename}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Alt Text (Deskripsi):</span>
                      <span className="italic block mt-0.5">
                        {selectedMedia.altText ? `"${selectedMedia.altText}"` : 'Belum ada deskripsi alt-text.'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Asal Nama:</span>
                      <span className="break-all text-[11px]">{selectedMedia.originalName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Tipe Mime & Ekstensi:</span>
                      <span className="uppercase">{selectedMedia.extension}</span> • <span>{selectedMedia.mimeType}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Ukuran File:</span>
                      <span>{(selectedMedia.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Folder Penyimpanan:</span>
                      <span className="bg-gray-100 text-gray-700 font-extrabold px-2 py-0.5 rounded uppercase text-[10px] border border-gray-200">
                        {selectedMedia.folder}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Metode / Storage Disk:</span>
                      <span className="capitalize">{selectedMedia.storageDisk || 's3'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Diunggah Oleh:</span>
                      <span>{selectedMedia.uploadedBy || 'Admin'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block mb-0.5">Tanggal Diunggah:</span>
                      <span>{selectedMedia.createdAt ? new Date(selectedMedia.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Operations Actions */}
                <div className="pt-6 border-t border-gray-200 space-y-2.5">
                  <button
                    onClick={() => handleCopyUrl(selectedMedia.url, selectedMedia.id)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                  >
                    {copiedId === selectedMedia.id ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Tautan Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Tautan Gambar</span>
                      </>
                    )}
                  </button>

                  {canManageMedia && (
                    <>
                      {/* Replace Image Button (File Input trigger) */}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleReplace(selectedMedia.id, e)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          className="w-full inline-flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Gantikan Gambar (Replace)</span>
                        </button>
                      </div>

                      {/* Rename info */}
                      <button
                        onClick={() => openRenameModal(selectedMedia)}
                        className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Ubah Nama & Alt Text</span>
                      </button>

                      {/* Delete permanently */}
                      <button
                        onClick={() => handleDelete(selectedMedia.id)}
                        className="w-full inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus Media Permanen</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
