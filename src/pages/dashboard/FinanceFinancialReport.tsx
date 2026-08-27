import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  FileText,
  Download,
  DollarSign,
  TrendingUp,
  CreditCard,
  RotateCcw,
  Building,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
  PieChart,
  RefreshCw
} from 'lucide-react';
import { FinancialReportCharts } from '../../components/finance/FinancialReportCharts';
import { useFinanceStore } from '../../store/finance.store';
import { financeService } from '../../services/finance.service';
import { DataTableCard, StatCard, EmptyState, StatusBadge } from '../../components/common';

export const FinanceFinancialReport: React.FC = () => {
  const {
    reports,
    reportsSummary,
    reportsPagination,
    reportsLoading,
    reportsError,
    fetchReports,
    dashboardData,
    fetchDashboard
  } = useFinanceStore();

  // Filters
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('Bulan Ini');
  const [typeFilter, setTypeFilter] = useState<string>('Semua Tipe');
  const [methodFilter, setMethodFilter] = useState<string>('Semua Metode');
  const [statusFilter, setStatusFilter] = useState<string>('Semua Status');
  const [providerFilter, setProviderFilter] = useState<string>('Semua Provider');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch reports when filters change
  useEffect(() => {
    const params: Record<string, any> = {
      page: currentPage,
    };

    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (typeFilter !== 'Semua Tipe') params.type = typeFilter;
    if (methodFilter !== 'Semua Metode') params.method = methodFilter;
    if (statusFilter !== 'Semua Status') params.status = statusFilter;
    if (providerFilter !== 'Semua Provider') params.provider = providerFilter;
    if (dateRangeFilter !== 'Semua Waktu') params.date_range = dateRangeFilter;

    fetchReports(params);
  }, [dateRangeFilter, typeFilter, methodFilter, statusFilter, providerFilter, searchQuery, currentPage, fetchReports]);

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  // FR-FIN-08 — server Excel/PDF; CSV kept as compatibility export
  const handleExportData = async (format: 'CSV' | 'Excel' | 'PDF') => {
    if (format === 'Excel' || format === 'PDF') {
      try {
        const period =
          dateRangeFilter.includes('Minggu') || dateRangeFilter.toLowerCase().includes('week')
            ? 'weekly'
            : dateRangeFilter.includes('Hari') || dateRangeFilter.toLowerCase().includes('day')
              ? 'daily'
              : 'monthly';
        const res = await financeService.exportReportBlob({
          format: format === 'PDF' ? 'pdf' : 'xlsx',
          period,
        });
        const blob = new Blob([res.data], {
          type: format === 'PDF'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `laporan-keuangan.${format === 'PDF' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showNotification(`Laporan ${format} berhasil diunduh.`);
      } catch (e: any) {
        showNotification(e?.response?.data?.message || e?.message || `Gagal ekspor ${format}.`);
      }
      return;
    }

    if (reports.length === 0) {
      showNotification('Tidak ada data laporan untuk diekspor.');
      return;
    }

    const headers = ['ID', 'Date', 'Category', 'Description', 'Amount', 'Status', 'Payment Method', 'Provider'];
    const rows = reports.map((r: any) => [
      r.id || r.invoice_number || '-',
      r.date || r.created_at || '-',
      r.category || r.type || 'General',
      `"${(r.description || r.note || '').replace(/"/g, '""')}"`,
      r.amount || r.total_amount || 0,
      r.status || 'Success',
      r.paymentMethod || r.method || '-',
      r.provider || '-'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Laporan berhasil diekspor (CSV).');
  };

  const getStatusVariant = (status: string) => {
    const lower = (status || '').toLowerCase();
    if (lower === 'success' || lower === 'paid' || lower === 'sukses') return 'success';
    if (lower === 'pending') return 'warning';
    if (lower === 'failed' || lower === 'gagal') return 'error';
    if (lower === 'refunded' || lower === 'retur') return 'neutral';
    return 'neutral';
  };

  const summary = dashboardData?.summary || dashboardData || {};
  const reportSummary = reportsSummary || {};
  const formatRp = (value: number | undefined | null) =>
    `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
  const profitFormatted = summary.profitFormatted || formatRp(reportSummary.profit ?? summary.profit);
  const marginFormatted = summary.marginFormatted || formatRp(reportSummary.margin ?? summary.margin);
  const expensesFormatted = summary.expensesFormatted || formatRp(reportSummary.expenses ?? summary.expenses);
  const providerCostFormatted = formatRp(reportSummary.provider_cost ?? summary.provider_cost);
  const customerCount = reportSummary.customers ?? '—';
  const providerCount = reportSummary.providers ?? '—';
  const grossRevenueFormatted = formatRp(reportSummary.gross_revenue);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-amber-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-xs text-[11px] font-bold text-amber-200 border border-amber-400/30">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              GurkyNet Financial Report Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Laporan Keuangan & Audit Ledger
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed max-w-2xl">
              Pusat analisis laporan pendapatan, statistik transaksi, rekonsiliasi pengembalian dana, dan distribusi channel perbankan secara terpusat.
            </p>
          </div>

          {/* Quick Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Print Report</span>
            </button>

            <button
              onClick={() => handleExportData('CSV')}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-slate-950" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExportData('Excel')}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => handleExportData('PDF')}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {reportsError && (
        <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-xs font-semibold flex items-center justify-between">
          <span>{reportsError}</span>
          <button
            onClick={() => fetchReports()}
            className="px-3 py-1 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={summary.todaysRevenueFormatted || (summary.totalRevenue ? `Rp ${Number(summary.totalRevenue).toLocaleString('id-ID')}` : 'Rp 0')}
          change={summary.revenueGrowth || 'Real-time'}
          changeType="positive"
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <StatCard
          title="Monthly Revenue"
          value={summary.monthlyRevenueFormatted || (summary.monthlyRevenue || summary.monthly_revenue ? `Rp ${Number(summary.monthlyRevenue || summary.monthly_revenue).toLocaleString('id-ID')}` : 'Rp 0')}
          change={summary.revenueGrowth || '0%'}
          changeType="neutral"
          icon={TrendingUp}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Total Transactions"
          value={`${(summary.totalTransactions ?? reports.length).toLocaleString('id-ID')} TRX`}
          change={summary.autoSettlementRate ? `Settlement ${summary.autoSettlementRate}` : 'Recorded'}
          changeType="neutral"
          icon={CreditCard}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />

        <StatCard
          title="Profit"
          value={profitFormatted}
          change={`Margin ${marginFormatted}`}
          changeType="positive"
          icon={RotateCcw}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* REPORT FILTER BAR */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Report Filter & Parameters</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {reports.length} records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Filter 1: Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="Hari Ini">Hari Ini</option>
              <option value="7 Hari Terakhir">7 Hari Terakhir</option>
              <option value="Bulan Ini">Bulan Ini</option>
              <option value="Semua Waktu">Semua Waktu</option>
            </select>
          </div>

          {/* Filter 2: Transaction Type */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Transaction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="Semua Tipe">Semua Tipe</option>
              <option value="PLN Token">PLN Token</option>
              <option value="Pulsa & Data">Pulsa & Data</option>
              <option value="Game Voucher">Game Voucher</option>
              <option value="BPJS & PPOB">BPJS & PPOB</option>
              <option value="Refund">Refund</option>
            </select>
          </div>

          {/* Filter 3: Payment Method */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Payment Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="Semua Metode">Semua Metode</option>
              <option value="BCA Virtual Account">BCA Virtual Account</option>
              <option value="Mandiri Virtual Account">Mandiri Virtual Account</option>
              <option value="QRIS">QRIS</option>
              <option value="GoPay">GoPay</option>
              <option value="Indomaret">Indomaret</option>
            </select>
          </div>

          {/* Filter 4: Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="Semua Status">Semua Status</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>

          {/* Filter 5: Provider */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="Semua Provider">Semua Provider</option>
              <option value="Digiflazz">Digiflazz</option>
              <option value="Alterra">Alterra</option>
              <option value="Artajasa">Artajasa</option>
              <option value="Midtrans">Midtrans</option>
              <option value="Xendit">Xendit</option>
            </select>
          </div>
        </div>
      </div>

      {/* REPORT SECTIONS (6 SUMMARY CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Revenue Summary
            </h3>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">Gross vs Net</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Today Volume:</span>
              <span className="font-extrabold text-gray-900">{summary.todaysRevenueFormatted || 'Rp 0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Monthly Volume:</span>
              <span className="font-bold text-emerald-600">{summary.monthlyRevenueFormatted || formatRp(summary.monthlyRevenue || summary.monthly_revenue)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-emerald-700 font-extrabold">
              <span>Report Gross:</span>
              <span>{reportsSummary ? grossRevenueFormatted : 'Filter laporan'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Transaction Summary
            </h3>
            <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">Performance</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Total TRX Count:</span>
              <span className="font-extrabold text-gray-900">{(summary.totalTransactions ?? reports.length).toLocaleString('id-ID')} TRX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Auto-Settlement Rate:</span>
              <span className="font-bold text-emerald-600">{summary.autoSettlementRate || '0%'}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-blue-700 font-extrabold">
              <span>Customers (filter):</span>
              <span>{customerCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-purple-600" />
              Refund Summary
            </h3>
            <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold">Audit Retur</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Pending Requests:</span>
              <span className="font-extrabold text-purple-700">{summary.pendingRefundsCount || 0} Permohonan</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Estimasi Nilai:</span>
              <span className="font-bold text-amber-600">{summary.pendingRefundsValueFormatted || 'Rp 0'}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-purple-900 font-extrabold">
              <span>Refund Expense:</span>
              <span>{formatRp(reportSummary.refund_expense)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-indigo-600" />
              Settlement Summary
            </h3>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold">Live Ledger</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Pending Settlement:</span>
              <span className="font-extrabold text-amber-600">{summary.pendingSettlementFormatted || 'Rp 0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Notes:</span>
              <span className="font-bold text-gray-600">{summary.pendingSettlementNotes || '0 transaksi menunggu'}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-indigo-700 font-extrabold">
              <span>Settlement Rows:</span>
              <span>{summary.settlement_success_count ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-amber-600" />
              Profit &amp; Margin
            </h3>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">Real Txn</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Profit:</span>
              <span className="font-extrabold text-gray-900">{profitFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Margin:</span>
              <span className="font-bold text-gray-800">{marginFormatted}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-amber-800 font-extrabold">
              <span>Expenses:</span>
              <span>{expensesFormatted}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-600" />
              Providers &amp; Cost
            </h3>
            <span className="text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded font-bold">DB Aggregates</span>
          </div>
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Provider Cost:</span>
              <span className="font-extrabold text-gray-900">{providerCostFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Service Lines:</span>
              <span className="font-bold text-gray-800">{providerCount}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-cyan-800 font-extrabold">
              <span>Customers:</span>
              <span>{customerCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          Tren Grafik Keuangan (Charts)
        </h2>
        <FinancialReportCharts />
      </div>

      {/* REPORT TABLE */}
      <DataTableCard
        title="Jurnal Mutasi Keuangan (Report Ledger)"
        subtitle="Rincian mutasi transaksi kas & kredit keuangan GurkyNet"
        action={
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari deskripsi, kategori, ID..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        }
      >
        {reportsLoading ? (
          <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
            Memuat data laporan keuangan dari backend...
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Data Laporan Tidak Ditemukan"
            description="Tidak ada catatan transaksi yang memenuhi kriteria filter laporan."
          />
        ) : (
          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {reports.map((item: any, idx: number) => {
                  const id = item.id || item.invoice_number || `REP-${idx + 1}`;
                  const date = item.date || item.created_at || '-';
                  const category = item.category || item.type || 'Transaction';
                  const description = item.description || item.note || 'Transaksi Keuangan';
                  const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount || item.total_amount || 0);
                  const status = item.status || 'Success';
                  const paymentMethod = item.paymentMethod || item.method || 'VA';
                  const provider = item.provider || '-';

                  return (
                    <tr key={id + idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-bold text-[11px]">
                          {category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md truncate">
                        <div className="font-semibold text-gray-900">{description}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          ID: {id} • {paymentMethod} • {provider}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold whitespace-nowrap">
                        <span className={amount < 0 ? 'text-purple-700' : 'text-emerald-700'}>
                          {amount < 0 ? '-' : ''}Rp {Math.abs(amount).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={status} variant={getStatusVariant(status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {reportsPagination && ((reportsPagination.lastPage || reportsPagination.last_page || 1) > 1) && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Halaman {reportsPagination.currentPage || reportsPagination.current_page || 1} dari {reportsPagination.lastPage || reportsPagination.last_page || 1} (Total {reportsPagination.total} items)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 font-bold disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={currentPage >= (reportsPagination.lastPage || reportsPagination.last_page || 1)}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 font-bold disabled:opacity-40 hover:bg-gray-50 transition"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DataTableCard>
    </div>
  );
};

