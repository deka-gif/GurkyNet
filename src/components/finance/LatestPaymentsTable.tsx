import React, { useEffect } from 'react';
import { useFinanceStore } from '../../store/finance.store';
import { DataTableCard, StatusBadge, EmptyState } from '../common';
import { Receipt } from 'lucide-react';

const getStatusVariant = (status: string) => {
  const lower = (status || '').toLowerCase();
  if (lower === 'paid' || lower === 'success' || lower === 'sukses') return 'success';
  if (lower === 'pending') return 'warning';
  if (lower === 'failed' || lower === 'gagal') return 'error';
  return 'neutral';
};

export const LatestPaymentsTable: React.FC = () => {
  const { dashboardData, dashboardLoading, fetchDashboard } = useFinanceStore();

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  const rawPayments = dashboardData?.latestPayments || dashboardData?.payments || [];
  const latestPayments = Array.isArray(rawPayments) ? rawPayments : [];

  return (
    <DataTableCard
      title="Pembayaran Terbaru (Latest Payments)"
      subtitle="Arus kas masuk dan status konfirmasi transaksi pengguna"
      action={<span className="text-xs font-mono font-bold text-gray-400">Total {latestPayments.length} Records</span>}
    >
      {dashboardLoading ? (
        <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
          Memuat pembayaran terbaru...
        </div>
      ) : latestPayments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Belum Ada Pembayaran"
          description="Belum ada transaksi pembayaran terbaru yang tercatat."
        />
      ) : (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Invoice</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
            {latestPayments.map((payment: any, index: number) => {
              const invoice = payment.invoice || payment.invoice_number || payment.id || `INV-${index + 1}`;
              const customerName = payment.customer || payment.customerName || payment.user_name || payment.user?.name || 'Customer';
              const customerEmail = payment.email || payment.customerEmail || payment.user?.email || '-';
              const method = payment.paymentMethod || payment.method || payment.channel || 'QRIS';
              const amount = typeof payment.amount === 'number' ? payment.amount : Number(payment.amount || 0);
              const status = payment.status || 'Success';
              const time = payment.time || payment.date || payment.created_at || '-';

              return (
                <tr key={invoice + index} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{invoice}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-gray-900">{customerName}</div>
                    <div className="text-[10px] text-gray-400">{customerEmail}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700 font-semibold text-[11px]">
                      {method}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-gray-900">
                    Rp {amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={status} variant={getStatusVariant(status)} />
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-500">{time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DataTableCard>
  );
};


