import type { TagihanInquiryResult } from '../services/tagihan.service';

/**
 * Tagihan checkout helpers (Mobile HIGH fixes).
 * Pure functions — safe for Node selftests without RN.
 */

/** Same SKU + same inquiry_ref_id + existing key → reuse; otherwise new purchase attempt. */
export function resolveTagihanCheckoutSession(args: {
  skuCode: string | null;
  idempotencyKey: string | null;
  existingInquiryRef: string | null | undefined;
  productCode: string;
  nextInquiryRef: string;
}): 'reuse' | 'new' {
  const nextRef = String(args.nextInquiryRef || '').trim();
  const prevRef = String(args.existingInquiryRef || '').trim();
  if (
    args.idempotencyKey &&
    args.skuCode === args.productCode &&
    prevRef !== '' &&
    nextRef !== '' &&
    prevRef === nextRef
  ) {
    return 'reuse';
  }
  return 'new';
}

/** Mirror Token PLN onMeterChange: clear when typed id diverges from inquired id. */
export function shouldClearTagihanInquiryOnIdentifierEdit(
  inquiredFor: string | null,
  nextIdentifier: string
): boolean {
  if (inquiredFor == null) return false;
  return inquiredFor !== nextIdentifier;
}

/** PBB: tax year change invalidates prior inquiry session. */
export function shouldClearTagihanInquiryOnTaxYearEdit(
  inquiredYear: number | null,
  nextYear: number
): boolean {
  if (inquiredYear == null) return false;
  return inquiredYear !== nextYear;
}

export type TagihanCheckoutPriceLines = {
  /** Present only when inquiry.bill_amount is a finite number. */
  billAmount: number | null;
  /** Present only when inquiry.admin_fee is a finite number. */
  adminFee: number | null;
  /** Authoritative total — inquiry.selling_price. */
  total: number;
};

/**
 * Build checkout price rows from inquiry only — never catalog product.price.
 * Omit breakdown fields that are missing; do not invent admin fee.
 */
export function buildTagihanCheckoutPriceLines(
  inquiry: Pick<TagihanInquiryResult, 'selling_price' | 'bill_amount' | 'admin_fee'>
): TagihanCheckoutPriceLines {
  const total = Number(inquiry.selling_price);
  const billRaw = inquiry.bill_amount;
  const adminRaw = inquiry.admin_fee;
  return {
    billAmount:
      typeof billRaw === 'number' && Number.isFinite(billRaw) ? billRaw : null,
    adminFee:
      typeof adminRaw === 'number' && Number.isFinite(adminRaw) ? adminRaw : null,
    total: Number.isFinite(total) ? total : 0,
  };
}
