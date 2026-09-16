import React, { Suspense, lazy, useEffect } from 'react';
import { Hero } from '../../components/sections/Hero';
import { About } from '../../components/sections/About';
import { Features } from '../../components/sections/Features';
import { Services } from '../../components/sections/Services';
import { CmsSectionShell } from '../../components/sections/CmsSectionShell';
import { HomepageSkeleton } from '../../components/sections/HomepageSkeleton';
import { ServerErrorState } from '../../components/ui/FeedbackStates';
import type { HomepageSection } from '../../types';
import { useWebsiteStore } from '../../store/website.store';

/** Above-the-fold stays eager. Below-the-fold sections lazy-split off the critical path. */
const FeaturedProducts = lazy(() =>
  import('../../components/sections/FeaturedProducts').then((m) => ({ default: m.FeaturedProducts }))
);
const HowItWorks = lazy(() =>
  import('../../components/sections/HowItWorks').then((m) => ({ default: m.HowItWorks }))
);
const AppPreview = lazy(() =>
  import('../../components/sections/AppPreview').then((m) => ({ default: m.AppPreview }))
);
const DownloadApp = lazy(() =>
  import('../../components/sections/DownloadApp').then((m) => ({ default: m.DownloadApp }))
);
const Faq = lazy(() => import('../../components/sections/Faq').then((m) => ({ default: m.Faq })));
const Contact = lazy(() =>
  import('../../components/sections/Contact').then((m) => ({ default: m.Contact }))
);
const CallToAction = lazy(() =>
  import('../../components/sections/CallToAction').then((m) => ({ default: m.CallToAction }))
);
const CmsContentSection = lazy(() =>
  import('../../components/sections/CmsContentSection').then((m) => ({ default: m.CmsContentSection }))
);

function BelowFold({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const renderSection = (sec: HomepageSection) => {
  switch (sec.componentType) {
    case 'hero':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <Hero section={sec} />
        </CmsSectionShell>
      );
    case 'news':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <About section={sec} />
        </CmsSectionShell>
      );
    case 'promo':
    case 'features':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <Features section={sec} />
        </CmsSectionShell>
      );
    case 'categories':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <Services section={sec} />
        </CmsSectionShell>
      );
    case 'product_grid':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <FeaturedProducts section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'banner':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <AppPreview section={sec} />
          </CmsSectionShell>
          <CmsSectionShell section={sec}>
            <DownloadApp section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'how_it_works':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <HowItWorks section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'statistics':
    case 'why_us':
    case 'partners':
    case 'testimonials':
      return (
        <BelowFold key={sec.id}>
          <CmsContentSection section={sec} />
        </BelowFold>
      );
    case 'faq':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <Faq section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'announcement':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <Contact section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'cta':
    case 'footer':
      return (
        <BelowFold key={sec.id}>
          <CmsSectionShell section={sec}>
            <CallToAction section={sec} />
          </CmsSectionShell>
        </BelowFold>
      );
    case 'seo':
      return null;
    default:
      return null;
  }
};

export const HomePage = () => {
  const {
    sections,
    loadingSections,
    errorSections,
    fetchHomepage,
    homepageReady,
    seo,
    settings,
  } = useWebsiteStore();

  useEffect(() => {
    void fetchHomepage();
  }, [fetchHomepage]);

  useEffect(() => {
    if (!homepageReady) return;
    const title = seo?.title || settings?.seoTitle || settings?.websiteName || 'GurkyNet';
    const description = seo?.description || settings?.seoDescription || settings?.tagline || '';
    document.title = title;
    const ensureMeta = (name: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    ensureMeta('description', description);
    if (seo?.keywords || settings?.seoKeywords) {
      ensureMeta('keywords', seo?.keywords || settings?.seoKeywords || '');
    }
  }, [homepageReady, seo, settings]);

  if (errorSections && !homepageReady) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md">
          <ServerErrorState
            title="Gagal Memuat Konten"
            description={errorSections}
            onRetry={() => fetchHomepage(true)}
            retryText="Coba Lagi"
          />
        </div>
      </div>
    );
  }

  if (loadingSections && !homepageReady) {
    return <HomepageSkeleton />;
  }

  if (sections.length === 0) {
    return (
      <>
        <Hero />
        <About />
        <Features />
        <Services />
        <BelowFold>
          <FeaturedProducts />
          <HowItWorks />
          <AppPreview />
          <DownloadApp />
          <Faq />
          <Contact />
          <CallToAction />
        </BelowFold>
      </>
    );
  }

  const activeSections = [...sections]
    .filter((s) => s.visible && (s.status === undefined || s.status === 'active'))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return <>{activeSections.map((sec) => renderSection(sec))}</>;
};
