import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { getRedirectPathForRole, UserRole } from '../../constants/auth';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const user = storageService.getUser() as { role?: UserRole; name?: string; email?: string } | null;
  const userRole = user?.role || 'User';

  const handleReturnToDashboard = () => {
    const targetPath = getRedirectPathForRole(userRole);
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-red-50 text-red-600 rounded-3xl border border-red-100 flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-red-100 text-red-800 text-[11px] font-mono font-bold rounded-full uppercase tracking-wider">
            HTTP 403 Forbidden
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Akses Ditolak / Restricted Area
          </h1>
          <p className="text-sm font-medium text-gray-600 leading-relaxed">
            You do not have permission to access this page.
          </p>
        </div>

        {user && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-400">Logged in as:</span>
              <span className="font-bold text-gray-800">{user.name || user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Assigned Role:</span>
              <span className="font-mono font-bold text-blue-600">{userRole}</span>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleReturnToDashboard}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/20 transition-all duration-200 text-sm"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-400 font-mono">
          GurkyNet Role-Based Access Control (RBAC) System
        </p>
      </div>
    </div>
  );
};
