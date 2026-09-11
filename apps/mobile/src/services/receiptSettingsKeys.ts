/**
 * Pure key helpers for receipt settings (no RN / SecureStore).
 * Scoped per user — SecureStore only allows [A-Za-z0-9._-] (no ":").
 */

export const RECEIPT_SETTINGS_KEY_PREFIX = {
  store: 'gurkynet_store_profile_v1',
  template: 'gurkynet_receipt_template_v1',
  printer: 'gurkynet_printer_pref_v1',
} as const;

/**
 * Pre-scoping global keys (GurkyPay-era). Migrated once into scoped gurkynet_*_{userId}.
 * Do not write new data here.
 */
export const RECEIPT_LEGACY_STORAGE_KEYS = {
  store: 'gurkypay_store_profile_v1',
  template: 'gurkypay_receipt_template_v1',
  printer: 'gurkypay_printer_pref_v1',
} as const;

/**
 * Device-level flag: legacy global keys were already offered to one active user.
 * Prevents User B from inheriting the same device-global legacy blob after User A migrated.
 */
export const RECEIPT_LEGACY_CONSUMED_FLAG_KEY = 'gurkynet_receipt_legacy_consumed_v1';

export type ReceiptSettingsKind = keyof typeof RECEIPT_SETTINGS_KEY_PREFIX;

/** Sanitize user id for SecureStore key charset. */
export function sanitizeReceiptSettingsUserId(userId: string): string {
  const id = String(userId || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return id;
}

/**
 * Build SecureStore-safe key: `{prefix}_{userId}`.
 * Never use ":" — expo-secure-store rejects it (silent fail if caught).
 */
export function receiptSettingsStorageKey(kind: ReceiptSettingsKind, userId: string): string {
  const id = sanitizeReceiptSettingsUserId(userId);
  if (!id) {
    throw new Error('receiptSettingsStorageKey requires a non-empty userId');
  }
  return `${RECEIPT_SETTINGS_KEY_PREFIX[kind]}_${id}`;
}

export function receiptLegacyStorageKey(kind: ReceiptSettingsKind): string {
  return RECEIPT_LEGACY_STORAGE_KEYS[kind];
}

/** True when scoped storage already has a non-empty raw value (wins over legacy). */
export function scopedRawHasPriority(scopedRaw: string | null | undefined): boolean {
  return typeof scopedRaw === 'string' && scopedRaw.trim().length > 0;
}

/** Safe JSON parse — malformed → null (no throw). */
export function parseReceiptSettingsJson(raw: string | null | undefined): unknown | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Whether legacy may still be copied into the active user's scoped keys.
 * After one successful migration pass on the device, legacy must not apply to another user.
 */
export function canOfferLegacyMigration(legacyConsumedFlag: string | null | undefined): boolean {
  return legacyConsumedFlag !== '1';
}
