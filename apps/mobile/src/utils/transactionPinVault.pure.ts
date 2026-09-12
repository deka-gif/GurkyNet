/**
 * Pure helpers for transaction PIN vault (no RN / SecureStore).
 * Shared by transactionPinVault.ts and unit tests.
 */
export const PIN_VAULT_KEY = 'gurkynet_tx_pin_vault';
export const PIN_VAULT_SERVICE = 'gurkynet.tx.pin.vault';

export function isSixDigitPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
