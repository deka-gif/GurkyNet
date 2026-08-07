export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped as T & { cancel: () => void };
}

export function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let last = 0;
  let trailing: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    if (remaining <= 0) {
      if (trailing) {
        clearTimeout(trailing);
        trailing = null;
      }
      last = now;
      fn(...args);
      return;
    }
    if (!trailing) {
      trailing = setTimeout(() => {
        last = Date.now();
        trailing = null;
        fn(...args);
      }, remaining);
    }
  };
}

export function runWhenIdle(cb: () => void, timeout = 2000): () => void {
  if (typeof window === 'undefined') {
    cb();
    return () => undefined;
  }
  const ric = (window as any).requestIdleCallback as
    | ((fn: () => void, opts?: { timeout: number }) => number)
    | undefined;
  const cic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

  if (typeof ric === 'function') {
    const id = ric(() => cb(), { timeout });
    return () => {
      if (typeof cic === 'function') cic(id);
    };
  }

  const id = window.setTimeout(cb, Math.min(timeout, 500));
  return () => window.clearTimeout(id);
}
