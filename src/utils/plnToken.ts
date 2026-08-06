/** Extract 20-digit PLN token from provider SN (never invent digits). */
export function extractPlnToken(serialNumber?: string | null): string | null {
  if (!serialNumber) return null;
  const raw = String(serialNumber).trim();
  if (!raw) return null;

  for (const part of raw.split(/[\/|]/)) {
    const digits = part.replace(/\D/g, '');
    if (digits.length === 20) return digits;
  }

  const all = raw.replace(/\D/g, '');
  if (all.length === 20) return all;
  const match = all.match(/\d{20}/);
  return match ? match[0] : null;
}

export function formatPlnTokenGrouped(token: string): string {
  const digits = token.replace(/\D/g, '');
  if (digits.length !== 20) return token;
  return digits.match(/.{1,4}/g)?.join(' - ') || digits;
}
