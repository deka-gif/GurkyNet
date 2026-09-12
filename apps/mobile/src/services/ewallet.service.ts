import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Digiflazz E-Money inquiry — same contract as Web
 * `src/services/ewallet/ewallet.service.ts` → POST /ewallet/inquiry.
 * Inquiry only — never debits wallet.
 */
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
    customerNo: string,
    amount: number
  ): Promise<ApiResponse<EwalletInquiryResult>> => {
    const response = await apiClient.post<ApiResponse<EwalletInquiryResult>>('/ewallet/inquiry', {
      sku_code: skuCode,
      customer_no: customerNo,
      amount,
    });
    return response.data;
  },
};
