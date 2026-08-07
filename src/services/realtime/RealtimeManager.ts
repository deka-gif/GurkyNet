import { API_BASE_URL } from '../../api';
import { RefreshPolicy, resolveRealtimePollMs } from '../../lib/refreshPolicy';

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
  /** Hint for poll cadence (fallback when SSE unavailable) */
  pollIntervalMs: number;
};

/**
 * Central Realtime Manager — single poll/SSE loop for the whole app.
 * Sprint 8.5: no per-page setInterval for /realtime/poll.
 * Ready for Reverb migration without changing business subscribers.
 */
class RealtimeManagerImpl {
  private subs = new Map<number, Subscription>();
  private nextId = 1;
  private after: Record<string, string> = {};
  private timer: number | null = null;
  private inflight: Promise<void> | null = null;
  private getToken: (() => string | null) | null = null;
  private visibilityBound = false;
  private paused = false;

  setTokenGetter(fn: () => string | null) {
    this.getToken = fn;
  }

  /**
   * Subscribe to channels. Returns unsubscribe.
   */
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
    this.restartTimer();
    if (!this.paused && document.visibilityState === 'visible') {
      void this.tick();
    }

    return () => {
      this.subs.delete(id);
      this.restartTimer();
    };
  }

  /** Force one poll (e.g. tab visible again). Deduped if already in flight. */
  refreshNow(): void {
    if (document.visibilityState === 'hidden') return;
    void this.tick();
  }

  private ensureVisibilityListener() {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.paused = true;
        this.clearTimer();
      } else {
        this.paused = false;
        void this.tick();
        this.restartTimer();
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

  private clearTimer() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restartTimer() {
    this.clearTimer();
    if (this.subs.size === 0 || this.paused) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.paused = true;
      return;
    }
    const ms = this.currentInterval();
    this.timer = window.setInterval(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
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
        Object.entries(this.after).forEach(([ch, id]) => {
          if (channels.includes(ch)) params.append(`after[${ch}]`, id);
        });

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
          const evt: RealtimeEvent = {
            channel: entry.channel,
            event: entry.event,
            payload: entry.payload || {},
            at: entry.at,
          };
          for (const s of this.subs.values()) {
            if (s.channels.includes(evt.channel)) {
              try {
                s.handler(evt);
              } catch {
                // isolate subscriber errors
              }
            }
          }
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
