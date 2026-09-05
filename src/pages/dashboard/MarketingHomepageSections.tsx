import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Check, AlertCircle, RefreshCw, Layers3, Image as ImageIcon, X } from 'lucide-react';
import { websiteService } from '../../services';
import { HomepageSection, HomepageSectionComponentType, Media } from '../../types';
import {
  CmsPageHeader,
  CmsFilterBar,
  CmsStatusBadge,
  CmsDeleteConfirmation,
  CmsSaveButton,
} from '../../components/common/CmsCommon';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

const COMPONENT_TYPE_OPTIONS = [
  { label: 'Semua Tipe', value: '' },
  { label: 'Hero Section', value: 'hero' },
  { label: 'Banner / Promo Banner', value: 'banner' },
  { label: 'Promo / Features', value: 'promo' },
  { label: 'Features', value: 'features' },
  { label: 'Kategori Layanan', value: 'categories' },
  { label: 'Grid Produk', value: 'product_grid' },
  { label: 'Statistics', value: 'statistics' },
  { label: 'Why Choose Us', value: 'why_us' },
  { label: 'Partner', value: 'partners' },
  { label: 'Testimonials', value: 'testimonials' },
  { label: 'How It Works', value: 'how_it_works' },
  { label: 'Pengumuman / Kontak', value: 'announcement' },
  { label: 'Berita & Artikel', value: 'news' },
  { label: 'Tanya Jawab (FAQ)', value: 'faq' },
  { label: 'CTA', value: 'cta' },
  { label: 'Footer CTA', value: 'footer' },
  { label: 'SEO / Meta', value: 'seo' },
];

