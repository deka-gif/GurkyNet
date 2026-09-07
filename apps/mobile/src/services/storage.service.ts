import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Session/device keys via expo-secure-store (Keychain/Keystore).
 * Never store password or PIN here.
 */
const TOKEN_KEY = 'gurkynet_auth_token';
const USER_KEY = 'gurkynet_user_data';
const REMEMBERED_IDENTITY_KEY = 'gurkynet_remembered_identity';
const DEVICE_UUID_KEY = 'gurkynet_device_uuid';
const TRUSTED_DEVICE_IDENTITIES_KEY = 'gurkynet_trusted_device_identities';
const BIOMETRIC_ENABLED_KEY = 'gurkynet_biometric_enabled';
const RETURNING_USER_KEY = 'gurkynet_returning_user';

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
    // ignore
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
  setUser: (user: Record<string, unknown>): Promise<void> =>
    safeSet(USER_KEY, JSON.stringify(user)),
  removeUser: (): Promise<void> => safeDelete(USER_KEY),

  getRememberedIdentity: (): Promise<string | null> => safeGet(REMEMBERED_IDENTITY_KEY),
  setRememberedIdentity: async (identity: string): Promise<void> => {
    if (identity) {
      await safeSet(REMEMBERED_IDENTITY_KEY, identity);
      await safeSet(RETURNING_USER_KEY, '1');
    } else {
      await safeDelete(REMEMBERED_IDENTITY_KEY);
    }
  },

  /** Device previously completed a successful auth — show PIN unlock, not password form. */
  isReturningUser: async (): Promise<boolean> => {
    const flag = await safeGet(RETURNING_USER_KEY);
    if (flag === '1') return true;
    const identity = await safeGet(REMEMBERED_IDENTITY_KEY);
    return !!identity;
  },
  clearReturningUser: async (): Promise<void> => {
    await safeDelete(RETURNING_USER_KEY);
    await safeDelete(REMEMBERED_IDENTITY_KEY);
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
    const current = new Set(
      (await storageService.getTrustedDeviceIdentities()).map((item) => item.toLowerCase())
    );
    if (identity) current.add(identity.toLowerCase());
    await safeSet(TRUSTED_DEVICE_IDENTITIES_KEY, JSON.stringify([...current]));
  },
  isTrustedIdentity: async (identity: string): Promise<boolean> => {
    const list = await storageService.getTrustedDeviceIdentities();
    return list.includes(identity.toLowerCase());
  },

  getBiometricEnabled: async (): Promise<boolean> => {
    return (await safeGet(BIOMETRIC_ENABLED_KEY)) === '1';
  },
  setBiometricEnabled: async (enabled: boolean): Promise<void> => {
    if (enabled) await safeSet(BIOMETRIC_ENABLED_KEY, '1');
    else await safeDelete(BIOMETRIC_ENABLED_KEY);
  },

  /** Clears session token/user. Keeps device UUID, returning identity, biometric pref. */
  clear: async (): Promise<void> => {
    await safeDelete(TOKEN_KEY);
    await safeDelete(USER_KEY);
  },

  /** Full sign-out of returning-user state (e.g. "Gunakan akun lain"). */
  clearAuthIdentity: async (): Promise<void> => {
    await safeDelete(TOKEN_KEY);
    await safeDelete(USER_KEY);
    await safeDelete(REMEMBERED_IDENTITY_KEY);
    await safeDelete(RETURNING_USER_KEY);
    await safeDelete(BIOMETRIC_ENABLED_KEY);
  },
};
