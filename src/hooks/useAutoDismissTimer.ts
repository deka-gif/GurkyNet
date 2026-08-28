import { useEffect, useRef, useState } from 'react';

export const AUTO_DISMISS_TICK_MS = 50;

/**
 * Countdown timer with pause-on-hover — shared by global toast and inline alert banners.
 * Port of SingleToast logic (NotificationToast.tsx).
 */
export function useAutoDismissTimer(
  activeKey: string | null | undefined,
  durationMs: number,
  onExpire: () => void,
) {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const pausedRef = useRef(false);
  const remainingRef = useRef(durationMs);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    remainingRef.current = durationMs;
    setRemainingMs(durationMs);
  }, [activeKey, durationMs]);

  useEffect(() => {
    if (!activeKey) return;

    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      const next = Math.max(0, remainingRef.current - AUTO_DISMISS_TICK_MS);
      remainingRef.current = next;
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(timer);
        onExpireRef.current();
      }
    }, AUTO_DISMISS_TICK_MS);

    return () => window.clearInterval(timer);
  }, [activeKey, durationMs]);

  const pauseHandlers = {
    onMouseEnter: () => {
      pausedRef.current = true;
    },
    onMouseLeave: () => {
      pausedRef.current = false;
    },
  };

  const progress = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));

  return { remainingMs, progress, pauseHandlers };
}
