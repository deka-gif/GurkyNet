import React, { useEffect, useState } from 'react';
import { Users, Copy, TrendingUp, Clock } from 'lucide-react';
import { AccountShell, AccountCard } from './AccountShell';
import { referralService } from '../../../services/referral/referral.service';
import { formatIDR as formatIdr } from '../../../utils/currency';
import { toastError, toastSuccess } from '../../../hooks/useToast';

function formatJoinedDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusBadgeClass(status: string): string {
  if (status === 'released') return 'bg-primary-100 text-primary-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-700';
}

/** SRS 13.7 / FR-REF-07 — Referral (own data only) */
export const AccountReferralPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [downlines, setDownlines] = useState<any[]>([]);
  const [customCode, setCustomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) toastError('Terjadi Kesalahan', error);
  }, [error]);

  useEffect(() => {
    if (message) toastSuccess('Berhasil', message);
  }, [message]);

  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        referralService.getSummary(),
        referralService.getHistory(20),
      ]);
      setSummary(s);
      setCustomCode(s?.code || '');
      setHistory(h?.data || (Array.isArray(h) ? h : []));

      try {
        const dl = await referralService.getDownlines(20);
        setDownlines(dl?.data || (Array.isArray(dl) ? dl : []));
      } catch {
        setDownlines([]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat referral');
    }
  };

  useEffect(() => {
    void load();
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

  const copyCode = async () => {
    if (!summary?.code) return;
    await navigator.clipboard.writeText(summary.code);
    setMessage('Kode referral disalin.');
  };

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <AccountShell title="Referral" subtitle="Kode & komisi ajak teman" icon={<Users className="h-5 w-5" />}>
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary-100">Kode Saya</p>
        <div className="rounded-2xl border-2 border-dashed border-white/40 bg-white/10 p-4">
          <p className="text-2xl font-black tracking-widest text-center">{summary?.code || '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold border border-white/20"
          >
            <Copy className="w-3.5 h-3.5" /> Salin
          </button>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className="flex-1 min-w-[140px] rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            maxLength={20}
            placeholder="Custom 6–20 alphanumeric"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onSaveCode}
            className="px-4 py-2 text-sm rounded-xl bg-white text-primary-800 font-bold disabled:opacity-50"
          >
            Simpan kode
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase text-gray-400">Level 1</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{summary?.level_1_count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase text-gray-400">Level 2</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{summary?.level_2_count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase text-gray-400">Total Komisi Cair</p>
          <p className="text-lg font-black text-primary-700 mt-1">
            {formatIdr(Number(summary?.released_total || 0))}
          </p>
        </div>
      </div>

      <AccountCard title="Teman yang Diundang">
        {downlines.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada teman yang diundang.</p>
        ) : (
          <ul className="space-y-3">
            {downlines.map((row, idx) => (
              <li key={`${row.name}-${row.joined_at}-${idx}`} className="flex items-center gap-3">
                <div className="bg-primary-100 text-primary-700 rounded-full w-9 h-9 flex items-center justify-center font-bold text-xs shrink-0">
                  {initials(String(row.name || '?'))}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{row.name}</p>
                  <p className="text-[11px] text-gray-500">
                    Bergabung {formatJoinedDate(row.joined_at)} · Level {row.level}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccountCard>

      <AccountCard title="Riwayat Komisi">
        <ul className="space-y-2">
          {(history || []).map((row: any) => (
            <li
              key={row.id}
              className="flex items-center justify-between border-b border-slate-100 py-2 gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    row.status === 'released'
                      ? 'bg-primary-100 text-primary-700'
                      : row.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {row.status === 'released' ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-sm truncate">
                  L{row.level}{' '}
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </span>
              </div>
              <span className="text-sm font-bold shrink-0">{formatIdr(Number(row.amount || 0))}</span>
            </li>
          ))}
          {!history?.length && <li className="text-slate-500 text-sm">Belum ada komisi.</li>}
        </ul>
      </AccountCard>
    </AccountShell>
  );
};
