import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown,
  DollarSign,
  Users,
  Server,
  Layers,
  Headset,
  Receipt,
  Globe,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Lock,
  BarChart3,
  RefreshCw,
  Zap,
  ArrowRight,
  Search,
  Filter,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  FileText
} from 'lucide-react';
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
import { storageService } from '../../services/storage.service';
import { useOwnerStore } from '../../store/owner.store';
import { StatCard } from '../../components/common';

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = Number(payload[0].value) || 0;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800 font-sans">
        <p className="font-extrabold text-amber-400">{label}</p>
        <p className="font-black text-sm text-emerald-400">
          Rp {val.toLocaleString('id-ID')}
        </p>
        <p className="text-[11px] text-slate-300">Estimasi Omzet Harian</p>
      </div>
    );
  }
  return null;
};

const TransactionTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = Number(payload[0].value) || 0;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800 font-sans">
        <p className="font-extrabold text-indigo-300">{label}</p>
        <p className="font-black text-sm text-indigo-400">
          {val.toLocaleString('id-ID')} Transaksi
        </p>
        <p className="text-[11px] text-slate-300">Total Volume Sukses</p>
      </div>
    );
  }
  return null;
};

export const OwnerDashboard: React.FC = () => {
  const user = storageService.getUser();
  const userName = typeof user?.name === 'string' ? user.name : 'Super Admin / Owner';
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters for Audit Logs
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const {
    dashboardData,
    dashboardLoading,
    dashboardError,
    financialOverview,
    financialLoading,
    financialError,
    departmentOverview,
    departmentLoading,
    departmentError,
    systemHealth,
    systemHealthLoading,
    systemHealthError,
    auditLogs,
    auditLogsPagination,
    auditLogsLoading,
    auditLogsError,
    activityTimeline,
    activityTimelineLoading,
    activityTimelineError,
    fetchDashboard,
    fetchFinancialOverview,
    fetchDepartmentOverview,
    fetchSystemHealth,
    fetchAuditLogs,
    fetchActivityTimeline,
    fetchAllExecutiveData
  } = useOwnerStore();

  useEffect(() => {
    fetchAllExecutiveData();
  }, [fetchAllExecutiveData]);

  // Refetch audit logs when filters change
  useEffect(() => {
    fetchAuditLogs({
      search: search || undefined,
      module: selectedModule || undefined,
      operator: selectedOperator || undefined,
      date: selectedDate || undefined,
      page: currentPage,
    });
  }, [search, selectedModule, selectedOperator, selectedDate, currentPage, fetchAuditLogs]);

  const handleRefresh = async () => {
    await fetchAllExecutiveData();
    setToastMessage('Metrik eksekutif bisnis telah diperbarui.');
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Safe KPI Extractions
  const kpis = useMemo(() => {
    const d = dashboardData || {};
    const summary = d.summary || d.kpis || {};
    const f = financialOverview || {};

    const todayRev = d.todayRevenue ?? d.today_revenue ?? summary.today_revenue ?? f.today_revenue ?? 0;
    const monthlyRev = d.monthlyRevenue ?? d.monthly_revenue ?? summary.monthly_revenue ?? f.monthly_revenue ?? 0;
    const usersCount = d.totalUsers ?? d.total_users ?? summary.total_users ?? 0;
    const todayTrx = d.todayTransactions ?? d.today_transactions ?? summary.today_transactions ?? 0;
    const successRate = d.successRate ?? d.success_rate ?? summary.success_rate ?? 100;

    const todayRevChange = d.todayRevenueChange ?? d.today_revenue_change ?? summary.today_revenue_change ?? null;
    const monthlyRevChange = d.monthlyRevenueChange ?? d.monthly_revenue_change ?? summary.monthly_revenue_change ?? null;
    const usersChange = d.usersChange ?? d.users_change ?? summary.users_change ?? 'pengguna terdaftar';

    return {
      todayRevenue: todayRev,
      monthlyRevenue: monthlyRev,
      totalUsers: usersCount,
      todayTransactions: todayTrx,
      successRate,
      todayRevenueChange: todayRevChange,
      monthlyRevenueChange: monthlyRevChange,
      usersChange,
    };
  }, [dashboardData, financialOverview]);

  // Operations Summary Extractions
  const opsSummary = useMemo(() => {
    const d = dashboardData || {};
    const dept = departmentOverview || {};
    const ops = dept.operations_kpi || dept.operations || {};
    const support = dept.customer_support_kpi || dept.customer_support || {};
    const summary = d.summary || d.operations || {};
    const productsCount = d.products_online_count ?? ops.total_products ?? null;

    return {
      activeProviders: d.provider_health ?? d.activeProviders ?? d.active_providers ?? ops.active_providers ?? summary.active_providers ?? 'Online',
      providerBalance: d.provider_balance_formatted ?? d.digiflazz_balance ?? summary.provider_balance_formatted ?? null,
      productsOnline: d.productsOnline ?? d.products_online ?? summary.products_online ?? (productsCount !== null ? `${productsCount} SKU` : '0 SKU'),
      openTickets: d.openSupportTickets ?? d.open_tickets ?? support.open_tickets ?? summary.open_tickets ?? 0,
      pendingRefunds: d.pendingRefunds ?? d.pending_refunds ?? summary.pending_refunds ?? 0,
      topProducts: Array.isArray(d.topProducts)
        ? d.topProducts
        : Array.isArray(d.top_products)
        ? d.top_products
        : Array.isArray(dept.topProducts)
        ? dept.topProducts
        : [],
    };
  }, [dashboardData, departmentOverview]);

  // Top Customers Extractions
  const topCustomers = useMemo(() => {
    const dept = departmentOverview || {};
    const list = dept.topCustomers || dept.top_customers || dept.customers || dashboardData?.topCustomers || dashboardData?.top_customers || [];
    return Array.isArray(list) ? list : [];
  }, [departmentOverview, dashboardData]);

  // Chart Data Extractions
  const revenueChartData = useMemo(() => {
    const f = financialOverview || {};
    const list = f.revenueData30Days || f.revenue_30_days || f.revenueChart || f.revenue_chart || (Array.isArray(f) ? f : []);
    return Array.isArray(list) ? list : [];
  }, [financialOverview]);

  const transactionChartData = useMemo(() => {
    const f = financialOverview || {};
    const list = f.transactionData30Days || f.transaction_30_days || f.transactionChart || f.transaction_chart || (Array.isArray(f) ? f : []);
    return Array.isArray(list) ? list : [];
  }, [financialOverview]);

  const getHealthBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'online' || s === 'operational' || s === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Online
        </span>
      );
    }
    if (s === 'warning' || s === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        Offline
      </span>
    );
  };

  const getActivityIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('refund')) {
      return <Receipt className="w-4 h-4 text-emerald-600" />;
    }
    if (t.includes('user')) {
      return <Users className="w-4 h-4 text-blue-600" />;
    }
    if (t.includes('transaction') || t.includes('payment')) {
      return <DollarSign className="w-4 h-4 text-amber-600" />;
    }
    if (t.includes('provider') || t.includes('server') || t.includes('system')) {
      return <Server className="w-4 h-4 text-purple-600" />;
    }
    return <Activity className="w-4 h-4 text-slate-600" />;
  };

  const globalError = dashboardError || financialError || departmentError || systemHealthError || auditLogsError || activityTimelineError;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER - EXECUTIVE MODE */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-amber-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-xs text-[11px] font-bold text-amber-200 border border-amber-400/30">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              GurkyNet Owner & Executive CMS Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <span>Executive Business Overview</span>
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed max-w-2xl">
              Selamat datang, <strong>{userName}</strong>. Pemantauan tingkat tinggi bisnis digital, indikator performa pendapatan, kesehatan infrastruktur, dan aktivitas kunci.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={dashboardLoading || financialLoading}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl font-black text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${dashboardLoading || financialLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* READ-ONLY DEMO WARNING BANNER */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start sm:items-center gap-3 text-amber-950 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <div className="font-extrabold text-amber-950">
            Warning: Executive Dashboard Monitoring
          </div>
          <p className="text-amber-800/90 mt-0.5">
            Halaman ini khusus untuk pemantauan strategis bisnis tingkat tinggi (Executive Business Monitoring) terhubung langsung ke backend API.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-200/60 text-amber-900 font-mono shrink-0">
          <Lock className="w-3 h-3" /> READ-ONLY MONITOR
        </span>
      </div>

      {/* ERROR CALLOUT IF ANY API FAILS */}
      {globalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-rose-950">Terjadi Kesalahan Respons API Backend</h3>
            <p className="text-rose-800 leading-relaxed">{globalError}</p>
          </div>
        </div>
      )}

      {/* 1. EXECUTIVE KPI CARDS */}
      <div className="space-y-2">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <span>Executive Performance KPI</span>
          {dashboardLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Revenue */}
          <StatCard
            title="Today's Revenue"
            value={`Rp ${Number(kpis.todayRevenue).toLocaleString('id-ID')}`}
            change={kpis.todayRevenueChange}
            changeType="positive"
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />

          {/* Monthly Revenue */}
          <StatCard
            title="Monthly Revenue"
            value={`Rp ${Number(kpis.monthlyRevenue).toLocaleString('id-ID')}`}
            change={kpis.monthlyRevenueChange}
            changeType="positive"
            icon={BarChart3}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
          />

          {/* Total Users */}
          <StatCard
            title="Total Users"
            value={`${Number(kpis.totalUsers).toLocaleString('id-ID')} Akun`}
            change={kpis.usersChange}
            icon={Users}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />

          {/* Today's Transactions */}
          <StatCard
            title="Today's Transactions"
            value={`${Number(kpis.todayTransactions).toLocaleString('id-ID')} TRX`}
            change={`Tingkat keberhasilan: ${kpis.successRate}%`}
            icon={Zap}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        </div>
      </div>

      {/* 2. BUSINESS OVERVIEW CARDS */}
      <div className="space-y-2">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">Business Operations Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Providers / Digiflazz Health */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Provider Health</span>
              <Server className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-gray-900">
              {dashboardLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : String(opsSummary.activeProviders)}
            </div>
            <div className="text-[11px] text-purple-700 font-bold">
              {opsSummary.providerBalance
                ? `Digiflazz Balance: ${opsSummary.providerBalance}`
                : 'Live Digiflazz provider status'}
            </div>
          </div>

          {/* Products Online */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Products Online</span>
              <Layers className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-gray-900">
              {dashboardLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : String(opsSummary.productsOnline)}
            </div>
            <div className="text-[11px] text-teal-700 font-bold">Katalog produk aktif</div>
          </div>

          {/* Open Support Tickets */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Open Support Tickets</span>
              <Headset className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600">
              {dashboardLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : `${opsSummary.openTickets} Tiket`}
            </div>
            <div className="text-[11px] text-rose-700 font-bold">Tiket bantuan aktif</div>
          </div>

          {/* Pending Refunds */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Pending Refunds</span>
              <Receipt className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {dashboardLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : `${opsSummary.pendingRefunds} Refund`}
            </div>
            <div className="text-[11px] text-amber-800 font-bold">Membutuhkan peninjauan Finance</div>
          </div>
        </div>
      </div>

      {/* 3 & 4. CHARTS SECTION (REVENUE & TRANSACTIONS 30 DAYS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart (30 Days Area Chart) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Revenue (Last 30 Days)</h2>
              <p className="text-xs text-gray-500">Omzet harian platform pembayaran GurkyNet selama 30 hari terakhir</p>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-bold">
              30 Days Trend
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {financialLoading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span>Memuat grafik omzet...</span>
              </div>
            ) : revenueChartData.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 space-y-1">
                <FileText className="w-8 h-8 mx-auto text-gray-300" />
                <p className="font-bold">Belum ada data grafik omzet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenueOwner" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                      return String(val);
                    }}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenueOwner)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Transaction Chart (30 Days Bar Chart) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Transactions (Last 30 Days)</h2>
              <p className="text-xs text-gray-500">Volume kuantitas transaksi sukses selama 30 hari terakhir</p>
            </div>
            <span className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-bold">
              Transaction Volume
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {financialLoading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Memuat grafik transaksi...</span>
              </div>
            ) : transactionChartData.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 space-y-1">
                <FileText className="w-8 h-8 mx-auto text-gray-300" />
                <p className="font-bold">Belum ada data grafik volume transaksi</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transactionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip content={<TransactionTooltip />} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5 & 6. TABLES SECTION (TOP PRODUCTS & TOP CUSTOMERS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP BEST SELLING PRODUCTS */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0 flex flex-col justify-between">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Top Best Selling Products</h2>
              <p className="text-xs text-gray-500">Produk terlaris berdasarkan akumulasi omzet & transaksi</p>
            </div>
            <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
              Ranked Top
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            {dashboardLoading || departmentLoading ? (
              <div className="p-8 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>Memuat produk terlaris...</span>
              </div>
            ) : opsSummary.topProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-bold">
                Tidak ada data produk terlaris.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Transactions</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {opsSummary.topProducts.map((prod: any, idx: number) => {
                    const trxCount = Number(prod.transactions ?? prod.transaction_count ?? prod.count ?? 0);
                    const revAmount = Number(prod.revenue ?? prod.total_revenue ?? prod.amount ?? 0);
                    return (
                      <tr key={prod.code || prod.id || idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-800">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-gray-900">{prod.name || 'Produk'}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{prod.code || prod.sku || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold text-[10px]">
                            {prod.category || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {trxCount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                          Rp {revAmount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TOP CUSTOMERS */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0 flex flex-col justify-between">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Top Customers & Partners</h2>
              <p className="text-xs text-gray-500">Pengguna & mitra bisnis dengan akumulasi belanja tertinggi</p>
            </div>
            <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              VIP Accounts
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            {departmentLoading ? (
              <div className="p-8 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Memuat data pengguna utama...</span>
              </div>
            ) : topCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-bold">
                Tidak ada data top customer.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Transactions</th>
                    <th className="py-3 px-4 text-right">Total Spending</th>
                    <th className="py-3 px-4 text-right">Wallet Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {topCustomers.map((cust: any, idx: number) => {
                    const trxCount = Number(cust.transactions ?? cust.transaction_count ?? cust.transactionCount ?? 0);
                    const spending = Number(cust.totalSpending ?? cust.total_spending ?? cust.totalSpent ?? cust.spending ?? 0);
                    const balance = Number(cust.walletBalance ?? cust.wallet_balance ?? cust.balance ?? 0);
                    return (
                      <tr key={cust.id || idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-gray-900">{cust.name || 'Pengguna'}</div>
                          <div className="text-[10px] text-blue-600 font-bold">
                            {cust.type || cust.role || 'Member'} • {cust.id || cust.email || '-'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-900">
                          {trxCount.toLocaleString('id-ID')} TRX
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-700">
                          Rp {spending.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                          Rp {balance.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 7. AUDIT LOGS SECTION WITH FULL SEARCH, MODULE, OPERATOR, DATE & PAGINATION */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Executive Audit Logs</span>
              {auditLogsLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
            </h2>
            <p className="text-xs text-gray-500">Catatan riwayat audit dan log aktivitas operator eksekutif sistem</p>
          </div>
          <span className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full font-mono font-bold border border-indigo-100">
            Audit Feed API
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari kata kunci audit..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
            />
          </div>

          {/* Module Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900 appearance-none"
            >
              <option value="">Semua Modul</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Marketing">Marketing</option>
              <option value="System">System / Executive</option>
              <option value="Support">Customer Support</option>
            </select>
          </div>

          {/* Operator Filter */}
          <div className="relative">
            <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter Operator..."
              value={selectedOperator}
              onChange={(e) => {
                setSelectedOperator(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
            />
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="overflow-x-auto">
          {auditLogsLoading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Memuat data audit logs...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 space-y-1">
              <FileText className="w-8 h-8 mx-auto text-gray-300" />
              <p className="font-bold">Tidak ada audit log yang ditemukan.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Modul</th>
                  <th className="py-3 px-4">Aksi / Deskripsi</th>
                  <th className="py-3 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {auditLogs.map((log: any, idx: number) => {
                  const logId = log.id || idx;
                  const timestamp = log.created_at || log.date || log.time || log.createdAt || '-';
                  const operator = log.operator || log.user?.name || (typeof log.user === 'string' ? log.user : null) || log.user_name || 'System';
                  const moduleName = log.module || log.category || 'General';
                  const action = log.action || log.activity || log.description || log.message || '-';
                  const ip = log.ip_address || log.ip || '-';

                  return (
                    <tr key={logId} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-500">{timestamp}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{operator}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-100">
                          {moduleName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-800">{action}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-400">{ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {auditLogsPagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">
              Menampilkan Halaman <strong className="text-gray-900">{auditLogsPagination.currentPage || auditLogsPagination.current_page || currentPage}</strong> dari <strong className="text-gray-900">{auditLogsPagination.lastPage || auditLogsPagination.last_page || 1}</strong> (Total: {auditLogsPagination.total || auditLogs.length} Log)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || auditLogsLoading}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= (auditLogsPagination.lastPage || auditLogsPagination.last_page || 1) || auditLogsLoading}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold flex items-center gap-1 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 8 & 9. SYSTEM HEALTH & RECENT ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SYSTEM HEALTH */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-gray-900">System Infrastructure Health</h2>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-mono font-bold">
              Real-time Status
            </span>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {systemHealthLoading ? (
              <div className="py-8 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Memuat status infrastruktur...</span>
              </div>
            ) : !systemHealth || systemHealth.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-bold">
                Tidak ada data kesehatan sistem.
              </div>
            ) : (
              systemHealth.map((item: any, idx: number) => {
                const serviceName = item.service || item.component || item.name || 'Service';
                const typeName = item.type || item.category || 'Core';
                const notes = item.notes || item.message || item.description || 'Operating normally';
                const latency = item.latency || item.response_time || '0ms';
                const status = item.status || 'Online';

                return (
                  <div key={item.id || serviceName || idx} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">{serviceName}</span>
                        <span className="text-[10px] text-gray-400 font-medium">({typeName})</span>
                      </div>
                      <p className="text-[11px] text-gray-500">{notes}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-gray-400">{latency}</span>
                      {getHealthBadge(status)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RECENT ACTIVITIES TIMELINE */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-extrabold text-gray-900">Recent Executive Activities</h2>
            </div>
            <span className="text-xs text-gray-400 font-mono">Activity Timeline</span>
          </div>

          <div className="space-y-4 text-xs">
            {activityTimelineLoading ? (
              <div className="py-8 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>Memuat aktivitas terkini...</span>
              </div>
            ) : activityTimeline.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-bold">
                Tidak ada riwayat aktivitas terkini.
              </div>
            ) : (
              activityTimeline.map((act: any, idx: number) => {
                const actId = act.id || idx;
                const title = act.title || act.name || act.action || 'Aktivitas';
                const time = act.time || act.created_at || act.date || 'Baru saja';
                const description = act.description || act.message || act.detail || '-';
                const type = act.type || act.category || 'General';

                return (
                  <div key={actId} className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
                    <div className="p-2 bg-white rounded-xl shadow-xs shrink-0 border border-gray-200">
                      {getActivityIcon(type)}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-gray-900">{title}</h3>
                        <span className="text-[10px] text-gray-400 font-mono">{time}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 10. QUICK ACCESS NAVIGATION */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-amber-400">Executive Quick Access Portals</h2>
            <p className="text-xs text-slate-400">Akses langsung ke seluruh modul manajemen operasional platform</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Navigasi Langsung</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Finance Portal */}
          <Link
            to="/dashboard/finance"
            className="p-4 rounded-2xl bg-slate-800/90 hover:bg-emerald-950/80 border border-slate-700/80 text-left transition-all group space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <DollarSign className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white">Finance Portal</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Laporan keuangan, refund, settlement</p>
            </div>
          </Link>

          {/* Operations Portal */}
          <Link
            to="/dashboard/operations"
            className="p-4 rounded-2xl bg-slate-800/90 hover:bg-blue-950/80 border border-slate-700/80 text-left transition-all group space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Server className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white">Operations Portal</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Produk, provider, margin, monitoring</p>
            </div>
          </Link>

          {/* Customer Support */}
          <Link
            to="/dashboard/customer-support"
            className="p-4 rounded-2xl bg-slate-800/90 hover:bg-rose-950/80 border border-slate-700/80 text-left transition-all group space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Headset className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white">Customer Support</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Tiket bantuan, kendala pengguna, KB</p>
            </div>
          </Link>

          {/* Marketing Portal */}
          <Link
            to="/dashboard/marketing"
            className="p-4 rounded-2xl bg-slate-800/90 hover:bg-purple-950/80 border border-slate-700/80 text-left transition-all group space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <BarChart3 className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white">Marketing Portal</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Banner promo, kupon, campaign</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

