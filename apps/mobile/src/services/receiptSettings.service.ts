import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storageService } from './storage.service';
import { useAuthStore } from '../store/auth.store';
import {
  RECEIPT_LEGACY_CONSUMED_FLAG_KEY,
  canOfferLegacyMigration,
  parseReceiptSettingsJson,
  receiptLegacyStorageKey,
  receiptSettingsStorageKey,
  scopedRawHasPriority,
  type ReceiptSettingsKind,
} from './receiptSettingsKeys';
import {
  buildScopedPayloadFromLegacy,
  extractLegacyTemplateNote,
} from './receiptSettings.migration';

export {
  RECEIPT_SETTINGS_KEY_PREFIX,
  RECEIPT_LEGACY_STORAGE_KEYS,
  RECEIPT_LEGACY_CONSUMED_FLAG_KEY,
  receiptSettingsStorageKey,
  receiptLegacyStorageKey,
  sanitizeReceiptSettingsUserId,
  parseReceiptSettingsJson,
  scopedRawHasPriority,
  canOfferLegacyMigration,
  type ReceiptSettingsKind,
} from './receiptSettingsKeys';

export { buildScopedPayloadFromLegacy, extractLegacyTemplateNote } from './receiptSettings.migration';

/**
 * Local-only receipt print settings (Profil Toko, Template Struk, printer default).
 * Scoped per authenticated user id — no backend / no multi-device sync.
 *
 * IMPORTANT: SecureStore keys must be [A-Za-z0-9._-] only. Using ":" caused silent
 * write failures → empty profile → receipt fell back to account name.
 *
 * Legacy global keys (gurkypay_*) are migrated once into scoped gurkynet_*_{userId}
 * for the active user, then marked consumed so another account on the same device
 * cannot inherit that blob.
 */

export type PaperWidthMm = 58 | 80;

export type StoreProfile = {
  storeName: string;
  address: string;
  whatsapp: string;
  /** Footer message on receipt; visibility controlled by template field `note`. */
  closingMessage: string;
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
  /**
   * @deprecated Closing text lives on StoreProfile.closingMessage.
   * Kept empty for backward-compatible JSON shape only.
   */
  note?: string;
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
  };
}

export function createEmptyStoreProfile(): StoreProfile {
  return { storeName: '', address: '', whatsapp: '', closingMessage: '' };
}

export function createDefaultPrinterPreferences(): PrinterPreferences {
  return { paperWidthMm: 58, printer: null };
}

/**
 * Active user id: persisted storage first, then in-memory auth store.
 * Survives restart; switches when another user logs in.
 */
export async function resolveActiveReceiptUserId(): Promise<string | null> {
  const persisted = await storageService.getUser();
  const fromPersist = persisted?.id != null ? String(persisted.id).trim() : '';
  if (fromPersist) return fromPersist;
  const fromAuth = useAuthStore.getState().user?.id;
  const id = fromAuth != null ? String(fromAuth).trim() : '';
  return id || null;
}

async function safeGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return true;
    }
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch {
    return false;
  }
}

function normalizeTemplate(raw: unknown): ReceiptTemplate {
  const fallback = createDefaultReceiptTemplate();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as { fields?: unknown };
  if (!Array.isArray(obj.fields)) return fallback;

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
  // Do not persist template.note — closing text lives on StoreProfile.
  return { fields };
}

