import React, { useEffect, useState } from 'react';
import { financeLoyaltyService } from '../../services/loyalty/loyalty.service';
import { formatIDR as formatIdr } from '../../utils/currency';

/** FR-DIFF-01 — Finance Program Poin monitoring + adjustment */
export const FinanceLoyaltyPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [points, setPoints] = useState('100');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setOverview(await financeLoyaltyService.overview());
      const l = await financeLoyaltyService.ledger({ per_page: 30 });
      setLedger(l?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat program poin');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAdjust = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await financeLoyaltyService.adjust({
        user_id: Number(userId),
        points: Number(points),
        direction,
        reason,
      });
      setMessage(result?.already_processed ? 'Adjustment sudah diproses.' : 'Adjustment berhasil.');
      setReason('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Adjustment gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Finance</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Program Poin</h1>
        <p className="text-sm text-gray-500 mt-1">Monitoring saldo poin beredar & penyesuaian manual (FR-DIFF-01).</p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Poin Beredar</p>
          <p className="text-2xl font-extrabold mt-1">{overview?.points_in_circulation ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">≈ {formatIdr(Number(overview?.points_in_circulation || 0))}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Clawback Held</p>
          <p className="text-2xl font-extrabold mt-1">{overview?.points_held_clawback ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">User dengan Poin</p>
          <p className="text-2xl font-extrabold mt-1">{overview?.users_with_points ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-extrabold">Manual Adjustment (Finance/Owner)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'credit' | 'debit')}
          >
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Alasan (wajib)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy || !reason.trim() || !userId}
          onClick={onAdjust}
          className="rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan Adjustment'}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-extrabold mb-3">Ledger Poin</h2>
        <div className="space-y-2 max-h-96 overflow-auto">
          {ledger.map((row: any) => (
            <div key={row.id} className="flex justify-between gap-3 text-xs border-b border-slate-50 pb-2">
              <div>
                <p className="font-bold uppercase">{row.type}</p>
                <p className="text-slate-500">
                  User #{row.user_id} · {row.reason || row.reference || '—'}
                </p>
              </div>
              <p className="font-extrabold">{row.points}</p>
            </div>
          ))}
          {ledger.length === 0 && <p className="text-xs text-slate-400">Belum ada mutasi poin.</p>}
        </div>
      </div>
    </div>
  );
};
