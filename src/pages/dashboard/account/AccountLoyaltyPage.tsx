import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { AccountShell, AccountCard } from './AccountShell';
import { loyaltyService } from '../../../services/loyalty/loyalty.service';
import { formatIDR as formatIdr } from '../../../utils/currency';

/** FR-DIFF-01 / FR-DIFF-08 — Poin & Loyalitas (SRS 13.7) */
export const AccountLoyaltyPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [points, setPoints] = useState('100');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const s = await loyaltyService.getSummary();
      setSummary(s);
      const h = await loyaltyService.getHistory(20);
      setHistory(h?.data || h?.items || (Array.isArray(h) ? h : []));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat loyalty');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRedeem = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await loyaltyService.redeem(Number(points));
      setMessage(
        result?.already_processed
          ? 'Redeem sudah diproses sebelumnya.'
          : `Berhasil redeem ${result?.points} poin → ${formatIdr(Number(result?.wallet_credit || 0))}`
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Redeem gagal');
    } finally {
      setBusy(false);
    }
  };

  const gmv = Number(summary?.monthly_gmv || 0);
  const nextTier = (summary?.tiers || []).find(
    (t: any) => Number(t.min_monthly_transaction) > gmv
  );

  return (
    <AccountShell title="Poin & Loyalitas" subtitle="Saldo poin, tier, dan penukaran ke wallet.">
      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
      {message && <p className="text-sm text-emerald-700 mb-3">{message}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <AccountCard>
          <p className="text-[10px] font-bold uppercase text-slate-400">Saldo Poin</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {summary?.available_points ?? summary?.points_balance ?? 0}
          </p>
        </AccountCard>
        <AccountCard>
          <p className="text-[10px] font-bold uppercase text-slate-400">Tier Saat Ini</p>
          <p className="text-2xl font-extrabold text-primary-700 mt-1">{summary?.current_tier || 'Reguler'}</p>
          {summary?.grace_anchor_month && (
            <p className="text-[11px] text-amber-700 mt-1">Grace sejak {summary.grace_anchor_month}</p>
          )}
        </AccountCard>
        <AccountCard>
          <p className="text-[10px] font-bold uppercase text-slate-400">GMV Bulan Ini</p>
          <p className="text-lg font-extrabold text-gray-900 mt-1">{formatIdr(gmv)}</p>
          {nextTier && (
            <p className="text-[11px] text-slate-500 mt-1">
              Menuju {nextTier.name}: {formatIdr(Number(nextTier.min_monthly_transaction) - gmv)} lagi
            </p>
          )}
        </AccountCard>
      </div>

      <AccountCard>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
            <Gift className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-gray-900">Redeem ke Wallet</h3>
            <p className="text-xs text-slate-500 mt-0.5">Minimum 100 poin. 1 poin = Rp1. Partial redeem diperbolehkan.</p>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <input
                type="number"
                min={100}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
              />
              <button
                type="button"
                disabled={busy}
                onClick={onRedeem}
                className="rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                {busy ? 'Memproses…' : 'Tukar Poin'}
              </button>
            </div>
          </div>
        </div>
      </AccountCard>

      <AccountCard>
        <h3 className="text-sm font-extrabold text-gray-900 mb-2">Cara memperoleh poin</h3>
        <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
          <li>{summary?.rules?.earn || 'Rp10.000 SUCCESS = 100 poin (floor).'}</li>
          <li>{summary?.rules?.redeem || 'Minimum redeem 100 poin ke wallet.'}</li>
          <li>{summary?.rules?.expiry || 'Poin kadaluarsa 12 bulan.'}</li>
          <li>Tier: Reguler → Silver (1jt) → Gold (3jt) → Platinum (5jt) GMV SUCCESS / bulan.</li>
          <li>Earn rate tetap 1% di semua tier. Loyalty terpisah dari harga agen.</li>
        </ul>
      </AccountCard>

      <AccountCard>
        <h3 className="text-sm font-extrabold text-gray-900 mb-3">Riwayat Poin</h3>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-xs text-slate-400">Belum ada riwayat.</p>}
          {history.map((row: any) => (
            <div key={row.id} className="flex justify-between gap-3 border-b border-slate-50 pb-2 text-xs">
              <div>
                <p className="font-bold text-slate-800 uppercase">{row.type}</p>
                <p className="text-slate-500">{row.reason || row.reference || '—'}</p>
              </div>
              <p className={`font-extrabold ${Number(row.points) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {Number(row.points) >= 0 ? '+' : ''}
                {row.points}
              </p>
            </div>
          ))}
        </div>
      </AccountCard>
    </AccountShell>
  );
};
