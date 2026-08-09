import type { MutableRefObject } from 'react';

/**
 * SRS 14.1 — one client-generated key identifies one logical balance-changing action
 * (purchase, top up, transfer, withdraw). Retries of the same logical action (double
 * click, network retry, resubmitting after a wrong PIN) must reuse the same key; only a
 * brand new logical action (a fresh form submission after success, or a freshly opened
 * checkout) gets a new one.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Extremely old browser fallback only — not expected to be hit in supported targets.
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Lazily creates (once) and returns the idempotency key held in `ref`, so repeated calls
 * across retries of the same logical action keep returning the identical value.
 */
export function getOrCreateIdempotencyKey(ref: MutableRefObject<string | null>): string {
  if (!ref.current) {
    ref.current = createIdempotencyKey();
  }
  return ref.current;
}
