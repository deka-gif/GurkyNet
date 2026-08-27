import React, { useState } from 'react';
import { agentMarginService } from '../../services/sprint15/differentiator.service';
import { formatIDR as formatIdr } from '../../utils/currency';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

/** FR-DIFF-03 — Ops agent margin calculator (display-only). */
export const OperationsAgentMarginPage: React.FC = () => {
  const isOwnerReadOnly = useOwnerReadOnly();
  const [productId, setProductId] = useState('');
  const [data, setData] = useState<any>(null);
  const [level, setLevel] = useState('reguler');
  const [sellPrice, setSellPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await agentMarginService.calculate(Number(productId)));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat');
    }
  };

  const savePrice = async () => {
    if (isOwnerReadOnly) return;
    setError(null);
    try {
      const res = await agentMarginService.upsertPrice(Number(productId), level, Number(sellPrice));
      setData(res.calculator);
      setMessage('Harga level disimpan ke product_prices (display-only). Checkout tidak berubah.');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal simpan');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Operations</p>
        <h1 className="text-2xl font-extrabold text-gray-900">Kalkulator Margin Agen</h1>
        <p className="text-sm text-gray-500 mt-1">
          FR-DIFF-03 display-only: margin = harga jual level − harga modal. Tidak mengubah checkout.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Product ID</label>
          <input
            className="block mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          />
        </div>
        <button type="button" onClick={load} className="rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-bold">
          Hitung
        </button>
      </div>

      {data && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm font-extrabold">{data.product_name}</p>
          <p className="text-xs text-slate-500">
            Provider: {data.provider || '—'} · Modal: {formatIdr(Number(data.provider_cost || 0))}
          </p>
          <p className="text-[11px] text-amber-700">{data.note}</p>
          <div className="space-y-2">
            {(data.levels || []).map((row: any) => (
              <div key={row.agent_level} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                <span className="font-bold uppercase">{row.agent_level}</span>
                <span>
                  Sell {row.sell_price == null ? '—' : formatIdr(row.sell_price)} · Margin{' '}
                  <span className={Number(row.margin_nominal) < 0 ? 'text-rose-600 font-extrabold' : 'font-extrabold'}>
                    {row.margin_nominal == null ? '—' : formatIdr(row.margin_nominal)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {!isOwnerReadOnly && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-end">
              <select className="rounded-xl border px-3 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
                {['reguler', 'gold', 'platinum', 'end_user'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="Sell price"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
              <button type="button" onClick={savePrice} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-bold">
                Simpan product_prices
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
