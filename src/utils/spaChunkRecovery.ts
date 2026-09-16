/**
 * Recover from stale SPA shells after deploy: old index.html / parent chunk
 * still points at hashed assets that no longer exist (404).
 */

const RELOAD_FLAG = 'gn:spa-chunk-reload';

export function isChunkLoadError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  const name = String(err?.name || '');
  const message = String(err?.message || error || '');
  return (
    name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message)
  );
}

/** Full page reload at most once per tab session. Returns true if reload was triggered. */
export function reloadOnceForStaleChunk(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // sessionStorage blocked — still attempt a single reload best-effort
  }
  window.location.reload();
  return true;
}

/**
 * Clear the one-shot flag after the app has been healthy for a short window.
 * Do not clear immediately on boot — otherwise a still-stale shell can loop forever.
 */
export function scheduleClearChunkReloadFlag(delayMs = 2500): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // ignore
    }
  }, delayMs);
}
