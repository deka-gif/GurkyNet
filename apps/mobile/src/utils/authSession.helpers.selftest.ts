/**
 * Auth session invalidation / cold-start gate (Fix #1).
 * Run: npx --yes tsx src/utils/authSession.helpers.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  classifyMeValidationError,
  isCredentialAuthRequest,
  isDefinitiveSessionInvalidError,
  resolveColdStartGate,
  shouldClearIdentityOnPinLoginFailure,
} from './authSession.helpers';

// A. Valid returning user → unlock, no clear
{
  const r = resolveColdStartGate({
    validation: { kind: 'valid' },
    returning: true,
    hasIdentity: true,
  });
  assert.equal(r.gate, 'unlock');
  assert.equal(r.clearIdentity, false);
}

// B. Deleted/invalid account → login + clear
{
  const r = resolveColdStartGate({
    validation: { kind: 'invalid' },
    returning: true,
    hasIdentity: true,
  });
  assert.equal(r.gate, 'login');
  assert.equal(r.clearIdentity, true);
  assert.equal(isDefinitiveSessionInvalidError({ status: 401 }), true);
  assert.equal(classifyMeValidationError({ status: 401 }), 'invalid');
}

// C. Network failure → inconclusive → keep unlock, no clear
{
  const r = resolveColdStartGate({
    validation: { kind: 'inconclusive' },
    returning: true,
    hasIdentity: true,
  });
  assert.equal(r.gate, 'unlock');
  assert.equal(r.clearIdentity, false);
  assert.equal(classifyMeValidationError({ status: 'unknown', message: 'network' }), 'inconclusive');
  assert.equal(classifyMeValidationError({ status: 503 }), 'inconclusive');
  assert.equal(isDefinitiveSessionInvalidError({ status: 'unknown' }), false);
}

// D. PIN wrong (422 pin) → do NOT full identity wipe
{
  assert.equal(
    shouldClearIdentityOnPinLoginFailure({
      status: 422,
      message: 'PIN login tidak valid.',
      errors: { pin: ['PIN login tidak valid.'] },
    }),
    false
  );
  assert.equal(
    shouldClearIdentityOnPinLoginFailure({
      status: 422,
      message: 'PIN login tidak valid.',
    }),
    false
  );
}

// Explicit account-gone on pin path → clear
{
  assert.equal(
    shouldClearIdentityOnPinLoginFailure({
      status: 401,
      message: 'Sesi Anda telah kedaluwarsa atau tidak valid.',
    }),
    true
  );
  assert.equal(
    shouldClearIdentityOnPinLoginFailure({
      status: 404,
      code: 'user_not_found',
      message: 'User tidak ditemukan',
    }),
    true
  );
}

// E. Logout semantics are store-level (soft clear) — helpers must not force clear on no_token returning
{
  const afterLogoutLocal = resolveColdStartGate({
    validation: { kind: 'no_token' },
    returning: true,
    hasIdentity: true,
  });
  assert.equal(afterLogoutLocal.gate, 'unlock');
  assert.equal(afterLogoutLocal.clearIdentity, false);
}

// F. No unlock before validation finishes: invalid never yields unlock
{
  const r = resolveColdStartGate({
    validation: { kind: 'invalid' },
    returning: true,
    hasIdentity: true,
  });
  assert.notEqual(r.gate, 'unlock');
}

// Fresh install — no token, no identity → login
{
  const r = resolveColdStartGate({
    validation: { kind: 'no_token' },
    returning: false,
    hasIdentity: false,
  });
  assert.equal(r.gate, 'login');
  assert.equal(r.clearIdentity, false);
}

// Credential auth URLs — 401 must be skipped by interceptor
assert.equal(isCredentialAuthRequest('/auth/login'), true);
assert.equal(isCredentialAuthRequest('auth/login'), true);
assert.equal(isCredentialAuthRequest('/api/v1/auth/login'), true);
assert.equal(isCredentialAuthRequest('https://api.example.com/api/v1/auth/login'), true);
assert.equal(isCredentialAuthRequest('/auth/login/pin'), true);
assert.equal(isCredentialAuthRequest('/api/v1/auth/login/2fa/verify'), true);
assert.equal(isCredentialAuthRequest('/auth/me'), false);
assert.equal(isCredentialAuthRequest('/auth/logout'), false);
assert.equal(isCredentialAuthRequest('/wallet/balance'), false);

console.log('authSession.helpers.selftest: all assertions passed');
