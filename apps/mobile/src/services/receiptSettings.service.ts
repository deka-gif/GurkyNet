import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Local-only receipt print settings (Profil Toko, Template Struk, printer default).
 * No backend / no multi-device sync — Owner-approved for printer v1.
 */

const STORE_PROFILE_KEY = 'gurkypay_store_profile_v1';
const RECEIPT_TEMPLATE_KEY = 'gurkypay_receipt_template_v1';
const PRINTER_PREF_KEY = 'gurkypay_printer_pref_v1';

export type PaperWidthMm = 58 | 80;

export type StoreProfile = {
  storeName: string;
  address: string;
  whatsapp: string;
};

export type ReceiptFieldId =
  | 'store_name'
  | 'store_address'
  | 'store_whatsapp'
  | 'invoice'
  | 'date'
  | 'status'
  | 'product_name'
  | 'target_number'
  | 'payment_method'
  | 'subtotal'
  | 'admin_fee'
  | 'denda'
  | 'deliverable'
  | 'provider_ref'
  | 'total_payment'
  | 'note';

export type ReceiptFieldConfig = {
  id: ReceiptFieldId;
  visible: boolean;
  /** Locked fields cannot be hidden (toggle always on). */
  locked: boolean;
};

export type ReceiptTemplate = {
  fields: ReceiptFieldConfig[];
  note: string;
};

export type SavedPrinter = {
  name: string;
  /** Transport address with scheme, e.g. bt:AA:BB:… or ble:… */
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
};

export type PrinterPreferences = {
  paperWidthMm: PaperWidthMm;
  printer: SavedPrinter | null;
};

export const RECEIPT_FIELD_LABELS: Record<ReceiptFieldId, string> = {
  store_name: 'Nama toko',
  store_address: 'Alamat toko',
  store_whatsapp: 'WhatsApp toko',
  invoice: 'No. referensi / invoice',
  date: 'Tanggal / waktu',
  status: 'Status transaksi',
  product_name: 'Nama produk / layanan',
  target_number: 'Nomor tujuan',
  payment_method: 'Metode pembayaran',
  subtotal: 'Subtotal',
  admin_fee: 'Biaya admin',
  denda: 'Denda',
  deliverable: 'SN / kode voucher / token',
  provider_ref: 'Referensi provider',
  total_payment: 'Nominal / total bayar',
  note: 'Catatan tambahan',
};

export const LOCKED_RECEIPT_FIELD_IDS: ReceiptFieldId[] = [
  'invoice',
  'date',
  'status',
  'total_payment',
];

export function createDefaultReceiptTemplate(): ReceiptTemplate {
  const order: ReceiptFieldId[] = [
    'store_name',
    'store_address',
    'store_whatsapp',
    'invoice',
    'date',
    'status',
    'product_name',
    'target_number',
    'payment_method',
    'subtotal',
    'admin_fee',
    'denda',
    'deliverable',
    'provider_ref',
    'total_payment',
    'note',
  ];
  return {
    fields: order.map((id) => ({
      id,
      visible: true,
      locked: LOCKED_RECEIPT_FIELD_IDS.includes(id),
    })),
    note: 'Terima kasih. Simpan struk ini sebagai bukti transaksi.',
  };
}

export function createEmptyStoreProfile(): StoreProfile {
  return { storeName: '', address: '', whatsapp: '' };
}

export function createDefaultPrinterPreferences(): PrinterPreferences {
  return { paperWidthMm: 58, printer: null };
}

async function safeGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

function normalizeTemplate(raw: unknown): ReceiptTemplate {
  const fallback = createDefaultReceiptTemplate();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as { fields?: unknown; note?: unknown };
  const note = typeof obj.note === 'string' ? obj.note : fallback.note;
  if (!Array.isArray(obj.fields)) return { ...fallback, note };

  const seen = new Set<ReceiptFieldId>();
  const fields: ReceiptFieldConfig[] = [];
  for (const item of obj.fields) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string' || !(id in RECEIPT_FIELD_LABELS)) continue;
    const fieldId = id as ReceiptFieldId;
    if (seen.has(fieldId)) continue;
    seen.add(fieldId);
    const locked = LOCKED_RECEIPT_FIELD_IDS.includes(fieldId);
    const visibleRaw = Boolean((item as { visible?: unknown }).visible);
    fields.push({
      id: fieldId,
      locked,
      visible: locked ? true : visibleRaw,
    });
  }
  for (const def of fallback.fields) {
    if (!seen.has(def.id)) fields.push(def);
  }
  return { fields, note };
}

