import { Product } from '../../types';
import { formatIDR } from '../../utils/currency';
import { isProductPurchasable } from '../../utils/catalogAvailability';

/**
 * Compact 2-col product tile for web mobile purchase grids (APK-like density).
 * FR — WEB MOBILE UX: Pulsa / Paket Data product cards.
 */
export function MobileCompactProductTile({
  product,
  selected,
  onSelect,
  meta,
}: {
  product: Product;
  selected: boolean;
  onSelect: (p: Product) => void;
  /** Optional second line (quota · validity). */
  meta?: string | null;
}) {
  const purchasable = isProductPurchasable(product);

  return (
    <button
      type="button"
      disabled={!purchasable}
      onClick={() => onSelect(product)}
      className={`min-h-[4.5rem] w-full rounded-xl border px-2.5 py-2.5 text-left flex flex-col justify-between gap-1 transition-colors touch-manipulation ${
        selected
          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/30'
          : 'border-gray-200 bg-white active:bg-gray-50'
      } ${!purchasable ? 'opacity-55' : ''}`}
    >
      <span className="text-[11px] font-bold text-gray-900 leading-snug line-clamp-2">{product.name}</span>
      {meta ? (
        <span className="text-[10px] font-semibold text-gray-500 leading-tight line-clamp-1">{meta}</span>
      ) : null}
      <span className="text-sm font-extrabold text-primary-700 leading-none mt-auto">
        {formatIDR(product.price)}
      </span>
      {!purchasable ? (
        <span className="text-[9px] font-bold text-amber-700">Maintenance</span>
      ) : null}
    </button>
  );
}

export function MobileCompactProductSkeleton() {
  return (
    <div className="animate-pulse min-h-[4.5rem] rounded-xl border border-gray-100 bg-white p-2.5 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-4/5" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-2/5 mt-auto" />
    </div>
  );
}
