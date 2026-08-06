import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type GameAccountField = {
  key: string;
  label: string;
  required: boolean;
};

export type GameAccountSchema = {
  brand: string;
  code: string;
  label: string;
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
  accountSchema: async (brand: string): Promise<ApiResponse<GameAccountSchema>> => {
    const response = await apiClient.get<ApiResponse<GameAccountSchema>>('/game/account-schema', {
      params: { brand },
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
