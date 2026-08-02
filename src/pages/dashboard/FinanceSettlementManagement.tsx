import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Search,
  Download,
  Eye,
  Printer,
  X,
  Lock,
  RefreshCw,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useFinanceStore } from '../../store/finance.store';
import { EmptyState } from '../../components/common/EmptyState';

export type SettlementStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface SettlementRecord {
  settlementId: string;
  invoiceNumber: string;
  transactionId: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
  paymentGateway: string;
  paymentReference: string;
  settlementAmount: number;
  settlementDate: string;
  status: SettlementStatus;
  internalNote: string;
}

const normalizeSettlement = (item: any): SettlementRecord => {
  return {
    settlementId: item.settlementId || item.settlement_id || item.id || 'N/A',
    invoiceNumber: item.invoiceNumber || item.invoice_number || item.invoice_id || item.invoice || 'N/A',
    transactionId: item.transactionId || item.transaction_id || item.trx_id || 'N/A',
    customerName: item.customerName || item.customer_name || item.user?.name || item.customer?.name || 'N/A',
    customerEmail: item.customerEmail || item.customer_email || item.user?.email || item.customer?.email || 'N/A',
    paymentMethod: item.paymentMethod || item.payment_method || item.method || 'N/A',
    paymentGateway: item.paymentGateway || item.payment_gateway || item.gateway || 'N/A',
    paymentReference: item.paymentReference || item.payment_reference || item.reference || 'N/A',
    settlementAmount: Number(item.settlementAmount ?? item.settlement_amount ?? item.amount ?? 0),
    settlementDate: item.settlementDate || item.settlement_date || item.created_at || item.date || 'N/A',
    status: item.status || 'Pending',
    internalNote: item.internalNote || item.internal_note || item.note || item.notes || '-',
  };
};

