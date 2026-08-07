import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const FinanceTreasuryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await financeService.getTreasury());
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat treasury.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      await financeService.refreshProviderDeposits();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Refresh gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title="Treasury Center" subtitle="Aset & liability GurkyNet dari wallet, provider deposit, dan settlement — tanpa scraping." icon={Building2} />
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
      <div className="flex justify-end">
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh Provider Balance
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Wallet Liability" value={formatIdr(data?.walletLiability)} />
        <Card label="Provider Deposit" value={formatIdr(data?.providerDepositTotal)} />
        <Card label="Pending Settlement" value={formatIdr(data?.pendingSettlementAmount)} />
        <Card label="Frozen Wallets" value={String(data?.frozenWallets ?? 0)} />
      </div>
      <section className="rounded-2xl border bg-white p-4 shadow-xs">
        <h2 className="text-sm font-extrabold mb-3">Provider Deposits</h2>
        <div className="divide-y">
          {(data?.providerDeposits || []).map((p: any) => (
            <div key={p.id} className="py-3 flex justify-between text-sm">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-gray-400">{p.code} · {p.partnerStatus}</p>
              </div>
              <p className="font-extrabold">{p.balance == null ? 'N/A' : formatIdr(p.balance)}</p>
            </div>
          ))}
          {(data?.providerDeposits || []).length === 0 && <p className="text-sm text-gray-400 py-4">Belum ada provider.</p>}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-4 shadow-xs">
        <h2 className="text-sm font-extrabold mb-3">Payment Gateways</h2>
        <div className="divide-y">
          {(data?.paymentGateways || []).map((g: any) => (
            <div key={g.code} className="py-3 flex justify-between text-sm">
              <div>
                <p className="font-bold">{g.name || g.code}</p>
                <p className="text-xs text-gray-400">{g.status || '—'}</p>
              </div>
              <p className="font-extrabold text-xs">{g.balance == null ? 'Balance N/A' : formatIdr(g.balance)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Card: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border bg-white px-4 py-3 shadow-xs">
    <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
    <p className="text-lg font-black mt-1">{value}</p>
  </div>
);
