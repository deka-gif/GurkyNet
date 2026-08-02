import { useAuthStore } from '../store/auth.store';

export const useAuth = () => {
  const {
    user,
    token,
    loading,
    error,
    validationErrors,
    login,
    register,
    forgotPassword,
    logout,
    fetchUser,
  } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    error,
    validationErrors,
    login,
    register,
    forgotPassword,
    logout,
    fetchUser,
  };
};
