import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';
import { FeatureFlags } from '../config/features';

/** GET /features — public snapshot of transaction feature gates (same as web). */
export const featuresService = {
  getFlags: async (): Promise<ApiResponse<FeatureFlags>> => {
    const response = await apiClient.get<ApiResponse<FeatureFlags>>('/features');
    return response.data;
  },
};
