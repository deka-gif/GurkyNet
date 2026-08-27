import { API_BASE_URL } from '../api';
import { RefreshPolicy, resolveRealtimePollMs } from '../../lib/refreshPolicy';
import { acceptRealtimeEventId, applyRealtimeAfterCursor } from './realtimeCursor';

export type RealtimeEvent = {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  at?: string | null;
};

type Handler = (event: RealtimeEvent) => void;

type Subscription = {
  id: number;
  channels: string[];
  handler: Handler;
  pollIntervalMs: number;
};

/**
 * Central Realtime Manager — SSE primary (fetch stream) + poll fallback.
 * FR-CS-01 Sprint 6: reuse /realtime/stream + /realtime/poll (no second architecture).
 */
class RealtimeManagerImpl {
  private subs = new Map<number, Subscription>();
  private nextId = 1;
  private after: Record<string, string> = {};
  private seenEventIds = new Set<string>();
  private timer: number | null = null;
  private inflight: Promise<void> | null = null;
  private getToken: (() => string | null) | null = null;
  private visibilityBound = false;
  private paused = false;
  private abort: AbortController | null = null;
  private mode: 'sse' | 'poll' = 'sse';
  private reconnectTimer: number | null = null;

  setTokenGetter(fn: () => string | null) {
    this.getToken = fn;
  }

  subscribe(
    channels: string[],
    handler: Handler,
    options?: { pollIntervalMs?: number; getToken?: () => string | null }
  ): () => void {
    const unique = [...new Set(channels.filter(Boolean))];
    if (unique.length === 0) {
      return () => undefined;
    }

    if (options?.getToken) {
      this.getToken = options.getToken;
    }

    const id = this.nextId++;
    this.subs.set(id, {
      id,
      channels: unique,
      handler,
      pollIntervalMs: options?.pollIntervalMs ?? RefreshPolicy.realtimeFloor,
    });

    this.ensureVisibilityListener();
    this.reconnectTransport();

    return () => {
      this.subs.delete(id);
      this.reconnectTransport();
    };
  }

  refreshNow(): void {
    if (document.visibilityState === 'hidden') return;
    if (this.mode === 'poll') void this.tickPoll();
  }

  private ensureVisibilityListener() {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.paused = true;
        this.teardownTransport();
      } else {
        this.paused = false;
        this.reconnectTransport();
      }
    });
  }

  private allChannels(): string[] {
    const set = new Set<string>();
    for (const s of this.subs.values()) {
      s.channels.forEach((c) => set.add(c));
    }
    return [...set];
  }

  private currentInterval(): number {
    const intervals = [...this.subs.values()].map((s) => s.pollIntervalMs);
    return resolveRealtimePollMs(intervals);
  }

  private teardownTransport() {
    this.clearTimer();
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abort) {
      try {
        this.abort.abort();
      } catch {
        // ignore
      }
      this.abort = null;
    }
  }

  private reconnectTransport() {
    this.teardownTransport();
    if (this.subs.size === 0 || this.paused) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.paused = true;
      return;
    }

    if (this.mode === 'sse') {
      void this.startSse();
    } else {
      this.startPoll();
    }
  }

  private async startSse() {
    const token = this.getToken?.() ?? null;
    const channels = this.allChannels();
    if (!token || channels.length === 0) return;

    const params = new URLSearchParams();
    channels.forEach((c) => params.append('channels[]', c));
    // FR-CS-01 — reconnect must send last cursor so stream does not replay buffer.
    applyRealtimeAfterCursor(params, this.after, channels);

    this.abort = new AbortController();
    this.mode = 'sse';

    try {
      const res = await fetch(`${API_BASE_URL}/realtime/stream?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        signal: this.abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          this.parseSseChunk(chunk);
        }
      }

      // Stream ended (server closes ~55s) — reconnect SSE if still subscribed.
      if (!this.paused && this.subs.size > 0 && this.mode === 'sse') {
        this.reconnectTimer = window.setTimeout(() => void this.startSse(), 500);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      // Fallback to poll (FR-CS-01).
      this.mode = 'poll';
      this.startPoll();
    }
  }

  private parseSseChunk(chunk: string) {
    const lines = chunk.split('\n');
    let eventName = 'message';
    let data = '';
    let id = '';
    for (const line of lines) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
      else if (line.startsWith('id:')) id = line.slice(3).trim();
    }
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      const channel = parsed.channel as string;
      const eventId = (id || parsed.id || null) as string | null;
      if (eventId && channel) this.after[channel] = eventId;
      if (!acceptRealtimeEventId(this.seenEventIds, eventId)) return;
      this.dispatch({
        channel,
        event: parsed.event || eventName,
        payload: parsed.payload || {},
        at: parsed.at,
      });
    } catch {
      // ignore
    }
  }

  private dispatch(evt: RealtimeEvent) {
    if (!evt.channel) return;
    for (const s of this.subs.values()) {
      if (s.channels.includes(evt.channel)) {
        try {
          s.handler(evt);
        } catch {
          // isolate
        }
      }
    }
  }

  private clearTimer() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startPoll() {
    this.mode = 'poll';
    this.clearTimer();
    if (this.subs.size === 0 || this.paused) return;
    const ms = this.currentInterval();
    void this.tickPoll();
    this.timer = window.setInterval(() => void this.tickPoll(), ms);
  }

  private async tickPoll(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (this.subs.size === 0) return;

    const token = this.getToken?.() ?? null;
    if (!token) return;

    const channels = this.allChannels();
    if (channels.length === 0) return;

    this.inflight = (async () => {
      try {
        const params = new URLSearchParams();
        channels.forEach((c) => params.append('channels[]', c));
        applyRealtimeAfterCursor(params, this.after, channels);

        const res = await fetch(`${API_BASE_URL}/realtime/poll?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) return;

        const json = await res.json();
        for (const entry of json?.data?.events || []) {
          if (entry?.id && entry?.channel) {
            this.after[entry.channel] = entry.id;
          }
          if (!acceptRealtimeEventId(this.seenEventIds, entry?.id)) continue;
          this.dispatch({
            channel: entry.channel,
            event: entry.event,
            payload: entry.payload || {},
            at: entry.at,
          });
        }
      } catch {
        // keep last UI
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }
}

export const RealtimeManager = new RealtimeManagerImpl();
