import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type EwalletInquiryResult = {
  inquiry_ref_id: string;
  sku_code: string;
  product_name: string;
  provider_name: string;
  customer_no: string;
  customer_name: string;
  bill_amount: number;
  nominal_amount: number;
  admin_fee: number;
  selling_price: number;
  is_ewallet?: boolean;
  expires_in_seconds: number;
};

export const ewalletService = {
  inquire: async (
    skuCode: string,
    customerNo: string
  ): Promise<ApiResponse<EwalletInquiryResult>> => {
    const response = await apiClient.post<ApiResponse<EwalletInquiryResult>>('/ewallet/inquiry', {
      sku_code: skuCode,
      customer_no: customerNo,
    });
    return response.data;
  },
};
