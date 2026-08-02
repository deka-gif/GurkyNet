import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { TrendingUp, BarChart3, RotateCcw } from 'lucide-react';
import { useFinanceStore } from '../../store/finance.store';

const formatCurrencyMillions = (value: number) => {
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}k`;
  return `Rp ${value}`;
};

const formatCurrencyThousands = (value: number) => {
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}k`;
  return `Rp ${value}`;
};

interface FinancialReportChartsProps {
  revenueChart?: any[];
  transactionChart?: any[];
  refundChart?: any[];
}

export const FinancialReportCharts: React.FC<FinancialReportChartsProps> = ({
  revenueChart,
  transactionChart,
  refundChart,
}) => {
  const { dashboardData, reports } = useFinanceStore();

  const revData = revenueChart || dashboardData?.revenueChart || dashboardData?.chart || reports?.map((r: any) => ({
    day: r.date || r.created_at || 'Period',
    revenue: typeof r.total_amount === 'number' ? r.total_amount : Number(r.amount || r.gross_amount || 0),
  })) || [];

  const trxData = transactionChart || dashboardData?.transactionChart || reports?.map((r: any) => ({
    day: r.date || r.created_at || 'Period',
    count: typeof r.total_transactions === 'number' ? r.total_transactions : Number(r.transaction_count || 1),
  })) || [];

  const refData = refundChart || dashboardData?.refundChart || reports?.map((r: any) => ({
    day: r.date || r.created_at || 'Period',
    refund: typeof r.refund_amount === 'number' ? r.refund_amount : Number(r.refunds || 0),
  })) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 1. REVENUE TREND CHART */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-xs">Revenue Trend</h3>
              <p className="text-[10px] text-gray-400">Tren Pendapatan Harian</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Backend Sync
          </span>
        </div>

        <div className="h-48 w-full pt-2">
          {revData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Tidak ada data grafik pendapatan
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="repRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatCurrencyMillions} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Tooltip
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', backgroundColor: '#0f172a', color: '#fff', border: 'none' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#repRevGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. TRANSACTION TREND CHART */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-xs">Transaction Trend</h3>
              <p className="text-[10px] text-gray-400">Volume Transaksi Harian</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
            Real Volume
          </span>
        </div>

        <div className="h-48 w-full pt-2">
          {trxData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Tidak ada data volume transaksi
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trxData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Transaksi`, 'Volume']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', backgroundColor: '#0f172a', color: '#fff', border: 'none' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3. REFUND TREND CHART */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-xs">Refund Trend</h3>
              <p className="text-[10px] text-gray-400">Pengembalian Dana Harian</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
            Audit Track
          </span>
        </div>

        <div className="h-48 w-full pt-2">
          {refData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Tidak ada data pengembalian dana
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={refData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="repRefGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatCurrencyThousands} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Tooltip
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Refund']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', backgroundColor: '#0f172a', color: '#fff', border: 'none' }}
                />
                <Area type="monotone" dataKey="refund" stroke="#7e22ce" strokeWidth={2.5} fillOpacity={1} fill="url(#repRefGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

