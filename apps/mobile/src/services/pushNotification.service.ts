import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiClient } from '../api/client';
import { storageService } from './storage.service';
import { useNotificationStore } from '../store/notification.store';
import { useCheckoutStore } from '../store/checkout.store';
import { getDeviceModel, getOsVersion } from '../utils/deviceInfo';
import { appEvents, TRANSACTION_STATUS_PUSH_EVENT } from '../utils/eventEmitter';
import {
  isTransactionPushHint,
  pushHintMatchesCheckoutTransaction,
  type TransactionPushHint,
} from '../utils/transactionStatusFromPush';
import { syncCheckoutTransactionFromPushHint } from './transactionStatusFromPush.sync';
import {
  classifyTokenFetchFailure,
  isExpoPushToken,
  logPushObservability,
  resolveEasProjectId,
  resolvePushPresentation,
  sanitizePushErrorMessage,
  type PushSyncReason,
} from './pushNotification.helpers';

export {
  isExpoPushToken,
  resolveEasProjectId,
  resolvePushPresentation,
  sanitizePushErrorMessage,
  logPushObservability,
} from './pushNotification.helpers';

/**
 * Expo push infrastructure (SDK 57 / expo-notifications).
 * Mobile always registers Expo Push Tokens (ExponentPushToken[...]).
 * Inbox remains source of truth — push only delivers + deep-links.
 *
 * Android channel id MUST match app.json plugin defaultChannel: "default".
 */

/** Stable Android channel — one channel for all customer pushes (not per-transaction). */
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'default';

type PushData = {
  type?: string;
  category?: string;
  notification_id?: string;
  transaction_id?: string;
  invoice_number?: string;
  announcement_id?: string;
  campaign_id?: string;
  deep_link?: string;
};

function asPushData(raw: unknown): PushData {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const out: PushData = {};
  for (const key of [
    'type',
    'category',
    'notification_id',
    'transaction_id',
    'invoice_number',
    'announcement_id',
    'campaign_id',
    'deep_link',
  ] as const) {
    const v = obj[key];
    if (v != null && String(v) !== '') out[key] = String(v);
  }
  return out;
}

function pushHintFromData(data: PushData): TransactionPushHint {
  return {
    transactionId: data.transaction_id ?? null,
    invoiceNumber: data.invoice_number ?? null,
  };
}

/**
 * Transaction push → broadcast + GET refresh checkout (if matching).
 * Independent of Status Transaksi poll timer (Pulsa / Data / E-Wallet / …).
 */
async function propagateTransactionStatusPush(raw: unknown): Promise<TransactionPushHint | null> {
  const data = asPushData(raw);
  if (
    !isTransactionPushHint({
      category: data.category,
      type: data.type,
      transactionId: data.transaction_id,
      invoiceNumber: data.invoice_number,
    })
  ) {
    return null;
  }

  const hint = pushHintFromData(data);
  appEvents.emit(TRANSACTION_STATUS_PUSH_EVENT, hint);
  const syncResult = await syncCheckoutTransactionFromPushHint(hint);
  logPushObservability('TRANSACTION_STATUS_SYNC', {
    transaction_id: hint.transactionId ?? null,
    invoice_number: hint.invoiceNumber ?? null,
    sync_result: syncResult,
  });
  return hint;
}

/**
 * Transaction (`data.category === 'transaction'`) → show tray even in foreground.
 * Announcement/promotion → legacy suppress (no banner/list/sound).
 * // Audit: GRK-20260912-000008 — foreground suppress hid successful Expo pushes.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = asPushData(notification.request.content.data);
    const presentation = resolvePushPresentation(data);
    logPushObservability('HANDLE_NOTIFICATION', {
      appState: AppState.currentState,
      category: presentation.category,
      bannerDecision: presentation.bannerDecision,
      invoice_number: data.invoice_number ?? null,
      transaction_id: data.transaction_id ?? null,
    });
    return {
      shouldShowBanner: presentation.shouldShowBanner,
      shouldShowList: presentation.shouldShowList,
      shouldPlaySound: presentation.shouldPlaySound,
      shouldSetBadge: presentation.shouldSetBadge,
    };
  },
});

export type PushSyncResult = {
  ok: boolean;
  reason: PushSyncReason;
  permission?: Notifications.PermissionStatus;
  tokenPresent: boolean;
  provider?: 'expo';
};

/** Prevent cold-start double navigation (lastResponse + response listener). */
let lastHandledResponseKey: string | null = null;
let androidChannelReady: Promise<void> | null = null;
/** Bound concurrent sync attempts (startup + allow + auth). */
let syncInFlight: Promise<PushSyncResult> | null = null;

function platform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!androidChannelReady) {
    androidChannelReady = Notifications.setNotificationChannelAsync(
      ANDROID_NOTIFICATION_CHANNEL_ID,
      {
        name: 'GurkyNet',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F6A4D',
        sound: 'default',
      }
    ).then(() => undefined);
  }
  await androidChannelReady;
}

/**
 * Persist Expo token to backend. Never called with null to "succeed" registration.
 * user_id is bound by Sanctum on the server — never sent from the client.
 */
