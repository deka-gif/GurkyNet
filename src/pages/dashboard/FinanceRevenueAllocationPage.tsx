import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { financeService } from '../../services/finance.service';
import { formatIDR } from '../../utils/currency';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

type Tab = 'rules' | 'accumulation' | 'history';

type AllocLine = {
  categoryId: number;
  categoryCode?: string;
  categoryName?: string;
  percentage: number;
};

type Category = {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

/** FR-FIN-10 — Alokasi pendapatan (admin_fee + margin) ke kategori %. */
export const FinanceRevenueAllocationPage: React.FC = () => {
  const ownerReadOnly = useOwnerReadOnly();
  const [tab, setTab] = useState<Tab>('rules');
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<AllocLine[]>([]);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [accumulation, setAccumulation] = useState<any>(null);
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCatName, setNewCatName] = useState('');
  /** Hard errors / action warnings — persist until dismissed or condition cleared. */
  const [error, setError] = useState<string | null>(null);
  /** Success confirmations — auto-dismiss after a few seconds. */
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPct = useMemo(
    () => round4(lines.reduce((s, l) => s + Number(l.percentage || 0), 0)),
    [lines]
  );
  const totalOk = Math.abs(totalPct - 100) <= 0.01;

  // FR-FIN-10 UX — success toasts auto-dismiss; action warnings stay until fixed/closed.
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6500);
    return () => window.clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (totalOk && error && /total.*100|sampai total 100|harus 100/i.test(error)) {
      setError(null);
    }
  }, [totalOk, error]);

  const loadOverview = useCallback(async () => {
    const data = await financeService.getRevenueAllocationOverview();
    setCategories(data?.categories || []);
    const rawLines: any[] = data?.current?.lines || [];
    const inactiveInCurrent = rawLines.filter((l) => l.categoryIsActive === false);
    // FR-FIN-10 — never re-send inactive categories from a prior rule set (causes 422 on save).
    const activeLines: AllocLine[] = rawLines
      .filter((l) => l.categoryIsActive !== false)
      .map((l: any) => ({
        categoryId: l.categoryId,
        categoryCode: l.categoryCode,
        categoryName: l.categoryName,
        percentage: Number(l.percentage),
      }));
    if (inactiveInCurrent.length > 0) {
      const names = inactiveInCurrent
        .map((l) => l.categoryName || l.categoryCode || `#${l.categoryId}`)
        .join(', ');
      setError(
        `Kategori nonaktif masih ada di rule set lama (${names}). Sesuaikan % kategori aktif sampai total 100%, lalu simpan rule set baru.`
      );
    }
    if (activeLines.length > 0) {
      setLines(activeLines);
    } else {
      setLines(
        (data?.categories || []).map((c: Category) => ({
          categoryId: c.id,
          categoryCode: c.code,
          categoryName: c.name,
          percentage: 0,
        }))
      );
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const rows = await financeService.getRevenueAllocationHistory();
    setHistory(Array.isArray(rows) ? rows : []);
  }, []);

  const loadAccumulation = useCallback(async () => {
    const data = await financeService.getRevenueAllocationAccumulation({ from, to });
    setAccumulation(data);
  }, [from, to]);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadOverview();
      if (tab === 'history') await loadHistory();
      if (tab === 'accumulation') await loadAccumulation();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat data alokasi');
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadHistory, loadAccumulation, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPctChange = (categoryId: number, value: string) => {
    const pct = Number(value);
    setLines((prev) =>
      prev.map((l) => (l.categoryId === categoryId ? { ...l, percentage: Number.isFinite(pct) ? pct : 0 } : l))
    );
  };

  const onSaveRules = async () => {
    setError(null);
    setMessage(null);
    if (ownerReadOnly) {
      setError('Owner bersifat lihat-saja pada modul Finance.');
      return;
    }
    if (!totalOk) {
      setError(`Total persentase harus 100% (saat ini ${totalPct}%).`);
      return;
    }
    try {
      await financeService.saveRevenueAllocationRules({
        reason: reason || 'Finance update rule set',
        lines: lines.map((l) => ({ category_id: l.categoryId, percentage: l.percentage })),
      });
      setMessage('Rule set baru disimpan. Transaksi SUCCESS berikutnya memakai persentase ini.');
      setReason('');
      await refresh();
      await loadHistory();
    } catch (e: any) {
      const errs = e?.response?.data?.errors;
      const firstFromBag =
        errs && typeof errs === 'object'
          ? (Object.values(errs).flat().find((x) => typeof x === 'string') as string | undefined)
          : undefined;
      const first =
        firstFromBag ||
        errs?.percentage?.[0] ||
        errs?.role?.[0] ||
        e?.response?.data?.message ||
        e?.message ||
        'Gagal menyimpan rule set';
      setError(first);
    }
  };

  const onAddCategory = async () => {
    setError(null);
    setMessage(null);
    if (ownerReadOnly) return;
    try {
      const cat = await financeService.createRevenueAllocationCategory({ name: newCatName });
      setNewCatName('');
      setMessage(`Kategori "${cat?.name}" ditambahkan.`);
      await loadOverview();
      setLines((prev) => {
        const next = [
          ...prev,
          {
            categoryId: cat.id,
            categoryCode: cat.code,
            categoryName: cat.name,
            percentage: 0,
          },
        ];
        const sum = round4(next.reduce((s, l) => s + Number(l.percentage || 0), 0));
        if (Math.abs(sum - 100) > 0.01) {
          setError(`Sesuaikan % sampai total 100% (saat ini ${sum}%), lalu simpan rule set baru.`);
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal menambah kategori');
    }
  };

  const onDeactivate = async (id: number) => {
    if (ownerReadOnly) return;
    setError(null);
    try {
      await financeService.deactivateRevenueAllocationCategory(id);
      setMessage('Kategori dinonaktifkan (histori tetap ada).');
      // Keep editor state — do not reload current rule lines (would re-inject the inactive category).
      setLines((prev) => {
        const next = prev.filter((l) => l.categoryId !== id);
        const sum = round4(next.reduce((s, l) => s + Number(l.percentage || 0), 0));
        if (Math.abs(sum - 100) > 0.01) {
          setError(`Sesuaikan % sisa sampai total 100% (saat ini ${sum}%), lalu simpan rule set baru.`);
        }
        return next;
      });
      const data = await financeService.getRevenueAllocationOverview();
      setCategories(data?.categories || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal menonaktifkan');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Alokasi Pendapatan</h1>
        <p className="text-sm text-slate-600 mt-1">
          FR-FIN-10 — Setiap transaksi SUCCESS, <strong>admin fee + margin</strong> dialokasikan ke kategori
          menurut persentase aktif. Perubahan % berlaku segera untuk transaksi baru; histori memakai
          snapshot lama.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['rules', 'Persentase Saat Ini'],
            ['accumulation', 'Akumulasi'],
            ['history', 'Riwayat Perubahan'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              tab === key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
            /100%|nonaktif|Sesuaikan/i.test(error)
              ? 'text-amber-900 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-100'
          }`}
        >
          <p className="flex-1">{error}</p>
          <button
            type="button"
            aria-label="Tutup peringatan"
            className="shrink-0 opacity-70 hover:opacity-100 px-1 text-lg leading-none"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <p className="flex-1">{message}</p>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            className="shrink-0 opacity-70 hover:opacity-100 px-1 text-lg leading-none"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}
      {loading && <p className="text-sm text-slate-500">Memuat…</p>}

      {tab === 'rules' && (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-medium">Persentase aktif</h2>
            <span className={`text-sm font-semibold ${totalOk ? 'text-emerald-700' : 'text-red-600'}`}>
              Total: {totalPct}%
            </span>
          </div>

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.categoryId} className="flex flex-wrap items-center gap-3 border rounded-lg px-3 py-2">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-medium text-slate-800">{l.categoryName || `#${l.categoryId}`}</div>
                  <div className="text-xs text-slate-500">{l.categoryCode}</div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  disabled={ownerReadOnly}
                  className="w-28 border rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
                  value={l.percentage}
                  onChange={(e) => onPctChange(l.categoryId, e.target.value)}
                />
                <span className="text-sm text-slate-500">%</span>
                {!ownerReadOnly && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => void onDeactivate(l.categoryId)}
                  >
                    Nonaktifkan
                  </button>
                )}
              </div>
            ))}
          </div>

          {!ownerReadOnly && (
            <>
              <div className="space-y-2">
                <label className="text-sm text-slate-700">Alasan perubahan (wajib)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Naikkan cadangan Digiflazz bulan ini"
                />
              </div>
              <button
                type="button"
                disabled={!totalOk || !reason.trim()}
                onClick={() => void onSaveRules()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
              >
                Simpan rule set baru
              </button>

              <div className="pt-4 border-t space-y-2">
                <h3 className="text-sm font-medium">Tambah kategori</h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nama kategori baru"
                  />
                  <button
                    type="button"
                    disabled={!newCatName.trim()}
                    onClick={() => void onAddCategory()}
                    className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50"
                  >
                    Tambah
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Kategori tidak di-hard-delete. Nonaktif = hilang dari rule baru, histori tetap terbaca.
                </p>
              </div>
            </>
          )}

          {ownerReadOnly && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Mode Owner (lihat saja). Perubahan persentase hanya dilakukan oleh Finance.
            </p>
          )}

          {categories.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada kategori aktif.</p>
          )}
        </section>
      )}

      {tab === 'accumulation' && (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="font-medium">Akumulasi alokasi (status posted)</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-slate-500 block">Dari</label>
              <input type="date" className="border rounded-lg px-2 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block">Sampai</label>
              <input type="date" className="border rounded-lg px-2 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button type="button" className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => void loadAccumulation()}>
              Terapkan
            </button>
          </div>
          <div className="text-sm text-slate-600">
            Total kotor: <strong>{formatIDR(Number(accumulation?.gross || 0))}</strong>
          </div>
          <ul className="divide-y border rounded-lg">
            {(accumulation?.categories || []).map((c: any) => (
              <li key={c.id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  {c.name}
                  {!c.isActive && <span className="ml-2 text-xs text-slate-400">(nonaktif)</span>}
                </span>
                <span className="font-medium">{formatIDR(Number(c.totalAmount || 0))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'history' && (
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-medium">Riwayat perubahan rule set</h2>
          {history.length === 0 && <p className="text-sm text-slate-500">Belum ada riwayat.</p>}
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className={`border rounded-lg p-3 ${h.isCurrent ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">
                    #{h.id} {h.isCurrent ? '· AKTIF' : ''}
                  </span>
                  <span className="text-slate-500">{h.effectiveFrom || h.createdAt}</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Oleh: {h.createdByName || (h.createdBy ? `#${h.createdBy}` : 'system')} · {h.reason || '—'}
                </div>
                <ul className="mt-2 text-xs grid sm:grid-cols-2 gap-1">
                  {(h.lines || []).map((l: any) => (
                    <li key={`${h.id}-${l.categoryId}`}>
                      {l.categoryName}: {l.percentage}%
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
