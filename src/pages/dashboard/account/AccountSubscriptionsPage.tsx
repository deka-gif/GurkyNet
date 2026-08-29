import React, { useEffect, useState } from 'react';
import { AccountShell, AccountCard } from './AccountShell';
import { subscriptionService } from '../../../services/sprint15/differentiator.service';
import { toastError, toastSuccess } from '../../../hooks/useToast';

/** FR-DIFF-02 — User Auto-Reorder subscriptions. */
export const AccountSubscriptionsPage: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [target, setTarget] = useState('');
  const [day, setDay] = useState('1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (error) toastError('Terjadi Kesalahan', error);
  }, [error]);

  useEffect(() => {
    if (message) toastSuccess('Berhasil', message);
  }, [message]);

  const load = async () => {
    try {
      const data = await subscriptionService.list();
      setRows(data?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    try {
      await subscriptionService.create({
        product_id: Number(productId),
        target_number: target,
        schedule_day: Number(day),
        pin,
      });
      setMessage('Subscription dibuat. Auto-beli tidak jalan selama PURCHASE_ENABLED=false.');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal membuat');
    }
  };

  return (
    <AccountShell title="Langganan Otomatis" subtitle="Auto-reorder per tanggal kalender (FR-DIFF-02).">
      <AccountCard>
        <h3 className="text-sm font-extrabold mb-2">Buat Subscription</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Nomor tujuan" value={target} onChange={(e) => setTarget(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" type="password" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        </div>
        <button type="button" onClick={create} className="mt-3 rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-bold">
          Simpan
        </button>
      </AccountCard>

      <AccountCard>
        <h3 className="text-sm font-extrabold mb-3">Daftar</h3>
        {rows.length === 0 && <p className="text-xs text-slate-400">Belum ada subscription.</p>}
        {rows.map((row) => (
          <div key={row.id} className="border-b border-slate-50 py-2 text-xs flex justify-between gap-2">
            <div>
              <p className="font-bold">#{row.id} · {row.product?.name || row.product_id}</p>
              <p className="text-slate-500">
                tgl {row.schedule_day} · {row.status} · next {row.next_run_at || '—'}
              </p>
            </div>
            <div className="flex gap-1">
              <button type="button" className="px-2 py-1 rounded-lg border" onClick={() => subscriptionService.pause(row.id).then(load)}>
                Pause
              </button>
              <button type="button" className="px-2 py-1 rounded-lg border" onClick={() => subscriptionService.cancel(row.id).then(load)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
      </AccountCard>
    </AccountShell>
  );
};
