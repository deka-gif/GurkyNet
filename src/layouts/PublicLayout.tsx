import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';
import { useWebsiteStore } from '../store/website.store';
import { useCmsLiveSync } from '../hooks/useCmsLiveSync';

export const PublicLayout = () => {
  const { settings, fetchHomepage } = useWebsiteStore();

  // Single public bootstrap — GET /public/homepage once (deduped in store).
  useEffect(() => {
    void fetchHomepage();
  }, [fetchHomepage]);

  // Marketing CMS live sync — refetch without browser refresh
  useCmsLiveSync(true);

  // Dynamically set favicon from backend WebsiteSettings
  useEffect(() => {
    if (!settings?.favicon) return;
    const faviconUrl =
      typeof settings.favicon === 'string'
        ? settings.favicon
        : settings.favicon?.url;
    if (!faviconUrl) return;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [settings?.favicon]);

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 selection:bg-primary-200 selection:text-primary-900">
      <NetworkStatusAndLoader />
      <Navbar />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};
