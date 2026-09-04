import assert from 'node:assert/strict';
import { customerFacingPaymentMethodLabel } from './paymentMethodLabel.ts';

assert.equal(customerFacingPaymentMethodLabel('midtrans'), 'Pembayaran');
assert.equal(customerFacingPaymentMethodLabel('QRIS'), 'QRIS');
assert.equal(customerFacingPaymentMethodLabel('qris'), 'QRIS');
assert.equal(customerFacingPaymentMethodLabel(null, 'Virtual Account BRI'), 'Virtual Account BRI');
assert.equal(customerFacingPaymentMethodLabel('bank_transfer'), 'Virtual Account');
assert.equal(customerFacingPaymentMethodLabel('gopay'), 'GoPay');
assert.equal(customerFacingPaymentMethodLabel('indomaret'), 'Indomaret');
assert.equal(customerFacingPaymentMethodLabel('bri_va'), 'Virtual Account BRI');
assert.equal(customerFacingPaymentMethodLabel('bca_va'), 'Virtual Account BCA');

console.log('paymentMethodLabel tests passed');
