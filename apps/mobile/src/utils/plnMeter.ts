/**
 * PLN meter / ID pelanggan validation — mirrors Web TokenPlnPage + PlnInquiryRequest.
 * Backend: regex /^\d{11,12}$/ after digit strip.
 */

export const PLN_METER_MIN = 11;
export const PLN_METER_MAX = 12;

export function sanitizePlnMeter(value: string): string {
  return value.replace(/\D/g, '').slice(0, PLN_METER_MAX);
}

export function isValidPlnMeter(value: string): boolean {
  const digits = sanitizePlnMeter(value);
  return digits.length >= PLN_METER_MIN && digits.length <= PLN_METER_MAX;
}

export function plnMeterError(value: string): string | null {
  const digits = sanitizePlnMeter(value);
  if (!digits) return 'Nomor meter / ID pelanggan PLN wajib diisi.';
  if (digits.length < PLN_METER_MIN || digits.length > PLN_METER_MAX) {
    return 'Masukkan 11–12 digit Nomor Meter / ID Pelanggan PLN.';
  }
  return null;
}
