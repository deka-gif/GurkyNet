import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api';

type SearchPayload = {
  hubs?: Array<{ key: string; label: string; path?: string }>;
  services?: Array<{ key: string; label: string; path?: string; hub_label?: string }>;
  providers?: Array<{ id: number; name: string }>;
  products?: Array<{ code?: string; name?: string; category?: string; operatorName?: string; price?: number }>;
};

/**
 * Catalog search across hub / service / provider / product (API-driven).
 */
export function CatalogSearchBar() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchPayload | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/catalog/search', { params: { q: q.trim(), per_page: 12 } });
        setData(res.data?.data || null);
        setOpen(true);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path?: string | null) => {
    if (!path) return;
    setOpen(false);
    setQ('');
    navigate(path);
  };

  const hubPath = (key: string) => {
    const map: Record<string, string> = {
      telekomunikasi: '/dashboard/telekomunikasi',
      'pembayaran-tagihan': '/dashboard/tagihan',
      'topup-digital': '/dashboard/topup-digital',
      game: '/dashboard/game',
      'voucher-digital': '/dashboard/voucher-digital',
      'langganan-digital': '/dashboard/langganan-digital',
      international: '/dashboard/international',
    };
    return map[key] || '/dashboard';
  };

  const categoryPath = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('game')) return '/dashboard/game';
    if (c.includes('langganan') || c.includes('streaming')) return '/dashboard/langganan-digital';
    if (c.includes('voucher-digital') || c === 'voucher') return '/dashboard/voucher-digital';
    if (c.includes('topup') || c.includes('ewallet')) return '/dashboard/topup-digital';
    if (c.includes('international')) return '/dashboard/international';
    if (c.includes('pulsa')) return '/dashboard/pulsa';
    if (c.includes('data')) return '/dashboard/paket-data';
    if (c.includes('pln')) return '/dashboard/token-pln';
    return '/dashboard';
  };

  return (
    <div className="relative w-full max-w-xl">
      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => data && setOpen(true)}
        placeholder="Cari ML, Netflix, OVO, Pulsa..."
        className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-gray-100 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />}

      {open && data && (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-gray-100 bg-white shadow-xl max-h-80 overflow-y-auto">
          {(data.hubs?.length || 0) > 0 && (
            <div className="p-2 border-b border-gray-50">
              <div className="px-2 py-1 text-[10px] font-black uppercase text-gray-400">Kategori</div>
              {data.hubs!.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => go(h.path || hubPath(h.key))}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-800"
                >
                  {h.label}
                </button>
              ))}
            </div>
          )}
          {(data.services?.length || 0) > 0 && (
            <div className="p-2 border-b border-gray-50">
              <div className="px-2 py-1 text-[10px] font-black uppercase text-gray-400">Layanan</div>
              {data.services!.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(s.path)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-800"
                >
                  {s.label}
                  {s.hub_label && <span className="text-gray-400 font-medium"> · {s.hub_label}</span>}
                </button>
              ))}
            </div>
          )}
          {(data.providers?.length || 0) > 0 && (
            <div className="p-2 border-b border-gray-50">
              <div className="px-2 py-1 text-[10px] font-black uppercase text-gray-400">Provider</div>
              {data.providers!.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const n = p.name.toLowerCase();
                    if (/(gopay|ovo|dana|shopee|linkaja|grab|maxim)/.test(n)) go('/dashboard/topup-digital');
                    else if (/(netflix|spotify|vidio|wetv|viu|canva|youtube)/.test(n)) go('/dashboard/langganan-digital');
                    else if (/(google play|steam wallet|razer|unipin|playstation|xbox)/.test(n)) go('/dashboard/voucher-digital');
                    else if (/(mobile legend|free fire|pubg|roblox|valorant|genshin)/.test(n)) go('/dashboard/game');
                    else go('/dashboard/game');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-800"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {(data.products?.length || 0) > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-[10px] font-black uppercase text-gray-400">Produk</div>
              {data.products!.slice(0, 8).map((p, i) => (
                <button
                  key={`${p.code}-${i}`}
                  type="button"
                  onClick={() => go(categoryPath(p.category))}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-800"
                >
                  {p.name}
                  {p.operatorName && <span className="text-gray-400 font-medium"> · {p.operatorName}</span>}
                </button>
              ))}
            </div>
          )}
          {!data.hubs?.length && !data.services?.length && !data.providers?.length && !data.products?.length && (
            <div className="p-4 text-xs text-gray-400 text-center">Tidak ada hasil untuk “{q}”</div>
          )}
        </div>
      )}
    </div>
  );
}
