import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className="p-4 bg-gray-50 text-gray-400 rounded-3xl border border-gray-100">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-base font-extrabold text-gray-900">{title}</h4>
      {description && <p className="text-xs text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
