import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  Wifi,
  Zap,
  CreditCard,
  Gift,
  Gamepad2,
  FileText,
  LayoutGrid,
  PlusCircle,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Copy,
  Check,
  Star,
  TrendingUp,
  Eye,
  EyeOff,
  RotateCw,
  Megaphone,
  X,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Receipt,
  Send,
  PlayCircle,
  Globe,
} from 'lucide-react';

import { useAuthStore } from '../../store/auth.store';
import { useWalletStore } from '../../store/wallet.store';
import { useBannerStore } from '../../store/banner.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useNotificationStore } from '../../store/notification.store';
import { Transaction, Banner } from '../../types';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatIDR } from '../../utils/currency';
import { CatalogSearchBar } from '../../components/catalog/CatalogSearchBar';
import {
  isFailedStatus,
  isPendingStatus,
  isSuccessStatus,
} from '../../utils/transactionStatus';

export const DashboardHomePage = () => {
  const navigate = useNavigate();

  // Pure Store Composer: Directly consume Zustand Stores
  const { user } = useAuthStore();
  const { wallet, loading: walletLoading, fetchWallet } = useWalletStore();
  const { banners, loading: bannerLoading, error: bannerError, fetchBanners } = useBannerStore();
  const { transactions, loading: trxLoading, error: trxError, fetchTransactions } = useTransactionStore();
  const { notifications, fetchNotifications } = useNotificationStore();

  // Component states
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
  const [copiedWalletNo, setCopiedWalletNo] = useState(false);
  const [copiedPromoId, setCopiedPromoId] = useState<string | null>(null);
  const [currentBannerSlide, setCurrentBannerSlide] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);
  const [isAllServicesModalOpen, setIsAllServicesModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState(false);

  // Initialize store data on mount
  useEffect(() => {
    fetchWallet();
    fetchBanners();
    fetchTransactions();
    fetchNotifications();
  }, [fetchWallet, fetchBanners, fetchTransactions, fetchNotifications]);

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

  // Auto-play banners carousel with pause on hover
  useEffect(() => {
    if (banners.length <= 1 || isBannerHovered) return;

    const timer = setInterval(() => {
      setCurrentBannerSlide((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length, isBannerHovered]);

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

  // Copy promo code
  const handleCopyPromoCode = (code: string, id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedPromoId(id);
    setTimeout(() => setCopiedPromoId(null), 2000);
  };

  // Quick launcher — aligns with GurkyNet IA hubs
  const quickMenuItems = [
    { id: 'telco', label: 'Telekomunikasi', icon: Smartphone, path: '/dashboard/telekomunikasi', color: 'bg-blue-50 text-blue-600', badge: 'Populer' },
    { id: 'tagihan', label: 'Tagihan', icon: FileText, path: '/dashboard/tagihan', color: 'bg-indigo-50 text-indigo-600', badge: null },
    { id: 'topup-digital', label: 'Top Up Digital', icon: CreditCard, path: '/dashboard/topup-digital', color: 'bg-emerald-50 text-emerald-600', badge: null },
    { id: 'game', label: 'Game', icon: Gamepad2, path: '/dashboard/game', color: 'bg-purple-50 text-purple-600', badge: null },
    { id: 'voucher', label: 'Voucher Digital', icon: Gift, path: '/dashboard/voucher-digital', color: 'bg-rose-50 text-rose-600', badge: null },
    { id: 'langganan', label: 'Langganan', icon: PlayCircle, path: '/dashboard/langganan-digital', color: 'bg-orange-50 text-orange-600', badge: null },
    { id: 'international', label: 'International', icon: Globe, path: '/dashboard/international', color: 'bg-sky-50 text-sky-600', badge: null },
    { id: 'transfer', label: 'Transfer', icon: Send, path: '/dashboard/transfer', color: 'bg-teal-50 text-teal-600', badge: null },
    { id: 'all', label: 'Semua Produk', icon: LayoutGrid, path: '#all-services', color: 'bg-primary-50 text-primary-600', badge: null },
  ];

  const handleQuickMenuClick = (item: typeof quickMenuItems[0]) => {
    if (item.id === 'all') {
      setIsAllServicesModalOpen(true);
    } else {
      navigate(item.path);
    }
  };

  // Active announcement / broadcast notification
  const activeAnnouncement = useMemo(() => {
    if (isAnnouncementDismissed) return null;
    return notifications.find((n) => n.type === 'promo' || n.type === 'info') || null;
  }, [notifications, isAnnouncementDismissed]);

  // Fallback banners when store has no items or during initial load
  const displayBanners = useMemo(() => {
    if (banners && banners.length > 0) return banners;
    return [
      {
        id: 'banner-default-1',
        title: 'Diskon Spesial PPOB Hingga 50%',
        description: 'Beli pulsa, paket data & token PLN lebih hemat dengan cashback langsung ke saldo.',
        image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=1200',
        promoCode: 'GURKYHEMAT',
        isActive: true
      },
      {
        id: 'banner-default-2',
        title: 'Top Up Game Termurah & Instan',
        description: 'Mobile Legends, Free Fire, PUBG Mobile proses detik tanpa antri.',
        image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1200',
        promoCode: 'GAMECEPAT',
        isActive: true
      }
    ] as Banner[];
  }, [banners]);

  // Shortcut Favorites list
  const favorites = [
    { id: 'fav-1', name: 'Pulsa Nomor Pribadi', target: user?.phone || '0812-3456-7890', type: 'Pulsa', route: '/dashboard/pulsa' },
    { id: 'fav-2', name: 'Token PLN Rumah', target: '1402-8394-8192', type: 'Token PLN', route: '/dashboard/token-pln' },
    { id: 'fav-3', name: 'Top Up Digital', target: user?.phone || '0812-9876-5432', type: 'Top Up Digital', route: '/dashboard/topup-digital' }
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-8 max-w-7xl mx-auto">

      {/* 1. Announcement Notice Bar (Only renders if active notice exists) */}
      <AnimatePresence>
        {activeAnnouncement && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-900 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <Megaphone className="w-4 h-4 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-950 truncate">
                  {activeAnnouncement.title}
                </div>
                <div className="text-[11px] text-amber-800/80 truncate">
                  {activeAnnouncement.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsAnnouncementDismissed(true)}
              className="w-7 h-7 rounded-lg hover:bg-amber-500/10 flex items-center justify-center text-amber-700 hover:text-amber-950 transition-colors shrink-0 cursor-pointer"
              aria-label="Tutup Pengumuman"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Welcome & Greeting Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-primary-900/15 border border-primary-500/20">
        <div className="absolute right-0 top-0 -translate-y-8 translate-x-8 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-24 bottom-0 w-40 h-40 bg-accent-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2 bg-white/15 w-fit px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              <span>{user?.role || 'Member Reguler'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight">
              {dynamicGreeting}, {user?.name || 'Pelanggan Setia GurkyNet'}!
            </h1>
            <p className="text-primary-100 mt-1.5 text-sm md:text-base max-w-xl leading-relaxed font-medium">
              Siap melakukan transaksi hari ini? Semua layanan PPOB online 24 jam dengan konfirmasi otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3.5 bg-white/10 border border-white/15 rounded-2xl p-3.5 backdrop-blur-md shadow-inner self-start md:self-auto">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-yellow-300 shrink-0 border border-white/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-primary-100 font-medium">Poin Loyalitas</div>
              <div className="text-lg font-black tracking-tight">{wallet?.points ?? 0} Pts</div>
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

        {/* 3B. Promo Banner Carousel (Lazy Loaded Images + Controls) */}
        <div
          onMouseEnter={() => setIsBannerHovered(true)}
          onMouseLeave={() => setIsBannerHovered(false)}
          className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden flex flex-col justify-between min-h-[250px]"
        >
          {/* Header Banner Carousel */}
          <div className="flex justify-between items-center mb-3 relative z-10">
            <h2 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Promo & Penawaran Spesial
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentBannerSlide((prev) => (prev - 1 + displayBanners.length) % displayBanners.length)}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 flex items-center justify-center text-gray-600 transition-all cursor-pointer"
                aria-label="Banner Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentBannerSlide((prev) => (prev + 1) % displayBanners.length)}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 flex items-center justify-center text-gray-600 transition-all cursor-pointer"
                aria-label="Banner Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner Slides Area */}
          <div className="relative flex-1 rounded-2xl overflow-hidden min-h-[150px]">
            {bannerLoading && displayBanners.length === 0 ? (
              <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center text-gray-400 text-xs">
                Memuat promo menarik...
              </div>
            ) : bannerError && displayBanners.length === 0 ? (
              <div className="w-full h-full bg-red-50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-6 h-6 text-red-500 mb-1.5" />
                <p className="text-xs text-red-600 font-bold mb-2">Gagal memuat promo banner</p>
                <button
                  onClick={() => fetchBanners()}
                  className="text-xs font-bold text-white bg-red-600 px-3 py-1 rounded-lg hover:bg-red-700 cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {displayBanners.map((banner, index) => {
                  if (index !== currentBannerSlide) return null;

                  const bannerImage = resolveMediaUrl(
                    typeof banner.image === 'string' ? banner.image : (banner.image as any)?.url || ''
                  );

                  return (
                    <motion.div
                      key={banner.id}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 rounded-2xl overflow-hidden p-5 flex flex-col justify-between text-white"
                    >
                      {/* Background Lazy Loaded Image */}
                      <img
                        src={bannerImage || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=1200'}
                        alt={banner.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover z-0"
                      />
                      {/* Dark Gradient Overlay for optimal readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30 z-10"></div>

                      {/* Content over Banner */}
                      <div className="relative z-20">
                        <span className="inline-block bg-primary-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mb-1.5">
                          Spesial
                        </span>
                        <h3 className="font-extrabold text-base md:text-lg leading-snug drop-shadow-md">
                          {banner.title}
                        </h3>
                        <p className="text-white/85 text-xs max-w-md mt-1 line-clamp-2 drop-shadow">
                          {banner.description || 'Nikmati promo hemat transaksi PPOB di GurkyNet sekarang!'}
                        </p>
                      </div>

                      {/* Promo Code & Copy Action */}
                      <div className="relative z-20 flex items-center justify-between gap-3 mt-3">
                        {banner.promoCode ? (
                          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20">
                            <span className="text-[10px] text-white/90 font-medium">KODE:</span>
                            <span className="text-xs font-black text-yellow-300 tracking-wider font-mono">
                              {banner.promoCode}
                            </span>
                            <button
                              onClick={(e) => handleCopyPromoCode(banner.promoCode || '', banner.id, e)}
                              className="bg-white text-gray-900 hover:bg-gray-100 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ml-1 cursor-pointer"
                            >
                              {copiedPromoId === banner.id ? (
                                <>
                                  <Check className="w-3 h-3 text-green-600" />
                                  <span>Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-gray-600" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div></div>
                        )}

                        <button
                          onClick={() => banner.redirectUrl ? window.open(banner.redirectUrl, '_blank') : navigate('/dashboard/pulsa')}
                          className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/30 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          Gunakan <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Carousel Dots Indicators */}
          <div className="flex justify-center items-center gap-1.5 mt-3">
            {displayBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBannerSlide(idx)}
                aria-label={`Lihat banner ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${idx === currentBannerSlide ? 'w-6 bg-primary-600' : 'w-1.5 bg-gray-200 hover:bg-gray-300'}`}
              />
            ))}
          </div>
        </div>

      </div>

      <div className="px-1">
        <CatalogSearchBar />
      </div>

      {/* 4. Quick Menu Layanan PPOB (8 Menu Utama) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-extrabold text-gray-900 text-lg md:text-xl tracking-tight">
              Layanan PPOB & Pembayaran
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Pilih kategori layanan yang ingin Anda transaksikan</p>
          </div>
        </div>

        {/* 8 Items Grid */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3.5 md:gap-5">
          {quickMenuItems.map((menu) => {
            const IconComp = menu.icon;
            return (
              <button
                key={menu.id}
                onClick={() => handleQuickMenuClick(menu)}
                className="group flex flex-col items-center justify-center p-3 md:p-4 rounded-2xl border border-transparent hover:border-primary-100 hover:bg-primary-50/40 transition-all duration-200 cursor-pointer text-gray-700 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-300 relative ${menu.color} border border-gray-100 group-hover:scale-105 group-hover:shadow-md shadow-sm`}>
                  <IconComp className="w-6 h-6 md:w-7 md:h-7 transition-transform group-hover:scale-110" />
                  {menu.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                      {menu.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-center text-gray-800 group-hover:text-primary-600 leading-tight">
                  {menu.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Transaksi Terakhir & Shortcut Favorit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 5A. Transaksi Terakhir (Clickable Cards with Receipt Modal) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="font-extrabold text-gray-900 text-lg">Transaksi Terakhir</h2>
                <p className="text-xs text-gray-400 mt-0.5">5 aktivitas transaksi terbaru Anda</p>
              </div>
              <button
                onClick={() => navigate('/dashboard/riwayat')}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Semua Transaksi <History className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Transaksi */}
            <div className="divide-y divide-gray-50">
              {trxLoading && transactions.length === 0 ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                        <div className="space-y-1.5">
                          <div className="w-32 h-3.5 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-24 h-2.5 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                      </div>
                      <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : trxError && transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-red-600 font-bold mb-2">Gagal memuat riwayat transaksi</p>
                  <button
                    onClick={() => fetchTransactions()}
                    className="text-xs font-bold text-white bg-primary-600 px-3 py-1.5 rounded-xl hover:bg-primary-700 cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mb-3">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-1">Belum Ada Transaksi</h4>
                  <p className="text-xs text-gray-400 max-w-xs mb-4">
                    Anda belum melakukan transaksi apa pun. Yuk mulai beli pulsa atau token listrik sekarang!
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/pulsa')}
                    className="text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Mulai Transaksi Pertama
                  </button>
                </div>
              ) : (
                (Array.isArray(transactions) ? transactions : []).slice(0, 5).map((tx) => {
                  const isSuccess = isSuccessStatus(tx.status);
                  const isPending = isPendingStatus(tx.status);
                  const isFailed = isFailedStatus(tx.status);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className="py-3.5 flex items-center justify-between hover:bg-gray-50/80 px-2.5 rounded-2xl transition-all cursor-pointer group"
                      title="Klik untuk lihat detail transaksi"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${tx.serviceName?.toLowerCase().includes('pulsa') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          tx.serviceName?.toLowerCase().includes('pln') || tx.serviceName?.toLowerCase().includes('listrik') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            tx.serviceName?.toLowerCase().includes('game') ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              tx.serviceName?.toLowerCase().includes('data') ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {tx.serviceName?.toLowerCase().includes('pulsa') && <Smartphone className="w-5 h-5" />}
                          {(tx.serviceName?.toLowerCase().includes('pln') || tx.serviceName?.toLowerCase().includes('listrik')) && <Zap className="w-5 h-5" />}
                          {tx.serviceName?.toLowerCase().includes('game') && <Gamepad2 className="w-5 h-5" />}
                          {tx.serviceName?.toLowerCase().includes('data') && <Wifi className="w-5 h-5" />}
                          {!tx.serviceName?.toLowerCase().includes('pulsa') &&
                            !tx.serviceName?.toLowerCase().includes('pln') &&
                            !tx.serviceName?.toLowerCase().includes('game') &&
                            !tx.serviceName?.toLowerCase().includes('data') && <CreditCard className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                            {tx.productName || tx.serviceName || 'Transaksi PPOB'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {tx.targetNo || '-'} • {tx.date ? (tx.date.includes('T') ? new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : tx.date) : 'Baru saja'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <div className="font-black text-sm text-gray-900">
                          {formatIDR(tx.amount || 0)}
                        </div>
                        <div className="mt-1 flex justify-end">
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              Sukses
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3 text-red-600" />
                              Gagal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5B. Shortcut Favorit & Pusat Bantuan */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="font-extrabold text-gray-900 text-lg">Shortcut Favorit</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Akses cepat transaksi ke nomor kontak atau meteran yang sering Anda gunakan</p>

            <div className="space-y-3">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="p-3.5 bg-gray-50 hover:bg-primary-50/40 rounded-2xl border border-gray-100 hover:border-primary-100 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary-600 border border-gray-100 group-hover:border-primary-200 shadow-sm shrink-0">
                      {fav.type === 'Pulsa' && <Smartphone className="w-5 h-5" />}
                      {fav.type === 'Token PLN' && <Zap className="w-5 h-5" />}
                      {fav.type === 'E-Wallet' && <CreditCard className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-gray-900 truncate">{fav.name}</div>
                      <div className="text-xs text-gray-400 font-medium truncate">{fav.target}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(fav.route)}
                    className="text-xs font-bold text-primary-600 hover:text-white bg-white hover:bg-primary-600 border border-gray-200 hover:border-primary-600 px-3.5 py-1.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Kirim
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 24/7 CS Help Widget */}
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
              onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20GurkyNet,%20saya%20butuh%20bantuan', '_blank')}
              className="text-xs font-bold bg-white text-primary-700 hover:bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
            >
              Chat CS
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: Detail & Struk Transaksi (Clickable Transaction) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative overflow-hidden"
            >
              {/* Top Banner Status */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Detail Transaksi</span>
                  <h3 className="text-lg font-black text-gray-900 mt-0.5">
                    {selectedTransaction.productName || selectedTransaction.serviceName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl mb-4 border border-gray-100">
                {isSuccessStatus(selectedTransaction.status) ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-green-800">Transaksi Berhasil</div>
                      <div className="text-[10px] text-green-700/80">Pembayaran telah terverifikasi dan layanan telah terkirim.</div>
                    </div>
                  </>
                ) : isPendingStatus(selectedTransaction.status) ? (
                  <>
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-800">Menunggu Pembayaran / Proses</div>
                      <div className="text-[10px] text-amber-700/80">Transaksi sedang diproses oleh sistem operator.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-red-800">Transaksi Gagal</div>
                      <div className="text-[10px] text-red-700/80">Saldo Anda telah dikembalikan secara otomatis.</div>
                    </div>
                  </>
                )}
              </div>

              {/* Receipt Field Rows */}
              <div className="space-y-2.5 text-xs border-y border-gray-100 py-3.5 my-3.5">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">No. Invoice</span>
                  <span className="font-mono font-bold text-gray-900">{selectedTransaction.transactionCode || selectedTransaction.invoice_number || 'INV-20260803-XXXX'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Nomor Tujuan</span>
                  <span className="font-bold text-gray-900">{selectedTransaction.targetNo || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Waktu Transaksi</span>
                  <span className="font-medium text-gray-700">
                    {selectedTransaction.date ? (selectedTransaction.date.includes('T') ? new Date(selectedTransaction.date).toLocaleString('id-ID') : selectedTransaction.date) : 'Baru saja'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Nominal Produk</span>
                  <span className="font-bold text-gray-900">{formatIDR(selectedTransaction.amount || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-dashed border-gray-100">
                  <span className="text-gray-900 font-extrabold text-sm">Total Pembayaran</span>
                  <span className="text-primary-700 font-black text-sm">{formatIDR(selectedTransaction.amount || 0)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedTransaction.transactionCode || selectedTransaction.invoice_number || '');
                    alert('Nomor Invoice berhasil disalin ke clipboard!');
                  }}
                  className="flex-1 py-2.5 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-bold text-xs text-gray-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Salin Invoice
                </button>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="flex-1 py-2.5 px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: Semua Produk (Full Catalog Services) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAllServicesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Semua Produk & Layanan GurkyNet</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Katalog lengkap produk digital PPOB terintegrasi</p>
                </div>
                <button
                  onClick={() => setIsAllServicesModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grouped Services */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Telekomunikasi</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/pulsa'); }}
                      className="p-3 bg-gray-50 hover:bg-blue-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600">Pulsa Reguler</div>
                        <div className="text-[10px] text-gray-400">Semua Operator</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/paket-data'); }}
                      className="p-3 bg-gray-50 hover:bg-cyan-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Wifi className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-cyan-600">Paket Data</div>
                        <div className="text-[10px] text-gray-400">Kuota Murah</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Tagihan & Utilitas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/token-pln'); }}
                      className="p-3 bg-gray-50 hover:bg-amber-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-amber-600">Token PLN</div>
                        <div className="text-[10px] text-gray-400">Prabayar</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/tagihan'); }}
                      className="p-3 bg-gray-50 hover:bg-indigo-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-indigo-600">Tagihan Bulanan</div>
                        <div className="text-[10px] text-gray-400">PDAM, BPJS</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Hiburan & Keuangan</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/game'); }}
                      className="p-3 bg-gray-50 hover:bg-purple-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-purple-600">Game</div>
                        <div className="text-[10px] text-gray-400">MLBB, FF, PUBG</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/ewallet'); }}
                      className="p-3 bg-gray-50 hover:bg-emerald-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-600">E-Wallet</div>
                        <div className="text-[10px] text-gray-400">DANA, OVO, Gopay</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/voucher-digital'); }}
                      className="p-3 bg-gray-50 hover:bg-rose-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-rose-600">Voucher Digital</div>
                        <div className="text-[10px] text-gray-400">Google Play, Netflix</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/voucher-internet'); }}
                      className="p-3 bg-gray-50 hover:bg-sky-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Wifi className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-sky-600">Voucher Internet</div>
                        <div className="text-[10px] text-gray-400">Tembak / E-Voucher / Fisik</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsAllServicesModalOpen(false); navigate('/dashboard/transfer'); }}
                      className="p-3 bg-gray-50 hover:bg-teal-50/50 border border-gray-100 rounded-2xl flex items-center gap-3 text-left transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105">
                        <Send className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 group-hover:text-teal-600">Transfer</div>
                        <div className="text-[10px] text-gray-400">Sesama GurkyPay</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

