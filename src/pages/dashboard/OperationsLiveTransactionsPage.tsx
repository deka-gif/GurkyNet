import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';

export const OperationsLiveTransactionsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { per_page: 40 };
      if (status) params.status = status;
      if (provider) params.provider = provider;
      if (q) params.q = q;
      const res = await operationsService.getLiveTransactions(params);
      setRows(res?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status, provider]);

  useRealtimeChannel(true, ['division.operations'], () => void load(), () => storageService.getToken());

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Live Transactions"
        subtitle="Feed transaksi terbaru dari database — filter status / provider."
        icon={Activity}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
          placeholder="Cari invoice / target…"
          className="text-xs rounded-xl border border-gray-200 px-3 py-2 min-w-[180px]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs rounded-xl border border-gray-200 px-3 py-2"
        >
          <option value="">All status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
        </select>
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="Provider code"
          className="text-xs rounded-xl border border-gray-200 px-3 py-2 w-36"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Service</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Provider</th>
              <th className="text-left px-4 py-3">RC</th>
              <th className="text-right px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
                  </span>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Tidak ada transaksi.
                </td>
              </tr>
            )}
            {rows.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-bold text-gray-900">{tx.invoice || `#${tx.id}`}</td>
                <td className="px-4 py-3 text-gray-600">{tx.customerName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{tx.serviceName || '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold uppercase">{tx.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{tx.providerCode || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{tx.rc != null ? String(tx.rc) : '—'}</td>
                <td className="px-4 py-3 text-right font-bold">
                  Rp {Number(tx.totalPayment || 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
