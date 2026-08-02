import React, { useEffect } from 'react';
import { DollarSign, CreditCard, Clock, Receipt } from 'lucide-react';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Today's Revenue */}
      <StatCard
        title="Today's Revenue"
        value={
          summary.todaysRevenueFormatted ||
          (typeof summary.totalRevenue === 'number'
            ? `Rp ${summary.totalRevenue.toLocaleString('id-ID')}`
            : 'Rp 0')
        }
        change={summary.revenueGrowth || '+0%'}
        changeType="positive"
        icon={DollarSign}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />

      {/* 2. Today's Transactions */}
      <StatCard
        title="Today's Transactions"
        value={`${(summary.todaysTransactions ?? summary.totalTransactions ?? 0).toLocaleString('id-ID')} TRX`}
        change={summary.autoSettlementRate ? `Auto-Settlement: ${summary.autoSettlementRate}` : 'Real-time'}
        changeType="neutral"
        icon={CreditCard}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      />

      {/* 3. Pending Settlement */}
      <StatCard
        title="Pending Settlement"
        value={
          summary.pendingSettlementFormatted ||
          (typeof summary.pendingSettlement === 'number'
            ? `Rp ${summary.pendingSettlement.toLocaleString('id-ID')}`
            : 'Rp 0')
        }
        change={summary.pendingSettlementNotes || 'H+0 Clearing'}
        changeType="neutral"
        icon={Clock}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
      />

      {/* 4. Pending Refund Requests */}
      <StatCard
        title="Pending Refund Requests"
        value={`${summary.pendingRefundsCount ?? 0} Permohonan`}
        change={summary.pendingRefundsValueFormatted ? `Nilai: ${summary.pendingRefundsValueFormatted}` : 'Refund Center'}
        changeType="neutral"
        icon={Receipt}
        iconBg="bg-purple-50"
        iconColor="text-purple-600"
      />
    </div>
  );
};


