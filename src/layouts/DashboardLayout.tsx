import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
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
  Search, 
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
  ImageIcon,
  PlusCircle,
  Gamepad2,
  Settings,
  Menu,
} from 'lucide-react';

import { storageService } from '../services/storage.service';
import { useWalletStore } from '../store/wallet.store';
import { useNotificationStore } from '../store/notification.store';
import { useAuthStore } from '../store/auth.store';
import { useWebsiteStore } from '../store/website.store';
import { UserRole } from '../constants/auth';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';
// @ts-ignore
import logoImg from '../logo.png';
import { formatIDR } from '../utils/currency';

export const DashboardLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const { wallet, fetchWallet } = useWalletStore();
  const { settings, fetchSettings } = useWebsiteStore();
  const { unreadCount, notifications, fetchNotifications, markAllAsRead, markAsRead } = useNotificationStore();
  const { logout } = useAuthStore();

  const currentUser = (storageService.getUser() as {
    name?: string;
    email?: string;
    role?: UserRole;
    avatar?: string;
  } | null) || {
    name: 'User',
    email: '',
    role: 'User' as UserRole,
    avatar: ''
  };

  const userRole: UserRole = currentUser.role || 'User';

  useEffect(() => {
    fetchWallet();
    fetchNotifications();
    fetchSettings();
  }, [fetchWallet, fetchNotifications, fetchSettings]);

  // Soft-poll notifications so badge + history stay aligned with backend settlement.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [fetchNotifications]);

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
          { path: '/dashboard/finance', label: 'Dashboard', icon: DollarSign },
          { path: '/dashboard/finance/financial-report', label: 'Financial Report', icon: FileSpreadsheet },
          { path: '/dashboard/finance/settlement', label: 'Settlement', icon: Building },
          { path: '/dashboard/finance/refund-approval', label: 'Refund Approval', icon: Receipt },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Operations':
        return [
          { path: '/dashboard/operations', label: 'Dashboard', icon: Server },
          { path: '/dashboard/operations/product-providers', label: 'Product Provider Control', icon: Zap },
          { path: '/dashboard/operations/products', label: 'Product Management', icon: Layers },
          { path: '/dashboard/operations/providers', label: 'Provider Management', icon: Server },
          { path: '/dashboard/operations/monitoring', label: 'Service Monitoring', icon: Activity },
          { path: '/dashboard/operations/pricing', label: 'Pricing & Margin', icon: Tag },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Marketing':
        return [
          { path: '/dashboard/marketing', label: 'Dashboard', icon: Megaphone },
          { path: '/dashboard/marketing/banners', label: 'Banner', icon: ImageIcon },
          { path: '/dashboard/marketing/promotions', label: 'Promotion', icon: Tag },
          { path: '/dashboard/marketing/vouchers', label: 'Voucher', icon: Ticket },
          { path: '/dashboard/marketing/announcements', label: 'Announcement', icon: Bell },
          { path: '/dashboard/marketing/website/settings', label: 'Website Settings', icon: Settings },
          { path: '/dashboard/marketing/website/homepage-sections', label: 'Homepage Sections', icon: Layers },
          { path: '/dashboard/marketing/website/menus', label: 'Website Menu', icon: Menu },
          { path: '/dashboard/marketing/website/static-pages', label: 'Static Pages', icon: FileText },
          { path: '/dashboard/marketing/website/media-library', label: 'Media Library', icon: ImageIcon },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Customer Support':
        return [
          { path: '/dashboard/customer-support', label: 'Dashboard', icon: Headset },
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
          { path: '/dashboard/finance', label: 'Finance', icon: DollarSign },
          { path: '/dashboard/operations', label: 'Operations', icon: Server },
          { path: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
          { path: '/dashboard/customer-support', label: 'Customer Support', icon: Headset },
          { path: '/dashboard/account', label: 'Akun', icon: User },
          { path: '/dashboard/notifikasi', label: 'Notifications', icon: Bell, badge: unreadCount },
        ];

      case 'Super Admin':
        return [
          { path: '/dashboard/owner', label: 'Executive Dashboard', icon: Crown },
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
          { path: '/dashboard/wallet', label: 'Top Up', icon: PlusCircle },
          { path: '/dashboard/pulsa', label: 'Pulsa', icon: Smartphone },
          { path: '/dashboard/paket-data', label: 'Data Package', icon: Wifi },
          { path: '/dashboard/token-pln', label: 'PLN', icon: Zap },
          { path: '/dashboard/voucher', label: 'Game', icon: Gamepad2 },
          { path: '/dashboard/transfer', label: 'Transfer', icon: Send },
          { path: '/dashboard/tagihan', label: 'Bills', icon: FileText },
          { path: '/dashboard/riwayat', label: 'History', icon: History },
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
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Operations':
        return [
          { path: '/dashboard/operations', label: 'Dashboard', icon: Server },
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
          { path: '/dashboard/marketing/vouchers', label: 'Voucher', icon: Ticket },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Customer Support':
        return [
          { path: '/dashboard/customer-support', label: 'Dashboard', icon: Headset },
          { path: '/dashboard/customer-support/tickets', label: 'Tickets', icon: FileText },
          { path: '/dashboard/customer-support/refund-center', label: 'Refund', icon: Receipt },
          { path: '/dashboard/notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
          { path: '/dashboard/account', label: 'Akun', icon: User },
        ];
      case 'Owner':
        return [
          { path: '/dashboard/owner', label: 'Executive', icon: Crown },
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
            <img
              src={logoImg}
              alt={settings?.websiteName || 'GurkyNet'}
              className="w-9 h-9 object-contain rounded-xl shrink-0"
            />
            {!isSidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-extrabold text-xl text-gray-900 tracking-tight"
              >
                Gurky<span className="text-primary-600">Net</span>
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
          {menuItems.map((item) => {
            const active = isActive(item.path);
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all relative group ${active ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <IconComponent className={`w-5 h-5 shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-900'}`} />
                {!isSidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="truncate"
                  >
                    {item.label}
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
          
          {/* Left Block: Brand on mobile, search on desktop */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-2">
              <img
                src={logoImg}
                alt={settings?.websiteName || 'GurkyNet'}
                className="w-8 h-8 object-contain rounded-lg shrink-0"
              />
              <span className="font-extrabold text-base text-gray-900 tracking-tight">
                Gurky<span className="text-primary-600">Net</span>
              </span>
            </div>

            {/* Search bar placeholder */}
            <div className="hidden sm:flex items-center relative w-full max-w-md ml-4 md:ml-0">
              <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari layanan, voucher, tagihan..."
                className="w-full bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl pl-10 pr-4 py-2 text-sm text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          {/* Right Block: Actions & Profile */}
          <div className="flex items-center gap-3.5 md:gap-5">
            
            {/* Header Mini Wallet Balance Indicator */}
            <div className="hidden md:flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2">
              <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold leading-none uppercase tracking-wider">Saldo Anda</div>
                <div className="text-xs font-extrabold text-gray-800 mt-0.5">{wallet ? formatIDR(wallet.balance) : 'Loading...'}</div>
              </div>
            </div>

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
              <img 
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'} 
                alt={currentUser.name} 
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-white shrink-0 shadow-sm"
              />
              <div className="text-left hidden lg:block">
                <div className="text-xs font-bold text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">{currentUser.name}</div>
                <div className="text-[10px] font-bold text-indigo-600 mt-0.5 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 inline-block">{currentUser.role}</div>
              </div>
            </Link>

          </div>
        </header>

        {/* CONTENT VIEW AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
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