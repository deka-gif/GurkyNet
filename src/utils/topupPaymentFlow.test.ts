import assert from 'node:assert/strict';
import {
  MIN_TOPUP_AMOUNT,
  TOPUP_QUICK_AMOUNTS,
  enabledBanks,
  enabledMethods,
  enabledOutlets,
  extractMidtransPaymentDetails,
  isMethodEnabled,
  isTopUpAmountValid,
  mapTopUpError,
  methodRequiresBank,
  methodRequiresRetailOutlet,
  type TopUpPaymentConfig,
} from './topupPaymentFlow.ts';

assert.equal(MIN_TOPUP_AMOUNT, 10000);
assert.ok(TOPUP_QUICK_AMOUNTS.every((n) => n >= 10000));
assert.ok(TOPUP_QUICK_AMOUNTS.includes(10000));
assert.equal(isTopUpAmountValid(10000), true);
assert.equal(isTopUpAmountValid(50000), true);
assert.equal(isTopUpAmountValid(9999), false);
assert.equal(isTopUpAmountValid(10000.5), false);
assert.equal(isTopUpAmountValid(-1), false);

assert.equal(methodRequiresBank('va'), true);
assert.equal(methodRequiresBank('qris'), false);
assert.equal(methodRequiresRetailOutlet('retail'), true);
assert.equal(methodRequiresRetailOutlet('qris'), false);

const config: TopUpPaymentConfig = {
  configured: true,
  min_amount: 10000,
  methods: [
    { id: 'qris', label: 'QRIS', enabled: true },
    {
      id: 'va',
      label: 'Virtual Account',
      enabled: true,
      banks: [
        { code: 'bca_va', label: 'BCA', enabled: true },
        { code: 'permata_va', label: 'Permata', enabled: false },
      ],
    },
    {
      id: 'retail',
      label: 'Alfa/Indomaret',
      enabled: false,
      outlets: [{ code: 'alfamart', label: 'Alfamart', enabled: false }],
    },
  ],
};

assert.equal(isMethodEnabled(config, 'qris'), true);
assert.equal(isMethodEnabled(config, 'va'), true);
assert.equal(isMethodEnabled(config, 'retail'), false);
assert.deepEqual(enabledBanks(config).map((b) => b.code), ['bca_va']);
assert.deepEqual(enabledOutlets(config), []);
assert.ok(enabledMethods(config).every((m) => m.enabled));

const snapVa = extractMidtransPaymentDetails({
  order_id: 'TRX-1',
  payment_type: 'bank_transfer',
  va_numbers: [{ bank: 'bca', va_number: '1234567890' }],
  expiry_time: '2026-08-29 12:00:00',
});
assert.equal(snapVa.va_number, '1234567890');
assert.equal(snapVa.order_id, 'TRX-1');
assert.equal(snapVa.expiry_time, '2026-08-29 12:00:00');

const empty = extractMidtransPaymentDetails({ token: 'snap' });
assert.equal(empty.va_number, undefined);
assert.equal(empty.payment_code, undefined);

const retail = extractMidtransPaymentDetails({
  payment_code: '88123456',
  store: 'alfamart',
  expiry_time: '2026-08-29 12:00:00',
});
assert.equal(retail.payment_code, '88123456');
assert.equal(retail.store, 'alfamart');

assert.equal(
  mapTopUpError({ code: 'TOPUP_AMOUNT_TOO_SMALL', message: 'Nominal top up minimal Rp 10.000.' }),
  'Nominal top up minimal Rp 10.000.'
);
assert.ok(mapTopUpError({ code: 'TOPUP_CHANNEL_UNAVAILABLE' }).includes('tidak tersedia'));
assert.ok(mapTopUpError({ message: 'Terjadi kesalahan saat memproses permintaan top up.' }).includes('Silakan coba lagi'));
assert.ok(mapTopUpError({ message: 'Pilih bank Virtual Account terlebih dahulu.' }).includes('bank'));