async function registerDeviceWithToken(pushToken: string): Promise<void> {
  if (!isExpoPushToken(pushToken)) {
    throw new Error('invalid_expo_push_token_shape');
  }
  const device_uuid = await storageService.getDeviceUuid();

  logPushObservability('REGISTER_ATTEMPT', {
    TOKEN_PRESENT: true,
    provider: 'expo',
    platform: platform(),
  });

  await apiClient.post('/devices/register', {
    device_uuid,
    platform: platform(),
    device_model: getDeviceModel(),
    os_version: getOsVersion(),
    app_version: Constants.expoConfig?.version ?? undefined,
    push_token: pushToken,
    push_provider: 'expo' as const,
  });
  await apiClient.post('/devices/push-token', {
    device_uuid,
    platform: platform(),
    push_token: pushToken,
    push_provider: 'expo',
  });

  logPushObservability('REGISTER_SUCCESS', {
    TOKEN_REGISTERED: true,
    provider: 'expo',
  });
}

async function fetchExpoPushTokenWithRetry(maxAttempts = 2): Promise<string> {
  const pid = resolveEasProjectId(Constants);
  if (!pid) {
    throw new Error('missing_eas_project_id');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureAndroidChannel();
      logPushObservability('TOKEN_FETCH_ATTEMPT', {
        attempt,
        projectId_present: true,
        platform: platform(),
      });
      const token = await Notifications.getExpoPushTokenAsync({ projectId: pid });
      const value = token.data || '';
      if (!value) {
        throw new Error('empty_expo_push_token');
      }
      if (!isExpoPushToken(value)) {
        throw new Error('invalid_expo_push_token_shape');
      }
      logPushObservability('TOKEN_FETCH_SUCCESS', {
        TOKEN_PRESENT: true,
        provider: 'expo',
      });
      return value;
    } catch (err) {
      lastError = err;
      logPushObservability('TOKEN_FETCH_FAILURE', {
        attempt,
        error: sanitizePushErrorMessage(err),
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('token_fetch_failed');
}

async function syncPushTokenWithBackendInner(opts: {
  /** When true, may show the OS permission dialog (only after soft pre-prompt consent). */
  requestPermission: boolean;
}): Promise<PushSyncResult> {
  const authToken = await storageService.getToken();
  if (!authToken) {
    logPushObservability('SYNC_SKIP', { reason: 'not_authenticated' });
    return { ok: false, reason: 'not_authenticated', tokenPresent: false };
  }

  let permission = await Notifications.getPermissionsAsync();
  logPushObservability('PERMISSION_STATUS', {
    status: permission.status,
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
  });

  if (!permission.granted) {
    if (!opts.requestPermission) {
      const reason: PushSyncReason =
        permission.status === 'undetermined'
          ? 'permission_undetermined'
          : 'permission_denied';
      logPushObservability('SYNC_SKIP', {
        reason,
        TOKEN_REGISTERED: false,
      });
      return {
        ok: false,
        reason,
        permission: permission.status,
        tokenPresent: false,
      };
    }
    if (!permission.canAskAgain) {
      logPushObservability('SYNC_SKIP', {
        reason: 'permission_denied',
        TOKEN_REGISTERED: false,
      });
      return {
        ok: false,
        reason: 'permission_denied',
        permission: permission.status,
        tokenPresent: false,
      };
    }
    permission = await Notifications.requestPermissionsAsync();
    logPushObservability('PERMISSION_REQUEST_RESULT', {
      status: permission.status,
      granted: permission.granted,
    });
    if (!permission.granted) {
      return {
        ok: false,
        reason: 'permission_denied',
        permission: permission.status,
        tokenPresent: false,
      };
    }
  }

  try {
    const token = await fetchExpoPushTokenWithRetry(2);
    await registerDeviceWithToken(token);
    return {
      ok: true,
      reason: 'registered',
      permission: permission.status,
      tokenPresent: true,
      provider: 'expo',
    };
  } catch (err) {
    const msg = sanitizePushErrorMessage(err);
    const reason = classifyTokenFetchFailure(msg);
    logPushObservability('SYNC_FAILURE', {
      reason,
      error: msg,
      TOKEN_REGISTERED: false,
    });
    return {
      ok: false,
      reason,
      permission: permission.status,
      tokenPresent: false,
    };
  }
}

export const pushNotificationService = {
  ensureAndroidChannel,

  /** OS permission status — never claim granted from soft prompt alone. */
  getPermissionStatus: async (): Promise<Notifications.PermissionStatus> => {
    const current = await Notifications.getPermissionsAsync();
    return current.status;
  },

  requestOsPermission: async (): Promise<boolean> => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  },

  getExpoPushToken: async (): Promise<string | null> => {
    try {
      return await fetchExpoPushTokenWithRetry(2);
    } catch (err) {
      logPushObservability('GET_TOKEN_NULL', {
        error: sanitizePushErrorMessage(err),
        TOKEN_PRESENT: false,
      });
      return null;
    }
  },

  /**
   * Obtain Expo token (if permitted) and bind to authenticated user via Sanctum.
   * Does NOT register a null token as success.
   */
  syncPushTokenWithBackend: async (opts?: {
    requestPermission?: boolean;
  }): Promise<boolean> => {
    const requestPermission = opts?.requestPermission === true;
    if (syncInFlight) {
      const shared = await syncInFlight;
      return shared.ok;
    }
    syncInFlight = syncPushTokenWithBackendInner({ requestPermission }).finally(() => {
      syncInFlight = null;
    });
    const result = await syncInFlight;
    return result.ok;
  },

  /** Detailed sync result for diagnostics / tests. */
  syncPushTokenWithBackendDetailed: async (opts?: {
    requestPermission?: boolean;
  }): Promise<PushSyncResult> => {
    const requestPermission = opts?.requestPermission === true;
    if (syncInFlight) return syncInFlight;
    syncInFlight = syncPushTokenWithBackendInner({ requestPermission }).finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  },

  /** Logout / switch account — clear device↔user association before dropping session. */
  disassociateDevice: async (): Promise<void> => {
    try {
      const device_uuid = await storageService.getDeviceUuid();
      await apiClient.post('/devices/disassociate', {
        device_uuid,
        platform: platform(),
      });
      logPushObservability('DISASSOCIATE_SUCCESS', { platform: platform() });
    } catch (err) {
      logPushObservability('DISASSOCIATE_FAILURE', {
        error: sanitizePushErrorMessage(err),
      });
    }
  },

  openFromPayload: async (
    raw: unknown,
    opts?: { fallbackToInbox?: boolean }
  ): Promise<boolean> => {
    const data = asPushData(raw);
    const notificationId = data.notification_id;
    if (notificationId) {
      try {
        await useNotificationStore.getState().markAsRead(String(notificationId));
      } catch {
        // ignore — may run before auth hydrate
      }
    }

    // Always refresh authoritative status from API when push is transaction-related
    // (before navigate) — works even if Status Transaksi poll already timed out.
    const hint = await propagateTransactionStatusPush(raw);

    const deepLink = data.deep_link?.trim();
    const category = (data.category || data.type || '').toLowerCase();
    const fallback = opts?.fallbackToInbox !== false;

    try {
      // If this push matches the in-flight checkout tx, keep user on Status Transaksi
      // (GET already refreshed store) instead of only jumping to Riwayat.
      if (hint) {
        const checkoutTx = useCheckoutStore.getState().transaction;
        if (pushHintMatchesCheckoutTransaction(checkoutTx, hint)) {
          router.replace('/checkout/result');
          return true;
        }
      }

      if (category === 'transaction' || data.transaction_id || data.invoice_number) {
        const id = data.transaction_id || data.invoice_number;
        if (id) {
          router.push({ pathname: '/riwayat/[id]', params: { id: String(id) } });
          return true;
        }
      }

      if (deepLink) {
        if (deepLink.startsWith('/riwayat/')) {
          const id = deepLink.replace('/riwayat/', '').split(/[/?#]/)[0];
          if (id) {
            router.push({ pathname: '/riwayat/[id]', params: { id } });
            return true;
          }
        }
        if (deepLink.startsWith('/')) {
          router.push(deepLink as never);
          return true;
        }
      }
    } catch {
      // fall through
    }

    if (fallback) {
      try {
        router.push('/(tabs)/notifikasi');
      } catch {
        // ignore
      }
    }
    return false;
  },

  handleNotificationResponse: async (
    response: Notifications.NotificationResponse,
    opts?: { fallbackToInbox?: boolean }
  ): Promise<void> => {
    const key = responseKey(response);
    if (lastHandledResponseKey === key) return;
    lastHandledResponseKey = key;
    await pushNotificationService.openFromPayload(
      response.notification.request.content.data,
      opts
    );
  },

  attachListeners: (): (() => void) => {
    void ensureAndroidChannel();

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      void useNotificationStore.getState().fetchNotifications({ force: true });
      // Foreground tray / silent receive — refresh Status Transaksi without requiring a tap.
      void propagateTransactionStatusPush(notification.request.content.data);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void pushNotificationService.handleNotificationResponse(response);
    });

    const tokenSub = Notifications.addPushTokenListener(() => {
      void (async () => {
        try {
          const authToken = await storageService.getToken();
          if (!authToken) return;
          const status = await pushNotificationService.getPermissionStatus();
          if (status !== 'granted') return;
          await pushNotificationService.syncPushTokenWithBackend({
            requestPermission: false,
          });
        } catch (err) {
          logPushObservability('TOKEN_LISTENER_FAILURE', {
            error: sanitizePushErrorMessage(err),
          });
        }
      })();
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      tokenSub.remove();
    };
  },

  handleLastResponse: async (): Promise<void> => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last) return;
      await pushNotificationService.handleNotificationResponse(last);
    } catch (err) {
      logPushObservability('LAST_RESPONSE_FAILURE', {
        error: sanitizePushErrorMessage(err),
      });
    }
  },
};
