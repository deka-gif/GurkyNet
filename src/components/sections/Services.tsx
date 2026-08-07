import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  Gift, 
  CreditCard, 
  Briefcase, 
  Send, 
  FileText, 
  PlayCircle,
  Grid,
  X,
  LogIn,
  ChevronRight,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useProductStore } from '../../store/product.store';
import { useAuthStore } from '../../store/auth.store';
import { useWebsiteStore } from '../../store/website.store';
import { productService } from '../../services/product/product.service';
import { Product } from '../../types';
import { ServerErrorState, EmptyState } from '../ui/FeedbackStates';

function getCategoryIcon(iconName?: string, categorySlug?: string) {
  const name = (iconName || categorySlug || '').toLowerCase();
  if (name.includes('phone') || name.includes('pulsa') || name.includes('smartphone')) return Smartphone;
  if (name.includes('wifi') || name.includes('paket') || name.includes('data')) return Wifi;
  if (name.includes('zap') || name.includes('token') || name.includes('pln')) return Zap;
  if (name.includes('bag') || name.includes('gift') || name.includes('voucher')) return Gift;
  if (name.includes('card') || name.includes('tagihan') || name.includes('credit')) return CreditCard;
  if (name.includes('wallet') || name.includes('briefcase')) return Briefcase;
  if (name.includes('transfer') || name.includes('send')) return Send;
  if (name.includes('game') || name.includes('play')) return PlayCircle;
  return Grid;
}

