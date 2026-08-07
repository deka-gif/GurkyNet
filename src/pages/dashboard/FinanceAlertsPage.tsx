import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Loader2, RefreshCw } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const FinanceAlertsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await financeService.getAlerts({ status: 'open', per_page: 50 });
      setRows(res?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Finance Alert Center" subtitle="Refund spike, low deposit, gateway offline, settlement delay — dari data nyata." icon={Bell} />
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={async () => { await financeService.evaluateAlerts(); await load(); }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Evaluate Now
        </button>
      </div>
      <div className="rounded-2xl border bg-white shadow-sm divide-y">
        {loading && <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>}
        {!loading && rows.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Tidak ada alert terbuka.</div>}
        {rows.map((a) => (
          <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-600 mt-1">{a.body}</p>
              <p className="text-[11px] text-gray-400 mt-1">{a.alertCode} · {a.severity} · {a.type}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={async () => { await financeService.ackAlert(a.id); await load(); }} className="px-3 py-1.5 rounded-xl border text-xs font-bold">Ack</button>
              <button type="button" onClick={async () => { await financeService.resolveAlert(a.id); await load(); }} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Resolve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
