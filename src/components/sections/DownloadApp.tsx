import { motion } from 'motion/react';
import { DownloadCloud, Smartphone, HardDrive, Calendar, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebsiteStore } from '../../store/website.store';

// App metadata default structure
const appInfo = {
  version: '1.0.0-beta',
  size: '24.5 MB',
  minAndroid: 'Android 8.0 (Oreo)',
  lastUpdate: 'Februari 2026',
  isAvailable: false,
  downloadUrl: '#'
};

export const DownloadApp = () => {
  const { settings, sections } = useWebsiteStore();
  const bannerSection = sections.find((s) => s.componentType === 'banner');
  const appName = settings?.websiteName || 'GurkyNet';

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Content Area */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              Belum tersedia di Google Play Store
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              {bannerSection?.title ? (
                bannerSection.title
              ) : (
                <>Download Aplikasi <span className="text-primary-600">{appName}</span></>
              )}
            </h2>
            <p className="text-lg text-gray-600 mb-10 leading-relaxed">
              {bannerSection?.description || (
                `Dapatkan pengalaman bertransaksi yang lebih cepat dan lancar dengan menginstal aplikasi resmi ${appName}. Silakan unduh APK resmi secara aman melalui website ini.`
              )}
            </p>
            
            <div className="grid grid-cols-2 gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium">Versi Aplikasi</div>
                  <div className="font-bold text-gray-900">{appInfo.version}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium">Ukuran</div>
                  <div className="font-bold text-gray-900">{appInfo.size}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium">Min. OS</div>
                  <div className="font-bold text-gray-900">{appInfo.minAndroid}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium">Update Terakhir</div>
                  <div className="font-bold text-gray-900">{appInfo.lastUpdate}</div>
                </div>
              </div>
            </div>

            <Button 
              variant="primary" 
              className={`w-full sm:w-auto px-8 py-4 ${!appInfo.isAvailable ? 'opacity-80 cursor-not-allowed hover:scale-100 hover:bg-primary-600' : ''}`}
              disabled={!appInfo.isAvailable}
            >
              <DownloadCloud className="w-6 h-6" />
              {appInfo.isAvailable ? 'Download APK Sekarang' : 'Segera Hadir'}
            </Button>
            {!appInfo.isAvailable && (
              <p className="text-sm text-gray-500 mt-3 font-medium">
                *Aplikasi sedang dalam tahap peninjauan akhir.
              </p>
            )}
          </motion.div>

          {/* Download Visual / Decoration */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="relative w-full aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-primary-100 rounded-full animate-pulse blur-3xl opacity-50"></div>
              <div className="relative z-10 w-full h-full bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                  <DownloadCloud className="w-12 h-12" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{appName}.apk</h3>
                  <p className="text-gray-500">Official Android Application</p>
                </div>
                
                {/* Progress bar simulation */}
                <div className="w-full space-y-2 mt-4">
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>Downloading...</span>
                    <span>0%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-200 rounded-full w-0"></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
