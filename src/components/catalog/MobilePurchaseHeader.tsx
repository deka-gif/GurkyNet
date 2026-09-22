import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Compact purchase-page header for web mobile (mirrors APK stack header).
 * Desktop callers should keep this behind `md:hidden`.
 * FR — WEB MOBILE UX: Pulsa / Paket Data purchase chrome.
 */
export function MobilePurchaseHeader({
  title,
  backTo = '/dashboard',
}: {
  title: string;
  backTo?: string;
}) {
  return (
    <header className="flex items-center gap-1 -mx-1 min-h-11">
      <Link
        to={backTo}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        aria-label="Kembali"
      >
        <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
      </Link>
      <h1 className="text-lg font-extrabold text-gray-900 tracking-tight truncate">{title}</h1>
    </header>
  );
}
