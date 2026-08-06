import { apiClient } from '../api';
import { ApiResponse } from '../../types';

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
