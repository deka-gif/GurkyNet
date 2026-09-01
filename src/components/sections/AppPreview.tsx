import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useWebsiteStore } from '../../store/website.store';
import { resolveMediaSrc } from '../../utils/mediaUrl';

export const AppPreview = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const navigate = useNavigate();
  const { settings, sections, banners } = useWebsiteStore();
  const bannerSection = sections.find((s) => s.componentType === 'banner');
  const appName = settings?.websiteName || 'GurkyNet';

  // Filter only active banners from CMS
  const activeBanners = banners.filter((b) => b.isActive);

  const fallbackPreviews = [
    { title: "Dashboard", color: "bg-primary-50" },
    { title: "Transaksi", color: "bg-primary-100/50" },
    { title: "Riwayat", color: "bg-accent-300/20" },
    { title: "Profil", color: "bg-primary-50" },
  ];

  const getImageUrl = (image: any): string => resolveMediaSrc(image);

  return (
    <section className="py-20 md:py-32 public-section-alt overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="section-badge mb-4">Pratinjau Aplikasi</div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title mb-4"
          >
            {bannerSection?.title ? (
              bannerSection.title
            ) : (
              <>Lihat Tampilan Aplikasi <span className="text-primary-600">{appName}</span></>
            )}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-subtitle"
          >
            {bannerSection?.description || 'Antarmuka yang bersih, modern, dan dirancang khusus untuk kenyamanan Anda.'}
          </motion.p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 md:gap-12 relative">
          {/* Decorative background element for the preview screens */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[60%] bg-primary-100/50 rounded-[3rem] -z-10"></div>

          {activeBanners.length > 0 ? (
            activeBanners.map((banner, index) => {
              const bgColors = ["bg-blue-50", "bg-purple-50", "bg-emerald-50", "bg-amber-50"];
              const bannerBg = bgColors[index % bgColors.length];
              const desktopImg = getImageUrl(banner.image);
              const mobileImgRaw = banner.mobileImage ? getImageUrl(banner.mobileImage) : '';
              const mobileImg = mobileImgRaw || desktopImg;

              return (
                <motion.div
                  key={banner.id || index}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  onClick={() => {
                    if (banner.redirectUrl && banner.redirectUrl !== '#') {
                      if (banner.redirectUrl.startsWith('http')) {
                        window.open(banner.redirectUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        navigate(banner.redirectUrl);
                      }
                    }
                  }}
                  className={`relative rounded-[2rem] border-[6px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19] w-[260px] md:w-[280px] flex flex-col group cursor-pointer ${
                    index % 2 !== 0 ? 'md:mt-12' : ''
                  }`}
                >
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-5 bg-gray-900 rounded-b-xl w-32 mx-auto z-20"></div>
                  
                  {/* Screen Content Container */}
                  <div className={`flex-1 ${bannerBg} flex flex-col relative z-10 transition-transform duration-500 group-hover:scale-105 origin-top`}>
                    
                    {/* Header App Bar */}
                    <div className="bg-primary-600 pt-10 pb-4 px-4 text-white shadow-sm flex items-center justify-between">
                      <div className="w-8 h-8 rounded-full bg-white/20"></div>
                      <div className="font-semibold text-sm truncate max-w-[140px]">{banner.title || appName}</div>
                      <div className="w-6 h-6 rounded bg-white/20"></div>
                    </div>
                    
                    {/* Body Elements */}
                    <div className="p-4 flex flex-col gap-4 flex-1">
                      {desktopImg ? (
                        <div className="w-full h-32 rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-white">
                          <picture className="block w-full h-full">
                            {mobileImgRaw ? (
                              <source media="(max-width:767px)" srcSet={mobileImg} />
                            ) : null}
                            <img
                              src={desktopImg}
                              alt={banner.title}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          </picture>
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col justify-between">
                          <div className="w-16 h-3 bg-gray-200 rounded"></div>
                          <div className="w-32 h-6 bg-gray-300 rounded"></div>
                        </div>
                      )}
                      
                      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <h4 className="font-bold text-xs text-gray-800 line-clamp-2">{banner.title}</h4>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100"></div>
                            <div className="w-8 h-2 bg-gray-200 rounded"></div>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 bg-white rounded-t-2xl shadow-sm border border-gray-100 p-4 mt-2">
                        <div className="w-24 h-3 bg-gray-200 rounded mb-4"></div>
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => (
                            <div key={i} className="flex gap-3 items-center">
                              <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                              <div className="flex-1 space-y-2">
                                <div className="w-full h-2 bg-gray-200 rounded"></div>
                                <div className="w-1/2 h-2 bg-gray-100 rounded"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Navigation */}
                    <div className="absolute bottom-0 w-full bg-white h-16 border-t border-gray-100 flex items-center justify-around px-2 pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                       {[...Array(4)].map((_, i) => (
                         <div key={i} className={`w-10 h-10 rounded-full flex flex-col items-center justify-center gap-1 ${i === 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                           <div className={`w-6 h-6 rounded ${i === 0 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                         </div>
                       ))}
                    </div>

                  </div>
                  
                  {/* Hover overlay indication */}
                  <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                      {banner.title || `Promo ${index + 1}`}
                    </div>
                  </div>

                </motion.div>
              );
            })
          ) : (
            fallbackPreviews.map((preview, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`relative rounded-[2rem] border-[6px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19] w-[260px] md:w-[280px] flex flex-col group ${
                  index % 2 !== 0 ? 'md:mt-12' : ''
                }`}
              >
                {/* Notch */}
                <div className="absolute top-0 inset-x-0 h-5 bg-gray-900 rounded-b-xl w-32 mx-auto z-20"></div>
                
                {/* Screen Content Container */}
                <div className={`flex-1 ${preview.color} flex flex-col relative z-10 transition-transform duration-500 group-hover:scale-105 origin-top`}>
                  
                  {/* Header App Bar */}
                  <div className="bg-primary-600 pt-10 pb-4 px-4 text-white shadow-sm flex items-center justify-between">
                    <div className="w-8 h-8 rounded-full bg-white/20"></div>
                    <div className="font-semibold text-sm">{preview.title}</div>
                    <div className="w-6 h-6 rounded bg-white/20"></div>
                  </div>
                  
                  {/* Body Elements */}
                  <div className="p-4 flex flex-col gap-4">
                    <div className="w-full h-24 bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col justify-between">
                      <div className="w-16 h-3 bg-gray-200 rounded"></div>
                      <div className="w-32 h-6 bg-gray-300 rounded"></div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100"></div>
                          <div className="w-8 h-2 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 bg-white rounded-t-2xl shadow-sm border border-gray-100 p-4 mt-2">
                      <div className="w-24 h-3 bg-gray-200 rounded mb-4"></div>
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-3 items-center">
                            <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="w-full h-2 bg-gray-200 rounded"></div>
                              <div className="w-1/2 h-2 bg-gray-100 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="absolute bottom-0 w-full bg-white h-16 border-t border-gray-100 flex items-center justify-around px-2 pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                     {[...Array(4)].map((_, i) => (
                       <div key={i} className={`w-10 h-10 rounded-full flex flex-col items-center justify-center gap-1 ${i === 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                         <div className={`w-6 h-6 rounded ${i === 0 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                       </div>
                     ))}
                  </div>

                </div>
                
                {/* Hover overlay indication */}
                <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                    Screen {index + 1}
                  </div>
                </div>

              </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
