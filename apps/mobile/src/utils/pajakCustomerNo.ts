/**
 * PBB (NOP_YEAR) helpers — ported from Web src/utils/pajakCustomerNo.ts.
 * Digits-only NOP; tax year options from runtime current year.
 */

/** Digits only (no length cap) — used for validation length checks. */
function digitsOnly(nop: string | null | undefined): string {
  return String(nop ?? '').replace(/\D/g, '');
}

/** Strip non-digits and cap at 18 (Web PajakNegaraFlow input behavior). */
export function sanitizePbbNop(nop: string | null | undefined): string {
  return digitsOnly(nop).slice(0, 18);
}

/**
 * Valid NOP: 15–18 digits after stripping non-digits.
 * More than 18 digits (before UI cap) is invalid.
 */
export function isValidPbbNop(nop: string | null | undefined): boolean {
  const digits = digitsOnly(nop);
  return digits.length >= 15 && digits.length <= 18;
}

/**
 * Digiflazz customer_no for PBB = digits-only NOP.
 * Callers must validate with isValidPbbNop before inquiry.
 */
export function composePbbCustomerNo(nop: string): string {
  return sanitizePbbNop(nop);
}

/**
 * Tax year dropdown options: current year … current − (count − 1).
 * Default count=6 → e.g. 2026…2021 when run in 2026.
 */
export function taxYearOptions(count = 6): number[] {
  const y = new Date().getFullYear();
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => y - i);
}

export function isValidTaxYear(year: number | null | undefined, options?: number[]): boolean {
  if (year == null || !Number.isInteger(year)) return false;
  const opts = options ?? taxYearOptions(6);
  return opts.includes(year);
}
