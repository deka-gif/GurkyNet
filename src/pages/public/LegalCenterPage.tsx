import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  Menu,
  RotateCcw,
  Shield,
  X,
} from 'lucide-react';
import { websiteService } from '../../services';
import { EmptyState, ServerErrorState } from '../../components/ui/FeedbackStates';
import {
  LegalProse,
  prepareLegalHtml,
  type TocItem,
} from '../../components/legal/legalContent';

type LegalNavItem = {
  type: string;
  slug: string;
  title: string;
  icon?: string;
  lastUpdated?: string | null;
  estimatedReadingMinutes?: number | null;
};

type LegalDocument = {
  type: string;
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;
  lastUpdated?: string | null;
  estimatedReadingMinutes?: number | null;
  versionNumber?: number;
  documents?: LegalNavItem[];
  schema?: Record<string, unknown>;
  preview?: boolean;
};

const ICON_MAP: Record<string, typeof Shield> = {
  shield: Shield,
  'file-text': FileText,
  'rotate-ccw': RotateCcw,
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLinkRel(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function applySeo(doc: LegalDocument) {
  const title = doc.seoTitle || `${doc.title} | GurkyNet Legal Center`;
  document.title = title;
  setMetaTag('name', 'description', doc.seoDescription || '');
  setMetaTag('name', 'keywords', doc.seoKeywords || '');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', doc.seoDescription || '');
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:url', doc.canonicalUrl || window.location.href);
  if (doc.ogImage) setMetaTag('property', 'og:image', doc.ogImage);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', doc.seoDescription || '');
  if (doc.ogImage) setMetaTag('name', 'twitter:image', doc.ogImage);
  setLinkRel('canonical', doc.canonicalUrl || window.location.href);

  const existing = document.getElementById('legal-schema-jsonld');
  if (existing) existing.remove();
  if (doc.schema) {
    const script = document.createElement('script');
    script.id = 'legal-schema-jsonld';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(doc.schema);
    document.head.appendChild(script);
  }
}

export const LegalCenterPage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [nav, setNav] = useState<LegalNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeToc, setActiveToc] = useState<string | null>(null);

  const activeSlug = slug || nav[0]?.slug || 'privacy-policy';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const target = slug || 'privacy-policy';
      if (!slug) {
        // Index: load list then redirect handled below via Navigate
        const indexRes = await websiteService.getPublicLegalIndex();
        const payload = (indexRes as any)?.data ?? indexRes;
        const docs = payload?.documents || [];
        setNav(docs);
        setDoc(null);
        return;
      }
      const res = await websiteService.getPublicLegalDocument(target);
      const data = (res?.data || res) as LegalDocument;
      setDoc(data);
      setNav(data.documents || []);
      applySeo(data);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat Legal Center.');
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const prepared = useMemo(
    () => prepareLegalHtml(doc?.content || ''),
    [doc?.content]
  );
  const toc: TocItem[] = prepared.toc;

  useEffect(() => {
    if (!toc.length) return;
    const observers: IntersectionObserver[] = [];
    toc.forEach((item) => {
      const el = document.getElementById(item.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveToc(item.id);
        },
        { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [toc, doc?.content]);

  if (!slug && !loading && nav.length > 0) {
    return <Navigate to={`/legal/${nav[0].slug}`} replace />;
  }

  if (!slug && !loading && !error) {
    return <Navigate to="/legal/privacy-policy" replace />;
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveToc(id);
      setDrawerOpen(false);
    }
  };

  const SidebarNav = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? 'p-4' : ''}>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Beranda
      </Link>

      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
        Dokumen Legal
      </p>
      <nav className="space-y-1.5">
        {(nav.length ? nav : [
          { slug: 'privacy-policy', title: 'Privacy Policy', icon: 'shield', type: 'privacy_policy' },
          { slug: 'terms-conditions', title: 'Terms & Conditions', icon: 'file-text', type: 'terms_conditions' },
          { slug: 'refund-policy', title: 'Refund Policy', icon: 'rotate-ccw', type: 'refund_policy' },
        ]).map((item) => {
          const Icon = ICON_MAP[item.icon || 'file-text'] || FileText;
          const active = item.slug === activeSlug;
          return (
            <Link
              key={item.slug}
              to={`/legal/${item.slug}`}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                  : 'text-gray-600 hover:bg-primary-50 hover:text-primary-800'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-primary-600'}`} />
              <span className="leading-snug">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-slate-50 via-white to-emerald-50/40">
      <div className="border-b border-gray-100/80 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-600 mb-1">
              Legal Center
            </p>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
              {doc?.title || 'Dokumen Hukum GurkyNet'}
            </h1>
          </div>
          <button
            type="button"
            className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="w-4 h-4" />
            Dokumen
          </button>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-10 items-start">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5">
              <SidebarNav />
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            {loading && (
              <div className="rounded-2xl border border-gray-100 bg-white/80 p-10 animate-pulse space-y-4">
                <div className="h-8 bg-gray-100 rounded-lg w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-40 bg-gray-50 rounded-xl" />
              </div>
            )}

            {!loading && error && (
              <ServerErrorState description={error} onRetry={() => void load()} />
            )}

            {!loading && !error && !doc && (
              <EmptyState title="Dokumen tidak ditemukan" description="Dokumen legal yang Anda cari belum tersedia." />
            )}

            {!loading && !error && doc && (
              <article className="rounded-2xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_12px_40px_rgb(0,0,0,0.05)] overflow-hidden">
                <header className="px-6 md:px-10 pt-8 md:pt-10 pb-6 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-bold">
                      <BookOpen className="w-3.5 h-3.5" />
                      Official
                    </span>
                    {doc.versionNumber ? (
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
                        v{doc.versionNumber}
                      </span>
                    ) : null}
                    {doc.preview ? (
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">
                        Preview Draft
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                    {doc.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>
                      Last updated:{' '}
                      <strong className="text-gray-700 font-semibold">{formatDate(doc.lastUpdated)}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary-500" />
                      ~{doc.estimatedReadingMinutes || 1} min read
                    </span>
                  </div>
                </header>

                {toc.length > 0 && (
                  <div className="px-6 md:px-10 py-5 bg-slate-50/80 border-b border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                      Daftar Isi
                    </p>
                    <ul className="space-y-1.5">
                      {toc.map((item) => (
                        <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
                          <button
                            type="button"
                            onClick={() => scrollTo(item.id)}
                            className={`text-left text-sm transition-colors ${
                              activeToc === item.id
                                ? 'text-primary-700 font-bold'
                                : 'text-gray-600 hover:text-primary-700'
                            }`}
                          >
                            {item.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="px-6 md:px-10 py-8 md:py-10">
                  <LegalProse html={prepared.html} />
                </div>
              </article>
            )}
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Tutup"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[min(88vw,320px)] bg-white shadow-2xl p-2 overflow-y-auto">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav mobile />
          </div>
        </div>
      )}
    </div>
  );
};
