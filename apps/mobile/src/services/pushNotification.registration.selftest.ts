/**
 * Regression: Expo push registration helpers (no RN runtime).
 * Run: npx --yes tsx src/services/pushNotification.registration.selftest.ts
 */
import {
  classifyTokenFetchFailure,
  isExpoPushToken,
  resolveEasProjectId,
  sanitizePushErrorMessage,
} from './pushNotification.helpers';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// A. Fake / non-Expo tokens rejected → do not register fake token
assert(!isExpoPushToken('fcm-native-token-abc'), 'native FCM token must not pass');
assert(!isExpoPushToken(''), 'empty token must not pass');
assert(isExpoPushToken('ExponentPushToken[xxxxxx]'), 'ExponentPushToken must pass');
assert(isExpoPushToken('ExpoPushToken[yyyyyy]'), 'ExpoPushToken must pass');

// B. getExpoPushToken failure classification is observable (not silent success)
assert(
  classifyTokenFetchFailure('missing_eas_project_id') === 'missing_project_id',
  'missing project id'
);
assert(
  classifyTokenFetchFailure('invalid_expo_push_token_shape') === 'invalid_token',
  'invalid token'
);
assert(
  classifyTokenFetchFailure('Network Error') === 'register_failed',
  'network → register_failed bucket'
);
assert(
  classifyTokenFetchFailure('empty_expo_push_token') === 'token_fetch_failed',
  'generic fetch fail'
);

// C. Success path requires Expo shape + provider expo (shape guard)
assert(isExpoPushToken('ExponentPushToken[ok]'), 'success token shape');

// D. Error sanitization never echoes token / bearer
const dirty =
  'failed ExponentPushToken[SECRET123] with Bearer abc.def.ghi and ExpoPushToken[OTHER]';
const clean = sanitizePushErrorMessage(dirty);
assert(!clean.includes('SECRET123'), 'must redact ExponentPushToken body');
assert(!clean.includes('OTHER'), 'must redact ExpoPushToken body');
assert(!clean.includes('abc.def.ghi'), 'must redact Bearer token');
assert(clean.includes('REDACTED'), 'must mark redactions');

// E. projectId resolution (required for getExpoPushTokenAsync)
assert(
  resolveEasProjectId({
    easConfig: { projectId: 'from-eas' },
    expoConfig: { extra: { eas: { projectId: 'from-extra' } } },
  }) === 'from-eas',
  'easConfig projectId wins'
);
assert(
  resolveEasProjectId({
    easConfig: null,
    expoConfig: { extra: { eas: { projectId: '1e8504cf-f138-41aa-934d-44a5ee36c5c3' } } },
  }) === '1e8504cf-f138-41aa-934d-44a5ee36c5c3',
  'extra.eas.projectId fallback'
);
assert(
  resolveEasProjectId({ easConfig: null, expoConfig: { extra: {} } }) === undefined,
  'missing projectId returns undefined → sync fails clearly'
);

console.log('PASS pushNotification.registration.selftest');
