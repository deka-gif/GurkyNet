import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { AccountShell, AccountCard } from './AccountShell';
import { referralService } from '../../../services/referral/referral.service';
import { formatIDR as formatIdr } from '../../../utils/currency';

/** SRS 13.7 / FR-REF-07 — Referral (own data only) */
export const AccountReferralPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [customCode, setCustomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const s = await referralService.getSummary();
      setSummary(s);
      setCustomCode(s?.code || '');
      const h = await referralService.getHistory(20);
      setHistory(h?.data || (Array.isArray(h) ? h : []));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat referral');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSaveCode = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const row = await referralService.setCode(customCode);
      setMessage(`Kode diperbarui: ${row.code}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal menyimpan kode');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell title="Referral" subtitle="Kode & komisi ajak teman" icon={<Users className="h-5 w-5" />}>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {message && <p className="text-sm text-emerald-700 mb-3">{message}</p>}

      <AccountCard title="Kode Saya">
        <p className="text-2xl font-semibold tracking-wide mb-2">{summary?.code || '—'}</p>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className="border rounded px-3 py-2 text-sm"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            maxLength={20}
            placeholder="Custom 6–20 alphanumeric"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onSaveCode}
            className="px-3 py-2 text-sm rounded bg-slate-900 text-white disabled:opacity-50"
          >
            Simpan kode
          </button>
        </div>
      </AccountCard>

      <AccountCard title="Ringkasan Downline">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>Level 1: <strong>{summary?.level_1_count ?? 0}</strong></div>
          <div>Level 2: <strong>{summary?.level_2_count ?? 0}</strong></div>
          <div>Pending: <strong>{formatIdr(Number(summary?.pending_total || 0))}</strong></div>
          <div>Released: <strong>{formatIdr(Number(summary?.released_total || 0))}</strong></div>
          <div>Reversed: <strong>{formatIdr(Number(summary?.reversed_total || 0))}</strong></div>
        </div>
      </AccountCard>

      <AccountCard title="Riwayat Komisi">
        <ul className="space-y-2 text-sm">
          {(history || []).map((row: any) => (
            <li key={row.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>
                L{row.level} · {row.status}
              </span>
              <span>{formatIdr(Number(row.amount || 0))}</span>
            </li>
          ))}
          {!history?.length && <li className="text-slate-500">Belum ada komisi.</li>}
        </ul>
      </AccountCard>
    </AccountShell>
  );
};
