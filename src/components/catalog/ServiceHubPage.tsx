import { Link } from 'react-router-dom';
import { LucideIcon, ChevronRight } from 'lucide-react';

export type HubChild = {
  key: string;
  label: string;
  description?: string;
  path: string;
  icon?: LucideIcon;
  /** Tailwind classes for icon tile — brand-aligned teal/emerald family */
  tone?: string;
};

interface ServiceHubPageProps {
  title: string;
  subtitle: string;
  children: HubChild[];
}

const DEFAULT_HUB_TONES: Record<string, string> = {
  pulsa: 'bg-primary-50 text-primary-700 border-primary-100',
  data: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'voucher-internet': 'bg-teal-50 text-teal-700 border-teal-100',
  'sms-telepon': 'bg-primary-50 text-primary-600 border-primary-100',
  'masa-aktif': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'aktivasi-perdana': 'bg-primary-100/60 text-primary-800 border-primary-200',
  esim: 'bg-teal-50 text-teal-800 border-teal-100',
  pln: 'bg-accent-300/25 text-primary-900 border-accent-400/30',
  'pln-pascabayar': 'bg-accent-300/20 text-primary-800 border-accent-400/25',
  pdam: 'bg-primary-50 text-primary-700 border-primary-100',
  'bpjs-kesehatan': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'bpjs-tk': 'bg-teal-50 text-teal-700 border-teal-100',
  internet: 'bg-primary-50 text-primary-600 border-primary-100',
  tv: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  gas: 'bg-accent-300/20 text-primary-800 border-accent-400/25',
  pbb: 'bg-primary-50 text-primary-700 border-primary-100',
  samsat: 'bg-teal-50 text-teal-700 border-teal-100',
  multifinance: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  lainnya: 'bg-gray-50 text-gray-600 border-gray-100',
};

/**
 * Category hub: user picks a service first, then provider → product flow.
 */
export function ServiceHubPage({ title, subtitle, children }: ServiceHubPageProps) {
  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children.map((item) => {
          const Icon = item.icon;
          const tone = item.tone || DEFAULT_HUB_TONES[item.key] || 'bg-primary-50 text-primary-600 border-primary-100';
          return (
            <Link
              key={item.key}
              to={item.path}
              className="group dashboard-panel !p-4 !rounded-2xl !shadow-sm hover:!shadow-md hover:border-primary-200/80 flex items-center gap-4 transition-all duration-200"
            >
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tone}`}
              >
                {Icon ? <Icon className="w-5 h-5" /> : <span className="text-sm font-black">{item.label.slice(0, 2)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-gray-900 text-sm group-hover:text-primary-700 transition-colors">
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.description}</div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 shrink-0 transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
