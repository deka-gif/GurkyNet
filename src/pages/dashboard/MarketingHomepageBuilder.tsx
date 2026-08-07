import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Upload,
  RotateCcw,
  Trash2,
  ExternalLink,
  History,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Tablet,
  Smartphone,
  Layers3,
} from 'lucide-react';
import { websiteService } from '../../services';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { CmsPageHeader, CmsSaveButton } from '../../components/common/CmsCommon';
import type { Media } from '../../types';

type BuilderSection = {
  id?: number | null;
  tempKey: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  componentType: string;
  enabled: boolean;
  displayOrder: number;
  description?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  animation?: string;
  contentItems?: any[];
  config?: Record<string, any>;
  heroBackgroundMediaId?: number | null;
  heroIllustrationMediaId?: number | null;
  heroMobileImageMediaId?: number | null;
};

type BuilderVersion = {
  id: number;
  versionNumber: number;
  label?: string | null;
  source?: string;
  publishedAt?: string | null;
  author?: { id: number; name: string } | null;
};

type Permissions = {
  canView: boolean;
  canDraft: boolean;
  canPublish: boolean;
  role: string;
};

const TYPE_LABEL: Record<string, string> = {
  hero: 'Hero Banner',
  banner: 'Promo Banner',
  promo: 'Promo / Features',
  features: 'Feature',
  categories: 'Service Categories',
  product_grid: 'Product Grid',
  statistics: 'Statistics',
  why_us: 'Why Choose Us',
  partners: 'Partner',
  testimonials: 'Testimonials',
  how_it_works: 'How It Works',
  announcement: 'Contact / Announcement',
  news: 'News',
  faq: 'FAQ',
  cta: 'CTA',
  footer: 'Footer CTA',
  seo: 'SEO / Meta',
};

