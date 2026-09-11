/**
 * Unit tests — receipt settings SecureStore-safe keys + legacy→scoped migration helpers.
 * Run: npx --yes tsx src/services/receiptSettings.scoping.test.ts
 */
import assert from 'node:assert/strict';
import {
  RECEIPT_SETTINGS_KEY_PREFIX,
  RECEIPT_LEGACY_STORAGE_KEYS,
  RECEIPT_LEGACY_CONSUMED_FLAG_KEY,
  receiptSettingsStorageKey,
  receiptLegacyStorageKey,
  sanitizeReceiptSettingsUserId,
  parseReceiptSettingsJson,
  scopedRawHasPriority,
  canOfferLegacyMigration,
} from './receiptSettingsKeys';
import {
  buildScopedPayloadFromLegacy,
  extractLegacyTemplateNote,
} from './receiptSettings.migration';
import {
  buildReceiptLines,
  padRow,
  resolveStoreName,
} from '../utils/receiptPrint';

// Pure helpers only — do not import receiptSettings.service (SecureStore / RN).

type ReceiptTemplate = {
  fields: Array<{ id: string; visible: boolean; locked: boolean }>;
  note?: string;
};

function defaultTemplate(): ReceiptTemplate {
  const order = [
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
  const locked = new Set(['invoice', 'date', 'status', 'total_payment']);
  return {
    fields: order.map((id) => ({
      id,
      visible: true,
      locked: locked.has(id),
    })),
  };
}

// --- Key scoping (no colon — SecureStore charset) ---
const keyA = receiptSettingsStorageKey('store', 'user-A');
const keyB = receiptSettingsStorageKey('store', 'user-B');
assert.equal(keyA, `${RECEIPT_SETTINGS_KEY_PREFIX.store}_user-A`);
assert.equal(keyB, `${RECEIPT_SETTINGS_KEY_PREFIX.store}_user-B`);
assert.notEqual(keyA, keyB);
assert.ok(!keyA.includes(':'));
assert.ok(!keyB.includes(':'));

assert.equal(
  receiptSettingsStorageKey('template', 'user-A'),
  `${RECEIPT_SETTINGS_KEY_PREFIX.template}_user-A`
);
assert.equal(
  receiptSettingsStorageKey('printer', 'user-A'),
  `${RECEIPT_SETTINGS_KEY_PREFIX.printer}_user-A`
);

assert.throws(() => receiptSettingsStorageKey('store', ''), /non-empty userId/);
assert.equal(sanitizeReceiptSettingsUserId('ab:cd/ef'), 'ab_cd_ef');

const uuidKey = receiptSettingsStorageKey('store', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
assert.match(uuidKey, /^gurkynet_store_profile_v1_a1b2c3d4-e5f6-7890-abcd-ef1234567890$/);

// --- Legacy key constants (HEAD-compatible) ---
assert.equal(RECEIPT_LEGACY_STORAGE_KEYS.store, 'gurkypay_store_profile_v1');
assert.equal(RECEIPT_LEGACY_STORAGE_KEYS.template, 'gurkypay_receipt_template_v1');
assert.equal(RECEIPT_LEGACY_STORAGE_KEYS.printer, 'gurkypay_printer_pref_v1');
assert.equal(receiptLegacyStorageKey('store'), 'gurkypay_store_profile_v1');
assert.equal(RECEIPT_LEGACY_CONSUMED_FLAG_KEY, 'gurkynet_receipt_legacy_consumed_v1');

// A. scoped data present → scoped wins (do not offer legacy)
assert.equal(scopedRawHasPriority('{"storeName":"Toko A"}'), true);
assert.equal(scopedRawHasPriority(null), false);
assert.equal(scopedRawHasPriority(''), false);
assert.equal(scopedRawHasPriority('   '), false);

// B. scoped empty + legacy available → migration allowed until consumed
assert.equal(canOfferLegacyMigration(null), true);
assert.equal(canOfferLegacyMigration(''), true);
assert.equal(canOfferLegacyMigration('0'), true);
assert.equal(canOfferLegacyMigration('1'), false);

// C. after migration write, next read prefers scoped (priority) and legacy not re-offered
{
  const afterMigrateRaw = JSON.stringify({ storeName: 'Migrated Toko' });
  assert.equal(scopedRawHasPriority(afterMigrateRaw), true);
  assert.equal(canOfferLegacyMigration('1'), false);
}

// B/C. legacy payload → scoped payload
const legacyStore = {
  storeName: ' Warung Sari ',
  address: 'Jl. 1',
  whatsapp: '0812',
  note: 'Terima kasih',
};
const migratedStore = buildScopedPayloadFromLegacy('store', legacyStore) as {
  storeName: string;
  closingMessage: string;
};
assert.equal(migratedStore.storeName, ' Warung Sari ');
assert.equal(migratedStore.closingMessage, 'Terima kasih');

const legacyTpl = {
  fields: [
    { id: 'store_name', visible: true },
    { id: 'invoice', visible: true },
    { id: 'note', visible: false },
  ],
  note: 'Catatan lama',
};
const migratedTpl = buildScopedPayloadFromLegacy('template', legacyTpl) as ReceiptTemplate;
assert.ok(Array.isArray(migratedTpl.fields));
assert.equal((migratedTpl as { note?: string }).note, undefined);
assert.equal(migratedTpl.fields.find((f) => f.id === 'note')?.visible, false);

const legacyPrinter = { paperWidthMm: 80, printer: null };
const migratedPrinter = buildScopedPayloadFromLegacy('printer', legacyPrinter) as {
  paperWidthMm: number;
};
assert.equal(migratedPrinter.paperWidthMm, 80);

// D. user B cannot share user A scoped key
assert.notEqual(
  receiptSettingsStorageKey('store', '111'),
  receiptSettingsStorageKey('store', '222')
);

// E. malformed legacy → null / no throw
assert.equal(parseReceiptSettingsJson('{not-json'), null);
assert.equal(parseReceiptSettingsJson(null), null);
assert.equal(buildScopedPayloadFromLegacy('store', null), null);
assert.equal(buildScopedPayloadFromLegacy('store', 'x'), null);
assert.equal(buildScopedPayloadFromLegacy('template', { note: 'only' }), null);
assert.equal(buildScopedPayloadFromLegacy('template', { fields: 'bad' }), null);

// F. template note → closingMessage (store normalize + extract helpers)
const fromNoteOnly = buildScopedPayloadFromLegacy('store', {
  storeName: '',
  address: '',
  whatsapp: '',
  note: '  Halo pelanggan  ',
}) as { closingMessage: string };
assert.equal(fromNoteOnly.closingMessage, '  Halo pelanggan  ');
assert.equal(extractLegacyTemplateNote(legacyTpl), 'Catatan lama');
assert.equal(extractLegacyTemplateNote({ fields: [] }), null);
assert.equal(extractLegacyTemplateNote({ note: '   ' }), null);

assert.equal(resolveStoreName({ storeName: 'Budi Cell', address: '', whatsapp: '', closingMessage: '' }), 'Budi Cell');
assert.equal(resolveStoreName({ storeName: '', address: '', whatsapp: '', closingMessage: '' }, 'Andi'), 'Andi');
assert.equal(resolveStoreName({ storeName: '', address: '', whatsapp: '', closingMessage: '' }), 'GurkyNet');
assert.notEqual(resolveStoreName({ storeName: '', address: '', whatsapp: '', closingMessage: '' }), 'GurkyPay');

const receipt = {
  header: {
    company_name: 'GurkyNet',
    tagline: null,
    address: null,
    support_phone: null,
    support_email: null,
  },
  transaction_details: {
    invoice_number: 'GRK-1',
    date: '2026-01-01T00:00:00.000Z',
    status: 'success',
    service_name: 'Pulsa',
    target_number: '0812',
    payment_method: 'SALDO',
    serial_number: null,
    voucher_code: null,
    voucher_url: null,
    voucher_internet_code: null,
    voucher_internet_url: null,
    activation_code: null,
    activation_url: null,
    provider_ref: null,
  },
  items: [{ sku_code: 'X', name: 'Pulsa 10rb', price: 10000, quantity: 1, total: 10000 }],
  payment_summary: { subtotal: 10000, denda: 0, admin_fee: 0, total_payment: 10000 },
  footer: { note: '' },
};

const lines = buildReceiptLines({
  receipt: receipt as any,
  store: {
    storeName: 'BUDI CELL',
    address: 'Jl. Merdeka 10',
    whatsapp: '08123456789',
    closingMessage: 'Terima kasih sudah berbelanja.',
  },
  template: defaultTemplate(),
  userName: 'DECHA PRIO',
  paperWidthMm: 58,
  sample: false,
});

const joined = lines.map((l) => l.text).join('\n');
assert.ok(joined.includes('BUDI CELL'), 'store profile name must appear');
assert.ok(joined.includes('Jl. Merdeka 10'), 'address must appear');
assert.ok(joined.includes('08123456789'), 'whatsapp must appear');
assert.ok(joined.includes('Terima kasih sudah berbelanja.'), 'closing message from store');
assert.ok(!joined.includes('DECHA PRIO'), 'must not fall back to account name when store set');

const hiddenNote = buildReceiptLines({
  receipt: receipt as any,
  store: {
    storeName: 'BUDI CELL',
    address: '',
    whatsapp: '',
    closingMessage: 'Terima kasih sudah berbelanja.',
  },
  template: {
    fields: defaultTemplate().fields.map((f) =>
      f.id === 'note' ? { ...f, visible: false } : f
    ),
  },
  userName: 'DECHA PRIO',
  paperWidthMm: 58,
  sample: false,
});
assert.ok(
  !hiddenNote.map((l) => l.text).join('\n').includes('Terima kasih sudah berbelanja.'),
  'note visibility OFF must hide closing message'
);
const width = 32;
for (const line of lines) {
  if (line.kind === 'rule') {
    assert.equal(line.text.length, width);
  }
}

assert.equal(padRow('TOTAL', 'Rp10.000', 32).length, 32);

console.log('receiptSettings.scoping.test.ts: ALL PASS');
