import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storageService } from '../../services/storage.service';
import { useAuthStore } from '../../store/auth.store';
import { getRedirectPathForRole } from '../../constants/auth';

export const GoogleLandingPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login?google_error=' + encodeURIComponent('Login Google gagal.'), { replace: true });
      return;
    }
    storageService.setToken(token, true);
    fetchUser().then(() => {
      const role = useAuthStore.getState().user?.role || 'User';
      navigate(getRedirectPathForRole(role) || '/dashboard', { replace: true });
    });
  }, [params, navigate, fetchUser]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Menyelesaikan login dengan Google...</p>
    </div>
  );
};
