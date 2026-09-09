import type { ReceiptData } from '../services/transaction.service';
import {
  type ReceiptFieldId,
  type ReceiptTemplate,
  type StoreProfile,
  type PaperWidthMm,
} from '../services/receiptSettings.service';
import { formatIDR } from './currency';

const APP_FALLBACK_NAME = 'GurkyPay';

export type ReceiptPrintContext = {
  receipt: ReceiptData | null;
  store: StoreProfile;
  template: ReceiptTemplate;
  /** Logged-in user display name for store header fallback. */
  userName?: string | null;
  paperWidthMm: PaperWidthMm;
  /** When true, fill missing receipt fields with sample values (test print). */
  sample?: boolean;
};

export type ReceiptLine = {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: 1 | 2;
};

function charsPerLine(width: PaperWidthMm): number {
  return width === 80 ? 48 : 32;
}

function resolveStoreName(store: StoreProfile, userName?: string | null): string {
  const custom = store.storeName.trim();
  if (custom) return custom;
  const user = (userName || '').trim();
  if (user) return user;
  return APP_FALLBACK_NAME;
}

function sampleReceipt(): ReceiptData {
  return {
    header: {
      company_name: APP_FALLBACK_NAME,
      tagline: null,
      address: null,
      support_phone: null,
      support_email: null,
    },
    transaction_details: {
      invoice_number: 'INV-TEST-001',
      date: new Date().toISOString(),
      status: 'success',
      service_name: 'Pulsa',
      target_number: '081234567890',
      payment_method: 'SALDO',
      serial_number: 'SN-TEST-123',
      voucher_code: null,
      voucher_url: null,
      voucher_internet_code: null,
      voucher_internet_url: null,
      activation_code: null,
      activation_url: null,
      provider_ref: 'REF-TEST',
    },
    items: [{ sku_code: 'TEST', name: 'Pulsa 10.000', price: 10500, quantity: 1, total: 10500 }],
    payment_summary: { subtotal: 10000, denda: 0, admin_fee: 500, total_payment: 10500 },
    footer: { note: '' },
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
}

function deliverableValue(details: ReceiptData['transaction_details']): string | null {
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

function productName(receipt: ReceiptData): string {
  const item = receipt.items[0];
  if (item?.name) return item.name;
  return receipt.transaction_details.service_name || '—';
}

function fieldValue(
  id: ReceiptFieldId,
  ctx: {
    receipt: ReceiptData;
    store: StoreProfile;
    userName?: string | null;
    note: string;
  }
): { label: string; value: string; headerOnly?: boolean } | null {
  const d = ctx.receipt.transaction_details;
  const s = ctx.receipt.payment_summary;

  switch (id) {
    case 'store_name':
      return {
        label: '',
        value: resolveStoreName(ctx.store, ctx.userName),
        headerOnly: true,
      };
    case 'store_address': {
      const v = ctx.store.address.trim();
      return v ? { label: '', value: v, headerOnly: true } : null;
    }
    case 'store_whatsapp': {
      const v = ctx.store.whatsapp.trim();
      return v ? { label: 'WA', value: v, headerOnly: true } : null;
    }
    case 'invoice':
      return { label: 'Invoice', value: d.invoice_number || '—' };
    case 'date':
      return { label: 'Waktu', value: formatDate(d.date) };
    case 'status':
      return { label: 'Status', value: String(d.status || '—').toUpperCase() };
    case 'product_name':
      return { label: 'Produk', value: productName(ctx.receipt) };
    case 'target_number': {
      const v = (d.target_number || '').trim();
      return v ? { label: 'Tujuan', value: v } : null;
    }
    case 'payment_method':
      return { label: 'Bayar', value: d.payment_method || '—' };
    case 'subtotal':
      return { label: 'Subtotal', value: formatIDR(s.subtotal) };
    case 'admin_fee':
      return s.admin_fee > 0 ? { label: 'Admin', value: formatIDR(s.admin_fee) } : null;
    case 'denda':
      return s.denda > 0 ? { label: 'Denda', value: formatIDR(s.denda) } : null;
    case 'deliverable': {
      const v = deliverableValue(d);
      return v ? { label: 'Kode/SN', value: v } : null;
    }
    case 'provider_ref': {
      const v =
        typeof d.provider_ref === 'string' && d.provider_ref.trim()
          ? d.provider_ref.trim()
          : '';
      return v ? { label: 'Ref', value: v } : null;
    }
    case 'total_payment':
      return { label: 'TOTAL', value: formatIDR(s.total_payment) };
    case 'note': {
      const v = ctx.note.trim();
      return v ? { label: '', value: v, headerOnly: true } : null;
    }
    default:
      return null;
  }
}

function padRow(label: string, value: string, width: number): string {
  if (!label) return value;
  const sep = ': ';
  const left = `${label}${sep}`;
  const available = Math.max(4, width - left.length);
  if (value.length <= available) {
    return `${left}${value}`;
  }
  return `${left}${value.slice(0, available - 1)}…`;
}

/**
 * Build printable / preview lines from receipt + local store/template.
 * Does not log sensitive deliverable values.
 */
export function buildReceiptLines(ctx: ReceiptPrintContext): ReceiptLine[] {
  const receipt = ctx.sample || !ctx.receipt ? sampleReceipt() : ctx.receipt;
  const width = charsPerLine(ctx.paperWidthMm);
  const lines: ReceiptLine[] = [];
  const dataCtx = {
    receipt,
    store: ctx.store,
    userName: ctx.userName,
    note: ctx.template.note,
  };

  let wroteHeaderRule = false;

  for (const field of ctx.template.fields) {
    if (!field.locked && !field.visible) continue;

    const rendered = fieldValue(field.id, dataCtx);
    if (!rendered) continue;

    if (field.id === 'store_name') {
      lines.push({ text: rendered.value, align: 'center', bold: true, size: 2 });
      continue;
    }
    if (field.id === 'store_address' || field.id === 'store_whatsapp') {
      lines.push({
        text: field.id === 'store_whatsapp' ? `WA: ${rendered.value}` : rendered.value,
        align: 'center',
      });
      continue;
    }
    if (field.id === 'note') {
      lines.push({ text: '-'.repeat(width), align: 'center' });
      lines.push({ text: rendered.value, align: 'center' });
      continue;
    }

    if (!wroteHeaderRule && !rendered.headerOnly) {
      lines.push({ text: '='.repeat(width), align: 'center' });
      wroteHeaderRule = true;
    }

    if (field.id === 'total_payment') {
      lines.push({ text: '-'.repeat(width), align: 'center' });
      lines.push({
        text: padRow(rendered.label, rendered.value, width),
        bold: true,
      });
      continue;
    }

    lines.push({ text: padRow(rendered.label, rendered.value, width) });
  }

  if (lines.length === 0) {
    lines.push({ text: resolveStoreName(ctx.store, ctx.userName), align: 'center', bold: true });
  }

  return lines;
}

export function receiptLinesToPreviewText(lines: ReceiptLine[]): string {
  return lines.map((l) => l.text).join('\n');
}