export const FinanceSettlementManagement: React.FC = () => {
  const {
    settlements,
    settlementsPagination,
    settlementsLoading,
    settlementsError,
    fetchSettlements
  } = useFinanceStore();

  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRecord | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [gatewayFilter, setGatewayFilter] = useState<string>('All');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All Time');
  const [page, setPage] = useState<number>(1);

  // Modal / Toast State
  const [printModalRecord, setPrintModalRecord] = useState<SettlementRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch settlements on component mount or filter change
  useEffect(() => {
    const params: Record<string, any> = { page };
    if (statusFilter !== 'All') params.status = statusFilter;
    if (gatewayFilter !== 'All') params.gateway = gatewayFilter;
    if (customerSearch.trim()) params.search = customerSearch.trim();
    if (dateRangeFilter !== 'All Time') params.date_range = dateRangeFilter;

    fetchSettlements(params);
  }, [fetchSettlements, page, statusFilter, gatewayFilter, customerSearch, dateRangeFilter]);

  const normalizedSettlements = useMemo(() => {
    return (settlements || []).map(normalizeSettlement);
  }, [settlements]);

  // Top Summary Computations from normalized data
  const pendingCount = useMemo(() => {
    return normalizedSettlements.filter((s) => s.status === 'Pending' || s.status === 'Processing').length;
  }, [normalizedSettlements]);

  const completedTodayCount = useMemo(() => {
    return normalizedSettlements.filter((s) => s.status === 'Completed').length;
  }, [normalizedSettlements]);

  const settlementAmountToday = useMemo(() => {
    return normalizedSettlements
      .filter((s) => s.status === 'Completed')
      .reduce((acc, curr) => acc + curr.settlementAmount, 0);
  }, [normalizedSettlements]);

  // Quick Action Export Summary
  const handleExportSummary = () => {
    if (normalizedSettlements.length === 0) {
      showNotification('Tidak ada data settlement untuk dieksport.');
      return;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Settlement ID,Invoice,Customer,Payment Method,Gateway,Amount,Status,Date']
        .concat(
          normalizedSettlements.map(
            (s) =>
              `${s.settlementId},${s.invoiceNumber},${s.customerName},${s.paymentMethod},${s.paymentGateway},${s.settlementAmount},${s.status},${s.settlementDate}`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finance_Settlement_Summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Summary rekonsiliasi settlement berhasil dieksport (CSV).');
  };

  const getStatusBadge = (status: SettlementStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            Processing
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Failed
          </span>
        );
      case 'Cancelled':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
            <X className="w-3.5 h-3.5 text-gray-500" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {settlementsError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between text-red-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{settlementsError}</span>
          </div>
          <button
            onClick={() => fetchSettlements()}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-xs font-bold transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-[11px] font-bold text-blue-200 border border-blue-400/30">
              <Building className="w-3.5 h-3.5" />
              GurkyNet Finance Settlement Module
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Settlement Management
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
              Pemantauan rekonsiliasi kliring dana masuk dari payment gateway, bank virtual account, dan e-wallet ke rekening perbankan GurkyNet.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportSummary}
              className="px-4 py-2.5 bg-white text-blue-950 rounded-2xl font-extrabold text-xs shadow-md hover:bg-blue-50 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-blue-700" />
              <span>Export Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* WARNING BANNER */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start sm:items-center gap-3 text-amber-900 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <div className="font-extrabold text-amber-950">
            Notice: Settlement data is read-only. No payment execution. No approval.
          </div>
          <p className="text-amber-800/90 mt-0.5">
            Semua rekaman settlement disinkronkan langsung dari laporan API gateway secara otomatis untuk kebutuhan audit finansial.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-200/60 text-amber-900 font-mono shrink-0">
          <Lock className="w-3 h-3" /> READ-ONLY SETTLEMENT
        </span>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Settlement */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Pending Settlement</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingCount} Transaksi</div>
          <div className="text-[11px] text-gray-400">Dalam antrean kliring gateway</div>
        </div>

        {/* Card 2: Completed */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Completed Settlement</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{completedTodayCount} Batch</div>
          <div className="text-[11px] text-gray-400">Tuntas disetorkan</div>
        </div>

        {/* Card 3: Settlement Amount */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Total Settlement Amount</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            Rp {settlementAmountToday.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-gray-400">Omzet net diterima</div>
        </div>

        {/* Card 4: Average Settlement Time */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Average Settlement Time</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">14 Menit</div>
          <div className="text-[11px] text-gray-400">Rata-rata waktu kliring H+0</div>
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Filter & Pencarian Settlement</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {normalizedSettlements.length} {settlementsPagination ? `of ${settlementsPagination.total}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Filter Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Filter Payment Gateway */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Payment Gateway</label>
            <select
              value={gatewayFilter}
              onChange={(e) => {
                setGatewayFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Payment Gateway</option>
              <option value="Midtrans">Midtrans</option>
              <option value="Xendit">Xendit</option>
              <option value="BCA Direct">BCA Direct</option>
              <option value="Artajasa">Artajasa</option>
              <option value="DOKU">DOKU</option>
            </select>
          </div>

          {/* Filter Customer Search */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Customer / Invoice / ID</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama, invoice, STL ID..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Filter Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All Time">Semua Waktu</option>
              <option value="Today">Hari Ini</option>
            </select>
          </div>
        </div>
      </div>

      {/* SETTLEMENT TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Rekapitulasi Settlement Management</h2>
            <p className="text-xs text-gray-500">Klik baris mana saja untuk melihat Detail Panel & Bukti Referensi Kliring</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSummary}
              className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Export Summary
            </button>
          </div>
        </div>

        {settlementsLoading ? (
          <div className="p-12 text-center text-gray-500 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat data settlement...</p>
          </div>
        ) : normalizedSettlements.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Building}
              title="Tidak Ada Data Settlement"
              description="Belum ada data settlement yang tersedia untuk parameter filter ini."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Settlement ID</th>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Settlement Amount</th>
                  <th className="py-3 px-4">Payment Gateway</th>
                  <th className="py-3 px-4">Settlement Status</th>
                  <th className="py-3 px-4">Settlement Date</th>
                  <th className="py-3 px-4 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {normalizedSettlements.map((item) => (
                  <tr
                    key={item.settlementId}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    onClick={() => setSelectedSettlement(item)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {item.settlementId}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-gray-800">
                      {item.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{item.customerName}</div>
                      <div className="text-[10px] text-gray-400">{item.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 font-semibold text-[11px] text-gray-700">
                        {item.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-gray-900">
                      Rp {item.settlementAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-700">
                      {item.paymentGateway}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                      {item.settlementDate}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedSettlement(item)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                          title="View Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrintModalRecord(item)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 transition"
                          title="Print Settlement"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {settlementsPagination && ((settlementsPagination.lastPage || settlementsPagination.last_page || 1) > 1) && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Halaman {settlementsPagination.currentPage || settlementsPagination.current_page || 1} dari {settlementsPagination.lastPage || settlementsPagination.last_page || 1} ({settlementsPagination.total} Data)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= (settlementsPagination.lastPage || settlementsPagination.last_page || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL PANEL MODAL */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-slate-800 px-2 py-0.5 rounded">
                    {selectedSettlement.settlementId}
                  </span>
                  {getStatusBadge(selectedSettlement.status)}
                </div>
                <h2 className="text-lg font-extrabold">Detail Kliring Settlement</h2>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-gray-800">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Settlement ID</span>
                  <div className="font-mono font-extrabold text-blue-700 mt-0.5">{selectedSettlement.settlementId}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Invoice Number</span>
                  <div className="font-mono font-extrabold text-gray-900 mt-0.5">{selectedSettlement.invoiceNumber}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Transaction ID</span>
                  <div className="font-mono font-extrabold text-gray-800 mt-0.5">{selectedSettlement.transactionId}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Customer</span>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedSettlement.customerName}</div>
                  <div className="text-[10px] text-gray-400">{selectedSettlement.customerEmail}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Payment Gateway</span>
                  <div className="font-extrabold text-indigo-700 mt-0.5">{selectedSettlement.paymentGateway}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Payment Reference</span>
                  <div className="font-mono text-gray-800 mt-0.5">{selectedSettlement.paymentReference}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Settlement Amount</span>
                  <div className="font-black text-emerald-700 text-sm mt-0.5">
                    Rp {selectedSettlement.settlementAmount.toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Settlement Date</span>
                  <div className="font-mono text-gray-600 mt-0.5">{selectedSettlement.settlementDate}</div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Status Kliring:</h3>
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-900 text-xs">{selectedSettlement.status}</span>
                    <p className="text-[11px] text-blue-700 mt-0.5">Gateway: {selectedSettlement.paymentGateway}</p>
                  </div>
                  {getStatusBadge(selectedSettlement.status)}
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Internal Note (Catatan Rekonsiliasi):</h3>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedSettlement.internalNote}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => setPrintModalRecord(selectedSettlement)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Settlement Slip</span>
              </button>

              <button
                onClick={() => setSelectedSettlement(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT SETTLEMENT MODAL */}
      {printModalRecord && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-gray-900">Bukti Cetak Settlement (Slip)</h3>
              </div>
              <button
                onClick={() => setPrintModalRecord(null)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Preview Area */}
            <div className="p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-3 text-xs font-mono">
              <div className="text-center border-b border-gray-200 pb-2">
                <div className="font-extrabold text-sm text-gray-900">GURKYNET FINANCE CMS</div>
                <div className="text-[10px] text-gray-500">OFFICIAL SETTLEMENT CLEARING SLIP</div>
              </div>

              <div className="space-y-1 text-[11px] text-gray-800">
                <div className="flex justify-between">
                  <span className="text-gray-500">SETTLEMENT ID:</span>
                  <span className="font-bold">{printModalRecord.settlementId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">INVOICE:</span>
                  <span className="font-bold">{printModalRecord.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CUSTOMER:</span>
                  <span className="font-bold">{printModalRecord.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GATEWAY:</span>
                  <span className="font-bold">{printModalRecord.paymentGateway}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">REF NO:</span>
                  <span className="font-bold">{printModalRecord.paymentReference}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 text-emerald-700 font-extrabold">
                  <span>NET AMOUNT:</span>
                  <span>Rp {printModalRecord.settlementAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-[10px]">
                  <span>DATE:</span>
                  <span>{printModalRecord.settlementDate}</span>
                </div>
              </div>

              <div className="text-[10px] text-center text-gray-400 border-t border-gray-200 pt-2">
                Disahkan secara digital oleh Sistem Audit Keuangan GurkyNet
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Save PDF</span>
              </button>
              <button
                onClick={() => setPrintModalRecord(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
