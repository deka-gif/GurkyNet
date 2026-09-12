/**
 * Transaction PIN vault — biometric-protected SecureStore (Toggle 2 only).
 *
 * Owner-approved exception to "never store PIN": PIN is stored ONLY here, with
 * SecureStore.requireAuthentication (iOS Keychain / Android Keystore).
 * Server always still receives and Hash::checks the same `pin` field.
 *
 * Toggle 1 (app unlock) NEVER writes to this vault.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../api/client';
import { storageService } from '../services/storage.service';
import { authService } from '../services/auth.service';
import type { User } from '../api/types';
import { promptOsBiometric, getBiometricAvailability } from './biometric';
import {
  isSixDigitPin,
  PIN_VAULT_KEY,
  PIN_VAULT_SERVICE,
} from './transactionPinVault.pure';

export { isSixDigitPin, PIN_VAULT_KEY, PIN_VAULT_SERVICE } from './transactionPinVault.pure';

const vaultOptions: SecureStore.SecureStoreOptions = {
  keychainService: PIN_VAULT_SERVICE,
  requireAuthentication: true,
  authenticationPrompt: 'Konfirmasi biometrik untuk PIN transaksi',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

/**
 * Revoke a Sanctum plain-text token via POST /auth/logout.
 * Uses raw axios (not apiClient) so the Bearer header is NOT overwritten by the
 * stored session token interceptor — required for orphan-token cleanup after
 * enroll pinLogin.
 */
export async function revokeSanctumTokenBestEffort(plainTextToken: string): Promise<void> {
  if (!plainTextToken || !API_BASE_URL) return;
  try {
    await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {},
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${plainTextToken}`,
        },
        timeout: 15000,
      }
    );
  } catch {
    // best-effort — never block enroll UX
  }
}

export async function isTransactionBiometricEnabled(): Promise<boolean> {
  return storageService.getBiometricTxEnabled();
}

/**
 * Wipe vault + disable Toggle 2.
 * Call on: PIN change, forgot PIN, logout, Toggle 2 off, failed enroll.
 */
export async function clearTransactionPinVault(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(PIN_VAULT_KEY, {
        keychainService: PIN_VAULT_SERVICE,
      });
    }
  } catch {
    // ignore
  }
  await storageService.setBiometricTxEnabled(false);
}

/**
 * Store PIN after server-side verification. Does not enable Toggle 2 by itself
 * (caller sets the pref after a successful store).
 */
export async function storeVerifiedTransactionPin(pin: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!isSixDigitPin(pin)) return false;
  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) return false;

  try {
    await SecureStore.setItemAsync(PIN_VAULT_KEY, pin, {
      ...vaultOptions,
      authenticationPrompt: 'Konfirmasi biometrik untuk menyimpan PIN transaksi',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read vault PIN (OS biometric prompt via requireAuthentication).
 * Returns null if Toggle 2 off, missing vault, cancel, or failure.
 */
export async function readTransactionPinWithBiometric(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!(await storageService.getBiometricTxEnabled())) return null;

  try {
    const pin = await SecureStore.getItemAsync(PIN_VAULT_KEY, {
      ...vaultOptions,
      authenticationPrompt: 'Konfirmasi biometrik untuk bayar',
    });
    if (pin && isSixDigitPin(pin)) return pin;
    return null;
  } catch {
    return null;
  }
}

export async function hasTransactionPinVaultEntry(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await storageService.getBiometricTxEnabled())) return false;
  // Presence check without forcing a biometric prompt when possible:
  // Android requireAuthentication may still prompt — prefer Toggle 2 flag + try/catch.
  try {
    // Use a non-auth probe: we cannot safely read without auth. Rely on Toggle 2 flag.
    return true;
  } catch {
    return false;
  }
}

/**
 * Enroll Toggle 2:
 * 1) OS biometric challenge
 * 2) Caller collects PIN
 * 3) Verify PIN with POST /auth/login/pin (existing API — Hash::check)
 * 4) Store PIN in biometric-protected vault
 * 5) Enable Toggle 2 pref
 *
 * pinLogin always creates a new Sanctum token. On vault failure we revoke that
 * orphan immediately. On success, caller should applySession(newToken) then
 * revokeSanctumTokenBestEffort(previousToken) so the old session does not linger.
 */
export async function enrollTransactionBiometricWithVerifiedPin(params: {
  identity: string;
  pin: string;
}): Promise<
  | { ok: true; token: string; user: User; previousToken: string | null }
  | { ok: false; message: string }
> {
  if (!isSixDigitPin(params.pin)) {
    return { ok: false, message: 'PIN harus 6 digit.' };
  }
  if (!params.identity.trim()) {
    return { ok: false, message: 'Sesi identitas tidak ditemukan. Login ulang.' };
  }

  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) {
    return { ok: false, message: `${avail.label} tidak tersedia di perangkat ini.` };
  }

  const bioOk = await promptOsBiometric(`Aktifkan ${avail.label} untuk transaksi`);
  if (!bioOk) {
    return { ok: false, message: 'Biometrik dibatalkan atau gagal.' };
  }

  const previousToken = await storageService.getToken();

  let token = '';
  let user: User | null = null;
  try {
    const response = await authService.pinLogin({
      identity: params.identity.trim(),
      pin: params.pin,
    });
    if (!response.success || response.data?.requires_2fa) {
      return {
        ok: false,
        message: response.message || 'PIN tidak valid. Vault tidak disimpan.',
      };
    }
    if (!response.data?.token || !response.data.user) {
      return { ok: false, message: response.message || 'PIN tidak valid.' };
    }
    token = response.data.token;
    user = response.data.user as User;
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || '')
        : '';
    return { ok: false, message: msg || 'Gagal memverifikasi PIN ke server.' };
  }

  const stored = await storeVerifiedTransactionPin(params.pin);
  if (!stored) {
    await clearTransactionPinVault();
    // H.1 — pinLogin already minted a token; revoke so retries do not pile up.
    await revokeSanctumTokenBestEffort(token);
    return {
      ok: false,
      message: 'Gagal menyimpan PIN terenkripsi di perangkat. Coba lagi.',
    };
  }

  await storageService.setBiometricTxEnabled(true);
  return { ok: true, token, user, previousToken };
}

export async function disableTransactionBiometric(): Promise<void> {
  await clearTransactionPinVault();
}
