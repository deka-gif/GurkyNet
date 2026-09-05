/** Customer-facing display helpers — mirror web `src/utils/transactionDisplay.ts`. */

export function maskTargetNumber(value?: string | null): string {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw || raw === '-') return '—';
  if (raw.length <= 7) {
    if (raw.length <= 3) return '*'.repeat(raw.length);
    return `${raw.slice(0, 2)}${'*'.repeat(Math.max(1, raw.length - 4))}${raw.slice(-2)}`;
  }
  return `${raw.slice(0, 4)}${'*'.repeat(Math.min(6, raw.length - 7))}${raw.slice(-3)}`;
}

export function maskEmail(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw || !raw.includes('@')) return maskTargetNumber(raw);
  const [local, domain] = raw.split('@');
  if (!domain) return maskTargetNumber(raw);
  const maskedLocal = local.length <= 2 ? '**' : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

export function formatHistoryTarget(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return '—';
  if (raw.toUpperCase() === 'LANGGANAN') return 'Kode aktivasi otomatis';
  if (raw.includes('@')) return maskEmail(raw);
  return maskTargetNumber(raw);
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

export function transactionTimestamp(tx: { date?: string; createdAt?: string }): number {
  const raw = tx.createdAt || tx.date || '';
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}
