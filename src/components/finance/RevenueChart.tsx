import React, { useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { ChartCard } from '../common';
import { useFinanceStore } from '../../store/finance.store';

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `Rp ${(value / 1000).toFixed(0)}k`;
  }
  return `Rp ${value}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
        <p className="font-bold text-amber-400">{label}</p>
        <p className="font-extrabold text-sm text-emerald-400">
          Rp {(payload[0].value || 0).toLocaleString('id-ID')}
        </p>
        {payload[0].payload.transactions !== undefined && (
          <p className="text-[11px] text-slate-300">
            {(payload[0].payload.transactions || 0).toLocaleString('id-ID')} Transaksi Sukses
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const RevenueChart: React.FC = () => {
  const { dashboardData, dashboardLoading, fetchDashboard } = useFinanceStore();

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  const rawData = dashboardData?.revenueChart || dashboardData?.chart || [];
  const chartData = Array.isArray(rawData) ? rawData : [];

  return (
    <ChartCard
      title="Grafik Pendapatan (Revenue Chart)"
      subtitle="Tren omzet harian sistem pembayaran GurkyNet"
      action={
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100">
          <TrendingUp className="w-4 h-4" />
          <span>Live Backend Data</span>
        </div>
      }
    >
      <div className="h-72 w-full pt-2">
        {dashboardLoading ? (
          <div className="h-full w-full bg-gray-50 rounded-2xl animate-pulse flex items-center justify-center text-xs text-gray-400">
            Memuat grafik backend...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full w-full bg-gray-50/50 rounded-2xl flex items-center justify-center text-xs text-gray-400">
            Belum ada data grafik pendapatan.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
};


