import type { ReceiptData } from '../services/transaction.service';
import { resolveReceiptDeliverables } from './receiptDeliverable';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sample(overrides: Partial<ReceiptData['transaction_details']> = {}): ReceiptData {
  return {
    header: {
      company_name: 'GurkyNet',
      tagline: null,
      address: null,
      support_phone: null,
      support_email: null,
    },
    transaction_details: {
      invoice_number: 'INV-1',
      date: new Date().toISOString(),
      status: 'success',
      service_name: 'Test',
      target_number: '081234567890',
      payment_method: 'SALDO',
      serial_number: null,
      voucher_code: null,
      voucher_url: null,
      voucher_internet_code: null,
      voucher_internet_url: null,
      activation_code: null,
      activation_url: null,
      ...overrides,
    },
    items: [{ sku_code: 'X', name: 'Test', price: 1, quantity: 1, total: 1 }],
    payment_summary: { subtotal: 1, denda: 0, admin_fee: 0, total_payment: 1 },
    footer: { note: '' },
  };
}

const pln = resolveReceiptDeliverables(
  sample({
    service_name: 'Token PLN',
    is_pln_token: true,
    token_code: '12345678901234567890',
    token_code_grouped: '1234-5678-9012-3456-7890',
    serial_number: 'TOKEN:12345678901234567890',
  })
);
assert(pln.length === 1, 'PLN should surface one token deliverable');
assert(pln[0].label === 'Kode Token', 'PLN label');
assert(pln[0].copyValue === '12345678901234567890', 'PLN copy strips spaces from grouped display');

const vi = resolveReceiptDeliverables(
  sample({
    service_name: 'Voucher Internet Telkomsel',
    is_voucher_internet: true,
    voucher_internet_code: '76425500167062673',
    serial_number: '76425500167062673',
  }),
  { telkomselRedeemHint: true }
);
assert(vi.length === 1, 'VI code + same SN must not duplicate');
assert(vi[0].key === 'voucher_internet', 'VI prefers voucher_internet_code');
assert(!!vi[0].hint, 'Telkomsel hint present');

const snOnly = resolveReceiptDeliverables(
  sample({
    service_name: 'Voucher Internet Telkomsel',
    is_voucher_internet: true,
    serial_number: '76425500167062673',
  })
);
assert(snOnly.length === 1 && snOnly[0].key === 'serial_number', 'VI SN fallback');

const pulsa = resolveReceiptDeliverables(
  sample({
    service_name: 'Pulsa Telkomsel',
    serial_number: '04274400000640960094',
  })
);
assert(pulsa.length === 0, 'Pulsa operator SN is not a redeem deliverable');

console.log('receiptDeliverable.selftest OK');
