import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  History,
  Loader2,
  RotateCcw,
  Shield,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { websiteService } from '../../services';
import { CmsPageHeader, CmsSaveButton } from '../../components/common/CmsCommon';
import { LegalRichTextEditor } from '../../components/legal/LegalRichTextEditor';
import { LegalProse } from '../../components/legal/legalContent';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

type Permissions = {
  canView: boolean;
  canDraft: boolean;
  canPublish: boolean;
  role: string;
};

type LegalCard = {
  id: number;
  type: string;
  slug: string;
  title: string;
  status: string;
  isDirty: boolean;
  versionNumber: number;
  lastUpdated?: string | null;
  publishedAt?: string | null;
  estimatedReadingMinutes?: number | null;
  updatedBy?: { id: number; name: string } | null;
};

type LegalDetail = LegalCard & {
  content?: string | null;
  draftContent?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;
};

type VersionRow = {
  id: number;
  versionNumber: number;
  label?: string | null;
  source?: string;
  title?: string;
  publishedAt?: string | null;
  author?: { id: number; name: string } | null;
};

const DOC_ICON: Record<string, typeof Shield> = {
  privacy_policy: Shield,
  terms_conditions: FileText,
  refund_policy: RotateCcw,
};

export const MarketingLegalCenter: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Marketing.
  const isOwnerReadOnly = useOwnerReadOnly();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({
    canView: true,
    canDraft: true,
    canPublish: true,
    role: 'marketing',
  });
  const [documents, setDocuments] = useState<LegalCard[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<LegalDetail | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [draftContent, setDraftContent] = useState('');
  const [title, setTitle] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localDirty, setLocalDirty] = useState(false);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  const applyDetail = (payload: any) => {
    const doc = payload.document as LegalDetail;
    setDetail(doc);
    setDraftContent(doc.draftContent || doc.content || '');
    setTitle(doc.title || '');
    setSeoTitle(doc.seoTitle || '');
    setSeoDescription(doc.seoDescription || '');
    setSeoKeywords(doc.seoKeywords || '');
    setCanonicalUrl(doc.canonicalUrl || '');
    setOgImage(doc.ogImage || '');
    setVersions(payload.versions || []);
    setPermissions(payload.permissions || permissions);
    setLocalDirty(false);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await websiteService.getLegalCenter();
      const data = res?.data ?? res;
      setPermissions(data.permissions || permissions);
      setDocuments(data.documents || []);
      if (!activeSlug && data.documents?.[0]?.slug) {
        setActiveSlug(data.documents[0].slug);
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat Legal Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDoc = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await websiteService.getLegalDocument(slug);
      applyDetail(res?.data ?? res);
      const list = await websiteService.getLegalCenter();
      const listData = list?.data ?? list;
      setDocuments(listData.documents || []);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat dokumen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeSlug) void loadDoc(activeSlug);
  }, [activeSlug, loadDoc]);

  const saveDraft = async () => {
    if (!activeSlug || !permissions.canDraft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await websiteService.saveLegalDraft(activeSlug, {
        title,
        draftContent,
        seoTitle,
        seoDescription,
        seoKeywords,
        canonicalUrl,
        ogImage,
      });
      applyDetail(res?.data ?? res);
      flash('Draft berhasil disimpan.');
      await loadList();
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan draft.');
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    if (!activeSlug || !permissions.canDraft) return;
    if (!window.confirm('Buang draft dan kembali ke versi published?')) return;
    setSaving(true);
    try {
      const res = await websiteService.discardLegalDraft(activeSlug);
      applyDetail(res?.data ?? res);
      flash('Draft dibuang.');
      await loadList();
    } catch (e: any) {
      setError(e?.message || 'Gagal membuang draft.');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!activeSlug || !permissions.canPublish) return;
    if (localDirty) {
      await saveDraft();
    }
    setPublishing(true);
    setError(null);
    try {
      const label = window.prompt('Label versi (opsional):', '') || undefined;
      const res = await websiteService.publishLegal(activeSlug, label);
      applyDetail(res?.data ?? res);
      const { notifyCmsLocalSync } = await import('../../lib/cmsSync');
      notifyCmsLocalSync({ scopes: ['LegalUpdated', 'StaticPageUpdated'], reason: 'legal_publish' });
      flash('Dokumen berhasil dipublish. Cache publik di-refresh.');
      await loadList();
    } catch (e: any) {
      setError(e?.message || 'Gagal publish.');
    } finally {
      setPublishing(false);
    }
  };

  const rollback = async (versionId: number) => {
    if (!activeSlug || !permissions.canPublish) return;
    if (!window.confirm('Rollback ke versi ini? Versi baru akan dibuat.')) return;
    setPublishing(true);
    try {
      const res = await websiteService.rollbackLegal(activeSlug, versionId);
      applyDetail(res?.data ?? res);
      flash('Rollback berhasil.');
      setHistoryOpen(false);
      await loadList();
    } catch (e: any) {
      setError(e?.message || 'Gagal rollback.');
    } finally {
      setPublishing(false);
    }
  };

  const markDirty = () => setLocalDirty(true);

  return (
    <div className="space-y-6 pb-16">
      <CmsPageHeader
        title="Legal Center"
        subtitle="Kelola dokumen Privacy Policy, Terms, Refund, dan dokumen legal lainnya."
        icon={Shield}
      />

      {(error || success) && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            error ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}
        >
          {error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {error || success}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
          Role: {permissions.role || '—'}
        </span>
        {!permissions.canDraft && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">Read only</span>
        )}
        {permissions.canDraft && !permissions.canPublish && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
            Staff — draft only
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
        <aside className="space-y-2">
          {documents.map((d) => {
            const Icon = DOC_ICON[d.type] || FileText;
            const active = d.slug === activeSlug;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => setActiveSlug(d.slug)}
                className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all ${
                  active
                    ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/20'
                    : 'bg-white border-gray-100 hover:border-primary-200 text-gray-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${active ? 'text-white' : 'text-primary-600'}`} />
                  <div className="min-w-0">
                    <p className={`font-bold text-sm ${active ? 'text-white' : 'text-gray-900'}`}>{d.title}</p>
                    <p className={`text-xs mt-1 ${active ? 'text-primary-100' : 'text-gray-500'}`}>
                      v{d.versionNumber} · {d.status}
                      {d.isDirty ? ' · dirty' : ''}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {loading && !detail ? (
            <div className="p-12 flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Memuat…
            </div>
          ) : detail ? (
            <>
              <div className="px-5 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between bg-slate-50/60">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">{detail.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    /legal/{detail.slug}
                    {(detail.isDirty || localDirty) && (
                      <span className="ml-2 text-amber-600 font-semibold">• Perubahan belum publish</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <History className="w-4 h-4" /> History
                  </button>
                  <Link
                    to={`/legal/${detail.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink className="w-4 h-4" /> Live
                  </Link>
                  {permissions.canDraft && !isOwnerReadOnly && (
                    <CmsSaveButton
                      type="button"
                      isLoading={saving}
                      onClick={() => void saveDraft()}
                      label="Save Draft"
                    />
                  )}
                  {permissions.canDraft && !isOwnerReadOnly && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void discard()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Discard
                    </button>
                  )}
                  {permissions.canPublish && !isOwnerReadOnly && (
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() => void publish()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold shadow-md shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Publish
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Title</label>
                  <input
                    value={title}
                    disabled={!permissions.canDraft || isOwnerReadOnly}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Content</label>
                  <LegalRichTextEditor
                    value={draftContent}
                    disabled={!permissions.canDraft || isOwnerReadOnly}
                    onChange={(html) => {
                      setDraftContent(html);
                      markDirty();
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div className="md:col-span-2">
                    <p className="text-sm font-bold text-gray-800 mb-3">SEO</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Meta Title</label>
                    <input
                      value={seoTitle}
                      disabled={!permissions.canDraft || isOwnerReadOnly}
                      onChange={(e) => {
                        setSeoTitle(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">SEO Keywords</label>
                    <input
                      value={seoKeywords}
                      disabled={!permissions.canDraft || isOwnerReadOnly}
                      onChange={(e) => {
                        setSeoKeywords(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Meta Description</label>
                    <textarea
                      value={seoDescription}
                      disabled={!permissions.canDraft || isOwnerReadOnly}
                      rows={2}
                      onChange={(e) => {
                        setSeoDescription(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Canonical URL</label>
                    <input
                      value={canonicalUrl}
                      disabled={!permissions.canDraft || isOwnerReadOnly}
                      onChange={(e) => {
                        setCanonicalUrl(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">OG Image URL</label>
                    <input
                      value={ogImage}
                      disabled={!permissions.canDraft || isOwnerReadOnly}
                      onChange={(e) => {
                        setOgImage(e.target.value);
                        markDirty();
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-gray-500 text-sm">Pilih dokumen di sidebar.</div>
          )}
        </section>
      </div>

      {previewOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setPreviewOpen(false)} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <p className="font-bold text-gray-900">Preview Draft — {title}</p>
              <button type="button" onClick={() => setPreviewOpen(false)} className="text-sm font-semibold text-gray-500">
                Tutup
              </button>
            </div>
            <div className="p-6 md:p-8">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-6">{title}</h1>
              <LegalProse html={draftContent} />
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setHistoryOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <p className="font-bold text-gray-900">Version History</p>
              <button type="button" onClick={() => setHistoryOpen(false)} className="text-sm font-semibold text-gray-500">
                Tutup
              </button>
            </div>
            <ul className="divide-y divide-gray-100">
              {versions.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-gray-500">Belum ada versi published.</li>
              )}
              {versions.map((v) => (
                <li key={v.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-gray-900">
                      v{v.versionNumber} · {v.label || '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {v.source} · {v.author?.name || 'System'} ·{' '}
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString('id-ID') : '—'}
                    </p>
                  </div>
                  {permissions.canPublish && !isOwnerReadOnly && (
                    <button
                      type="button"
                      onClick={() => void rollback(v.id)}
                      className="text-xs font-bold text-primary-700 hover:underline shrink-0"
                    >
                      Rollback
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
