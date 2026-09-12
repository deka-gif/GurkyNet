import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { storageService } from '../services/storage.service';

export type BiometricAvailability = {
  supported: boolean;
  enrolled: boolean;
  label: string;
};

/**
 * Local biometric helpers.
 * Toggle 1 = app Unlock (session resume) — never stores PIN.
 * Toggle 2 = transaction vault — see transactionPinVault.ts.
 */

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === 'web') {
    return { supported: false, enrolled: false, label: 'Fingerprint' };
  }
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = compatible ? await LocalAuthentication.isEnrolledAsync() : false;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const label = hasFace ? 'Face ID' : 'Fingerprint';
    return { supported: compatible, enrolled, label };
  } catch {
    return { supported: false, enrolled: false, label: 'Fingerprint' };
  }
}

/** Raw OS biometric challenge — does not check Toggle prefs. */
export async function promptOsBiometric(reason: string): Promise<boolean> {
  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Batal',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    return result.success === true;
  } catch {
    return false;
  }
}

/** Toggle 1 — Unlock. Requires Unlock pref ON. */
export async function promptBiometric(reason = 'Masuk ke GurkyNet'): Promise<boolean> {
  const enabled = await storageService.getBiometricUnlockEnabled();
  if (!enabled) return false;
  return promptOsBiometric(reason);
}

/**
 * Enable Toggle 1 after a successful OS biometric challenge (never set flag without auth).
 */
export async function enableBiometricIfAvailable(): Promise<boolean> {
  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) {
    await storageService.setBiometricUnlockEnabled(false);
    return false;
  }

  const ok = await promptOsBiometric(`Aktifkan ${avail.label} untuk buka aplikasi`);
  if (!ok) {
    return false;
  }

  await storageService.setBiometricUnlockEnabled(true);
  return true;
}

export async function disableUnlockBiometric(): Promise<void> {
  await storageService.setBiometricUnlockEnabled(false);
}
