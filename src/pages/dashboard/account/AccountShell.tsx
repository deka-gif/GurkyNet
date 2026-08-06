import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export const AccountShell: React.FC<{
  title: string;
  subtitle?: string;
  backTo?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, backTo = '/dashboard/account/settings', children }) => (
  <div className="max-w-3xl mx-auto space-y-6" id="account-center-root">
    <div className="flex items-start gap-3">
      <Link
        to={backTo}
        className="mt-1 p-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-500"
        aria-label="Kembali"
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

export const AccountCard: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({
  children,
  className = '',
  id,
}) => (
  <div id={id} className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>
);
