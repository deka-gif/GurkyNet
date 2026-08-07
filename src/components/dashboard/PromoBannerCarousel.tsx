import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import type { Banner } from '../../types';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { LazyImage } from '../ui/LazyImage';

type PromoBannerCarouselProps = {
  banners: Banner[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/**
 * Full-image marketing carousel (Tokopedia / GoPay style).
 * Image-only slides — detail content lives on /dashboard/promo/:slug
 */
export const PromoBannerCarousel = memo(function PromoBannerCarousel({
  banners,
  loading,
  error,
  onRetry,
}: PromoBannerCarouselProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  // Preload LCP banner image (first slide only)
  useEffect(() => {
    const first = banners[0];
    if (!first || typeof document === 'undefined') return;
    const href = resolveMediaUrl(first.image || first.imageUrl || '');
    if (!href) return;
    const existing = document.querySelector(`link[data-gn-banner-preload="${href}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.setAttribute('data-gn-banner-preload', href);
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [banners]);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  const goTo = useCallback(
    (next: number) => {
      if (banners.length === 0) return;
      setIndex(((next % banners.length) + banners.length) % banners.length);
    },
    [banners.length]
  );

  const openPromo = (banner: Banner) => {
    if (banner.slug) {
      navigate(`/dashboard/promo/${banner.slug}`);
      return;
    }
    navigate(`/dashboard/promo/${banner.id}`);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    setPaused(false);
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goTo(index + 1);
    else goTo(index - 1);
  };

  const current = banners[index];

  return (
    <div
      className="lg:col-span-7 relative overflow-hidden rounded-2xl bg-slate-100 aspect-[16/9] min-h-[160px] md:min-h-[200px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {loading && banners.length === 0 ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100" />
      ) : error && banners.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-rose-50 px-4 text-center">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-xs font-bold text-rose-600">Gagal memuat banner promo</p>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      ) : banners.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-xs font-medium text-slate-400">
          Belum ada banner promo aktif
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {current ? (
              <motion.button
                key={current.id}
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                onClick={() => openPromo(current)}
                className="absolute inset-0 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left"
                aria-label={`Buka promo ${current.title}`}
              >
                <picture className="absolute inset-0 block h-full w-full">
                  {current.mobileImageUrl ? (
                    <source
                      media="(max-width: 767px)"
                      srcSet={resolveMediaUrl(current.mobileImageUrl)}
                    />
                  ) : null}
                  <LazyImage
                    priority={index === 0}
                    src={resolveMediaUrl(current.image || current.imageUrl || '')}
                    alt={current.title}
                    className="h-full w-full object-cover"
                  />
                </picture>
              </motion.button>
            ) : null}
          </AnimatePresence>

          {banners.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {banners.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Banner ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(idx);
                  }}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all will-change-[width] ${
                    idx === index ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
});

export default PromoBannerCarousel;
