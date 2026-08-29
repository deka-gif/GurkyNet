import { Link } from 'react-router-dom';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { categoryTone } from '../../config/catalogCategories';

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
  /** Category id untuk lookup warna jewel-tone — lihat CATEGORY_TONES di src/config/catalogCategories.ts */
  tone: string;
}

/**
 * Category hub: user pilih layanan dulu, baru masuk ke provider/produk.
 * Semua item di 1 halaman hub pakai 1 jewel-tone yang sama, senada dengan warna tile kategori induknya di Home.
 */
export function ServiceHubPage({ title, subtitle, children, tone }: ServiceHubPageProps) {
  const style = categoryTone(tone);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.path}
              className="group dashboard-panel !p-4 !rounded-2xl !shadow-sm hover:!shadow-md hover:border-primary-200/80 flex items-center gap-4 transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${style.bg}`}>
                <div className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl text-white shadow-md ${style.gradient} ${style.shadow}`}>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/35 via-transparent to-transparent" />
                  {Icon ? <Icon className="relative w-4 h-4" /> : <span className="relative text-[10px] font-black">{item.label.slice(0, 2)}</span>}
                </div>
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
