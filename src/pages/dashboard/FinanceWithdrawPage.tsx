import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Banknote } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';
import { getOrCreateIdempotencyKey } from '../../utils/idempotency';

/** FR-FIN-05 — antrean withdraw hold → approve / reject / hold. */
export const FinanceWithdrawPage: React.FC = () => {
  const readOnly = useOwnerReadOnly();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const keyRef = useRef<string | null>(null);

  const load = async () => {
    try {
      const res = await financeService.listWithdrawals({ per_page: 50 });
      setRows(Array.isArray(res?.data) ? res.data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (kind: 'approve' | 'reject' | 'hold', id: number) => {
    if (readOnly) return;
    if (kind === 'reject' && !reason.trim()) {
      setError('Alasan penolakan wajib.');
      return;
    }
    keyRef.current = null;
    const key = getOrCreateIdempotencyKey(keyRef);
    try {
      if (kind === 'approve') await financeService.approveWithdrawal(id, key, notes || undefined);
      if (kind === 'reject') await financeService.rejectWithdrawal(id, reason.trim(), key);
      if (kind === 'hold') await financeService.holdWithdrawal(id, key, notes || undefined);
      keyRef.current = null;
      setReason('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Withdraw" subtitle="FR-FIN-05 hold → antrean Finance (approve / reject / hold)" icon={Banknote} />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      {!readOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Alasan reject" value={reason} onChange={(e) => setReason(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Catatan hold/approve (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white p-4 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-bold">
                {r.user?.name || r.user_id} · {formatIdr(r.amount)} (+fee {formatIdr(r.admin_fee || 0)})
              </p>
              <p className="text-[11px] text-gray-500">
                {r.bank_name} {r.account_number} · status {r.status} · workflow {r.workflow}
              </p>
            </div>
            {!readOnly && ['pending', 'on_hold'].includes(r.status) && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 font-bold" onClick={() => act('approve', r.id)}>
                  Approve
                </button>
                <button type="button" className="rounded-lg bg-amber-600 text-white px-3 py-1.5 font-bold" onClick={() => act('hold', r.id)}>
                  Hold
                </button>
                <button type="button" className="rounded-lg bg-red-600 text-white px-3 py-1.5 font-bold" onClick={() => act('reject', r.id)}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-400">Antrean kosong.</p>}
      </div>
    </div>
  );
};
