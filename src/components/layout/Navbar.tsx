import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogIn, UserCheck, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWebsiteStore } from '../../store/website.store';
import { WebsiteMenu } from '../../types';
import logoImg from '../../logo.png'; // Direct import file logo dari src/logo.png

// Helper to construct nested menu structure
function buildMenuTree(menuItems: WebsiteMenu[]): WebsiteMenu[] {
  const itemMap = new Map<number, WebsiteMenu & { children: WebsiteMenu[] }>();

  // Initialize map
  menuItems.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  const roots: (WebsiteMenu & { children: WebsiteMenu[] })[] = [];

  // Sort by displayOrder first
  const sortedItems = [...menuItems].sort((a, b) => a.displayOrder - b.displayOrder);

  sortedItems.forEach((item) => {
    const mapped = itemMap.get(item.id)!;
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(mapped);
      } else {
        roots.push(mapped);
      }
    } else {
      roots.push(mapped);
    }
  });

  // Sort children of each item
  itemMap.forEach((mapped) => {
    mapped.children.sort((a, b) => a.displayOrder - b.displayOrder);
  });

  return roots.sort((a, b) => a.displayOrder - b.displayOrder);
}

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [openMobileSubmenus, setOpenMobileSubmenus] = useState<Record<number, boolean>>({});

  const { settings, menus } = useWebsiteStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileSubmenu = (id: number) => {
    setOpenMobileSubmenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build the dynamic menu tree
  const menuTree = buildMenuTree(menus.filter((m) => m.visible));

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-md shadow-xs py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center gap-2" id="nav-brand">
            <img
              src={logoImg}
              alt={settings?.websiteName || 'GurkyNet'}
              className="w-10 h-10 object-contain rounded-xl"
            />
            <span className="font-extrabold text-2xl tracking-tight text-gray-900">
              {settings?.websiteName || 'GurkyNet'}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8" id="nav-desktop">
            <ul className="flex items-center gap-6">
              {menuTree.map((menu) => {
                const hasChildren = menu.children && menu.children.length > 0;

                if (hasChildren) {
                  return (
                    <li
                      key={menu.id}
                      className="relative"
                      onMouseEnter={() => setActiveDropdown(menu.id)}
                      onMouseLeave={() => setActiveDropdown(null)}
                    >
                      <button className="flex items-center gap-1 text-gray-600 hover:text-primary-600 font-semibold transition-colors py-2 cursor-pointer focus:outline-none">
                        <span>{menu.title}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            activeDropdown === menu.id ? 'rotate-180 text-primary-600' : 'text-gray-400'
                          }`}
                        />
                      </button>

                      {/* Submenu Dropdown */}
                      <div
                        className={`absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl p-3 shadow-xl min-w-[200px] transition-all duration-200 origin-top-left ${
                          activeDropdown === menu.id
                            ? 'opacity-100 scale-100 translate-y-0 visible'
                            : 'opacity-0 scale-95 -translate-y-2 invisible pointer-events-none'
                        }`}
                      >
                        <ul className="space-y-1">
                          {menu.children?.map((child) => (
                            <li key={child.id}>
                              <a
                                href={child.url}
                                target={child.openInNewTab ? '_blank' : undefined}
                                rel="noopener noreferrer"
                                className="block px-3 py-2 text-sm text-gray-600 hover:text-primary-600 hover:bg-primary-50/50 rounded-xl font-medium transition-all"
                              >
                                {child.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={menu.id}>
                    <a
                      href={menu.url}
                      target={menu.openInNewTab ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-primary-600 font-semibold transition-colors"
                    >
                      {menu.title}
                    </a>
                  </li>
                );
              })}

            </ul>

            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-bold text-gray-700 hover:text-primary-600 transition-colors px-4 py-2"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all shadow-md shadow-primary-500/20"
              >
                Daftar
              </Link>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden text-gray-900 p-2 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            id="mobile-nav-toggle"
            aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="nav-mobile"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white shadow-xl border-t border-gray-100 py-6 px-6 lg:hidden max-h-[85vh] overflow-y-auto"
            id="nav-mobile"
          >
            <ul className="flex flex-col gap-4">
              {menuTree.map((menu) => {
                const hasChildren = menu.children && menu.children.length > 0;
                const isSubmenuOpen = !!openMobileSubmenus[menu.id];

                if (hasChildren) {
                  return (
                    <li key={menu.id} className="border-b border-gray-50 pb-2">
                      <button
                        onClick={() => toggleMobileSubmenu(menu.id)}
                        className="flex items-center justify-between w-full text-gray-800 hover:text-primary-600 font-bold text-lg py-1.5"
                      >
                        <span>{menu.title}</span>
                        <ChevronDown
                          className={`w-5 h-5 transition-transform duration-200 ${
                            isSubmenuOpen ? 'rotate-180 text-primary-600' : 'text-gray-400'
                          }`}
                        />
                      </button>

                      {/* Nested Mobile Child Menu */}
                      <AnimatePresence>
                        {isSubmenuOpen && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pl-4 mt-2 space-y-2 border-l-2 border-primary-100"
                          >
                            {menu.children?.map((child) => (
                              <li key={child.id}>
                                <a
                                  href={child.url}
                                  target={child.openInNewTab ? '_blank' : undefined}
                                  rel="noopener noreferrer"
                                  className="block py-1.5 text-gray-600 hover:text-primary-600 font-medium text-base"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {child.title}
                                </a>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                }

                return (
                  <li key={menu.id} className="border-b border-gray-50 pb-2">
                    <a
                      href={menu.url}
                      target={menu.openInNewTab ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="block text-gray-800 hover:text-primary-600 font-bold text-lg py-1.5"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {menu.title}
                    </a>
                  </li>
                );
              })}

              <li className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:text-primary-600 font-bold py-3 rounded-full text-center"
                >
                  <LogIn className="w-5 h-5" />
                  Masuk Akun
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 rounded-full text-center"
                >
                  <UserCheck className="w-5 h-5" />
                  Daftar Sekarang
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};