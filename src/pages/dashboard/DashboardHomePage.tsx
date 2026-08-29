import { CatalogSearchBar } from '../../components/catalog/CatalogSearchBar';
import { PromoBannerCarousel } from '../../components/dashboard/PromoBannerCarousel';
import { ServiceCategoryGrid } from '../../components/dashboard/ServiceCategoryGrid';
import { RecentTransactionsCard } from '../../components/dashboard/RecentTransactionsCard';
import { useFavoriteStore } from '../../store/favorite.store';
import type { DashboardServiceCategory } from '../../config/catalogCategories';
import { formatIDR } from '../../utils/currency';
import { getDynamicGreeting } from '../../utils/greeting';
import { useAuthStore } from '../../store/auth.store';
import { useBannerStore } from '../../store/banner.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useNotificationStore } from '../../store/notification.store';
import { websiteService } from '../../services/website.service';
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  HelpCircle,
  X,
} from 'lucide-react';
import { runWhenIdle } from '../../utils/perf';
import { preloadDashboardCore } from '../../router/lazyPages';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export const DashboardHomePage = () => {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const banners = useBannerStore((s) => s.banners);
  const bannerLoading = useBannerStore((s) => s.loading);
  const bannerError = useBannerStore((s) => s.error);
  const fetchBanners = useBannerStore((s) => s.fetchBanners);
  const transactions = useTransactionStore((s) => s.transactions);
  const trxLoading = useTransactionStore((s) => s.loading);
  const trxError = useTransactionStore((s) => s.error);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const favorites = useFavoriteStore((s) => s.favorites);
  const hydrateFavorites = useFavoriteStore((s) => s.hydrate);
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);
  const { flags: featureFlags } = useFeatureFlags();

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [popupAnnouncement, setPopupAnnouncement] = useState<any | null>(null);

  useEffect(() => {
    fetchBanners();
    fetchTransactions();
    fetchNotifications();
    hydrateFavorites();
    websiteService
      .getPublicAnnouncements({ per_page: 10 })
      .then((res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
        setAnnouncements(rows);
        const popup = rows.find((a: any) => a?.type === 'broadcast' || a?.isPopup || a?.is_popup);
        if (popup && !sessionStorage.getItem('gurky_announcement_dismissed')) {
          setPopupAnnouncement(popup);
        }
      })
      .catch(() => setAnnouncements([]));
  }, [fetchBanners, fetchTransactions, fetchNotifications, hydrateFavorites]);

  useEffect(() => {
    return runWhenIdle(() => {
      preloadDashboardCore();
    }, 2500);
  }, []);

  const handleCategorySelect = useCallback((category: DashboardServiceCategory) => {
    navigate(category.path);
  }, [navigate]);

  const announcementText = announcements
    .map((a) => a.title || a.message || '')
    .filter(Boolean)
    .join('  •  ');

  const marqueeSegments = useMemo(() => {
    const segments: string[] = [];
    if (announcementText.length > 0) segments.push(announcementText);
    if (!featureFlags.purchase_enabled) {
      segments.push('Segera Hadir — pembelian produk yang memotong saldo belum diaktifkan.');
    }
    return segments;
  }, [announcementText, featureFlags.purchase_enabled]);

  const marqueeContent = marqueeSegments.join('  •  ');
  const showNoticeMarquee = marqueeSegments.length > 0;

  const marqueeDuration = useMemo(() => {
    const len = Math.max(marqueeContent.length, 40);
    const seconds = Math.min(90, Math.max(30, 22 + len * 0.12));
    return `${seconds}s`;
  }, [marqueeContent]);

  return (
    <div className="space-y-4 pb-24 md:pb-8 max-w-7xl mx-auto">

      {showNoticeMarquee && (
        <div
          className="dashboard-notice-marquee"
          style={{ '--marquee-duration': marqueeDuration } as CSSProperties}
        >
          <div className="dashboard-notice-marquee-track">
            <span className="dashboard-notice-marquee-segment">{marqueeContent}  •  </span>
            <span className="dashboard-notice-marquee-segment" aria-hidden="true">
              {marqueeContent}  •  
            </span>
          </div>
        </div>
      )}

      {popupAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md w-full rounded-2xl bg-white p-5 shadow-xl border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-primary-600">Pengumuman</p>
                <h3 className="text-lg font-extrabold text-gray-900 mt-1">{popupAnnouncement.title}</h3>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-gray-100"
                onClick={() => {
                  sessionStorage.setItem('gurky_announcement_dismissed', '1');
                  setPopupAnnouncement(null);
                }}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{popupAnnouncement.message || popupAnnouncement.body}</p>
          </div>
        </div>
      )}

      <div className="lg:hidden flex items-center gap-1.5 px-1 text-sm">
        <span className="font-semibold text-primary-700">{getDynamicGreeting()}</span>
        <span aria-hidden="true">👋</span>
        <span className="text-gray-300">•</span>
        <span className="font-bold text-gray-800 truncate">{user?.name || 'Pelanggan GurkyNet'}</span>
      </div>

      {/* Promo banner — full width hero */}
      <PromoBannerCarousel
        banners={banners}
        loading={bannerLoading}
        error={bannerError}
        onRetry={() => fetchBanners()}
      />

      <div className="px-1">
        <CatalogSearchBar />
      </div>

      <ServiceCategoryGrid
        onSelect={handleCategorySelect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <RecentTransactionsCard
          transactions={Array.isArray(transactions) ? transactions : []}
          loading={trxLoading}
          error={trxError}
          onRetry={() => fetchTransactions()}
          limit={5}
        />

        <div className="lg:col-span-5 dashboard-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-accent-500 fill-accent-400" />
              <h2 className="font-extrabold text-gray-900 text-lg">Shortcut Favorit</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Pin produk favorit dari product picker. Data disimpan di perangkat Anda.
            </p>

            <div className="space-y-3">
              {favorites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                  <Star className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-bold text-gray-700">Belum ada favorit</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Buka kategori layanan, lalu pin produk yang sering dipakai.
                  </p>
                </div>
              ) : (
                favorites.slice(0, 5).map((fav) => (
                  <div
                    key={fav.id}
                    className="p-3.5 bg-gray-50 hover:bg-primary-50/40 rounded-2xl border border-gray-100 hover:border-primary-100 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary-600 border border-primary-100 shadow-sm shrink-0">
                        <Star className="w-4 h-4 fill-accent-400 text-accent-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-sm text-gray-900 truncate">{fav.name}</div>
                        <div className="text-xs text-gray-400 font-medium truncate">
                          {fav.operatorName || fav.category} · {formatIDR(fav.price)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeFavorite(fav.id)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Hapus favorit"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(fav.route)}
                        className="text-xs font-bold text-primary-600 hover:text-white bg-white hover:bg-primary-600 border border-primary-200 hover:border-primary-600 px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        Buka
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-50 to-primary-100/40 border border-primary-100 rounded-2xl p-4 mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-primary-900/20">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-gray-900">Butuh Bantuan Transaksi?</div>
                <div className="text-[11px] text-gray-500 mt-0.5">CS GurkyNet aktif 24 jam siap mendampingi Anda.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/help?tab=chat')}
              className="text-xs font-bold bg-white text-primary-700 hover:bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
            >
              Chat CS
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
