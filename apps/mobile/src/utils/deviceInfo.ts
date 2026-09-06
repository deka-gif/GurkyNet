import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Friendly device model for session UI / device registration.
 * Uses native Platform constants only — no Location/Camera/Contacts/Storage permissions.
 */
export function getDeviceModel(): string {
  if (Platform.OS === 'android') {
    const c = Platform.constants as {
      Brand?: string;
      Manufacturer?: string;
      Model?: string;
    };
    const brand = String(c?.Brand || c?.Manufacturer || '').trim();
    const model = String(c?.Model || '').trim();
    const label = [brand, model].filter(Boolean).join(' ').trim();
    if (label) return label.slice(0, 128);
    return 'Perangkat Android';
  }

  if (Platform.OS === 'ios') {
    const ios = (Constants as { platform?: { ios?: { model?: string } } }).platform?.ios;
    const model =
      ios?.model ||
      Constants.deviceName ||
      'iPhone';
    return String(model).slice(0, 128);
  }

  return Platform.OS.slice(0, 128);
}

export function getOsVersion(): string {
  return String(Platform.Version ?? '').slice(0, 64);
}
