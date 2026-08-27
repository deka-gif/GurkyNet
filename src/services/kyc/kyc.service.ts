import { apiClient } from '../api';
import { ApiResponse } from '../../types';

export type KycStatusPayload = {
  kycStatus: string;
  tier1: {
    complete: boolean;
    phoneVerified: boolean;
    emailVerified: boolean;
  };
  tier2: {
    status: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    verificationId: number | null;
  };
  verification?: Record<string, unknown> | null;
  withdrawEligibility?: {
    eligible: boolean;
    reasons: string[];
    kyc_ok: boolean;
    agent_ok: boolean;
    bank_ok: boolean;
  };
};

export const kycService = {
  status: async (): Promise<ApiResponse<KycStatusPayload>> => {
    const response = await apiClient.get<ApiResponse<KycStatusPayload>>('/kyc/status');
    return response.data;
  },

  requestPhoneOtp: async (): Promise<ApiResponse<{ dummy_sent_code?: string; expires_at?: string }>> => {
    const response = await apiClient.post('/kyc/tier1/phone/request');
    return response.data;
  },

  verifyPhone: async (code: string): Promise<ApiResponse<{ phoneVerified: boolean; tier1Complete: boolean }>> => {
    const response = await apiClient.post('/kyc/tier1/phone/verify', { code });
    return response.data;
  },

  requestEmailOtp: async (): Promise<ApiResponse<{ dummy_sent_code?: string; expires_at?: string }>> => {
    const response = await apiClient.post('/kyc/tier1/email/request');
    return response.data;
  },

  verifyEmail: async (code: string): Promise<ApiResponse<{ emailVerified: boolean; tier1Complete: boolean }>> => {
    const response = await apiClient.post('/kyc/tier1/email/verify', { code });
    return response.data;
  },

  submitTier2: async (form: FormData): Promise<ApiResponse<{ verification: Record<string, unknown> }>> => {
    const response = await apiClient.post('/kyc/tier2/submit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  adminList: async (base: 'customer-support' | 'finance', status = 'pending'): Promise<ApiResponse<{ items: any[] }>> => {
    const response = await apiClient.get(`/admin/${base}/kyc`, { params: { status } });
    return response.data;
  },

  adminShow: async (base: 'customer-support' | 'finance', id: number): Promise<ApiResponse<{ verification: any }>> => {
    const response = await apiClient.get(`/admin/${base}/kyc/${id}`);
    return response.data;
  },

  adminApprove: async (base: 'customer-support' | 'finance', id: number): Promise<ApiResponse<{ verification: any }>> => {
    const response = await apiClient.post(`/admin/${base}/kyc/${id}/approve`);
    return response.data;
  },

  adminReject: async (
    base: 'customer-support' | 'finance',
    id: number,
    rejection_reason: string
  ): Promise<ApiResponse<{ verification: any }>> => {
    const response = await apiClient.post(`/admin/${base}/kyc/${id}/reject`, { rejection_reason });
    return response.data;
  },
};
