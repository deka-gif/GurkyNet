/**
 * Sprint 11 / SRS 16.3 — load Midtrans Snap.js with client key from backend.
 * Never embeds server_key. Replaces hardcoded sandbox script in index.html.
 */
export type MidtransPublicConfig = {
  client_key: string;
  is_production: boolean;
  snap_js_url: string;
  configured: boolean;
};

let loadPromise: Promise<boolean> | null = null;

export async function ensureMidtransSnap(config: MidtransPublicConfig): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof (window as any).snap?.pay === 'function') {
    return true;
  }
  if (!config?.configured || !config.client_key || !config.snap_js_url) {
    return false;
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector('script[data-gurkynet-midtrans-snap]');
    if (existing) {
      existing.addEventListener('load', () => resolve(typeof (window as any).snap?.pay === 'function'));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = config.snap_js_url;
    script.async = true;
    script.setAttribute('data-client-key', config.client_key);
    script.setAttribute('data-gurkynet-midtrans-snap', '1');
    script.onload = () => resolve(typeof (window as any).snap?.pay === 'function');
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}