export const Services: React.FC<{ section?: import('../../types').HomepageSection }> = ({ section: _section }) => {
  const navigate = useNavigate();
  const { categories, fetchCategories } = useProductStore();
  const { user, token } = useAuthStore();
  const { homepageCategories } = useWebsiteStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Guest Users
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [modalProducts, setModalProducts] = useState<Product[]>([]);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadCategories = async () => {
    if (homepageCategories.length > 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchCategories();
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat kategori layanan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, [homepageCategories.length]);

  const handleCategoryClick = async (category: any) => {
    // If logged in -> redirect directly to transaction page
    if (user && token) {
      const slug = (category.slug || category.name || '').toLowerCase();
      if (slug.includes('pulsa') && !slug.includes('international')) {
        navigate('/dashboard/pulsa');
      } else if (slug.includes('telekomunikasi')) {
        navigate('/dashboard/telekomunikasi');
      } else if (slug.includes('voucher-internet') || slug.includes('voucher_internet')) {
        navigate('/dashboard/voucher-internet');
      } else if (slug.includes('paket') || slug.includes('data')) {
        navigate('/dashboard/paket-data');
      } else if (slug.includes('token') || slug === 'pln') {
        navigate('/dashboard/token-pln');
      } else if (slug.includes('langganan') || slug.includes('streaming')) {
        navigate('/dashboard/langganan-digital');
      } else if (slug.includes('international')) {
        navigate('/dashboard/international');
      } else if (slug.includes('game')) {
        navigate('/dashboard/game');
      } else if (slug.includes('voucher')) {
        navigate('/dashboard/voucher-digital');
      } else if (slug.includes('wallet') || slug.includes('ewallet') || slug.includes('e-wallet') || slug.includes('topup-digital')) {
        navigate('/dashboard/topup-digital');
      } else if (slug.includes('tagihan') || slug.includes('pdam') || slug.includes('bpjs')) {
        navigate('/dashboard/tagihan');
      } else if (slug.includes('transfer')) {
        navigate('/dashboard/transfer');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    // Guest user -> Open preview modal and fetch products for this category
    setSelectedCategory(category);
    setModalLoading(true);
    setModalError(null);
    setModalProducts([]);

    try {
      const response = await productService.getProducts({ category: category.slug, per_page: 12 });
      if (response.success && Array.isArray(response.data)) {
        setModalProducts(response.data);
      } else {
        setModalError(response.message || 'Gagal memuat daftar produk.');
      }
    } catch (err: any) {
      setModalError(err?.message || 'Gagal memuat daftar produk.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <section className="py-20 md:py-32 bg-white" id="services">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-4 border border-primary-100"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-600" />
            Layanan Digital Realtime
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight"
          >
            Katalog Layanan <span className="text-primary-600">Terlengkap</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-lg text-gray-600 leading-relaxed"
          >
            Apapun kebutuhan transaksi PPOB dan pembayaran digital Anda, semuanya tersedia dengan harga kompetitif dan proses otomatis 24 jam.
          </motion.p>
        </div>

        {/* Categories Grid / Loading / Error / Empty States */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 animate-pulse space-y-4">
                <div className="w-12 h-12 bg-gray-200 rounded-2xl" />
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto">
            <ServerErrorState 
              title="Gagal Memuat Layanan" 
              description={error} 
              onRetry={loadCategories} 
              retryText="Coba Lagi"
            />
          </div>
        ) : (homepageCategories.length === 0 && categories.length === 0) ? (
          <div className="max-w-md mx-auto">
            <EmptyState 
              title="Belum Ada Kategori" 
              description="Saat ini kategori layanan belum dikonfigurasi pada database backend."
              onRetry={loadCategories}
              retryText="Muat Ulang"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(homepageCategories.length > 0 ? homepageCategories.map((bucket) => ({
              id: bucket.category?.id || bucket.key,
              name: bucket.label,
              slug: bucket.slug || bucket.key,
              icon: bucket.icon,
              preview: bucket.previewProduct,
              productCount: bucket.productCount,
            })) : categories).map((cat: any, index) => {
              const IconComp = getCategoryIcon(cat.icon, cat.slug);

              return (
                <motion.div
                  key={cat.id || index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => handleCategoryClick(cat)}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mb-4">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {cat.preview?.name
                        ? `${cat.preview.name} dan produk ${cat.name.toLowerCase()} lainnya.`
                        : `Layanan transaksi digital otomatis untuk kebutuhan ${cat.name.toLowerCase()}.`}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-xs font-extrabold text-primary-600 group-hover:translate-x-1 transition-transform">
                    <span>{cat.productCount ? `${cat.productCount} Produk` : 'Lihat Produk'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest Product Preview Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-primary-900 to-primary-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-300">
                    {React.createElement(getCategoryIcon(selectedCategory.icon, selectedCategory.slug), { className: "w-5 h-5" })}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold">{selectedCategory.name}</h3>
                    <p className="text-xs text-primary-200">Pratinjau Katalog Produk Publik</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-primary-200 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-y-auto min-h-[240px] space-y-4">
                {modalLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                    <p className="text-xs font-bold text-gray-500">Mengambil daftar produk dari server...</p>
                  </div>
                ) : modalError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-extrabold mb-1">Gagal Memuat Produk</p>
                      <p className="text-red-700">{modalError}</p>
                      <button
                        onClick={() => handleCategoryClick(selectedCategory)}
                        className="mt-3 px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  </div>
                ) : modalProducts.length === 0 ? (
                  <EmptyState 
                    title="Belum Ada Produk"
                    description={`Produk untuk kategori ${selectedCategory.name} belum tersedia di database.`}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                      Daftar Produk ({modalProducts.length})
                    </div>
                    {modalProducts.map((product) => (
                      <div 
                        key={product.id}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-primary-200 flex items-center justify-between gap-4 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-extrabold text-sm text-gray-900 truncate">
                              {product.name}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              product.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {product.isActive !== false ? 'Tersedia' : 'Gangguan'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>Kode: <strong className="text-gray-700">{product.code}</strong></span>
                            {product.operatorName && (
                              <>
                                <span>•</span>
                                <span>Provider: <strong className="text-gray-700">{product.operatorName}</strong></span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs text-gray-400 font-bold">Harga</div>
                          <div className="text-base font-black text-primary-600">
                            Rp {Number(product.price).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-500 text-center sm:text-left">
                  <span className="font-bold text-gray-800">Siap bertransaksi?</span> Masuk ke akun Anda untuk memulai.
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition w-1/2 sm:w-auto text-center cursor-pointer"
                  >
                    Tutup
                  </button>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-extrabold hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-md shadow-primary-500/20 w-1/2 sm:w-auto text-center"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
