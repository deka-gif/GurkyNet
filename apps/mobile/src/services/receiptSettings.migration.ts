/**
 * Pure legacy→scoped payload builders (no RN / SecureStore).
 */
import type { ReceiptSettingsKind } from './receiptSettingsKeys';

export type MigratedStoreProfile = {
  storeName: string;
  address: string;
  whatsapp: string;
  closingMessage: string;
};

export type MigratedReceiptField = {
  id: string;
  visible: boolean;
  locked: boolean;
};

const FIELD_IDS = new Set([
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
]);

const LOCKED = new Set(['invoice', 'date', 'status', 'total_payment']);

const DEFAULT_FIELD_ORDER = [
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
] as const;

function normalizeStoreProfile(raw: unknown): MigratedStoreProfile {
  const empty = { storeName: '', address: '', whatsapp: '', closingMessage: '' };
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

function normalizeTemplate(raw: unknown): { fields: MigratedReceiptField[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { fields?: unknown };
  if (!Array.isArray(obj.fields)) return null;

  const seen = new Set<string>();
  const fields: MigratedReceiptField[] = [];
  for (const item of obj.fields) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string' || !FIELD_IDS.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const locked = LOCKED.has(id);
    const visibleRaw = Boolean((item as { visible?: unknown }).visible);
    fields.push({
      id,
      locked,
      visible: locked ? true : visibleRaw,
    });
  }
  for (const id of DEFAULT_FIELD_ORDER) {
    if (!seen.has(id)) {
      fields.push({
        id,
        locked: LOCKED.has(id),
        visible: true,
      });
    }
  }
  return { fields };
}

function normalizePrinter(raw: unknown): { paperWidthMm: 58 | 80; printer: unknown } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const width = obj.paperWidthMm === 80 ? 80 : 58;
  let printer: unknown = null;
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
 * Persistable payload for a kind, or null if legacy blob is not valid to migrate.
 */
export function buildScopedPayloadFromLegacy(
  kind: ReceiptSettingsKind,
  parsed: unknown
): unknown | null {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  if (kind === 'store') {
    return normalizeStoreProfile(parsed);
  }
  if (kind === 'template') {
    return normalizeTemplate(parsed);
  }
  return normalizePrinter(parsed);
}

/** Extract legacy template.note for closingMessage promotion. */
export function extractLegacyTemplateNote(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const note = (parsed as { note?: unknown }).note;
  if (typeof note !== 'string' || !note.trim()) return null;
  return note.trim();
}
