import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { LazyRoute } from '../components/ui/LazyRoute';
import { LazyImage } from '../components/ui/LazyImage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Wallet, 
  Smartphone, 
  Wifi, 
  Zap, 
  Gift, 
  Send, 
  History, 
  Bell, 
  User, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  ArrowRight,
  UserCheck,
  FileText,
  Headset,
  DollarSign,
  Building,
  FileSpreadsheet,
  Server,
  Layers,
  Activity,
  Megaphone,
  Receipt,
  SearchCode,
  Tag,
  Ticket,
  Crown,
  TrendingUp,
  Users,
  ImageIcon,
  PlusCircle,
  Gamepad2,
  Settings,
  Menu,
  CreditCard,
  Globe,
  PlayCircle,
  Share2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Palette,
  Landmark,
  Banknote,
} from 'lucide-react';

import { storageService } from '../services/storage.service';
import { useWalletStore } from '../store/wallet.store';
import { useNotificationStore } from '../store/notification.store';
import { useAuthStore } from '../store/auth.store';
import { useWebsiteStore } from '../store/website.store';
import { UserRole } from '../constants/auth';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';
// @ts-ignore
import { resolveMediaSrc } from '../utils/mediaUrl';
import { useCmsLiveSync } from '../hooks/useCmsLiveSync';
import { useRealtimeChannel } from '../hooks/useRealtimeChannel';
import { useSoftRefresh } from '../hooks/useSoftRefresh';
import { RefreshPolicy } from '../lib/refreshPolicy';
import { formatIDR } from '../utils/currency';
import { getDynamicGreeting } from '../utils/greeting';
import { resolveMediaUrl } from '../utils/mediaUrl';

