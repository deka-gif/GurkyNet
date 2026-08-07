import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../api';
import type { RealtimeEvent } from './sse.client';

/**
 * Bearer-authenticated realtime listener (poll buffer from SseRealtimeTransport).
 * Same channel/event contract as future Reverb/Echo subscription.
 */
export function useRealtimeChannel(
  enabled: boolean,
  channels: string[],
  onEvent: (event: RealtimeEvent) => void,
  getToken: () => string | null,
  intervalMs = 2500
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const channelsKey = channels.join('|');

  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    let cancelled = false;
    const after: Record<string, string> = {};

    const tick = async () => {
      const token = getToken();
      if (!token || cancelled) return;
      try {
        const params = new URLSearchParams();
        channels.forEach((c) => params.append('channels[]', c));
        Object.entries(after).forEach(([ch, id]) => params.append(`after[${ch}]`, id));
        const res = await fetch(`${API_BASE_URL}/realtime/poll?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        for (const entry of json?.data?.events || []) {
          if (entry?.id && entry?.channel) after[entry.channel] = entry.id;
          handlerRef.current({
            channel: entry.channel,
            event: entry.event,
            payload: entry.payload || {},
            at: entry.at,
          });
        }
      } catch {
        // keep UI
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, channelsKey, getToken, intervalMs]);
}
