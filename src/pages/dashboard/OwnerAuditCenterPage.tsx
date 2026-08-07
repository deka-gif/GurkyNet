import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';
import { ownerService } from '../../services/owner.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const OwnerAuditCenterPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ownerService.getAuditLogs({
        search: search || undefined,
        module: module || undefined,
        page,
        per_page: 30,
      });
      const payload = res?.data;
      setRows(Array.isArray(payload) ? payload : payload?.data || []);
      setMeta(res?.meta || payload?.meta || null);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Executive Audit Center"
        subtitle="Login, permission, configuration, security, approval — terpisah dari workflow timeline bisnis."
        icon={FileText}
      />
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Cari aktivitas…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border"
          />
        </div>
        <input
          value={module}
          onChange={(e) => setModule(e.target.value)}
          placeholder="Module filter"
          className="text-xs rounded-xl border px-3 py-2"
        />
        <button type="button" onClick={() => { setPage(1); void load(); }} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold">
          Filter
        </button>
      </div>
      <div className="rounded-2xl border bg-white shadow-sm divide-y">
        {loading && (
          <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
          </div>
        )}
        {!loading && rows.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Tidak ada log.</div>}
        {rows.map((log: any, idx: number) => (
          <div key={log.id || idx} className="p-4">
            <p className="text-sm font-bold text-gray-900">{log.activity || log.action || log.description || 'Activity'}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {log.created_at || log.createdAt || '—'} · {log.user?.name || log.operator || log.user_id || 'system'}
            </p>
          </div>
        ))}
      </div>
      {meta && (
        <div className="flex gap-2 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">
            Prev
          </button>
          <span className="py-1.5 text-gray-500">
            Page {meta.current_page || page} / {meta.last_page || 1}
          </span>
          <button
            type="button"
            disabled={(meta.current_page || page) >= (meta.last_page || 1)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
