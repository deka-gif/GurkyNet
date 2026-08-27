/**
 * Sprint 8.5 — Central refresh policy (ms).
 * No dashboard may poll faster than these floors.
 */
export const RefreshPolicy = {
  owner: 60_000,
  finance: 60_000,
  marketing: 60_000,
  operations: 30_000,
  customerSupport: 30_000,
  /** SSE fallback poll for inbox when EventSource unavailable */
  inbox: 5_000,
  workflow: 10_000,
  notification: 5_000,
  cms: 30_000,
  historyPending: 10_000,
  chat: 5_000,
  /** Sprint 11 / SRS 16.3 — wallet balance fallback ~3s when SSE unhealthy */
  walletBalance: 3_000,
  /** Absolute floor for any realtime event poll (aligned with 3–5s balance NFR) */
  realtimeFloor: 3_000,
  providerBalance: 600_000,
  settlement: 60_000,
} as const;

export type RefreshSurface = keyof typeof RefreshPolicy;

export function resolveRealtimePollMs(surfaces: number[]): number {
  if (surfaces.length === 0) return RefreshPolicy.realtimeFloor;
  return Math.max(RefreshPolicy.realtimeFloor, Math.min(...surfaces));
}
