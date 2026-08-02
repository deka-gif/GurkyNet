import React, { useState } from 'react';
import { 
  Search, Filter, Play, RefreshCw, CheckCircle, XCircle, AlertCircle, 
  CreditCard, ArrowUpRight, ArrowDownLeft, FileText, User as UserIcon, Calendar, Info
} from 'lucide-react';
import { AdminTransaction, AdminUser, WalletLedger, AuditLogEntry } from '../types';

interface OperationsProps {
  transactions: AdminTransaction[];
  users: AdminUser[];
  ledger: WalletLedger[];
  auditLogs: AuditLogEntry[];
  onManualRetry: (id: string) => void;
  onManualRefund: (id: string) => void;
  onWalletAdjustment: (userId: string, type: 'credit' | 'debit', action: 'topup' | 'adjustment', amount: number, note: string) => void;
}

export const AdminOperations: React.FC<OperationsProps> = ({
  transactions, users, ledger, auditLogs, onManualRetry, onManualRefund, onWalletAdjustment
}) => {
  const [subTab, setSubTab] = useState<'transactions' | 'wallet' | 'audit'>('transactions');

  // Transactions filters
  const [txSearch, setTxSearch] = useState('');
  const [txStatus, setTxStatus] = useState('All');
  const [selectedTx, setSelectedTx] = useState<AdminTransaction | null>(null);

  // Wallet adjustment states
  const [selectedUser, setSelectedUser] = useState('');
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit');
  const [adjAction, setAdjAction] = useState<'topup' | 'adjustment'>('topup');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjNote, setAdjNote] = useState('');
  const [walletFeedback, setWalletFeedback] = useState<string | null>(null);

  // Audit Logs filters
  const [logSearch, setLogSearch] = useState('');
  const [logEvent, setLogEvent] = useState('All');
  const [logDate, setLogDate] = useState('');

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || adjAmount <= 0 || !adjNote) {
      setWalletFeedback('Gagal: Harap lengkapi semua bidang isian.');
      return;
    }

    onWalletAdjustment(selectedUser, adjType, adjAction, adjAmount, adjNote);
    
    // Success feedback
    setWalletFeedback(`Sukses: Berhasil melakukan penyesuaian saldo sebesar ${formatIDR(adjAmount)}!`);
    setAdjAmount(0);
    setAdjNote('');
    setTimeout(() => {
      setWalletFeedback(null);
    }, 3000);
  };

  // Transaction Actions inside Details Drawer
  const handleTriggerRetry = (id: string) => {
    onManualRetry(id);
    if (selectedTx && selectedTx.id === id) {
      setSelectedTx({ ...selectedTx, status: 'sukses', note: 'Transaksi berhasil diselesaikan via retry manual.' });
    }
  };

  const handleTriggerRefund = (id: string) => {
    onManualRefund(id);
    if (selectedTx && selectedTx.id === id) {
      setSelectedTx({ ...selectedTx, status: 'gagal', note: 'Transaksi dibatalkan & dana dikembalikan ke saldo user (Refunded).' });
    }
  };

  // Filters calculation
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.transactionCode.toLowerCase().includes(txSearch.toLowerCase()) || 
                          t.targetNo.includes(txSearch) || 
                          t.correlationId.toLowerCase().includes(txSearch.toLowerCase());
    const matchesStatus = txStatus === 'All' || t.status === txStatus;
    return matchesSearch && matchesStatus;
  });

  const uniqueLogEvents = Array.from(new Set(auditLogs.map(l => l.event)));

  const filteredAuditLogs = auditLogs.filter(l => {
    const matchesSearch = l.user.toLowerCase().includes(logSearch.toLowerCase()) || 
                          l.correlationId.toLowerCase().includes(logSearch.toLowerCase()) || 
                          l.requestId.toLowerCase().includes(logSearch.toLowerCase()) ||
                          l.description.toLowerCase().includes(logSearch.toLowerCase());
    const matchesEvent = logEvent === 'All' || l.event === logEvent;
    const matchesDate = !logDate || l.date.startsWith(logDate);
    return matchesSearch && matchesEvent && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Sub navigation bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setSubTab('transactions')}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 tracking-wide uppercase flex items-center gap-2 transition ${
            subTab === 'transactions' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <CreditCard size={14} />
          Transactions &amp; Manual Actions
        </button>
        <button
          onClick={() => setSubTab('wallet')}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 tracking-wide uppercase flex items-center gap-2 transition ${
            subTab === 'wallet' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <CreditCard size={14} />
          Wallet Manual Adjustments
        </button>
        <button
          onClick={() => setSubTab('audit')}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 tracking-wide uppercase flex items-center gap-2 transition ${
            subTab === 'audit' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileText size={14} />
          System Audit Logs
        </button>
      </div>

      {/* VIEW 1: TRANSACTION MANAGEMENT */}
      {subTab === 'transactions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari Invoice, No Tujuan, Correlation ID..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-800"
              />
            </div>

            <select
              value={txStatus}
              onChange={(e) => setTxStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none text-gray-700 font-semibold"
            >
              <option value="All">Semua Status</option>
              <option value="sukses">Sukses</option>
              <option value="pending">Pending</option>
              <option value="gagal">Gagal</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Invoice &amp; Layanan</th>
                  <th className="px-6 py-3.5">No Tujuan</th>
                  <th className="px-6 py-3.5">Nominal Jual</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{t.transactionCode}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{t.serviceName} - {t.productName}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-900">
                      {t.targetNo}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-900">
                      {formatIDR(t.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        t.status === 'sukses' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        t.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(t.date).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedTx(t)}
                        className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded text-[11px] font-bold transition active:scale-95"
                      >
                        Lihat Traces
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details Drawer / Modal */}
          {selectedTx && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Trace &amp; Kontrol Manual Transaksi</h3>
                  <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Tutup</button>
                </div>
                
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">Nomor Invoice</span>
                      <span className="font-bold text-gray-900">{selectedTx.transactionCode}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">Nominal Jual</span>
                      <span className="font-mono font-bold text-indigo-600">{formatIDR(selectedTx.amount)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">X-Correlation-ID</span>
                      <span className="font-mono text-gray-700 font-bold">{selectedTx.correlationId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">X-Request-ID</span>
                      <span className="font-mono text-gray-700 font-bold">{selectedTx.requestId}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider mb-1">Response Payload / Catatan Gateway</span>
                    <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[10px] overflow-x-auto max-h-32">
{`{
  "status": "${selectedTx.status}",
  "sku_code": "${selectedTx.productName.toLowerCase().replace(/ /g, '_')}",
  "target_no": "${selectedTx.targetNo}",
  "provider_note": "${selectedTx.note || 'No provider data'}",
  "telemetry_latency": "310ms"
}`}
                    </pre>
                  </div>

                  {/* Manual Intervention Controls */}
                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl space-y-3">
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold block">Intervensi Manual Admin</span>
                        <span className="text-[10px] text-amber-700 block mt-0.5">Selesaikan transaksi yang tertunda atau kembalikan dana secara paksa jika terjadi kegagalan gateway.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 pt-1">
                      <button
                        onClick={() => handleTriggerRetry(selectedTx.id)}
                        disabled={selectedTx.status === 'sukses'}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <RefreshCw size={13} />
                        Manual Retry (Sukses)
                      </button>

                      <button
                        onClick={() => handleTriggerRefund(selectedTx.id)}
                        disabled={selectedTx.status === 'gagal'}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <ArrowUpRight size={13} />
                        Manual Refund (Gagal)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WALLET MANUAL ADJUSTMENT */}
      {subTab === 'wallet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Adjustment Form */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-4 h-fit">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2 mb-4">
                <CreditCard className="text-indigo-600" size={16} />
                Form Penyesuaian Saldo (Adjustment)
              </h3>

              <form onSubmit={handleApplyAdjustment} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Pengguna</label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none"
                    required
                  >
                    <option value="">Pilih User...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} (Rek: {u.walletNo})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Arah Modifikasi</label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                    >
                      <option value="credit">Tambah (Credit)</option>
                      <option value="debit">Kurang (Debit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tipe Aksi</label>
                    <select
                      value={adjAction}
                      onChange={(e) => setAdjAction(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs"
                    >
                      <option value="topup">Manual Topup</option>
                      <option value="adjustment">Koreksi Saldo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nominal (IDR)</label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(Number(e.target.value))}
                    placeholder="e.g. 50000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Alasan Penyesuaian / Keterangan</label>
                  <textarea
                    rows={3}
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="Catatan persetujuan admin..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs"
                    required
                  />
                </div>

                {walletFeedback && (
                  <div className={`p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-2 ${
                    walletFeedback.startsWith('Gagal') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{walletFeedback}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  Proses Penyesuaian Saldo
                </button>
              </form>
            </div>

            {/* Ledger ledger history */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm lg:col-span-8 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <FileText className="text-indigo-600" size={16} />
                Buku Besar Penyesuaian Wallet (Wallet Ledger Audit)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Nama User</th>
                      <th className="px-4 py-3">Aksi</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3">Aliran Saldo (Before-After)</th>
                      <th className="px-4 py-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px] font-semibold text-gray-600">
                    {ledger.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-gray-900 block">{log.userName}</span>
                          <span className="text-[9px] text-gray-400 font-mono">UID: {log.userId}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            log.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold">
                          <span className={log.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}>
                            {log.type === 'credit' ? '+' : '-'} {formatIDR(log.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-gray-400 font-medium">
                          {formatIDR(log.balanceBefore)} → {formatIDR(log.balanceAfter)}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 font-medium">
                          {log.note}
                          <span className="block text-[9px] text-gray-400 mt-1 font-mono">{new Date(log.date).toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW 3: AUDIT LOG */}
      {subTab === 'audit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari User, Correlation ID, Request ID, deskripsi event..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-800"
              />
            </div>

            <select
              value={logEvent}
              onChange={(e) => setLogEvent(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none text-gray-700 font-semibold"
            >
              <option value="All">Semua Jenis Event</option>
              {uniqueLogEvents.map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>

            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none text-gray-700 font-semibold"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Timestamp &amp; User</th>
                  <th className="px-6 py-3.5">Jenis Event</th>
                  <th className="px-6 py-3.5">Trace IDs (Correlation &amp; Request)</th>
                  <th className="px-6 py-3.5">Deskripsi Audit Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400">
                      Tidak ada catatan log audit yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="text-[10px] text-gray-400 font-mono">{new Date(log.date).toLocaleString()}</div>
                        <div className="text-gray-900 font-bold mt-1.5 flex items-center gap-1">
                          <UserIcon size={12} className="text-gray-400" />
                          {log.user}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          log.event.includes('LOGIN') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          log.event.includes('WALLET') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          log.event.includes('PRODUCT') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {log.event}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-mono font-bold text-gray-700">
                          <span className="text-gray-400 uppercase text-[8px] font-bold mr-1 tracking-wider">Corr ID:</span> 
                          {log.correlationId}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-gray-700 mt-1">
                          <span className="text-gray-400 uppercase text-[8px] font-bold mr-1 tracking-wider">Req ID:</span> 
                          {log.requestId}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {log.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
