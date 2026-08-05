import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  QrCode, 
  Smartphone, 
  CreditCard,
  History,
  Coins,
  ShieldCheck,
  Send
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useTransactionStore } from '../../store/transaction.store';

declare global {
  interface Window {
    snap: any;
  }
}

export const WalletPage = () => {
  const { wallet, loading, fetchWallet, topUp, transfer, withdraw } = useWalletStore();
  const { transactions, fetchTransactions } = useTransactionStore();

  const [activeTab, setActiveTab] = useState<'index' | 'topup' | 'transfer' | 'withdraw'>('index');
  
  // States for Top Up
  const [topupAmount, setTopupAmount] = useState<string>('');
  const [topupMethod, setTopupMethod] = useState<string>('qris');
  
  // States for Transfer
  const [transferType, setTransferType] = useState<'bank' | 'p2p'>('bank');
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('BCA');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');

  // States for Withdraw
  const [withdrawBank, setWithdrawBank] = useState<string>('BCA');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawPin, setWithdrawPin] = useState<string>('');

  // Status Modals
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [fetchWallet, fetchTransactions]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(topupAmount);
    if (isNaN(amount) || amount < 10000) {
      setErrorMsg('Minimal top up adalah Rp 10.000');
      return;
    }

    const res = await topUp(amount, topupMethod);
    if (res && res.snap_token) {
      window.snap.pay(res.snap_token, {
        onSuccess: function (result: any) {
          fetchWallet();
          setSuccessMsg(`Top Up berhasil! Saldo Anda otomatis ditambahkan sebesar ${formatIDR(amount)}.`);
          setTopupAmount('');
          setActiveTab('index');
        },
        onPending: function (result: any) {
          fetchWallet();
          setSuccessMsg(`Top up sedang diproses. Silakan selesaikan pembayaran Anda.`);
          setTopupAmount('');
          setActiveTab('index');
        },
        onError: function (result: any) {
          setErrorMsg('Pembayaran gagal atau dibatalkan.');
        },
        onClose: function () {
          setErrorMsg('Anda menutup pop-up pembayaran sebelum menyelesaikan transaksi.');
        }
      });
    } else if (res) {
       // fallback for simulations or if snap_token is missing but res is returned
       setSuccessMsg(`Top Up diajukan. Saldo Anda akan bertambah jika sukses.`);
       setTopupAmount('');
       setActiveTab('index');
    } else {
      setErrorMsg('Gagal melakukan top up. Silakan coba lagi.');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(transferAmount);
    if (isNaN(amount) || amount < 10000) {
      setErrorMsg('Minimal transfer adalah Rp 10.000');
      return;
    }

    if (!wallet || wallet.balance < amount) {
      setErrorMsg('Saldo dompet Anda tidak mencukupi.');
      return;
    }

    if (!targetAccount) {
      setErrorMsg('Mohon isi nomor rekening atau wallet ID tujuan.');
      return;
    }

    const res = await transfer(targetAccount, amount);
    if (res) {
      const destination = transferType === 'bank' ? `${selectedBank} - ${targetAccount}` : targetAccount;
      
      fetchWallet();
      fetchTransactions();
      
      setSuccessMsg(`Transfer sebesar ${formatIDR(amount)} berhasil diproses ke ${destination}.`);
      setTransferAmount('');
      setTargetAccount('');
      setTransferNote('');
      setActiveTab('index');
    } else {
      setErrorMsg('Gagal memproses transfer. Pastikan wallet ID tujuan valid dan saldo mencukupi.');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount < 10000) {
      setErrorMsg('Minimal penarikan adalah Rp 10.000');
      return;
    }
    if (!withdrawAccount.trim()) {
      setErrorMsg('Nomor rekening wajib diisi.');
      return;
    }
    if (!/^\d{6}$/.test(withdrawPin)) {
      setErrorMsg('PIN transaksi harus 6 digit angka.');
      return;
    }

    const res = await withdraw({
      amount,
      pin: withdrawPin,
      bank_name: withdrawBank,
      account_number: withdrawAccount.trim(),
      admin_fee: 5000,
    });

    if (res) {
      setSuccessMsg(`Penarikan ${formatIDR(amount)} ke ${withdrawBank} ${withdrawAccount} sedang diproses.`);
      setWithdrawAmount('');
      setWithdrawAccount('');
      setWithdrawPin('');
      setActiveTab('index');
      fetchTransactions();
    } else {
      setErrorMsg('Gagal memproses penarikan. Periksa PIN, saldo, dan nomor rekening.');
    }
  };

  // Filter out only wallet/transfer/tarik transactions for history widget
  const walletHistory = transactions.filter(t => 
    t.serviceName.includes('Wallet') || 
    t.serviceName.includes('Transfer') || 
    t.serviceName.includes('Tarik') ||
    t.serviceName.includes('Top Up')
  );

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="wallet-page-root">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Manajemen Dompet</h2>
          <p className="text-sm text-gray-500">Kelola saldo GurkyPay, transfer bank, dan riwayat mutasi keuangan Anda secara real-time.</p>
        </div>
        <button 
          onClick={() => { fetchWallet(); fetchTransactions(); }}
          className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-100 hover:border-primary-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Success and Error Banners */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3.5"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-emerald-900 text-sm">Aksi Berhasil!</h5>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500 hover:text-emerald-800">Tutup</button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3.5"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-red-900 text-sm">Terjadi Kesalahan</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid containing Wallet Card & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Wallet details & quick menu tabs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Balance Card */}
          <div className="bg-gradient-to-br from-primary-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/10 border border-primary-500/20 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/5 blur-xl pointer-events-none" />
            <div className="absolute right-6 top-6 opacity-15">
              <Wallet className="w-20 h-20" />
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-primary-200 tracking-wide uppercase">Saldo Aktif GurkyPay</p>
                <h3 className="text-3xl font-black tracking-tight mt-1.5">
                  {wallet ? formatIDR(wallet.balance) : 'Rp 0'}
                </h3>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between text-xs text-primary-100 font-bold">
              <div>
                <p className="text-[10px] text-primary-300 uppercase">Nomor Wallet ID</p>
                <p className="mt-0.5 tracking-wider">{wallet?.walletNo || 'GK-XXXXXXXX'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-primary-300 uppercase">Poin Reward</p>
                <p className="mt-0.5 flex items-center gap-1 justify-end text-yellow-300">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{wallet?.points || 0} Poin</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Tabs Container */}
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-1">
            <h5 className="font-extrabold text-gray-900 text-xs px-3 mb-3 tracking-wider uppercase text-gray-400">Pilih Layanan</h5>
            
            <button 
              onClick={() => setActiveTab('index')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'index' ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Wallet className="w-5 h-5 shrink-0" />
              <span>Beranda Wallet</span>
            </button>

            <button 
              onClick={() => setActiveTab('topup')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'topup' ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <ArrowDownLeft className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Isi Saldo / Top Up</span>
            </button>

            <button 
              onClick={() => setActiveTab('transfer')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'transfer' ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <ArrowUpRight className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>Kirim Uang / Transfer</span>
            </button>

            <button 
              onClick={() => setActiveTab('withdraw')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'withdraw' ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Tarik Tunai / Withdraw</span>
            </button>
          </div>

          {/* Secure Badging */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/60 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary-600 shrink-0" />
            <div>
              <h6 className="font-extrabold text-gray-900 text-xs">GurkyPay Secure Protection</h6>
              <p className="text-[10px] text-gray-500">Seluruh lalu lintas transaksi dikawal enkripsi SSL 256-bit berstandar Bank Indonesia.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Active Workspace Action Form */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            
            {/* TABS 1: Beranda Wallet Index */}
            {activeTab === 'index' && (
              <motion.div 
                key="index"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Informasi & Aktivitas</h4>
                  <p className="text-xs text-gray-500 mt-1">Gunakan tab sebelah kiri untuk melakukan transaksi seperti pengisian saldo, transfer bank, atau penarikan dana.</p>
                </div>

                {/* Dashboard stats mini widget */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/50">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Pemasukan Bulan Ini</span>
                    <h5 className="text-lg font-black text-emerald-900 mt-1">Rp 1.450.000</h5>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Pengeluaran Bulan Ini</span>
                    <h5 className="text-lg font-black text-indigo-900 mt-1">Rp 650.000</h5>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/50 col-span-2 md:col-span-1">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Tingkat Cashback</span>
                    <h5 className="text-lg font-black text-amber-900 mt-1">2.4% Average</h5>
                  </div>
                </div>

                {/* Wallet mutasi list */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="font-extrabold text-gray-900 text-sm">Riwayat Mutasi Saldo</h5>
                    <span className="text-xs text-gray-400">Pencatatan Keuangan</span>
                  </div>

                  {walletHistory.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-gray-200 rounded-3xl space-y-2">
                      <History className="w-8 h-8 text-gray-300 mx-auto" />
                      <h6 className="font-bold text-gray-700 text-sm">Belum Ada Riwayat Mutasi</h6>
                      <p className="text-xs text-gray-400">Mutasi saldo Anda dari pengisian, transfer, atau tarik tunai akan terdaftar di sini.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(walletHistory) ? walletHistory : []).slice(0, 5).map((trx) => (
                        <div key={trx.id} className="p-4 rounded-2xl border border-gray-100 hover:border-gray-200 flex items-center justify-between transition-all">
                          <div className="flex items-center gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              trx.serviceName.includes('Top Up') || trx.productName.includes('Top Up')
                                ? 'bg-emerald-50 text-emerald-600'
                                : trx.serviceName.includes('Tarik')
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              {trx.serviceName.includes('Top Up') ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-xs font-black text-gray-900">{trx.productName}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{trx.transactionCode} • {new Date(trx.date).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-black ${
                              trx.serviceName.includes('Top Up') ? 'text-emerald-600' : 'text-gray-900'
                            }`}>
                              {trx.serviceName.includes('Top Up') ? '+' : '-'}{formatIDR(trx.amount)}
                            </p>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase mt-1 bg-emerald-100 text-emerald-800">
                              {trx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TABS 2: Top Up Form */}
            {activeTab === 'topup' && (
              <motion.div 
                key="topup"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Top Up Saldo GurkyPay</h4>
                  <p className="text-xs text-gray-500 mt-1">Tambahkan saldo dompet instan Anda. Pembayaran instan via QRIS akan langsung mengkredit saldo Anda secara otomatis.</p>
                </div>

                <form onSubmit={handleTopupSubmit} className="space-y-6">
                  {/* Select Preset Amount */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-gray-700">Pilih Nominal Cepat</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['50000', '100000', '250000', '500000'].map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => setTopupAmount(amt)}
                          className={`py-3 px-4 rounded-xl border font-bold text-xs transition-all ${topupAmount === amt ? 'bg-primary-600 border-primary-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-primary-400'}`}
                        >
                          {formatIDR(parseInt(amt))}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Atau Masukkan Nominal Manual</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
                      <input 
                        type="number"
                        placeholder="Minimal Rp 10.000"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Payment Method Option */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-gray-700">Metode Pembayaran</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div 
                        onClick={() => setTopupMethod('qris')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'qris' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <QrCode className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">QRIS Instan</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Bebas biaya admin</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setTopupMethod('va')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'va' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Building2 className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">Virtual Account</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">BCA, Mandiri, BRI (+1.5k)</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setTopupMethod('retail')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'retail' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Smartphone className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">Alfa / Indomaret</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Biaya admin Rp 2.500</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Konfirmasi & Bayar Sekarang</span>
                  </button>
                </form>
              </motion.div>
            )}

            {/* TABS 3: Transfer Form */}
            {activeTab === 'transfer' && (
              <motion.div 
                key="transfer"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Transfer Uang</h4>
                  <p className="text-xs text-gray-500 mt-1">Kirim uang langsung ke rekening bank se-Indonesia atau ke sesama pengguna GurkyNet secara instan.</p>
                </div>

                {/* Transfer Type Selectors */}
                <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-200/60">
                  <button
                    onClick={() => setTransferType('bank')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'bank' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    Kirim ke Rekening Bank
                  </button>
                  <button
                    onClick={() => setTransferType('p2p')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'p2p' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    Transfer Sesama GurkyPay
                  </button>
                </div>

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  {/* Bank Select (if bank) */}
                  {transferType === 'bank' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">Pilih Bank Tujuan</label>
                      <select 
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                      >
                        <option value="BCA">Bank Central Asia (BCA)</option>
                        <option value="MANDIRI">Bank Mandiri</option>
                        <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                        <option value="BNI">Bank Negara Indonesia (BNI)</option>
                        <option value="CIMB">CIMB Niaga</option>
                      </select>
                    </div>
                  )}

                  {/* Target Account Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {transferType === 'bank' ? 'Nomor Rekening Tujuan' : 'Nomor Handphone / ID Wallet Tujuan'}
                    </label>
                    <input 
                      type="text"
                      placeholder={transferType === 'bank' ? 'Contoh: 84019234812' : 'Contoh: GK-081234567890'}
                      value={targetAccount}
                      onChange={(e) => setTargetAccount(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Nominal Transfer</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
                      <input 
                        type="number"
                        placeholder="Minimal Rp 10.000"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Catatan Transfer (Opsional)</label>
                    <input 
                      type="text"
                      placeholder="Contoh: Bayar Uang Makan, Arisan, dll."
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Warning balance */}
                  <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <p className="text-[10px] text-indigo-700 leading-tight">Pastikan nomor rekening dan nominal transfer Anda sudah benar sebelum menekan tombol kirim.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Kirim Transfer Sekarang</span>
                  </button>
                </form>
              </motion.div>
            )}

            {/* TABS 4: Withdraw Form */}
            {activeTab === 'withdraw' && (
              <motion.div 
                key="withdraw"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Penarikan Dana / Withdraw</h4>
                  <p className="text-xs text-gray-500 mt-1">Cairkan saldo GurkyPay Anda langsung ke rekening bank lokal terverifikasi. Biaya penarikan tetap flat Rp 5.000 per transaksi.</p>
                </div>

                <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                  {/* Bank Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Bank Penampung Penarikan</label>
                    <select 
                      value={withdrawBank}
                      onChange={(e) => setWithdrawBank(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    >
                      <option value="BCA">BCA (Bank Central Asia)</option>
                      <option value="MANDIRI">MANDIRI</option>
                      <option value="BRI">BRI</option>
                      <option value="BNI">BNI</option>
                    </select>
                  </div>

                  {/* Account Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Nomor Rekening Anda</label>
                    <input 
                      type="text"
                      placeholder="Masukkan nomor rekening tujuan pencairan"
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Nominal Withdraw */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Nominal Penarikan</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
                      <input 
                        type="number"
                        placeholder="Minimal Rp 10.000"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">PIN Transaksi</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 digit PIN"
                      value={withdrawPin}
                      onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-widest"
                    />
                  </div>

                  <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1.5">
                    <h6 className="font-extrabold text-amber-800 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Syarat & Ketentuan Penarikan</span>
                    </h6>
                    <ul className="list-disc list-inside text-[10px] text-amber-700 space-y-0.5 ml-1 leading-normal">
                      <li>Batas penarikan harian maksimal Rp 10.000.000.</li>
                      <li>Proses pencairan dana memakan waktu 1-3 jam di hari kerja.</li>
                      <li>Biaya flat Rp 5.000 dipotong dari sisa saldo dompet Anda.</li>
                    </ul>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Tarik Dana Sekarang</span>
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
};
