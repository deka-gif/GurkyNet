import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  authService,
  LoginPayload,
  RegisterPayload,
} from '../services/auth.service';
import { storageService } from '../services/storage.service';
import { profileService } from '../services/profile.service';
import { getDeviceModel, getOsVersion } from '../utils/deviceInfo';
import { User } from '../api/types';
import {
  beginSuppressUnauthorizedEmit,
  endSuppressUnauthorizedEmit,
  parseApiError,
} from '../api/client';
import {
  classifyMeValidationError,
  resolveColdStartGate,
  shouldClearIdentityOnPinLoginFailure,
  isDefinitiveSessionInvalidError,
} from '../utils/authSession.helpers';
import { useNotificationStore } from './notification.store';
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

async function syncDeviceRegistration(): Promise<void> {
  try {
    const device_uuid = await storageService.getDeviceUuid();
    if (!device_uuid) return;
    await profileService.registerDevice({
      device_uuid,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_model: getDeviceModel(),
      os_version: getOsVersion(),
      app_version: Constants.expoConfig?.version ?? undefined,
    });
    // Best-effort push token sync when OS permission already granted — no auto OS prompt.
    const { pushNotificationService } = await import('../services/pushNotification.service');
    const status = await pushNotificationService.getPermissionStatus();
    if (status === 'granted') {
      await pushNotificationService.syncPushTokenWithBackend({
        requestPermission: false,
      });
    }
  } catch (err) {
    console.info(
      '[push] AUTH_DEVICE_SYNC_FAILURE error=' +
        (err instanceof Error ? err.message.slice(0, 200) : 'unknown')
    );
  }
}

async function disassociatePushDevice(): Promise<void> {
  try {
    const { pushNotificationService } = await import('../services/pushNotification.service');
    await pushNotificationService.disassociateDevice();
  } catch {
    // ignore
  }
}

export type TwoFactorChallenge = {
  identifier: string;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
};

/** Bootstrap gate — set after hydrate, before first navigation. */
export type AuthGate = 'booting' | 'login' | 'unlock' | 'authenticated';

