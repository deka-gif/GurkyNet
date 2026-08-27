import React, { useEffect, useState } from 'react';
import { ownerCashFlowService } from '../../services/sprint15/differentiator.service';
import { formatIDR as formatIdr } from '../../utils/currency';

/** FR-DIFF-10 — Owner 30-day cash-flow projection. */
export const OwnerCashFlowProjectionPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ownerCashFlowService
      .projection()
      .then(setData)
      .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Gagal memuat'));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Owner</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Prediksi Cash Flow</h1>
        <p className="text-sm text-gray-500 mt-1">Horizon 30 hari · moving average dari data aktual (FR-DIFF-10).</p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400">MA Harian</p>
              <p className="text-xl font-extrabold mt-1">
                {data.sufficient_history ? formatIdr(Number(data.moving_average_daily_sales || 0)) : '—'}
              </p>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyeksi 30 Hari</p>
              <p className="text-xl font-extrabold mt-1">
                {data.sufficient_history ? formatIdr(Number(data.projected_30_day_total || 0)) : 'Insufficient data'}
              </p>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400">Generated</p>
              <p className="text-xs font-bold mt-2">{data.generated_at}</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-extrabold mb-2">Saldo Provider</h2>
            {(data.provider_balances || []).map((p: any) => (
              <div key={p.code} className="flex justify-between text-xs border-b border-slate-50 py-2">
                <span className="font-bold uppercase">{p.code}</span>
                <span>{p.balance == null ? 'n/a' : formatIdr(Number(p.balance))}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">{data.disclaimer}</p>
          <p className="text-[11px] text-slate-500">
            Source: {data.source?.sales} · {data.source?.providers}
          </p>
        </>
      )}
    </div>
  );
};
