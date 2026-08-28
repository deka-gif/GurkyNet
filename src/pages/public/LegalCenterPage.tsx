import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { websiteService } from '../../services';
import { EmptyState, ServerErrorState } from '../../components/ui/FeedbackStates';
import { LegalProse, prepareLegalHtml } from '../../components/legal/legalContent';

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

const DEFAULT_NAV: LegalNavItem[] = [
  { slug: 'privacy-policy', title: 'Kebijakan Privasi', type: 'privacy_policy' },
  { slug: 'terms-conditions', title: 'Syarat & Ketentuan', type: 'terms_conditions' },
  { slug: 'refund-policy', title: 'Kebijakan Pengembalian Dana', type: 'refund_policy' },
];

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

/**
 * Classic, minimal legal-document layout: a single readable column of text
 * with a back link and (when there's more than one document) a plain-text
 * switcher — no cards, no metadata badges, no floating chrome. This matches
 * how policy/terms pages read on most professional sites.
 */
export const LegalCenterPage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [nav, setNav] = useState<LegalNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!slug && !loading && nav.length > 0) {
    return <Navigate to={`/legal/${nav[0].slug}`} replace />;
  }

  if (!slug && !loading && !error) {
    return <Navigate to="/legal/privacy-policy" replace />;
  }

  const docs = nav.length ? nav : DEFAULT_NAV;

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-700 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>

        {docs.length > 1 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-10 pb-6 border-b border-gray-100 text-sm">
            {docs.map((item) => {
              const active = item.slug === activeSlug;
              return (
                <Link
                  key={item.slug}
                  to={`/legal/${item.slug}`}
                  className={`font-semibold transition-colors ${
                    active
                      ? 'text-primary-700 underline underline-offset-4 decoration-2'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-9 bg-gray-100 rounded-lg w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-6" />
            <div className="h-64 bg-gray-50 rounded-xl" />
          </div>
        )}

        {!loading && error && (
          <ServerErrorState description={error} onRetry={() => void load()} />
        )}

        {!loading && !error && !doc && (
          <EmptyState title="Dokumen tidak ditemukan" description="Dokumen legal yang Anda cari belum tersedia." />
        )}

        {!loading && !error && doc && (
          <article>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
              {doc.title}
            </h1>
            <p className="text-sm text-gray-400 mb-10">
              Terakhir diperbarui {formatDate(doc.lastUpdated)}
              {doc.preview ? (
                <span className="ml-3 font-semibold text-amber-600">· Draft Pratinjau</span>
              ) : null}
            </p>

            <LegalProse html={prepared.html} />
          </article>
        )}
      </div>
    </div>
  );
};
