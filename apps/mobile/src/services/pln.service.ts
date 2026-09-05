import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Mirror of web `src/services/pln/pln.service.ts` — POST /pln/inquiry only.
 * Session binding (user + customer_no) lives on the backend (PlnInquiryService, TTL 30m).
 * Purchase does NOT send inquiry_ref_id — POST /transactions uses target_number = customer_no.
 */

export type PlnInquiryResult = {
  customer_no: string;
  meter_no: string;
  subscriber_id: string;
  customer_name: string;
  segment_power: string;
  expires_in_seconds: number;
};

export const plnService = {
  inquire: async (customerNo: string): Promise<ApiResponse<PlnInquiryResult>> => {
    const response = await apiClient.post<ApiResponse<PlnInquiryResult>>('/pln/inquiry', {
      customer_no: customerNo,
    });
    return response.data;
  },
};
