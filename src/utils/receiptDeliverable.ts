/**
 * FR-RECEIPT-UI-01 — single source of truth for turning a raw
 * `/transactions/:id/receipt` payload into the display-ready fields a
 * paper receipt needs (deliverable code, extra identity rows, target
 * label/value override, pending-code message).
 *
 * Pure presentation classification only — reads the same
 * `transaction_details` shape GetReceiptAction already returns and
 * never mutates business data. Shared by CheckoutSummary (fresh
 * purchase result) and RiwayatPage (past-transaction receipt) so both
 * surfaces treat every product category identically.
 */

import { extractPlnToken, formatPlnTokenGrouped } from './plnToken';

export interface ReceiptDeliverable {
  /** e.g. "Kode Token", "Kode Voucher / PIN Voucher" */
  label: string;
  /** Big, prominent value shown to the customer. */
  value: string;
  url?: string | null;
  /** Value copied to clipboard (may differ slightly from `value`, e.g. ungrouped token digits). */
  copyValue: string;
}

export interface ReceiptExtraRow {
  label: string;
  value: string;
}

export interface ReceiptFieldSet {
  serialNumber: string | null;
  /** Overrides the generic "Nomor Target/Tujuan" row (e.g. Pajak → "Nomor Objek Pajak"). */
  targetLabel: string | null;
  targetValue: string | null;
  extraRows: ReceiptExtraRow[];
  deliverable: ReceiptDeliverable | null;
  /** Set when the transaction succeeded but the provider hasn't returned the code yet. */
  deliverablePendingLabel: string | null;
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

/**
 * @param receiptData Raw response from `transactionService.getReceipt()` (may be null while still loading).
 * @param serviceName Fallback category name when receipt hasn't loaded yet.
 * @param customDetails Optional pre-settlement fallback values shown while the receipt is still loading.
 */
export function resolveReceiptFields(params: {
  receiptData: any;
  serviceName?: string | null;
  isSuccess: boolean;
  customDetails?: Record<string, string | number> | null;
}): ReceiptFieldSet {
  const { receiptData, serviceName, isSuccess, customDetails } = params;
  const details = receiptData?.transaction_details || {};
  const service = String(serviceName ?? details?.service_name ?? '').toLowerCase();

  const serialNumber = firstString(details?.serial_number, details?.provider_ref) ?? null;

  const isPlnToken =
    service.includes('token pln') || Boolean(details?.is_pln_token) || Boolean(details?.token_code);
  const isPajak =
    Boolean(details?.is_pajak_negara) || service === 'pbb' || service === 'samsat';
  const isEwallet = Boolean(details?.is_ewallet) || service === 'e-wallet';
  const isGame = Boolean(details?.is_game) || service === 'game';
  const isVoucher = Boolean(details?.is_voucher) || service === 'voucher digital';
  const isLangganan = Boolean(details?.is_langganan) || service === 'langganan digital';
  const isVoucherInternet = Boolean(details?.is_voucher_internet) || service === 'voucher internet';

  const extraRows: ReceiptExtraRow[] = [];
  let targetLabel: string | null = null;
  let targetValue: string | null = null;
  let deliverable: ReceiptDeliverable | null = null;
  let deliverablePendingLabel: string | null = null;

  if (isPlnToken) {
    const tokenDigits = firstString(details?.token_code) ?? extractPlnToken(serialNumber);
    const tokenGrouped = firstString(details?.token_code_grouped) ?? (tokenDigits ? formatPlnTokenGrouped(tokenDigits) : undefined);
    const customerName = firstString(details?.customer_name, typeof customDetails?.['Atas Nama'] === 'string' ? customDetails?.['Atas Nama'] : undefined);
    const segmentPower = firstString(details?.segment_power, typeof customDetails?.['Tarif / Daya'] === 'string' ? customDetails?.['Tarif / Daya'] : undefined);
    if (customerName) extraRows.push({ label: 'Nama Pelanggan', value: customerName });
    if (segmentPower) extraRows.push({ label: 'Tarif / Daya', value: segmentPower });
    if (tokenGrouped && tokenDigits) {
      deliverable = { label: 'Kode Token', value: tokenGrouped, copyValue: tokenDigits };
    } else if (isSuccess) {
      deliverablePendingLabel = 'Kode token';
    }
  } else if (isVoucher) {
    const voucherCode = firstString(details?.voucher_code, details?.serial_number);
    const voucherUrl = firstString(details?.voucher_url);
    const voucherBarcode = firstString(details?.voucher_barcode);
    if (voucherBarcode && voucherBarcode !== voucherCode) {
      extraRows.push({ label: 'Barcode', value: voucherBarcode });
    }
    if (voucherCode || voucherUrl) {
      deliverable = {
        label: 'Kode Voucher / PIN Voucher',
        value: voucherCode || voucherUrl || '',
        url: voucherUrl,
        copyValue: voucherCode || voucherUrl || voucherBarcode || '',
      };
    } else if (isSuccess) {
      deliverablePendingLabel = 'Kode voucher';
    }
  } else if (isLangganan) {
    const activationCode = firstString(details?.activation_code, details?.serial_number);
    const activationUrl = firstString(details?.activation_url);
    const langgananDelivery = firstString(details?.langganan_delivery);
    const langgananTargetDisplay = firstString(details?.langganan_target_display);
    if (langgananDelivery === 'voucher' || langgananTargetDisplay?.toUpperCase() === 'LANGGANAN') {
      targetLabel = 'Pengiriman';
      targetValue = 'Kode aktivasi otomatis';
    } else if (langgananTargetDisplay) {
      targetLabel = langgananTargetDisplay.includes('@') ? 'Email Tujuan' : 'Data Tujuan';
      targetValue = langgananTargetDisplay;
    }
    if (activationCode || activationUrl) {
      deliverable = {
        label: 'Kode Voucher / Redeem / Aktivasi',
        value: activationCode || activationUrl || '',
        url: activationUrl,
        copyValue: activationCode || activationUrl || '',
      };
    } else if (isSuccess) {
      deliverablePendingLabel = 'Kode aktivasi';
    }
  } else if (isVoucherInternet) {
    const code = firstString(details?.voucher_internet_code, details?.serial_number);
    const url = firstString(details?.voucher_internet_url);
    if (code || url) {
      deliverable = {
        label: 'Kode Voucher',
        value: code || url || '',
        url,
        copyValue: code || url || '',
      };
    } else if (isSuccess) {
      deliverablePendingLabel = 'Kode voucher internet';
    }
  } else if (isEwallet) {
    const accountName = firstString(details?.customer_name, typeof customDetails?.['Nama Akun'] === 'string' ? customDetails?.['Nama Akun'] : undefined);
    if (accountName) extraRows.push({ label: 'Nama Akun', value: accountName });
  } else if (isGame) {
    const nickname = firstString(details?.nickname, details?.customer_name, typeof customDetails?.Nickname === 'string' ? customDetails?.Nickname : undefined);
    const brand = firstString(details?.game_brand, typeof customDetails?.Game === 'string' ? customDetails?.Game : undefined);
    const userId = firstString(details?.game_user_id, typeof customDetails?.['User ID'] === 'string' ? customDetails?.['User ID'] : undefined);
    const zoneId = firstString(details?.game_zone_id, typeof customDetails?.['Zone ID'] === 'string' ? customDetails?.['Zone ID'] : undefined);
    if (brand) extraRows.push({ label: 'Game', value: brand });
    if (nickname) extraRows.push({ label: 'Nickname', value: nickname });
    if (userId) extraRows.push({ label: 'User ID', value: userId });
    if (zoneId) extraRows.push({ label: 'Zone ID', value: zoneId });
  } else if (isPajak) {
    const tax = (details?.tax_details || {}) as Record<string, string>;
    const owner = firstString(details?.customer_name, typeof customDetails?.['Nama Pemilik'] === 'string' ? customDetails?.['Nama Pemilik'] : undefined);
    const isSamsat = details?.pajak_jenis === 'samsat' || service === 'samsat';
    targetLabel = isSamsat ? 'Nomor Polisi' : 'Nomor Objek Pajak';
    targetValue =
      firstString(
        tax?.nop,
        tax?.nomor_polisi,
        typeof customDetails?.['Nomor Objek Pajak'] === 'string' ? customDetails?.['Nomor Objek Pajak'] : undefined,
        typeof customDetails?.['Nomor Polisi'] === 'string' ? customDetails?.['Nomor Polisi'] : undefined
      ) ?? null;
    if (owner) extraRows.push({ label: 'Nama Pemilik', value: owner });
    const ntpn = firstString(details?.ntpn, tax?.ntpn, tax?.NTPN);
    const pengesahan = firstString(details?.nomor_pengesahan);
    if (ntpn) {
      extraRows.push({ label: 'NTPN', value: ntpn });
    } else if (pengesahan) {
      extraRows.push({ label: 'No. Pengesahan', value: pengesahan });
    }
  }

  return {
    serialNumber: isPlnToken ? null : serialNumber,
    targetLabel,
    targetValue,
    extraRows,
    deliverable,
    deliverablePendingLabel,
  };
}
