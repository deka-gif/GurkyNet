import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type TagihanTaxDetails = Record<string, string>;

export type TagihanInquiryResult = {
  inquiry_ref_id: string;
  sku_code: string;
  product_name: string;
  provider_name: string;
  customer_no: string;
  customer_name: string;
  periode: string;
  lembar_tagihan: number;
  bill_amount: number;
  admin_fee: number;
  denda?: number;
  selling_price: number;
  tax_details?: TagihanTaxDetails;
  expires_in_seconds: number;
};

export type PajakRegionCity = {
  name: string;
  sku_code: string;
  product_name: string;
};

export type PajakRegionProvince = {
  name: string;
  cities: PajakRegionCity[];
};

export const tagihanService = {
  inquire: async (
    skuCode: string,
    customerNo: string,
    year?: number | null
  ): Promise<ApiResponse<TagihanInquiryResult>> => {
    const payload: Record<string, string | number> = {
      sku_code: skuCode,
      customer_no: customerNo,
    };
    if (year != null) {
      payload.year = year;
    }
    const response = await apiClient.post<ApiResponse<TagihanInquiryResult>>('/tagihan/inquiry', payload);
    return response.data;
  },

  pajakRegions: async (
    category: 'pbb' | 'samsat'
  ): Promise<ApiResponse<{ category: string; provinces: PajakRegionProvince[] }>> => {
    const response = await apiClient.get<ApiResponse<{ category: string; provinces: PajakRegionProvince[] }>>(
      `/catalog/pajak-regions/${category}`
    );
    return response.data;
  },
};