function normalizeStoreProfile(raw: unknown): StoreProfile {
  const empty = createEmptyStoreProfile();
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;
  return {
    storeName: typeof obj.storeName === 'string' ? obj.storeName : '',
    address: typeof obj.address === 'string' ? obj.address : '',
    whatsapp: typeof obj.whatsapp === 'string' ? obj.whatsapp : '',
    closingMessage:
      typeof obj.closingMessage === 'string'
        ? obj.closingMessage
        : typeof obj.note === 'string'
          ? obj.note
          : '',
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

/**
 * One-time: copy empty scoped slots from legacy global keys for the active user,
 * then mark legacy as consumed so another account cannot inherit the same blob.
 * Legacy key values are left in place (not deleted).
 * Do not mark consumed if any SecureStore write fails — retry on next read.
 */
async function ensureLegacyMigratedForActiveUser(): Promise<void> {
  const userId = await resolveActiveReceiptUserId();
  if (!userId) return;

  const consumed = await safeGet(RECEIPT_LEGACY_CONSUMED_FLAG_KEY);
  if (!canOfferLegacyMigration(consumed)) return;

  const kinds: ReceiptSettingsKind[] = ['store', 'template', 'printer'];
  for (const kind of kinds) {
    const scopedKey = receiptSettingsStorageKey(kind, userId);
    const scopedRaw = await safeGet(scopedKey);
    if (scopedRawHasPriority(scopedRaw)) continue;

    const legacyRaw = await safeGet(receiptLegacyStorageKey(kind));
    const parsed = parseReceiptSettingsJson(legacyRaw);
    if (parsed == null) continue;

    const payload = buildScopedPayloadFromLegacy(kind, parsed);
    if (payload == null) continue;

    // Promote legacy template.note → store.closingMessage before stripping note.
    if (kind === 'template') {
      const note = extractLegacyTemplateNote(parsed);
      if (note) {
        const storeKey = receiptSettingsStorageKey('store', userId);
        const storeRaw = await safeGet(storeKey);
        const storeParsed = parseReceiptSettingsJson(storeRaw);
        const storeProfile = storeParsed
          ? normalizeStoreProfile(storeParsed)
          : createEmptyStoreProfile();
        if (!storeProfile.closingMessage.trim()) {
          const noteOk = await safeSet(
            storeKey,
            JSON.stringify({
              storeName: storeProfile.storeName,
              address: storeProfile.address,
              whatsapp: storeProfile.whatsapp,
              closingMessage: note,
            })
          );
          if (!noteOk) return;
        }
      }
    }

    const scopedOk = await safeSet(scopedKey, JSON.stringify(payload));
    if (!scopedOk) return;
  }

  // Mark consumed even when nothing copied (malformed/empty legacy) so User B
  // never re-applies the same global blob after User A already "claimed" the pass.
  // Only reached when every attempted scoped write succeeded (or none were needed).
  await safeSet(RECEIPT_LEGACY_CONSUMED_FLAG_KEY, '1');
}

async function readScopedJson(kind: ReceiptSettingsKind): Promise<unknown | null> {
  await ensureLegacyMigratedForActiveUser();

  const userId = await resolveActiveReceiptUserId();
  if (!userId) return null;
  const raw = await safeGet(receiptSettingsStorageKey(kind, userId));
  if (!raw) return null;
  return parseReceiptSettingsJson(raw);
}

async function writeScopedJson(kind: ReceiptSettingsKind, value: unknown): Promise<void> {
  const userId = await resolveActiveReceiptUserId();
  if (!userId) {
    throw new Error('Sesi login tidak ditemukan. Masuk kembali lalu simpan ulang.');
  }
  const key = receiptSettingsStorageKey(kind, userId);
  const ok = await safeSet(key, JSON.stringify(value));
  if (!ok) {
    throw new Error('Gagal menyimpan ke penyimpanan aman perangkat.');
  }
}

export const receiptSettingsService = {
  getStoreProfile: async (): Promise<StoreProfile> => {
    const parsed = await readScopedJson('store');
    const profile = parsed ? normalizeStoreProfile(parsed) : createEmptyStoreProfile();
    // One-time migrate legacy template.note → store.closingMessage (Profil Toko).
    if (!profile.closingMessage.trim()) {
      const tplRaw = await readScopedJson('template');
      const legacyNote =
        tplRaw && typeof tplRaw === 'object'
          ? (tplRaw as { note?: unknown }).note
          : undefined;
      if (typeof legacyNote === 'string' && legacyNote.trim()) {
        const migrated = { ...profile, closingMessage: legacyNote.trim() };
        try {
          await writeScopedJson('store', {
            storeName: migrated.storeName,
            address: migrated.address,
            whatsapp: migrated.whatsapp,
            closingMessage: migrated.closingMessage,
          });
          // Strip text from template so there is a single source of truth.
          await writeScopedJson('template', normalizeTemplate(tplRaw));
        } catch {
          // Still return migrated for this session if write fails.
        }
        return migrated;
      }
    }
    return profile;
  },

  setStoreProfile: async (profile: StoreProfile): Promise<void> => {
    const payload = {
      storeName: profile.storeName.trim(),
      address: profile.address.trim(),
      whatsapp: profile.whatsapp.trim(),
      closingMessage: profile.closingMessage.trim(),
    };
    await writeScopedJson('store', payload);
    // Read-back so UI cannot claim success when storage silently failed.
    const saved = await receiptSettingsService.getStoreProfile();
    if (
      saved.storeName !== payload.storeName ||
      saved.address !== payload.address ||
      saved.whatsapp !== payload.whatsapp ||
      saved.closingMessage !== payload.closingMessage
    ) {
      throw new Error('Profil toko gagal diverifikasi setelah disimpan. Coba lagi.');
    }
  },

  getReceiptTemplate: async (): Promise<ReceiptTemplate> => {
    const parsed = await readScopedJson('template');
    if (!parsed) return createDefaultReceiptTemplate();
    return normalizeTemplate(parsed);
  },

  setReceiptTemplate: async (template: ReceiptTemplate): Promise<void> => {
    await writeScopedJson('template', normalizeTemplate(template));
  },

  resetReceiptTemplate: async (): Promise<ReceiptTemplate> => {
    const def = createDefaultReceiptTemplate();
    await writeScopedJson('template', def);
    return def;
  },

  getPrinterPreferences: async (): Promise<PrinterPreferences> => {
    const parsed = await readScopedJson('printer');
    if (!parsed) return createDefaultPrinterPreferences();
    return normalizePrinterPreferences(parsed);
  },

  setPrinterPreferences: async (prefs: PrinterPreferences): Promise<void> => {
    await writeScopedJson('printer', normalizePrinterPreferences(prefs));
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
