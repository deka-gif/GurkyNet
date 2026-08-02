import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  Calendar,
  UserCheck,
  RefreshCw,
  MessageSquarePlus,
  CheckCircle2,
  XCircle,
  Receipt,
  Wallet,
  ShoppingBag,
  FileText,
  AlertCircle,
  FileImage,
  Send,
  X
} from 'lucide-react';

import { useCustomerSupportStore } from '../../store/customerSupport.store';

interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description: string;
  operator: string;
  type: 'system' | 'customer' | 'agent' | 'note';
}

export const CustomerSupportTicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const ticketId = id || 'TCK-1002';

  const {
    selectedTicket,
    ticketsLoading,
    fetchTicketById,
    updateTicket,
    replyTicket
  } = useCustomerSupportStore();

  useEffect(() => {
    if (id) {
      fetchTicketById(id);
    }
  }, [id, fetchTicketById]);

  // Fallback / Normalized values from store ticket detail
  const currentTicket = selectedTicket || {};
  const status = currentTicket.status || 'Pending';
  const priority = currentTicket.priority || 'Critical';
  const assignedStaff = currentTicket.assignedTo || currentTicket.assigned_to || 'CS Ani';
  const category = currentTicket.category || 'Token PLN';
  const createdAt = currentTicket.createdAt || currentTicket.created_at || '2026-07-31 08:12';

  // Customer details
  const customer = {
    avatar: currentTicket.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    fullName: currentTicket.customerName || currentTicket.customer_name || 'Siti Rahmawati',
    email: currentTicket.customerEmail || currentTicket.customer_email || 'siti.rahma@yahoo.com',
    phoneNumber: currentTicket.customerPhone || currentTicket.customer_phone || '+62 812-3456-7890',
    userId: currentTicket.customerId || currentTicket.user_id || 'USR-882910',
    memberSince: currentTicket.memberSince || '12 Jan 2024'
  };

  // Issue details
  const issue = {
    subject: currentTicket.subject || currentTicket.title || 'Kode Token Listrik Mati Lampu Urgent',
    description: currentTicket.description || currentTicket.message || `Pelanggan membeli token listrik senilai Rp 500.000 via metode pembayaran Saldo GurkyWallet. Transaksi dinyatakan 'Sukses' pada sistem dashboard, namun nomor Serial Number (SN) / Kode Token 20 digit tidak muncul pada struk transaksi maupun di halaman riwayat.`,
    attachmentName: currentTicket.attachmentName || 'screenshot_kendala_token_pln.png',
    attachmentSize: currentTicket.attachmentSize || '1.2 MB'
  };

  // Timeline
  const [timeline, setTimeline] = useState<TimelineItem[]>([
    {
      id: 'tl-1',
      time: createdAt,
      title: 'Ticket Created',
      description: 'Tiket berhasil dibuat oleh sistem berdasarkan keluhan pelanggan via portal dukungan.',
      operator: 'System Automated',
      type: 'system'
    },
    {
      id: 'tl-2',
      time: '2026-07-31 08:15',
      title: 'Customer Submitted Screenshot',
      description: 'Pelanggan mengunggah bukti struk pemotongan saldo tanpa kode token PLN.',
      operator: `${customer.fullName} (Customer)`,
      type: 'customer'
    },
    {
      id: 'tl-3',
      time: '2026-07-31 08:20',
      title: `Assigned to ${assignedStaff}`,
      description: `Tiket diserahkan ke ${assignedStaff} untuk pemrosesan rekueri manual ke biller.`,
      operator: 'System Dispatcher',
      type: 'agent'
    }
  ]);

  // Action Panel Modals & Forms
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedStaffOption, setSelectedStaffOption] = useState(assignedStaff);
  const [selectedStatusOption, setSelectedStatusOption] = useState(status);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Action Handlers
  const handleAssignSubmit = async () => {
    if (id) {
      await updateTicket(id, { assignedTo: selectedStaffOption });
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: `Assigned to ${selectedStaffOption}`,
        description: `Penugasan tiket diperbarui ke ${selectedStaffOption}.`,
        operator: 'CS Support Lead',
        type: 'agent'
      }
    ]);
    triggerToast(`Tiket berhasil ditugaskan ke ${selectedStaffOption}`);
    setShowAssignModal(false);
  };

  const handleStatusSubmit = async () => {
    if (id) {
      await updateTicket(id, { status: selectedStatusOption });
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: `Status Changed to ${selectedStatusOption}`,
        description: `Status tiket diperbarui dari ${status} menjadi ${selectedStatusOption}.`,
        operator: assignedStaff,
        type: 'agent'
      }
    ]);
    triggerToast(`Status tiket diperbarui menjadi ${selectedStatusOption}`);
    setShowStatusModal(false);
  };

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    if (id) {
      await replyTicket(id, newNoteText);
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: 'Internal Note',
        description: newNoteText,
        operator: assignedStaff,
        type: 'note'
      }
    ]);
    triggerToast('Catatan internal berhasil ditambahkan');
    setNewNoteText('');
    setShowNoteModal(false);
  };

  const handleMarkAsResolved = async () => {
    if (id) {
      await updateTicket(id, { status: 'Resolved' });
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: 'Resolved',
        description: 'Kode Token PLN berhasil diterbitkan manual dan diselesaikan oleh petugas.',
        operator: assignedStaff,
        type: 'agent'
      }
    ]);
    triggerToast('Tiket telah ditandai sebagai Selesai (Resolved)');
  };

  const handleCloseTicket = async () => {
    if (id) {
      await updateTicket(id, { status: 'Closed' });
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: 'Closed',
        description: 'Tiket ditutup secara permanen oleh petugas support.',
        operator: assignedStaff,
        type: 'system'
      }
    ]);
    triggerToast('Tiket telah Ditutup (Closed)');
  };

  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case 'Open':
      case 'Terbuka':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Waiting Customer':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Resolved':
      case 'Selesai':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Closed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityBadgeClass = (pr: string) => {
    switch (pr) {
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

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Bar */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Tutup
          </button>
        </div>
      )}

      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard/customer-support/tickets')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Tiket
        </button>
        <span className="text-xs font-mono text-gray-400">Portal Support GurkyNet v1.0</span>
      </div>

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xl font-bold font-mono text-blue-600">{ticketId}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(status)}`}>
                {status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs border ${getPriorityBadgeClass(priority)}`}>
                Priority: {priority}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{issue.subject}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
            >
              Assign Staff
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              Ubah Status
            </button>
          </div>
        </div>

        {/* Header Metadata Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Kategori</span>
            <span className="font-semibold text-gray-800">{category}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Tanggal Dibuat</span>
            <span className="font-mono text-gray-700">{createdAt}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Petugas Penanggung Jawab</span>
            <span className="font-semibold text-indigo-600">{assignedStaff}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Saluran</span>
            <span className="font-medium text-gray-700">App Customer Dashboard</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT & CENTER COLUMN (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* CUSTOMER INFO CARD */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer Information</h2>
              <Link
                to={`/dashboard/customer-support/customers/${customer.userId}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 transition"
              >
                View Customer Profile →
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img
                src={customer.avatar}
                alt={customer.fullName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-100 shadow-xs"
              />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/dashboard/customer-support/customers/${customer.userId}`}
                    className="text-base font-bold text-gray-900 hover:text-blue-600 transition"
                  >
                    {customer.fullName}
                  </Link>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Verified User
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{customer.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    <span>ID: <strong className="font-mono">{customer.userId}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Member Since: {customer.memberSince}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ISSUE DETAILS CARD */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issue & Detail Complaint</h2>
              <span className="text-xs text-gray-400">Rincian Masalah Tiket</span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-500">Subjek Utama:</div>
              <div className="p-3 bg-gray-50 rounded-xl font-semibold text-gray-900 text-sm">
                {issue.subject}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-500">Deskripsi Lengkap:</div>
              <div className="p-4 bg-gray-50/70 rounded-xl text-xs text-gray-700 leading-relaxed whitespace-pre-line border border-gray-100">
                {issue.description}
              </div>
            </div>

            {/* Attachment Placeholder */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-gray-500">Lampiran Bukti (Attachment):</div>
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <FileImage className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{issue.attachmentName}</div>
                    <div className="text-[10px] text-gray-500">{issue.attachmentSize} • PNG File</div>
                  </div>
                </div>
                <button 
                  onClick={() => triggerToast('Membuka file lampiran tangkapan layar...')}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium transition"
                >
                  Lihat File
                </button>
              </div>
            </div>
          </div>

          {/* ACTION PANEL */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Action Panel</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-gray-50 hover:bg-indigo-50 text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-xl text-xs font-semibold transition"
              >
                <UserCheck className="w-4 h-4" />
                <span>Assign Staff</span>
              </button>

              <button
                onClick={() => setShowStatusModal(true)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-gray-50 hover:bg-blue-50 text-blue-700 border border-gray-200 hover:border-blue-200 rounded-xl text-xs font-semibold transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Change Status</span>
              </button>

              <button
                onClick={() => setShowNoteModal(true)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-gray-50 hover:bg-amber-50 text-amber-700 border border-gray-200 hover:border-amber-200 rounded-xl text-xs font-semibold transition"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Add Note</span>
              </button>

              <button
                onClick={handleMarkAsResolved}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Resolved</span>
              </button>

              <button
                onClick={handleCloseTicket}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 p-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>Close Ticket</span>
              </button>
            </div>
          </div>

          {/* TIMELINE SECTION */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Activity Timeline</h2>
              <span className="text-xs font-mono text-gray-400">{timeline.length} Aktivitas</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {timeline.map((item) => {
                let badgeBg = 'bg-blue-500';
                if (item.type === 'customer') badgeBg = 'bg-purple-500';
                if (item.type === 'agent') badgeBg = 'bg-emerald-500';
                if (item.type === 'note') badgeBg = 'bg-amber-500';

                return (
                  <div key={item.id} className="relative group">
                    <div className={`absolute -left-[1.85rem] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ring-gray-100 ${badgeBg}`} />
                    <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">{item.title}</span>
                        <span className="text-[10px] font-mono text-gray-400">{item.time}</span>
                      </div>
                      <p className="text-xs text-gray-600">{item.description}</p>
                      <div className="text-[10px] text-gray-400 pt-1 font-medium flex items-center gap-1">
                        <span>Operator:</span>
                        <span className="text-gray-700 font-semibold">{item.operator}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (1/3 width) - SUMMARY CARDS */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Right Panel & Related Context</div>

          {/* Quick Information Summary Card */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span>Quick Information</span>
            </div>
            <div className="text-xs space-y-2 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">SLA Response:</span>
                <span className="font-semibold text-emerald-600">Tercapai (3m)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tingkat Eskalasi:</span>
                <span className="font-semibold text-gray-800">Tier 1 Support</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Biller Provider:</span>
                <span className="font-semibold text-gray-800">PLN Artajasa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Tiket User:</span>
                <span className="font-semibold text-blue-600">3 Tiket (1 Open)</span>
              </div>
            </div>
          </div>

          {/* Related Transaction Card */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Related Transaction</span>
              </div>
              <Link
                to="/dashboard/customer-support/investigation"
                className="text-[10px] font-semibold text-blue-600 hover:underline"
              >
                Investigate →
              </Link>
            </div>
            <div className="text-xs space-y-1.5 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Trx ID:</span>
                <Link to="/dashboard/customer-support/investigation" className="font-mono font-bold text-blue-600 hover:underline">
                  TRX-982104
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Produk:</span>
                <span className="font-semibold text-gray-800">Token PLN 500k</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Nominal:</span>
                <span className="font-bold text-emerald-600">Rp 501.500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status Trx:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Sukses (System)
                </span>
              </div>
            </div>
          </div>

          {/* Related Wallet Card */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
              <Wallet className="w-4 h-4 text-purple-600" />
              <span>Related Wallet</span>
            </div>
            <div className="text-xs space-y-1.5 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Wallet Account:</span>
                <span className="font-mono font-bold text-gray-900">GW-882910</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Saldo Saat Ini:</span>
                <span className="font-bold text-gray-900">Rp 1.450.000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pemotongan:</span>
                <span className="font-semibold text-red-600">-Rp 501.500</span>
              </div>
            </div>
          </div>

          {/* Related Order Card */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>Related Order</span>
            </div>
            <div className="text-xs space-y-1.5 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Order Ref:</span>
                <span className="font-mono font-bold text-gray-900">ORD-2026-0731-002</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ID Pelanggan PLN:</span>
                <span className="font-mono font-bold text-blue-600">53210984122</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Nama Meteran:</span>
                <span className="font-semibold text-gray-800">SITI RAHMAWATI</span>
              </div>
            </div>
          </div>

          {/* Related Invoice Card */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Related Invoice</span>
            </div>
            <div className="text-xs space-y-1.5 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">No. Invoice:</span>
                <span className="font-mono font-bold text-gray-900">INV/20260731/PLN/0091</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status Faktur:</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">Lunas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ASSIGN STAFF */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Penugasan Staff CS</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-gray-600">Pilih staff Customer Support penanggung jawab:</div>
            <select
              value={selectedStaffOption}
              onChange={(e) => setSelectedStaffOption(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none"
            >
              <option value="CS Ani">CS Ani (Spesialis Transfer & Token PLN)</option>
              <option value="CS Budi">CS Budi (Spesialis Pulsa & Paket Data)</option>
              <option value="CS Doni">CS Doni (Spesialis Tagihan & Voucher)</option>
              <option value="Unassigned">Unassigned (Belum Ditugaskan)</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleAssignSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE STATUS */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Ubah Status Tiket</h3>
              <button onClick={() => setShowStatusModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-gray-600">Pilih status tiket terbaru:</div>
            <select
              value={selectedStatusOption}
              onChange={(e) => setSelectedStatusOption(e.target.value as any)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none"
            >
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Waiting Customer">Waiting Customer</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleStatusSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">Update Status</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD INTERNAL NOTE */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Tambah Catatan Internal (Internal Note)</h3>
              <button onClick={() => setShowNoteModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddNoteSubmit} className="space-y-3">
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Tulis catatan penanganan internal (hanya terlihat oleh tim CS)..."
                rows={4}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNoteModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" />
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
