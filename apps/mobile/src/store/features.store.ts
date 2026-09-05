import { create } from 'zustand';
import { DEFAULT_FEATURE_FLAGS, FeatureFlags } from '../config/features';
import { featuresService } from '../services/features.service';

interface FeaturesState {
  flags: FeatureFlags;
  /** True until the first fetch settles (success or fail-closed). */
  loading: boolean;
  /** True only after a successful API response with a boolean purchase_enabled. */
  resolved: boolean;
  fetchFeatures: () => Promise<void>;
}

function normalizeFlags(data: Partial<FeatureFlags> | null | undefined): FeatureFlags | null {
  if (!data || typeof data.purchase_enabled !== 'boolean') return null;
  return {
    purchase_enabled: !!data.purchase_enabled,
    withdraw_enabled: !!data.withdraw_enabled,
    auto_topup_enabled: !!data.auto_topup_enabled,
    messages: {
      purchase: data.messages?.purchase || DEFAULT_FEATURE_FLAGS.messages.purchase,
      withdraw: data.messages?.withdraw || DEFAULT_FEATURE_FLAGS.messages.withdraw,
      auto_topup: data.messages?.auto_topup || DEFAULT_FEATURE_FLAGS.messages.auto_topup,
    },
  };
}

/**
 * Fail-closed: until /features resolves successfully, purchase_enabled stays false.
 * Failed fetches do not flip to true; they leave defaults and allow retry.
 */
export const useFeaturesStore = create<FeaturesState>((set) => ({
  flags: DEFAULT_FEATURE_FLAGS,
  loading: true,
  resolved: false,

  fetchFeatures: async () => {
    set({ loading: true });
    try {
      const response = await featuresService.getFlags();
      const next = response.success ? normalizeFlags(response.data) : null;
      if (next) {
        set({ flags: next, loading: false, resolved: true });
        return;
      }
      set({ flags: DEFAULT_FEATURE_FLAGS, loading: false, resolved: false });
    } catch {
      set({ flags: DEFAULT_FEATURE_FLAGS, loading: false, resolved: false });
    }
  },
}));

/** UX gate: only true when flags loaded successfully AND purchase is enabled. */
export function selectPurchaseEnabled(state: FeaturesState): boolean {
  return state.resolved && !state.loading && state.flags.purchase_enabled;
}
