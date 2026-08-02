import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { websiteService } from '../../services/website.service';
import { StaticPage } from '../../types';
import { ServerErrorState, EmptyState } from '../../components/ui/FeedbackStates';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';

export const StaticPageView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPageDetails = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const matchedPage = await websiteService.getPublicPageBySlug(slug);
      if (matchedPage) {
        setPage(matchedPage);
      } else {
        const response = await websiteService.getPublicPages();
        const found = response.data.find((p) => p.slug === slug);
        setPage(found || null);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat detail halaman.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageDetails();
  }, [slug]);

  // Document head update if react-helmet is used, or write a simple side-effect
  useEffect(() => {
    if (page) {
      document.title = page.seoTitle || `${page.title} - GurkyNet`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', page.seoDescription || '');
      }
    }
  }, [page]);

  const renderFormattedContent = (rawContent: string) => {
    if (!rawContent) return <p className="text-gray-400 italic">Belum ada konten...</p>;
    
    return (
      <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed space-y-6">
        {rawContent.split('\n\n').map((paragraph, index) => {
          if (paragraph.startsWith('### ')) {
            return (
              <h4 key={index} className="text-lg font-bold text-gray-900 pt-3">
                {paragraph.replace('### ', '')}
              </h4>
            );
          }
          if (paragraph.startsWith('## ')) {
            return (
              <h3 key={index} className="text-xl font-bold text-gray-900 pt-4 border-b border-gray-100 pb-2">
                {paragraph.replace('## ', '')}
              </h3>
            );
          }
          if (paragraph.startsWith('# ')) {
            return (
              <h2 key={index} className="text-2xl font-extrabold text-primary-900 pt-6">
                {paragraph.replace('# ', '')}
              </h2>
            );
          }
          if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
            const listItems = paragraph.split('\n');
            return (
              <ul key={index} className="list-disc pl-6 space-y-2 my-4">
                {listItems.map((li, idx) => (
                  <li key={idx} className="text-gray-700">{li.replace(/^[\-\*]\s+/, '')}</li>
                ))}
              </ul>
            );
          }
          return <p key={index} className="whitespace-pre-wrap text-base text-gray-600 leading-relaxed">{paragraph}</p>;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          {/* Breadcrumb Skeleton */}
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-6" />
          
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm space-y-6">
            {/* Title Skeleton */}
            <div className="h-10 w-2/3 bg-gray-200 rounded animate-pulse" />
            
            {/* Meta skeleton */}
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>

            <div className="border-t border-gray-100 pt-8 space-y-4">
              {/* Content Paragraph Skeletons */}
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse pt-4" />
              <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md">
          <ServerErrorState 
            title="Gagal Memuat Halaman" 
            description={error} 
            onRetry={fetchPageDetails} 
            retryText="Coba Lagi"
          />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md">
          <EmptyState 
            title="Halaman Tidak Ditemukan" 
            description="Maaf, halaman statis yang Anda cari tidak ditemukan atau belum dipublikasikan."
            onRetry={() => window.location.href = '/'}
            retryText="Kembali ke Beranda"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        {/* Content Card */}
        <article className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-400">
              <span className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Halaman Informasi</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Terakhir diperbarui: {page.lastUpdated ? new Date(page.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {page.title}
            </h1>
          </header>

          <div className="border-t border-gray-100 pt-8">
            {renderFormattedContent(page.content)}
          </div>
        </article>
      </div>
    </div>
  );
};
