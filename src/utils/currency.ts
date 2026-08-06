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

/**
 * Strip everything except digits; remove leading zeros (keep empty string).
 * Used by currency inputs so state always holds a pure numeric string.
 */
export function parseIDRDigits(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

/**
 * Format a digit string for display in an amount input.
 * Empty → '' (not Rp0) so the field can clear cleanly while typing.
 */
export function formatIDRInput(value: string | number | null | undefined): string {
  const digits = parseIDRDigits(value);
  if (!digits) return '';
  return formatIDR(digits);
}

/**
 * Map digit-count caret to a selection index in a formatted IDR string.
 * Keeps the cursor from jumping to the end when thousand separators appear.
 */
export function caretFromDigitIndex(formatted: string, digitIndex: number): number {
  if (!formatted) return 0;
  if (digitIndex <= 0) {
    return formatted.startsWith('Rp') ? 2 : 0;
  }

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= digitIndex) {
        return i + 1;
      }
    }
  }

  return formatted.length;
}

export default formatIDR;
