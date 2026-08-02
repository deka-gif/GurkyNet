import { create } from 'zustand';
import { systemSettingService } from '../services/systemSetting.service';

export interface SystemSettingState {
  settings: Record<string, string>;
  originalSettings: Record<string, string>;
  systemStatus: Record<string, any>;
  loading: boolean;
  saving: boolean;
  testingEmail: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings?: Record<string, any>) => Promise<{ success: boolean; message?: string; errors?: any }>;
  sendTestEmail: (email: string) => Promise<{ success: boolean; message?: string }>;
  setSettingField: (key: string, value: string) => void;
  resetSettings: () => void;
}

export const useSystemSettingStore = create<SystemSettingState>((set, get) => ({
  settings: {},
  originalSettings: {},
  systemStatus: {},
  loading: false,
  saving: false,
  testingEmail: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const res = await systemSettingService.getSettings();
      if (res && res.success !== false) {
        const loadedSettings = res.data?.settings || res.data || {};
        const loadedStatus = res.data?.system_status || res.data?.status || {};
        set({
          settings: loadedSettings,
          originalSettings: loadedSettings,
          systemStatus: loadedStatus,
          loading: false,
        });
      } else {
        set({
          error: res?.message || 'Gagal memuat pengaturan sistem.',
          loading: false,
        });
      }
    } catch (err: any) {
      set({
        error: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat memuat pengaturan sistem.',
        loading: false,
      });
    }
  },

  updateSettings: async (overrideSettings) => {
    set({ saving: true, error: null });
    const payload = overrideSettings || get().settings;
    try {
      const res = await systemSettingService.updateSettings(payload);
      if (res && res.success !== false) {
        const updated = res.data?.settings || res.data || payload;
        set({
          settings: updated,
          originalSettings: updated,
          saving: false,
        });
        return { success: true, message: res.message || 'Pengaturan sistem berhasil disimpan.' };
      } else {
        set({ saving: false });
        return { success: false, message: res?.message || 'Gagal menyimpan pengaturan sistem.', errors: res?.errors };
      }
    } catch (err: any) {
      set({ saving: false });
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
        errors: err?.response?.data?.errors,
      };
    }
  },

  sendTestEmail: async (email: string) => {
    set({ testingEmail: true });
    try {
      const res = await systemSettingService.sendTestEmail(email);
      set({ testingEmail: false });
      if (res && res.success !== false) {
        return { success: true, message: res.message || 'Email tes berhasil dikirim.' };
      } else {
        return { success: false, message: res?.message || 'Gagal mengirim email tes.' };
      }
    } catch (err: any) {
      set({ testingEmail: false });
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat mengirim email tes.',
      };
    }
  },

  setSettingField: (key: string, value: string) => {
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },

  resetSettings: () => {
    set((state) => ({
      settings: { ...state.originalSettings },
    }));
  },
}));
