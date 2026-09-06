import type { DetectedOperator } from './detectOperator';
import { colors } from '../theme';

/**
 * Telco brand text colors for Mobile phone-input badge only.
 * Isolated from global theme — no project brand-color metadata existed for operators.
 * Display metadata only; never used for pricing / routing / API payloads.
 */
const OPERATOR_BRAND_COLORS: Record<DetectedOperator, string> = {
  Telkomsel: '#E20010',
  'XL Axiata': '#1E88E5',
  Axis: '#7B2D8E',
  Indosat: '#C9A000',
  'Tri (3)': '#111111',
  Smartfren: '#EE2E24',
  'by.U': '#00A0E3',
};

export function operatorBrandColor(operator: DetectedOperator | string | null): string {
  if (!operator) return colors.gray[500];
  if (operator in OPERATOR_BRAND_COLORS) {
    return OPERATOR_BRAND_COLORS[operator as DetectedOperator];
  }
  return colors.gray[600];
}
