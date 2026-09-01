import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type LanggananAccountField = {
  key: string;
  label: string;
  required: boolean;
  input: string;
};

export type LanggananAccountSchema = {
  brand: string;
  code: string;
  label: string;
  delivery: 'account' | 'voucher' | string;
  fields: LanggananAccountField[];
};

export const langgananService = {
  accountSchema: async (brand: string): Promise<ApiResponse<LanggananAccountSchema>> => {
    const response = await apiClient.get<ApiResponse<LanggananAccountSchema>>(
      '/langganan/account-schema',
      { params: { brand } }
    );
    return response.data;
  },
};

/** Compose customer_no for provider API — mirrors backend LanggananTargetBuilder. */
export function buildLanggananCustomerNo(
  fields: LanggananAccountField[],
  account: Record<string, string>,
  delivery: string
): string {
  if (fields.length === 0 || delivery === 'voucher') {
    return 'LANGGANAN';
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

export function langgananAccountReady(
  fields: LanggananAccountField[],
  account: Record<string, string>
): boolean {
  if (fields.length === 0) return true;
  return fields.every((f) => !f.required || (account[f.key] || '').trim() !== '');
}
