import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * DigiFlazz Game schema + optional VIP nickname lookup.
 * Purchase: Digi schema → customer_no → PIN → POST /transactions (VIP not required).
 */

export type GameAccountField = {
  key: string;
  label: string;
  required: boolean;
};

export type GameAccountSchema = {
  brand: string;
  sku?: string | null;
  code: string;
  label: string;
  delivery: 'account' | 'unknown' | string;
  fields: GameAccountField[];
};

export type GameInquiryResult = {
  inquiry_ref_id?: string | null;
  sku_code: string;
  product_name: string;
  game: string;
  brand: string;
  user_id: string;
  zone_id?: string | null;
  customer_no: string;
  id_zone_label: string;
  nickname?: string | null;
  item: string;
  price: number;
  sell_price?: number;
  admin_fee?: number;
  found?: boolean;
  nickname_optional?: boolean;
  expires_in_seconds: number;
};

/** Digi lookup/utility SKUs — not top-up purchase (prod evidence). */
export const GAME_NON_PURCHASE_SKUS = new Set([
  'pre33639299', // ML Cek Username
  'pre33817254', // PUBG Cek Username
]);

export function isGameNonPurchaseSku(code: string | null | undefined): boolean {
  return GAME_NON_PURCHASE_SKUS.has(String(code ?? '').trim());
}

/** Digi customer_no: single id, or user_id|zone_id when zone present. */
export function buildGameCustomerNo(
  fields: GameAccountField[],
  account: Record<string, string>
): string {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = String(account[f.key] ?? '').trim();
    if (f.required && !v) {
      throw new Error(`${f.label} wajib diisi.`);
    }
    if (v) values[f.key] = v;
  }

  const target =
    values.user_id ??
    values.player_id ??
    values.uid ??
    values.garena_id ??
    Object.values(values)[0];

  if (!target) {
    throw new Error('Data akun game wajib diisi.');
  }

  const zone = values.zone_id ?? values.server_id;
  return zone ? `${target}|${zone}` : target;
}

export const gameService = {
  accountSchema: async (
    brand: string,
    sku?: string | null
  ): Promise<ApiResponse<GameAccountSchema>> => {
    const params: Record<string, string> = { brand };
    const skuTrim = String(sku ?? '').trim();
    if (skuTrim) params.sku = skuTrim;
    const response = await apiClient.get<ApiResponse<GameAccountSchema>>('/game/account-schema', {
      params,
    });
    return response.data;
  },

  /** Optional VIP nickname lookup — Digi purchase does not require success. */
  inquire: async (
    skuCode: string,
    account: Record<string, string>
  ): Promise<ApiResponse<GameInquiryResult>> => {
    const response = await apiClient.post<ApiResponse<GameInquiryResult>>('/game/inquiry', {
      sku_code: skuCode,
      account,
    });
    return response.data;
  },
};
