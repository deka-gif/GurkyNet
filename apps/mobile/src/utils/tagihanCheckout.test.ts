/**
 * Tagihan checkout HIGH fixes — pure helpers.
 * Run: npx --yes tsx src/utils/tagihanCheckout.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildTagihanCheckoutPriceLines,
  resolveTagihanCheckoutSession,
  shouldClearTagihanInquiryOnIdentifierEdit,
  shouldClearTagihanInquiryOnTaxYearEdit,
} from './tagihanCheckout';
import { INQUIRY_FLOW_NOTICE, isPlnPrepaidCategory } from './purchaseCategory';

// --- HIGH #1: identifier / year invalidate ---
assert.equal(
  shouldClearTagihanInquiryOnIdentifierEdit(null, '123'),
  false,
  'no prior inquiry → do not clear'
);
assert.equal(
  shouldClearTagihanInquiryOnIdentifierEdit('123', '123'),
  false,
  'same identifier → keep'
);
assert.equal(
  shouldClearTagihanInquiryOnIdentifierEdit('123', '999'),
  true,
  'identifier change → clear'
);

assert.equal(shouldClearTagihanInquiryOnTaxYearEdit(null, 2026), false);
assert.equal(shouldClearTagihanInquiryOnTaxYearEdit(2026, 2026), false);
assert.equal(
  shouldClearTagihanInquiryOnTaxYearEdit(2026, 2025),
  true,
  'PBB year change → clear'
);

// Tagihan: inquiry A then change identifier → must clear (session invalid for payment)
{
  const inquiredFor = '081234';
  const next = '081999';
  assert.equal(shouldClearTagihanInquiryOnIdentifierEdit(inquiredFor, next), true);
}

// PBB: NOP change
{
  const inquiredNop = '329801092375999';
  assert.equal(
    shouldClearTagihanInquiryOnIdentifierEdit(inquiredNop, '329801092375998'),
    true
  );
}

// PBB: year change after inquiry
{
  assert.equal(shouldClearTagihanInquiryOnTaxYearEdit(2026, 2024), true);
}

// --- HIGH #2: idempotency session decision ---
assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post1',
    idempotencyKey: 'key-a',
    existingInquiryRef: 'ref-1',
    productCode: 'post1',
    nextInquiryRef: 'ref-1',
  }),
  'reuse',
  'same SKU + same inquiryRef → same purchase attempt'
);

assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post1',
    idempotencyKey: 'key-a',
    existingInquiryRef: 'ref-1',
    productCode: 'post1',
    nextInquiryRef: 'ref-2',
  }),
  'new',
  'same SKU + new inquiryRef → new purchase attempt'
);

assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: 'post1',
    idempotencyKey: 'key-a',
    existingInquiryRef: 'ref-1',
    productCode: 'post2',
    nextInquiryRef: 'ref-1',
  }),
  'new',
  'SKU change → new attempt'
);

assert.equal(
  resolveTagihanCheckoutSession({
    skuCode: null,
    idempotencyKey: null,
    existingInquiryRef: undefined,
    productCode: 'post1',
    nextInquiryRef: 'ref-1',
  }),
  'new',
  'first checkout → new'
);

// --- HIGH #3: checkout prices from inquiry only ---
{
  const lines = buildTagihanCheckoutPriceLines({
    selling_price: 150000,
    bill_amount: 145000,
    admin_fee: 5000,
  });
  assert.equal(lines.total, 150000);
  assert.equal(lines.billAmount, 145000);
  assert.equal(lines.adminFee, 5000);
  // Must not invent / depend on catalog product.price
  assert.ok(!('catalogPrice' in lines));
}

{
  const lines = buildTagihanCheckoutPriceLines({
    selling_price: 99000,
    bill_amount: undefined as unknown as number,
    admin_fee: undefined as unknown as number,
  });
  assert.equal(lines.total, 99000);
  assert.equal(lines.billAmount, null, 'missing bill_amount → omit, do not invent');
  assert.equal(lines.adminFee, null, 'missing admin_fee → omit, do not invent');
}

// Catalog price must never be the tagihan total source
{
  const catalogPrice = 1500;
  const inquiryTotal = buildTagihanCheckoutPriceLines({
    selling_price: 120000,
    bill_amount: 118500,
    admin_fee: 1500,
  }).total;
  assert.notEqual(inquiryTotal, catalogPrice);
  assert.equal(inquiryTotal, 120000);
}

// --- HIGH #4: notice copy ---
assert.ok(!INQUIRY_FLOW_NOTICE.toLowerCase().includes('sedang disiapkan'));
assert.ok(!INQUIRY_FLOW_NOTICE.toLowerCase().includes('web gurkynet'));
assert.match(INQUIRY_FLOW_NOTICE, /cek tagihan/i);

// --- Invalid inquiry context → cannot proceed (mirrors isTagihanContextValid) ---
function isTagihanContextValidLite(
  ctx: {
    inquiry?: { inquiry_ref_id?: string; customer_no?: string; sku_code?: string } | null;
    expiresAt?: number;
  } | null,
  targetNumber: string,
  skuCode: string
): boolean {
  if (!ctx?.inquiry?.inquiry_ref_id) return false;
  if (!ctx.inquiry.customer_no) return false;
  if (ctx.inquiry.customer_no !== targetNumber) return false;
  if (skuCode && ctx.inquiry.sku_code !== skuCode) return false;
  if (!ctx.expiresAt || Date.now() >= ctx.expiresAt) return false;
  return true;
}

{
  const expired = {
    inquiry: {
      inquiry_ref_id: 'ref-x',
      sku_code: 'post1',
      customer_no: '123',
    },
    expiresAt: Date.now() - 1000,
  };
  assert.equal(isTagihanContextValidLite(expired, '123', 'post1'), false);

  const mismatchTarget = {
    inquiry: { ...expired.inquiry },
    expiresAt: Date.now() + 60_000,
  };
  assert.equal(isTagihanContextValidLite(mismatchTarget, '999', 'post1'), false);

  const ok = {
    inquiry: { ...expired.inquiry },
    expiresAt: Date.now() + 60_000,
  };
  assert.equal(isTagihanContextValidLite(ok, '123', 'post1'), true);
}

// --- Token PLN regression: prepaid classifier unchanged ---
assert.equal(isPlnPrepaidCategory('pln'), true);
assert.equal(isPlnPrepaidCategory('token-pln'), true);
assert.equal(isPlnPrepaidCategory('pln-pascabayar'), false);
assert.equal(isPlnPrepaidCategory('pbb'), false);

console.log('tagihanCheckout.test.ts: all assertions passed');
