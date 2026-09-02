import { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, Shield, Smartphone, Zap, Wifi, Wallet } from 'lucide-react';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';
import { useWebsiteStore } from '../store/website.store';
import { resolveMediaSrc } from '../utils/mediaUrl';
import { useCmsLiveSync } from '../hooks/useCmsLiveSync';

const TRUST_POINTS = [
  'Keamanan Enkripsi Tingkat Tinggi',
  'Proses Transaksi Real-time',
  'Layanan Customer Support 24/7',
] as const;

const SERVICE_BADGES = [
  { icon: Smartphone, label: 'Pulsa' },
  { icon: Zap, label: 'Token PLN' },
  { icon: Wifi, label: 'Paket Data' },
  { icon: Wallet, label: 'E-Wallet' },
] as const;

export const AuthLayout = () => {
  const { settings, fetchSettings } = useWebsiteStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useCmsLiveSync(true);

  const logoSrc = resolveMediaSrc(settings?.logo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/40 flex flex-col selection:bg-primary-200 selection:text-primary-900 font-sans relative overflow-x-hidden">
      <NetworkStatusAndLoader />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="brand-glow-primary -top-32 -right-32 w-[28rem] h-[28rem]" />
        <div className="brand-glow-accent -bottom-32 -left-32 w-80 h-80" />
        {logoSrc && (
          <img
            src={logoSrc}
            alt=""
            aria-hidden
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,36rem)] opacity-[0.03] select-none"
          />
        )}
      </div>

      <header className="relative z-10 p-5 md:p-8 flex items-center justify-between container mx-auto max-w-7xl">
        <Link to="/" className="flex items-center gap-2.5 group">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={settings?.websiteName || 'GurkyNet'}
              className="w-10 h-10 object-contain rounded-xl ring-2 ring-primary-100 group-hover:ring-primary-200 transition-all"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-900 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-900/30">
              {settings?.websiteName ? settings.websiteName.charAt(0).toUpperCase() : 'G'}
            </div>
          )}
          <span className="font-extrabold text-xl md:text-2xl tracking-tight text-gray-900">
            {settings?.websiteName || 'GurkyNet'}
          </span>
        </Link>
        <Link
          to="/"
          className="text-sm font-semibold text-gray-500 hover:text-primary-700 transition-colors hidden sm:inline-flex items-center gap-1"
        >
          ← Kembali ke Beranda
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl shadow-primary-900/10 shadow-[0_25px_70px_-20px_rgba(15,106,77,0.35)] border border-white ring-1 ring-primary-100/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0 lg:min-h-[580px]">

          {/* Desktop branding panel */}
          <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 p-10 text-white flex-col justify-between relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
              aria-hidden
            />
            <div className="brand-glow-primary -top-16 -left-16 w-64 h-64 opacity-50" />
            <div className="brand-glow-accent -bottom-16 -right-16 w-56 h-56 opacity-40" />
            {logoSrc && (
              <img src={logoSrc} alt="" aria-hidden className="absolute bottom-8 right-8 w-32 h-32 opacity-[0.07] object-contain select-none" />
            )}

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-primary-100 text-xs px-3.5 py-1.5 rounded-full font-semibold mb-6">
                <Shield className="w-3.5 h-3.5 text-accent-400" />
                Platform PPOB Terpercaya
              </div>
              <h2 className="text-3xl font-extrabold mb-4 leading-tight tracking-tight">
                Satu Akun Untuk Semua Transaksi Digital Anda.
              </h2>
              <p className="text-primary-200/90 text-sm leading-relaxed">
                Akses layanan PPOB lengkap mulai dari isi pulsa, token listrik, hingga pembayaran tagihan bulanan dengan mudah.
              </p>
            </div>

            <div className="relative z-10 space-y-3.5">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-3 text-sm text-primary-100 font-medium">
                  <div className="w-7 h-7 rounded-full bg-primary-600/80 ring-1 ring-accent-500/30 flex items-center justify-center text-white shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span>{point}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {SERVICE_BADGES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold text-primary-100"
                  >
                    <Icon className="w-4 h-4 text-accent-400 shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 text-xs text-primary-300/80">
              © {new Date().getFullYear()} PT GurkyNet Digital Nusantara.
            </div>
          </div>

          {/* Mobile compact branding strip */}
          <div className="lg:hidden col-span-1 bg-gradient-to-r from-primary-800 to-primary-900 px-5 py-4 text-white relative overflow-hidden">
            <div className="brand-glow-accent top-0 right-0 w-32 h-32 opacity-30" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-accent-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-accent-400 uppercase tracking-wide">Platform PPOB Terpercaya</p>
                <p className="text-sm font-semibold text-primary-50 leading-snug">Transaksi digital cepat & aman</p>
              </div>
            </div>
          </div>

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

      <footer className="relative z-10 p-6 text-center text-xs text-gray-500">
        {settings?.copyright || settings?.websiteName || ''}
        {' · '}
        <Link to="/legal/terms-conditions" className="hover:text-primary-600 transition-colors">
          Syarat & Ketentuan
        </Link>
        {' · '}
        <Link to="/legal/privacy-policy" className="hover:text-primary-600 transition-colors">
          Kebijakan Privasi
        </Link>
      </footer>
    </div>
  );
};
