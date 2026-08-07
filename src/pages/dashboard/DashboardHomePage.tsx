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
} from 'lucide-react';
import { runWhenIdle } from '../../utils/perf';
import { preloadDashboardCore } from '../../router/lazyPages';

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

  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
  const [copiedWalletNo, setCopiedWalletNo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DashboardServiceCategory | null>(null);

  // Initialize store data on mount
  useEffect(() => {
    fetchWallet();
    fetchBanners();
    fetchTransactions();
    fetchNotifications();
    hydrateFavorites();
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
    <div className="space-y-6 pb-24 md:pb-8 max-w-7xl mx-auto">

      {/* Sticky top notification banner removed — transactional notices use NotificationToast (queued, 15s). */}

      {/* 2. Compact Hero — greeting + CTAs (loyalty deferred to later sprint) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 text-white shadow-lg shadow-primary-900/10 border border-primary-400/20 px-5 py-5 md:px-6 md:py-[1.35rem] md:min-h-[200px] flex">
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

      {/* 3. Core Cards Grid: Wallet Card & Banner Promo Carousel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 3A. Modern GurkyPay Wallet Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between relative overflow-hidden group">
          {/* Subtle Background Shape */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50/50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

          <div>
            {/* Wallet Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-400 tracking-wider uppercase">Saldo GurkyPay</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100 cursor-pointer"
                  title={showBalance ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
                  aria-label="Toggle Tampilan Saldo"
                >
                  {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Wallet Number with Copy Button */}
              <button
                onClick={handleCopyWalletNo}
                className="group/copy flex items-center gap-1.5 text-xs font-bold bg-primary-50 hover:bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full border border-primary-100 transition-all cursor-pointer"
                title="Klik untuk salin nomor dompet"
              >
                <span>{wallet?.walletNo || 'GK-XXXXXXXX'}</span>
                {copiedWalletNo ? (
                  <Check className="w-3.5 h-3.5 text-green-600 animate-in fade-in zoom-in" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-primary-500 group-hover/copy:text-primary-700 transition-colors" />
                )}
                {copiedWalletNo && (
                  <span className="text-[10px] text-green-600 font-bold ml-0.5">Tersalin</span>
                )}
              </button>
            </div>

            {/* Wallet Balance Amount */}
            <div className="mb-6">
              {walletLoading && !wallet ? (
                <div className="space-y-2">
                  <div className="h-9 w-44 bg-gray-200 animate-pulse rounded-xl"></div>
                  <div className="h-4 w-28 bg-gray-100 animate-pulse rounded-md"></div>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    {showBalance ? formatIDR(wallet?.balance ?? 0) : 'Rp ••••••••'}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Update: {wallet?.lastUpdated ? new Date(wallet.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Realtime'}
                    </span>
                    <button
                      onClick={handleRefreshBalance}
                      disabled={isRefreshingWallet}
                      className={`p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all cursor-pointer ${isRefreshingWallet ? 'animate-spin text-primary-600' : ''}`}
                      title="Perbarui Saldo"
                      aria-label="Perbarui Saldo"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions for Wallet */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 mt-auto">
            <button
              onClick={() => navigate('/dashboard/wallet')}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white rounded-2xl font-extrabold text-sm shadow-md shadow-primary-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Top Up Saldo</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/riwayat')}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-700 hover:text-gray-900 rounded-2xl font-extrabold text-sm border border-gray-200 hover:border-gray-300 transition-all cursor-pointer"
            >
              <History className="w-4 h-4 text-gray-500" />
              <span>Riwayat Transaksi</span>
            </button>
          </div>
        </div>

        {/* 3B. Promo Banner — full image CMS carousel */}
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
              onClick={() => navigate('/dashboard/chat')}
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