/** In-memory only — P0 finalize capability after OTP (never persist to SecureStore). */
export type PendingOnboardingFinalize = {
  onboardingId: number;
  finalizeToken: string;
};

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  gate: AuthGate;
  rememberedIdentity: string | null;
  loading: boolean;
  error: string | null;
  validationErrors: Record<string, string[]> | null;
  twoFactorChallenge: TwoFactorChallenge | null;
  pendingOnboardingFinalize: PendingOnboardingFinalize | null;
  hydrate: () => Promise<void>;
  applySession: (token: string, userRaw: unknown, identity?: string) => Promise<void>;
  login: (payload: LoginPayload) => Promise<'ok' | '2fa' | false>;
  pinLogin: (pin: string) => Promise<boolean>;
  verifyLogin2fa: (code: string) => Promise<boolean>;
  clearTwoFactorChallenge: () => void;
  setPendingOnboardingFinalize: (pending: PendingOnboardingFinalize | null) => void;
  registerStart: (payload: RegisterPayload) => Promise<{ onboardingId: number; email: string } | null>;
  finalizeRegistration: (payload: {
    onboarding_id: number;
    finalize_token: string;
    pin: string;
    pin_confirmation: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<void>;
  fetchUser: () => Promise<void>;
  unlockWithExistingSession: () => Promise<boolean>;
  setGate: (gate: AuthGate) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  gate: 'booting',
  rememberedIdentity: null,
  loading: false,
  error: null,
  validationErrors: null,
  twoFactorChallenge: null,
  pendingOnboardingFinalize: null,

  setGate: (gate) => set({ gate }),
  clearError: () => set({ error: null, validationErrors: null }),

  hydrate: async () => {
    // Stay gate=booting / hydrated=false until decision — avoids unlock flash.
    const [token, storedUser, identity, returning] = await Promise.all([
      storageService.getToken(),
      storageService.getUser(),
      storageService.getRememberedIdentity(),
      storageService.isReturningUser(),
    ]);
    const user = storedUser ? normalizeUserPayload(storedUser) : null;

    if (token) {
      beginSuppressUnauthorizedEmit();
      try {
        const response = await authService.me();
        if (response.success) {
          const payload: any = response.data;
          const normalizedUser = normalizeUserPayload(payload?.user ?? payload);
          await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
          const decided = resolveColdStartGate({
            validation: { kind: 'valid' },
            returning: true,
            hasIdentity: !!(identity || returning),
          });
          set({
            token,
            user: normalizedUser,
            rememberedIdentity: identity,
            hydrated: true,
            gate: decided.gate,
          });
          void syncDeviceRegistration();
          return;
        }
        // Non-success body without throw — treat as invalid session.
        await storageService.clearAuthIdentity();
        set({
          token: null,
          user: null,
          rememberedIdentity: null,
          hydrated: true,
          gate: 'login',
        });
        return;
      } catch (err: unknown) {
        const parsed = parseApiError(err);
        const kind = classifyMeValidationError(parsed);
        if (kind === 'invalid') {
          await storageService.clearAuthIdentity();
          set({
            token: null,
            user: null,
            rememberedIdentity: null,
            hydrated: true,
            gate: 'login',
          });
          return;
        }
        // Network / timeout / 5xx — do not wipe identity; keep unlock if returning.
        const decided = resolveColdStartGate({
          validation: { kind: 'inconclusive' },
          returning: !!(returning || identity),
          hasIdentity: !!identity,
        });
        set({
          token,
          user,
          rememberedIdentity: identity,
          hydrated: true,
          gate: decided.gate,
        });
        return;
      } finally {
        endSuppressUnauthorizedEmit();
      }
    }

    const decided = resolveColdStartGate({
      validation: { kind: 'no_token' },
      returning: !!(returning || identity),
      hasIdentity: !!identity,
    });
    set({
      token: null,
      user: null,
      rememberedIdentity: identity,
      hydrated: true,
      gate: decided.gate,
    });
  },

  applySession: async (token, userRaw, identity) => {
    const normalizedUser = normalizeUserPayload(userRaw);
    const id =
      identity ||
      normalizedUser.email ||
      normalizedUser.phone ||
      (await storageService.getRememberedIdentity()) ||
      '';
    await storageService.setToken(token);
    await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
    if (id) {
      await storageService.setRememberedIdentity(id);
      await storageService.markTrustedIdentity(id);
    }
    set({
      token,
      user: normalizedUser,
      rememberedIdentity: id || null,
      loading: false,
      twoFactorChallenge: null,
      error: null,
      gate: 'authenticated',
    });
    void syncDeviceRegistration();
  },

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
        await get().applySession(data.token, data.user, payload.identity);
        return 'ok';
      }
      set({ error: response.message, loading: false });
      return false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      set({
        error: parsed.message || 'Gagal login. Periksa koneksi Anda.',
        validationErrors: parsed.errors || null,
        loading: false,
      });
      return false;
    }
  },

  pinLogin: async (pin) => {
    const identity = get().rememberedIdentity;
    if (!identity) {
      set({ error: 'Sesi perangkat tidak ditemukan. Masuk dengan email/password.' });
      return false;
    }
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.pinLogin({ identity, pin });
      if (response.success && response.data?.requires_2fa) {
        set({
          loading: false,
          twoFactorChallenge: {
            identifier: response.data.identifier || identity,
            expiresAt: response.data.expires_at,
            resendAvailableAt: response.data.resend_available_at,
          },
          gate: 'login',
        });
        return false;
      }
      if (response.success && response.data?.token) {
        await get().applySession(response.data.token, response.data.user, identity);
        return true;
      }
      set({
        error: response.message || 'PIN tidak valid.',
        loading: false,
      });
      return false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      if (shouldClearIdentityOnPinLoginFailure(parsed)) {
        await storageService.clearAuthIdentity();
        useNotificationStore.getState().reset();
        set({
          user: null,
          token: null,
          rememberedIdentity: null,
          loading: false,
          error: parsed.message || 'Sesi tidak valid. Silakan masuk kembali.',
          validationErrors: null,
          twoFactorChallenge: null,
          gate: 'login',
        });
        return false;
      }
      set({
        error: parsed.message || 'PIN tidak valid.',
        validationErrors: parsed.errors || null,
        loading: false,
      });
      return false;
    }
  },

  unlockWithExistingSession: async () => {
    const token = get().token || (await storageService.getToken());
    if (!token) return false;
    set({ loading: true, error: null });
    try {
      const response = await authService.me();
      if (response.success) {
        const payload: any = response.data;
        const normalizedUser = normalizeUserPayload(payload?.user ?? payload);
        await storageService.setUser(normalizedUser as unknown as Record<string, unknown>);
        set({
          token,
          user: normalizedUser,
          loading: false,
          gate: 'authenticated',
          error: null,
        });
        void syncDeviceRegistration();
        return true;
      }
      await storageService.clearAuthIdentity();
      useNotificationStore.getState().reset();
      set({
        token: null,
        user: null,
        rememberedIdentity: null,
        loading: false,
        gate: 'login',
      });
      return false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      if (isDefinitiveSessionInvalidError(parsed)) {
        await storageService.clearAuthIdentity();
        useNotificationStore.getState().reset();
        set({
          token: null,
          user: null,
          rememberedIdentity: null,
          loading: false,
          gate: 'login',
          error: null,
        });
        return false;
      }
      set({ loading: false });
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
      const response = await authService.verifyLogin2fa({
        identity: challenge.identifier,
        code,
      });
      if (response.success && response.data?.token) {
        await get().applySession(response.data.token, response.data.user, challenge.identifier);
        return true;
      }
      set({ error: response.message || 'Kode verifikasi tidak valid.', loading: false });
      return false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      set({ error: parsed.message || 'Gagal verifikasi.', loading: false });
      return false;
    }
  },

  clearTwoFactorChallenge: () => set({ twoFactorChallenge: null }),

  setPendingOnboardingFinalize: (pending) => set({ pendingOnboardingFinalize: pending }),

  registerStart: async (payload) => {
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.register(payload);
      if (response.success && response.data?.onboarding_id) {
        set({ loading: false });
        return {
          onboardingId: response.data.onboarding_id,
          email: response.data.email || payload.email,
        };
      }
      set({ error: response.message || 'Registrasi gagal.', loading: false });
      return null;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      set({
        error: parsed.message || 'Registrasi gagal.',
        validationErrors: parsed.errors || null,
        loading: false,
      });
      return null;
    }
  },

  finalizeRegistration: async (payload) => {
    set({ loading: true, error: null, validationErrors: null });
    try {
      const response = await authService.finalizeRegistration({
        ...payload,
        accept_policies: true,
        remember_device: true,
      });
      if (response.success && response.data?.token) {
        set({ pendingOnboardingFinalize: null });
        await get().applySession(response.data.token, response.data.user);
        return true;
      }
      set({ error: response.message || 'Gagal menyelesaikan registrasi.', loading: false });
      return false;
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      set({
        error: parsed.message || 'Gagal menyelesaikan registrasi.',
        validationErrors: parsed.errors || null,
        loading: false,
      });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await disassociatePushDevice();
      const token = await storageService.getToken();
      if (token) {
        await authService.logout();
      }
    } catch {
      // ignore
    } finally {
      await storageService.clear();
      const identity = await storageService.getRememberedIdentity();
      // Clear in-memory inbox so user B never sees user A notifications.
      useNotificationStore.getState().reset();
      set({
        user: null,
        token: null,
        loading: false,
        error: null,
        twoFactorChallenge: null,
        rememberedIdentity: identity,
        gate: identity ? 'unlock' : 'login',
      });
    }
  },

  switchAccount: async () => {
    try {
      await disassociatePushDevice();
      const token = await storageService.getToken();
      if (token) {
        try {
          await authService.logout();
        } catch {
          // ignore
        }
      }
    } finally {
      await storageService.clearAuthIdentity();
      useNotificationStore.getState().reset();
      set({
        user: null,
        token: null,
        rememberedIdentity: null,
        loading: false,
        error: null,
        twoFactorChallenge: null,
        gate: 'login',
      });
    }
  },

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
