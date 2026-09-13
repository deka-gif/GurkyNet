/**
 * Web E-Wallet open-amount client validation (audit P0).
 * Mirror mobile `validateEwalletOpenAmount` multiple-of-1000 rule (Digi RC 87).
 * Min/max remain validated at the call site from provider summary / product.
 */

/** Digiflazz E-Money RC 87 — face amount must be a multiple of Rp1.000. */
export function validateEwalletAmountMultipleOfThousand(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Masukkan nominal top up.';
  }
  if (amount % 1000 !== 0) {
    return 'Nominal harus kelipatan Rp1.000';
  }
  return null;
}
