import React, { useEffect } from 'react';
import { useWebsiteStore } from '../../store/website.store';
import { Hero } from '../../components/sections/Hero';
import { About } from '../../components/sections/About';
import { Features } from '../../components/sections/Features';
import { Services } from '../../components/sections/Services';
import { FeaturedProducts } from '../../components/sections/FeaturedProducts';
import { HowItWorks } from '../../components/sections/HowItWorks';
import { AppPreview } from '../../components/sections/AppPreview';
import { DownloadApp } from '../../components/sections/DownloadApp';
import { Faq } from '../../components/sections/Faq';
import { Contact } from '../../components/sections/Contact';
import { CallToAction } from '../../components/sections/CallToAction';
import { CmsContentSection } from '../../components/sections/CmsContentSection';
import { CmsSectionShell } from '../../components/sections/CmsSectionShell';
import { HomepageSkeleton } from '../../components/sections/HomepageSkeleton';
import { ServerErrorState } from '../../components/ui/FeedbackStates';
import type { HomepageSection } from '../../types';

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
        <CmsSectionShell key={sec.id} section={sec}>
          <FeaturedProducts section={sec} />
        </CmsSectionShell>
      );
    case 'banner':
      return (
        <React.Fragment key={sec.id}>
          <CmsSectionShell section={sec}>
            <AppPreview section={sec} />
          </CmsSectionShell>
          <CmsSectionShell section={sec}>
            <DownloadApp section={sec} />
          </CmsSectionShell>
        </React.Fragment>
      );
    case 'how_it_works':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <HowItWorks section={sec} />
        </CmsSectionShell>
      );
    case 'statistics':
    case 'why_us':
    case 'partners':
    case 'testimonials':
      return <CmsContentSection key={sec.id} section={sec} />;
    case 'faq':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <Faq section={sec} />
        </CmsSectionShell>
      );
    case 'announcement':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <Contact section={sec} />
        </CmsSectionShell>
      );
    case 'cta':
    case 'footer':
      return (
        <CmsSectionShell key={sec.id} section={sec}>
          <CallToAction section={sec} />
        </CmsSectionShell>
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
        <FeaturedProducts />
        <HowItWorks />
        <AppPreview />
        <DownloadApp />
        <Faq />
        <Contact />
        <CallToAction />
      </>
    );
  }

  const activeSections = [...sections]
    .filter((s) => s.visible && (s.status === undefined || s.status === 'active'))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return <>{activeSections.map((sec) => renderSection(sec))}</>;
};
