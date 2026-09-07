import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Mirror of web `src/services/game/game.service.ts`.
 * Schema: GET /game/account-schema?brand=&sku=
 * Inquiry: POST /game/inquiry { sku_code, account }
 * Purchase uses target_number = customer_no (no inquiry_ref_id).
 *
 * delivery=unknown → fail-closed (no fake player_id form).
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
  inquiry_ref_id: string;
  sku_code: string;
  product_name: string;
  game: string;
  brand: string;
  user_id: string;
  zone_id?: string | null;
  customer_no: string;
  id_zone_label: string;
  nickname: string;
  item: string;
  price: number;
  sell_price: number;
  admin_fee: number;
  found: boolean;
  expires_in_seconds: number;
};

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
