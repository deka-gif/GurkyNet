import type { ReactNode } from 'react';

type Props = {
  /** Short summary shown left of the primary button (e.g. product · price). */
  meta: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Extra classes on the outer fixed bar (rarely needed). */
  className?: string;
};

/**
 * Mobile-only sticky purchase CTA (web browser HP).
 * - Visible below `lg` (`lg:hidden`); pair with `max-lg:hidden` on in-flow desktop CTAs.
 * - Sits above DashboardLayout bottom nav (`bottom-16` &lt; md, `bottom-0` from md–lg).
 * Pattern: VoucherFisik scan sticky + mobile PlnTokenCatalogFlow stickyBar.
 */
export function MobileStickyActionBar({
  meta,
  label,
  onClick,
  disabled = false,
  loading = false,
  className = '',
}: Props) {
  return (
    <div
      className={`fixed inset-x-0 z-30 lg:hidden border-t border-gray-100 bg-white/95 backdrop-blur-sm shadow-[0_-8px_24px_rgba(15,23,42,0.08)] bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 ${className}`}
      role="region"
      aria-label="Aksi pembelian"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3 max-w-5xl mx-auto">
        <div className="min-w-0 flex-1 text-xs font-extrabold text-gray-900 truncate">{meta}</div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className="shrink-0 py-3 px-5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm"
        >
          {loading ? 'Memproses...' : label}
        </button>
      </div>
    </div>
  );
}

/** Bottom padding so page content clears sticky bar + mobile bottom nav. */
export const MOBILE_STICKY_ACTION_PAD = 'max-lg:pb-36';
