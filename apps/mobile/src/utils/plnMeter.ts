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

/**
 * Map provider/raw inquiry failures (e.g. Digiflazz "Transaksi Gagal")
 * to a clear counter-staff message for wrong / unknown meter numbers.
 */
export function friendlyPlnInquiryError(raw?: string | null): string {
  const msg = String(raw || '').trim();
  const lower = msg.toLowerCase();

  // Keep network / config issues as-is.
  if (
    /gagal menghubungi|timeout|jaringan|koneksi|belum dikonfigurasi|server sedang/i.test(lower)
  ) {
    return msg;
  }

  if (
    !msg ||
    /transaksi gagal/i.test(lower) ||
    /tidak (ditemukan|terdaftar)/i.test(lower) ||
    /not found/i.test(lower) ||
    /nomor.*(salah|tidak|invalid)/i.test(lower) ||
    /meter.*(salah|tidak|invalid)/i.test(lower) ||
    /customer.*(salah|tidak|invalid)/i.test(lower) ||
    /gagal cek meteran/i.test(lower) ||
    /gagal melakukan inquiry/i.test(lower)
  ) {
    return 'No Meteran Tidak Ditemukan, Periksa Kembali';
  }

  return msg;
}
