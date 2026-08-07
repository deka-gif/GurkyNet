import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { ownerService } from '../../services/owner.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const OwnerExecutiveApprovalsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ownerService.getApprovals();
      setRows(res?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    const note = window.prompt(`Catatan ${decision}:`, '') || undefined;
    setBusyId(id);
    try {
      await ownerService.decideApproval(id, decision, note);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Keputusan gagal.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Executive Approval Center"
        subtitle="Hanya approval strategis. Owner tidak mengeksekusi refund/sync — keputusan dikembalikan ke divisi."
        icon={ShieldCheck}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      <div className="rounded-2xl border bg-white shadow-sm divide-y">
        {loading && (
          <div className="p-8 text-center text-gray-400 text-sm flex justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">Tidak ada approval menunggu Owner.</div>
        )}
        {rows.map((a) => (
          <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-gray-900">{a.title}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {a.workflowCode} · {a.category} · {a.division} · {a.priority}
                {a.amount != null ? ` · Rp ${Number(a.amount).toLocaleString('id-ID')}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => void decide(a.id, 'approve')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => void decide(a.id, 'reject')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
