/**
 * Pure helpers for Expo push registration — safe to unit-test without RN runtime.
 */

export function resolveEasProjectId(constants: {
  easConfig?: { projectId?: string } | null;
  expoConfig?: { extra?: { eas?: { projectId?: string } } } | null;
}): string | undefined {
  return (
    constants.easConfig?.projectId ||
    constants.expoConfig?.extra?.eas?.projectId ||
    undefined
  );
}

export function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')
  );
}

/** Strip token-like substrings from error messages before logging. */
export function sanitizePushErrorMessage(err: unknown): string {
  let msg = '';
  if (err instanceof Error) msg = err.message;
  else if (typeof err === 'string') msg = err;
  else msg = 'unknown_error';
  return msg
    .replace(/ExponentPushToken\[[^\]]*\]/gi, 'ExponentPushToken[REDACTED]')
    .replace(/ExpoPushToken\[[^\]]*\]/gi, 'ExpoPushToken[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 300);
}

export function logPushObservability(
  event: string,
  fields: Record<string, string | number | boolean | undefined | null>
): void {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v === null ? 'null' : String(v)}`);
  console.info(`[push] ${event} ${parts.join(' ')}`);
}

/**
 * Canonical Expo `data.category` from backend NotificationService::buildPushData:
 * `transaction` | `announcement` | `promotion`.
 * Fallback: `data.type` (backend sets type = same category string).
 *
 * Transaction → show OS banner/list even in foreground (audit GRK-20260912-000008).
 * Non-transaction → keep legacy suppress (no tray in foreground).
 */
export function resolvePushPresentation(data: {
  category?: string | null;
  type?: string | null;
}): {
  category: string;
  isTransaction: boolean;
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  bannerDecision: 'show' | 'suppress';
} {
  const category = String(data.category || data.type || '')
    .trim()
    .toLowerCase();
  const isTransaction = category === 'transaction';
  return {
    category: category || 'unknown',
    isTransaction,
    shouldShowBanner: isTransaction,
    shouldShowList: isTransaction,
    shouldPlaySound: false,
    shouldSetBadge: true,
    bannerDecision: isTransaction ? 'show' : 'suppress',
  };
}

/** Expected sync outcomes for documentation / tests. */
export type PushSyncReason =
  | 'registered'
  | 'permission_denied'
  | 'permission_undetermined'
  | 'missing_project_id'
  | 'token_fetch_failed'
  | 'invalid_token'
  | 'register_failed'
  | 'not_authenticated';

export function classifyTokenFetchFailure(message: string): PushSyncReason {
  if (message.includes('missing_eas_project_id')) return 'missing_project_id';
  if (message.includes('invalid_expo_push_token')) return 'invalid_token';
  if (message.includes('register') || /network/i.test(message)) return 'register_failed';
  return 'token_fetch_failed';
}
