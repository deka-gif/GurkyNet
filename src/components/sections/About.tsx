import { motion } from 'motion/react';
import { Shield, Smartphone, Activity } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';

export const About = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const { settings, sections } = useWebsiteStore();
  const aboutSection = _props.section || sections.find((s) => s.componentType === 'news');

  return (
    <section id="about" className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="brand-glow-accent top-0 right-0 w-72 h-72 opacity-20 pointer-events-none absolute" />
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Content */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-badge mb-4">Tentang Kami</div>
            <h2 className="section-title mb-6">
              {aboutSection?.title ? (
                aboutSection.title
              ) : (
                <>Tentang <span className="text-primary-600">{settings?.websiteName || 'GurkyNet'}</span></>
              )}
            </h2>
            <p className="section-subtitle mb-8">
              {aboutSection?.description || (
                `${settings?.websiteName || 'GurkyNet'} adalah platform PPOB modern yang dirancang untuk memberikan pengalaman transaksi digital yang cepat, aman, dan mudah. Melalui satu akun, pengguna dapat mengakses berbagai layanan pembayaran dan pembelian digital dengan antarmuka yang sederhana namun profesional.`
              )}
            </p>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center text-primary-700 shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Keamanan Prioritas Utama</h4>
                  <p className="text-gray-600">Sistem yang dirancang dengan standar keamanan tinggi untuk melindungi data Anda.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center text-primary-700 shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Ekosistem Terintegrasi</h4>
                  <p className="text-gray-600">Sinkronisasi sempurna antara aplikasi Android dan sistem backend kami.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Illustration/Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-square max-w-md mx-auto relative z-10 bg-gradient-to-br from-primary-100 to-white rounded-3xl p-8 border border-gray-100 shadow-2xl flex items-center justify-center">
              <div className="relative w-full h-full rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2 bg-gray-50/50">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
                  <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center text-primary-600">
                     <Activity className="w-10 h-10" />
                  </div>
                  <div className="w-32 h-4 bg-gray-200 rounded-full"></div>
                  <div className="w-24 h-3 bg-gray-100 rounded-full"></div>
                  <div className="grid grid-cols-2 gap-4 w-full mt-4">
                    <div className="h-20 bg-gray-50 rounded-xl border border-gray-100"></div>
                    <div className="h-20 bg-gray-50 rounded-xl border border-gray-100"></div>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorations */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary-200/20 rounded-full blur-3xl -z-10"></div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
};
