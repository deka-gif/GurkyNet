import React, { useEffect } from 'react';
import { useWebsiteStore } from '../../store/website.store';
import { Hero } from '../../components/sections/Hero';
import { About } from '../../components/sections/About';
import { Features } from '../../components/sections/Features';
import { Services } from '../../components/sections/Services';
import { HowItWorks } from '../../components/sections/HowItWorks';
import { AppPreview } from '../../components/sections/AppPreview';
import { DownloadApp } from '../../components/sections/DownloadApp';
import { Faq } from '../../components/sections/Faq';
import { Contact } from '../../components/sections/Contact';
import { CallToAction } from '../../components/sections/CallToAction';
import { ServerErrorState } from '../../components/ui/FeedbackStates';

export const HomePage = () => {
  const { 
    sections, 
    fetchSections, 
    loadingSections, 
    errorSections,
    fetchSettings,
    fetchPages,
    fetchBanners
  } = useWebsiteStore();

  useEffect(() => {
    fetchSections();
    fetchSettings();
    fetchPages();
    fetchBanners();
  }, []);

  if (loadingSections) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-lg text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="text-lg font-bold text-gray-800">Memuat Tampilan Beranda...</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Sedang menyelaraskan tata letak dan konten terkini dari CMS.</p>
          
          {/* Section Mock Skeletons */}
          <div className="space-y-3 pt-6 max-w-md mx-auto">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3 mx-auto" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (errorSections) {
    return (
      <div className="pt-32 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md">
          <ServerErrorState 
            title="Gagal Memuat Konten" 
            description={errorSections} 
            onRetry={() => fetchSections(true)} 
            retryText="Coba Lagi"
          />
        </div>
      </div>
    );
  }

  // Fallback to default sections order if empty or not provisioned
  if (sections.length === 0) {
    return (
      <>
        <Hero />
        <About />
        <Features />
        <Services />
        <HowItWorks />
        <AppPreview />
        <DownloadApp />
        <Faq />
        <Contact />
        <CallToAction />
      </>
    );
  }

  // Filter visible and active sections and sort by displayOrder
  const activeSections = [...sections]
    .filter((s) => s.visible && (s.status === undefined || s.status === 'active'))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <>
      {activeSections.map((sec) => {
        switch (sec.componentType) {
          case 'hero':
            return <Hero key={sec.id} />;
          case 'news':
            return <About key={sec.id} />;
          case 'promo':
            return (
              <React.Fragment key={sec.id}>
                <Features />
                <CallToAction />
              </React.Fragment>
            );
          case 'categories':
          case 'product_grid':
            return (
              <React.Fragment key={sec.id}>
                <Services key={`${sec.id}-services`} />
                <HowItWorks key={`${sec.id}-how`} />
              </React.Fragment>
            );
          case 'banner':
            return (
              <React.Fragment key={sec.id}>
                <AppPreview key={`${sec.id}-preview`} />
                <DownloadApp key={`${sec.id}-download`} />
              </React.Fragment>
            );
          case 'faq':
            return <Faq key={sec.id} />;
          case 'announcement':
            return <Contact key={sec.id} />;
          default:
            return null;
        }
      })}
    </>
  );
};
