import { useEffect } from 'react';
import { useBannerStore } from '../store/banner.store';

export const useBanner = (autoFetch = false) => {
  const { banners, loading, error, fetchBanners, addBanner, removeBanner } = useBannerStore();

  useEffect(() => {
    if (autoFetch) {
      fetchBanners();
    }
  }, []);

  return {
    banners,
    loading,
    error,
    fetchBanners,
    addBanner,
    removeBanner,
  };
};
