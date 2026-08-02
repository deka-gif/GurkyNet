import { motion } from 'motion/react';
import { Button } from '../ui/Button';
import { Download, ArrowRight } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';

export const Hero = () => {
  const { settings, sections } = useWebsiteStore();
  const heroSection = sections.find((s) => s.componentType === 'hero');

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-gray-50 min-h-screen flex items-center">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-block bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
            >
              {heroSection?.description || 'Beta Version 1.0 Tersedia'}
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              {heroSection?.title ? (
                heroSection.title
              ) : (
                <>Semua Kebutuhan <span className="text-primary-600">{settings?.websiteName || 'GurkyNet'}</span> Dalam Satu Aplikasi Modern.</>
              )}
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {settings?.tagline || 'Top up saldo, beli pulsa, paket data, token PLN, voucher digital, hingga pembayaran tagihan dengan cepat, aman, dan nyaman.'}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Button variant="primary" className="w-full sm:w-auto">
                <Download className="w-5 h-5" />
                Download Aplikasi
              </Button>
              <Button variant="secondary" className="w-full sm:w-auto">
                Pelajari Lebih Lanjut
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mt-10 flex items-center justify-center lg:justify-start gap-6 text-gray-500 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Transaksi Cepat
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                Keamanan Terjamin
              </div>
            </div>
          </motion.div>

          {/* Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative mx-auto lg:ml-auto w-full max-w-sm lg:max-w-md"
            style={{ perspective: "1000px" }}
          >
            {/* Phone Frame Placeholder */}
            <div 
              className="relative rounded-[2.5rem] border-[8px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19] flex flex-col transition-transform duration-700"
              style={{ transform: "rotateY(-10deg) rotateX(5deg)" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "rotateY(0deg) rotateX(0deg)" }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "rotateY(-10deg) rotateX(5deg)" }}
            >
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-xl w-40 mx-auto z-20"></div>
              
              {/* Screen Content Placeholder */}
              <div className="flex-1 bg-gray-50 flex flex-col relative z-10">
                <div className="bg-primary-600 pt-12 pb-6 px-6 text-white rounded-b-3xl shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-white/20"></div>
                    <div className="w-8 h-8 rounded-full bg-white/20"></div>
                  </div>
                  <div className="h-4 w-24 bg-white/30 rounded mb-2"></div>
                  <div className="h-8 w-40 bg-white/40 rounded"></div>
                </div>
                
                <div className="px-6 py-8 flex-1 flex flex-col gap-6">
                  {/* Grid Features */}
                  <div className="grid grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100"></div>
                        <div className="w-10 h-2 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Banner */}
                  <div className="w-full h-24 bg-gradient-to-r from-primary-400 to-accent-500 rounded-2xl shadow-sm mt-4"></div>
                  
                  {/* List */}
                  <div className="mt-4 flex flex-col gap-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-full h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center px-4 gap-4">
                         <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                         <div className="flex-1 flex flex-col gap-2">
                           <div className="h-3 w-24 bg-gray-200 rounded"></div>
                           <div className="h-2 w-16 bg-gray-100 rounded"></div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Elements for 3D effect */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -right-8 top-1/4 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 items-center gap-4 hidden md:flex z-20"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl font-bold">✓</div>
              <div>
                <div className="text-sm font-bold text-gray-900">Top Up Berhasil</div>
                <div className="text-xs text-gray-500">Rp 500.000</div>
              </div>
            </motion.div>
            
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 1 }}
              className="absolute -left-12 bottom-1/4 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 items-center gap-4 hidden md:flex z-20"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">⚡</div>
              <div>
                <div className="text-sm font-bold text-gray-900">Token PLN Aktif</div>
                <div className="text-xs text-gray-500">20 Menit lalu</div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
