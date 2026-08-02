import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'bg-blue-50 text-blue-700 border-blue-200',
  icon: Icon,
  actions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
            {badge && (
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-sm text-gray-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};
