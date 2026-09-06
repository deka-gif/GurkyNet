/**
 * Single source of truth for Voucher Fisik SN batch limits (Mobile UX).
 * Backend may enforce a stricter max — never bypass server validation.
 */
export const PHYSICAL_VOUCHER_SN_LIMITS = {
  nasional: 200,
  perWilayah: 30,
} as const;

export type PhysicalVoucherSnLimitKind = keyof typeof PHYSICAL_VOUCHER_SN_LIMITS;

export function physicalVoucherSnLimit(kind: PhysicalVoucherSnLimitKind): number {
  return PHYSICAL_VOUCHER_SN_LIMITS[kind];
}
