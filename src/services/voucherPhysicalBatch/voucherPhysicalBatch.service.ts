import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type VoucherPhysicalItemStatus = 'queued' | 'processing' | 'success' | 'failed' | 'refunded';
export type VoucherPhysicalBatchStatus = 'pending' | 'processing' | 'completed' | 'completed_with_failures';

export interface VoucherPhysicalBatchItem {
  id: number;
  serialNumber: string;
  status: VoucherPhysicalItemStatus;
  scannedAt: string | null;
  submittedAt: string | null;
  activatedAt: string | null;
  failureReason: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  retryCount: number;
}

export interface VoucherPhysicalBatch {
  id: number;
  transactionId: number;
  invoiceNumber: string | null;
  status: VoucherPhysicalBatchStatus;
  transactionStatus: string | null;
  skuCode: string;
  operatorName: string | null;
  quotaLabel: string | null;
  unitPrice: number;
  totalSerials: number;
  successCount: number;
  failedCount: number;
  refundedCount: number;
  totalPayment: number;
  items?: VoucherPhysicalBatchItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVoucherPhysicalBatchPayload {
  sku_code: string;
  serials: { serial_number: string; scanned_at?: string }[];
  pin: string;
  idempotency_key: string;
}

export const voucherPhysicalBatchService = {
  create: async (data: CreateVoucherPhysicalBatchPayload): Promise<ApiResponse<VoucherPhysicalBatch>> => {
    const response = await apiClient.post<ApiResponse<VoucherPhysicalBatch>>('/voucher-internet/physical-batches', data);
    return response.data;
  },

  getById: async (id: number | string): Promise<ApiResponse<VoucherPhysicalBatch>> => {
    const response = await apiClient.get<ApiResponse<VoucherPhysicalBatch>>(`/voucher-internet/physical-batches/${id}`);
    return response.data;
  },

  retryItem: async (batchId: number | string, itemId: number | string): Promise<ApiResponse<VoucherPhysicalBatchItem>> => {
    const response = await apiClient.post<ApiResponse<VoucherPhysicalBatchItem>>(
      `/voucher-internet/physical-batches/${batchId}/items/${itemId}/retry`
    );
    return response.data;
  },
};