export const MarketingHomepageSections: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>(''); // '', 'true', 'false'

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<HomepageSection | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deletingItem, setDeletingItem] = useState<HomepageSection | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Form State
  const [isChooserOpen, setIsChooserOpen] = useState<boolean>(false);
  const [chooserKey, setChooserKey] = useState<'heroBackground' | 'heroIllustration' | 'heroMobileImage' | null>(null);

  const [formState, setFormState] = useState<{
    title: string;
    subtitle: string;
    slug: string;
    componentType: HomepageSectionComponentType;
    displayOrder: number;
    visible: boolean;
    status: string;
    description: string;
    backgroundColor: string;
    textColor: string;
    buttonLabel: string;
    buttonUrl: string;
    animation: string;
    contentItemsJson: string;
    heroBackgroundMediaId?: number;
    heroIllustrationMediaId?: number;
    heroMobileImageMediaId?: number;
    heroBackground?: string;
    heroIllustration?: string;
    heroMobileImage?: string;
    heroBackgroundMedia?: Media;
    heroIllustrationMedia?: Media;
    heroMobileImageMedia?: Media;
  }>({
    title: '',
    subtitle: '',
    slug: '',
    componentType: 'hero',
    displayOrder: 1,
    visible: true,
    status: 'active',
    description: '',
    backgroundColor: '',
    textColor: '',
    buttonLabel: '',
    buttonUrl: '',
    animation: 'fade',
    contentItemsJson: '[]',
    heroBackgroundMediaId: undefined,
    heroIllustrationMediaId: undefined,
    heroMobileImageMediaId: undefined,
    heroBackground: '',
    heroIllustration: '',
    heroMobileImage: '',
    heroBackgroundMedia: undefined,
    heroIllustrationMedia: undefined,
    heroMobileImageMedia: undefined,
  });

  const fetchSections = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (searchQuery) filters.keyword = searchQuery;
      if (componentTypeFilter) filters.component_type = componentTypeFilter;
      if (visibilityFilter !== '') filters.visible = visibilityFilter === 'true';

      const res = await websiteService.getSections(filters);
      setSections(res.data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar homepage section.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSections();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, componentTypeFilter, visibilityFilter]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormState({
      title: '',
      subtitle: '',
      slug: '',
      componentType: 'hero',
      displayOrder: sections.length > 0 ? Math.max(...sections.map(s => s.displayOrder)) + 1 : 1,
      visible: true,
      status: 'active',
      description: '',
      backgroundColor: '',
      textColor: '',
      buttonLabel: '',
      buttonUrl: '',
      animation: 'fade',
      contentItemsJson: '[]',
      heroBackgroundMediaId: undefined,
      heroIllustrationMediaId: undefined,
      heroMobileImageMediaId: undefined,
      heroBackground: '',
      heroIllustration: '',
      heroMobileImage: '',
      heroBackgroundMedia: undefined,
      heroIllustrationMedia: undefined,
      heroMobileImageMedia: undefined,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HomepageSection) => {
    setEditingItem(item);
    setFormState({
      title: item.title,
      subtitle: item.subtitle || '',
      slug: item.slug,
      componentType: item.componentType,
      displayOrder: item.displayOrder,
      visible: item.visible,
      status: item.status || 'active',
      description: item.description || '',
      backgroundColor: item.backgroundColor || '',
      textColor: item.textColor || '',
      buttonLabel: item.buttonLabel || '',
      buttonUrl: item.buttonUrl || '',
      animation: item.animation || 'fade',
      contentItemsJson: JSON.stringify(item.contentItems || [], null, 2),
      heroBackgroundMediaId: item.heroBackgroundMediaId,
      heroIllustrationMediaId: item.heroIllustrationMediaId,
      heroMobileImageMediaId: item.heroMobileImageMediaId,
      heroBackground: item.heroBackground || '',
      heroIllustration: item.heroIllustration || '',
      heroMobileImage: item.heroMobileImage || '',
      heroBackgroundMedia: item.heroBackgroundMedia,
      heroIllustrationMedia: item.heroIllustrationMedia,
      heroMobileImageMedia: item.heroMobileImageMedia,
    });
    setError(null);
    setModalOpen(true);
  };

  const openMediaChooser = (key: 'heroBackground' | 'heroIllustration' | 'heroMobileImage') => {
    setChooserKey(key);
    setIsChooserOpen(true);
  };

  const handleMediaSelect = (url: string, mediaItem?: Media) => {
    if (chooserKey) {
      setFormState((prev) => ({
        ...prev,
        [`${chooserKey}MediaId`]: mediaItem?.id,
        [`${chooserKey}Media`]: mediaItem,
        [chooserKey]: url,
      }));
    }
  };

  const handleOpenDelete = (item: HomepageSection) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormState((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-generate slug from title if title changes and we are creating or edit without custom slug change
      if (key === 'title') {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let contentItems: any[] = [];
      try {
        contentItems = JSON.parse(formState.contentItemsJson || '[]');
        if (!Array.isArray(contentItems)) throw new Error('content_items must be array');
      } catch {
        setError('Content Items harus JSON array yang valid.');
        setSaving(false);
        return;
      }

      const payload = {
        ...formState,
        contentItems,
      };

      if (editingItem) {
        await websiteService.updateSection(editingItem.id, payload);
        setSuccess('Homepage section berhasil diperbarui.');
      } else {
        await websiteService.createSection(payload);
        setSuccess('Homepage section baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchSections();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan homepage section.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    setError(null);
    try {
      await websiteService.deleteSection(deletingItem.id);
      setSuccess('Homepage section berhasil dihapus.');
      setDeleteOpen(false);
      setDeletingItem(null);
      fetchSections();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus homepage section.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleVisibility = async (item: HomepageSection) => {
    try {
      const updated = await websiteService.updateSection(item.id, {
        visible: !item.visible,
      });
      setSections((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
      setSuccess(`Status visibilitas section "${item.title}" berhasil diubah.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal merubah visibilitas section.');
    }
  };

  const getComponentTypeLabel = (val: string) => {
    const opt = COMPONENT_TYPE_OPTIONS.find((o) => o.value === val);
    return opt ? opt.label : val;
  };

  return (
    <div className="space-y-6 pb-12" id="homepage-sections-container">
      <CmsPageHeader
        title="Edit Live Homepage"
        subtitle="Edit langsung section homepage yang sedang aktif. Gunakan dengan hati-hati — perubahan dapat langsung terlihat di website."
        icon={Layers}
        action={
          !isOwnerReadOnly
            ? {
                label: 'Tambah Section',
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
        searchPlaceholder="Cari section berdasarkan nama atau slug..."
        filters={[
          {
            label: 'Tipe Komponen',
            value: componentTypeFilter,
            onChange: setComponentTypeFilter,
            options: COMPONENT_TYPE_OPTIONS,
          },
          {
            label: 'Visibilitas',
            value: visibilityFilter,
            onChange: setVisibilityFilter,
            options: [
              { label: 'Semua Status', value: '' },
              { label: 'Aktif / Terlihat', value: 'true' },
              { label: 'Nonaktif / Sembunyi', value: 'false' },
            ],
          },
        ]}
        onReset={() => {
          setSearchQuery('');
          setComponentTypeFilter('');
          setVisibilityFilter('');
        }}
      />

      {/* Main Table */}
      {loading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-500 font-medium">Memuat data sections...</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-3">
          <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
            <Layers3 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900">Belum Ada Section Terdaftar</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-normal">
              Tidak ditemukan data homepage section yang sesuai dengan filter pencarian Anda. Silakan klik tombol "Tambah Section" di atas.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-16 text-center">Urutan</th>
                  <th className="py-3 px-4">Nama Section</th>
                  <th className="py-3 px-4">Tipe Komponen</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Visibilitas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {sections.map((item) => (
                  <tr key={item.id} className="hover:bg-primary-50/10 transition-colors">
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-50 border border-gray-100 rounded-xl font-black text-gray-700 text-xs">
                        {item.displayOrder}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-gray-900">{item.title}</div>
                      <div className="text-[10px] text-gray-400 font-mono">slug: {item.slug}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 text-[10px] font-bold uppercase">
                        {getComponentTypeLabel(item.componentType)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <CmsStatusBadge status={item.status} />
                    </td>
                    <td className="py-4 px-4 text-center">
                      {!isOwnerReadOnly && (
                        <button
                          onClick={() => toggleVisibility(item)}
                          className={`inline-flex items-center transition-colors outline-none focus:outline-none`}
                          title={item.visible ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {item.visible ? (
                            <ToggleRight className="w-8 h-8 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-300" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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

      {/* CREATE & EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-900 text-base">
                {editingItem ? 'Edit Homepage Section' : 'Tambah Homepage Section'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Judul Section <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formState.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="e.g. Hero Utama"
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
                    placeholder="e.g. hero-utama"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Tipe Komponen <span className="text-red-500">*</span></label>
                  <select
                    value={formState.componentType}
                    onChange={(e) => handleFormChange('componentType', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                  >
                    {COMPONENT_TYPE_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Urutan Tampilan <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formState.displayOrder}
                    onChange={(e) => handleFormChange('displayOrder', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Status <span className="text-red-500">*</span></label>
                  <select
                    value={formState.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Sub Judul</label>
                <input
                  type="text"
                  value={formState.subtitle}
                  onChange={(e) => handleFormChange('subtitle', e.target.value)}
                  placeholder="Sub judul singkat untuk section"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Deskripsi</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Keterangan mengenai peruntukan section ini..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Button Label</label>
                  <input
                    type="text"
                    value={formState.buttonLabel}
                    onChange={(e) => handleFormChange('buttonLabel', e.target.value)}
                    placeholder="e.g. Mulai Sekarang"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs outline-none font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Button URL</label>
                  <input
                    type="text"
                    value={formState.buttonUrl}
                    onChange={(e) => handleFormChange('buttonUrl', e.target.value)}
                    placeholder="/register atau #features"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs outline-none font-medium font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Background</label>
                  <input
                    type="text"
                    value={formState.backgroundColor}
                    onChange={(e) => handleFormChange('backgroundColor', e.target.value)}
                    placeholder="#ffffff"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Text Color</label>
                  <input
                    type="text"
                    value={formState.textColor}
                    onChange={(e) => handleFormChange('textColor', e.target.value)}
                    placeholder="#111827"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Animation</label>
                  <select
                    value={formState.animation}
                    onChange={(e) => handleFormChange('animation', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="fade">Fade</option>
                    <option value="slide_up">Slide Up</option>
                    <option value="scale">Scale</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Content Items (JSON array)</label>
                <textarea
                  value={formState.contentItemsJson}
                  onChange={(e) => handleFormChange('contentItemsJson', e.target.value)}
                  placeholder='[{"title":"Aman","description":"...","value":"99%"}]'
                  rows={5}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-[11px] text-gray-900 outline-none font-mono resize-y"
                />
                <p className="text-[10px] text-gray-400 font-medium">
                  Dipakai untuk statistics / partners / testimonials / features. Simpan sebagai array JSON.
                </p>
              </div>

              {formState.componentType === 'hero' && (
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <ImageIcon className="w-4 h-4 text-primary-500" />
                    <span className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider">Konten Gambar Hero</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Background */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Background</label>
                      {formState.heroBackground ? (
                        <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                          <img
                            src={formState.heroBackground}
                            alt="BG"
                            className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                          />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-gray-800 truncate max-w-[50px]">
                              {formState.heroBackgroundMedia?.filename || 'BG'}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openMediaChooser('heroBackground')}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600 transition"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormState((prev) => ({
                                    ...prev,
                                    heroBackground: '',
                                    heroBackgroundMediaId: undefined,
                                    heroBackgroundMedia: undefined,
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
                          onClick={() => openMediaChooser('heroBackground')}
                          className="w-full h-24 border border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-primary-600 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition" />
                          <span className="text-[9px] font-black uppercase tracking-wider">Pilih BG</span>
                        </button>
                      )}
                    </div>

                    {/* Illustration */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Illustration</label>
                      {formState.heroIllustration ? (
                        <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                          <img
                            src={formState.heroIllustration}
                            alt="Ilustrasi"
                            className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                          />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-gray-800 truncate max-w-[50px]">
                              {formState.heroIllustrationMedia?.filename || 'Ilustrasi'}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openMediaChooser('heroIllustration')}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600 transition"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormState((prev) => ({
                                    ...prev,
                                    heroIllustration: '',
                                    heroIllustrationMediaId: undefined,
                                    heroIllustrationMedia: undefined,
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
                          onClick={() => openMediaChooser('heroIllustration')}
                          className="w-full h-24 border border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-primary-600 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition" />
                          <span className="text-[9px] font-black uppercase tracking-wider">Ilustrasi</span>
                        </button>
                      )}
                    </div>

                    {/* Mobile Image */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Mobile</label>
                      {formState.heroMobileImage ? (
                        <div className="relative group rounded-xl border border-gray-100 p-1.5 bg-white flex flex-col gap-1">
                          <img
                            src={formState.heroMobileImage}
                            alt="Mobile"
                            className="w-full h-16 object-cover rounded-lg border border-gray-100 bg-gray-50"
                          />
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-gray-800 truncate max-w-[50px]">
                              {formState.heroMobileImageMedia?.filename || 'Mobile'}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openMediaChooser('heroMobileImage')}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600 transition"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormState((prev) => ({
                                    ...prev,
                                    heroMobileImage: '',
                                    heroMobileImageMediaId: undefined,
                                    heroMobileImageMedia: undefined,
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
                          onClick={() => openMediaChooser('heroMobileImage')}
                          className="w-full h-24 border border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-xl flex flex-col items-center justify-center gap-1 transition group text-gray-400 hover:text-primary-600 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition" />
                          <span className="text-[9px] font-black uppercase tracking-wider">Mobile</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-gray-900">Visibilitas Langsung</div>
                  <div className="text-[10px] text-gray-500 leading-none">Aktifkan untuk langsung menampilkan ke publik.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.visible}
                    onChange={(e) => handleFormChange('visible', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
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

      {/* Delete Confirmation */}
      <CmsDeleteConfirmation
        isOpen={deleteOpen}
        title="Hapus Homepage Section"
        description={`Apakah Anda yakin ingin menghapus section "${deletingItem?.title}"? Tindakan ini akan menghapus data section dari halaman utama.`}
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
        onSelect={handleMediaSelect}
      />
    </div>
  );
};
