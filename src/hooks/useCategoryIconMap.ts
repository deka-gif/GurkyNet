import { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { ApiResponse } from '../types';
import { CacheTTL, cachedFetch } from '../utils/queryCache';

/** Marketing-uploaded category icons: {key: iconPath}. Keys are 'hub:{id}' / 'sub:{hubId}:{childKey}'. */
export function useCategoryIconMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void cachedFetch<Record<string, string>>({
      key: 'category-icon-map',
      ttlMs: CacheTTL.CATEGORY_ICONS,
      fetcher: async () => {
        const res = await apiClient.get<ApiResponse<Record<string, string>>>('/catalog/category-icons');
        return res.data?.data || {};
      },
    }).then((result) => {
      if (!cancelled) setMap(result || {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}
