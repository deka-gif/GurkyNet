import React, { useState, useEffect } from 'react';
import { Menu, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Check, AlertCircle, ExternalLink, ArrowRight, CornerDownRight, Navigation } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { websiteService } from '../../services';
import { WebsiteMenu } from '../../types';
import {
  CmsPageHeader,
  CmsFilterBar,
  CmsStatusBadge,
  CmsDeleteConfirmation,
  CmsSaveButton,
} from '../../components/common/CmsCommon';

// Helper to render dynamic Lucide icon by name
const DynamicIcon: React.FC<{ name?: string; className?: string }> = ({ name, className = 'w-4 h-4' }) => {
  if (!name) return <Navigation className={className} />;
  // Normalize key
  const iconKey = name.trim();
  const IconComponent = (LucideIcons as any)[iconKey];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  return <Navigation className={className} />;
};

export const MarketingWebsiteMenu: React.FC = () => {
  const [menus, setMenus] = useState<WebsiteMenu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>(''); // '', 'true', 'false'

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WebsiteMenu | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deletingItem, setDeletingItem] = useState<WebsiteMenu | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Form State
  const [formState, setFormState] = useState<{
    title: string;
    slug: string;
    url: string;
    icon: string;
    parentId: number | undefined;
    displayOrder: number;
    visible: boolean;
    openInNewTab: boolean;
  }>({
    title: '',
    slug: '',
    url: '',
    icon: '',
    parentId: undefined,
    displayOrder: 1,
    visible: true,
    openInNewTab: false,
  });

  const fetchMenus = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (searchQuery) filters.keyword = searchQuery;
      if (visibilityFilter !== '') filters.visible = visibilityFilter === 'true';

      const res = await websiteService.getMenus(filters);
      setMenus(res.data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat struktur menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMenus();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, visibilityFilter]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormState({
      title: '',
      slug: '',
      url: '',
      icon: 'Home',
      parentId: undefined,
      displayOrder: menus.length > 0 ? Math.max(...menus.map(m => m.displayOrder)) + 1 : 1,
      visible: true,
      openInNewTab: false,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: WebsiteMenu) => {
    setEditingItem(item);
    setFormState({
      title: item.title,
      slug: item.slug || '',
      url: item.url,
      icon: item.icon || 'Navigation',
      parentId: item.parentId || undefined,
      displayOrder: item.displayOrder,
      visible: item.visible,
      openInNewTab: item.openInNewTab,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenDelete = (item: WebsiteMenu) => {
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
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = { ...formState };
      // Backend expects parent_id as number or null
      payload.parentId = payload.parentId ? Number(payload.parentId) : undefined;

      if (editingItem) {
        await websiteService.updateMenu(editingItem.id, payload);
        setSuccess('Item menu berhasil diperbarui.');
      } else {
        await websiteService.createMenu(payload);
        setSuccess('Item menu baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchMenus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan item menu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    setError(null);
    try {
      await websiteService.deleteMenu(deletingItem.id);
      setSuccess('Item menu berhasil dihapus.');
      setDeleteOpen(false);
      setDeletingItem(null);
      fetchMenus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus item menu.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleVisibility = async (item: WebsiteMenu) => {
    try {
      const updated = await websiteService.updateMenu(item.id, {
        visible: !item.visible,
      });
      setMenus((prev) => prev.map((m) => (m.id === item.id ? updated : m)));
      setSuccess(`Status visibilitas menu "${item.title}" berhasil diubah.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Gagal merubah visibilitas menu.');
    }
  };

  // Build a tree representing parent and child for table representation
  // We can also flat list them and indent child items visually
  const renderMenuRows = () => {
    // Find all root menus
    const rootMenus = menus.filter(m => !m.parentId);
    
    // Sort root menus by displayOrder
    rootMenus.sort((a, b) => a.displayOrder - b.displayOrder);

    const rows: React.ReactNode[] = [];

    const addRow = (item: WebsiteMenu, depth: number = 0) => {
      rows.push(
        <tr key={item.id} className="hover:bg-primary-50/10 transition-colors">
          <td className="py-3.5 px-4 text-center">
            <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-50 border border-gray-100 rounded-xl font-black text-gray-700 text-xs">
              {item.displayOrder}
            </span>
          </td>
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-2">
              {depth > 0 && (
                <div className="flex items-center text-gray-400 shrink-0 ml-4" style={{ paddingLeft: `${(depth - 1) * 16}px` }}>
                  <CornerDownRight className="w-4 h-4" />
                </div>
              )}
              <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600">
                <DynamicIcon name={item.icon} className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <div className="font-extrabold text-gray-900">{item.title}</div>
                {item.slug && <div className="text-[10px] text-gray-400 font-mono">slug: {item.slug}</div>}
              </div>
            </div>
          </td>
          <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
            <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1 hover:text-primary-600">
              <span>{item.url}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </td>
          <td className="py-3.5 px-4">
            {item.openInNewTab ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase">
                Tab Baru
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100 text-[9px] font-bold uppercase">
                Tab Sama
              </span>
            )}
          </td>
          <td className="py-3.5 px-4 text-center">
            <button
              onClick={() => toggleVisibility(item)}
              className="inline-flex items-center outline-none focus:outline-none"
              title={item.visible ? 'Sembunyikan' : 'Tampilkan'}
            >
              {item.visible ? (
                <ToggleRight className="w-8 h-8 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-300" />
              )}
            </button>
          </td>
          <td className="py-3.5 px-4 text-right">
            <div className="flex items-center justify-end gap-2">
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
            </div>
          </td>
        </tr>
      );

      // Find children
      const children = menus.filter(m => m.parentId === item.id);
      children.sort((a, b) => a.displayOrder - b.displayOrder);
      children.forEach(child => addRow(child, depth + 1));
    };

    rootMenus.forEach(root => addRow(root, 0));

    // Also render any orphaned menus if there are database inconsistencies
    const renderedIds = rows.map(r => Number((r as any).key));
    const orphans = menus.filter(m => m.parentId && !renderedIds.includes(m.id));
    orphans.sort((a, b) => a.displayOrder - b.displayOrder);
    orphans.forEach(orph => addRow(orph, 1));

    return rows;
  };

  return (
    <div className="space-y-6 pb-12" id="website-menu-container">
      <CmsPageHeader
        title="Website Menu"
        subtitle="Kelola link navigasi utama, hierarki submenu, urutan, ikon, serta sasaran target halaman portal."
        icon={Menu}
        action={{
          label: 'Tambah Menu',
          onClick: handleOpenCreate,
          icon: Plus,
        }}
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
        searchPlaceholder="Cari menu berdasarkan judul atau url..."
        filters={[
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
          setVisibilityFilter('');
        }}
      />

      {/* Main Table */}
      {loading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-500 font-medium">Memuat data menu...</p>
        </div>
      ) : menus.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center space-y-3">
          <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
            <Menu className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900">Belum Ada Navigasi Menu</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-normal">
              Tidak ditemukan data navigasi menu. Silakan klik tombol "Tambah Menu" di atas untuk menyusun menu pertama Anda.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-16 text-center">Urutan</th>
                  <th className="py-3 px-4">Nama Menu / Submenu</th>
                  <th className="py-3 px-4">Alamat URL</th>
                  <th className="py-3 px-4">Target Link</th>
                  <th className="py-3 px-4 text-center">Tampil</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {renderMenuRows()}
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
                {editingItem ? 'Edit Item Menu' : 'Tambah Item Menu'}
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
                  <label className="text-xs font-bold text-gray-700">Nama Menu <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formState.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="e.g. Beranda"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Slug Navigasi</label>
                  <input
                    type="text"
                    value={formState.slug}
                    onChange={(e) => handleFormChange('slug', e.target.value)}
                    placeholder="e.g. beranda"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Alamat URL <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formState.url}
                    onChange={(e) => handleFormChange('url', e.target.value)}
                    placeholder="e.g. / atau /layanan"
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Ikon Lucide (Nama Ikon)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formState.icon}
                      onChange={(e) => handleFormChange('icon', e.target.value)}
                      placeholder="e.g. Home, Info, Phone, Tag"
                      className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <DynamicIcon name={formState.icon} className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Menu Induk (Parent Menu)</label>
                  <select
                    value={formState.parentId || ''}
                    onChange={(e) => handleFormChange('parentId', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Menu Utama (No Parent) --</option>
                    {menus
                      .filter((m) => !m.parentId && (!editingItem || m.id !== editingItem.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Urutan Urut (Display Order)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formState.displayOrder}
                    onChange={(e) => handleFormChange('displayOrder', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-gray-900">Buka Tab Baru</div>
                    <div className="text-[10px] text-gray-500 leading-none">Mengaktifkan target="_blank".</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.openInNewTab}
                      onChange={(e) => handleFormChange('openInNewTab', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-gray-900">Visibilitas Tampil</div>
                    <div className="text-[10px] text-gray-500 leading-none">Tampilkan menu di navbar publik.</div>
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
        title="Hapus Item Navigasi Menu"
        description={`Apakah Anda yakin ingin menghapus navigasi menu "${deletingItem?.title}"? Tindakan ini juga akan memutuskan submenu yang terhubung.`}
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteOpen(false);
          setDeletingItem(null);
        }}
      />
    </div>
  );
};
