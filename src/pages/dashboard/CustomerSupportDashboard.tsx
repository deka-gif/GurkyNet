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
  RefreshCw
} from 'lucide-react';

import { useCustomerSupportStore } from '../../store/customerSupport.store';
import { DashboardHeader, StatCard } from '../../components/common';

export const CustomerSupportDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [notification, setNotification] = useState<string | null>(null);

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
  }, [fetchDashboard, fetchTickets]);

  // Statistics from store (real API values only; no fabricated deltas)
  const stats = [
    {
      title: 'Open Tickets',
      value: (dashboardData?.openTickets ?? dashboardData?.open_tickets ?? 0).toString(),
      icon: Ticket,
    },
    {
      title: 'Pending Tickets',
      value: (dashboardData?.pendingTickets ?? dashboardData?.pending_tickets ?? 0).toString(),
      icon: AlertCircle,
    },
    {
      title: 'Resolved Today',
      value: (dashboardData?.resolvedToday ?? dashboardData?.resolved_today ?? 0).toString(),
      icon: CheckCircle2,
    },
    {
      title: 'Average Response Time',
      value: dashboardData?.avgResponseTime || dashboardData?.avg_response_time || '-',
      icon: Clock,
    },
    {
      title: 'Total Tickets',
      value: (Array.isArray(tickets) ? tickets.length : 0).toString(),
      icon: ArrowUpRight,
    }
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
      idStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emailStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      catStr.toLowerCase().includes(searchQuery.toLowerCase());

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
        return 'bg-blue-100 text-blue-800';
      case 'Pending':
      case 'Under Review':
        return 'bg-amber-100 text-amber-800';
      case 'Selesai':
      case 'Resolved':
      case 'Closed':
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

      {/* Quick Actions */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
