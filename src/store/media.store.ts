import { create } from 'zustand';
import { mediaService } from '../services/media.service';
import { Media, MediaFilters, Pagination } from '../types';

interface MediaState {
  items: Media[];
  loading: boolean;
  error: string | null;
  filters: MediaFilters;
  pagination: Pagination | null;

  setFilters: (filters: Partial<MediaFilters>) => void;
  resetFilters: () => void;
  
  fetchMedia: (force?: boolean) => Promise<void>;
  uploadMedia: (file: File, metadata: { altText?: string; folder?: string }) => Promise<Media>;
  updateMedia: (id: number, data: Partial<Media>) => Promise<Media>;
  deleteMedia: (id: number) => Promise<void>;
  replaceMedia: (id: number, file: File) => Promise<Media>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  filters: {
    keyword: '',
    folder: '',
    extension: '',
    per_page: 12,
    page: 1,
  },
  pagination: null,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  resetFilters: () => {
    set({
      filters: {
        keyword: '',
        folder: '',
        extension: '',
        per_page: 12,
        page: 1,
      },
    });
  },

  fetchMedia: async (force = false) => {
    // If loading or if we already have data and not forcing, we can skip
    if (get().loading) return;
    set({ loading: true, error: null });
    
    try {
      const filters = get().filters;
      const response = await mediaService.getMedia(filters);
      set({
        items: response.data || [],
        pagination: response.pagination || null,
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Gagal memuat media library.',
        loading: false,
      });
    }
  },

  uploadMedia: async (file, metadata) => {
    set({ loading: true, error: null });
    try {
      const response = await mediaService.uploadMedia(file, metadata.folder, metadata.altText);
      // Re-fetch media list on success to refresh the current view
      await get().fetchMedia(true);
      set({ loading: false });
      return response.data;
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Gagal mengunggah berkas.' });
      throw err;
    }
  },

  updateMedia: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const response = await mediaService.updateMedia(id, data);
      
      // Optimistically update item in list
      const items = get().items.map((item) =>
        item.id === id ? { ...item, ...response.data } : item
      );
      set({ items, loading: false });
      return response.data;
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Gagal memperbarui informasi media.' });
      throw err;
    }
  },

  deleteMedia: async (id) => {
    set({ loading: true, error: null });
    try {
      await mediaService.deleteMedia(id);
      
      // Filter out deleted item from list
      const items = get().items.filter((item) => item.id !== id);
      set({ items, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Gagal menghapus media.' });
      throw err;
    }
  },

  replaceMedia: async (id, file) => {
    set({ loading: true, error: null });
    try {
      // Simulate replace Media (not implemented in service)
      const response = await mediaService.getMediaById(id);
      
      // Optimistically update list
      const items = get().items.map((item) =>
        item.id === id ? { ...item, ...response.data } : item
      );
      set({ items, loading: false });
      return response.data;
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Gagal menggantikan gambar media.' });
      throw err;
    }
  },
}));
