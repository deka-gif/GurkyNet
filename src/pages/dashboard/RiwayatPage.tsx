import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Download,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { useTransactionStore } from '../../store/transaction.store';
import { transactionService } from '../../services/transaction/transaction.service';
import { formatIDR } from '../../utils/currency';
import {
  isFailedStatus,
  isPendingStatus,
  isSuccessStatus,
  normalizeTransactionStatus,
  transactionStatusLabel,
} from '../../utils/transactionStatus';
import {
  formatTransactionDateTime,
  formatHistoryTarget,
} from '../../utils/transactionDisplay';

export const RiwayatPage = () => {
  const navigate = useNavigate();
  const { transactions, loading, error, fetchTransactions } = useTransactionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedNominalRange, setSelectedNominalRange] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>('');

  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [receiptCode, setReceiptCode] = useState<{ label: string; code: string; url?: string | null } | null>(null);
  const [receiptTargetDisplay, setReceiptTargetDisplay] = useState<string | null>(null);

  useEffect(() => {
    console.log('HISTORY RENDER — mount fetch');
    void fetchTransactions();
  }, [fetchTransactions]);

  // Keep history live while any row is still pending (VIP settle path).
  useEffect(() => {
    const hasPending = transactions.some((tx) => isPendingStatus(tx.status));
    if (!hasPending) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void fetchTransactions();
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [transactions, fetchTransactions]);

  // Refetch when tab becomes visible again (no full browser refresh needed).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('HISTORY FETCH — visibility');
        void fetchTransactions();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchTransactions]);

  useEffect(() => {
    console.log('HISTORY RENDER', {
      count: transactions.length,
      statuses: transactions.slice(0, 5).map((t) => ({
        code: t.transactionCode,
        status: t.status,
        label: transactionStatusLabel(t.status, {
          serviceName: t.serviceName,
          paymentMethod: t.paymentMethod,
          statusRaw: t.statusRaw,
        }),
      })),
    });
  }, [transactions]);

  // Keep receipt modal in sync with store updates (pending → success).
  useEffect(() => {
    if (!selectedTx) return;
    const fresh = transactions.find(
      (t) =>
        String(t.id) === String(selectedTx.id) ||
        t.transactionCode === selectedTx.transactionCode
    );
    if (fresh && fresh.status !== selectedTx.status) {
      setSelectedTx(fresh);
    }
  }, [transactions, selectedTx]);

  useEffect(() => {
    if (!selectedTx) {
      setReceiptCode(null);
      setReceiptTargetDisplay(null);
      return;
    }
    let cancelled = false;
    const key = selectedTx.id || selectedTx.invoice_number || selectedTx.transactionCode;
    if (!key) return;
    transactionService
      .getReceipt(String(key))
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const d = res.data.transaction_details || {};
        setReceiptTargetDisplay(
          typeof d.langganan_target_display === 'string' ? d.langganan_target_display : null
        );
        if (d.voucher_code) {
          setReceiptCode({ label: 'Kode Voucher', code: d.voucher_code, url: d.voucher_url });
        } else if (d.activation_code) {
          setReceiptCode({ label: 'Kode Aktivasi', code: d.activation_code, url: d.activation_url });
        } else if (d.voucher_internet_code) {
          setReceiptCode({ label: 'Kode Voucher Internet', code: d.voucher_internet_code, url: d.voucher_internet_url });
        } else {
          setReceiptCode(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReceiptCode(null);
          setReceiptTargetDisplay(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTx]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  

  const filteredTransactions = transactions.filter((tx) => {
    const matchSearch =
      String(tx.transactionCode ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(tx.serviceName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(tx.productName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.targetNo.includes(searchQuery);

    const matchStatus =
      selectedStatus === 'all' || normalizeTransactionStatus(tx.status) === selectedStatus;

    const matchCategory =
      selectedCategory === 'all' ||
      String(tx.serviceName ?? '').toLowerCase().includes(selectedCategory.toLowerCase());

    let matchNominal = true;
    if (selectedNominalRange === 'under-50k') {
      matchNominal = tx.amount < 50000;
    } else if (selectedNominalRange === '50k-200k') {
      matchNominal = tx.amount >= 50000 && tx.amount <= 200000;
    } else if (selectedNominalRange === 'over-200k') {
      matchNominal = tx.amount > 200000;
    }

    let matchPeriod = true;
    if (customDate) {
      matchPeriod = tx.date.startsWith(customDate);
    } else if (selectedPeriod === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      matchPeriod = tx.date.startsWith(today);
    } else if (selectedPeriod === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      matchPeriod = new Date(tx.date) >= oneWeekAgo;
    } else if (selectedPeriod === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      matchPeriod = new Date(tx.date) >= oneMonthAgo;
    }

    return matchSearch && matchStatus && matchCategory && matchNominal && matchPeriod;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="riwayat-page-root">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight font-sans">
            Riwayat Transaksi
          </h2>
          <p className="text-sm text-gray-500">
            Cari, filter, dan unduh struk transaksi PPOB dan mutasi saldo Anda.
          </p>
        </div>
        <button
          onClick={() => void fetchTransactions()}
          className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-100 hover:border-primary-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Riwayat</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xl shadow-gray-200/20 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari transaksi, no. HP, atau kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
            />
          </div>

          <div className="md:col-span-4 flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'today', label: 'Hari Ini' },
              { key: 'week', label: 'Minggu' },
              { key: 'month', label: 'Bulan' },
            ].map((pd) => (
              <button
                key={pd.key}
                disabled={!!customDate}
                onClick={() => setSelectedPeriod(pd.key as any)}
                className={`flex-1 py-2 rounded-xl text-[10px] md:text-xs font-black transition-all ${
                  customDate
                    ? 'text-gray-300 cursor-not-allowed'
                    : selectedPeriod === pd.key
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {pd.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-gray-700"
            >
              <option value="all">Semua Status</option>
              <option value="success">Sukses</option>
              <option value="pending">Pending</option>
              <option value="failed">Gagal</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
              Kategori Layanan
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-gray-700"
            >
              <option value="all">Semua Layanan</option>
              <option value="pulsa">Pulsa Seluler</option>
              <option value="paket data">Paket Data</option>
              <option value="token pln">Token Listrik PLN</option>
              <option value="voucher">Voucher Game & Belanja</option>
              <option value="langganan">Langganan Digital</option>
              <option value="transfer">Transfer Saldo</option>
              <option value="tagihan">Tagihan Bulanan</option>
              <option value="top up">Top Up Saldo</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
              Rentang Nominal
            </label>
            <select
              value={selectedNominalRange}
              onChange={(e) => setSelectedNominalRange(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-gray-700"
            >
              <option value="all">Semua Nominal</option>
              <option value="under-50k">Di bawah Rp 50.000</option>
              <option value="50k-200k">Rp 50.000 - Rp 200.000</option>
              <option value="over-200k">Di atas Rp 200.000</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                Cari Tanggal Spesifik
              </label>
              {customDate && (
                <button
                  onClick={() => setCustomDate('')}
                  className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-wide"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-gray-700"
            />
          </div>
        </div>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
          <h5 className="font-extrabold text-gray-700 text-sm">Menyelaraskan Transaksi...</h5>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 space-y-3">
          <History className="w-10 h-10 text-gray-300 mx-auto" />
          <h5 className="font-extrabold text-gray-700 text-sm">Tidak Ada Riwayat</h5>
          <p className="text-xs text-gray-400">
            Tidak ada data transaksi yang cocok dengan filter atau kata pencarian Anda.
          </p>
          {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => {
            const success = isSuccessStatus(tx.status);
            const pending = isPendingStatus(tx.status);
            const failed = isFailedStatus(tx.status);
            const label = transactionStatusLabel(tx.status, {
              serviceName: tx.serviceName,
              paymentMethod: tx.paymentMethod,
              statusRaw: tx.statusRaw,
            });

            return (
              <div
                key={tx.id}
                onClick={() => navigate(`/dashboard/riwayat/${encodeURIComponent(String(tx.id || tx.transactionCode))}`)}
                className="bg-white rounded-3xl p-5 border border-gray-100 hover:border-primary-100 shadow-xl shadow-gray-200/10 cursor-pointer transition-all flex flex-col md:flex-row justify-between md:items-center gap-4 group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      success
                        ? 'bg-emerald-50 text-emerald-600'
                        : pending
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {tx.serviceName.includes('Top Up') ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                        {tx.serviceName}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-[10px] text-gray-500 font-bold tracking-wider">
                        {tx.transactionCode}
                      </span>
                    </div>
                    <h4 className="font-black text-gray-900 text-sm leading-tight mt-1 group-hover:text-primary-600 transition-colors">
                      {tx.productName}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Tujuan:{' '}
                      {formatHistoryTarget(tx.targetNo, {
                        langgananTargetDisplay: null,
                        serviceName: tx.serviceName,
                      })}{' '}
                      • {formatTransactionDateTime(tx.date)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between md:justify-end items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-gray-50">
                  <span className="text-base font-black text-gray-900">{formatIDR(tx.amount)}</span>

                  <span
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 ${
                      success
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : pending
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                    }`}
                  >
                    {success && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {pending && <Clock className="w-3 h-3 text-amber-600 animate-pulse" />}
                    {failed && <XCircle className="w-3 h-3 text-red-600" />}
                    <span>{label}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 border border-gray-100 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedTx(null)}
                className="absolute right-4 top-4 p-1.5 rounded-full bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-gray-900 text-sm tracking-wide uppercase">
                  Struk Transaksi Resmi
                </h4>
                <p className="text-[10px] text-gray-400">
                  Dicetak melalui portal pintar GurkyNet secara digital.
                </p>
              </div>

              <div className="border-t border-dashed border-gray-200/80 pt-4 space-y-4">
                <div className="text-center py-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Total Transaksi</span>
                  <h3 className="text-2xl font-black text-primary-600 mt-1">
                    {formatIDR(selectedTx.amount)}
                  </h3>
                </div>

                <div className="space-y-3.5 text-xs font-bold text-gray-500 px-1">
                  <div className="flex justify-between">
                    <span>Kode Transaksi</span>
                    <span className="text-gray-900 flex items-center gap-1.5">
                      <span>{selectedTx.transactionCode}</span>
                      <button
                        onClick={() => handleCopyCode(selectedTx.transactionCode)}
                        className="p-1 hover:bg-gray-50 rounded text-gray-400 hover:text-primary-600 transition-all"
                      >
                        {copiedId === selectedTx.transactionCode ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Tanggal & Waktu</span>
                    <span className="text-gray-900">
                      {new Date(selectedTx.date).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Kategori Layanan</span>
                    <span className="text-gray-900">{selectedTx.serviceName}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Nama Produk</span>
                    <span className="text-gray-900">{selectedTx.productName}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Data Tujuan</span>
                    <span className="text-gray-900 text-right break-all max-w-[60%]">
                      {formatHistoryTarget(selectedTx.targetNo, {
                        langgananTargetDisplay: receiptTargetDisplay,
                        serviceName: selectedTx.serviceName,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Status Transaksi</span>
                    <span className="text-gray-900 font-extrabold uppercase text-[10px] tracking-wide">
                      {transactionStatusLabel(selectedTx.status, {
                        serviceName: selectedTx.serviceName,
                        paymentMethod: selectedTx.paymentMethod,
                        statusRaw: selectedTx.statusRaw,
                      })}
                    </span>
                  </div>

                  {receiptCode && (
                    <div className="border-t border-gray-50 pt-3 flex flex-col gap-2">
                      <span className="text-[10px] text-gray-400 uppercase">{receiptCode.label}</span>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-gray-900 text-sm leading-relaxed break-all bg-primary-50/50 p-3 rounded-2xl border border-primary-100 font-mono font-black tracking-wide">
                          {receiptCode.code}
                        </p>
                        <button
                          onClick={() => handleCopyCode(receiptCode.code)}
                          className="p-3 rounded-2xl border border-primary-100 bg-primary-50 hover:bg-primary-100 text-primary-700 transition-all shrink-0"
                        >
                          {copiedId === receiptCode.code ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {receiptCode.url && (
                        <a
                          href={receiptCode.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-primary-600 underline break-all"
                        >
                          Buka Link Voucher
                        </a>
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-50 pt-3 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 uppercase">Keterangan / Serial Number</span>
                    <p className="text-gray-900 text-[11px] leading-relaxed break-all bg-gray-50 p-3 rounded-2xl border border-gray-100 font-mono tracking-tight font-medium">
                      {selectedTx.note ||
                        selectedTx.notes ||
                        'Transaksi diproses dengan sukses oleh mitra provider.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={async () => {
                    try {
                      const key = selectedTx.id || selectedTx.invoice_number || selectedTx.transactionCode;
                      await transactionService.downloadReceiptPdf(String(key));
                    } catch {
                      alert('Gagal mengunduh struk PDF. Pastikan transaksi milik Anda.');
                    }
                  }}
                  className="flex-1 py-3 border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 py-3 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all"
                >
                  Tutup Struk
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
