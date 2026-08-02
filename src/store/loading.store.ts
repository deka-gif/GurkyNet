import { create } from 'zustand';

interface LoadingState {
  loadingKeys: Record<string, boolean>;
  globalLoading: boolean;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
  setGlobalLoading: (loading: boolean) => void;
  clearLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  loadingKeys: {},
  globalLoading: false,

  startLoading: (key) => set((state) => {
    const updatedKeys = { ...state.loadingKeys, [key]: true };
    return {
      loadingKeys: updatedKeys,
      globalLoading: Object.values(updatedKeys).some(Boolean),
    };
  }),

  stopLoading: (key) => set((state) => {
    const updatedKeys = { ...state.loadingKeys, [key]: false };
    return {
      loadingKeys: updatedKeys,
      globalLoading: Object.values(updatedKeys).some(Boolean),
    };
  }),

  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  clearLoading: () => set({ loadingKeys: {}, globalLoading: false }),
}));
