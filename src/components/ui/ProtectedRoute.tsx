import { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { storageService } from '../../services/storage.service';
import { UserRole } from '../../constants/auth';

interface ProtectedRouteProps {
  children: ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();
  const token = storageService.getToken();
  const isAuthenticated = !!token;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const user = storageService.getUser() as { role?: UserRole; email?: string } | null;
  const userRole: UserRole = user?.role || 'User';

  // Super Admin has access to all routes
  if (userRole === 'Super Admin') {
    return children;
  }

  // Route protection logic if specific allowedRoles prop passed
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Path-based protection fallback
  const path = location.pathname;

  // Executive Owner section: Only Owner
  if (path.startsWith('/dashboard/owner')) {
    if (userRole !== 'Owner') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Customer Support section: Only CS & Owner
  if (path.startsWith('/dashboard/customer-support')) {
    if (userRole !== 'Customer Support' && userRole !== 'Owner') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Finance section: Only Finance & Owner
  if (path.startsWith('/dashboard/finance')) {
    if (userRole !== 'Finance' && userRole !== 'Owner') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Operations section: Only Operations & Owner
  if (path.startsWith('/dashboard/operations')) {
    if (userRole !== 'Operations' && userRole !== 'Owner') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Marketing section: Only Marketing & Owner
  if (path.startsWith('/dashboard/marketing')) {
    if (userRole !== 'Marketing' && userRole !== 'Owner') {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

