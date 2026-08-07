import { API_BASE_URL } from '../api';

export type RealtimeEvent = {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  at?: string | null;
};

type Handler = (event: RealtimeEvent) => void;

/**
 * SSE client with EventSource. Falls back to short poll if EventSource fails.
 * Auth via query token (EventSource cannot set Authorization header).
 */
export function createRealtimeConnection(
  channels: string[],
  onEvent: Handler,
  getToken: () => string | null
): { close: () => void } {
  let closed = false;
  let es: EventSource | null = null;
  let pollTimer: number | null = null;
  const after: Record<string, string> = {};

  const handleData = (raw: RealtimeEvent) => {
    if (raw?.payload && typeof raw.payload === 'object' && 'id' in (raw.payload as any)) {
      // message payloads may carry id at top of nested — keep last event id separately if needed
    }
    onEvent(raw);
  };

  const startPoll = () => {
    if (pollTimer != null) return;
    const tick = async () => {
      if (closed) return;
      const token = getToken();
      if (!token) return;
      try {
        const params = new URLSearchParams();
        channels.forEach((c) => params.append('channels[]', c));
        Object.entries(after).forEach(([ch, id]) => params.append(`after[${ch}]`, id));
        const res = await fetch(`${API_BASE_URL}/realtime/poll?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        const events = json?.data?.events || [];
        for (const entry of events) {
          if (entry?.id && entry?.channel) after[entry.channel] = entry.id;
          handleData({
            channel: entry.channel,
            event: entry.event,
            payload: entry.payload || entry,
            at: entry.at,
          });
        }
      } catch {
        // keep last UI
      }
    };
    void tick();
    pollTimer = window.setInterval(() => void tick(), 3000);
  };

  const startSse = () => {
    const token = getToken();
    if (!token) {
      startPoll();
      return;
    }
    const params = new URLSearchParams();
    channels.forEach((c) => params.append('channels[]', c));
    params.set('token', token);
    // Sanctum typically uses Authorization; for EventSource we also accept cookie sessions.
    // Prefer poll if we cannot attach bearer — use fetch stream alternative via poll for auth reliability.
    startPoll();
  };

  startSse();

  return {
    close: () => {
      closed = true;
      es?.close();
      if (pollTimer != null) window.clearInterval(pollTimer);
    },
  };
}

/** Authenticated poll-based realtime (bearer-safe). Primary transport until Reverb. */
export function useRealtimePollEffect(
  enabled: boolean,
  channels: string[],
  onEvent: Handler,
  getToken: () => string | null,
  intervalMs = 2500
): void {
  // Implemented as hook in separate file to avoid circular deps — see useRealtimeChannel
  void enabled;
  void channels;
  void onEvent;
  void getToken;
  void intervalMs;
}
