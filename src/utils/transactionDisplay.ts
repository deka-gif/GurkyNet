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
