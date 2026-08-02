import { useProfileStore } from '../store/profile.store';

export const useProfile = () => {
  const { profile, loading, error, fetchProfile } = useProfileStore();

  return {
    profile,
    loading,
    error,
    fetchProfile,
  };
};
