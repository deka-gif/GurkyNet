import { RealtimeManager, type RealtimeEvent } from './RealtimeManager';

export type { RealtimeEvent };

/**
 * @deprecated Prefer RealtimeManager.subscribe / useRealtimeChannel.
 * Kept for compatibility — delegates to central manager.
 */
export function createRealtimeConnection(
  channels: string[],
  onEvent: (event: RealtimeEvent) => void,
  getToken: () => string | null
): { close: () => void } {
  RealtimeManager.setTokenGetter(getToken);
  const unsub = RealtimeManager.subscribe(channels, onEvent, { getToken });
  return { close: unsub };
}

export function useRealtimePollEffect(
  _enabled: boolean,
  _channels: string[],
  _onEvent: (event: RealtimeEvent) => void,
  _getToken: () => string | null,
  _intervalMs = 5000
): void {
  // Use useRealtimeChannel instead
}
