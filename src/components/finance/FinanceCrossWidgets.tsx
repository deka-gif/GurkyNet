import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { financeService, formatIdr } from '../../services/finance.service';

type Audience = 'customer_support' | 'operations' | 'marketing';

export const FinanceCrossWidgets: React.FC<{ audience: Audience }> = ({ audience }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    financeService.getWidgets(audience).then(setData).catch(() => setData(null));
  }, [audience]);

  if (!data) return null;

  if (audience === 'customer_support') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase text-gray-500">Finance Status</h2>
          <Link to="/dashboard/customer-support/workflows" className="text-xs font-bold text-primary-700">
            Workflows →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Pending Finance Refunds" value={String(data.pendingFinanceRefunds ?? 0)} />
          <Stat label="Resolved Today" value={String(data.refundsResolvedToday ?? 0)} />
        </div>
      </section>
    );
  }

  if (audience === 'operations') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-extrabold uppercase text-gray-500">Finance · Provider</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Low Deposits" value={String((data.lowProviderDeposits || []).length)} />
          <Stat label="Open Settlements" value={String(data.settlementsOpen ?? 0)} />
        </div>
        {(data.providerAlerts || []).slice(0, 3).map((a: any) => (
          <p key={a.id} className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{a.title}</p>
        ))}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
      <h2 className="text-xs font-extrabold uppercase text-gray-500">Finance Impact</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Revenue Today" value={formatIdr(data.todaysRevenue)} />
        <Stat label="Margin" value={formatIdr(data.todaysMargin)} />
        <Stat label="Refund Cost" value={formatIdr(data.refundCostToday)} />
      </div>
    </section>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-gray-50 px-3 py-2">
    <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
    <p className="text-sm font-black text-gray-900 mt-0.5">{value}</p>
  </div>
);
