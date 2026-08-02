import { create } from 'zustand';
import { profileService } from '../services/profile/profile.service';
import { Profile } from '../types';

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const response = await profileService.getProfile();
      if (response.success && response.data) {
        set({ profile: response.data, loading: false });
      } else {
        set({ error: response.message || 'Gagal memuat profil.', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Gagal memuat profil.', loading: false });
    }
  }
}));
