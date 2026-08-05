import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral' | 'warning';
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
  badge,
  className = '',
  onClick,
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-emerald-600 bg-emerald-50';
      case 'negative':
        return 'text-rose-600 bg-rose-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`p-2.5 rounded-2xl ${iconBg} ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
        {badge && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {badge}
          </span>
        )}
      </div>
      {change && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${getChangeColor()}`}>
            {change}
          </span>
        </div>
      )}
    </div>
  );
};

