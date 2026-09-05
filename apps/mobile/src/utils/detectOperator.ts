/**
 * Mirror of web `src/utils/detectOperator.ts` — MSISDN prefix detection only.
 * Brand labels for catalog filtering / display — NOT Digiflazz/VIP fulfillment routing.
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

/** Provider name for GET /products?provider= (LIKE match on brand) — same as web. */
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