export const MarketingHomepageBuilder: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [versions, setVersions] = useState<BuilderVersion[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({
    canView: true,
    canDraft: true,
    canPublish: true,
    role: 'marketing',
  });
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<BuilderSection | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewSections, setPreviewSections] = useState<BuilderSection[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserKey, setChooserKey] = useState<'heroBackground' | 'heroIllustration' | 'heroMobileImage' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await websiteService.getHomepageBuilder();
      const data = res?.data ?? res;
      setPermissions(data.permissions || permissions);
      setSections(data.draft?.sections || []);
      setIsDirty(Boolean(data.draft?.isDirty));
      setVersions(data.versions || []);
      setLatestVersion(data.published?.latestVersion ?? null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat Homepage Builder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.displayOrder - b.displayOrder),
    [sections]
  );

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  const persistDraft = async (next: BuilderSection[]) => {
    if (!permissions.canDraft) return;
    setSaving(true);
    setError(null);
    try {
      const normalized = next.map((s, idx) => ({ ...s, displayOrder: idx + 1 }));
      const res = await websiteService.saveHomepageBuilderDraft(normalized);
      const data = res?.data ?? res;
      setSections(data.draft?.sections || normalized);
      setIsDirty(Boolean(data.draft?.isDirty));
      setVersions(data.versions || versions);
      flash('Draft tersimpan.');
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan draft.');
    } finally {
      setSaving(false);
    }
  };

  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index || !permissions.canDraft) return;
    const next = [...ordered];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setSections(next.map((s, i) => ({ ...s, displayOrder: i + 1 })));
    setDragIndex(index);
    setIsDirty(true);
  };
  const onDragEnd = async () => {
    setDragIndex(null);
    if (permissions.canDraft) {
      await persistDraft(ordered);
    }
  };

  const toggleEnabled = async (sec: BuilderSection) => {
    if (!permissions.canDraft) return;
    const next = ordered.map((s) =>
      s.tempKey === sec.tempKey ? { ...s, enabled: !s.enabled } : s
    );
    setSections(next);
    await persistDraft(next);
  };

  const openEdit = (sec: BuilderSection) => {
    setEditing({
      ...sec,
      contentItems: sec.contentItems || [],
      config: sec.config || {},
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing || !permissions.canDraft) return;
    const next = ordered.map((s) => (s.tempKey === editing.tempKey ? { ...editing } : s));
    setSections(next);
    setEditOpen(false);
    await persistDraft(next);
  };

  const publish = async () => {
    if (!permissions.canPublish) {
      setError('Akun ini hanya boleh draft. Minta Owner / Marketing Manager untuk Publish.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      if (isDirty) await persistDraft(ordered);
      const res = await websiteService.publishHomepageBuilder(`Publish ${new Date().toLocaleString('id-ID')}`);
      const data = res?.data ?? res;
      setSections(data.draft?.sections || []);
      setIsDirty(false);
      setVersions(data.versions || []);
      setLatestVersion(data.published?.latestVersion ?? null);
      const { notifyCmsLocalSync } = await import('../../lib/cmsSync');
      notifyCmsLocalSync({ scopes: ['HomepageUpdated'], reason: 'homepage_builder_publish' });
      flash('Homepage berhasil dipublish. Cache diperbarui.');
    } catch (e: any) {
      setError(e?.message || 'Publish gagal.');
    } finally {
      setPublishing(false);
    }
  };

  const discard = async () => {
    if (!permissions.canDraft) return;
    if (!window.confirm('Buang seluruh perubahan draft dan kembali ke versi published?')) return;
    setSaving(true);
    try {
      const res = await websiteService.discardHomepageBuilderDraft();
      const data = res?.data ?? res;
      setSections(data.draft?.sections || []);
      setIsDirty(false);
      flash('Draft dibuang.');
    } catch (e: any) {
      setError(e?.message || 'Discard gagal.');
    } finally {
      setSaving(false);
    }
  };

  const rollback = async (versionId: number) => {
    if (!permissions.canPublish) return;
    if (!window.confirm('Rollback ke versi ini? Homepage production akan langsung berubah.')) return;
    setPublishing(true);
    try {
      const res = await websiteService.rollbackHomepageBuilder(versionId);
      const data = res?.data ?? res;
      setSections(data.draft?.sections || []);
      setIsDirty(false);
      setVersions(data.versions || []);
      setLatestVersion(data.published?.latestVersion ?? null);
      setHistoryOpen(false);
      flash('Rollback berhasil. Cache diperbarui.');
    } catch (e: any) {
      setError(e?.message || 'Rollback gagal.');
    } finally {
      setPublishing(false);
    }
  };

  const openPreview = async () => {
    setPreviewOpen(true);
    try {
      if (isDirty && permissions.canDraft) {
        await persistDraft(ordered);
      }
      const res = await websiteService.previewHomepageBuilder();
      const data = res?.data ?? res;
      setPreviewSections(data.sections || ordered.filter((s) => s.enabled));
    } catch {
      setPreviewSections(ordered.filter((s) => s.enabled));
    }
  };

  const previewWidth =
    previewMode === 'desktop' ? 'max-w-5xl' : previewMode === 'tablet' ? 'max-w-2xl' : 'max-w-sm';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Memuat Homepage Builder…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <CmsPageHeader
        title="Homepage Builder"
        subtitle="Atur urutan, status, dan isi seluruh section Homepage tanpa mengubah source code. Publish untuk menerapkan ke production."
        icon={Layers3}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            isDirty ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {isDirty ? 'Draft berubah (belum publish)' : 'Sinkron dengan published'}
        </span>
        {latestVersion != null && (
          <span className="text-xs font-semibold text-slate-500">Published v{latestVersion}</span>
        )}
        {!permissions.canDraft && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600">Read only</span>
        )}
        {permissions.canDraft && !permissions.canPublish && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700">
            Draft only (Staff)
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!permissions.canDraft || saving}
          onClick={() => void persistDraft(ordered)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save Draft
        </button>
        <button
          type="button"
          disabled={!permissions.canPublish || publishing}
          onClick={() => void publish()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Publish
        </button>
        <button
          type="button"
          disabled={!permissions.canDraft || saving}
          onClick={() => void discard()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Discard
        </button>
        <button
          type="button"
          onClick={() => void openPreview()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="w-4 h-4" />
          Preview Homepage
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <History className="w-4 h-4" />
          Version History
        </button>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <Eye className="w-4 h-4" />
          Lihat Live
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-900">Sections</p>
          <p className="text-[11px] text-slate-400 font-semibold">
            {permissions.canDraft ? 'Drag ☰ untuk mengubah urutan' : 'Urutan & status read-only'}
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {ordered.map((sec, index) => (
            <li
              key={sec.tempKey}
              draggable={permissions.canDraft}
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={() => void onDragEnd()}
              className={`flex items-center gap-3 px-4 py-3 ${dragIndex === index ? 'bg-indigo-50' : 'bg-white'} ${
                permissions.canDraft ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{sec.title}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {TYPE_LABEL[sec.componentType] || sec.componentType}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Order {sec.displayOrder} · {sec.slug}
                </p>
              </div>
              <button
                type="button"
                disabled={!permissions.canDraft}
                onClick={() => void toggleEnabled(sec)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                  sec.enabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {sec.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {sec.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => openEdit(sec)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </li>
          ))}
          {ordered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-500">Belum ada section. Seed default akan muncul setelah sync.</li>
          )}
        </ul>
      </div>

      {/* Edit modal */}
      {editOpen && editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900">Konfigurasi Section</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-800 text-sm font-bold">
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Judul / Headline
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                  value={editing.title}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Sub Judul
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                  value={editing.subtitle || ''}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                />
              </label>
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              Deskripsi
              <textarea
                rows={3}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                value={editing.description || ''}
                disabled={!permissions.canDraft}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Primary Button
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={editing.buttonLabel || ''}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, buttonLabel: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Button URL
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  value={editing.buttonUrl || ''}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, buttonUrl: e.target.value })}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Background
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  value={editing.backgroundColor || ''}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, backgroundColor: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Text Color
                <input
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  value={editing.textColor || ''}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, textColor: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                Animation
                <select
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  value={editing.animation || 'fade'}
                  disabled={!permissions.canDraft}
                  onChange={(e) => setEditing({ ...editing, animation: e.target.value })}
                >
                  <option value="fade">Fade</option>
                  <option value="slide_up">Slide Up</option>
                  <option value="scale">Scale</option>
                  <option value="none">None</option>
                </select>
              </label>
            </div>

            {(editing.componentType === 'hero' || editing.componentType === 'banner') && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Images</p>
                <div className="flex flex-wrap gap-2">
                  {(['heroBackground', 'heroIllustration', 'heroMobileImage'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={!permissions.canDraft}
                      onClick={() => {
                        setChooserKey(key);
                        setChooserOpen(true);
                      }}
                      className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      {key === 'heroBackground' ? 'Desktop Image' : key === 'heroMobileImage' ? 'Mobile Image' : 'Illustration'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(editing.componentType === 'banner' || editing.componentType === 'categories') && (
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                Config JSON (bannerIds / categoryKeys)
                <textarea
                  rows={4}
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-mono"
                  disabled={!permissions.canDraft}
                  value={JSON.stringify(editing.config || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setEditing({ ...editing, config: JSON.parse(e.target.value || '{}') });
                    } catch {
                      /* ignore while typing */
                    }
                  }}
                />
              </label>
            )}

            {['features', 'statistics', 'partners', 'testimonials', 'faq', 'why_us'].includes(editing.componentType) && (
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                Content Items (JSON array)
                <textarea
                  rows={6}
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-mono"
                  disabled={!permissions.canDraft}
                  value={JSON.stringify(editing.contentItems || [], null, 2)}
                  onChange={(e) => {
                    try {
                      setEditing({ ...editing, contentItems: JSON.parse(e.target.value || '[]') });
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">
                Batal
              </button>
              {permissions.canDraft && (
                <CmsSaveButton
                  type="button"
                  isLoading={saving}
                  onClick={() => void saveEdit()}
                  label="Simpan ke Draft"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex flex-col">
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
            <p className="font-extrabold text-slate-900 text-sm">Preview Homepage (Draft)</p>
            <div className="flex items-center gap-2">
              {(
                [
                  ['desktop', Monitor],
                  ['tablet', Tablet],
                  ['mobile', Smartphone],
                ] as const
              ).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`p-2 rounded-lg border ${previewMode === mode ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
              <button type="button" onClick={() => setPreviewOpen(false)} className="ml-2 text-sm font-bold text-slate-600 px-3 py-2">
                Tutup
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className={`mx-auto ${previewWidth} bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden`}>
              {previewSections.map((sec) => (
                <div key={sec.tempKey} className="border-b border-slate-100 px-6 py-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    {TYPE_LABEL[sec.componentType] || sec.componentType}
                  </p>
                  {sec.subtitle && <p className="text-xs font-bold text-indigo-600 mb-1">{sec.subtitle}</p>}
                  <h3 className="text-xl font-extrabold text-slate-900">{sec.title}</h3>
                  {sec.description && <p className="mt-2 text-sm text-slate-600">{sec.description}</p>}
                  {sec.buttonLabel && (
                    <span className="inline-block mt-4 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white">
                      {sec.buttonLabel}
                    </span>
                  )}
                </div>
              ))}
              {previewSections.length === 0 && (
                <p className="p-10 text-center text-sm text-slate-500">Tidak ada section aktif di draft.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version history */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900">Version History</h3>
              <button type="button" onClick={() => setHistoryOpen(false)} className="text-sm font-bold text-slate-500">
                Tutup
              </button>
            </div>
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="rounded-xl border border-slate-200 px-3 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">v{v.versionNumber}</p>
                    <p className="text-[11px] text-slate-500">
                      {v.label || v.source} · {v.author?.name || 'System'} ·{' '}
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString('id-ID') : '—'}
                    </p>
                  </div>
                  {permissions.canPublish && (
                    <button
                      type="button"
                      onClick={() => void rollback(v.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rollback
                    </button>
                  )}
                </li>
              ))}
              {versions.length === 0 && <p className="text-sm text-slate-500 text-center py-6">Belum ada versi published.</p>}
            </ul>
          </div>
        </div>
      )}

      <MediaChooserModal
        isOpen={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onSelect={(url: string, media?: Media) => {
          if (!editing || !chooserKey) return;
          const idKey =
            chooserKey === 'heroBackground'
              ? 'heroBackgroundMediaId'
              : chooserKey === 'heroIllustration'
                ? 'heroIllustrationMediaId'
                : 'heroMobileImageMediaId';
          setEditing({
            ...editing,
            [idKey]: media?.id ?? null,
            config: {
              ...(editing.config || {}),
              [`${chooserKey}Url`]: url,
            },
          });
          setChooserOpen(false);
        }}
      />
    </div>
  );
};
