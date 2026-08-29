import { CatalogSearchBar } from '../../components/catalog/CatalogSearchBar';
import { PromoBannerCarousel } from '../../components/dashboard/PromoBannerCarousel';
import { ServiceCategoryGrid } from '../../components/dashboard/ServiceCategoryGrid';
import { ProductPickerSheet } from '../../components/dashboard/ProductPickerSheet';
import { RecentTransactionsCard } from '../../components/dashboard/RecentTransactionsCard';
import { useFavoriteStore } from '../../store/favorite.store';
import type { DashboardServiceCategory } from '../../config/catalogCategories';
import { formatIDR } from '../../utils/currency';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useAuthStore } from '../../store/auth.store';
import { useWalletStore } from '../../store/wallet.store';
import { useBannerStore } from '../../store/banner.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useNotificationStore } from '../../store/notification.store';
import { websiteService } from '../../services/website.service';
import { useState, useEffect, useMemo, useCallback, type CSSProperties, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  History,
  Copy,
  Check,
  Star,
  Eye,
  EyeOff,
  RotateCw,
  HelpCircle,
  X,
} from 'lucide-react';
import { runWhenIdle } from '../../utils/perf';
import { preloadDashboardCore } from '../../router/lazyPages';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export const DashboardHomePage = () => {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const wallet = useWalletStore((s) => s.wallet);
  const walletLoading = useWalletStore((s) => s.loading);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
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

  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
  const [copiedWalletNo, setCopiedWalletNo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DashboardServiceCategory | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [popupAnnouncement, setPopupAnnouncement] = useState<any | null>(null);

  useEffect(() => {
    fetchWallet();
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
  }, [fetchWallet, fetchBanners, fetchTransactions, fetchNotifications, hydrateFavorites]);

  useEffect(() => {
    return runWhenIdle(() => {
      preloadDashboardCore();
    }, 2500);
  }, []);

  const handleCategorySelect = useCallback((category: DashboardServiceCategory) => {
    if (category.mode === 'navigate') {
      navigate(category.path);
      return;
    }
    setSelectedCategory(category);
  }, [navigate]);

  const dynamicGreeting = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour >= 4 && currentHour < 11) return 'Selamat Pagi';
    if (currentHour >= 11 && currentHour < 15) return 'Selamat Siang';
    if (currentHour >= 15 && currentHour < 18.5) return 'Selamat Sore';
    return 'Selamat Malam';
  }, []);

  const handleRefreshBalance = async () => {
    setIsRefreshingWallet(true);
    await fetchWallet();
    setTimeout(() => setIsRefreshingWallet(false), 500);
  };

  const handleCopyWalletNo = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!wallet?.walletNo) return;
    navigator.clipboard.writeText(wallet.walletNo);
    setCopiedWalletNo(true);
    setTimeout(() => setCopiedWalletNo(false), 2000);
  };

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

      {/* Single hero balance card — greeting + saldo + aksi (no duplicate body cards) */}
      <div className="dashboard-balance-card dashboard-balance-card-home">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.85) 1px, transparent 0)',
            backgroundSize: '16px 16px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
          }}
        />
        <div className="brand-glow-accent -right-16 -top-16 w-48 h-48 pointer-events-none absolute" />
        <div className="brand-glow-primary -left-12 bottom-[-1rem] w-44 h-44 pointer-events-none absolute" />

        <div className="relative z-10 flex flex-col gap-2.5 md:gap-4">
          {/* Row 1: greeting + compact avatar */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary-100/90 md:text-sm">
                {dynamicGreeting} <span aria-hidden="true">👋</span>
              </p>
              <h1 className="mt-0.5 truncate text-base font-bold tracking-tight md:text-xl">
                {(user?.name || 'Pelanggan GurkyNet').toUpperCase()}
              </h1>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-primary-50">
                ✦ Member Aktif
              </span>
            </div>
            <div className="shrink-0 rounded-[14px] bg-gradient-to-br from-accent-400 to-accent-500 p-[2px] md:rounded-2xl md:p-[2.5px]">
              <div className="h-10 w-10 overflow-hidden rounded-[12px] bg-primary-800 md:h-11 md:w-11 md:rounded-[14px]">
                {user?.avatar ? (
                  <img
                    src={resolveMediaUrl(user.avatar)}
                    alt={user.name || 'Avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white md:text-sm">
                    {(user?.name || 'G')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: saldo + CTA side-by-side (all breakpoints) for compact mobile height */}
          <div className="flex items-end justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-200/85">
                  Saldo GurkyNet
                </span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="rounded-md p-0.5 text-primary-200 hover:bg-white/10 transition-colors"
                  title={showBalance ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
                  aria-label="Toggle Tampilan Saldo"
                >
                  {showBalance ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyWalletNo}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-primary-50 hover:bg-white/15 transition-colors"
                  title="Salin nomor dompet"
                >
                  <span className="max-w-[7rem] truncate sm:max-w-[8rem]">{wallet?.walletNo || 'GK-XXXXXXXX'}</span>
                  {copiedWalletNo ? <Check className="h-2.5 w-2.5 text-accent-400" /> : <Copy className="h-2.5 w-2.5" />}
                </button>
              </div>

              {walletLoading && !wallet ? (
                <div className="h-9 w-44 animate-pulse rounded-lg bg-white/15 md:h-10" />
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <h2 className="text-3xl font-black tracking-tight tabular-nums leading-none md:text-4xl">
                    {showBalance ? formatIDR(wallet?.balance ?? 0) : 'Rp ••••••••'}
                  </h2>
                  <div className="flex items-center gap-1 pb-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-100/75">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-accent-400" />
                      {wallet?.lastUpdated
                        ? new Date(wallet.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : 'Realtime'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshBalance}
                      disabled={isRefreshingWallet}
                      className={`rounded-md p-0.5 text-primary-100 hover:bg-white/10 ${isRefreshingWallet ? 'animate-spin' : ''}`}
                      title="Perbarui Saldo"
                      aria-label="Perbarui Saldo"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 shrink-0 sm:flex-row sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/topup')}
                className="inline-flex items-center justify-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-primary-800 shadow-lg shadow-primary-900/20 transition hover:bg-primary-50 sm:px-3.5 sm:py-2 sm:text-[11px] md:px-4 md:py-2.5 md:text-xs"
              >
                <PlusCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                Top Up<span className="hidden sm:inline"> Saldo</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/riwayat')}
                className="inline-flex items-center justify-center gap-1 rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm transition hover:bg-white/18 sm:px-3.5 sm:py-2 sm:text-[11px] md:px-4 md:py-2.5 md:text-xs"
              >
                <History className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                Riwayat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Promo banner — full width, no duplicate balance card */}
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
        activeId={selectedCategory?.id}
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

      <ProductPickerSheet
        open={Boolean(selectedCategory)}
        category={selectedCategory}
        transactions={Array.isArray(transactions) ? transactions : []}
        onClose={() => setSelectedCategory(null)}
      />

    </div>
  );
};
