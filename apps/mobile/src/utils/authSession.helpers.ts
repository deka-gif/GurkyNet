/**
 * Auth session lifecycle helpers (FR-AUTH session bootstrap).
 * Pure functions — used by hydrate / 401 interceptor / pinLogin without RN runtime.
 */

export type AuthGateDecision = 'login' | 'unlock';

export type ColdStartValidation =
  | { kind: 'no_token' }
  | { kind: 'valid' }
  | { kind: 'invalid' }
  | { kind: 'inconclusive' };

export type ColdStartGateResult = {
  gate: AuthGateDecision;
  clearIdentity: boolean;
};

/**
 * Decide unlock vs login after optional server validation.
 * Invalid → always login + full identity clear.
 * Network inconclusive → never clear identity; prefer unlock when returning.
 */
export function resolveColdStartGate(input: {
  validation: ColdStartValidation;
  returning: boolean;
  hasIdentity: boolean;
}): ColdStartGateResult {
  if (input.validation.kind === 'invalid') {
    return { gate: 'login', clearIdentity: true };
  }

  if (input.validation.kind === 'valid') {
    return { gate: 'unlock', clearIdentity: false };
  }

  // no_token | inconclusive — local returning-user UX (incl. offline with token)
  if (input.returning || input.hasIdentity) {
    return { gate: 'unlock', clearIdentity: false };
  }

  if (input.validation.kind === 'inconclusive') {
    // Had a token but could not reach server — keep unlock path if we still
    // treat token presence as returning; caller passes returning/identity.
    return { gate: 'unlock', clearIdentity: false };
  }

  return { gate: 'login', clearIdentity: false };
}

/** Login / PIN / 2FA credential attempts — 401 must not wipe returning identity. */
export function isCredentialAuthRequest(url: string | undefined | null): boolean {
  if (!url) return false;
  const path = '/' + String(url)
    .replace(/^https?:\/\/[^/?#]+/i, '')
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (path.endsWith('/auth/login')) return true;
  if (path.includes('/auth/login/pin')) return true;
  if (path.includes('/auth/login/2fa')) return true;
  return false;
}

export type ParsedAuthErrorLike = {
  status?: number | string;
  message?: string;
  code?: string | number;
  errors?: Record<string, string[]>;
};

/**
 * True only when the server definitively rejects the authenticated session /
 * account — never for generic wrong-PIN (422) or network failures.
 */
export function isDefinitiveSessionInvalidError(err: ParsedAuthErrorLike | null | undefined): boolean {
  if (!err) return false;
  const status = err.status;
  if (status === 401) return true;

  const code = String(err.code ?? '').toLowerCase();
  if (
    code === 'account_not_found' ||
    code === 'user_not_found' ||
    code === 'identity_not_found' ||
    code === 'account_deleted' ||
    code === 'session_invalid'
  ) {
    return true;
  }

  const message = String(err.message ?? '').toLowerCase();
  if (
    message.includes('akun tidak ditemukan') ||
    message.includes('user tidak ditemukan') ||
    message.includes('account not found') ||
    message.includes('user not found')
  ) {
    return true;
  }

  return false;
}

/**
 * pinLogin: wrong PIN stays on unlock; only explicit account-gone signals clear.
 * Backend today returns 422 "PIN login tidak valid" for both wrong PIN and
 * missing user — that must NOT wipe identity.
 */
export function shouldClearIdentityOnPinLoginFailure(err: ParsedAuthErrorLike | null | undefined): boolean {
  if (!err) return false;
  const status = err.status;
  // 422 with pin field errors = credential failure, not account deletion.
  if (status === 422) {
    const pinErrors = err.errors?.pin;
    if (Array.isArray(pinErrors) && pinErrors.length > 0) return false;
    const message = String(err.message ?? '').toLowerCase();
    if (message.includes('pin')) return false;
  }
  return isDefinitiveSessionInvalidError(err);
}

/** Classify /auth/me style failures for cold-start validation. */
export function classifyMeValidationError(err: ParsedAuthErrorLike | null | undefined): 'invalid' | 'inconclusive' {
  if (!err) return 'inconclusive';
  if (isDefinitiveSessionInvalidError(err)) return 'invalid';
  const status = err.status;
  if (status === 'unknown' || status === undefined) return 'inconclusive';
  if (typeof status === 'number' && status >= 500) return 'inconclusive';
  // Timeouts / network surface as unknown or non-401
  return 'inconclusive';
}
