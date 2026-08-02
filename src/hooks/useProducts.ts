import { useEffect, useMemo } from 'react';
import { useProductStore } from '../store/product.store';
import { Product } from '../types';

export const useProducts = (autoFetch = false) => {
  const {
    products,
    loading,
    error,
    fetchProducts,
    getProductsByCategory,
    addProduct,
    updateProduct,
    removeProduct,
  } = useProductStore();

  useEffect(() => {
    if (autoFetch && products.length === 0 && !loading) {
      fetchProducts();
    }
  }, [autoFetch, products, loading, fetchProducts]);

  // Handy pre-grouped products categories
  const groupedProducts = useMemo(() => {
    return {
      pulsa: products.filter((p) => p.category === 'pulsa'),
      data: products.filter((p) => p.category === 'data'),
      pln: products.filter((p) => p.category === 'pln'),
      ewallet: products.filter((p) => p.category === 'ewallet'),
      transfer: products.filter((p) => p.category === 'transfer'),
    };
  }, [products]);

  return {
    products,
    groupedProducts,
    loading,
    error,
    fetchProducts,
    getProductsByCategory,
    addProduct,
    updateProduct,
    removeProduct,
  };
};
