import { useEffect, useRef } from 'react';
import type { RealtimeEvent } from '../services/realtime/RealtimeManager';
import { RealtimeManager } from '../services/realtime/RealtimeManager';
import { RefreshPolicy } from '../lib/refreshPolicy';

/**
 * Subscribe to realtime channels via Central RealtimeManager (Sprint 8.5).
 * One shared poll loop for the whole app — no per-page setInterval.
 */
export function useRealtimeChannel(
  enabled: boolean,
  channels: string[],
  onEvent: (event: RealtimeEvent) => void,
  getToken: () => string | null,
  intervalMs = RefreshPolicy.realtimeFloor
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const channelsKey = channels.join('|');

  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    return RealtimeManager.subscribe(
      channels,
      (evt) => handlerRef.current(evt),
      {
        pollIntervalMs: Math.max(RefreshPolicy.realtimeFloor, intervalMs),
        getToken,
      }
    );
  }, [enabled, channelsKey, getToken, intervalMs]);
}
