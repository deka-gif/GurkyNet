import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useWebsiteStore } from '../../store/website.store';
import { resolveMediaSrc } from '../../utils/mediaUrl';

/**
 * App preview phones on landing.
 * When Marketing banners exist: show the banner image full-bleed inside the phone chrome
 * (object-contain) — no empty placeholder "logo tiles".
 * When no banners: hide the decorative empty-tile mock (was confusing as "missing logos").
 */
export const AppPreview = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const navigate = useNavigate();
  const { settings, sections, banners } = useWebsiteStore();
  const bannerSection = sections.find((s) => s.componentType === 'banner');
  const appName = settings?.websiteName || 'GurkyNet';
  const activeBanners = banners.filter((b) => b.isActive);
  const getImageUrl = (image: unknown): string => resolveMediaSrc(image);

  // No CMS banners → don't show empty fake UI boxes to the public.
  if (activeBanners.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-32 public-section-alt overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-8 md:mb-16">
          <div className="section-badge mb-3 md:mb-4">Pratinjau Aplikasi</div>
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

        <div className="flex flex-wrap justify-center gap-4 md:gap-12 relative px-2 md:px-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[60%] bg-primary-100/50 rounded-[2rem] md:rounded-[3rem] -z-10" />

          {activeBanners.map((banner, index) => {
            const desktopImg = getImageUrl(banner.image);
            const mobileImgRaw = banner.mobileImage ? getImageUrl(banner.mobileImage) : '';
            const mobileImg = mobileImgRaw || desktopImg;
            if (!desktopImg && !mobileImg) return null;

            return (
              <motion.div
                key={banner.id || index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
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
                className={`relative rounded-[1.25rem] md:rounded-[2rem] border-[4px] md:border-[6px] border-gray-900 bg-gray-900 shadow-xl md:shadow-2xl overflow-hidden aspect-[9/19] w-[148px] sm:w-[180px] md:w-[280px] flex flex-col group cursor-pointer ${
                  index % 2 !== 0 ? 'md:mt-12' : ''
                }`}
              >
                <div className="absolute top-0 inset-x-0 h-5 bg-gray-900 rounded-b-xl w-32 mx-auto z-20" />

                <div className="flex-1 bg-black flex items-center justify-center relative z-10 overflow-hidden">
                  <picture className="absolute inset-0">
                    {mobileImgRaw ? (
                      <source media="(max-width:767px)" srcSet={mobileImg} />
                    ) : null}
                    <img
                      src={desktopImg || mobileImg}
                      alt={banner.title || appName}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain bg-gray-950"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </picture>
                </div>

                {(banner.title || banner.redirectUrl) && (
                  <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg max-w-[90%] truncate">
                      {banner.title || `Promo ${index + 1}`}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
