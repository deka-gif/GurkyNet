/**
 * Detect Indonesian mobile operator from MSISDN prefix (first 4 digits).
 * Shared by Paket Data and other Telekomunikasi PPOB flows.
 */
export type DetectedOperator =
  | 'Telkomsel'
  | 'Indosat'
  | 'XL Axiata'
  | 'Tri (3)'
  | 'Axis'
  | 'Smartfren'
  | 'by.U';

export function detectOperatorFromPhone(phoneNo: string): DetectedOperator | null {
  const cleanNo = phoneNo.replace(/\D/g, '');
  if (cleanNo.length < 4) return null;
  const prefix = cleanNo.slice(0, 4);

  if (['0851'].includes(prefix)) return 'by.U';
  if (['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823'].includes(prefix)) {
    return 'Telkomsel';
  }
  if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(prefix)) {
    return 'Indosat';
  }
  if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(prefix)) {
    return 'XL Axiata';
  }
  if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) return 'Tri (3)';
  if (['0831', '0832', '0833', '0838'].includes(prefix)) return 'Axis';
  if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(prefix)) {
    return 'Smartfren';
  }

  return null;
}

/** Provider name for GET /products?provider= (LIKE match on brand). */
export function providerApiName(operator: DetectedOperator | string | null): string | undefined {
  if (!operator) return undefined;
  switch (operator) {
    case 'Telkomsel':
      return 'Telkomsel';
    case 'Indosat':
      return 'Indosat';
    case 'XL Axiata':
      return 'XL';
    case 'Tri (3)':
      return 'Tri';
    case 'Axis':
      return 'AXIS';
    case 'Smartfren':
      return 'Smartfren';
    case 'by.U':
      return 'by.U';
    default:
      return operator;
  }
}

export function providerBadgeLabel(operator: DetectedOperator | string | null): string {
  if (!operator) return '';
  switch (operator) {
    case 'Telkomsel':
      return 'TELKOMSEL';
    case 'XL Axiata':
      return 'XL';
    case 'Indosat':
      return 'INDOSAT';
    case 'Tri (3)':
      return 'TRI';
    case 'Smartfren':
      return 'SMARTFREN';
    case 'Axis':
      return 'AXIS';
    case 'by.U':
      return 'by.U';
    default:
      return String(operator).toUpperCase();
  }
}

/**
 * Soft ICCID / serial heuristics for Indonesian prepaid SN (Aktivasi Perdana).
 * Returns null when unknown — UI then shows operators that have catalog products.
 */
export function detectOperatorFromSerial(serial: string): DetectedOperator | null {
  const s = serial.replace(/\s+/g, '').toUpperCase();
  if (s.length < 6) return null;

  // Common marketing / SKU prefixes in Digiflazz-style SN labels
  if (/TELKOM|TSEL|SIMPATI|AS\b|LOOP/.test(s)) return 'Telkomsel';
  if (/INDOSAT|IM3|MENTARI|MATRIX/.test(s)) return 'Indosat';
  if (/\bXL\b|AXIATA/.test(s)) return 'XL Axiata';
  if (/\bTRI\b|THREE|3\b/.test(s) && !/AXIS/.test(s)) return 'Tri (3)';
  if (/AXIS/.test(s)) return 'Axis';
  if (/SMARTFREN|SMART/.test(s)) return 'Smartfren';
  if (/BY\.?U|BYU/.test(s)) return 'by.U';

  // ICCID country 8962… — operator IIN fragments vary; keep conservative.
  if (s.startsWith('8962')) {
    // Too ambiguous without full IIN table — leave to catalog fallback.
    return null;
  }

  return null;
}
