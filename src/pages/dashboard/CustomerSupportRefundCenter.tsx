import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  PlusCircle,
  Send,
  ArrowUpRight,
  Download,
  X,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2
} from 'lucide-react';

import { useCustomerSupportStore, RefundItem } from '../../store/customerSupport.store';

export const CustomerSupportRefundCenter: React.FC = () => {
  const navigate = useNavigate();

  const {
    refunds,
    refundsLoading,
    fetchRefunds,
    createRefund,
    updateRefundStatus,
    escalateRefund
  } = useCustomerSupportStore();

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Selected Refund Item for Detail Panel
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);

  const activeRefundList: RefundItem[] = useMemo(() => {
    if (refunds && refunds.length > 0) return refunds;
    return [
      {
        requestId: 'REF-2026-001',
        invoiceNumber: 'INV/20260731/PLN/0091',
        transactionId: 'TRX-982104',
        customerName: 'Siti Rahmawati',
        customerEmail: 'siti.rahma@yahoo.com',
        customerPhone: '+62 812-3456-7890',
        userId: 'USR-882910',
        transactionAmount: 501500,
        refundAmount: 501500,
        reason: 'Provider Failure',
        priority: 'Critical',
        status: 'Under Review',
        createdBy: 'CS Ani',
        assignedReviewer: 'Finance Lead - Budi',
        escalatedTo: 'Finance',
        escalationReason: 'Provider Investigation',
        reviewNotes: 'Menunggu konfirmasi reversal saldo dari Biller PLN Artajasa.',
        createdAt: '2026-07-31 08:30',
        evidencePlaceholder: 'screenshot_gagal_biller_pln.png (1.4 MB)'
      },
      {
        requestId: 'REF-2026-002',
        invoiceNumber: 'INV/20260727/TGH/0021',
        transactionId: 'TRX-981022',
        customerName: 'Budi Santoso',
        customerEmail: 'budi.santoso@gmail.com',
        customerPhone: '+62 813-9876-5432',
        userId: 'USR-771822',
        transactionAmount: 300000,
        refundAmount: 300000,
        reason: 'Failed Transaction',
        priority: 'High',
        status: 'Approved',
        createdBy: 'CS Doni',
        assignedReviewer: 'Finance Manager - Ratna',
        reviewNotes: 'Pengembalian saldo ke GurkyWallet disetujui, siap eksekusi pembukuan.',
        createdAt: '2026-07-27 10:15',
        evidencePlaceholder: 'mutasi_gagal_bpjs.pdf (820 KB)'
      }
    ];
  }, [refunds]);

  const selectedRefund: RefundItem = useMemo(() => {
    if (selectedRefundId) {
      const found = activeRefundList.find((r) => r.requestId === selectedRefundId || r.id === selectedRefundId);
      if (found) return found;
    }
    return activeRefundList[0] || {
      requestId: 'REF-2026-001',
      invoiceNumber: 'INV/20260731/PLN/0091',
      transactionId: 'TRX-982104',
      customerName: 'Siti Rahmawati',
      customerEmail: 'siti.rahma@yahoo.com',
      customerPhone: '+62 812-3456-7890',
      userId: 'USR-882910',
      transactionAmount: 501500,
      refundAmount: 501500,
      reason: 'Provider Failure',
      priority: 'Critical',
      status: 'Under Review',
      createdBy: 'CS Ani',
      assignedReviewer: 'Finance Lead - Budi',
      createdAt: '2026-07-31 08:30',
      evidencePlaceholder: 'screenshot.png'
    };
  }, [selectedRefundId, activeRefundList]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [reviewerFilter, setReviewerFilter] = useState<string>('All');
  const [reasonFilter, setReasonFilter] = useState<string>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);

  // New Refund Form State
  const [newInvoice, setNewInvoice] = useState('');
  const [newTrxAmount, setNewTrxAmount] = useState('');
  const [newRefundAmount, setNewRefundAmount] = useState('');
  const [newReason, setNewReason] = useState<string>('Failed Transaction');
  const [newPriority, setNewPriority] = useState<string>('Medium');
  const [newEvidence, setNewEvidence] = useState('');

  // Escalation Form State
  const [escalateDepartment, setEscalateDepartment] = useState<string>('Finance');
  const [escalationReasonInput, setEscalationReasonInput] = useState<string>('Provider Investigation');

  // Top Summary Metrics
  const pendingCount = useMemo(() => activeRefundList.filter((r) => r.status === 'Submitted' || r.status === 'Under Review').length, [activeRefundList]);
  const approvedCount = useMemo(() => activeRefundList.filter((r) => r.status === 'Approved' || r.status === 'Completed').length, [activeRefundList]);
  const rejectedCount = useMemo(() => activeRefundList.filter((r) => r.status === 'Rejected' || r.status === 'Cancelled').length, [activeRefundList]);
  const escalatedCount = useMemo(() => activeRefundList.filter((r) => !!r.escalatedTo).length, [activeRefundList]);

  // Filtered Refunds
  const filteredRefunds = useMemo(() => {
    return activeRefundList.filter((item) => {
      const matchSearch =
        (item.requestId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchPriority = priorityFilter === 'All' || item.priority === priorityFilter;
      const matchReviewer = reviewerFilter === 'All' || (item.assignedReviewer || '').includes(reviewerFilter);
      const matchReason = reasonFilter === 'All' || item.reason === reasonFilter;

      return matchSearch && matchStatus && matchPriority && matchReviewer && matchReason;
    });
  }, [activeRefundList, searchQuery, statusFilter, priorityFilter, reviewerFilter, reasonFilter]);

  const totalPages = Math.ceil(filteredRefunds.length / pageSize) || 1;
  const paginatedRefunds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRefunds.slice(start, start + pageSize);
  }, [filteredRefunds, currentPage, pageSize]);

  // Handlers
  const handleCreateRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice || !newRefundAmount) return;

    await createRefund({
      invoiceNumber: newInvoice,
      transactionAmount: Number(newTrxAmount) || Number(newRefundAmount),
      refundAmount: Number(newRefundAmount),
      reason: newReason,
      priority: newPriority,
      evidencePlaceholder: newEvidence || 'attachment_bukti_pengajuan.png'
    });

    setShowCreateModal(false);
    showToast(`Draft pengajuan refund untuk invoice ${newInvoice} berhasil dibuat!`);

    // Reset Form
    setNewInvoice('');
    setNewTrxAmount('');
    setNewRefundAmount('');
    setNewEvidence('');
  };

  const handleSubmitForReview = async () => {
    const reqId = selectedRefund.requestId || selectedRefund.id;
    if (reqId) {
      await updateRefundStatus(reqId, 'Submitted', 'Pengajuan dikirim ke Tim Finance untuk Review.');
      showToast(`Pengajuan ${reqId} telah dikirim ke Tim Finance untuk Review!`);
    }
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqId = selectedRefund.requestId || selectedRefund.id;
    if (reqId) {
      await escalateRefund(reqId, { department: escalateDepartment, reason: escalationReasonInput });
      setShowEscalateModal(false);
      showToast(`Kasus berhasil dieskalasi ke divisi ${escalateDepartment}!`);
    }
  };

  const handleCancelRequest = async () => {
    const reqId = selectedRefund.requestId || selectedRefund.id;
    if (reqId) {
      await updateRefundStatus(reqId, 'Cancelled', 'Pengajuan dibatalkan oleh petugas CS.');
      showToast(`Pengajuan refund ${reqId} dibatalkan.`);
    }
  };

  const handleExportSummary = () => {
    showToast('Laporan ringkasan pengajuan refund berhasil diunduh.');
  };

  const getStatusBadgeClass = (st?: string) => {
    switch (st) {
      case 'Draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Under Review':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Completed':
        return 'bg-emerald-600 text-white border-emerald-600 font-bold';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Cancelled':
        return 'bg-gray-200 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityBadgeClass = (pr?: string) => {
    switch (pr) {
      case 'Critical':
        return 'bg-red-100 text-red-800 font-bold border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 font-semibold border-orange-200';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 font-medium border-amber-200';
      case 'Low':
        return 'bg-blue-50 text-blue-700 font-medium border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard/customer-support/tickets')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Support Dashboard
        </button>
        <span className="text-xs font-mono text-gray-400">CS Refund & Escalation Management Center</span>
      </div>

      {/* PERMANENT MANDATORY WARNING PANEL */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 text-red-800 rounded-xl">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-red-900 flex items-center gap-2">
              <span>BATAS KEWENANGAN PETUGAS CS</span>
              <span className="px-2 py-0.5 rounded bg-red-200 text-red-900 text-[10px] font-extrabold uppercase">
                Pengajuan / Escalation Only
              </span>
            </div>
            <div className="text-xs text-red-700 mt-0.5">
              Customer Support <strong>TIDAK DIPERBOLEHKAN</strong> menyetujui atau mengeksekusi pengembalian dana (refund) secara langsung. Persetujuan dan eksekusi saldo wajib dilakukan oleh pejabat berwenang (Finance / Admin Manager).
            </div>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-[10px] font-mono text-red-800 font-semibold block">SOP GurkyNet v2.4</span>
          <span className="text-[10px] text-red-600">Strict Financial Governance</span>
        </div>
      </div>

      {/* Toast Bar */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-[10px]">
            Tutup
          </button>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Refund Requests */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Pending Refund Requests</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</div>
            <span className="text-[11px] text-amber-700 font-medium">Menunggu Review Finance</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Approved Refunds */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Approved Refunds</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</div>
            <span className="text-[11px] text-emerald-700 font-medium">Disetujui / Selesai</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Rejected Refunds */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Rejected Refunds</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{rejectedCount}</div>
            <span className="text-[11px] text-red-700 font-medium">Ditolak / Dibatalkan</span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Escalated Cases */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Escalated Cases</span>
            <div className="text-2xl font-bold text-purple-600 mt-1">{escalatedCount}</div>
            <span className="text-[11px] text-purple-700 font-medium">Dieskalasi ke Divisi Spesialis</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ACTION PANEL BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Refund Action Panel</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Refund Request</span>
          </button>

          <button
            onClick={handleSubmitForReview}
            disabled={selectedRefund.status !== 'Draft'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for Review</span>
          </button>

          <button
            onClick={() => setShowEscalateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Escalate Case</span>
          </button>

          <button
            onClick={handleCancelRequest}
            disabled={selectedRefund.status === 'Completed' || selectedRefund.status === 'Cancelled'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 rounded-xl text-xs font-medium transition"
          >
            <XCircle className="w-3.5 h-3.5 text-gray-500" />
            <span>Cancel Request</span>
          </button>

          <button
            onClick={handleExportSummary}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: REFUND REQUEST TABLE & FILTERS (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">Refund Request Queue</h2>
                <p className="text-xs text-gray-500 mt-0.5">Daftar antrean pengajuan refund oleh tim Customer Support</p>
              </div>
              <span className="text-xs text-gray-500">
                Total <strong className="text-gray-900">{filteredRefunds.length}</strong> pengajuan
              </span>
            </div>

            {/* FILTERS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* Search */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Search ID / Invoice</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              {/* Reviewer Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Reviewer</label>
                <select
                  value={reviewerFilter}
                  onChange={(e) => {
                    setReviewerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Reviewer</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              {/* Reason Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Reason</label>
                <select
                  value={reasonFilter}
                  onChange={(e) => {
                    setReasonFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Alasan</option>
                  <option value="Failed Transaction">Failed Transaction</option>
                  <option value="Duplicate Payment">Duplicate Payment</option>
                  <option value="Provider Failure">Provider Failure</option>
                  <option value="Wrong Product">Wrong Product</option>
                  <option value="Manual Adjustment">Manual Adjustment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* TABLE */}
            {refundsLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                <span className="text-xs text-gray-500">Memuat data pengajuan refund...</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-100">
                      <th className="py-2.5 px-3">Req ID</th>
                      <th className="py-2.5 px-3">Invoice</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Trx Amt</th>
                      <th className="py-2.5 px-3">Refund Amt</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Reviewer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {paginatedRefunds.length > 0 ? (
                      paginatedRefunds.map((item) => {
                        const isSelected = (item.requestId || item.id) === (selectedRefund.requestId || selectedRefund.id);
                        return (
                          <tr
                            key={item.requestId || item.id}
                            onClick={() => setSelectedRefundId(item.requestId || item.id || null)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                              {item.requestId || item.id}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              {item.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-900 whitespace-nowrap">
                              {item.customerName || 'Customer'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                              Rp {(item.transactionAmount || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700 whitespace-nowrap">
                              Rp {(item.refundAmount || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">{item.reason}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${getPriorityBadgeClass(item.priority)}`}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusBadgeClass(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 text-[11px] whitespace-nowrap">
                              {item.assignedReviewer || 'Unassigned'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400">
                          Tidak ada pengajuan refund yang memenuhi kriteria filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-gray-500">
                Halaman <strong className="text-gray-900">{currentPage}</strong> dari{' '}
                <strong className="text-gray-900">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REFUND DETAIL PANEL & ACTIVITY TIMELINE (1/3 width) */}
        <div className="space-y-4">
          {/* REFUND DETAIL PANEL */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-gray-900 uppercase">Refund Detail Panel</h2>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusBadgeClass(selectedRefund.status)}`}>
                {selectedRefund.status}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">Refund ID:</span>
                <span className="font-mono font-bold text-blue-600">{selectedRefund.requestId || selectedRefund.id}</span>
              </div>

              <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">Invoice Ref:</span>
                <span className="font-mono font-bold text-gray-900">{selectedRefund.invoiceNumber}</span>
              </div>

              <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">Transaction ID:</span>
                <span className="font-mono font-bold text-gray-900">{selectedRefund.transactionId || 'TRX-982104'}</span>
              </div>

              <div className="p-2 bg-gray-50 rounded-lg space-y-1">
                <span className="text-gray-400 text-[10px] block">Customer Details</span>
                <div className="font-bold text-gray-900">{selectedRefund.customerName || 'Siti Rahmawati'}</div>
                <div className="text-[11px] text-gray-500">{selectedRefund.customerEmail || 'siti.rahma@yahoo.com'} • {selectedRefund.customerPhone || '+62 812-3456-7890'}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 text-[10px] block">Original Amount</span>
                  <span className="font-bold text-gray-900">Rp {(selectedRefund.transactionAmount || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <span className="text-emerald-700 text-[10px] font-bold block">Requested Refund</span>
                  <span className="font-bold text-emerald-800 text-sm">Rp {(selectedRefund.refundAmount || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="p-2 bg-gray-50 rounded-lg space-y-1">
                <span className="text-gray-400 text-[10px] block">Refund Reason</span>
                <span className="font-semibold text-gray-900 block">{selectedRefund.reason}</span>
              </div>

              {selectedRefund.escalatedTo && (
                <div className="p-2 bg-purple-50 border border-purple-100 rounded-lg space-y-1">
                  <span className="text-purple-700 text-[10px] font-bold block">Escalated Department</span>
                  <span className="font-bold text-purple-900">{selectedRefund.escalatedTo}</span>
                  <p className="text-[10px] text-purple-700">{selectedRefund.escalationReason}</p>
                </div>
              )}

              {/* Supporting Evidence Placeholder */}
              <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
                <span className="text-blue-800 text-[10px] font-bold block">Supporting Evidence:</span>
                <div className="flex items-center gap-2 text-blue-700 text-[11px] font-mono">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate">{selectedRefund.evidencePlaceholder || 'screenshot.png'}</span>
                </div>
              </div>

              <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">Created By:</span>
                <span className="font-semibold text-gray-800">{selectedRefund.createdBy || 'CS Agent'}</span>
              </div>

              <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400">Assigned Reviewer:</span>
                <span className="font-semibold text-indigo-600">{selectedRefund.assignedReviewer || 'Finance Lead'}</span>
              </div>

              <div className="p-2 bg-gray-50 rounded-lg space-y-1">
                <span className="text-gray-400 text-[10px] block">Review Notes</span>
                <p className="text-xs text-gray-700 italic">{selectedRefund.reviewNotes || 'Belum ada catatan review'}</p>
              </div>
            </div>
          </div>

          {/* ACTIVITY TIMELINE CARD */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-900 uppercase">Activity Timeline</h3>
              <span className="text-[10px] font-mono text-gray-400">Approval Workflow</span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              <div className="relative">
                <div className="absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-blue-100 bg-blue-600" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-gray-900">Refund Requested</div>
                  <div className="text-[10px] text-gray-400">Dibuat oleh {selectedRefund.createdBy || 'CS Agent'} ({selectedRefund.createdAt})</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-purple-100 bg-purple-600" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-gray-900">Assigned Reviewer</div>
                  <div className="text-[10px] text-gray-400">Penugasan ke {selectedRefund.assignedReviewer || 'Finance Lead'}</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-amber-100 bg-amber-500" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-gray-900">Finance & Legal Review</div>
                  <div className="text-[10px] text-gray-400">Proses verifikasi mutasi dan audit transaksi</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-emerald-100 bg-emerald-500" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-gray-900">Approval & Disbursal</div>
                  <div className="text-[10px] text-gray-400">Otorisasi akhir oleh Pejabat Keuangan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CREATE REFUND REQUEST */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Create Refund Request (CS Draft)</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRefundSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={newInvoice}
                  onChange={(e) => setNewInvoice(e.target.value)}
                  placeholder="e.g. INV/20260731/PLN/0091"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Transaction Amt (Rp)</label>
                  <input
                    type="number"
                    value={newTrxAmount}
                    onChange={(e) => setNewTrxAmount(e.target.value)}
                    placeholder="501500"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">Refund Amt (Rp)</label>
                  <input
                    type="number"
                    value={newRefundAmount}
                    onChange={(e) => setNewRefundAmount(e.target.value)}
                    placeholder="501500"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold text-emerald-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Refund Reason</label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none"
                >
                  <option value="Failed Transaction">Failed Transaction</option>
                  <option value="Duplicate Payment">Duplicate Payment</option>
                  <option value="Provider Failure">Provider Failure</option>
                  <option value="Wrong Product">Wrong Product</option>
                  <option value="Manual Adjustment">Manual Adjustment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Evidence Placeholder File</label>
                <input
                  type="text"
                  value={newEvidence}
                  onChange={(e) => setNewEvidence(e.target.value)}
                  placeholder="e.g. screenshot_gagal.png"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold">
                  Simpan Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESCALATE CASE */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Escalate Case to Specialist Division</h3>
              <button onClick={() => setShowEscalateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEscalateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Escalate To Department</label>
                <select
                  value={escalateDepartment}
                  onChange={(e) => setEscalateDepartment(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-semibold focus:outline-none"
                >
                  <option value="Finance">Finance (Keuangan & Reversal Saldo)</option>
                  <option value="Technical Support">Technical Support (Integrasi API Biller)</option>
                  <option value="Operations">Operations (Verifikasi Manual)</option>
                  <option value="Administrator">Administrator (Kewenangan Khusus)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Escalation Reason Category</label>
                <select
                  value={escalationReasonInput}
                  onChange={(e) => setEscalationReasonInput(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none"
                >
                  <option value="Provider Investigation">Provider Investigation</option>
                  <option value="Payment Gateway Issue">Payment Gateway Issue</option>
                  <option value="Wallet Adjustment">Wallet Adjustment</option>
                  <option value="Manual Verification">Manual Verification</option>
                  <option value="Fraud Review">Fraud Review</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="p-3 bg-purple-50 text-purple-800 rounded-xl text-[11px] leading-relaxed">
                Eskalasi akan memindahkan status tiket ke <strong>Under Review</strong> dan memberikan notifikasi prioritas tinggi ke tim yang dituju.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowEscalateModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  Eskalasi Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
