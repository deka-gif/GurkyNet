import { create } from 'zustand';
import { productService, ProductFilters, CategoryProviderSummary } from '../services/product/product.service';
import { Product, Pagination } from '../types';
import { cachedFetch, CacheTTL } from '../utils/queryCache';

let categoryProvidersRequestSeq = 0;
let productsRequestSeq = 0;

interface ProductState {
  products: Product[];
  categories: any[];
  providers: any[];
  categoryProviders: CategoryProviderSummary[];
  categoryProvidersLoading: boolean;
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  fetchProducts: (filters?: ProductFilters) => Promise<void>;
  fetchCategoryProviders: (category: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  getProductsByCategory: (category: Product['category']) => Product[];
  addProduct: (data: Partial<Product>) => Promise<boolean>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<boolean>;
  removeProduct: (id: string) => Promise<boolean>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  providers: [],
  categoryProviders: [],
  categoryProvidersLoading: false,
  pagination: null,
  loading: false,
  error: null,

  fetchCategoryProviders: async (category) => {
    const requestId = ++categoryProvidersRequestSeq;
    set({ categoryProvidersLoading: true, error: null });
    try {
      const data = await cachedFetch<CategoryProviderSummary[]>({
        key: `products:providers:${category}`,
        ttlMs: CacheTTL.CATEGORY,
        fetcher: async () => {
          const response = await productService.getCategoryProviders(category);
          if (!response.success) {
            throw new Error(response.message || 'Gagal memuat daftar provider.');
          }
          return response.data;
        },
      });
      if (categoryProvidersRequestSeq !== requestId) return;
      set({ categoryProviders: data, categoryProvidersLoading: false });
    } catch (err: any) {
      if (categoryProvidersRequestSeq !== requestId) return;
      set({
        categoryProviders: [],
        error: err.message || 'Gagal memuat daftar provider.',
        categoryProvidersLoading: false,
      });
    }
  },

  fetchProducts: async (filters) => {
    const requestId = ++productsRequestSeq;
    set({ loading: true, error: null });
    try {
      const data = await cachedFetch<{ items: Product[]; pagination: Pagination | null }>({
        key: `products:list:${JSON.stringify(filters || {})}`,
        ttlMs: CacheTTL.PRODUCTS,
        fetcher: async () => {
          const response = await productService.getProducts(filters);
          if (!response.success) {
            throw new Error(response.message || 'Gagal memuat daftar produk.');
          }
          return { items: response.data, pagination: response.pagination || null };
        },
      });
      if (productsRequestSeq !== requestId) return;
      set({ products: data.items, pagination: data.pagination, loading: false });
    } catch (err: any) {
      if (productsRequestSeq !== requestId) return;
      set({ error: err.message || 'Gagal memuat daftar produk.', loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const response = await productService.getCategories();
      if (response.success) {
        set({ categories: response.data });
      }
    } catch {
      // Ignore
    }
  },

  fetchProviders: async () => {
    try {
      const response = await productService.getProviders();
      if (response.success) {
        set({ providers: response.data });
      }
    } catch {
      // Ignore
    }
  },

  getProductsByCategory: (category) => {
    return get().products.filter((p) => p.category === category);
  },

  addProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.createProduct(data);
      if (response.success) {
        set({ products: [...get().products, response.data], loading: false });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal membuat produk.', loading: false });
      return false;
    }
  },

  updateProduct: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.updateProduct(id, data);
      if (response.success) {
        set({
          products: get().products.map((p) => (p.id === id ? response.data : p)),
          loading: false,
        });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memperbarui produk.', loading: false });
      return false;
    }
  },

  removeProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.deleteProduct(id);
      if (response.success) {
        set({
          products: get().products.filter((p) => p.id !== id),
          loading: false,
        });
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal menghapus produk.', loading: false });
      return false;
    }
  },
}));