function normalizeStoreProfile(raw: unknown): StoreProfile {
  const empty = createEmptyStoreProfile();
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;
  return {
    storeName: typeof obj.storeName === 'string' ? obj.storeName : '',
    address: typeof obj.address === 'string' ? obj.address : '',
    whatsapp: typeof obj.whatsapp === 'string' ? obj.whatsapp : '',
  };
}

function normalizePrinterPreferences(raw: unknown): PrinterPreferences {
  const fallback = createDefaultPrinterPreferences();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const width = obj.paperWidthMm === 80 ? 80 : 58;
  let printer: SavedPrinter | null = null;
  const p = obj.printer;
  if (p && typeof p === 'object') {
    const pr = p as Record<string, unknown>;
    if (typeof pr.name === 'string' && typeof pr.address === 'string' && pr.address) {
      const deviceType =
        pr.deviceType === 'bt' ||
        pr.deviceType === 'ble' ||
        pr.deviceType === 'dual' ||
        pr.deviceType === 'unknown'
          ? pr.deviceType
          : 'unknown';
      printer = { name: pr.name, address: pr.address, deviceType };
    }
  }
  return { paperWidthMm: width, printer };
}

export const receiptSettingsService = {
  getStoreProfile: async (): Promise<StoreProfile> => {
    const raw = await safeGet(STORE_PROFILE_KEY);
    if (!raw) return createEmptyStoreProfile();
    try {
      return normalizeStoreProfile(JSON.parse(raw));
    } catch {
      return createEmptyStoreProfile();
    }
  },

  setStoreProfile: async (profile: StoreProfile): Promise<void> => {
    await safeSet(
      STORE_PROFILE_KEY,
      JSON.stringify({
        storeName: profile.storeName.trim(),
        address: profile.address.trim(),
        whatsapp: profile.whatsapp.trim(),
      })
    );
  },

  getReceiptTemplate: async (): Promise<ReceiptTemplate> => {
    const raw = await safeGet(RECEIPT_TEMPLATE_KEY);
    if (!raw) return createDefaultReceiptTemplate();
    try {
      return normalizeTemplate(JSON.parse(raw));
    } catch {
      return createDefaultReceiptTemplate();
    }
  },

  setReceiptTemplate: async (template: ReceiptTemplate): Promise<void> => {
    const normalized = normalizeTemplate(template);
    await safeSet(RECEIPT_TEMPLATE_KEY, JSON.stringify(normalized));
  },

  resetReceiptTemplate: async (): Promise<ReceiptTemplate> => {
    const def = createDefaultReceiptTemplate();
    await safeSet(RECEIPT_TEMPLATE_KEY, JSON.stringify(def));
    return def;
  },

  getPrinterPreferences: async (): Promise<PrinterPreferences> => {
    const raw = await safeGet(PRINTER_PREF_KEY);
    if (!raw) return createDefaultPrinterPreferences();
    try {
      return normalizePrinterPreferences(JSON.parse(raw));
    } catch {
      return createDefaultPrinterPreferences();
    }
  },

  setPrinterPreferences: async (prefs: PrinterPreferences): Promise<void> => {
    await safeSet(PRINTER_PREF_KEY, JSON.stringify(normalizePrinterPreferences(prefs)));
  },

  setPaperWidth: async (paperWidthMm: PaperWidthMm): Promise<void> => {
    const current = await receiptSettingsService.getPrinterPreferences();
    await receiptSettingsService.setPrinterPreferences({ ...current, paperWidthMm });
  },

  setDefaultPrinter: async (printer: SavedPrinter | null): Promise<void> => {
    const current = await receiptSettingsService.getPrinterPreferences();
    await receiptSettingsService.setPrinterPreferences({ ...current, printer });
  },
};
