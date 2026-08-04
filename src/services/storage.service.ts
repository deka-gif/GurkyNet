const TOKEN_KEY = 'gurkynet_auth_token';
const USER_KEY = 'gurkynet_user_data';
const REMEMBERED_IDENTITY_KEY = 'gurkynet_remembered_identity';

export const storageService = {
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
  clear: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {}
  }
};
