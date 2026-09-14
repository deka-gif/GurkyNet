/**
 * Customer-facing redeem / deliverable codes from GET /transactions/:id/receipt.
 * Mirrors web `receiptDeliverable.ts` — presentation only; no API changes.
 *
 * Backend already splits codes into typed fields (token_code, voucher_internet_code, …).
 * There is no generic "is_important_code" flag; clients key off those fields + booleans.
 */

import type { ReceiptData } from '../services/transaction.service';

export type ReceiptDeliverableItem = {
  /** Stable key for React lists / copy feedback. */
  key: string;
  /** Section label, e.g. "Kode Token", "Kode Voucher". */
  label: string;
  /** Display value (may be grouped for PLN). */
  value: string;
  /** Exact clipboard payload — never add spaces beyond what the provider returned. */
  copyValue: string;
  /** Optional customer hint under the code. */
  hint?: string | null;
};

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

/**
 * Resolve all redeem/deliverable codes for on-screen receipt highlight.
 * Order: PLN token → VI → digital voucher → langganan activation → SN fallback for code products.
 */
export function resolveReceiptDeliverables(
  receipt: ReceiptData | null | undefined,
  opts?: { telkomselRedeemHint?: boolean }
): ReceiptDeliverableItem[] {
  if (!receipt) return [];
  const d = receipt.transaction_details;
  const out: ReceiptDeliverableItem[] = [];
  const seen = new Set<string>();

  const push = (item: ReceiptDeliverableItem) => {
    const norm = item.copyValue.replace(/\s+/g, '');
    if (!norm || seen.has(norm.toLowerCase())) return;
    seen.add(norm.toLowerCase());
    out.push(item);
  };

  const tokenGrouped = firstString(d.token_code_grouped);
  const tokenRaw = firstString(d.token_code);
  if (tokenGrouped || tokenRaw) {
    push({
      key: 'pln_token',
      label: 'Kode Token',
      value: tokenGrouped || tokenRaw || '',
      copyValue: (tokenRaw || tokenGrouped || '').replace(/\s+/g, ''),
    });
  }

  const viCode = firstString(d.voucher_internet_code);
  if (viCode) {
    const isTelkomsel =
      opts?.telkomselRedeemHint === true ||
      String(d.service_name ?? '')
        .toLowerCase()
        .includes('telkomsel') ||
      String(receipt.items?.[0]?.name ?? '')
        .toLowerCase()
        .includes('telkomsel');
    push({
      key: 'voucher_internet',
      label: isTelkomsel ? 'Kode Voucher (Beli Kode)' : 'Kode Voucher',
      value: viCode,
      copyValue: viCode,
      hint: isTelkomsel
        ? 'Redeem via *133# atau MyTelkomsel. Ini kode voucher, bukan isi kuota otomatis.'
        : null,
    });
  }

  const voucherCode = firstString(d.voucher_code);
  if (voucherCode) {
    push({
      key: 'voucher_digital',
      label: 'Kode Voucher / PIN',
      value: voucherCode,
      copyValue: voucherCode,
    });
  }

  const activation = firstString(d.activation_code);
  if (activation) {
    push({
      key: 'activation',
      label: 'Kode Aktivasi',
      value: activation,
      copyValue: activation,
    });
  }

  const sn = firstString(d.serial_number);
  const needsSnFallback =
    Boolean(d.is_voucher_internet) ||
    Boolean(d.is_voucher) ||
    Boolean(d.is_langganan) ||
    (Boolean(d.is_pln_token) && !tokenRaw && !tokenGrouped);
  // VI / voucher products often return the redeem token only in serial_number.
  // Skip SN when a typed code field already covers the redeemable value.
  if (sn && needsSnFallback && out.length === 0) {
    push({
      key: 'serial_number',
      label: Boolean(d.is_pln_token) ? 'Kode Token / SN' : 'Serial Number (SN)',
      value: sn,
      copyValue: sn,
      hint:
        Boolean(d.is_voucher_internet) &&
        (opts?.telkomselRedeemHint === true ||
          String(d.service_name ?? '')
            .toLowerCase()
            .includes('telkomsel'))
          ? 'Redeem via *133# atau MyTelkomsel. Ini kode voucher, bukan isi kuota otomatis.'
          : null,
    });
  }

  return out;
}

/** Primary deliverable for thermal/share "Kode/SN" field (same priority as before). */
export function primaryDeliverableValue(
  details: ReceiptData['transaction_details']
): string | null {
  const candidates = [
    details.token_code_grouped,
    details.token_code,
    details.voucher_internet_code,
    details.voucher_code,
    details.activation_code,
    details.serial_number,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}
