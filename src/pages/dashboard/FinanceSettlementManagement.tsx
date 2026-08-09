import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { RefreshPolicy } from '../../lib/refreshPolicy';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

export const FinanceSettlementManagement: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Finance.
  const isOwnerReadOnly = useOwnerReadOnly();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await financeService.getSettlements({
        status: statusFilter || undefined,
        per_page: 50,
      });
      const rows = res?.data?.data || res?.data || [];
      setItems(Array.isArray(rows) ? rows : []);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat settlement.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedId]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetail(await financeService.getSettlement(id));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat detail.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useRealtimeChannel(true, ['division.finance'], () => {
    void load();
    if (selectedId) void loadDetail(selectedId);
  }, () => storageService.getToken(), RefreshPolicy.finance);

  const create = async () => {
    const amount = Number(window.prompt('Nominal settlement:', '0') || 0);
    if (!amount) return;
    const gateway = window.prompt('Gateway (midtrans/qris/va/...):', 'midtrans') || 'midtrans';
    setBusy(true);
    try {
      const row = await financeService.createSettlement({ gateway, amount, notes: 'Created from Settlement Queue' });
      setSelectedId(row.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal membuat settlement.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!selectedId) return;
    const notes = window.prompt('Catatan (opsional):', '') || undefined;
    setBusy(true);
    try {
      await financeService.updateSettlement(selectedId, { status, notes });
      await load();
      await loadDetail(selectedId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Update gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Settlement Queue"
        subtitle="Executable settlement lifecycle — tanpa auto-payout bank. Terhubung Workflow Engine."
        icon={CheckCircle2}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[70vh]">
        <div className="xl:col-span-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 text-xs rounded-xl border px-3 py-2"
            >
              <option value="">All status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
            <button type="button" onClick={() => void load()} className="px-3 border rounded-xl">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {!isOwnerReadOnly && (
              <button type="button" onClick={() => void create()} className="px-3 bg-emerald-600 text-white rounded-xl">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {loading && (
              <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
              </div>
            )}
            {!loading && items.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Queue kosong.</div>}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-3 hover:bg-gray-50 ${selectedId === item.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''}`}
              >
                <p className="text-sm font-extrabold">{item.settlementCode}</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {item.gateway} · {formatIdr(item.amount)} · <span className="font-semibold">{item.status}</span>
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-5 rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          {!detail && <p className="text-sm text-gray-400">Pilih settlement.</p>}
          {detail && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-mono text-gray-400">{detail.settlementCode}</p>
                <h2 className="text-lg font-black">{formatIdr(detail.amount)}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {detail.gateway} {detail.provider ? `· ${detail.provider}` : ''} · {detail.status}
                </p>
                <p className="text-xs text-gray-400 mt-1">Workflow: {detail.workflowCode || '—'} · Auto payout: tidak</p>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.notes || '—'}</p>
              {!isOwnerReadOnly && (
                <div className="flex flex-wrap gap-2">
                  {detail.status === 'pending' && (
                    <button type="button" disabled={busy} onClick={() => void setStatus('processing')} className="px-3 py-1.5 rounded-xl border text-xs font-bold">
                      Start Processing
                    </button>
                  )}
                  {['pending', 'processing'].includes(detail.status) && (
                    <>
                      <button type="button" disabled={busy} onClick={() => void setStatus('completed')} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                        Complete
                      </button>
                      <button type="button" disabled={busy} onClick={() => void setStatus('cancelled')} className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold">
                        Cancel
                      </button>
                      <button type="button" disabled={busy} onClick={() => void setStatus('failed')} className="px-3 py-1.5 rounded-xl border text-xs font-bold">
                        Mark Failed
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-3 rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-3 text-sm">
          <p className="text-xs font-extrabold uppercase text-gray-400">Context</p>
          {detail ? (
            <>
              <Row label="Batch" value={detail.batchNumber || '—'} />
              <Row label="Reference" value={detail.settlementReference || '—'} />
              <Row label="Created by" value={detail.createdByName || '—'} />
              <Row label="Reviewed by" value={detail.reviewedByName || '—'} />
              <Row label="Completed" value={detail.completedAt ? new Date(detail.completedAt).toLocaleString('id-ID') : '—'} />
            </>
          ) : (
            <p className="text-gray-400">—</p>
          )}
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
    <p className="font-semibold text-gray-800 break-all">{value}</p>
  </div>
);
