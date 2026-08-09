import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Check, AlertCircle, Eye, Calendar, Globe, Sparkles, BookOpen, Image as ImageIcon } from 'lucide-react';
import { websiteService } from '../../services';
import { StaticPage } from '../../types';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import {
  CmsPageHeader,
  CmsFilterBar,
  CmsStatusBadge,
  CmsDeleteConfirmation,
  CmsSaveButton,
  CmsPublishBadge,
} from '../../components/common/CmsCommon';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

export const MarketingStaticPages: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // '', 'draft', 'published'

  // Media chooser state for static pages
  const [isChooserOpen, setIsChooserOpen] = useState<boolean>(false);

  // Modal / Editor State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<StaticPage | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  const handleInsertImage = (url: string, mediaItem?: any) => {
    const alt = mediaItem?.altText || 'Gambar Halaman';
    const markdownImage = `\n![${alt}](${url})\n`;
    handleFormChange('content', formState.content + markdownImage);
  };

  // Preview Mode Only Modal (No Editing)
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<StaticPage | null>(null);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deletingItem, setDeletingItem] = useState<StaticPage | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Form State
  const [formState, setFormState] = useState<{
    title: string;
    slug: string;
    content: string;
    seoTitle: string;
    seoDescription: string;
    status: 'draft' | 'published';
    publishedAt: string;
  }>({
    title: '',
    slug: '',
    content: '',
    seoTitle: '',
    seoDescription: '',
    status: 'draft',
    publishedAt: '',
  });

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (searchQuery) filters.keyword = searchQuery;
      if (statusFilter) filters.status = statusFilter;

      const res = await websiteService.getPages(filters);
      setPages(res.data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar static pages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPages();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setEditorTab('write');
    setFormState({
      title: '',
      slug: '',
      content: '',
      seoTitle: '',
      seoDescription: '',
      status: 'draft',
      publishedAt: new Date().toISOString().split('T')[0],
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: StaticPage) => {
    setEditingItem(item);
    setEditorTab('write');
    setFormState({
      title: item.title,
      slug: item.slug,
      content: item.content,
      seoTitle: item.seoTitle || '',
      seoDescription: item.seoDescription || '',
      status: item.status,
      publishedAt: item.publishedAt ? item.publishedAt.split(' ')[0] : new Date().toISOString().split('T')[0],
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenPreview = (item: StaticPage) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const handleOpenDelete = (item: StaticPage) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormState((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'title') {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        // Auto recommend SEO title
        if (!prev.seoTitle || prev.seoTitle === `${prev.title} - GurkyNet`) {
          updated.seoTitle = `${value} - GurkyNet`;
        }
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formState,
        publishedAt: formState.status === 'published' ? `${formState.publishedAt} 00:00:00` : undefined,
      };

      if (editingItem) {
        await websiteService.updatePage(editingItem.id, payload);
        setSuccess('Static page berhasil diperbarui.');
      } else {
        await websiteService.createPage(payload);
        setSuccess('Static page baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchPages();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan static page.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    setError(null);
    try {
      await websiteService.deletePage(deletingItem.id);
      setSuccess('Static page berhasil dihapus.');
      setDeleteOpen(false);
      setDeletingItem(null);
      fetchPages();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus static page.');
    } finally {
      setDeleting(false);
    }
  };

  // Convert raw textarea content to standard preview with breaklines or simple HTML mapping
  const renderFormattedPreview = (rawContent: string) => {
    if (!rawContent) return <p className="text-gray-400 italic text-xs">Belum ada konten tertulis...</p>;
    return (
      <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-4 text-gray-800">
        {rawContent.split('\n\n').map((paragraph, index) => {
          if (paragraph.startsWith('### ')) {
            return <h4 key={index} className="text-sm font-black text-gray-900 pt-2">{paragraph.replace('### ', '')}</h4>;
          }
          if (paragraph.startsWith('## ')) {
            return <h3 key={index} className="text-base font-black text-gray-900 pt-3 border-b border-gray-100 pb-1">{paragraph.replace('## ', '')}</h3>;
          }
          if (paragraph.startsWith('# ')) {
            return <h2 key={index} className="text-lg font-black text-primary-900 pt-4">{paragraph.replace('# ', '')}</h2>;
          }
          if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
            const listItems = paragraph.split('\n');
            return (
              <ul key={index} className="list-disc pl-5 space-y-1">
                {listItems.map((li, idx) => (
                  <li key={idx}>{li.replace(/^[\-\*]\s+/, '')}</li>
                ))}
              </ul>
            );
          }
          return <p key={index} className="whitespace-pre-wrap">{paragraph}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12" id="static-pages-container">
      <CmsPageHeader
        title="Static Pages"
        subtitle="Kelola konten informasi statis seperti Tentang Kami, Kebijakan Privasi, Ketentuan Layanan, FAQ, dan SEO Meta tags."
        icon={FileText}
        action={
          !isOwnerReadOnly
            ? {
                label: 'Buat Halaman',
                onClick: handleOpenCreate,
                icon: Plus,
              }
            : undefined
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-extrabold">Kesalahan:</span> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs font-bold">{success}</div>
        </div>
      )}

      {/* Filter Bar */}
      <CmsFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari halaman berdasarkan judul, konten, atau slug..."
        filters={[
          {
            label: 'Status Rilis',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'Semua Status', value: '' },
              { label: 'Published / Rilis', value: 'published' },
              { label: 'Draft / Konsep', value: 'draft' },
            ],
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setStatusFilter('');
        }}
      />

      {/* Main Table */}
      {loading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-500 font-medium">Memuat data halaman statis...</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-3">
          <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900">Belum Ada Halaman Statis</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-normal">
              Tidak ditemukan halaman statis. Silakan buat halaman baru dengan mengklik tombol "Buat Halaman" di atas.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Judul Halaman</th>
                  <th className="py-3 px-4">SEO Title</th>
                  <th className="py-3 px-4">SEO Deskripsi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tanggal Rilis</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {pages.map((item) => (
                  <tr key={item.id} className="hover:bg-primary-50/10 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-gray-900">{item.title}</div>
                      <div className="text-[10px] text-gray-400 font-mono">/{item.slug}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 font-semibold">{item.seoTitle || '-'}</td>
                    <td className="py-4 px-4 text-gray-400 font-medium max-w-xs truncate" title={item.seoDescription}>
                      {item.seoDescription || '-'}
                    </td>
                    <td className="py-4 px-4">
                      <CmsPublishBadge status={item.status} />
                    </td>
                    <td className="py-4 px-4 text-gray-500 font-mono">
                      {item.publishedAt ? item.publishedAt : 'Belum Dijadwalkan'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenPreview(item)}
                          className="p-2 bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-700 border border-gray-100 hover:border-blue-100 rounded-xl transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isOwnerReadOnly && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-2 bg-gray-50 hover:bg-primary-50 text-gray-500 hover:text-primary-700 border border-gray-100 hover:border-primary-100 rounded-xl transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-2 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-700 border border-gray-100 hover:border-red-100 rounded-xl transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* FULL FEATURED WRITER & SEO EDITOR MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-4xl w-full rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 overflow-y-auto max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-600" />
                <h3 className="font-extrabold text-gray-900 text-base">
                  {editingItem ? 'Edit Halaman Statis' : 'Buat Halaman Statis'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 flex-1 overflow-y-auto pr-1">
              {/* Core Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Judul Halaman <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formState.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="e.g. Tentang Kami"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Slug URL <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formState.slug}
                    onChange={(e) => handleFormChange('slug', e.target.value)}
                    placeholder="e.g. tentang-kami"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium font-mono"
                  />
                </div>
              </div>

              {/* Editor visual workspace */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                {/* Editor Tabs */}
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorTab('write')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        editorTab === 'write'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Tulis Konten
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        editorTab === 'preview'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Visual Live Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChooserOpen(true)}
                      className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Sisipkan Gambar</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">Format: Markdown / Teks Polos</span>
                </div>

                {/* Editor Areas */}
                {editorTab === 'write' ? (
                  <div className="p-3 bg-white">
                    <textarea
                      required
                      value={formState.content}
                      onChange={(e) => handleFormChange('content', e.target.value)}
                      placeholder="# Judul Utama&#10;&#10;Ini adalah contoh konten halaman statis. Anda bisa menulis dalam format markdown biasa.&#10;&#10;## Subjudul&#10;&#10;- Poin list 1&#10;- Poin list 2"
                      rows={10}
                      className="w-full bg-white text-xs font-mono text-gray-800 border-0 focus:ring-0 outline-none resize-none min-h-[250px]"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50/50 min-h-[250px] overflow-y-auto max-h-[350px]">
                    {renderFormattedPreview(formState.content)}
                  </div>
                )}
              </div>

              {/* SEO Optimasi Metadata */}
              <div className="bg-primary-50/30 p-5 rounded-2xl border border-primary-100/30 space-y-4">
                <div className="flex items-center gap-2 border-b border-primary-100/50 pb-2">
                  <Sparkles className="w-4 h-4 text-primary-600" />
                  <h4 className="text-xs font-black text-primary-950 uppercase tracking-wider">SEO Optimasi (Meta Tags)</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">SEO Judul (Meta Title)</label>
                    <input
                      type="text"
                      value={formState.seoTitle}
                      onChange={(e) => handleFormChange('seoTitle', e.target.value)}
                      placeholder="Tentang Kami - GurkyNet PPOB"
                      className="w-full bg-white border border-gray-100 focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">SEO Deskripsi (Meta Description)</label>
                    <input
                      type="text"
                      value={formState.seoDescription}
                      onChange={(e) => handleFormChange('seoDescription', e.target.value)}
                      placeholder="Informasi selengkapnya tentang profil layanan, visi dan misi GurkyNet..."
                      className="w-full bg-white border border-gray-100 focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Status and Release Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Status Publikasi <span className="text-red-500">*</span></label>
                  <select
                    value={formState.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                  >
                    <option value="draft">Draft (Konsep Saja)</option>
                    <option value="published">Published (Rilis Publik)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Tanggal Publikasi</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formState.publishedAt}
                      onChange={(e) => handleFormChange('publishedAt', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition-all"
                    />
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                >
                  Batal
                </button>
                <CmsSaveButton label={editingItem ? 'Simpan' : 'Tambah'} isLoading={saving} />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* READ ONLY RICH PAGE PREVIEW MODAL */}
      {previewOpen && previewItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-mono">Pratinjau Halaman: /{previewItem.slug}</span>
                <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-primary-500" />
                  <span>{previewItem.title}</span>
                </h3>
              </div>
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewItem(null);
                }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Content preview */}
            <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 max-h-[50vh] overflow-y-auto">
              {renderFormattedPreview(previewItem.content)}
            </div>

            {/* SEO Summary info */}
            <div className="p-3.5 bg-primary-50/20 rounded-2xl border border-primary-100/30 text-[10px] space-y-1">
              <div className="font-black text-primary-950 uppercase tracking-wider">SEO Google Snippet Preview</div>
              <div className="text-blue-700 font-bold hover:underline cursor-pointer font-sans text-xs">
                {previewItem.seoTitle || `${previewItem.title} - GurkyNet`}
              </div>
              <div className="text-emerald-700 font-mono leading-none">
                https://gurkynet.my.id/{previewItem.slug}
              </div>
              <p className="text-gray-500 leading-normal">
                {previewItem.seoDescription || 'Belum ada deskripsi SEO yang ditambahkan untuk halaman ini.'}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewItem(null);
                }}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Selesai Meninjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <CmsDeleteConfirmation
        isOpen={deleteOpen}
        title="Hapus Halaman Statis"
        description={`Apakah Anda yakin ingin menghapus halaman "${deletingItem?.title}"? Tindakan ini akan menghentikan rilis halaman ini dari sistem publik.`}
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteOpen(false);
          setDeletingItem(null);
        }}
      />
      <MediaChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        onSelect={handleInsertImage}
        allowedFolder="static-page"
      />
    </div>
  );
};
