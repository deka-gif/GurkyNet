import { memo, useEffect, useState, type ImgHTMLAttributes } from 'react';

type LazyImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Eager + high priority for LCP (e.g. first banner) */
  priority?: boolean;
};

/**
 * Consistent lazy image defaults for dashboard media.
 */
export const LazyImage = memo(function LazyImage({
  priority = false,
  className,
  alt,
  src,
  ...rest
}: LazyImageProps) {
  const [failed, setFailed] = useState(false);

  // Reset error state when src changes (avatar sync after upload)
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-[10px] font-medium text-slate-400 ${className || ''}`}
        aria-label={alt || 'Gambar'}
      >
        —
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={src}
      alt={alt || ''}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
});

export default LazyImage;
