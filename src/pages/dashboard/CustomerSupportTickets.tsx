import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserPlus,
  RefreshCw,
  X,
  SlidersHorizontal,
  Plus
} from 'lucide-react';

import { useCustomerSupportStore } from '../../store/customerSupport.store';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';
import { customerSupportService } from '../../services/customerSupport.service';

export interface TicketData {
  id: string;
  customerName: string;
  customerEmail: string;
  category: string;
  subject: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  status: 'Open' | 'Pending' | 'Resolved' | 'Closed' | string;
  assignedTo: string;
  createdAt: string;
  lastUpdated: string;
}

export const CustomerSupportTickets: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Customer Support.
  const isOwnerReadOnly = useOwnerReadOnly();
  const {
    tickets,
    ticketsPagination,
    ticketsLoading,
    ticketsError,
    fetchTickets,
    updateTicket,
    createTicket
  } = useCustomerSupportStore();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [staffFilter, setStaffFilter] = useState<string>('All');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All');

  // Sort state
  const [sortBy, setSortBy] = useState<'Newest' | 'Oldest' | 'Priority' | 'Status'>('Newest');

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal states for action buttons (View, Assign, Change Status, Create Ticket)
  const [viewTicket, setViewTicket] = useState<any | null>(null);
  const [assignTicket, setAssignTicket] = useState<any | null>(null);
  const [statusTicketModal, setStatusTicketModal] = useState<any | null>(null);
  const [createTicketModalOpen, setCreateTicketModalOpen] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<string>('Open');
  const [staffOptions, setStaffOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');

  // New Ticket Form State
  const [newTicketForm, setNewTicketForm] = useState({
    customerName: '',
    customerEmail: '',
    category: 'Pulsa',
    subject: '',
    priority: 'Medium',
    assignedTo: 'CS Budi'
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    customerSupportService.getStaffOptions().then(setStaffOptions).catch(() => setStaffOptions([]));
  }, []);

  useEffect(() => {
    fetchTickets({
      page: currentPage,
      per_page: pageSize,
      search: searchQuery,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      priority: priorityFilter !== 'All' ? priorityFilter : undefined,
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      staff: staffFilter !== 'All' ? staffFilter : undefined,
    });
  }, [fetchTickets, currentPage, pageSize, searchQuery, statusFilter, priorityFilter, categoryFilter, staffFilter]);

  const rawTicketsList = Array.isArray(tickets) ? tickets : [];

  // Normalize tickets list
  const normalizedTickets: TicketData[] = useMemo(() => {
    return rawTicketsList.map((t: any) => ({
      id: t.id || t.ticketId || `TCK-${t.id}`,
      customerName: t.customerName || t.customer_name || 'Pelanggan',
      customerEmail: t.customerEmail || t.customer_email || '-',
      category: t.category || 'Umum',
      subject: t.subject || t.title || 'Tanpa Subjek',
      priority: t.priority || 'Medium',
      status: t.status || 'Open',
      assignedTo: t.assignedTo || t.assigned_to || t.staff || 'Unassigned',
      createdAt: t.createdAt || t.created_at || new Date().toISOString().slice(0, 10),
      lastUpdated: t.lastUpdated || t.updated_at || t.createdAt || new Date().toISOString().slice(0, 10)
    }));
  }, [rawTicketsList]);

  // Top Summary calculations
  const summary = useMemo(() => {
    const openCount = normalizedTickets.filter((t) => t.status === 'Open' || t.status === 'Terbuka').length;
    const pendingCount = normalizedTickets.filter((t) => t.status === 'Pending').length;
    const resolvedTodayCount = normalizedTickets.filter(
      (t) => t.status === 'Resolved' || t.status === 'Selesai'
    ).length;
    const criticalCount = normalizedTickets.filter((t) => t.priority === 'Critical' || t.priority === 'Tinggi').length;

    return {
      open: openCount,
      pending: pendingCount,
      resolvedToday: resolvedTodayCount,
      critical: criticalCount
    };
  }, [normalizedTickets]);

  // Priority ranking for sorting
  const priorityRank: Record<string, number> = {
    Critical: 4,
    Tinggi: 4,
    High: 3,
    Medium: 2,
    Sedang: 2,
    Low: 1,
    Rendah: 1
  };

  // Status ranking for sorting
  const statusRank: Record<string, number> = {
    Open: 4,
    Terbuka: 4,
    Pending: 3,
    Resolved: 2,
    Selesai: 2,
    Closed: 1
  };

  // Filtering & Sorting client-side fallback
  const filteredAndSortedTickets = useMemo(() => {
    return normalizedTickets
      .filter((t) => {
        const matchSearch =
          String(t.id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.customerEmail ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.subject ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchStatus = statusFilter === 'All' || t.status === statusFilter;
        const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
        const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
        const matchStaff = staffFilter === 'All' || t.assignedTo === staffFilter;

        let matchDate = true;
        if (dateRangeFilter === 'Hari Ini') {
          const today = new Date().toISOString().slice(0, 10);
          matchDate = t.createdAt.startsWith(today);
        }

        return matchSearch && matchStatus && matchPriority && matchCategory && matchStaff && matchDate;
      })
      .sort((a, b) => {
        if (sortBy === 'Newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'Oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'Priority') {
          return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        }
        if (sortBy === 'Status') {
          return (statusRank[b.status] || 0) - (statusRank[a.status] || 0);
        }
        return 0;
      });
  }, [
    normalizedTickets,
    searchQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
    staffFilter,
    dateRangeFilter,
    sortBy
  ]);

  // Pagination logic
  const totalItems = ticketsPagination?.total ?? filteredAndSortedTickets.length;
  const totalPages = ticketsPagination?.lastPage ?? (Math.ceil(totalItems / pageSize) || 1);

  const paginatedTickets = useMemo(() => {
    if (ticketsPagination) return filteredAndSortedTickets;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedTickets.slice(start, start + pageSize);
  }, [filteredAndSortedTickets, currentPage, pageSize, ticketsPagination]);

  // Action Handlers
  const handleAssignSubmit = async () => {
    if (!assignTicket) return;
    const staffName = staffOptions.find((s) => s.id === selectedStaffId)?.name ?? 'Unassigned';
    const res = await updateTicket(assignTicket.id, {
      status: assignTicket.status,
      assigned_to: selectedStaffId === '' ? null : selectedStaffId
    });
    if (res.success) {
      showToast(`Tiket ${assignTicket.id} berhasil ditugaskan ke ${staffName}`);
      fetchTickets();
    } else {
      showToast(res.message || 'Gagal memperbarui penugasan.');
    }
    setAssignTicket(null);
  };

  const handleStatusSubmit = async () => {
    if (!statusTicketModal) return;
    const res = await updateTicket(statusTicketModal.id, {
      status: selectedStatus
    });
    if (res.success) {
      showToast(`Status Tiket ${statusTicketModal.id} diperbarui menjadi ${selectedStatus}`);
      fetchTickets();
    } else {
      showToast(res.message || 'Gagal memperbarui status tiket.');
    }
    setStatusTicketModal(null);
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createTicket({
      ...newTicketForm,
      status: 'Open'
    });
    if (res.success) {
      showToast('Tiket baru berhasil ditambahkan.');
      setCreateTicketModalOpen(false);
      setNewTicketForm({
        customerName: '',
        customerEmail: '',
        category: 'Pulsa',
        subject: '',
        priority: 'Medium',
        assignedTo: 'CS Budi'
      });
      fetchTickets();
    } else {
      showToast(res.message || 'Gagal membuat tiket baru.');
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Critical':
      case 'Tinggi':
        return 'bg-red-100 text-red-800 border-red-300 font-bold';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200 font-semibold';
      case 'Medium':
      case 'Sedang':
        return 'bg-amber-100 text-amber-800 border-amber-200 font-medium';
      case 'Low':
      case 'Rendah':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Open':
      case 'Terbuka':
        return 'bg-blue-100 text-blue-800 font-semibold';
      case 'Pending':
        return 'bg-amber-100 text-amber-800 font-semibold';
      case 'Resolved':
      case 'Selesai':
        return 'bg-emerald-100 text-emerald-800 font-semibold';
      case 'Closed':
        return 'bg-gray-100 text-gray-600 font-medium';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Ticket className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-full">
              Customer Support Module
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Ticket Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pusat pengelolaan dan penanganan tiket keluhan pelanggan GurkyNet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOwnerReadOnly && (
            <button
              onClick={() => setCreateTicketModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Buat Tiket Baru
            </button>
          )}
          <button
            onClick={() => fetchTickets({ page: currentPage, per_page: pageSize })}
            disabled={ticketsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ticketsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <UserCheck className="w-4 h-4" />
            Active CS Mode
          </span>
        </div>
      </div>

      {ticketsError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
          {ticketsError}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Open Tickets</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.open}</div>
            <span className="text-[11px] text-blue-600 font-medium">Membutuhkan Respon</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Ticket className="w-6 h-6" />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Pending Tickets</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.pending}</div>
            <span className="text-[11px] text-amber-600 font-medium">Menunggu Pihak Ke-3 / User</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Resolved Today */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Resolved Today</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.resolvedToday}</div>
            <span className="text-[11px] text-emerald-600 font-medium">Selesai Hari Ini</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Critical Tickets */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Critical Tickets</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{summary.critical}</div>
            <span className="text-[11px] text-red-500 font-semibold">Prioritas Tertinggi</span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari ID tiket, nama pelanggan, email, atau subjek..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Newest">Terbaru</option>
              <option value="Oldest">Terlama</option>
              <option value="Priority">Prioritas (Critical First)</option>
              <option value="Status">Status (Open First)</option>
            </select>
          </div>
        </div>

        {/* Detailed Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Kategori</option>
              <option value="Pulsa">Pulsa</option>
              <option value="Token PLN">Token PLN</option>
              <option value="Paket Data">Paket Data</option>
              <option value="Transfer">Transfer</option>
              <option value="Tagihan">Tagihan</option>
              <option value="Akun">Akun</option>
              <option value="Voucher">Voucher</option>
            </select>
          </div>

          {/* Assigned Staff Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Assigned Staff</label>
            <select
              value={staffFilter}
              onChange={(e) => {
                setStaffFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Staff</option>
              <option value="CS Budi">CS Budi</option>
              <option value="CS Ani">CS Ani</option>
              <option value="CS Doni">CS Doni</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Tanggal</option>
              <option value="Hari Ini">Hari Ini</option>
              <option value="7 Hari Terakhir">7 Hari Terakhir</option>
              <option value="30 Hari Terakhir">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">
            Menampilkan <span className="text-gray-900 font-bold">{totalItems}</span> tiket
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setPriorityFilter('All');
              setCategoryFilter('All');
              setStaffFilter('All');
              setDateRangeFilter('All');
              setSortBy('Newest');
              setCurrentPage(1);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 min-w-[200px]">Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {ticketsLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                    Memuat data tiket...
                  </td>
                </tr>
              ) : paginatedTickets.length > 0 ? (
                paginatedTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Ticket ID */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      <Link to={`/dashboard/customer-support/tickets/${t.id}`} className="hover:underline">
                        {t.id}
                      </Link>
                    </td>

                    {/* Customer Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{t.customerName}</div>
                      <div className="text-[11px] text-gray-400">{t.customerEmail}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                        {t.category}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-3 px-4 font-medium text-gray-900 line-clamp-1">
                      {t.subject}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${getPriorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] ${getStatusBadgeClass(t.status)}`}>
                        {t.status}
                      </span>
                    </td>

                    {/* Assigned To */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {t.assignedTo === 'Unassigned' ? (
                        <span className="text-gray-400 italic">Unassigned</span>
                      ) : (
                        <span className="font-medium text-gray-800">{t.assignedTo}</span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-gray-500">
                      {t.createdAt}
                    </td>

                    {/* Last Updated */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-gray-500">
                      {t.lastUpdated}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/dashboard/customer-support/tickets/${t.id}`}
                          title="View Full Ticket Detail Page"
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {!isOwnerReadOnly && (
                          <>
                            <button
                              onClick={() => {
                                setAssignTicket(t);
                                const assignedName = t.assignedTo;
                                const match = staffOptions.find((s) => s.name === assignedName);
                                setSelectedStaffId(
                                  assignedName === 'Unassigned' || !assignedName
                                    ? ''
                                    : match
                                      ? match.id
                                      : ''
                                );
                              }}
                              title="Assign Staff"
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setStatusTicketModal(t);
                                setSelectedStatus(t.status);
                              }}
                              title="Change Status"
                              className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Tidak ada tiket yang memenuhi kriteria filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 mr-2">
              Halaman <span className="font-bold text-gray-900">{currentPage}</span> dari{' '}
              <span className="font-bold text-gray-900">{totalPages}</span>
            </span>

            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE TIKET MODAL */}
      {createTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Buat Tiket Dukungan Baru</h3>
              </div>
              <button onClick={() => setCreateTicketModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={newTicketForm.customerName}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, customerName: e.target.value })}
                  placeholder="e.g. Ahmad Subagja"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Email Pelanggan</label>
                <input
                  type="email"
                  required
                  value={newTicketForm.customerEmail}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, customerEmail: e.target.value })}
                  placeholder="e.g. ahmad.s@gmail.com"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Kategori</label>
                  <select
                    value={newTicketForm.category}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Pulsa">Pulsa</option>
                    <option value="Token PLN">Token PLN</option>
                    <option value="Paket Data">Paket Data</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Tagihan">Tagihan</option>
                    <option value="Akun">Akun</option>
                    <option value="Voucher">Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Priority</label>
                  <select
                    value={newTicketForm.priority}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Subjek Keluhan</label>
                <input
                  type="text"
                  required
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                  placeholder="e.g. Pulsa Telkomsel Rp 100rb belum masuk"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateTicketModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition"
                >
                  Simpan Tiket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assignTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-sm">Tugaskan Staff (Assign)</h3>
              </div>
              <button onClick={() => setAssignTicket(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600">
              Pilih petugas CS yang akan menangani tiket <span className="font-bold text-blue-600 font-mono">{assignTicket.id}</span>:
            </div>

            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Unassigned (Lepas Penugasan)</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setAssignTicket(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleAssignSubmit}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs transition"
              >
                Simpan Penugasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE STATUS MODAL */}
      {statusTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-sm">Ubah Status Tiket</h3>
              </div>
              <button onClick={() => setStatusTicketModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600">
              Pilih status baru untuk tiket <span className="font-bold text-blue-600 font-mono">{statusTicketModal.id}</span>:
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setStatusTicketModal(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleStatusSubmit}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs transition"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