export const DashboardLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { wallet, fetchWallet, applyRealtimeBalance, syncAuthoritativeBalance } = useWalletStore();
  const { settings, fetchSettings } = useWebsiteStore();
  useCmsLiveSync(true);

  const brandLogo = resolveMediaSrc(settings?.logo);
  const brandName = settings?.websiteName || 'Website';
  const { unreadCount, notifications, fetchNotifications, markAllAsRead, markAsRead } = useNotificationStore();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);

  const currentUser = {
    name: authUser?.name || 'User',
    email: authUser?.email || '',
    role: (authUser?.role || 'User') as UserRole,
    avatar: resolveMediaUrl(authUser?.avatar || ''),
  };

  const userRole: UserRole = currentUser.role || 'User';

  useEffect(() => {
    fetchWallet();
    fetchNotifications();
    fetchSettings();
  }, [fetchWallet, fetchNotifications, fetchSettings]);

  const getToken = useCallback(() => storageService.getToken(), []);
  const walletChannel = authUser?.id ? [`wallet.${authUser.id}`] : [];

  useRealtimeChannel(
    !!authUser?.id,
    walletChannel,
    (evt) => {
      if (evt.event !== 'balance_updated') return;
      const bal = Number(evt.payload?.balance);
      if (Number.isFinite(bal)) {
        applyRealtimeBalance(bal);
      }
      void syncAuthoritativeBalance();
    },
    getToken,
    RefreshPolicy.walletBalance
  );

  const notificationChannel = authUser?.id ? [`user.notifications.${authUser.id}`] : [];
  useRealtimeChannel(
    !!authUser?.id,
    notificationChannel,
    () => {
      void fetchNotifications({ force: true });
    },
    () => storageService.getToken(),
    RefreshPolicy.notification
  );

  useSoftRefresh(!!authUser?.id, RefreshPolicy.notification * 6, () => {
    void fetchNotifications({ force: true });
  });

  // SRS 8.1 — staff Sanctum tokens idle-timeout after 30 minutes (TokenPolicy.php), slid
  // forward on every authenticated request by RenewTokenExpiration. The notification poll
  // above (useSoftRefresh) already keeps that alive while this tab is visible, but it
  // deliberately PAUSES while the tab is hidden — so a staff member who backgrounds a
  // division tab for >30 minutes has their token silently expire server-side, and the next
  // request after returning gets a genuine 401, forcing a full logout ("berubah menjadi
  // User/Ghost"). This heartbeat keeps running regardless of tab visibility, staff-only, so
  // RenewTokenExpiration gets a chance to renew the token before it can expire.
  useEffect(() => {
    if (!authUser?.id || userRole === 'User') return;

    const interval = window.setInterval(() => {
      void useAuthStore.getState().fetchUser();
    }, RefreshPolicy.staffSessionKeepAlive);

    return () => window.clearInterval(interval);
  }, [authUser?.id, userRole]);

  // Redirect if session is cleared manually
  useEffect(() => {
    const token = storageService.getToken();
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Redirect internal CMS users from root /dashboard to their respective default CMS portal
  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') {
      if (userRole === 'Finance') navigate('/dashboard/finance', { replace: true });
      else if (userRole === 'Operations') navigate('/dashboard/operations', { replace: true });
      else if (userRole === 'Marketing') navigate('/dashboard/marketing', { replace: true });
      else if (userRole === 'Customer Support') navigate('/dashboard/customer-support', { replace: true });
      else if (userRole === 'Owner') navigate('/dashboard/owner', { replace: true });
    }
  }, [location.pathname, userRole, navigate]);

  // Role-based Sidebar Menu Items
  const getMenuItemsForRole = () => {
    switch (userRole) {
      case 'Finance':
        return [
          { section: 'Utama' },
          { path: '/dashboard/finance', label: 'Dashboard', icon: DollarSign },
          { section: 'Financial Operations' },
          { path: '/dashboard/finance/treasury', label: 'Treasury', icon: Building },
          { path: '/dashboard/finance/wallets', label: 'Saldo Pengguna', icon: Wallet },
          { path: '/dashboard/finance/deposits', label: 'Deposit', icon: Landmark },
          { path: '/dashboard/finance/withdrawals', label: 'Withdraw', icon: Banknote },
          { section: 'Refund & Settlement' },
          { path: '/dashboard/finance/refund-queue', label: 'Refund Queue', icon: Share2 },
          { path: '/dashboard/finance/refund-approval', label: 'Refund Approval', icon: Receipt },
          { path: '/dashboard/finance/settlement', label: 'Settlement Queue', icon: Building },
          { section: 'Ledger & Reporting' },
          { path: '/dashboard/finance/ledger', label: 'Ledger', icon: FileSpreadsheet },
          { path: '/dashboard/finance/financial-report', label: 'Laporan Keuangan', icon: FileSpreadsheet },
          { section: 'Program & Loyalty' },
          { path: '/dashboard/finance/loyalty', label: 'Program Poin', icon: Gift },
          { path: '/dashboard/finance/referral', label: 'Program Referral', icon: Users },
          { section: 'Monitoring' },
          { path: '/dashboard/finance/alerts', label: 'Alerts', icon: Bell },
          { section: 'Global' },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Operations':
        return [
          { section: 'Utama' },
          { path: '/dashboard/operations', label: 'Dashboard', icon: Server },
          { section: 'Monitoring & Incident' },
          { path: '/dashboard/operations/issue-queue', label: 'Issue Queue', icon: AlertCircle },
          { path: '/dashboard/operations/alerts', label: 'Alerts', icon: Bell },
          { path: '/dashboard/operations/live-transactions', label: 'Live Transactions', icon: Activity },
          { path: '/dashboard/operations/monitoring', label: 'Service Monitoring', icon: Activity },
          { section: 'Produk & Integrasi' },
          { path: '/dashboard/operations/products', label: 'Product Management', icon: Layers },
          { path: '/dashboard/operations/product-providers', label: 'Product Provider Control', icon: Zap },
          { path: '/dashboard/operations/providers', label: 'Provider Management', icon: Server },
          { path: '/dashboard/operations/payment-gateways', label: 'Payment Gateway Control', icon: CreditCard },
          { section: 'Pricing & Margin' },
          { path: '/dashboard/operations/pricing', label: 'Pricing & Margin', icon: Tag },
          { path: '/dashboard/operations/agent-margin', label: 'Margin Agen', icon: TrendingUp },
          { path: '/dashboard/marketing/website/homepage-builder', label: 'Homepage Builder', icon: Layers },
          { path: '/dashboard/marketing/website/legal-center', label: 'Legal Center', icon: FileText },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Marketing':
        return [
          { section: 'Utama' },
          { path: '/dashboard/marketing', label: 'Dashboard', icon: Megaphone },
          { path: '/dashboard/marketing/banners', label: 'Banner', icon: ImageIcon },
          { path: '/dashboard/marketing/promotions', label: 'Promotion', icon: Tag },
          { path: '/dashboard/marketing/vouchers', label: 'Voucher', icon: Ticket },
          { path: '/dashboard/marketing/announcements', label: 'Announcement', icon: Bell },
          { path: '/dashboard/marketing/feedback-queue', label: 'Feedback Queue', icon: MessageSquare },
          { section: 'Katalog & Brand' },
          { path: '/dashboard/marketing/brand-logos', label: 'Logo Brand', icon: Palette, isNew: true },
          { section: 'Website' },
          { path: '/dashboard/marketing/website/settings', label: 'Website Settings', icon: Settings },
          { path: '/dashboard/marketing/website/homepage-builder', label: 'Homepage Builder', icon: Layers },
          { path: '/dashboard/marketing/website/homepage-sections', label: 'Homepage Sections', icon: Layers },
          { path: '/dashboard/marketing/website/menus', label: 'Website Menu', icon: Menu },
          { path: '/dashboard/marketing/website/static-pages', label: 'Static Pages', icon: FileText },
          { path: '/dashboard/marketing/website/legal-center', label: 'Legal Center', icon: FileText },
          { path: '/dashboard/marketing/website/media-library', label: 'Media Library', icon: ImageIcon },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Customer Support':
        return [
          { path: '/dashboard/customer-support', label: 'Dashboard', icon: Headset },
          { path: '/dashboard/customer-support/inbox', label: 'Inbox', icon: MessageSquare },
          { path: '/dashboard/customer-support/workflows', label: 'Workflows', icon: Share2 },
          { path: '/dashboard/customer-support/tickets', label: 'Tickets', icon: FileText },
          { path: '/dashboard/customer-support/customer-profile', label: 'Customer', icon: UserCheck },
          { path: '/dashboard/customer-support/refund-center', label: 'Refund', icon: Receipt },
          { path: '/dashboard/customer-support/knowledge-base', label: 'Knowledge Base', icon: FileText },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Owner':
        return [
          { path: '/dashboard/owner', label: 'Executive Dashboard', icon: Crown },
          { path: '/dashboard/owner/cash-flow', label: 'Prediksi Cash Flow', icon: TrendingUp },
          { path: '/dashboard/admin/workflows', label: 'Global Workflows', icon: Share2 },
          { path: '/dashboard/owner/alerts', label: 'Executive Alerts', icon: Bell },
          { path: '/dashboard/owner/approvals', label: 'Approvals', icon: ShieldCheck },
          { path: '/dashboard/owner/audit', label: 'Audit Center', icon: FileText },
          { path: '/dashboard/finance', label: 'Finance', icon: DollarSign },
          { path: '/dashboard/operations', label: 'Operations', icon: Server },
          { path: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
          { path: '/dashboard/customer-support', label: 'Customer Support', icon: Headset },
          { path: '/dashboard/owner/system-settings', label: 'System Settings', icon: Settings },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Super Admin':
        return [
          { path: '/dashboard/owner', label: 'Executive Dashboard', icon: Crown },
          { path: '/dashboard/admin/workflows', label: 'Global Workflows', icon: Share2 },
          { path: '/dashboard/finance', label: 'Finance CMS', icon: DollarSign },
          { path: '/dashboard/operations', label: 'Operations CMS', icon: Server },
          { path: '/dashboard/marketing', label: 'Marketing CMS', icon: Megaphone },
          { path: '/dashboard/customer-support', label: 'Customer Support CMS', icon: Headset },
          { path: '/dashboard', label: 'User Website', icon: Home },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'User':
      default:
        return [
          { path: '/dashboard', label: 'Home', icon: Home },
          { path: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
          { path: '/dashboard/topup', label: 'Top Up Saldo', icon: PlusCircle },
          { divider: true },
          { path: '/dashboard/telekomunikasi', label: 'Telekomunikasi', icon: Smartphone },
          { path: '/dashboard/tagihan', label: 'Pembayaran Tagihan', icon: Zap },
          { path: '/dashboard/topup-digital', label: 'E-Wallet', icon: CreditCard },
          { path: '/dashboard/game', label: 'Game', icon: Gamepad2 },
          { path: '/dashboard/voucher-digital', label: 'Voucher Digital', icon: Gift },
          { path: '/dashboard/langganan-digital', label: 'Langganan Digital', icon: PlayCircle },
          { path: '/dashboard/international', label: 'International Top Up', icon: Globe },
          { divider: true },
          { path: '/dashboard/transfer', label: 'Transfer', icon: Send },
          { path: '/dashboard/account/loyalty', label: 'Poin & Loyalitas', icon: Sparkles },
          { path: '/dashboard/account/referral', label: 'Referral', icon: Users },
          { path: '/dashboard/account/subscriptions', label: 'Langganan Otomatis', icon: Settings },
          { path: '/dashboard/riwayat', label: 'Riwayat', icon: History },
          { path: '/dashboard/help', label: 'Help Center', icon: Headset },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
    }
  };

  const menuItems = getMenuItemsForRole();

  // Role-based Mobile Bottom Nav Configuration
  const getMobileNavForRole = () => {
    switch (userRole) {
      case 'Finance':
        return [
          { path: '/dashboard/finance', label: 'Dashboard', icon: DollarSign },
          { path: '/dashboard/finance/financial-report', label: 'Report', icon: FileSpreadsheet },
          { path: '/dashboard/finance/settlement', label: 'Settlement', icon: Building },
          { path: '/dashboard/finance/refund-queue', label: 'Refund Queue', icon: Share2 },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Operations':
        return [
          { path: '/dashboard/operations', label: 'Dashboard', icon: Server },
          { path: '/dashboard/operations/issue-queue', label: 'Issue Queue', icon: AlertCircle },
          { path: '/dashboard/operations/alerts', label: 'Alerts', icon: Bell },
          { path: '/dashboard/operations/live-transactions', label: 'Live Tx', icon: Activity },
          { path: '/dashboard/operations/product-providers', label: 'Providers', icon: Zap },
          { path: '/dashboard/operations/products', label: 'Products', icon: Layers },
          { path: '/dashboard/operations/monitoring', label: 'Monitoring', icon: Activity },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Marketing':
        return [
          { path: '/dashboard/marketing', label: 'Dashboard', icon: Megaphone },
          { path: '/dashboard/marketing/banners', label: 'Banner', icon: ImageIcon },
          { path: '/dashboard/marketing/feedback-queue', label: 'Feedback', icon: MessageSquare },
          { path: '/dashboard/marketing/vouchers', label: 'Voucher', icon: Ticket },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Customer Support':
        return [
          { path: '/dashboard/customer-support', label: 'Dashboard', icon: Headset },
          { path: '/dashboard/customer-support/inbox', label: 'Inbox', icon: MessageSquare },
          { path: '/dashboard/customer-support/workflows', label: 'Workflows', icon: Share2 },
          { path: '/dashboard/customer-support/tickets', label: 'Tickets', icon: FileText },
          { path: '/dashboard/customer-support/refund-center', label: 'Refund', icon: Receipt },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Owner':
        return [
          { path: '/dashboard/owner', label: 'Executive', icon: Crown },
          { path: '/dashboard/admin/workflows', label: 'Workflows', icon: Share2 },
          { path: '/dashboard/owner/alerts', label: 'Alerts', icon: Bell },
          { path: '/dashboard/owner/approvals', label: 'Approvals', icon: ShieldCheck },
          { path: '/dashboard/finance', label: 'Finance', icon: DollarSign },
          { path: '/dashboard/operations', label: 'Operations', icon: Server },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Super Admin':
        return [
          { path: '/dashboard/owner', label: 'Executive', icon: Crown },
          { path: '/dashboard', label: 'User Site', icon: Home },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'User':
      default:
        return [
          { path: '/dashboard', label: 'Beranda', icon: Home },
          { path: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
          { path: '/dashboard/riwayat', label: 'Riwayat', icon: History },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
    }
  };

  const mobileNavItems = getMobileNavForRole();

  // Active path checking helper
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/dashboard/account') {
      return location.pathname === '/dashboard/account';
    }
    if (path === '/dashboard/wallet') {
      return location.pathname === '/dashboard/wallet';
    }
    if (path === '/dashboard/topup') {
      return location.pathname === '/dashboard/topup';
    }
    if (path === '/dashboard/tagihan') {
      return location.pathname === '/dashboard/tagihan' || location.pathname.startsWith('/dashboard/tagihan/');
    }
    if (path === '/dashboard/telekomunikasi') {
      return location.pathname === '/dashboard/telekomunikasi' || location.pathname.startsWith('/dashboard/telekomunikasi/')
        || ['/dashboard/pulsa', '/dashboard/paket-data', '/dashboard/voucher-internet'].includes(location.pathname);
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      <NetworkStatusAndLoader />
      
      {/* ========================================================= */}
      {/* DESKTOP/TABLET SIDEBAR */}
      {/* ========================================================= */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-gray-100 shadow-sm shrink-0 transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Sidebar Header Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-50">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className="w-9 h-9 object-contain rounded-xl shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black shrink-0">
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            {!isSidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-extrabold text-xl text-gray-900 tracking-tight truncate"
              >
                {brandName}
              </motion.span>
            )}
          </div>

          {/* Toggle Sidebar Button */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3.5 top-7 w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:shadow-md transition-all z-20"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item: any, index: number) => {
            if (item.section) {
              return (
                <div
                  key={`section-${index}`}
                  className={isSidebarCollapsed
                    ? `${index === 0 ? 'mt-0' : 'mt-2'} mx-2 border-t border-gray-100`
                    : `${index === 0 ? 'mt-0' : 'mt-4'} mb-1 px-4`}
                >
                  {!isSidebarCollapsed && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {item.section}
                    </span>
                  )}
                </div>
              );
            }
            if (item.divider) {
              return (
                <div
                  key={`divider-${index}`}
                  className={`my-2 ${isSidebarCollapsed ? 'mx-2 border-t border-gray-100' : 'mx-3 border-t border-gray-100'}`}
                />
              );
            }
            const active = isActive(item.path);
            const IconComponent = item.icon;
            return (
              <NavLink
                key={`${item.path}-${item.label}`}
                to={item.path}
                end={item.path === '/dashboard' || item.path === '/dashboard/wallet'}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all relative group ${active ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <IconComponent className={`w-5 h-5 shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'}`} />
                {!isSidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="truncate flex items-center gap-1.5"
                  >
                    {item.label}
                    {item.isNew && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#f8e3b0] text-[#7a5a1a]">
                        Baru
                      </span>
                    )}
                  </motion.span>
                )}

                {/* Badge for notification count */}
                {Boolean(item.badge && item.badge > 0) && !isSidebarCollapsed && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}

                {/* Badge indicator on collapsed sidebar */}
                {Boolean(item.badge && item.badge > 0) && isSidebarCollapsed && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full"></span>
                )}

                {/* Collapsed Tooltip */}
                {isSidebarCollapsed && (
                  <div className="absolute left-24 bg-gray-900 text-white text-xs font-semibold py-1.5 px-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-md whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-gray-50">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-50 transition-all relative group`}
          >
            <LogOut className="w-5 h-5 shrink-0 text-red-400 group-hover:text-red-600" />
            {!isSidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                Keluar Akun
              </motion.span>
            )}

            {/* Collapsed Tooltip */}
            {isSidebarCollapsed && (
              <div className="absolute left-24 bg-red-600 text-white text-xs font-semibold py-1.5 px-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-md whitespace-nowrap">
                Keluar Akun
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN CONTAINER CONTENT */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* HEADER AREA */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shrink-0 sticky top-0 z-30">
          
          {/* Left Block: Brand on mobile */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-2">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="w-8 h-8 object-contain rounded-lg shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0">
                  {brandName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-extrabold text-base text-gray-900 tracking-tight truncate max-w-[140px]">
                {brandName}
              </span>
            </div>
          </div>

          {/* Right Block: Actions & Profile */}
          <div className="flex items-center gap-3.5 md:gap-5">
            
            {/* Header Mini Wallet Balance Indicator — hanya untuk akun Customer/User, bukan staff internal */}
            {userRole === 'User' && (
              <div className="hidden md:flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2">
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-gray-400 font-bold leading-none uppercase tracking-wider">Saldo Anda</div>
                  <div className="text-xs font-extrabold text-gray-800 mt-0.5">{wallet ? formatIDR(wallet.balance) : 'Loading...'}</div>
                </div>
              </div>
            )}

            {/* Notification Badge Button */}
            <div className="relative">
              <button 
                onClick={() => {
                  const next = !isNotificationOpen;
                  setIsNotificationOpen(next);
                  if (next) {
                    void fetchNotifications();
                  }
                }}
                className="w-10 h-10 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-600 transition-colors relative"
                aria-label="Notifikasi"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotificationOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-gray-100 rounded-3xl shadow-2xl p-4 z-50 text-gray-700 max-h-[420px] flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm">Notifikasi</span>
                        {unreadCount > 0 && (
                          <span className="bg-primary-50 text-primary-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} Baru
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={() => markAllAsRead()}
                          className="text-[11px] font-bold text-primary-600 hover:underline cursor-pointer"
                        >
                          Tandai Semua Dibaca
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                      {Array.isArray(notifications) && notifications.length > 0 ? (
                        notifications.slice(0, 6).map((item) => (
                          <div 
                            key={item.id} 
                            onClick={() => !item.isRead && markAsRead(item.id)}
                            className={`p-3 rounded-2xl transition-all cursor-pointer border ${item.isRead ? 'bg-white border-gray-100 hover:bg-gray-50' : 'bg-primary-50/40 border-primary-100/60 hover:bg-primary-50/70'}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.isRead ? 'bg-gray-300' : 'bg-primary-600'}`}></span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-gray-900 truncate">{item.title}</div>
                                <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.message}</div>
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-gray-400 text-xs font-medium">
                          Belum ada notifikasi baru.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Avatar & Name */}
            <Link to="/dashboard/account" className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 p-1.5 pr-3.5 rounded-2xl border border-gray-100 transition-all group">
              {currentUser.avatar ? (
                <LazyImage
                  key={currentUser.avatar}
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-xl object-cover border border-white shrink-0 shadow-sm"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white bg-primary-100 text-[10px] font-black text-primary-700 shadow-sm">
                  {(currentUser.name || 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <div className="text-left hidden lg:block">
                <div className="text-[10px] font-semibold text-primary-600 leading-none">{getDynamicGreeting()} 👋</div>
                <div className="text-xs font-bold text-gray-900 leading-tight mt-1 group-hover:text-primary-600 transition-colors">{currentUser.name}</div>
                <div className="text-[10px] font-bold text-indigo-600 mt-0.5 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 inline-block">{currentUser.role}</div>
              </div>
            </Link>

          </div>
        </header>

        {/* CONTENT VIEW AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <LazyRoute>
            <Outlet />
          </LazyRoute>
        </main>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-2.5 px-6 flex justify-between items-center md:hidden z-40 shadow-xl shadow-black/10">
        {mobileNavItems.map((item) => {
          const active = isActive(item.path);
          const IconComponent = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center relative ${active ? 'text-primary-600' : 'text-gray-400'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${active ? 'bg-primary-50 text-primary-600 scale-105' : 'hover:bg-gray-50'}`}>
                <IconComponent className="w-5 h-5 shrink-0" />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold mt-1 tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};