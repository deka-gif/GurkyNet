import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Search, Wallet } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';
import { createIdempotencyKey, getOrCreateIdempotencyKey } from '../../utils/idempotency';

/** FR-FIN-01 daftar saldo + mutasi; FR-FIN-02 penyesuaian manual. */
export const FinanceWalletMonitorPage: React.FC = () => {
  const readOnly = useOwnerReadOnly();
  const [q, setQ] = useState('');
  const [wallets, setWallets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [mutations, setMutations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const adjustKeyRef = useRef<string | null>(null);

  const loadWallets = useCallback(async () => {
    try {
      const res = await financeService.listUserWallets({ q: q || undefined, per_page: 50 });
      setWallets(Array.isArray(res?.data) ? res.data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat saldo.');
    }
  }, [q]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const openUser = async (row: any) => {
    setSelected(row);
    adjustKeyRef.current = null;
    try {
      const res = await financeService.getUserMutations(row.user_id, { per_page: 50 });
      setMutations(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  const submitAdjust = async () => {
    if (!selected || readOnly) return;
    if (!reason.trim()) {
      setError('Alasan penyesuaian wajib diisi (FR-FIN-02).');
      return;
    }
    const key = getOrCreateIdempotencyKey(adjustKeyRef);
    try {
      await financeService.adjustWallet({
        user_id: selected.user_id,
        amount: Number(amount),
        direction,
        reason: reason.trim(),
        idempotency_key: key,
      });
      setMsg('Penyesuaian saldo berhasil.');
      setConfirmOpen(false);
      setAmount('');
      setReason('');
      adjustKeyRef.current = null;
      await loadWallets();
      await openUser(selected);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal penyesuaian.');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Saldo Pengguna"
        subtitle="FR-FIN-01 daftar saldo & mutasi · FR-FIN-02 penyesuaian manual"
        icon={Wallet}
      />
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      {msg && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm"
            placeholder="Cari nama / email / telepon / nomor wallet"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" onClick={loadWallets} className="rounded-xl bg-slate-900 text-white px-4 text-sm font-bold">
          Cari
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border bg-white p-4 shadow-xs">
          <h2 className="text-sm font-extrabold mb-3">Daftar Saldo</h2>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => openUser(w)}
                className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${selected?.id === w.id ? 'border-emerald-500 bg-emerald-50' : ''}`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-bold">{w.user?.name || '-'}</p>
                    <p className="text-[11px] text-gray-500">{w.user?.email}</p>
                    <p className="text-[11px] font-mono text-gray-400">{w.wallet_number}</p>
                  </div>
                  <p className="font-extrabold text-emerald-700">{formatIdr(w.balance)}</p>
                </div>
              </button>
            ))}
            {wallets.length === 0 && <p className="text-sm text-gray-400">Tidak ada data.</p>}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold">Detail & Mutasi</h2>
          {!selected && <p className="text-sm text-gray-400">Pilih pengguna di kiri.</p>}
          {selected && (
            <>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-bold">{selected.user?.name}</p>
                <p>Saldo saat ini: <span className="font-extrabold">{formatIdr(selected.balance)}</span></p>
              </div>

              {!readOnly && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-500">Penyesuaian Manual (FR-FIN-02)</p>
                  <select className="w-full rounded-lg border px-2 py-1.5 text-sm" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
                    <option value="credit">Credit (+)</option>
                    <option value="debit">Debit (−)</option>
                  </select>
                  <input className="w-full rounded-lg border px-2 py-1.5 text-sm" placeholder="Nominal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <textarea className="w-full rounded-lg border px-2 py-1.5 text-sm" placeholder="Alasan wajib" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-sm font-bold disabled:opacity-50"
                    disabled={!amount || !reason.trim()}
                    onClick={() => {
                      adjustKeyRef.current = createIdempotencyKey();
                      setConfirmOpen(true);
                    }}
                  >
                    Konfirmasi Penyesuaian
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {mutations.map((m) => (
                  <div key={m.id} className="rounded-xl border px-3 py-2 text-sm flex justify-between gap-2">
                    <div>
                      <p className="font-bold uppercase text-[11px] text-gray-500">{m.type}</p>
                      <p className="text-[11px] text-gray-500">{m.description || '-'}</p>
                      <p className="text-[10px] font-mono text-gray-400">ref:{m.reference_id || '-'} · {m.created_at}</p>
                    </div>
                    <p className="font-extrabold">{formatIdr(m.amount)}</p>
                  </div>
                ))}
                {mutations.length === 0 && <p className="text-sm text-gray-400">Belum ada mutasi.</p>}
              </div>
            </>
          )}
        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-extrabold">Konfirmasi Penyesuaian</h3>
            <p className="text-sm text-gray-600">
              {direction.toUpperCase()} {formatIdr(Number(amount))} untuk {selected?.user?.name}. Alasan: {reason}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => setConfirmOpen(false)}>Batal</button>
              <button type="button" className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-bold" onClick={submitAdjust}>
                Ya, proses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
