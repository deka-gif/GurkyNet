/**
 * Match User Dashboard operator labels to provider brand names from Digiflazz / VIP.
 * VIP often stores "INDOSAT", "TRI", "XL", "AXIS", "SMART" while the UI uses longer labels.
 */
export function normalizeOperatorKey(name: string | null | undefined): string {
  const raw = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!raw) return '';
  if (raw.includes('telkomsel') || raw === 'tsel') return 'telkomsel';
  if (raw.includes('indosat') || raw === 'im3') return 'indosat';
  if (raw === 'xl' || raw.includes('xlaxiata')) return 'xl';
  if (raw === 'tri' || raw === 'three' || raw === '3') return 'tri';
  if (raw === 'axis') return 'axis';
  if (raw.includes('smart')) return 'smartfren';
  if (raw.includes('byu')) return 'byu';
  if (raw.includes('pln')) return 'pln';
  return raw;
}

export function operatorsMatch(
  productOperator: string | null | undefined,
  selectedOperator: string | null | undefined
): boolean {
  const a = normalizeOperatorKey(productOperator);
  const b = normalizeOperatorKey(selectedOperator);
  return a !== '' && b !== '' && a === b;
}
