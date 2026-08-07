import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, Loader2, RefreshCw } from 'lucide-react';
import { ownerService } from '../../services/owner.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const OwnerExecutiveAlertsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ownerService.getExecutiveAlerts();
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
      <CmsPageHeader
        title="Executive Alert Center"
        subtitle="Gabungan Finance alerts, Ops alerts, dan Workflow critical — SSOT lintas divisi."
        icon={Bell}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => void load()}
        className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-2"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
      <div className="rounded-2xl border bg-white shadow-sm divide-y">
        {loading && (
          <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">Tidak ada alert.</div>
        )}
        {rows.map((a) => (
          <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-600 mt-1">{a.body}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {a.sourceDivision} · {a.severity} · {a.status} · impact {a.impact}
              </p>
            </div>
            {a.drillDown && (
              <Link to={a.drillDown} className="px-3 py-1.5 rounded-xl border text-xs font-bold">
                Drill down
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
