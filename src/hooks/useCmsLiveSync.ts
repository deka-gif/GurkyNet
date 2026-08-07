import { useEffect, useRef } from 'react';
import { websiteService } from '../services/website.service';
import { useWebsiteStore } from '../store/website.store';
import { CMS_SYNC_CHANNEL, type CmsSyncPayload } from '../lib/cmsSync';

const POLL_MS = 30_000;

/**
 * Listens for Marketing CMS changes and force-refetches public website data
 * without a full browser refresh.
 */
export function useCmsLiveSync(enabled = true): void {
  const syncFromCms = useWebsiteStore((s) => s.syncFromCms);
  const revisionRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const apply = async (payload?: CmsSyncPayload) => {
      if (syncingRef.current) return;
      const next = payload?.revision;
      if (typeof next === 'number' && revisionRef.current !== null && next <= revisionRef.current) {
        return;
      }
      syncingRef.current = true;
      try {
        if (typeof next === 'number') {
          revisionRef.current = next;
        }
        await syncFromCms(payload?.scopes);
      } finally {
        syncingRef.current = false;
      }
    };

    const poll = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await websiteService.getCmsSyncStatus();
        const data = (res as any)?.data ?? res;
        const revision = Number(data?.revision ?? 0);
        if (revisionRef.current === null) {
          revisionRef.current = revision;
          return;
        }
        if (revision > revisionRef.current) {
          await apply({
            revision,
            scopes: data?.scopes || [],
            updatedAt: data?.updatedAt,
            reason: data?.reason,
            source: 'poll',
          });
        }
      } catch {
        // Keep last known good UI — never crash on sync failure
      }
    };

    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent<CmsSyncPayload>).detail;
      void apply(detail);
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CMS_SYNC_CHANNEL);
      bc.onmessage = (event) => {
        void apply({ ...(event.data || {}), source: 'broadcast' });
      };
    } catch {
      bc = null;
    }

    window.addEventListener(CMS_SYNC_CHANNEL, onLocal as EventListener);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CMS_SYNC_CHANNEL, onLocal as EventListener);
      document.removeEventListener('visibilitychange', onVisible);
      bc?.close();
    };
  }, [enabled, syncFromCms]);
}
