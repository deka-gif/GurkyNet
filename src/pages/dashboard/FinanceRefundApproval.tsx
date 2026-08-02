import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Filter,
  Search,
  Download,
  Eye,
  FileText,
  X,
  RefreshCw
} from 'lucide-react';
import { useFinanceStore } from '../../store/finance.store';
import { DataTableCard, StatCard, EmptyState, StatusBadge } from '../../components/common';

export const FinanceRefundApproval: React.FC = () => {
  const {
    refunds,
    refundsPagination,
    refundsLoading,
    refundsError,
    fetchRefunds,
    approveRefund,
    rejectRefund,
    dashboardData,
    fetchDashboard
  } = useFinanceStore();

  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [reviewerFilter, setReviewerFilter] = useState<string>('All');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All Time');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Decision Form State inside Modal
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    const params: Record<string, any> = { page: currentPage };
    if (statusFilter !== 'All') params.status = statusFilter;
    if (priorityFilter !== 'All') params.priority = priorityFilter;
    if (customerSearch.trim()) params.search = customerSearch.trim();
    if (dateRangeFilter !== 'All Time') params.date_range = dateRangeFilter;

    fetchRefunds(params);
  }, [statusFilter, priorityFilter, customerSearch, dateRangeFilter, currentPage, fetchRefunds]);

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboard();
    }
  }, [dashboardData, fetchDashboard]);

  // Handle Review Action Submission
  const handleDecisionSubmit = async (newStatus: 'Approved' | 'Rejected' | 'Need More Information') => {
    if (!selectedRefund) return;
    setSubmittingAction(true);

    try {
      const refundId = selectedRefund.refundId || selectedRefund.id;
      if (newStatus === 'Approved') {
        await approveRefund(refundId, decisionNote);
        showNotification(`Permohonan refund ${refundId} berhasil disetujui.`);
      } else if (newStatus === 'Rejected') {
        await rejectRefund(refundId, decisionNote);
        showNotification(`Permohonan refund ${refundId} ditolak.`);
      } else {
        // Fallback note update
        await approveRefund(refundId, decisionNote || 'Need More Info requested');
        showNotification(`Permohonan refund ${refundId} telah diperbarui.`);
      }
      setSelectedRefund(null);
      setDecisionNote('');
    } catch (err: any) {
      showNotification(`Gagal memperbarui refund: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExportSummary = () => {
    if (refunds.length === 0) {
      showNotification('Tidak ada data refund untuk diekspor.');
      return;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Refund ID,Invoice,Customer,Amount,Priority,Status,Created At']
        .concat(
          refunds.map(
            (r: any) =>
              `${r.refundId || r.id},${r.invoiceNumber || r.invoice_number || '-'},${r.customerName || r.user_name || '-'},${r.requestedAmount || r.amount || 0},${r.priority || 'Medium'},${r.status || 'Pending Review'},${r.createdAt || r.created_at || '-'}`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Finance_Refund_Summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Summary laporan refund berhasil dieksport (CSV Format).');
  };

  const getStatusVariant = (status: string) => {
    const lower = (status || '').toLowerCase();
    if (lower.includes('approved') || lower.includes('success')) return 'success';
    if (lower.includes('pending')) return 'warning';
    if (lower.includes('reject') || lower.includes('failed')) return 'error';
    return 'neutral';
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || 'low').toLowerCase();
    if (p === 'high') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase">High</span>;
    }
    if (p === 'medium') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Medium</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">Low</span>;
  };

  const summary = dashboardData?.summary || dashboardData || {};

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-xs text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Finance CMS - Refund Approval Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Refund Approval Center
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
              Tinjau, evaluasi bukti pendukung, dan berikan keputusan otorisasi pengembalian dana yang diajukan oleh tim Customer Support.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportSummary}
              className="px-4 py-2.5 bg-white text-emerald-950 rounded-2xl font-extrabold text-xs shadow-md hover:bg-emerald-50 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Export Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {refundsError && (
        <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-xs font-semibold flex items-center justify-between">
          <span>{refundsError}</span>
          <button
            onClick={() => fetchRefunds()}
            className="px-3 py-1 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={`${summary.pendingRefundsCount || refunds.filter((r: any) => (r.status || '').toLowerCase().includes('pending')).length} Cases`}
          change="Needs Finance Decision"
          changeType="warning"
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />

        <StatCard
          title="Approved Cases"
          value={`${refunds.filter((r: any) => (r.status || '').toLowerCase().includes('approved')).length} Claims`}
          change="Verified & Settled"
          changeType="positive"
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <StatCard
          title="Rejected Cases"
          value={`${refunds.filter((r: any) => (r.status || '').toLowerCase().includes('reject')).length} Claims`}
          change="Declined by Finance"
          changeType="negative"
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />

        <StatCard
          title="Total Refund Value"
          value={summary.pendingRefundsValueFormatted || `Rp ${(summary.pendingRefundsValue || 0).toLocaleString('id-ID')}`}
          change="Total Refund Value"
          changeType="neutral"
          icon={Receipt}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Filter & Pencarian Refund</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {refunds.length} records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Filter Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Need More Information">Need More Information</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Filter Priority */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Prioritas</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
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
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Cari nama, invoice..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Filter Reviewer */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Reviewer</label>
            <select
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Reviewer</option>
              <option value="Finance Manager">Finance Manager</option>
            </select>
          </div>

          {/* Filter Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All Time">Semua Waktu</option>
              <option value="Today">Hari Ini</option>
            </select>
          </div>
        </div>
      </div>

      {/* REFUND TABLE */}
      <DataTableCard
        title="Daftar Permohonan Refund"
        subtitle="Klik baris mana saja untuk membuka Detail Panel & Otorisasi Review Finance"
        action={
          <button
            onClick={handleExportSummary}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
        }
      >
        {refundsLoading ? (
          <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
            Memuat daftar permohonan refund dari backend...
          </div>
        ) : refunds.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Permohonan Refund Tidak Ditemukan"
            description="Tidak ada klaim refund yang cocok dengan kriteria pencarian saat ini."
          />
        ) : (
          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Refund ID</th>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Requested Amount</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {refunds.map((refund: any, idx: number) => {
                  const id = refund.refundId || refund.id || `RFD-${idx + 1}`;
                  const invoice = refund.invoiceNumber || refund.invoice_number || '-';
                  const custName = refund.customerName || refund.user_name || refund.user?.name || 'Pelanggan';
                  const custEmail = refund.customerEmail || refund.user_email || refund.user?.email || '-';
                  const reqAmount = typeof refund.requestedAmount === 'number' ? refund.requestedAmount : Number(refund.amount || refund.requested_amount || 0);
                  const reason = refund.reason || refund.note || 'Pengajuan Refund';
                  const requestedBy = refund.requestedByCS || refund.cs_name || 'CS Staff';
                  const priority = refund.priority || 'Medium';
                  const status = refund.status || 'Pending Review';
                  const createdAt = refund.createdAt || refund.created_at || '-';

                  return (
                    <tr
                      key={id}
                      onClick={() => {
                        setSelectedRefund(refund);
                        setDecisionNote(refund.internalReviewNote || refund.review_note || '');
                      }}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {id}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-gray-800">
                        {invoice}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{custName}</div>
                        <div className="text-[10px] text-gray-400">{custEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-gray-900">
                        Rp {reqAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-gray-600">
                        {reason}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-blue-700">
                        {requestedBy}
                      </td>
                      <td className="py-3.5 px-4">{getPriorityBadge(priority)}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={status} variant={getStatusVariant(status)} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                        {createdAt}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="p-1.5 rounded-xl bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-600 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {refundsPagination && ((refundsPagination.lastPage || refundsPagination.last_page || 1) > 1) && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Halaman {refundsPagination.currentPage || refundsPagination.current_page || 1} dari {refundsPagination.lastPage || refundsPagination.last_page || 1} (Total {refundsPagination.total} items)
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
                    disabled={currentPage >= (refundsPagination.lastPage || refundsPagination.last_page || 1)}
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

      {/* DETAIL PANEL & FINANCE REVIEW SLIDE-OVER / MODAL */}
      {selectedRefund && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50 p-2 sm:p-4">
          <div className="bg-white w-full max-w-2xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-800 px-2 py-0.5 rounded">
                    {selectedRefund.refundId || selectedRefund.id}
                  </span>
                  <StatusBadge status={selectedRefund.status || 'Pending Review'} variant={getStatusVariant(selectedRefund.status)} />
                </div>
                <h2 className="text-lg font-extrabold">Detail Permohonan & Review Finance</h2>
              </div>
              <button
                onClick={() => setSelectedRefund(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-gray-800">
              {/* DISPLAY SECTION */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Invoice Number</span>
                  <div className="font-mono font-extrabold text-blue-600 mt-0.5">{selectedRefund.invoiceNumber || selectedRefund.invoice_number || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Transaction ID</span>
                  <div className="font-mono font-extrabold text-gray-800 mt-0.5">{selectedRefund.transactionId || selectedRefund.transaction_id || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Customer</span>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedRefund.customerName || selectedRefund.user_name || 'Pelanggan'}</div>
                  <div className="text-[10px] text-gray-400">{selectedRefund.customerEmail || selectedRefund.user_email || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Original Amount</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">
                    Rp {(selectedRefund.originalAmount || selectedRefund.original_amount || selectedRefund.amount || 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Requested Amount</span>
                  <div className="font-black text-emerald-700 text-sm mt-0.5">
                    Rp {(selectedRefund.requestedAmount || selectedRefund.requested_amount || selectedRefund.amount || 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Created Date</span>
                  <div className="font-mono text-gray-600 mt-0.5">{selectedRefund.createdAt || selectedRefund.created_at || '-'}</div>
                </div>
              </div>

              {/* REASON & CS NOTES */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-extrabold text-gray-900 text-xs mb-1">Reason (Alasan Pengajuan):</h3>
                  <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-red-900 font-medium leading-relaxed">
                    {selectedRefund.reason || selectedRefund.note || 'Pengajuan refund'}
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-gray-900 text-xs mb-1">CS Notes & Recommendation:</h3>
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 font-medium leading-relaxed">
                    <p className="font-bold text-[11px] mb-0.5">Requested By: {selectedRefund.requestedByCS || selectedRefund.cs_name || 'CS Staff'}</p>
                    {selectedRefund.csNotes || selectedRefund.cs_notes || 'Mohon ditinjau oleh Finance.'}
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-gray-900 text-xs mb-1">Evidence / Attachment:</h3>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2 text-gray-700 font-mono text-[11px]">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{selectedRefund.evidencePlaceholder || selectedRefund.evidence || 'Dokumen Bukti Transaksi Attached'}</span>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* FINANCE REVIEW PANEL */}
              <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-extrabold text-sm text-white">Finance Review Panel</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Audit Form</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Internal Review Note (Catatan Finance)</label>
                  <textarea
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Masukkan pertimbangan audit pembukuan, instruksi reversal, atau alasan penolakan..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS FOOTER */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {/* Approve Refund */}
                <button
                  disabled={submittingAction}
                  onClick={() => handleDecisionSubmit('Approved')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Refund</span>
                </button>

                {/* Reject Refund */}
                <button
                  disabled={submittingAction}
                  onClick={() => handleDecisionSubmit('Rejected')}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-red-600/20 transition flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Refund</span>
                </button>

                {/* Request More Information */}
                <button
                  disabled={submittingAction}
                  onClick={() => handleDecisionSubmit('Need More Information')}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Request Info</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedRefund(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition"
              >
                Batal / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

