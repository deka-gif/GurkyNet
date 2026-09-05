/**
 * Basic target validation mirrored from Web purchase UIs.
 * Does not invent provider detection — that stays backend-side.
 */

/** Strip non-digits — same as Web PulsaPage / PhoneOperatorCatalogFlow / VoucherInternetPage. */
export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Web PhoneOperatorCatalogFlow + VoucherInternetPage require >= 10 digits before checkout.
 * PulsaPage sanitizes digits but does not enforce min length in UI; we align with the
 * stricter existing Web check for phone-style direct purchase.
 */
export const MIN_PHONE_DIGITS = 10;

export function isValidPhoneTarget(value: string): boolean {
  return sanitizePhoneDigits(value).length >= MIN_PHONE_DIGITS;
}

export function phoneTargetError(value: string): string | null {
  const digits = sanitizePhoneDigits(value);
  if (!digits) return 'Nomor tujuan wajib diisi.';
  if (digits.length < MIN_PHONE_DIGITS) {
    return `Nomor HP minimal ${MIN_PHONE_DIGITS} digit.`;
  }
  return null;
}
