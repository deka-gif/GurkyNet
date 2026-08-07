import { useEffect, useRef } from 'react';

/**
 * Soft refresh while tab visible — for READ MODEL dashboards.
 * Pauses when document.hidden; one refresh on become visible.
 */
export function useSoftRefresh(
  enabled: boolean,
  intervalMs: number,
  onRefresh: () => void
): void {
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    if (!enabled || intervalMs < 5000) return;

    let timer: number | null = null;

    const clear = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      clear();
      if (document.visibilityState === 'hidden') return;
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') cb.current();
      }, intervalMs);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        cb.current();
        start();
      } else {
        clear();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, intervalMs]);
}
