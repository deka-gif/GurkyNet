import { formatIDR } from '../../utils/currency';
import type { Product } from '../../types';

export type ProductPickerProps = {
  products: Product[];
  selected: Product | null;
  onSelect: (p: Product) => void;
};

export function ProductPicker({ products, selected, onSelect }: ProductPickerProps) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-bold text-gray-700">Pilih Paket</h5>
      {products.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          Tidak ada produk untuk zona ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={`text-left p-3 rounded-xl border ${
                selected?.id === p.id ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="text-xs font-extrabold text-gray-900">{p.name}</div>
              <div className="text-sm font-black text-primary-600 mt-1">{formatIDR(p.price)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
