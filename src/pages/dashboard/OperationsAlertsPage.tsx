import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Loader2, RefreshCw } from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';

export const OperationsAlertsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('open');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { per_page: 50 };
      if (status) params.status = status;
      const res = await operationsService.getAlerts(params);
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
  }, [status]);

  useRealtimeChannel(true, ['division.operations'], () => void load(), () => storageService.getToken());

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Ops Alert Center"
        subtitle="Lifecycle open → acknowledged → investigating → resolved → closed. App-level monitors only."
        icon={Bell}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs rounded-xl border border-gray-200 px-3 py-2"
        >
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </select>
        <button
          type="button"
          onClick={async () => {
            await operationsService.evaluateAlerts();
            await load();
          }}
          className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Evaluate Now
        </button>
      </div>
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
                {a.alertCode} · {a.severity} · {a.type} · {a.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.status === 'open' && (
                <button
                  type="button"
                  onClick={async () => {
                    await operationsService.ackAlert(a.id);
                    await load();
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                >
                  Ack
                </button>
              )}
              {['open', 'acknowledged'].includes(a.status) && (
                <button
                  type="button"
                  onClick={async () => {
                    await operationsService.investigateAlert(a.id);
                    await load();
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                >
                  Investigate
                </button>
              )}
              {!['resolved', 'closed'].includes(a.status) && (
                <button
                  type="button"
                  onClick={async () => {
                    await operationsService.resolveAlert(a.id);
                    await load();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Resolve
                </button>
              )}
              {a.status === 'resolved' && (
                <button
                  type="button"
                  onClick={async () => {
                    await operationsService.closeAlert(a.id);
                    await load();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
