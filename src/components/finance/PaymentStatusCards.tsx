import React, { useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useFinanceStore } from '../../store/finance.store';

const iconMap = {
  Paid: CheckCircle2,
  Success: CheckCircle2,
  Pending: Clock,
  Failed: XCircle,
  Expired: AlertTriangle,
};

export const PaymentStatusCards: React.FC = () => {
  const { dashboardData, dashboardLoading, fetchDashboard } = useFinanceStore();

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  const rawSummaries = dashboardData?.statusSummaries || dashboardData?.statuses || [];
  const summaries = Array.isArray(rawSummaries) ? rawSummaries : [];

  if (dashboardLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) {
    return null;
  }

  const statusSummaries = summaries.map((item) => ({
    ...item,
    icon: iconMap[item.status as keyof typeof iconMap] || Clock,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-gray-900">Payment Status Distribution</h3>
        <span className="text-xs text-gray-400">Hari ini</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusSummaries.map((item) => {
          const IconComp = item.icon;
          return (
            <div
              key={item.status}
              className={`bg-white p-5 rounded-2xl border ${item.borderColor || 'border-gray-100'} shadow-xs hover:shadow-sm transition space-y-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${item.badgeBg || 'bg-gray-100'}`}>
                    <IconComp className="w-4 h-4 text-gray-700" />
                  </div>
                  <span className="font-extrabold text-gray-900 text-sm">{item.status}</span>
                </div>
                {item.percentage && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.badgeBg || 'bg-gray-100'}`}>
                    {item.percentage}
                  </span>
                )}
              </div>

              <div>
                <div className="text-xl font-extrabold text-gray-900">{(item.count || 0).toLocaleString('id-ID')} TRX</div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">
                  Nilai: <strong className={item.textColor || 'text-gray-900'}>{item.totalAmount || `Rp ${(item.amount || 0).toLocaleString('id-ID')}`}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

