import { apiClient } from '../api/client';
import { ApiResponse } from '../api/types';

/**
 * Customer-facing subset of BannerResource
 * (laravel/app/Http/Resources/BannerResource.php).
 * Same public contract as web `src/types` Banner + `bannerService.getBanners`.
 */
export interface Banner {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  /** Desktop/primary image — absolute media URL from API. */
  image?: string;
  imageUrl?: string;
  /** Prefer this on mobile when Marketing uploaded a mobile asset. */
  mobileImageUrl?: string;
  mobile_image_url?: string;
  redirectUrl?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  status?: string;
}

export const bannerService = {
  /** GET /public/banners — active + in-schedule banners, ordered for display. */
  getBanners: async (): Promise<ApiResponse<Banner[]>> => {
    const response = await apiClient.get<ApiResponse<Banner[]>>('/public/banners');
    return response.data;
  },
};
