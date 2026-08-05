import React, { useEffect } from 'react';
import { DollarSign, CreditCard, Clock, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { StatCard } from '../common';
import { useFinanceStore } from '../../store/finance.store';

export const FinanceTopSummary: React.FC = () => {
  const { dashboardData, dashboardLoading, dashboardError, fetchDashboard } = useFinanceStore();

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  if (dashboardLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs font-semibold">
        {dashboardError}
      </div>
    );
  }

  const summary = dashboardData?.summary || dashboardData || {};
  const profitSummary = dashboardData?.profit_summary || {};
  const walletLedger = dashboardData?.wallet_ledger || {};

  const profitFormatted =
    summary.profitFormatted ||
    (typeof (summary.profit ?? profitSummary.profit) === 'number'
      ? `Rp ${Number(summary.profit ?? profitSummary.profit).toLocaleString('id-ID')}`
      : 'Rp 0');

  const expensesFormatted =
    summary.expensesFormatted ||
    (typeof (summary.expenses ?? profitSummary.expenses) === 'number'
      ? `Rp ${Number(summary.expenses ?? profitSummary.expenses).toLocaleString('id-ID')}`
      : 'Rp 0');

  const walletFormatted =
    summary.walletLedgerBalanceFormatted ||
    (typeof (summary.wallet_ledger_balance ?? walletLedger.total_balance) === 'number'
      ? `Rp ${Number(summary.wallet_ledger_balance ?? walletLedger.total_balance).toLocaleString('id-ID')}`
      : 'Rp 0');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard
        title="Today's Revenue"
        value={
          summary.todaysRevenueFormatted ||
          (typeof summary.totalRevenue === 'number'
            ? `Rp ${summary.totalRevenue.toLocaleString('id-ID')}`
            : 'Rp 0')
        }
        change={summary.revenueGrowth || '0%'}
        changeType="positive"
        icon={DollarSign}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      <StatCard
        title="Profit (Margin + Fee)"
        value={profitFormatted}
        change={
          summary.marginFormatted
            ? `Margin: ${summary.marginFormatted}`
            : typeof profitSummary.margin_total === 'number'
              ? `Margin: Rp ${Number(profitSummary.margin_total).toLocaleString('id-ID')}`
              : 'Dari transaksi sukses'
        }
        changeType="positive"
        icon={TrendingUp}
        iconBg="bg-teal-50"
        iconColor="text-teal-600"
      />

      <StatCard
        title="Expenses (Cost + Refund)"
        value={expensesFormatted}
        change="Provider cost + refund"
        changeType="neutral"
        icon={Receipt}
        iconBg="bg-rose-50"
        iconColor="text-rose-600"
      />

      <StatCard
        title="Today's Transactions"
        value={`${(summary.todaysTransactions ?? summary.totalTransactions ?? 0).toLocaleString('id-ID')} TRX`}
        change={summary.autoSettlementRate ? `Settlement: ${summary.autoSettlementRate}` : 'Belum ada settlement'}
        changeType="neutral"
        icon={CreditCard}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      />

      <StatCard
        title="Pending Settlement"
        value={
          summary.pendingSettlementFormatted ||
          (typeof summary.pendingSettlement === 'number'
            ? `Rp ${summary.pendingSettlement.toLocaleString('id-ID')}`
            : 'Rp 0')
        }
        change={summary.pendingSettlementNotes || '0 transaksi menunggu'}
        changeType="neutral"
        icon={Clock}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
      />

      <StatCard
        title="Wallet Ledger"
        value={walletFormatted}
        change={`${summary.pendingRefundsCount ?? 0} refund pending`}
        changeType="neutral"
        icon={Wallet}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-600"
      />
    </div>
  );
};
