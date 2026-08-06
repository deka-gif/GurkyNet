import { Link } from 'react-router-dom';
import { LucideIcon, ChevronRight } from 'lucide-react';

export type HubChild = {
  key: string;
  label: string;
  description?: string;
  path: string;
  icon?: LucideIcon;
};

interface ServiceHubPageProps {
  title: string;
  subtitle: string;
  children: HubChild[];
}

/**
 * Category hub: user picks a service first, then provider → product flow.
 */
export function ServiceHubPage({ title, subtitle, children }: ServiceHubPageProps) {
  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.path}
              className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-primary-300 hover:bg-primary-50/20 shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                {Icon ? <Icon className="w-5 h-5" /> : <span className="text-sm font-black">{item.label.slice(0, 2)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-gray-900 text-sm group-hover:text-primary-700">{item.label}</div>
                {item.description && (
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">{item.description}</div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
