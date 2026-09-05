import { create } from 'zustand';
import { catalogService, Category, CategoryIconMap, Product } from '../services/catalog.service';

interface CatalogState {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  fetchCategories: () => Promise<void>;

  /** Marketing category icons — keys `hub:{id}` / `sub:{hubId}:{childKey}`. */
  categoryIcons: CategoryIconMap;
  categoryIconsLoading: boolean;
  fetchCategoryIcons: () => Promise<void>;

  products: Product[];
  productsLoading: boolean;
  productsError: string | null;
  fetchProducts: (category: string, keyword?: string) => Promise<void>;

  productDetail: Product | null;
  productDetailLoading: boolean;
  productDetailError: string | null;
  fetchProductDetail: (skuCode: string) => Promise<void>;
  clearProductDetail: () => void;
}

/**
 * UI/catalog state only. Never a source of truth for balance, final transaction price,
 * transaction status, or provider selection — those stay backend-authoritative and are
 * fetched fresh at checkout time (a later phase), never derived from anything cached here.
 */
export const useCatalogStore = create<CatalogState>((set) => ({
  categories: [],
  categoriesLoading: false,
  categoriesError: null,
  fetchCategories: async () => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      const response = await catalogService.getCategories();
      if (response.success) {
        set({ categories: response.data, categoriesLoading: false });
      } else {
        set({ categoriesError: response.message, categoriesLoading: false });
      }
    } catch (err: any) {
      set({ categoriesError: err?.message || 'Gagal memuat kategori.', categoriesLoading: false });
    }
  },

  categoryIcons: {},
  categoryIconsLoading: false,
  fetchCategoryIcons: async () => {
    set({ categoryIconsLoading: true });
    try {
      const response = await catalogService.getCategoryIcons();
      if (response.success && response.data && typeof response.data === 'object') {
        set({ categoryIcons: response.data, categoryIconsLoading: false });
      } else {
        set({ categoryIconsLoading: false });
      }
    } catch {
      // Non-fatal — Home falls back to Ionicons when map is empty.
      set({ categoryIconsLoading: false });
    }
  },

  products: [],
  productsLoading: false,
  productsError: null,
  fetchProducts: async (category, keyword) => {
    set({ productsLoading: true, productsError: null, products: [] });
    try {
      const response = await catalogService.getProducts({ category, keyword, per_page: 50 });
      if (response.success) {
        set({ products: response.data, productsLoading: false });
      } else {
        set({ productsError: response.message, productsLoading: false });
      }
    } catch (err: any) {
      set({ productsError: err?.message || 'Gagal memuat produk.', productsLoading: false });
    }
  },

  productDetail: null,
  productDetailLoading: false,
  productDetailError: null,
  fetchProductDetail: async (skuCode) => {
    set({ productDetailLoading: true, productDetailError: null, productDetail: null });
    try {
      const response = await catalogService.getProduct(skuCode);
      if (response.success) {
        set({ productDetail: response.data, productDetailLoading: false });
      } else {
        set({ productDetailError: response.message, productDetailLoading: false });
      }
    } catch (err: any) {
      set({ productDetailError: err?.message || 'Gagal memuat detail produk.', productDetailLoading: false });
    }
  },
  clearProductDetail: () => set({ productDetail: null, productDetailError: null }),
}));
