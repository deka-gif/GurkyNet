import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { storageService } from '../../services/storage.service';
import { getRedirectPathForRole, UserRole } from '../../constants/auth';

interface GuestRouteProps {
  children: ReactElement;
}

export const GuestRoute = ({ children }: GuestRouteProps) => {
  const token = storageService.getToken();
  const isAuthenticated = !!token;

  if (isAuthenticated) {
    const user = storageService.getUser() as { role?: UserRole } | null;
    const role: UserRole = user?.role || 'User';
    const redirectPath = getRedirectPathForRole(role);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};
