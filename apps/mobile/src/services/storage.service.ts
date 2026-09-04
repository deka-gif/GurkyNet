import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Same key names as src/services/storage.service.ts on web, now backed by
 * expo-secure-store (iOS Keychain / Android Keystore) instead of localStorage — spec
 * section 22/25: never store the token/PIN insecurely.
 *
 * expo-secure-store is synchronous-looking in the web API shape below (async wrapper)
 * but SecureStore itself is inherently async on native — every method here returns a
 * Promise, unlike the web version. Callers (the auth store) already account for this.
 *
 * expo-secure-store has no web implementation at all (its web module is a stub that
 * throws on every call — see node_modules/expo-secure-store/build/ExpoSecureStore.web.js),
 * so every get/set silently failed on the `expo start --web` preview and every
 * authenticated request 401'd immediately after login. react-native-web is only a
 * preview target here (not a shipped platform — see apps/mobile/README.md), so
 * Keychain/Keystore-grade storage isn't a concern there; falling back to localStorage
 * keeps that preview usable without weakening anything on-device.
 */
const TOKEN_KEY = 'gurkynet_auth_token';
const USER_KEY = 'gurkynet_user_data';
const REMEMBERED_IDENTITY_KEY = 'gurkynet_remembered_identity';
const DEVICE_UUID_KEY = 'gurkynet_device_uuid';
const TRUSTED_DEVICE_IDENTITIES_KEY = 'gurkynet_trusted_device_identities';

async function safeGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Keychain/Keystore unavailable — fail silently, matching the web service's
    // try/catch-and-ignore convention rather than crashing a checkout flow.
  }
}

async function safeDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export const storageService = {
  getDeviceUuid: async (): Promise<string> => {
    const existing = await safeGet(DEVICE_UUID_KEY);
    if (existing) return existing;
    const created = Crypto.randomUUID();
    await safeSet(DEVICE_UUID_KEY, created);
    return created;
  },

  getToken: (): Promise<string | null> => safeGet(TOKEN_KEY),
  setToken: (token: string): Promise<void> => safeSet(TOKEN_KEY, token),
  removeToken: (): Promise<void> => safeDelete(TOKEN_KEY),

  getUser: async (): Promise<Record<string, unknown> | null> => {
    const raw = await safeGet(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser: (user: Record<string, unknown>): Promise<void> => safeSet(USER_KEY, JSON.stringify(user)),
  removeUser: (): Promise<void> => safeDelete(USER_KEY),

  getRememberedIdentity: (): Promise<string | null> => safeGet(REMEMBERED_IDENTITY_KEY),
  setRememberedIdentity: async (identity: string): Promise<void> => {
    if (identity) {
      await safeSet(REMEMBERED_IDENTITY_KEY, identity);
    } else {
      await safeDelete(REMEMBERED_IDENTITY_KEY);
    }
  },

  getTrustedDeviceIdentities: async (): Promise<string[]> => {
    const raw = await safeGet(TRUSTED_DEVICE_IDENTITIES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  markTrustedIdentity: async (identity: string): Promise<void> => {
    const current = new Set((await storageService.getTrustedDeviceIdentities()).map((item) => item.toLowerCase()));
    if (identity) current.add(identity.toLowerCase());
    await safeSet(TRUSTED_DEVICE_IDENTITIES_KEY, JSON.stringify([...current]));
  },
  isTrustedIdentity: async (identity: string): Promise<boolean> => {
    const list = await storageService.getTrustedDeviceIdentities();
    return list.includes(identity.toLowerCase());
  },

  clear: async (): Promise<void> => {
    await safeDelete(TOKEN_KEY);
    await safeDelete(USER_KEY);
    // Device UUID and trusted-identity list intentionally survive a forced logout —
    // mirrors web's storageService.clear() exactly (spec section 22).
  },
};
