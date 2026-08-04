import { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';
import { useWebsiteStore } from '../store/website.store';

export const AuthLayout = () => {
  const { settings, fetchSettings } = useWebsiteStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between selection:bg-primary-200 selection:text-primary-900 font-sans">
      <NetworkStatusAndLoader />
      {/* Header */}
      <header className="p-6 md:p-8 flex items-center justify-between container mx-auto max-w-7xl">
        <Link to="/" className="flex items-center gap-2">
          {settings?.logo ? (
            <img
              src={typeof settings.logo === 'string' ? settings.logo : settings.logo?.url}
              alt={settings.websiteName || 'GurkyNet'}
              className="w-10 h-10 object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/30">
              {settings?.websiteName ? settings.websiteName.charAt(0).toUpperCase() : 'G'}
            </div>
          )}
          <span className="font-bold text-2xl tracking-tight text-gray-900">
            {settings?.websiteName || 'GurkyNet'}
          </span>
        </Link>
        <Link 
          to="/" 
          className="text-sm font-semibold text-gray-600 hover:text-primary-600 transition-colors"
        >
          ← Kembali ke Beranda
        </Link>
      </header>

      {/* Main Content Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          
          {/* Left Decorative Branding Section (Hidden on Mobile) */}
          <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 p-10 text-white flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary-600/30 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="inline-block bg-primary-700/60 border border-primary-500/30 text-primary-200 text-xs px-3.5 py-1.5 rounded-full font-semibold mb-6">
                Platform PPOB Terpercaya
              </div>
              <h2 className="text-3xl font-extrabold mb-4 leading-tight">
                Satu Akun Untuk Semua Transaksi Digital Anda.
              </h2>
              <p className="text-primary-200 text-sm leading-relaxed">
                Akses layanan PPOB lengkap mulai dari isi pulsa, token listrik, hingga pembayaran tagihan bulanan dengan mudah.
              </p>
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-sm text-primary-100 font-medium">
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>Keamanan Enkripsi Tingkat Tinggi</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-primary-100 font-medium">
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>Proses Transaksi Real-time</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-primary-100 font-medium">
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>Layanan Customer Support 24/7</span>
              </div>
            </div>

            <div className="relative z-10 text-xs text-primary-300">
              © {new Date().getFullYear()} PT GurkyNet Digital Nusantara.
            </div>
          </div>

          {/* Right Form Outlet Area */}
          <div className="lg:col-span-7 p-6 sm:p-10 md:p-12 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md mx-auto"
            >
              <Outlet />
            </motion.div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-gray-500">
        GurkyNet &bull; Syarat & Ketentuan &bull; Kebijakan Privasi
      </footer>
    </div>
  );
};
