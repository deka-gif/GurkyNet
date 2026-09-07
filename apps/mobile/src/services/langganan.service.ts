import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Mirror of web `src/services/langganan/langganan.service.ts`.
 * Schema: GET /langganan/account-schema?brand=&sku=
 * Purchase: POST /transactions with target_number from buildLanggananCustomerNo
 * (voucher → "LANGGANAN"). No inquiry endpoint.
 */

export type LanggananAccountField = {
  key: string;
  label: string;
  required: boolean;
  input: string;
};

export type LanggananAccountSchema = {
  brand: string;
  sku?: string;
  code: string;
  label: string;
  delivery: 'account' | 'voucher' | 'unknown' | string;
  fields: LanggananAccountField[];
};

export const langgananService = {
  accountSchema: async (
    brand: string,
    sku: string
  ): Promise<ApiResponse<LanggananAccountSchema>> => {
    const response = await apiClient.get<ApiResponse<LanggananAccountSchema>>(
      '/langganan/account-schema',
      { params: { brand, sku } }
    );
    return response.data;
  },
};

/** Compose customer_no — mirrors Web + backend LanggananTargetBuilder.
 * Only delivery=voucher uses LANGGANAN. Never invent voucher from unknown/empty.
 */
export function buildLanggananCustomerNo(
  fields: LanggananAccountField[],
  account: Record<string, string>,
  delivery: string
): string {
  const d = String(delivery ?? '').trim().toLowerCase();
  if (d === 'voucher') {
    return 'LANGGANAN';
  }
  if (d !== 'account' || fields.length === 0) {
    return '';
  }
  const values = fields
    .map((f) => {
      const raw = (account[f.key] || '').trim();
      if (f.input === 'phone') return raw.replace(/\D/g, '');
      return raw;
    })
    .filter(Boolean);
  if (values.length === 1) return values[0];
  return values.join('|');
}

function isReasonableEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Required fields filled; email fields must look like email (Web-aligned). */
export function langgananAccountReady(
  fields: LanggananAccountField[],
  account: Record<string, string>
): boolean {
  if (fields.length === 0) return true;
  return fields.every((f) => {
    if (!f.required) return true;
    const v = (account[f.key] || '').trim();
    if (!v) return false;
    if (f.input === 'email') return isReasonableEmail(v);
    return true;
  });
}
