import * as Crypto from 'expo-crypto';

/**
 * Mirrors src/utils/idempotency.ts on web (SRS 14.1): one client-generated key
 * identifies one logical checkout attempt. Retries of the same attempt (wrong PIN,
 * network timeout, explicit user retry) must reuse the same key; only a genuinely new
 * purchase attempt gets a new one. Key rotation lives solely in the checkout store's
 * startCheckout()/startNewPurchase() — never here, and never anywhere else.
 */
export function createIdempotencyKey(): string {
  return Crypto.randomUUID();
}
