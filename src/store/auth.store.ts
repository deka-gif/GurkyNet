import { create } from 'zustand';
import { authService } from '../services/auth/auth.service';
import { storageService } from '../services/storage.service';
import { User } from '../types';
import { LoginPayload, RegisterPayload, ForgotPasswordPayload } from '../services/auth/auth.service';

/**
 * Normalizes role strings returned by the Laravel API (lowercase/snake_case)
 * to the Title Case format expected throughout the frontend.
 */
function normalizeRole(role: string | undefined | null): string {
  if (!role) return 'User';
  const map: Record<string, string> = {
    'super_admin': 'Super Admin',
    'super admin': 'Super Admin',
    'superadmin': 'Super Admin',
    'owner': 'Owner',
    'finance': 'Finance',
    'operations': 'Operations',
    'marketing': 'Marketing',
    'customer_support': 'Customer Support',
    'customer support': 'Customer Support',
    'customersupport': 'Customer Support',
    'user': 'User',
  };
  return map[role.toLowerCase()] ?? role;
}

/** Flatten ProfileResource / nested user payloads into the frontend User shape. */
function normalizeUserPayload(raw: any): User {
  const profile = raw?.user && typeof raw.user === 'object' && (raw.name || raw.hasPin !== undefined || raw.wallet)
    ? { ...raw.user, ...raw, ...(raw.user || {}) }
    : (raw?.user ?? raw);
  const nested = raw?.user && typeof raw.user === 'object' ? raw.user : null;
  const src = {
    ...(nested || {}),
    ...(typeof profile === 'object' ? profile : {}),
  };

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
  dummySentCode?: string | null;
  remember: boolean;
};

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  validationErrors: Record<string, string[]> | null;
  twoFactorChallenge: TwoFactorChallenge | null;
  login: (payload: LoginPayload, remember?: boolean) => Promise<'ok' | '2fa' | false>;
  verifyLogin2fa: (code: string) => Promise<boolean>;
  clearTwoFactorChallenge: () => void;
  pinLogin: (identity: string, pin: string, remember?: boolean) => Promise<'ok' | '2fa' | false>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  forgotPassword: (payload: ForgotPasswordPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  patchUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    const stored = storageService.getUser() as unknown as User | null;
    if (!stored) return null;
    const normalized: User = { ...stored, role: normalizeRole(stored.role) };
    storageService.setUser(normalized as unknown as Record<string, unknown>);
    return normalized;
  })(),
  token: storageService.getToken(),
  loading: false,
  error: null,
  validationErrors: null,
  twoFactorChallenge: null,

  clearTwoFactorChallenge: () => set({ twoFactorChallenge: null }),

  login: async (payload, remember = true) => {
    set({ loading: true, error: null, validationErrors: null, twoFactorChallenge: null });
    try {
      const response = await authService.login(payload);
      if (response.success && response.data) {
        const data = response.data as any;
        if (data.requires_2fa) {
          set({
            loading: false,
            twoFactorChallenge: {
              identifier: data.identifier || payload.identity,
              expiresAt: data.expires_at,
              resendAvailableAt: data.resend_available_at,
              dummySentCode: data.dummy_sent_code,
              remember,
            },
          });
          return '2fa';
        }

        const { token, user } = data;
        if (!token) {
          set({ error: response.message || 'Login gagal.', loading: false });
          return false;
        }
        const normalizedUser = normalizeUserPayload(user);
        storageService.setToken(token, remember);
        storageService.setUser(normalizedUser as unknown as Record<string, unknown>, remember);
        if (remember) {
          storageService.setRememberedIdentity(payload.identity);
        } else {
          storageService.setRememberedIdentity('');
        }
        storageService.markTrustedIdentity(payload.identity);
        set({ token, user: normalizedUser, loading: false, twoFactorChallenge: null });
        return 'ok';
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.message || 'Gagal login. Cek koneksi Anda.',
        validationErrors: err.errors || null,
        loading: false,
      });
      return false;
    }
  },

  verifyLogin2fa: async (code) => {
    const challenge = get().twoFactorChallenge;
    if (!challenge) {
      set({ error: 'Sesi 2FA tidak ditemukan. Login ulang.' });
      return false;
    }
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.verifyLogin2fa({
        identity: challenge.identifier,
        code,
      });
      if (response.success && response.data) {
        const { token, user } = response.data as any;
        const normalizedUser = normalizeUserPayload(user);
        storageService.setToken(token, challenge.remember);
        storageService.setUser(normalizedUser as unknown as Record<string, unknown>, challenge.remember);
        storageService.markTrustedIdentity(challenge.identifier);
        set({ token, user: normalizedUser, loading: false, twoFactorChallenge: null });
        return true;
      }
      set({ error: response.message || 'Kode 2FA tidak valid.', loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.message || 'Gagal verifikasi 2FA.',
        validationErrors: err.errors || null,
        loading: false,
      });
      return false;
    }
  },

  pinLogin: async (identity, pin, remember = true) => {
    set({ loading: true, error: null, validationErrors: null, twoFactorChallenge: null });
    try {
      const response = await authService.pinLogin({ identity, pin });
      if (response.success && response.data) {
        const data = response.data as any;
        if (data.requires_2fa) {
          set({
            loading: false,
            twoFactorChallenge: {
              identifier: data.identifier || identity,
              expiresAt: data.expires_at,
              resendAvailableAt: data.resend_available_at,
              dummySentCode: data.dummy_sent_code,
              remember,
            },
          });
          return '2fa';
        }
        const { token, user } = data;
        const normalizedUser = normalizeUserPayload(user);
        storageService.setToken(token, remember);
        storageService.setUser(normalizedUser as unknown as Record<string, unknown>, remember);
        storageService.setRememberedIdentity(identity);
        storageService.markTrustedIdentity(identity);
        set({ token, user: normalizedUser, loading: false });
        return 'ok';
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.message || 'Gagal login dengan PIN.',
        validationErrors: err.errors || null,
        loading: false,
      });
      return false;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.register(payload);
      if (response.success) {
        set({ loading: false });
        return true;
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.message || 'Gagal register. Cek koneksi Anda.',
        validationErrors: err.errors || null,
        loading: false,
      });
      return false;
    }
  },

  forgotPassword: async (payload) => {
    set({ loading: true, error: null });
    try {
      const response = await authService.forgotPassword(payload);
      if (response.success) {
        set({ loading: false });
        return true;
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: any) {
      set({
        error: err.message || 'Gagal mengirim email pemulihan.',
        loading: false,
      });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      const token = storageService.getToken();
      if (token) {
        await authService.logout();
      }
    } catch {
      // Ignore API logout failure
    } finally {
      storageService.clear();
      set({ user: null, token: null, loading: false, error: null, twoFactorChallenge: null });
    }
  },

  fetchUser: async () => {
    const token = storageService.getToken();
    if (!token) return;
    set({ loading: true });
    try {
      const response = await authService.me();
      if (response.success) {
        const payload = (response.data as any).data ?? response.data;
        const normalizedUser = normalizeUserPayload(payload?.user ?? payload);
        storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
        set({ user: normalizedUser, loading: false });
      } else {
        storageService.clear();
        set({ user: null, token: null, loading: false });
      }
    } catch {
      storageService.clear();
      set({ user: null, token: null, loading: false });
    }
  },

  patchUser: (partial) => {
    const current = get().user;
    if (!current) return;
    const next: User = {
      ...current,
      ...partial,
      role: partial.role ? normalizeRole(partial.role) : current.role,
      avatar: partial.avatar !== undefined ? String(partial.avatar || '') : current.avatar,
    };
    storageService.setUser(next as unknown as Record<string, unknown>);
    set({ user: next });
  },
}));
