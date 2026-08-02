import { create } from 'zustand';
import { productService, ProductFilters } from '../services/product/product.service';
import { Product, Pagination } from '../types';

interface ProductState {
  products: Product[];
  categories: any[];
  providers: any[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  fetchProducts: (filters?: ProductFilters) => Promise<void>;
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
  pagination: null,
  loading: false,
  error: null,

  fetchProducts: async (filters) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.getProducts(filters);
      if (response.success) {
        set({ products: response.data, pagination: response.pagination || null, loading: false });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (err: any) {
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
