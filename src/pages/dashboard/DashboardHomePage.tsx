import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  CreditCard, 
  Gift, 
  Gamepad2, 
  Send, 
  FileText, 
  PlusCircle, 
  ArrowUpRight, 
  History, 
  Bell, 
  Search, 
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
  User 
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { useBanner } from '../../hooks/useBanner';
import { useTransactions } from '../../hooks/useTransactions';
import { dashboardService } from '../../services';
import { LoadingState } from '../../components/ui/FeedbackStates';

export const DashboardHomePage = () => {
  const { user } = useAuth();
  const { wallet, loading: walletLoading } = useWallet(true);
  const { banners, loading: bannerLoading } = useBanner(true);
  const { transactions, loading: trxLoading } = useTransactions(true);
  const navigate = useNavigate();

  const [quickMenu, setQuickMenu] = useState<any[]>([]);

  useEffect(() => {
    dashboardService.getQuickMenu().then(menu => setQuickMenu(menu));
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');

  // Auto-play banners
  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (walletLoading || bannerLoading || trxLoading) {
    return <LoadingState title="Menyiapkan Dashboard Anda..." description="Sedang memuat data akun, saldo, dan promosi terbaru dari Laravel API." />;
  }

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to format currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  // Get dynamic greeting based on Indonesian local hours
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 11) return 'Selamat Pagi';
    if (hours < 15) return 'Selamat Siang';
    if (hours < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // Map icon names to Lucide icons
  const renderMenuIcon = (iconName: string) => {
    switch (iconName) {
      case 'Smartphone': return <Smartphone className="w-6 h-6" />;
      case 'Wifi': return <Wifi className="w-6 h-6" />;
      case 'Zap': return <Zap className="w-6 h-6" />;
      case 'CreditCard': return <CreditCard className="w-6 h-6" />;
      case 'Gift': return <Gift className="w-6 h-6" />;
      case 'Gamepad2': return <Gamepad2 className="w-6 h-6" />;
      case 'Send': return <Send className="w-6 h-6" />;
      case 'FileText': return <FileText className="w-6 h-6" />;
      default: return <Smartphone className="w-6 h-6" />;
    }
  };

  // Handle Quick Menu routing
  const handleQuickMenuClick = (type: string) => {
    switch (type) {
      case 'pulsa':
        navigate('/dashboard/pulsa');
        break;
      case 'data':
        navigate('/dashboard/paket-data');
        break;
      case 'pln':
        navigate('/dashboard/token-pln');
        break;
      case 'ewallet':
        navigate('/dashboard/wallet');
        break;
      case 'voucher':
      case 'game':
        navigate('/dashboard/voucher');
        break;
      case 'transfer':
        navigate('/dashboard/transfer');
        break;
      case 'tagihan':
        navigate('/dashboard/tagihan');
        break;
      default:
        break;
    }
  };

  // Shortcut Favorites list (ready for API mapping)
  const favorites = [
    { id: 'fav-1', name: 'Beli Pulsa - Ibu', target: '081298765432', type: 'Pulsa', route: '/dashboard/pulsa' },
    { id: 'fav-2', name: 'PLN Rumah Utama', target: '14028394819', type: 'Token PLN', route: '/dashboard/token-pln' },
    { id: 'fav-3', name: 'Top Up ShopeePay', target: '081234567890', type: 'E-Wallet', route: '/dashboard/wallet' }
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      
      {/* 1. Welcome & Greeting Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-800 to-primary-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-primary-950/10">
        <div className="absolute right-0 top-0 -translate-y-4 translate-x-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute right-12 bottom-0 w-32 h-32 bg-primary-500/20 rounded-full blur-xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 bg-white/10 w-fit px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              <span>{user?.role || 'User'}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {user?.name || 'User GurkyNet'}!
            </h2>
            <p className="text-primary-100 mt-1 text-sm md:text-base">
              Siap melakukan transaksi hari ini? Semua transaksi Anda dijamin aman.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-primary-200 font-medium">Point Anda</div>
              <div className="text-base font-bold">{wallet?.points || 0} Pts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid for Wallet and Banners */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 2. Saldo Wallet Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Saldo GurkyPay</span>
              <span className="text-xs font-semibold bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full border border-primary-100">
                {wallet?.walletNo || 'GK-XXXXXXXX'}
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                {formatIDR(wallet?.balance || 0)}
              </h3>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                Update: {wallet?.lastUpdated ? new Date(wallet.lastUpdated).toLocaleTimeString('id-ID') : 'Baru saja'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-6">
            <button 
              onClick={() => navigate('/dashboard/wallet')}
              className="flex flex-col items-center justify-center py-2.5 px-2 bg-gray-50 hover:bg-primary-50 hover:text-primary-600 rounded-2xl border border-transparent hover:border-primary-100 transition-all group"
            >
              <PlusCircle className="w-6 h-6 text-gray-500 group-hover:text-primary-600 mb-1.5 transition-colors" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-primary-700">Top Up</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/transfer')}
              className="flex flex-col items-center justify-center py-2.5 px-2 bg-gray-50 hover:bg-primary-50 hover:text-primary-600 rounded-2xl border border-transparent hover:border-primary-100 transition-all group"
            >
              <ArrowUpRight className="w-6 h-6 text-gray-500 group-hover:text-primary-600 mb-1.5 transition-colors" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-primary-700">Transfer</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/riwayat')}
              className="flex flex-col items-center justify-center py-2.5 px-2 bg-gray-50 hover:bg-primary-50 hover:text-primary-600 rounded-2xl border border-transparent hover:border-primary-100 transition-all group"
            >
              <History className="w-6 h-6 text-gray-500 group-hover:text-primary-600 mb-1.5 transition-colors" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-primary-700">Riwayat</span>
            </button>
          </div>
        </div>

        {/* 3. Promo Banner Carousel */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-center mb-3 relative z-10">
            <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Promo & Penawaran Spesial
            </h4>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentSlide((prev) => (prev + 1) % banners.length)}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 rounded-2xl overflow-hidden mt-2">
            <AnimatePresence mode="wait">
              {banners.map((banner, index) => {
                if (index !== currentSlide) return null;
                return (
                  <motion.div
                    key={banner.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 p-5 flex flex-col justify-between text-white rounded-2xl"
                    style={{ 
                      background: banner.image.startsWith('http') 
                        ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${banner.image}) center/cover no-repeat` 
                        : banner.image 
                    }}
                  >
                    <div>
                      <h5 className="font-extrabold text-base md:text-lg mb-1">{banner.title}</h5>
                      <p className="text-white/80 text-xs max-w-md">{banner.description}</p>
                    </div>

                    {banner.promoCode && (
                      <div className="flex items-center justify-between gap-3 bg-black/20 backdrop-blur-md rounded-xl p-2 border border-white/10 w-fit mt-3">
                        <div className="text-[10px] font-semibold text-white/90 uppercase tracking-wider pl-1.5">
                          Kode: <span className="font-black text-xs text-yellow-300">{banner.promoCode}</span>
                        </div>
                        <button 
                          onClick={() => handleCopyCode(banner.promoCode || '', banner.id)}
                          className="bg-white text-gray-900 hover:bg-gray-100 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95 shrink-0"
                        >
                          {copiedId === banner.id ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              Tersalin
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Salin
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Carousel Indicators */}
          <div className="flex justify-center gap-1.5 mt-3">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-6 bg-primary-600' : 'w-1.5 bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

      </div>

      {/* 4. Quick Menu Grid */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
        <h4 className="font-extrabold text-gray-900 mb-5 text-lg">Layanan PPOB</h4>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
          {(quickMenu.length > 0 ? quickMenu : []).map((menu) => (
            <button
              key={menu.id}
              onClick={() => handleQuickMenuClick(menu.type)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl border border-transparent hover:border-primary-100 transition-all bg-gray-50 text-gray-700 hover:bg-primary-50/50 hover:text-primary-600"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-colors relative bg-white text-gray-600 shadow-sm border border-gray-100">
                {renderMenuIcon(menu.iconName)}
                {menu.badge && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                    {menu.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-center leading-tight">{menu.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 5. Transaksi Terakhir */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
          <div className="flex justify-between items-center mb-5">
            <h4 className="font-extrabold text-gray-900 text-lg">Transaksi Terakhir</h4>
            <span 
              onClick={() => navigate('/dashboard/riwayat')}
              className="text-xs font-bold text-primary-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              Semua Transaksi <History className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-gray-50/50 px-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.serviceName === 'Pulsa' ? 'bg-blue-50 text-blue-600' :
                    tx.serviceName === 'Token PLN' ? 'bg-amber-50 text-amber-600' :
                    tx.serviceName === 'E-Wallet' || tx.serviceName === 'E-wallet' ? 'bg-indigo-50 text-indigo-600' :
                    tx.serviceName === 'Transfer Saldo' || tx.serviceName === 'Transfer' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {tx.serviceName === 'Pulsa' && <Smartphone className="w-5 h-5" />}
                    {tx.serviceName === 'Token PLN' && <Zap className="w-5 h-5" />}
                    {tx.serviceName === 'E-Wallet' && <CreditCard className="w-5 h-5" />}
                    {tx.serviceName === 'E-wallet' && <CreditCard className="w-5 h-5" />}
                    {(tx.serviceName === 'Transfer Saldo' || tx.serviceName === 'Transfer') && <Send className="w-5 h-5" />}
                    {tx.serviceName === 'Paket Data' && <Wifi className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-gray-900">{tx.productName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {tx.targetNo} • {tx.date.includes('T') ? new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : tx.date}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-gray-900">{formatIDR(tx.amount)}</div>
                  <div className="mt-1 flex justify-end">
                    {tx.status === 'sukses' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        Sukses
                      </span>
                    )}
                    {tx.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3 text-yellow-600" />
                        Pending
                      </span>
                    )}
                    {tx.status === 'gagal' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3 text-red-600" />
                        Gagal
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Shortcut Layanan Favorit */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-gray-900 mb-4 text-lg flex items-center gap-1.5">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Shortcut Favorit
            </h4>
            <p className="text-xs text-gray-500 mb-4">Akses cepat ke kontak atau nomor tagihan yang sering Anda transaksi.</p>
            
            <div className="space-y-3">
              {favorites.map((fav) => (
                <div key={fav.id} className="p-3 bg-gray-50 hover:bg-primary-50/40 rounded-2xl border border-gray-100 hover:border-primary-100 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-primary-600 border border-gray-100 group-hover:border-primary-200 shadow-sm shrink-0">
                      {fav.type === 'Pulsa' && <Smartphone className="w-4 h-4" />}
                      {fav.type === 'Token PLN' && <Zap className="w-4 h-4" />}
                      {fav.type === 'E-Wallet' && <CreditCard className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-gray-900">{fav.name}</div>
                      <div className="text-xs text-gray-500 font-medium">{fav.target} • {fav.type}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(fav.route)}
                    className="text-xs font-bold text-primary-600 hover:text-white bg-white hover:bg-primary-600 border border-gray-200 hover:border-primary-600 px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    Kirim
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary-50/50 border border-primary-100 rounded-2xl p-4 mt-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Butuh Bantuan Transaksi?</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Hubungi CS GurkyNet aktif 24 jam via live chat WhatsApp.</div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
