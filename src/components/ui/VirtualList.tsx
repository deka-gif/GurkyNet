import { useMemo, useRef, useState, useEffect, type ReactNode, type UIEvent } from 'react';
import { throttle } from '../../utils/perf';

type VirtualListProps<T> = {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  height?: number | string;
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
};

/**
 * Lightweight windowing — keeps 5000+ SKUs scrollable without mounting all rows.
 */
export function VirtualList<T>({
  items,
  estimateSize = 76,
  overscan = 6,
  className,
  height = '100%',
  getKey,
  renderItem,
}: VirtualListProps<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight || 480);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const onScroll = useMemo(
    () =>
      throttle((e: UIEvent<HTMLDivElement>) => {
        setScrollTop((e.target as HTMLDivElement).scrollTop);
      }, 32),
    []
  );

  const total = items.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
  const visibleCount = Math.ceil(viewport / estimateSize) + overscan * 2;
  const endIndex = Math.min(total, startIndex + visibleCount);
  const offsetY = startIndex * estimateSize;
  const slice = items.slice(startIndex, endIndex);

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={className}
      style={{ height, overflowY: 'auto', position: 'relative', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ height: total * estimateSize, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, i) => {
            const index = startIndex + i;
            return (
              <div key={getKey(item, index)} style={{ minHeight: estimateSize }}>
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;
