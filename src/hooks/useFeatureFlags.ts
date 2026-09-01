import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../config/features';

let cached: FeatureFlags | null = null;
let inflight: Promise<FeatureFlags> | null = null;

async function loadFeatures(force = false): Promise<FeatureFlags> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: FeatureFlags }>('/features');
      const data = res.data?.data;
      if (data && typeof data.purchase_enabled === 'boolean') {
        cached = {
          purchase_enabled: !!data.purchase_enabled,
          withdraw_enabled: !!data.withdraw_enabled,
          auto_topup_enabled: !!data.auto_topup_enabled,
          messages: {
            purchase: data.messages?.purchase || DEFAULT_FEATURE_FLAGS.messages.purchase,
            withdraw: data.messages?.withdraw || DEFAULT_FEATURE_FLAGS.messages.withdraw,
            auto_topup: data.messages?.auto_topup || DEFAULT_FEATURE_FLAGS.messages.auto_topup,
          },
        };
        return cached;
      }
    } catch {
      // Fail closed for this call, but do not cache — next loadFeatures() retries the API.
    }
    return DEFAULT_FEATURE_FLAGS;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(cached || DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await loadFeatures(true);
    setFlags(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    void loadFeatures().then((next) => {
      if (alive) {
        setFlags(next);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return { flags, loading, refresh };
}

export { loadFeatures };
