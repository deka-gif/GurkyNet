const TOKEN_KEY = 'gurkynet_auth_token';
const USER_KEY = 'gurkynet_user_data';
const REMEMBERED_IDENTITY_KEY = 'gurkynet_remembered_identity';
const DEVICE_UUID_KEY = 'gurkynet_device_uuid';
const TRUSTED_DEVICE_IDENTITIES_KEY = 'gurkynet_trusted_device_identities';

export const storageService = {
  getDeviceUuid: (): string => {
    try {
      const existing = localStorage.getItem(DEVICE_UUID_KEY);
      if (existing) return existing;
      const created = crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_UUID_KEY, created);
      return created;
    } catch {
      return `web-${Date.now()}`;
    }
  },
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string, remember: boolean = true): void => {
    try {
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(TOKEN_KEY);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  },
  removeToken: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
  getUser: (): Record<string, unknown> | null => {
    try {
      const user = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: Record<string, unknown>, remember: boolean = true): void => {
    try {
      const serialized = JSON.stringify(user);
      if (remember) {
        localStorage.setItem(USER_KEY, serialized);
        sessionStorage.removeItem(USER_KEY);
      } else {
        sessionStorage.setItem(USER_KEY, serialized);
        localStorage.removeItem(USER_KEY);
      }
    } catch {}
  },
  removeUser: (): void => {
    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {}
  },
  getRememberedIdentity: (): string => {
    try {
      return localStorage.getItem(REMEMBERED_IDENTITY_KEY) || '';
    } catch {
      return '';
    }
  },
  setRememberedIdentity: (identity: string): void => {
    try {
      if (identity) {
        localStorage.setItem(REMEMBERED_IDENTITY_KEY, identity);
      } else {
        localStorage.removeItem(REMEMBERED_IDENTITY_KEY);
      }
    } catch {}
  },
  getTrustedDeviceIdentities: (): string[] => {
    try {
      const raw = localStorage.getItem(TRUSTED_DEVICE_IDENTITIES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  markTrustedIdentity: (identity: string): void => {
    try {
      const current = new Set(storageService.getTrustedDeviceIdentities().map((item) => item.toLowerCase()));
      if (identity) current.add(identity.toLowerCase());
      localStorage.setItem(TRUSTED_DEVICE_IDENTITIES_KEY, JSON.stringify([...current]));
    } catch {}
  },
  isTrustedIdentity: (identity: string): boolean => {
    return storageService.getTrustedDeviceIdentities().includes(identity.toLowerCase());
  },
  clear: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {}
  }
};
