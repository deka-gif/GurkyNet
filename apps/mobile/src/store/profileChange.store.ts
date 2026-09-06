import { create } from 'zustand';

/**
 * Ephemeral identity-change session — memory only.
 * Holds pending new_phone / new_email between screens.
 * Never stores password, PIN, or OTP.
 */
type ProfileChangeState = {
  pendingPhone: string | null;
  pendingEmail: string | null;
  setPendingPhone: (phone: string | null) => void;
  setPendingEmail: (email: string | null) => void;
  clear: () => void;
};

export const useProfileChangeStore = create<ProfileChangeState>((set) => ({
  pendingPhone: null,
  pendingEmail: null,
  setPendingPhone: (phone) => set({ pendingPhone: phone }),
  setPendingEmail: (email) => set({ pendingEmail: email }),
  clear: () => set({ pendingPhone: null, pendingEmail: null }),
}));
