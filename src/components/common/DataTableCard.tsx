import React from 'react';

export interface DataTableCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export const DataTableCard: React.FC<DataTableCardProps> = ({
  title,
  subtitle,
  action,
  badge,
  children,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
            {badge && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};
