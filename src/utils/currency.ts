/**
 * Global Indonesian Rupiah formatter.
 * 25000 → Rp25.000 | 1000000 → Rp1.000.000
 */
export function formatIDR(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) {
    return 'Rp0';
  }

  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num));

  return `Rp${formatted}`;
}

export default formatIDR;
