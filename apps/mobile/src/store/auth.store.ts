import { create } from 'zustand';
import { authService, LoginPayload } from '../services/auth.service';
import { storageService } from '../services/storage.service';
import { User } from '../api/types';

/** Same role-label mapping as src/store/auth.store.ts on web. */
function normalizeRole(role: string | undefined | null): string {
  if (!role) return 'User';
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    owner: 'Owner',
    finance: 'Finance',
    operations: 'Operations',
    marketing: 'Marketing',
    customer_support: 'Customer Support',
    user: 'User',
  };
  return map[role.toLowerCase()] ?? role;
}

/** Same nested-payload flattening as web's normalizeUserPayload — server responses for
 * /auth/login and /auth/me shape the user object slightly differently. */
function normalizeUserPayload(raw: any): User {
  const profile =
    raw?.user && typeof raw.user === 'object' && (raw.name || raw.hasPin !== undefined || raw.wallet)
      ? { ...raw.user, ...raw, ...(raw.user || {}) }
      : (raw?.user ?? raw);
  const nested = raw?.user && typeof raw.user === 'object' ? raw.user : null;
  const src = { ...(nested || {}), ...(typeof profile === 'object' ? profile : {}) };

  return {
    id: String(src.id ?? ''),
    name: src.name ?? '',
    email: src.email ?? '',
    phone: src.phone ?? src.phone_number ?? '',
    avatar: src.avatar ?? src.avatar_url ?? '',
    role: normalizeRole(src.role),
    isVerified: !!(src.isVerified ?? src.is_verified ?? src.emailVerified),
    hasPin: !!(src.hasPin ?? src.has_pin),
    createdAt: src.createdAt ?? src.created_at,
    wallet: src.wallet ?? null,
    kycStatus: src.kycStatus ?? src.kyc_status,
    phoneVerified: !!(src.phoneVerified ?? src.phone_verified),
    emailVerified: !!(src.emailVerified ?? src.email_verified ?? src.email_verified_at),
    userType: src.userType ?? src.user_type,
  };
}

export type TwoFactorChallenge = {
  identifier: string;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
};

interface AuthState {
  user: User | null;
  token: string | null;
  /** True until the initial secure-storage read (hydrate()) completes — gates the
   * splash/redirect logic so the app never flashes the login screen for an already
   * logged-in user. */
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  validationErrors: Record<string, string[]> | null;
  twoFactorChallenge: TwoFactorChallenge | null;
  hydrate: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<'ok' | '2fa' | false>;
  verifyLogin2fa: (code: string) => Promise<boolean>;
  clearTwoFactorChallenge: () => void;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  loading: false,
  error: null,
  validationErrors: null,
  twoFactorChallenge: null,

  /** Called once from the root layout on app start — reads the persisted session. */
  hydrate: async () => {
    const [token, storedUser] = await Promise.all([storageService.getToken(), storageService.getUser()]);
    const user = storedUser ? normalizeUserPayload(storedUser) : null;
    set({ token, user, hydrated: true });
  },

  clearTwoFactorChallenge: () => set({ twoFactorChallenge: null }),

  login: async (payload) => {
    set({ loading: true, error: null, validationErrors: null, twoFactorChallenge: null });
    try {
      const response = await authService.login(payload);
      if (response.success && response.data) {
        const data = response.data;
        if (data.requires_2fa) {
          set({
            loading: false,
            twoFactorChallenge: {
              identifier: data.identifier || payload.identity,
              expiresAt: data.expires_at,
              resendAvailableAt: data.resend_available_at,
            },
          });
          return '2fa';
        }

        if (!data.token) {
          set({ error: response.message || 'Login gagal.', loading: false });
          return false;
        }

        const normalizedUser = normalizeUserPayload(data.user);
        await storageService.setToken(data.token);
        await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
        await storageService.setRememberedIdentity(payload.identity);
        await storageService.markTrustedIdentity(payload.identity);
        set({ token: data.token, user: normalizedUser, loading: false, twoFactorChallenge: null });
        return 'ok';
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err?.message || 'Gagal login. Periksa koneksi Anda.',
        validationErrors: err?.errors || null,
        loading: false,
      });
      return false;
    }
  },

  verifyLogin2fa: async (code) => {
    const challenge = get().twoFactorChallenge;
    if (!challenge) {
      set({ error: 'Sesi verifikasi tidak ditemukan. Silakan login ulang.' });
      return false;
    }
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.verifyLogin2fa({ identity: challenge.identifier, code });
      if (response.success && response.data?.token) {
        const normalizedUser = normalizeUserPayload(response.data.user);
        await storageService.setToken(response.data.token);
        await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
        await storageService.markTrustedIdentity(challenge.identifier);
        set({ token: response.data.token, user: normalizedUser, loading: false, twoFactorChallenge: null });
        return true;
      }
      set({ error: response.message || 'Kode verifikasi tidak valid.', loading: false });
      return false;
    } catch (err: any) {
      set({ error: err?.message || 'Gagal verifikasi.', loading: false });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      const token = await storageService.getToken();
      if (token) {
        await authService.logout();
      }
    } catch {
      // Ignore API logout failure — still clear local session below.
    } finally {
      await storageService.clear();
      set({ user: null, token: null, loading: false, error: null, twoFactorChallenge: null });
    }
  },

  /** Never clears the session on a non-401 failure (timeout/5xx/cancelled) — only the
   * apiClient 401 interceptor is allowed to do that. Same invariant as web's fetchUser(). */
  fetchUser: async () => {
    const token = await storageService.getToken();
    if (!token) return;
    set({ loading: true });
    try {
      const response = await authService.me();
      if (response.success) {
        const payload: any = response.data;
        const normalizedUser = normalizeUserPayload(payload?.user ?? payload);
        await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
        set({ user: normalizedUser, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));
