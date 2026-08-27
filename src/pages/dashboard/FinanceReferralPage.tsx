import React, { useEffect, useState } from 'react';
import { financeReferralService } from '../../services/referral/referral.service';
import { formatIDR as formatIdr } from '../../utils/currency';

/** SRS 31.6 / 13.4 — Finance Program Referral */
export const FinanceReferralPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [level, setLevel] = useState(1);
  const [percentage, setPercentage] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const o = await financeReferralService.getOverview();
      setOverview(o);
      const l = await financeReferralService.getLedger();
      setLedger(l?.data || []);
      const f = await financeReferralService.getFraudFlags();
      setFlags(f?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat referral finance');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSaveRule = async () => {
    setError(null);
    setMessage(null);
    try {
      await financeReferralService.updateRule({
        level,
        percentage: Number(percentage),
        reason: reason || 'Finance update',
      });
      setMessage('Rule diperbarui');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal update rule');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Program Referral</h1>
      <p className="text-sm text-slate-600">
        Fraud thresholds: <strong>belum dikonfigurasi</strong> (NULL). Flag-only, no auto-block.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <section className="rounded border p-4 space-y-2">
        <h2 className="font-medium">Overview</h2>
        <pre className="text-xs overflow-auto bg-slate-50 p-2 rounded">
          {JSON.stringify(overview?.by_status || [], null, 2)}
        </pre>
        <div className="text-sm">
          Cap harian {formatIdr(Number(overview?.caps?.daily_cap || 0))} · bulanan{' '}
          {formatIdr(Number(overview?.caps?.monthly_cap || 0))}
        </div>
        <div className="text-sm">Finance review open: {overview?.finance_review_open ?? 0}</div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-medium">Commission Rules</h2>
        <ul className="text-sm">
          {(overview?.rules || []).map((r: any) => (
            <li key={r.id}>
              L{r.level}: {r.percentage}%
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="border rounded px-2 py-1" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
          </select>
          <input
            className="border rounded px-2 py-1 w-24"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 flex-1 min-w-[12rem]"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="button" className="px-3 py-1 rounded bg-slate-900 text-white text-sm" onClick={onSaveRule}>
            Simpan
          </button>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-medium mb-2">Ledger (terbaru)</h2>
        <ul className="text-sm space-y-1">
          {ledger.slice(0, 20).map((row: any) => (
            <li key={row.id} className="flex justify-between">
              <span>
                #{row.id} L{row.level} {row.status}
              </span>
              <span>{formatIdr(Number(row.amount || 0))}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-medium mb-2">Fraud Flags</h2>
        <ul className="text-sm space-y-1">
          {flags.slice(0, 20).map((f: any) => (
            <li key={f.id}>
              {f.signal} · {f.status}
            </li>
          ))}
          {!flags.length && <li className="text-slate-500">Tidak ada flag.</li>}
        </ul>
      </section>
    </div>
  );
};
