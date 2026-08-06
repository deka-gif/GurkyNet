/** Compose Digiflazz customer_no for government tax inquiries (no invented values). */

export function composePbbCustomerNo(nop: string): string {
  return nop.replace(/\D/g, '');
}

/**
 * Digiflazz SAMSAT docs: Kode Pembayaran, Nomor Identitas.
 * UX collects nopol + rangka + KTP — encoded as nopol,rangka,ktp for the provider.
 */
export function composeSamsatCustomerNo(nopol: string, rangka: string, ktp: string): string {
  const plate = nopol.replace(/\s+/g, '').toUpperCase();
  const frame = rangka.replace(/\s+/g, '').toUpperCase();
  const id = ktp.replace(/\D/g, '');
  return `${plate},${frame},${id}`;
}

export function taxYearOptions(count = 6): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => y - i);
}
