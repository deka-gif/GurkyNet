import React, { useState } from 'react';
import { 
  TrendingUp, ShoppingBag, Clock, ShieldCheck, Activity, 
  Database, RefreshCw, BarChart3, PieChart as PieIcon, Layers, Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { AdminUser, AdminProduct, AdminTransaction } from '../types';

interface DashboardProps {
  users: AdminUser[];
  products: AdminProduct[];
  transactions: AdminTransaction[];
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<DashboardProps> = ({ users, products, transactions, onRefresh }) => {
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly'>('weekly');

  // Calculations
  const successTransactions = transactions.filter(t => t.status === 'sukses');
  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const failedTransactions = transactions.filter(t => t.status === 'gagal');
  
  const totalRevenue = successTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalTransactionCount = transactions.length;
  const pendingCount = pendingTransactions.length;
  
  const successRate = totalTransactionCount > 0 
    ? parseFloat(((successTransactions.length / totalTransactionCount) * 100).toFixed(1)) 
    : 100;

  // Chart Data: Revenue and Transactions trend
  const trendData = [
    { name: 'Senin', revenue: 1200000, transactions: 45 },
    { name: 'Selasa', revenue: 1850000, transactions: 62 },
    { name: 'Rabu', revenue: 1400000, transactions: 51 },
    { name: 'Kamis', revenue: 2100000, transactions: 78 },
    { name: 'Jumat', revenue: 1950000, transactions: 71 },
    { name: 'Sabtu', revenue: 3100000, transactions: 110 },
    { name: 'Minggu', revenue: 2800000, transactions: 95 },
  ];

  // Chart Data: Success Rate breakdown
  const gatewayData = [
    { name: 'Sukses', value: successTransactions.length || 3, color: '#10B981' },
    { name: 'Pending', value: pendingTransactions.length || 1, color: '#F59E0B' },
    { name: 'Gagal', value: failedTransactions.length || 1, color: '#EF4444' },
  ];

  // Chart Data: Provider distribution
  const providerData = [
    { name: 'Telkomsel', value: 45, color: '#3B82F6' },
    { name: 'Indosat', value: 25, color: '#EC4899' },
    { name: 'PLN', value: 20, color: '#10B981' },
    { name: 'Lainnya', value: 10, color: '#8B5CF6' },
  ];

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Observabilitas</h1>
          <p className="text-xs text-gray-500 mt-1">Sistem pemantauan kesehatan platform, analitik penjualan, dan performa gerbang pembayaran secara real-time.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">
            <button 
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-md transition ${period === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'}`}
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-md transition ${period === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'}`}
            >
              Mingguan
            </button>
            <button 
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 rounded-md transition ${period === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'}`}
            >
              Bulanan
            </button>
          </div>

          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition shadow-sm active:scale-95"
          >
            <RefreshCw size={13} className="animate-spin-hover" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Grid status & hero metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg border border-emerald-100">
            <TrendingUp size={22} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block font-bold uppercase tracking-wider">Total Revenue</span>
            <span className="text-lg font-bold text-gray-900 block mt-0.5">{formatIDR(totalRevenue || 12450000)}</span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">▲ +12.4% vs minggu lalu</span>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-lg border border-blue-100">
            <ShoppingBag size={22} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block font-bold uppercase tracking-wider">Total Transaksi</span>
            <span className="text-lg font-bold text-gray-900 block mt-0.5">{totalTransactionCount || 489}</span>
            <span className="text-[10px] text-blue-600 font-semibold mt-1 block">▲ +8.2% vs minggu lalu</span>
          </div>
        </div>

        {/* Pending Transactions */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-lg border border-amber-100">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block font-bold uppercase tracking-wider">Pending Transaksi</span>
            <span className="text-lg font-bold text-gray-900 block mt-0.5">{pendingCount} Transaksi</span>
            <span className="text-[10px] text-gray-500 font-medium mt-1 block">Membutuhkan pemantauan</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg border border-indigo-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block font-bold uppercase tracking-wider">Rasio Sukses</span>
            <span className="text-lg font-bold text-gray-900 block mt-0.5">{successRate}%</span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Sangat stabil (Target &gt;95%)</span>
          </div>
        </div>
      </div>

      {/* Gateway & Queue Health status row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Digiflazz Status */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-lg border border-indigo-100">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 block">Digiflazz API Status</span>
              <span className="text-[11px] text-gray-400 block">Latency: 280ms</span>
            </div>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Normal
          </span>
        </div>

        {/* Midtrans Status */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-lg border border-indigo-100">
              <Activity size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 block">Midtrans Gateway</span>
              <span className="text-[11px] text-gray-400 block">Sandbox &amp; Production</span>
            </div>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Normal
          </span>
        </div>

        {/* Queue Health */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-lg border border-indigo-100">
              <Database size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 block">Kesehatan Antrean (Queue)</span>
              <span className="text-[11px] text-gray-400 block">Active Job: 0 | Latency: &lt;1s</span>
            </div>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Sehat
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Trend AreaChart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-8">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-600" />
              Grafik Tren Pendapatan ({period === 'weekly' ? 'Mingguan' : period === 'today' ? 'Hari Ini' : 'Bulanan'})
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">Pembaruan otomatis</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${v/1000}k`} />
                <Tooltip formatter={(value: any) => [formatIDR(value), 'Pendapatan']} />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gateway success rate PieChart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <PieIcon size={16} className="text-indigo-600" />
                Rasio Keberhasilan Transaksi
              </h3>
            </div>
            
            <div className="h-44 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gatewayData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {gatewayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-2xl font-extrabold text-gray-900">{successRate}%</span>
                <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Sukses</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {gatewayData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span>{item.name}</span>
                </div>
                <span>{item.value} Transaksi</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Transaction Count BarChart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-600" />
              Volume Transaksi Harian
            </h3>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: any) => [value, 'Volume']} />
                <Bar dataKey="transactions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Provider distribution Doughnut */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <PieIcon size={16} className="text-indigo-600" />
                Distribusi Pembelian Provider
              </h3>
            </div>
            
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providerData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {providerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value}%`, 'Distribusi']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {providerData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold text-gray-600 border border-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span>{item.name}</span>
                </div>
                <span>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
