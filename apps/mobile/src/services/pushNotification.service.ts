import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiClient } from '../api/client';
import { storageService } from './storage.service';
import { useNotificationStore } from '../store/notification.store';
import { getDeviceModel, getOsVersion } from '../utils/deviceInfo';

/**
 * Expo push infrastructure (SDK 57 / expo-notifications).
 * Mobile always registers Expo Push Tokens (ExponentPushToken[...]).
 * Inbox remains source of truth — push only delivers + deep-links.
 *
 * Android channel id MUST match app.json plugin defaultChannel: "default".
 */

/** Stable Android channel — one channel for all customer pushes (not per-transaction). */
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Foreground: refresh inbox; avoid OS banner that duplicates in-app state.
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

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

/** Prevent cold-start double navigation (lastResponse + response listener). */
let lastHandledResponseKey: string | null = null;
let androidChannelReady: Promise<void> | null = null;

function projectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId
  );
}

function platform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken') ||
    token.startsWith('ExpoPushToken')
  );
}

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

function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

/**
 * Ensure Android channel exists once. Channel id is stable ("default").
 * Required for reliable tray display on Android 8+.
 */
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

async function registerDeviceWithToken(pushToken: string | null): Promise<void> {
  const device_uuid = await storageService.getDeviceUuid();
  const token =
    pushToken && isExpoPushToken(pushToken) ? pushToken : null;

  // Observability only — never log the token value.
  console.info('[push] TOKEN_REGISTERED=' + (token ? 'true' : 'false'));

  await apiClient.post('/devices/register', {
    device_uuid,
    platform: platform(),
    device_model: getDeviceModel(),
    os_version: getOsVersion(),
    app_version: Constants.expoConfig?.version ?? undefined,
    ...(token ? { push_token: token, push_provider: 'expo' as const } : {}),
  });
  if (token) {
    await apiClient.post('/devices/push-token', {
      device_uuid,
      platform: platform(),
      push_token: token,
      push_provider: 'expo',
    });
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
      await ensureAndroidChannel();
      const pid = projectId();
      const token = await Notifications.getExpoPushTokenAsync(
        pid ? { projectId: pid } : undefined
      );
      const value = token.data || null;
      if (value && !isExpoPushToken(value)) {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  },

  /**
   * After OS permission granted: obtain Expo token and bind to authenticated user.
   */
  syncPushTokenWithBackend: async (): Promise<boolean> => {
    try {
      const granted = await pushNotificationService.requestOsPermission();
      if (!granted) {
        await registerDeviceWithToken(null);
        return false;
      }
      const token = await pushNotificationService.getExpoPushToken();
      if (!token) {
        await registerDeviceWithToken(null);
        return false;
      }
      await registerDeviceWithToken(token);
      return true;
    } catch {
      return false;
    }
  },

  /** Logout / switch account — clear device↔user association before dropping session. */
  disassociateDevice: async (): Promise<void> => {
    try {
      const device_uuid = await storageService.getDeviceUuid();
      await apiClient.post('/devices/disassociate', {
        device_uuid,
        platform: platform(),
      });
    } catch {
      // ignore — logout must continue
    }
  },

  /**
   * Navigate from structured push / inbox payload. Never crash on bad deep links.
   */
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
        // ignore — may run before auth hydrate; inbox mark is best-effort
      }
    }

    const deepLink = data.deep_link?.trim();
    const category = (data.category || data.type || '').toLowerCase();
    const fallback = opts?.fallbackToInbox !== false;

    try {
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
      // fall through — never crash closed-app launch
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

  /**
   * Wire listeners once per authenticated session.
   * Foreground receive → inbox refresh only (handler suppresses OS banner).
   * Token listener → re-fetch Expo push token (never upload native FCM token as Expo).
   */
  attachListeners: (): (() => void) => {
    void ensureAndroidChannel();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void useNotificationStore.getState().fetchNotifications({ force: true });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void pushNotificationService.handleNotificationResponse(response);
    });

    const tokenSub = Notifications.addPushTokenListener(() => {
      // Native device token changed — refresh Expo Push Token and upsert backend.
      void (async () => {
        try {
          const authToken = await storageService.getToken();
          if (!authToken) return;
          const status = await pushNotificationService.getPermissionStatus();
          if (status !== 'granted') return;
          const expoToken = await pushNotificationService.getExpoPushToken();
          if (!expoToken) return;
          await registerDeviceWithToken(expoToken);
        } catch {
          // ignore
        }
      })();
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      tokenSub.remove();
    };
  },

  /**
   * Cold start: open app from notification tap (after auth gate is ready).
   */
  handleLastResponse: async (): Promise<void> => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last) return;
      await pushNotificationService.handleNotificationResponse(last);
    } catch {
      // ignore — do not crash if app state not fully hydrated
    }
  },
};
