import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Headset, 
  Search, 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  UserSearch, 
  Receipt, 
  BookOpen,
  Filter,
  ArrowUpRight,
  UserCheck,
  RefreshCw,
  MessageSquare,
  Share2,
} from 'lucide-react';

import { useCustomerSupportStore } from '../../store/customerSupport.store';
import { DashboardHeader, StatCard } from '../../components/common';
import { chatService, supportHubService } from '../../services/chat/chat.service';
import { workflowService } from '../../services/workflow/workflow.service';
import { FinanceCrossWidgets } from '../../components/finance/FinanceCrossWidgets';

export const CustomerSupportDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [notification, setNotification] = useState<string | null>(null);
  const [hubStats, setHubStats] = useState<Record<string, number>>({});
  const [wfStats, setWfStats] = useState<Record<string, number | null>>({});
  const [divisionNotifs, setDivisionNotifs] = useState<any[]>([]);

  const {
    dashboardData,
    dashboardLoading,
    dashboardError,
    fetchDashboard,
    tickets,
    ticketsLoading,
    fetchTickets
  } = useCustomerSupportStore();

  useEffect(() => {
    fetchDashboard();
    fetchTickets();
    chatService.hubStats().then(setHubStats).catch(() => setHubStats({}));
    workflowService.stats('customer-support').then((s) => setWfStats(s as Record<string, number | null>)).catch(() => setWfStats({}));
    // FR-CS-08
    supportHubService.divisionNotifications(1).then((page: any) => {
      const rows = page?.data ?? page?.items ?? (Array.isArray(page) ? page : []);
      setDivisionNotifs(Array.isArray(rows) ? rows.slice(0, 8) : []);
    }).catch(() => setDivisionNotifs([]));
  }, [fetchDashboard, fetchTickets]);

  // Statistics from hub + dashboard (real API values only)
  const stats = [
    {
      title: 'Live Chats',
      value: (hubStats.liveChats ?? 0).toString(),
      icon: MessageSquare,
    },
    {
      title: 'Waiting Ops',
      value: String(wfStats.waitingOperations ?? 0),
      icon: Share2,
    },
    {
      title: 'Waiting Finance',
      value: String(wfStats.waitingFinance ?? 0),
      icon: Receipt,
    },
    {
      title: 'Waiting Marketing',
      value: String(wfStats.waitingMarketing ?? 0),
      icon: MessageSquare,
    },
    {
      title: 'Critical',
      value: String(wfStats.criticalCases ?? 0),
      icon: AlertCircle,
    },
  ];

  const workflowExtras = [
    { title: 'Escalated Today', value: String(wfStats.escalatedToday ?? 0) },
    { title: 'Resolved Today', value: String(wfStats.resolvedToday ?? 0) },
    {
      title: 'Avg Resolution',
      value: wfStats.averageResolutionMinutes != null ? `${wfStats.averageResolutionMinutes}m` : '—',
    },
    { title: 'Open Tickets', value: (hubStats.openTickets ?? dashboardData?.openTickets ?? dashboardData?.open_tickets ?? 0).toString() },
  ];

  // Handle Quick Action
  const handleQuickAction = (actionName: string) => {
    setNotification(`Aksi Quick Action terpilih: ${actionName}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const ticketsList = Array.isArray(tickets) ? tickets : [];

  const filteredTickets = ticketsList.filter((ticket: any) => {
    const idStr = ticket.id || ticket.ticketId || '';
    const nameStr = ticket.customerName || ticket.customer_name || '';
    const emailStr = ticket.customerEmail || ticket.customer_email || '';
    const catStr = ticket.category || '';
    const statusStr = ticket.status || '';

    const matchesSearch = 
      String(idStr ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(nameStr ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(emailStr ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(catStr ?? '').toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedStatus === 'Semua') return matchesSearch;
    return matchesSearch && statusStr === selectedStatus;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Tinggi':
      case 'High':
      case 'Critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Sedang':
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Rendah':
      case 'Low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Terbuka':
      case 'Open':
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'Pending':
      case 'Under Review':
      case 'assigned_cs':
      case 'Processing':
        return 'bg-amber-100 text-amber-800';
      case 'escalated_ops':
      case 'escalated_finance':
      case 'Escalated':
        return 'bg-purple-100 text-purple-800';
      case 'Selesai':
      case 'Resolved':
      case 'Closed':
      case 'resolved':
      case 'closed':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <DashboardHeader
        title="Customer Support Dashboard"
        subtitle="Portal khusus tim penanganan tiket & layanan komunikasi pelanggan GurkyNet."
        badge="Customer Support Center"
        icon={Headset}
        actions={
          <>
            <button
              onClick={() => { fetchDashboard(); fetchTickets(); }}
              disabled={dashboardLoading || ticketsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dashboardLoading || ticketsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/dashboard/customer-support/inbox"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Inbox
            </Link>
            <Link
              to="/dashboard/customer-support/tickets"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            >
              <Ticket className="w-4 h-4" />
              Ticket Management
            </Link>
            <Link
              to="/dashboard/customer-support/refund-center"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Refund Center
            </Link>
            <Link
              to="/dashboard/customer-support/knowledge-base"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Knowledge Base
            </Link>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <UserCheck className="w-4 h-4" />
              CS Role
            </span>
          </>
        }
      />

      {dashboardError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{dashboardError}</span>
        </div>
      )}

      {notification && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-medium flex items-center justify-between animate-fade-in">
          <span>{notification}</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* FR-CS-08 — notifikasi balik eskalasi */}
      {divisionNotifs.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">Notifikasi Eskalasi</h3>
          <ul className="space-y-2">
            {divisionNotifs.map((n: any) => (
              <li key={n.id ?? n.title} className="text-sm text-gray-800 border border-gray-100 rounded-xl px-3 py-2">
                <span className="font-semibold">{n.title || n.type}</span>
                {n.body ? <span className="text-gray-500"> — {n.body}</span> : null}
              </li>
            ))}
          </ul>
          <Link to="/dashboard/customer-support/workflows" className="text-xs font-semibold text-primary-600 hover:underline">
            Buka antrean workflow →
          </Link>
        </div>
      )}

      {/* Global Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by: Invoice, Phone Number, Email, User ID"
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, idx) => (
          <StatCard
            key={idx}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {workflowExtras.map((item) => (
          <div key={item.title} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs">
            <p className="text-[11px] font-bold uppercase text-gray-400">{item.title}</p>
            <p className="text-xl font-black text-gray-900 mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <FinanceCrossWidgets audience="customer_support" />

      {/* Quick Actions */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/dashboard/customer-support/workflows"
            className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>Workflows</span>
          </Link>
          <Link
            to="/dashboard/customer-support/tickets"
            className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ticket</span>
          </Link>
          <Link
            to="/dashboard/customer-support/customer-profile"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition-colors"
          >
            <UserSearch className="w-4 h-4 text-gray-500" />
            <span>Search Customer</span>
          </Link>
          <Link
            to="/dashboard/customer-support/investigation"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition-colors"
          >
            <Receipt className="w-4 h-4 text-gray-500" />
            <span>Search Transaction</span>
          </Link>
          <Link
            to="/dashboard/customer-support/knowledge-base"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4 text-gray-500" />
            <span>Knowledge Base</span>
          </Link>
        </div>
      </div>

      {/* Recent Tickets Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Tickets</h2>
            <p className="text-xs text-gray-500 mt-0.5">Daftar tiket dukungan pelanggan terbaru</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Semua">Semua Status</option>
              <option value="Terbuka">Terbuka</option>
              <option value="Pending">Pending</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Ticket ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Priority</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {ticketsLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                    Memuat data tiket...
                  </td>
                </tr>
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((ticket: any) => {
                  const id = ticket.id || ticket.ticketId;
                  return (
                    <tr key={id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-blue-600">
                        <Link to={`/dashboard/customer-support/tickets/${id}`} className="hover:underline">
                          {id}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-gray-900">{ticket.customerName || ticket.customer_name}</div>
                        <div className="text-xs text-gray-400">{ticket.customerEmail || ticket.customer_email}</div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-600 font-medium">
                        {ticket.category}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadge(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-gray-500 font-mono">
                        {ticket.createdAt || ticket.created_at}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    Tidak ada tiket yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
