import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  Copy,
  Download,
  User,
  Ticket,
  Receipt,
  CheckCircle2,
  Clock,
  Server,
  Wallet,
  CreditCard,
  Terminal,
  Lock,
  Loader2
} from 'lucide-react';

import { useCustomerSupportStore, InvestigationData } from '../../store/customerSupport.store';

export const CustomerSupportTransactionInvestigation: React.FC = () => {
  const navigate = useNavigate();

  const {
    investigationResult,
    investigationLoading,
    investigateTransaction
  } = useCustomerSupportStore();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('TRX-982104');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    investigateTransaction('TRX-982104');
  }, [investigateTransaction]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} berhasil disalin ke clipboard!`);
  };

  // Fallback or store result
  const transaction: InvestigationData = investigationResult || {
    invoiceNumber: 'INV/20260731/PLN/0091',
    transactionId: 'TRX-982104',
    referenceNumber: 'REF-20260731-99812',
    customerName: 'Siti Rahmawati',
    customerEmail: 'siti.rahma@yahoo.com',
    customerPhone: '+62 812-3456-7890',
    userId: 'USR-882910',
    productName: 'Token PLN Rp 500.000',
    category: 'Token PLN',
    provider: 'PLN Artajasa Biller',
    amount: 500000,
    adminFee: 1500,
    totalPayment: 501500,
    paymentMethod: 'GurkyWallet',
    createdTime: '2026-07-31 08:12:04 WIB',
    completedTime: '2026-07-31 08:12:18 WIB',

    paymentStatus: 'PAID (Settled)',
    paymentGateway: 'GurkyWallet Internal Engine',
    paymentReference: 'GW-PAY-88192031',
    settlementTime: '2026-07-31 08:12:06 WIB',

    providerName: 'PT Artajasa Pembayaran Elektronis',
    providerReference: 'AJ-PLN-773829101',
    providerStatus: 'SUCCESS_SN_RELEASED',
    providerMessage: 'Transaksi sukses, SN Token Generated: 5321-9081-2231-4401-8890',
    retryCount: 1,

    walletBalanceBefore: 1951500,
    walletBalanceAfter: 1450000,
    walletMutation: -501500
  };

  // Timeline Items
  const timelineSteps = [
    {
      time: '08:12:04 WIB',
      status: 'Transaction Created',
      description: 'Pengguna membuat pesanan Token PLN 500k melalui aplikasi mobile GurkyNet.'
    },
    {
      time: '08:12:06 WIB',
      timeDetail: '2s delay',
      status: 'Payment Received',
      description: 'Pemotongan saldo GurkyWallet sebesar Rp 501.500 berhasil diautentikasi.'
    },
    {
      time: '08:12:08 WIB',
      status: 'Request Sent to Provider',
      description: 'Payload SOAP API dikirimkan ke gateway server PT Artajasa (PLN Biller).'
    },
    {
      time: '08:12:12 WIB',
      status: 'Provider Processing',
      description: 'Server provider memproses kueri ID Pelanggan PLN 53210984122.'
    },
    {
      time: '08:12:16 WIB',
      status: 'Provider Response',
      description: 'Provider mengembalikan respon HTTP 200 OK dengan payload SN Token.'
    },
    {
      time: '08:12:18 WIB',
      status: 'Completed',
      description: 'Status transaksi diperbarui menjadi Sukses & faktur dikirim ke email pelanggan.'
    }
  ];

  // System Activity Log
  const systemLogs = [
    {
      time: '08:12:04.102',
      event: 'API Request Received',
      level: 'INFO',
      message: 'POST /api/v1/pob/pln/purchase - IP: 180.252.88.12 - User: USR-882910'
    },
    {
      time: '08:12:05.990',
      event: 'Wallet Auth',
      level: 'SUCCESS',
      message: 'Wallet GW-882910 lock balance acquired. Debited Rp 501.500'
    },
    {
      time: '08:12:08.015',
      event: 'API Request Sent',
      level: 'INFO',
      message: 'Outbound HTTP POST to https://biller.artajasa.co.id/pln/purchase'
    },
    {
      time: '08:12:11.450',
      event: 'Retry Attempt',
      level: 'WARN',
      message: 'Socket timeout on first ack (attempt 1/3). Executing auto-retry query status...'
    },
    {
      time: '08:12:16.210',
      event: 'Webhook Received',
      level: 'SUCCESS',
      message: 'Callback ACK received: {code: "00", sn: "53219081223144018890"}'
    },
    {
      time: '08:12:18.001',
      event: 'Status Updated',
      level: 'INFO',
      message: 'DB Record TRX-982104 state transition [PENDING -> SUCCESS]'
    },
    {
      time: '08:15:22.100',
      event: 'Manual Investigation Started',
      level: 'CS_AUDIT',
      message: 'Investigation session initiated by Customer Support Agent Ani'
    }
  ];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await investigateTransaction(searchQuery);
    showToast(`Memuat data investigasi transaksi untuk '${searchQuery}'...`);
  };

  const handleExportSummary = () => {
    showToast('Laporan ringkasan investigasi berhasil diunduh (PDF / JSON Audit format)');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard/customer-support/tickets')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Support Dashboard
        </button>
        <span className="text-xs font-mono text-gray-400">CS Transaction Investigation Center</span>
      </div>

      {/* READ ONLY MANDATORY WARNING BADGE */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
              <span>READ-ONLY AUDIT MODE</span>
              <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase">
                Investigation Only
              </span>
            </div>
            <div className="text-xs text-amber-700 mt-0.5">
              Customer Support cannot modify transaction data, trigger refunds, or alter database records directly.
            </div>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-[10px] font-mono text-amber-800 font-semibold block">Audit ID: AUD-2026-9810</span>
          <span className="text-[10px] text-amber-600">GurkyNet Security Compliance</span>
        </div>
      </div>

      {/* Toast Notification */}
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

      {/* SEARCH SECTION */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction Investigation Search</h2>
          <span className="text-[11px] text-gray-400">Cari berdasarkan 6 parameter kunci</span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Masukkan Invoice, Trx ID, Ref No, No Telepon, Email, atau User ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={investigationLoading}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {investigationLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Investigasi Transaksi</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-gray-500">
          <span className="text-gray-400 font-medium">Contoh pencarian:</span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('INV/20260731/PLN/0091');
              investigateTransaction('INV/20260731/PLN/0091');
            }}
            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-mono text-gray-700"
          >
            INV/20260731/PLN/0091
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('TRX-982104');
              investigateTransaction('TRX-982104');
            }}
            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-mono text-gray-700"
          >
            TRX-982104
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('+62 812-3456-7890');
              investigateTransaction('+62 812-3456-7890');
            }}
            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          >
            +62 812-3456-7890
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('siti.rahma@yahoo.com');
              investigateTransaction('siti.rahma@yahoo.com');
            }}
            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          >
            siti.rahma@yahoo.com
          </button>
        </div>
      </div>

      {/* ACTION PANEL */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Investigation Action Panel</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => copyToClipboard(transaction.invoiceNumber, 'No Invoice')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copy Invoice</span>
          </button>

          <button
            onClick={() => copyToClipboard(transaction.transactionId, 'Transaction ID')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copy Transaction ID</span>
          </button>

          <button
            onClick={() => copyToClipboard(transaction.providerReference, 'Provider Reference')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copy Provider Reference</span>
          </button>

          <button
            onClick={handleExportSummary}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Investigation Summary</span>
          </button>

          <Link
            to={`/dashboard/customer-support/customers/${transaction.userId}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
          >
            <User className="w-3.5 h-3.5 text-gray-500" />
            <span>Open Customer Profile</span>
          </Link>

          <Link
            to="/dashboard/customer-support/tickets/TCK-1002"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Open Related Ticket</span>
          </Link>
        </div>
      </div>

      {/* TRANSACTION SUMMARY SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Transaction Summary</h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold self-start sm:self-auto">
            Status: SUKSES (Settled)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Invoice Number</span>
            <div className="font-mono font-bold text-blue-600 text-xs">{transaction.invoiceNumber}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Transaction ID</span>
            <div className="font-mono font-bold text-gray-900 text-xs">{transaction.transactionId}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Reference Number</span>
            <div className="font-mono font-semibold text-gray-700 text-xs">{transaction.referenceNumber}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Nama Produk</span>
            <div className="font-bold text-gray-900 text-xs">{transaction.productName}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Kategori</span>
            <div className="font-semibold text-gray-800 text-xs">{transaction.category}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Provider / Biller</span>
            <div className="font-semibold text-gray-800 text-xs">{transaction.provider}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Harga Produk</span>
            <div className="font-bold text-gray-900 text-xs">
              Rp {(transaction.amount || 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Biaya Admin</span>
            <div className="font-bold text-gray-900 text-xs">
              Rp {(transaction.adminFee || 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-blue-600 uppercase font-bold">Total Pembayaran</span>
            <div className="font-bold text-blue-700 text-sm">
              Rp {(transaction.totalPayment || 0).toLocaleString('id-ID')}
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Metode Pembayaran</span>
            <div className="font-semibold text-gray-800 text-xs">{transaction.paymentMethod}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Waktu Dibuat</span>
            <div className="font-mono text-gray-600 text-[11px]">{transaction.createdTime}</div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Waktu Selesai</span>
            <div className="font-mono text-gray-600 text-[11px]">{transaction.completedTime}</div>
          </div>
        </div>
      </div>

      {/* TRANSACTION STATUS TIMELINE */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">Transaction Status Timeline</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">Total Durasi: 14 Detik</span>
        </div>

        {/* Step-by-Step Horizontal or Vertical Progress */}
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
          {timelineSteps.map((step, idx) => (
            <div key={idx} className="relative group">
              <div className="absolute -left-[1.85rem] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ring-blue-100 bg-blue-600" />
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-xs">{step.status}</span>
                    {step.timeDetail && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                        {step.timeDetail}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{step.description}</p>
                </div>
                <span className="text-[11px] font-mono font-medium text-gray-400 whitespace-nowrap self-start sm:self-center">
                  {step.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* THREE CARDS: PAYMENT, PROVIDER, WALLET INFORMATION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PAYMENT INFORMATION */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">Payment Information</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Payment Method:</span>
              <span className="font-bold text-gray-900">{transaction.paymentMethod}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Payment Status:</span>
              <span className="font-bold text-emerald-600">{transaction.paymentStatus}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Payment Gateway:</span>
              <span className="font-semibold text-gray-800 text-[11px]">{transaction.paymentGateway}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Payment Ref:</span>
              <span className="font-mono font-semibold text-gray-800 text-[11px]">{transaction.paymentReference}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Settlement Time:</span>
              <span className="font-mono text-gray-600 text-[10px]">{transaction.settlementTime}</span>
            </div>
          </div>
        </div>

        {/* PROVIDER INFORMATION */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Server className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">Provider Information</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400 block text-[10px]">Provider Name</span>
              <span className="font-bold text-gray-900">{transaction.providerName}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Provider Ref:</span>
              <span className="font-mono font-bold text-blue-600 text-[11px]">{transaction.providerReference}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Provider Status:</span>
              <span className="font-mono font-bold text-emerald-600 text-[11px]">{transaction.providerStatus}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Retry Count:</span>
              <span className="font-bold text-amber-600">{transaction.retryCount} Attempt</span>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400 block text-[10px]">Provider Response Message</span>
              <span className="font-mono text-gray-700 text-[11px] block mt-0.5">{transaction.providerMessage}</span>
            </div>
          </div>
        </div>

        {/* WALLET INFORMATION */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Wallet className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase">Wallet Mutation Info</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Balance Before:</span>
              <span className="font-bold text-gray-900">
                Rp {(transaction.walletBalanceBefore || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Wallet Mutation:</span>
              <span className="font-bold text-red-600 font-mono">
                {(transaction.walletMutation || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-400">Balance After:</span>
              <span className="font-bold text-emerald-600">
                Rp {(transaction.walletBalanceAfter || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-[11px] text-blue-800 space-y-1">
              <span className="font-bold block">Status Mutasi Dompet:</span>
              <p className="text-[10px] leading-relaxed">
                Mutasi otomatis sukses dipotong oleh GurkyWallet ledger. Tidak ditemukan selisih pencatatan saldo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM LOG (READ-ONLY ACTIVITY LOG) */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-700" />
            <h2 className="text-base font-bold text-gray-900">System Activity Log (Read-Only)</h2>
          </div>
          <span className="text-xs font-mono text-gray-400">Audit Trail Immutable Log</span>
        </div>

        <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-xs space-y-2 overflow-x-auto max-h-72">
          {systemLogs.map((log, index) => {
            let levelColor = 'text-blue-400';
            if (log.level === 'SUCCESS') levelColor = 'text-emerald-400';
            if (log.level === 'WARN') levelColor = 'text-amber-400';
            if (log.level === 'CS_AUDIT') levelColor = 'text-purple-400';

            return (
              <div key={index} className="flex items-start gap-3 hover:bg-gray-800/80 p-1 rounded transition">
                <span className="text-gray-500 whitespace-nowrap">{log.time}</span>
                <span className={`font-bold whitespace-nowrap ${levelColor}`}>[{log.level}]</span>
                <span className="text-gray-300 font-semibold whitespace-nowrap">{log.event}:</span>
                <span className="text-gray-400">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
