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
import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
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
  Megaphone,
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

  // Initialize store data on mount
  useEffect(() => {
    fetchWallet();
    fetchBanners();
    fetchTransactions();
    fetchNotifications();
    hydrateFavorites();
    // FR-USR06 — public Marketing announcements (Sprint 5 source)
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

  // Idle preload of heavy dashboard chunks (riwayat / promo / chat)
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

  // Dynamic greeting based on Indonesian local time
  const dynamicGreeting = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    if (currentHour >= 4 && currentHour < 11) {
      return 'Selamat Pagi';
    } else if (currentHour >= 11 && currentHour < 15) {
      return 'Selamat Siang';
    } else if (currentHour >= 15 && currentHour < 18.5) {
      return 'Selamat Sore';
    } else {
      return 'Selamat Malam';
    }
  }, []);

  // Wallet refresh handler
  const handleRefreshBalance = async () => {
    setIsRefreshingWallet(true);
    await fetchWallet();
    setTimeout(() => setIsRefreshingWallet(false), 500);
  };

  // Copy wallet number
  const handleCopyWalletNo = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!wallet?.walletNo) return;
    navigator.clipboard.writeText(wallet.walletNo);
    setCopiedWalletNo(true);
    setTimeout(() => setCopiedWalletNo(false), 2000);
  };

  return (
    <div className="space-y-4 pb-24 md:pb-8 max-w-7xl mx-auto">

      {/* FR-USR06 — running text from public announcements */}
      {announcements.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="overflow-hidden whitespace-nowrap text-xs font-semibold text-amber-900 truncate">
            {announcements.map((a) => a.title || a.message || '').filter(Boolean).join('  •  ')}
          </div>
        </div>
      )}

      {!featureFlags.purchase_enabled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
          Segera Hadir — pembelian produk yang memotong saldo belum diaktifkan.
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

      {/* Sticky top notification banner removed — transactional notices use NotificationToast (queued, 15s). */}

      {/* 2. Compact Hero — greeting + CTAs (loyalty deferred to later sprint) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 text-white shadow-lg shadow-primary-900/10 border border-primary-400/20 px-5 py-4 md:px-6 md:py-5 md:min-h-[168px] flex">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-16 h-28 w-28 rounded-full bg-emerald-300/15 blur-2xl" />

        <div className="relative z-10 flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {/* LEFT — greeting */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary-100/95">
              {dynamicGreeting} <span aria-hidden="true">👋</span>
            </p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight md:text-2xl">
              {(user?.name || 'Pelanggan GurkyNet').toUpperCase()}
            </h1>
            <p className="mt-1.5 max-w-md text-xs leading-snug text-primary-100/90 md:text-[13px] line-clamp-2">
              Semua layanan PPOB online 24 jam siap membantu transaksi Anda.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/topup')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-primary-700 shadow-sm transition hover:bg-primary-50 active:scale-[0.98]"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Top Up Saldo
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/riwayat')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/35 bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
              >
                <History className="h-3.5 w-3.5" />
                Riwayat
              </button>
            </div>
          </div>

          {/* RIGHT — avatar + saldo singkat (existing wallet store only) */}
          <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
            <div className="hidden text-right sm:block">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-100/80">
                Saldo
              </div>
              <div className="text-sm font-bold tracking-tight tabular-nums md:text-base">
                {walletLoading && wallet == null
                  ? '…'
                  : formatIDR(wallet?.balance ?? 0)}
              </div>
            </div>
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/25 bg-white/15 shadow-inner md:h-14 md:w-14">
              {user?.avatar ? (
                <img
                  src={resolveMediaUrl(user.avatar)}
                  alt={user.name || 'Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white md:text-base">
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
      </div>

      {/* 3. Saldo (40%) + Promo Banner (60%) — equal height, compact */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-stretch">

        {/* 3A. Compact GurkyNet Wallet Card */}
        <div className="relative flex h-auto max-h-[300px] flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-xl shadow-gray-200/50 lg:h-[280px]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-50/50 blur-2xl" />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            {/* Title + wallet number */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Saldo GurkyNet
                </span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title={showBalance ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
                  aria-label="Toggle Tampilan Saldo"
                >
                  {showBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyWalletNo}
                className="group/copy flex cursor-pointer items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700 transition-all hover:bg-primary-100"
                title="Klik untuk salin nomor dompet"
              >
                <span className="max-w-[9.5rem] truncate">{wallet?.walletNo || 'GK-XXXXXXXX'}</span>
                {copiedWalletNo ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-primary-500 transition-colors group-hover/copy:text-primary-700" />
                )}
              </button>
            </div>

            {/* Balance + update */}
            <div className="mt-3">
              {walletLoading && !wallet ? (
                <div className="space-y-2">
                  <div className="h-9 w-40 animate-pulse rounded-xl bg-gray-200" />
                  <div className="h-3.5 w-24 animate-pulse rounded-md bg-gray-100" />
                </div>
              ) : (
                <>
                  <h2 className="text-3xl font-black tracking-tight text-gray-900 tabular-nums md:text-[2rem]">
                    {showBalance ? formatIDR(wallet?.balance ?? 0) : 'Rp ••••••••'}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      Update:{' '}
                      {wallet?.lastUpdated
                        ? new Date(wallet.lastUpdated).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Realtime'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshBalance}
                      disabled={isRefreshingWallet}
                      className={`cursor-pointer rounded-lg p-1 text-gray-400 transition-all hover:bg-primary-50 hover:text-primary-600 ${
                        isRefreshingWallet ? 'animate-spin text-primary-600' : ''
                      }`}
                      title="Perbarui Saldo"
                      aria-label="Perbarui Saldo"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Actions — tight spacing under balance (≈20–24px), not pushed to bottom of oversized card */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/dashboard/wallet')}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-primary-600 px-3 py-2.5 text-sm font-extrabold text-white shadow-md shadow-primary-600/20 transition-all hover:bg-primary-700 active:scale-[0.98]"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Top Up</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/riwayat')}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-extrabold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
              >
                <History className="h-4 w-4 text-gray-500" />
                <span>Riwayat</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3B. Promo Banner — same height as saldo card */}
        <PromoBannerCarousel
          banners={banners}
          loading={bannerLoading}
          error={bannerError}
          onRetry={() => fetchBanners()}
        />

      </div>


      <div className="px-1">
        <CatalogSearchBar />
      </div>

      {/* 4. Layanan PPOB — modern category cards + product picker */}
      <ServiceCategoryGrid
        activeId={selectedCategory?.id}
        onSelect={handleCategorySelect}
      />

      {/* 5. Transaksi Terakhir & Shortcut Favorit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <RecentTransactionsCard
          transactions={Array.isArray(transactions) ? transactions : []}
          loading={trxLoading}
          error={trxError}
          onRetry={() => fetchTransactions()}
          limit={5}
        />

        {/* 5B. Shortcut Favorit & Pusat Bantuan */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
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
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary-600 border border-gray-100 group-hover:border-primary-200 shadow-sm shrink-0">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
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
                        className="text-xs font-bold text-primary-600 hover:text-white bg-white hover:bg-primary-600 border border-gray-200 hover:border-primary-600 px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
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
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-primary-600/20">
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

