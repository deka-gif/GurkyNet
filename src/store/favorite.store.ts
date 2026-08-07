import { create } from 'zustand';

const STORAGE_KEY = 'gn_favorite_products_v1';

export type FavoriteProduct = {
  id: string;
  code: string;
  name: string;
  price: number;
  category: string;
  operatorName?: string;
  route: string;
  targetNo?: string;
  badge?: string | null;
  addedAt: string;
};

type FavoriteState = {
  favorites: FavoriteProduct[];
  hydrated: boolean;
  hydrate: () => void;
  isFavorite: (id: string) => boolean;
  addFavorite: (item: Omit<FavoriteProduct, 'addedAt'> & { addedAt?: string }) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (item: Omit<FavoriteProduct, 'addedAt'> & { addedAt?: string }) => void;
  clearFavorites: () => void;
};

function readStorage(): FavoriteProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: FavoriteProduct[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Client-side favorites store.
 * Persists to localStorage now; swap hydrate/sync with API later without UI changes.
 */
export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ favorites: readStorage(), hydrated: true });
  },

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  addFavorite: (item) => {
    const current = get().favorites;
    if (current.some((f) => f.id === item.id)) return;
    const next = [
      {
        ...item,
        addedAt: item.addedAt || new Date().toISOString(),
      },
      ...current,
    ].slice(0, 50);
    writeStorage(next);
    set({ favorites: next, hydrated: true });
  },

  removeFavorite: (id) => {
    const next = get().favorites.filter((f) => f.id !== id);
    writeStorage(next);
    set({ favorites: next, hydrated: true });
  },

  toggleFavorite: (item) => {
    if (get().isFavorite(item.id)) {
      get().removeFavorite(item.id);
    } else {
      get().addFavorite(item);
    }
  },

  clearFavorites: () => {
    writeStorage([]);
    set({ favorites: [], hydrated: true });
  },
}));
