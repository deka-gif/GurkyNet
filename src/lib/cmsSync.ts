/** CMS live-sync constants shared by Marketing save + public listeners. */
export const CMS_SYNC_CHANNEL = 'gurkynet:cms-sync';

export type CmsSyncPayload = {
  revision: number;
  scopes: string[];
  updatedAt?: string | null;
  reason?: string | null;
  source?: 'poll' | 'local' | 'broadcast';
};

/** Notify other same-origin tabs/windows that Marketing just saved. */
export function notifyCmsLocalSync(payload: Partial<CmsSyncPayload> = {}): void {
  const message: CmsSyncPayload = {
    revision: payload.revision ?? Date.now(),
    scopes: payload.scopes ?? ['WebsiteSettingUpdated'],
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    reason: payload.reason ?? 'marketing_save',
    source: 'local',
  };

  try {
    window.dispatchEvent(new CustomEvent(CMS_SYNC_CHANNEL, { detail: message }));
  } catch {
    // ignore
  }

  try {
    const bc = new BroadcastChannel(CMS_SYNC_CHANNEL);
    bc.postMessage(message);
    bc.close();
  } catch {
    // BroadcastChannel unsupported — poll still works
  }
}
