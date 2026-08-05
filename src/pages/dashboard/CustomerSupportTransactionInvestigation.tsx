import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  Copy,
  Download,
  User,
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

import { useCustomerSupportStore } from '../../store/customerSupport.store';

export const CustomerSupportTransactionInvestigation: React.FC = () => {
  const navigate = useNavigate();

  const {
    investigationData,
    investigationLoading,
    investigationError,
    investigateTransaction
  } = useCustomerSupportStore();

  // Search input state — no auto-loaded demo transaction
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} berhasil disalin ke clipboard!`);
  };

  // Real investigation payload from Laravel:
  // { transaction, wallet_mutation, digiflazz_logs, midtrans_logs, activity_logs }
  const trx = investigationData?.transaction || null;
  const walletMutations: any[] = Array.isArray(investigationData?.wallet_mutation)
    ? investigationData.wallet_mutation
    : [];
  const digiflazzLogs: any[] = Array.isArray(investigationData?.digiflazz_logs)
    ? investigationData.digiflazz_logs
    : [];
  const midtransLogs: any[] = Array.isArray(investigationData?.midtrans_logs)
    ? investigationData.midtrans_logs
    : [];
  const activityLogs: any[] = Array.isArray(investigationData?.activity_logs)
    ? investigationData.activity_logs
    : [];

  const latestDigiflazz = digiflazzLogs[0] || null;
  const latestMidtrans = midtransLogs[0] || null;
  const trxUser = trx?.user || null;
  const relatedMutations = trx
    ? walletMutations.filter(
        (m: any) => String(m.reference_id) === String(trx.id) || String(m.reference_id) === String(trx.invoice_number)
      )
    : [];

  // Timeline built from real records
  const timelineSteps = trx
    ? [
        {
          time: trx.created_at || '-',
          status: 'Transaction Created',
          description: `Transaksi ${trx.invoice_number} dibuat (${trx.service_name || '-'}).`
        },
        ...relatedMutations.map((m: any) => ({
          time: m.created_at || '-',
          status: m.type === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
          description: `${m.description || 'Mutasi dompet'} — Rp ${Number(m.amount || 0).toLocaleString('id-ID')}`
        })),
        ...digiflazzLogs.map((d: any) => ({
          time: d.created_at || '-',
          status: `Digiflazz: ${d.digiflazz_status || '-'}`,
          description: `Ref ID: ${d.ref_id || '-'}, SKU: ${d.buyer_sku_code || '-'}${d.sn ? `, SN: ${d.sn}` : ''}`
        })),
        ...midtransLogs.map((m: any) => ({
          time: m.created_at || '-',
          status: `Midtrans: ${m.transaction_status || '-'}`,
          description: `Order ID: ${m.order_id || '-'}`
        })),
        {
          time: trx.updated_at || '-',
          status: `Status Terakhir: ${trx.status || '-'}`,
          description: trx.notes || 'Tidak ada catatan tambahan.'
        }
      ]
    : [];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await investigateTransaction(searchQuery.trim());
  };

  // Downloads the real investigation payload as a JSON audit file
  const handleExportSummary = () => {
    if (!investigationData) {
      showToast('Belum ada data investigasi untuk diekspor.');
      return;
    }
    const blob = new Blob([JSON.stringify(investigationData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `investigation-${trx?.invoice_number || 'result'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Laporan investigasi berhasil diunduh (JSON audit format).');
  };

  const getStatusBadgeClass = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (['success', 'sukses', 'settlement'].includes(s)) return 'bg-emerald-100 text-emerald-800';
    if (['pending', 'processing'].includes(s)) return 'bg-amber-100 text-amber-800';
    if (['failed', 'canceled', 'cancelled'].includes(s)) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
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
          <span className="text-[11px] text-gray-400">Cari berdasarkan nomor invoice atau ID transaksi</span>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Masukkan Nomor Invoice atau Transaction ID..."
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

        {investigationError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
            {investigationError}
          </div>
        )}
      </div>

      {!trx ? (
        <div className="bg-white p-12 rounded-2xl shadow-xs border border-gray-100 text-center space-y-2">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-500">Belum ada transaksi yang diinvestigasi.</p>
          <p className="text-xs text-gray-400">
            Masukkan nomor invoice atau ID transaksi pada kolom pencarian di atas untuk memulai investigasi.
          </p>
        </div>
      ) : (
        <>
          {/* ACTION PANEL */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Investigation Action Panel</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => copyToClipboard(trx.invoice_number || '', 'No Invoice')}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy Invoice</span>
              </button>

              <button
                onClick={() => copyToClipboard(String(trx.id ?? ''), 'Transaction ID')}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy Transaction ID</span>
              </button>

              {latestDigiflazz?.ref_id && (
                <button
                  onClick={() => copyToClipboard(latestDigiflazz.ref_id, 'Provider Reference')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy Provider Reference</span>
                </button>
              )}

              <button
                onClick={handleExportSummary}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Investigation Summary</span>
              </button>

              {trxUser?.id && (
                <Link
                  to={`/dashboard/customer-support/customers/${trxUser.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-medium transition"
                >
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span>Open Customer Profile</span>
                </Link>
              )}
            </div>
          </div>

          {/* TRANSACTION SUMMARY SECTION */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Transaction Summary</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${getStatusBadgeClass(trx.status)}`}>
                Status: {(trx.status || '-').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Invoice Number</span>
                <div className="font-mono font-bold text-blue-600 text-xs">{trx.invoice_number || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Transaction ID</span>
                <div className="font-mono font-bold text-gray-900 text-xs">{trx.id ?? '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Layanan</span>
                <div className="font-bold text-gray-900 text-xs">{trx.service_name || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Nomor Tujuan</span>
                <div className="font-mono font-semibold text-gray-700 text-xs">{trx.target_number || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Harga Produk</span>
                <div className="font-bold text-gray-900 text-xs">
                  Rp {Number(trx.amount || 0).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Biaya Admin</span>
                <div className="font-bold text-gray-900 text-xs">
                  Rp {Number(trx.admin_fee || 0).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-0.5">
                <span className="text-[10px] text-blue-600 uppercase font-bold">Total Pembayaran</span>
                <div className="font-bold text-blue-700 text-sm">
                  Rp {Number(trx.total_payment || 0).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Metode Pembayaran</span>
                <div className="font-semibold text-gray-800 text-xs">{trx.payment_method || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Pelanggan</span>
                <div className="font-semibold text-gray-800 text-xs">{trxUser?.name || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Waktu Dibuat</span>
                <div className="font-mono text-gray-600 text-[11px]">{trx.created_at || '-'}</div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Update Terakhir</span>
                <div className="font-mono text-gray-600 text-[11px]">{trx.updated_at || '-'}</div>
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
              <span className="text-xs text-gray-400 font-mono">{timelineSteps.length} peristiwa tercatat</span>
            </div>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[1.85rem] top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ring-blue-100 bg-blue-600" />
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-gray-900 text-xs">{step.status}</span>
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
                  <span className="font-bold text-gray-900">{trx.payment_method || '-'}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-400">Status Transaksi:</span>
                  <span className="font-bold text-gray-900">{trx.status || '-'}</span>
                </div>
                {latestMidtrans ? (
                  <>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">Midtrans Order ID:</span>
                      <span className="font-mono font-semibold text-gray-800 text-[11px]">{latestMidtrans.order_id || '-'}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">Midtrans Status:</span>
                      <span className="font-mono font-semibold text-gray-800 text-[11px]">{latestMidtrans.transaction_status || '-'}</span>
                    </div>
                  </>
                ) : (
                  <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-400">
                    Tidak ada catatan pembayaran Midtrans untuk transaksi ini.
                  </div>
                )}
              </div>
            </div>

            {/* PROVIDER INFORMATION */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <Server className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase">Provider Information</h3>
              </div>

              <div className="space-y-2 text-xs">
                {latestDigiflazz ? (
                  <>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">Provider Ref:</span>
                      <span className="font-mono font-bold text-blue-600 text-[11px]">{latestDigiflazz.ref_id || '-'}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">SKU:</span>
                      <span className="font-mono font-semibold text-gray-800 text-[11px]">{latestDigiflazz.buyer_sku_code || '-'}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">Provider Status:</span>
                      <span className="font-mono font-bold text-gray-900 text-[11px]">{latestDigiflazz.digiflazz_status || '-'}</span>
                    </div>
                    {latestDigiflazz.sn && (
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-400 block text-[10px]">Serial Number (SN)</span>
                        <span className="font-mono text-gray-700 text-[11px] block mt-0.5">{latestDigiflazz.sn}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-400">
                    Tidak ada catatan Digiflazz untuk transaksi ini.
                  </div>
                )}
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
                  <span className="text-gray-400">Saldo Saat Ini:</span>
                  <span className="font-bold text-gray-900">
                    Rp {Number(trxUser?.wallet?.balance || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                {relatedMutations.length > 0 ? (
                  relatedMutations.map((m: any) => (
                    <div key={m.id} className="flex justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-400">{m.type === 'credit' ? 'Kredit:' : 'Debit:'}</span>
                      <span className={`font-bold font-mono ${m.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.type === 'credit' ? '+' : '-'}Rp {Number(m.amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-400">
                    Tidak ditemukan mutasi dompet yang terkait langsung dengan transaksi ini.
                  </div>
                )}
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
              {activityLogs.length > 0 ? (
                activityLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 hover:bg-gray-800/80 p-1 rounded transition">
                    <span className="text-gray-500 whitespace-nowrap">{log.created_at || '-'}</span>
                    <span className="font-bold whitespace-nowrap text-blue-400">[{log.activity || 'LOG'}]</span>
                    <span className="text-gray-400">
                      {log.payload ? JSON.stringify(log.payload) : '-'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">Tidak ada log aktivitas untuk pengguna transaksi ini.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
