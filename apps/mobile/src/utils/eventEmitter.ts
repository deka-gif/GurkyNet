/**
 * React Native has no `window` — this is the mobile equivalent of the web app's
 * `window.dispatchEvent(new Event('auth-unauthorized'))` / `window.addEventListener(...)`
 * pattern in src/services/api.ts and src/App.tsx.
 *
 * Events:
 * - auth-unauthorized — 401 anywhere means session expired
 * - transaction-status-push — Expo transaction push arrived; screens GET fresh status
 *   (independent of checkout result poll timer)
 */
type Listener = (payload?: unknown) => void;

class AppEventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

export const appEvents = new AppEventEmitter();
export const AUTH_UNAUTHORIZED_EVENT = 'auth-unauthorized';
/** Payload: TransactionPushHint — result screen refreshes via GET, not push body. */
export const TRANSACTION_STATUS_PUSH_EVENT = 'transaction-status-push';
