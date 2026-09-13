/**
 * Shared "Muat lebih banyak" control for web catalog product lists.
 */
export function CatalogLoadMoreButton(props: {
  visible: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!props.visible) return null;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.loading}
      className="w-full mt-2 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-extrabold text-primary-700 hover:bg-primary-50 disabled:opacity-60"
    >
      {props.loading ? 'Memuat…' : 'Muat lebih banyak'}
    </button>
  );
}
