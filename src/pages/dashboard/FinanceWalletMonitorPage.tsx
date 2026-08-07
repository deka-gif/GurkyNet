import React, { useEffect, useState } from 'react';
import { AlertTriangle, Wallet } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const FinanceWalletMonitorPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    financeService.getWalletMonitor().then(setData).catch((e: any) => setError(e?.response?.data?.message || e?.message));
  }, []);

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Wallet Monitoring" subtitle="Liability, freeze, adjustment, refund — audit dari ledger & wallet history." icon={Wallet} />
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Total Balance" value={formatIdr(data?.totalWalletBalance)} />
        <Card label="Liability" value={formatIdr(data?.walletLiability)} />
        <Card label="Wallets" value={String(data?.walletCount ?? 0)} />
        <Card label="Frozen" value={String(data?.frozenCount ?? 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <List title="Recent Adjustments" rows={data?.recentAdjustments || []} />
        <List title="Recent Refunds" rows={data?.recentRefunds || []} />
      </div>
    </div>
  );
};

const Card: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border bg-white px-4 py-3 shadow-xs">
    <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
    <p className="text-lg font-black mt-1">{value}</p>
  </div>
);

const List: React.FC<{ title: string; rows: any[] }> = ({ title, rows }) => (
  <section className="rounded-2xl border bg-white p-4 shadow-xs">
    <h2 className="text-sm font-extrabold mb-3">{title}</h2>
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {rows.length === 0 && <p className="text-sm text-gray-400">Kosong.</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border px-3 py-2 text-sm flex justify-between gap-2">
          <div>
            <p className="font-bold">{r.eventType}</p>
            <p className="text-[11px] font-mono text-gray-400">{r.ledgerCode}</p>
          </div>
          <p className="font-extrabold text-emerald-700">{r.credit ? formatIdr(r.credit) : formatIdr(r.debit)}</p>
        </div>
      ))}
    </div>
  </section>
);
