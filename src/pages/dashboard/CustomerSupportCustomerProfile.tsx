import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Wallet,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  PlusCircle,
  Ticket,
  Receipt,
  Activity,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2
} from 'lucide-react';

import { useCustomerSupportStore } from '../../store/customerSupport.store';

interface TransactionItem {
  invoiceNumber: string;
  product: string;
  category: string;
  provider: string;
  amount: number;
  paymentMethod: string;
  status: 'Sukses' | 'Pending' | 'Gagal' | string;
  createdAt: string;
}

interface ActivityTimelineItem {
  id: string;
  time: string;
  type: string;
  title: string;
  description: string;
}

const normalizeStatus = (status: string): string => {
  const s = (status || '').toLowerCase();
  if (['success', 'sukses', 'settlement'].includes(s)) return 'Sukses';
  if (['pending', 'processing', 'draft'].includes(s)) return 'Pending';
  if (['failed', 'gagal', 'canceled', 'cancelled', 'cancel'].includes(s)) return 'Gagal';
  return status || '-';
};

export const CustomerSupportCustomerProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const currentUserId = userId || '';

  const {
    selectedCustomer,
    customerTransactions,
    customersLoading,
    fetchCustomerById,
    fetchCustomerTransactions
  } = useCustomerSupportStore();

  useEffect(() => {
    if (userId) {
      fetchCustomerById(userId);
      fetchCustomerTransactions(userId);
    }
  }, [userId, fetchCustomerById, fetchCustomerTransactions]);

  // Copy state feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Profile Header Data — real API values only
  const cust = selectedCustomer || {};
  const profile = {
    avatar: cust.avatar || cust.avatar_url || null,
    fullName: cust.name || cust.fullName || '-',
    userId: String(cust.id ?? currentUserId),
    email: cust.email || '-',
    phoneNumber: cust.phone || cust.phone_number || cust.phoneNumber || '-',
    registrationDate: cust.createdAt || cust.created_at || '-',
    accountStatus: cust.status || '-',
    verificationStatus: cust.email_verified_at ? 'Email Terverifikasi' : 'Belum Terverifikasi'
  };

  // Transaction History Dataset from the real customer transactions endpoint
  const transactions: TransactionItem[] = useMemo(() => {
    const source = Array.isArray(customerTransactions) && customerTransactions.length > 0
      ? customerTransactions
      : (Array.isArray(cust.transactions) ? cust.transactions : []);

    return source.map((t: any) => ({
      invoiceNumber: t.invoiceNumber || t.invoice_number || String(t.id ?? ''),
      product: t.product || t.service_name || t.title || '-',
      category: t.category || t.service_name || '-',
      provider: t.provider || t.items?.[0]?.custom_metadata?.provider || '-',
      amount: Number(t.amount ?? t.total_payment ?? 0),
      paymentMethod: t.paymentMethod || t.payment_method || '-',
      status: normalizeStatus(t.status),
      createdAt: t.createdAt || t.created_at || ''
    }));
  }, [customerTransactions, cust]);

  // Account Information Summary computed from real data
  const successCount = useMemo(() => transactions.filter((t) => t.status === 'Sukses').length, [transactions]);
  const failedCount = useMemo(() => transactions.filter((t) => t.status === 'Gagal').length, [transactions]);

  const accountInfo = {
    walletBalance: Number(cust.wallet?.balance ?? cust.walletBalance ?? 0),
    totalTransactions: cust.transactions_count ?? cust.totalTransactions ?? transactions.length,
    successfulTransactions: successCount,
    failedTransactions: failedCount,
    lastPurchase: transactions[0]?.createdAt || '-'
  };

  // Support History Summary from real ticket data
  const customerTickets: any[] = useMemo(
    () => (Array.isArray(cust.support_tickets) ? cust.support_tickets : (Array.isArray(cust.supportTickets) ? cust.supportTickets : [])),
    [cust]
  );

  const supportHistory = {
    previousTickets: cust.support_tickets_count ?? cust.previousTickets ?? customerTickets.length,
    currentOpenTickets: customerTickets.filter((t) => ['Terbuka', 'Open', 'Pending'].includes(t.status)).length,
    resolvedTickets: customerTickets.filter((t) => ['Selesai', 'Resolved', 'Closed', 'Tertutup'].includes(t.status)).length
  };

  // Transaction Filters
  const [searchInvoice, setSearchInvoice] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [providerFilter, setProviderFilter] = useState<string>('All');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All');

  // Pagination for Transaction History
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  // Recent Activities Timeline built from real support tickets
  const activities: ActivityTimelineItem[] = useMemo(() => {
    if (cust.activities && Array.isArray(cust.activities)) {
      return cust.activities;
    }
    return customerTickets.map((t: any) => ({
      id: `ticket-${t.id}`,
      time: t.created_at || t.createdAt || '',
      type: 'Support Ticket',
      title: `${t.ticket_number || `Tiket #${t.id}`} — ${t.category || 'Dukungan'}`,
      description: t.subject || t.description || `Status: ${t.status}`
    }));
  }, [cust, customerTickets]);

  // Dynamic filter options derived from real data
  const categoryOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category).filter((c) => c && c !== '-'))),
    [transactions]
  );
  const providerOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.provider).filter((p) => p && p !== '-'))),
    [transactions]
  );

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((trx) => {
      const matchSearch =
        String(trx.invoiceNumber ?? '').toLowerCase().includes(searchInvoice.toLowerCase()) ||
        String(trx.product ?? '').toLowerCase().includes(searchInvoice.toLowerCase());

      const matchStatus = statusFilter === 'All' || trx.status === statusFilter;
      const matchCategory = categoryFilter === 'All' || trx.category === categoryFilter;
      const matchProvider = providerFilter === 'All' || trx.provider === providerFilter;

      let matchDate = true;
      if (dateRangeFilter !== 'All' && trx.createdAt) {
        const trxDate = new Date(trx.createdAt);
        if (!isNaN(trxDate.getTime())) {
          const diffDays = (now.getTime() - trxDate.getTime()) / (1000 * 60 * 60 * 24);
          if (dateRangeFilter === 'Hari Ini') {
            matchDate = trxDate.toDateString() === now.toDateString();
          } else if (dateRangeFilter === '7 Hari Terakhir') {
            matchDate = diffDays <= 7;
          } else if (dateRangeFilter === '30 Hari Terakhir') {
            matchDate = diffDays <= 30;
          }
        }
      }

      return matchSearch && matchStatus && matchCategory && matchProvider && matchDate;
    });
  }, [transactions, searchInvoice, statusFilter, categoryFilter, providerFilter, dateRangeFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard/customer-support/tickets')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Ticket Management
        </button>
        <span className="text-xs font-mono text-gray-400">CS Customer Profile Module</span>
      </div>

      {/* Copied Feedback Toast */}
      {copiedField && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{copiedField} berhasil disalin ke clipboard!</span>
          </div>
          <button onClick={() => setCopiedField(null)} className="text-emerald-700 hover:text-emerald-900 text-[10px]">
            Tutup
          </button>
        </div>
      )}

      {customersLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl shadow-xs border border-gray-100">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-500">Memuat profil pelanggan...</p>
        </div>
      ) : (
        <>
          {/* 1. PROFILE HEADER */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-100 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-blue-100 shadow-xs flex items-center justify-center text-2xl font-bold text-blue-600">
                  {(profile.fullName || '-').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{profile.fullName}</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {profile.verificationStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-600 pt-1">
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">User ID</span>
                      <span className="font-mono font-bold text-gray-900">{profile.userId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Email Address</span>
                      <span className="font-semibold text-gray-900">{profile.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Phone Number</span>
                      <span className="font-semibold text-gray-900">{profile.phoneNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-[10px] text-gray-400 block">Member Registration</span>
                      <span className="font-semibold text-gray-900">{profile.registrationDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. QUICK ACTION PANEL */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Quick Action Panel</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate('/dashboard/customer-support/tickets')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Open Ticket</span>
              </button>

              <a
                href="#transaction-history"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Receipt className="w-4 h-4 text-gray-500" />
                <span>View Transactions</span>
              </a>

              <button
                onClick={() => copyToClipboard(profile.userId, 'User ID')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy User ID</span>
              </button>

              <button
                onClick={() => copyToClipboard(profile.email, 'Email Address')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy Email</span>
              </button>

              <button
                onClick={() => copyToClipboard(profile.phoneNumber, 'Phone Number')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy Phone Number</span>
              </button>
            </div>
          </div>

          {/* 3. ACCOUNT INFORMATION GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Wallet Balance */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500">Current Wallet Balance</span>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  Rp {accountInfo.walletBalance.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">GurkyWallet Active</span>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            {/* Total & Successful Trx */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500">Successful / Loaded Trx</span>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {accountInfo.successfulTransactions} <span className="text-xs font-normal text-gray-400">/ {transactions.length}</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Total transaksi: {accountInfo.totalTransactions}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Failed Trx */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500">Failed Transactions</span>
                <div className="text-xl font-bold text-red-600 mt-1">{accountInfo.failedTransactions}</div>
                <span className="text-[11px] text-gray-400 font-medium">Dari riwayat termuat</span>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                <XCircle className="w-6 h-6" />
              </div>
            </div>

            {/* Last Purchase */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500">Pembelian Terakhir</span>
                <div className="text-sm font-bold text-gray-900 mt-1 line-clamp-1">
                  {accountInfo.lastPurchase}
                </div>
                <span className="text-[11px] text-blue-600 font-medium">Transaksi terbaru</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* 4. SUPPORT HISTORY & RECENT ACTIVITIES (TWO COLUMNS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Support History Summary Card (1/3) */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold text-gray-900 uppercase">Support History</h2>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">Overview</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl flex items-center justify-between">
                  <span className="text-gray-600">Previous Tickets Total:</span>
                  <span className="font-bold text-blue-700 text-sm">{supportHistory.previousTickets}</span>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl flex items-center justify-between">
                  <span className="text-gray-600">Current Open Tickets:</span>
                  <span className="font-bold text-amber-700 text-sm">{supportHistory.currentOpenTickets}</span>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl flex items-center justify-between">
                  <span className="text-gray-600">Resolved Tickets:</span>
                  <span className="font-bold text-emerald-700 text-sm">{supportHistory.resolvedTickets}</span>
                </div>
              </div>
            </div>

            {/* Recent Activities Timeline (2/3) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs font-bold text-gray-900 uppercase">Recent Activities Timeline</h2>
                </div>
                <span className="text-xs text-gray-400 font-mono">Jejak Aktivitas Pelanggan</span>
              </div>

              {activities.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {activities.map((act) => (
                    <div key={act.id} className="relative group">
                      <div className="absolute -left-[1.85rem] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ring-gray-100 bg-indigo-500" />
                      <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs">{act.title}</span>
                          <span className="text-[10px] font-mono text-gray-400">{act.time}</span>
                        </div>
                        <p className="text-xs text-gray-600">{act.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  Belum ada aktivitas tiket tercatat untuk pelanggan ini.
                </div>
              )}
            </div>
          </div>

          {/* 5. TRANSACTION HISTORY TABLE & FILTERS */}
          <div id="transaction-history" className="bg-white rounded-2xl shadow-xs border border-gray-100 space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Transaction History</h2>
                <p className="text-xs text-gray-500 mt-0.5">Daftar riwayat transaksi terintegrasi pelanggan</p>
              </div>
              <div className="text-xs text-gray-500">
                Total <strong className="text-gray-900">{filteredTransactions.length}</strong> transaksi ditemukan
              </div>
            </div>

            {/* Transaction Filters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Search Invoice */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Search Invoice / Product</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchInvoice}
                    onChange={(e) => {
                      setSearchInvoice(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="No Invoice..."
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  <option value="Sukses">Sukses</option>
                  <option value="Pending">Pending</option>
                  <option value="Gagal">Gagal</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Kategori</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Provider Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Provider</label>
                <select
                  value={providerFilter}
                  onChange={(e) => {
                    setProviderFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Provider</option>
                  {providerOptions.map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Date Range</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => {
                    setDateRangeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="All">Semua Tanggal</option>
                  <option value="Hari Ini">Hari Ini</option>
                  <option value="7 Hari Terakhir">7 Hari Terakhir</option>
                  <option value="30 Hari Terakhir">30 Hari Terakhir</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-100">
                    <th className="py-2.5 px-4">Invoice Number</th>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Provider</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Payment Method</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((trx) => (
                      <tr key={trx.invoiceNumber} className="hover:bg-gray-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                          {trx.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">{trx.product}</td>
                        <td className="py-3 px-4">{trx.category}</td>
                        <td className="py-3 px-4 text-gray-600">{trx.provider}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          Rp {trx.amount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{trx.paymentMethod}</td>
                        <td className="py-3 px-4">
                          {trx.status === 'Sukses' && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Sukses
                            </span>
                          )}
                          {trx.status === 'Pending' && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Pending
                            </span>
                          )}
                          {trx.status === 'Gagal' && (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                              Gagal
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-500">{trx.createdAt}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        Tidak ada riwayat transaksi yang cocok dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

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
        </>
      )}
    </div>
  );
};
