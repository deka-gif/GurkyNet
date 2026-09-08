import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/** Mirrors Web src/services/tagihan/tagihan.service.ts — Digi pasca inquiry. */
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
  tax_details?: Record<string, string>;
  expires_in_seconds: number;
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
    const response = await apiClient.post<ApiResponse<TagihanInquiryResult>>(
      '/tagihan/inquiry',
      payload
    );
    return response.data;
  },
};
