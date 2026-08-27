import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Landmark } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';
import { getOrCreateIdempotencyKey } from '../../utils/idempotency';

/** FR-FIN-03 antrean deposit manual + FR-FIN-04 riwayat Midtrans otomatis. */
export const FinanceDepositPage: React.FC = () => {
  const readOnly = useOwnerReadOnly();
  const [tab, setTab] = useState<'manual' | 'automatic'>('manual');
  const [manual, setManual] = useState<any[]>([]);
  const [auto, setAuto] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const approveKeyRef = useRef<string | null>(null);
  const rejectKeyRef = useRef<string | null>(null);

  const load = async () => {
    try {
      const [m, a] = await Promise.all([
        financeService.listManualDeposits({ status: 'pending', per_page: 50 }),
        financeService.listAutomaticDeposits({ per_page: 50 }),
      ]);
      setManual(Array.isArray(m?.data) ? m.data : []);
      setAuto(Array.isArray(a?.data) ? a.data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: number) => {
    if (readOnly) return;
    approveKeyRef.current = null;
    const key = getOrCreateIdempotencyKey(approveKeyRef);
    try {
      await financeService.approveManualDeposit(id, key);
      approveKeyRef.current = null;
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  const reject = async (id: number) => {
    if (readOnly) return;
    if (!reason.trim()) {
      setError('Alasan penolakan wajib.');
      return;
    }
    rejectKeyRef.current = null;
    const key = getOrCreateIdempotencyKey(rejectKeyRef);
    try {
      await financeService.rejectManualDeposit(id, reason.trim(), key);
      rejectKeyRef.current = null;
      setReason('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Deposit" subtitle="FR-FIN-03 antrean manual · FR-FIN-04 riwayat Midtrans" icon={Landmark} />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'manual' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => setTab('manual')}>
          Antrean Manual
        </button>
        <button type="button" className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'automatic' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => setTab('automatic')}>
          Riwayat Otomatis
        </button>
      </div>

      {tab === 'manual' && (
        <div className="space-y-3">
          {!readOnly && (
            <input className="w-full max-w-md rounded-xl border px-3 py-2 text-sm" placeholder="Alasan reject (wajib saat tolak)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          {manual.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-white p-4 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="font-bold">{d.user?.name || d.user_id} · {formatIdr(d.amount)}</p>
                <p className="text-[11px] text-gray-500">{d.notes || '-'} · status {d.status}</p>
                {d.proof_url && (
                  <a className="text-[11px] text-emerald-700 font-bold underline" href={d.proof_url} target="_blank" rel="noreferrer">
                    Lihat bukti
                  </a>
                )}
              </div>
              {!readOnly && d.status === 'pending' && (
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 font-bold" onClick={() => approve(d.id)}>
                    Approve
                  </button>
                  <button type="button" className="rounded-lg bg-red-600 text-white px-3 py-1.5 font-bold" onClick={() => reject(d.id)}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {manual.length === 0 && <p className="text-sm text-gray-400">Antrean kosong.</p>}
        </div>
      )}

      {tab === 'automatic' && (
        <div className="space-y-2">
          {auto.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-white px-4 py-3 text-sm flex justify-between gap-2">
              <div>
                <p className="font-bold font-mono text-[12px]">{d.midtrans_order_id}</p>
                <p className="text-[11px] text-gray-500">
                  {d.transaction_status} · {d.payment_type || '-'} · credited={String(d.credited)}
                </p>
                <p className="text-[10px] text-gray-400">{d.created_at}</p>
              </div>
              <p className="font-extrabold">{formatIdr(d.gross_amount)}</p>
            </div>
          ))}
          {auto.length === 0 && <p className="text-sm text-gray-400">Belum ada riwayat Midtrans.</p>}
        </div>
      )}
    </div>
  );
};
