import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { storageService } from '../services/storage.service';

export type BiometricAvailability = {
  supported: boolean;
  enrolled: boolean;
  label: string;
};

/**
 * Local biometric unlock for an already-valid SecureStore session.
 * Never stores fingerprints. Never invents success without OS prompt.
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

export async function promptBiometric(reason = 'Masuk ke GurkyPay'): Promise<boolean> {
  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) return false;

  const enabled = await storageService.getBiometricEnabled();
  if (!enabled) return false;

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

/**
 * Persist biometric unlock preference. Call ONLY after explicit user consent
 * (e.g. unlock screen "Aktifkan Face ID / Fingerprint"). Never auto-call after login.
 */
export async function enableBiometricIfAvailable(): Promise<boolean> {
  const avail = await getBiometricAvailability();
  if (!avail.supported || !avail.enrolled) {
    await storageService.setBiometricEnabled(false);
    return false;
  }
  await storageService.setBiometricEnabled(true);
  return true;
}
