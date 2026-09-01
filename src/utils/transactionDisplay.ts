/** Mask destination number for history cards (keep first 4 + last 3). */
export function maskTargetNumber(value?: string | null): string {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw || raw === '-') return '—';
  if (raw.length <= 7) {
    if (raw.length <= 3) return '*'.repeat(raw.length);
    return `${raw.slice(0, 2)}${'*'.repeat(Math.max(1, raw.length - 4))}${raw.slice(-2)}`;
  }
  return `${raw.slice(0, 4)}${'*'.repeat(Math.min(6, raw.length - 7))}${raw.slice(-3)}`;
}

const LANGGANAN_VOUCHER_PLACEHOLDER = 'LANGGANAN';

/** Mask email for history (keep first 2 chars of local part + full domain). */
export function maskEmail(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw || !raw.includes('@')) return maskTargetNumber(raw);
  const [local, domain] = raw.split('@');
  if (!domain) return maskTargetNumber(raw);
  const maskedLocal = local.length <= 2 ? '**' : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

/** Format target for riwayat cards — handles langganan voucher placeholder and email. */
export function formatHistoryTarget(
  value?: string | null,
  opts?: { langgananTargetDisplay?: string | null; serviceName?: string | null }
): string {
  const display = String(opts?.langgananTargetDisplay || '').trim();
  if (display) {
    return display.includes('@') ? maskEmail(display) : maskTargetNumber(display);
  }

  const raw = String(value || '').trim();
  if (!raw || raw === '-') return '—';
  if (raw.toUpperCase() === LANGGANAN_VOUCHER_PLACEHOLDER) {
    return 'Kode aktivasi otomatis';
  }
  if (raw.includes('@')) return maskEmail(raw);
  return maskTargetNumber(raw);
}

/** Label for target row in transaction detail (langganan may use email/ID instead of phone). */
export function resolveTargetLabel(
  serviceName?: string | null,
  targetNo?: string | null,
  langgananDelivery?: string | null
): string {
  const service = String(serviceName ?? '').toLowerCase();
  const target = String(targetNo ?? '').trim();
  if (service.includes('langganan')) {
    if (langgananDelivery === 'voucher' || target.toUpperCase() === LANGGANAN_VOUCHER_PLACEHOLDER) {
      return 'Pengiriman';
    }
    if (target.includes('@')) return 'Email Tujuan';
    return 'Data Tujuan';
  }
  return 'Nomor Tujuan';
}

export function formatTransactionDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Map fulfillment provider codes to display badges. */
export function resolveProviderBadge(
  providerCode?: string | null,
  providerName?: string | null
): string | null {
  const raw = String(providerName || providerCode || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('digiflazz') || raw === 'df' || raw === 'digi') return 'Digiflazz';
  if (raw.includes('vip') || raw.includes('vipayment') || raw.includes('vip-reseller')) {
    return 'VIPayment';
  }
  if (providerName) return providerName;
  if (providerCode) return providerCode;
  return null;
}
