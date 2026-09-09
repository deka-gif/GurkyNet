import {
  Linking,
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import type { Device } from 'react-native-thermal-printer-driver';
import {
  receiptSettingsService,
  type PaperWidthMm,
  type SavedPrinter,
} from './receiptSettings.service';
import type { ReceiptData } from './transaction.service';
import {
  buildReceiptLines,
  type ReceiptLine,
  type ReceiptPrintContext,
} from '../utils/receiptPrint';

export type BluetoothPermissionState =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'unsupported';

export type PrinterScanDevice = Device & {
  /** Address ready for connect/print (scheme prefix applied). */
  connectAddress: string;
};

function isNativeDriverAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('ThermalPrinterDriver') != null;
  } catch {
    return false;
  }
}

async function loadDriver() {
  if (!isNativeDriverAvailable()) {
    throw new Error(
      'Modul printer belum tersedia. Pasang development build (EAS) — fitur ini tidak berjalan di Expo Go.'
    );
  }
  return import('react-native-thermal-printer-driver');
}

/** Scan returns raw MAC; connect/print need bt: / ble: prefix. */
export function toConnectAddress(
  address: string,
  deviceType: Device['deviceType']
): string {
  const trimmed = address.trim();
  if (/^(bt|ble|lan|tcp):/i.test(trimmed)) return trimmed;
  if (Platform.OS === 'ios') {
    return `ble:${trimmed}`;
  }
  if (deviceType === 'ble') return `ble:${trimmed}`;
  // Classic / dual / unknown → Classic on Android (typical Indo POS printers).
  return `bt:${trimmed}`;
}

export async function ensureBluetoothPermissions(): Promise<BluetoothPermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'ios') {
    // iOS prompts via Info.plist when BLE APIs are used.
    return 'granted';
  }
  if (Platform.OS !== 'android') return 'unavailable';

  const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
  try {
    if (api >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const scan = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN];
      const connect = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
      if (
        scan === PermissionsAndroid.RESULTS.GRANTED &&
        connect === PermissionsAndroid.RESULTS.GRANTED
      ) {
        return 'granted';
      }
      if (
        scan === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        connect === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        return 'blocked';
      }
      return 'denied';
    }

    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (fine === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

export function openSystemSettings(): void {
  void Linking.openSettings();
}

export const printerService = {
  isNativeAvailable: isNativeDriverAvailable,

  scanDevices: async (): Promise<PrinterScanDevice[]> => {
    const perm = await ensureBluetoothPermissions();
    if (perm === 'blocked' || perm === 'denied') {
      const err = new Error(
        perm === 'blocked'
          ? 'Izin Bluetooth diblokir. Buka Pengaturan untuk mengaktifkannya.'
          : 'Izin Bluetooth ditolak. Izinkan akses Bluetooth untuk memindai printer.'
      );
      (err as Error & { permissionState?: BluetoothPermissionState }).permissionState = perm;
      throw err;
    }
    if (perm === 'unsupported' || perm === 'unavailable') {
      throw new Error('Bluetooth tidak tersedia di perangkat ini.');
    }

    const { default: ThermalPrinter } = await loadDriver();
    const { paired, found } = await ThermalPrinter.scan();
    const map = new Map<string, PrinterScanDevice>();
    for (const d of [...paired, ...found]) {
      const connectAddress = toConnectAddress(d.address, d.deviceType);
      map.set(connectAddress, { ...d, connectAddress });
    }
    return [...map.values()];
  },

  stopScan: async (): Promise<void> => {
    if (!isNativeDriverAvailable()) return;
    const { default: ThermalPrinter } = await loadDriver();
    await ThermalPrinter.stopScan();
  },

  connectAndSave: async (device: PrinterScanDevice): Promise<SavedPrinter> => {
    const perm = await ensureBluetoothPermissions();
    if (perm !== 'granted' && Platform.OS === 'android') {
      throw new Error('Izin Bluetooth diperlukan untuk menghubungkan printer.');
    }
    const { default: ThermalPrinter } = await loadDriver();
    await ThermalPrinter.connect(device.connectAddress, { timeout: 15000 });
    const saved: SavedPrinter = {
      name: device.name || 'Printer',
      address: device.connectAddress,
      deviceType: device.deviceType,
    };
    await receiptSettingsService.setDefaultPrinter(saved);
    return saved;
  },

  isDefaultConnected: async (): Promise<boolean> => {
    const prefs = await receiptSettingsService.getPrinterPreferences();
    if (!prefs.printer?.address || !isNativeDriverAvailable()) return false;
    try {
      const { default: ThermalPrinter } = await loadDriver();
      return await ThermalPrinter.isConnected(prefs.printer.address);
    } catch {
      return false;
    }
  },

  ensureConnected: async (address: string): Promise<void> => {
    const { default: ThermalPrinter } = await loadDriver();
    const ok = await ThermalPrinter.isConnected(address);
    if (!ok) {
      await ThermalPrinter.connect(address, { timeout: 15000 });
    }
  },

  printLines: async (
    address: string,
    lines: ReceiptLine[],
    paperWidthMm: PaperWidthMm
  ): Promise<void> => {
    const driver = await loadDriver();
    const { default: ThermalPrinter, text, feed, cut } = driver;
    await printerService.ensureConnected(address);

    const nodes = [];
    for (const row of lines) {
      nodes.push(
        text(row.text, {
          align: row.align ?? 'left',
          bold: row.bold,
          size: row.size ?? 1,
        })
      );
    }
    nodes.push(feed(2));
    nodes.push(cut());

    const result = await ThermalPrinter.print(address, nodes, {
      paperWidthMm,
      keepAlive: true,
      timeout: 20000,
    });
    if (!result.success) {
      throw new Error(result.error?.message || 'Gagal mencetak ke printer.');
    }
  },

  /**
   * Print using current local store profile + template + paper width.
   * Never logs deliverable / voucher codes.
   */
  printReceiptDocument: async (
    partial: Omit<ReceiptPrintContext, 'store' | 'template' | 'paperWidthMm'> & {
      store?: ReceiptPrintContext['store'];
      template?: ReceiptPrintContext['template'];
      paperWidthMm?: PaperWidthMm;
    }
  ): Promise<void> => {
    const prefs = await receiptSettingsService.getPrinterPreferences();
    if (!prefs.printer?.address) {
      const err = new Error('Belum ada printer default. Hubungkan printer terlebih dahulu.');
      (err as Error & { code?: string }).code = 'NO_PRINTER';
      throw err;
    }
    const store = partial.store ?? (await receiptSettingsService.getStoreProfile());
    const template =
      partial.template ?? (await receiptSettingsService.getReceiptTemplate());
    const paperWidthMm = partial.paperWidthMm ?? prefs.paperWidthMm;
    const lines = buildReceiptLines({
      receipt: partial.receipt,
      store,
      template,
      userName: partial.userName,
      paperWidthMm,
      sample: partial.sample,
    });
    await printerService.printLines(prefs.printer.address, lines, paperWidthMm);
  },

  printTestReceipt: async (userName?: string | null): Promise<void> => {
    await printerService.printReceiptDocument({
      receipt: null,
      userName,
      sample: true,
    });
  },

  printTransactionReceipt: async (
    receipt: ReceiptData,
    userName?: string | null
  ): Promise<void> => {
    await printerService.printReceiptDocument({
      receipt,
      userName,
      sample: false,
    });
  },
};
