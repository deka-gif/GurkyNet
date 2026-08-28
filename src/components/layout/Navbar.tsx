import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWebsiteStore } from '../../store/website.store';
import { WebsiteMenu } from '../../types';
import { resolveMediaSrc } from '../../utils/mediaUrl';
import { Button } from '../ui/Button';

function buildMenuTree(menuItems: WebsiteMenu[]): WebsiteMenu[] {
  const itemMap = new Map<number, WebsiteMenu & { children: WebsiteMenu[] }>();

  menuItems.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  const roots: (WebsiteMenu & { children: WebsiteMenu[] })[] = [];
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
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const toggleMobileSubmenu = (id: number) => {
    setOpenMobileSubmenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const menuTree = buildMenuTree(menus.filter((m) => m.visible));

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 pt-4 md:pt-5">
        <div
          className={`container mx-auto max-w-7xl transition-all duration-500 ${
            isScrolled
              ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-primary-900/5 border border-gray-100/80 rounded-2xl md:rounded-full px-4 md:px-6 py-3'
              : 'bg-transparent px-0 py-0'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 group shrink-0" id="nav-brand">
              {resolveMediaSrc(settings?.logo) ? (
                <img
                  src={resolveMediaSrc(settings?.logo)}
                  alt={settings?.websiteName || 'Website'}
                  className="w-10 h-10 object-contain rounded-xl ring-2 ring-primary-100 group-hover:ring-primary-200 transition-all"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-900 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary-900/30">
                  {(settings?.websiteName || 'G').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-gray-900 leading-none">
                  {settings?.websiteName || 'Website'}
                </span>
                <span className="hidden sm:block text-[10px] font-semibold text-primary-600 tracking-wide uppercase mt-0.5">
                  Platform PPOB
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1" id="nav-desktop">
              <ul className="flex items-center gap-1">
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
                        <button className="flex items-center gap-1 text-gray-600 hover:text-primary-700 font-semibold transition-colors py-2 px-3 rounded-full hover:bg-primary-50/60 cursor-pointer focus:outline-none text-sm">
                          <span>{menu.title}</span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              activeDropdown === menu.id ? 'rotate-180 text-primary-600' : 'text-gray-400'
                            }`}
                          />
                        </button>

                        <div
                          className={`absolute left-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl p-2 shadow-xl shadow-primary-900/10 min-w-[220px] transition-all duration-200 origin-top-left ${
                            activeDropdown === menu.id
                              ? 'opacity-100 scale-100 translate-y-0 visible'
                              : 'opacity-0 scale-95 -translate-y-2 invisible pointer-events-none'
                          }`}
                        >
                          <ul className="space-y-0.5">
                            {menu.children?.map((child) => (
                              <li key={child.id}>
                                <a
                                  href={child.url}
                                  target={child.openInNewTab ? '_blank' : undefined}
                                  rel="noopener noreferrer"
                                  className="block px-3 py-2.5 text-sm text-gray-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl font-medium transition-all"
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
                        className="text-gray-600 hover:text-primary-700 font-semibold transition-colors py-2 px-3 rounded-full hover:bg-primary-50/60 text-sm"
                      >
                        {menu.title}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                <Link
                  to="/login"
                  className="text-sm font-bold text-gray-700 hover:text-primary-700 transition-colors px-4 py-2 rounded-full hover:bg-gray-50"
                >
                  Masuk
                </Link>
                <Link to="/register">
                  <Button variant="primary" className="!px-5 !py-2.5 text-sm">
                    Daftar
                  </Button>
                </Link>
              </div>
            </nav>

            <button
              className="lg:hidden text-gray-900 p-2 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
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
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-primary-900/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 w-[min(100%,20rem)] bg-white shadow-2xl z-50 lg:hidden flex flex-col"
              id="nav-mobile"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <span className="font-extrabold text-gray-900">Menu</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100"
                  aria-label="Tutup menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ul className="flex-1 overflow-y-auto p-5 flex flex-col gap-1">
                {menuTree.map((menu) => {
                  const hasChildren = menu.children && menu.children.length > 0;
                  const isSubmenuOpen = !!openMobileSubmenus[menu.id];

                  if (hasChildren) {
                    return (
                      <li key={menu.id}>
                        <button
                          onClick={() => toggleMobileSubmenu(menu.id)}
                          className="flex items-center justify-between w-full text-gray-800 hover:text-primary-700 font-bold py-3 px-2 rounded-xl hover:bg-primary-50/50"
                        >
                          <span>{menu.title}</span>
                          <ChevronDown
                            className={`w-5 h-5 transition-transform duration-200 ${
                              isSubmenuOpen ? 'rotate-180 text-primary-600' : 'text-gray-400'
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isSubmenuOpen && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="pl-3 ml-2 space-y-1 border-l-2 border-primary-100 overflow-hidden"
                            >
                              {menu.children?.map((child) => (
                                <li key={child.id}>
                                  <a
                                    href={child.url}
                                    target={child.openInNewTab ? '_blank' : undefined}
                                    rel="noopener noreferrer"
                                    className="block py-2 px-2 text-gray-600 hover:text-primary-700 font-medium text-sm rounded-lg"
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
                    <li key={menu.id}>
                      <a
                        href={menu.url}
                        target={menu.openInNewTab ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="block text-gray-800 hover:text-primary-700 font-bold py-3 px-2 rounded-xl hover:bg-primary-50/50"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {menu.title}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <div className="p-5 border-t border-gray-100 flex flex-col gap-3">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center font-bold py-3 rounded-full border-2 border-gray-200 text-gray-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
                >
                  Masuk Akun
                </Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="primary" className="w-full">
                    Daftar Sekarang
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
