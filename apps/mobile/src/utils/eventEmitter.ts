/**
 * React Native has no `window` — this is the mobile equivalent of the web app's
 * `window.dispatchEvent(new Event('auth-unauthorized'))` / `window.addEventListener(...)`
 * pattern in src/services/api.ts and src/App.tsx, scoped to just the one event the app
 * actually needs to broadcast app-wide (a 401 anywhere means "session expired, log out").
 */
type Listener = () => void;

class AppEventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((listener) => listener());
  }
}

export const appEvents = new AppEventEmitter();
export const AUTH_UNAUTHORIZED_EVENT = 'auth-unauthorized';
