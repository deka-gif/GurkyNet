import type { MutableRefObject } from 'react';

/**
 * SRS 14.1 — one client-generated key identifies one logical balance-changing action
 * (purchase, top up, transfer, withdraw, refund, manual adjustment). Retries of the same
 * logical action (double click, network retry, resubmitting after a wrong PIN) must reuse
 * the same key; only a brand new logical action gets a new one.
 */
export function createIdempotencyKey(_hint?: string): string {
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

/** In-memory keys for store/service logical actions (no React ref available). */
const logicalActionKeys = new Map<string, string>();

/**
 * SRS 14.1 — stable key for a logical action id (e.g. `finance-refund-approve:42`).
 * Retries of the same logicalId reuse the same UUID until cleared after success.
 */
export function getOrCreateIdempotencyKeyForLogicalAction(logicalId: string): string {
  const existing = logicalActionKeys.get(logicalId);
  if (existing) {
    return existing;
  }
  const created = createIdempotencyKey();
  logicalActionKeys.set(logicalId, created);
  return created;
}

export function clearIdempotencyKeyForLogicalAction(logicalId: string): void {
  logicalActionKeys.delete(logicalId);
}
