import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const FinanceLedgerPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [eventType, setEventType] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await financeService.getLedger({ q: q || undefined, event_type: eventType || undefined, per_page: 50 });
        setRows(res?.data || []);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Gagal memuat ledger.');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventType]);

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Finance Ledger" subtitle="Append-only journal audit. Immutable — tidak ada edit/hapus." icon={BookOpen} />
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.form as any)} placeholder="Cari kode / invoice…" className="flex-1 text-xs rounded-xl border px-3 py-2" />
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="text-xs rounded-xl border px-3 py-2">
          <option value="">All events</option>
          <option value="wallet_topup">wallet_topup</option>
          <option value="wallet_refund">wallet_refund</option>
          <option value="refund_approve">refund_approve</option>
          <option value="refund_reject">refund_reject</option>
          <option value="product_purchase">product_purchase</option>
          <option value="settlement">settlement</option>
          <option value="manual_adjustment">manual_adjustment</option>
        </select>
        <button type="button" onClick={async () => {
          setLoading(true);
          try {
            const res = await financeService.getLedger({ q: q || undefined, event_type: eventType || undefined, per_page: 50 });
            setRows(res?.data || []);
          } finally {
            setLoading(false);
          }
        }} className="px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold">Cari</button>
      </div>
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {loading && <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Event</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-right px-4 py-3">Debit</th>
                <th className="text-right px-4 py-3">Credit</th>
                <th className="text-left px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs">{r.ledgerCode}</td>
                  <td className="px-4 py-3 font-semibold">{r.eventType}</td>
                  <td className="px-4 py-3 text-xs">{r.invoice || '—'}</td>
                  <td className="px-4 py-3 text-right">{r.debit ? formatIdr(r.debit) : '—'}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-bold">{r.credit ? formatIdr(r.credit) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID') : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Ledger kosong.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
