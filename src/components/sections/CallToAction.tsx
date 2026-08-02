import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebsiteStore } from '../../store/website.store';

export const CallToAction = () => {
  const { settings } = useWebsiteStore();
  const websiteName = settings?.websiteName || 'GurkyNet';

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-primary-600 to-accent-600 rounded-[2.5rem] p-10 md:p-16 text-center text-white shadow-2xl shadow-primary-900/20 relative overflow-hidden"
        >
          {/* Background Patterns */}
          <div className="absolute inset-0 z-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-white/10 rounded-full blur-3xl rotate-45 pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
              Mulai Gunakan {websiteName} Sekarang
            </h2>
            <p className="text-lg md:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
              Nikmati pengalaman transaksi PPOB yang cepat, aman, dan modern dalam satu aplikasi.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="secondary" className="w-full sm:w-auto px-8 py-4 font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <Download className="w-6 h-6" />
                Download APK
              </Button>
            </div>
            
            <div className="mt-8 text-primary-200 text-sm font-medium">
              Gratis • Aman • Terpercaya
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
