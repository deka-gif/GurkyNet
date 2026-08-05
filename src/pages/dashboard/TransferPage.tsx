import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Wallet,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';

export const TransferPage = () => {
  const { wallet, fetchWallet } = useWalletStore();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [transferType, setTransferType] = useState<'bank' | 'p2p'>('bank');
  const [selectedBank, setSelectedBank] = useState('BCA');
  const [accountNo, setAccountNo] = useState('');
  const [receiverName, setReceiverName] = useState<string | null>(null);
  
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'bifast' | 'online'>('bifast'); // bifast = 2500, online = 6500
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);

  // Status indicators
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleVerifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNo) {
      setErrorMsg('Mohon isi nomor rekening tujuan.');
      return;
    }

    setCheckingAccount(true);
    setErrorMsg(null);

    // Real account-holder name lookup is not available; show only the
    // user-entered destination instead of fabricating a receiver name.
    setReceiverName(
      transferType === 'bank' ? `${selectedBank} - ${accountNo}` : `GurkyPay - ${accountNo}`
    );

    setCheckingAccount(false);
    setStep(2);
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 10000) {
      setErrorMsg('Minimal transfer dana adalah Rp 10.000');
      return;
    }

    const fee = transferType === 'bank' ? (method === 'bifast' ? 2500 : 6500) : 0;
    if (!wallet || wallet.balance < parsedAmount + fee) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk nominal transfer ditambah biaya admin.');
      return;
    }

    setErrorMsg(null);
    setCheckoutData({
      serviceName: 'Transfer Saldo',
      productName: transferType === 'bank' ? `Transfer ke Bank ${selectedBank}` : 'Transfer Peer-to-Peer',
      targetNo: accountNo,
      amount: parsedAmount,
      adminFee: fee,
      customDetails: {
        'Rekening Tujuan': receiverName || accountNo,
        'Tipe Transfer': transferType === 'bank' ? `Transfer Bank (${selectedBank})` : 'Peer-to-Peer (GurkyPay)',
        'Metode Transfer': transferType === 'bank' ? (method === 'bifast' ? 'BI-Fast' : 'Online Transfer') : 'Instan',
        'Catatan': note || '-'
      }
    });
  };

  const feeAmount = transferType === 'bank' ? (method === 'bifast' ? 2500 : 6500) : 0;
  const grandTotal = parseInt(amount) ? parseInt(amount) + feeAmount : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-2xl" id="transfer-page-root">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Kirim Uang</h2>
          <p className="text-sm text-gray-500">Kirim dana domestik secara kilat menggunakan jaringan BI-FAST.</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2 shrink-0">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Alert states */}
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
              <h5 className="font-bold text-emerald-900 text-sm">Dana Terkirim!</h5>
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
              <h5 className="font-bold text-red-900 text-sm">Gagal Mengirimkan</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Multi-step Indicator */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between text-xs font-extrabold text-gray-400">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : ''}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] ${step >= 1 ? 'bg-primary-50 border-primary-600' : 'bg-gray-50 border-gray-200'}`}>1</span>
          <span>Tujuan</span>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-200" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : ''}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] ${step >= 2 ? 'bg-primary-50 border-primary-600' : 'bg-gray-50 border-gray-200'}`}>2</span>
          <span>Nominal</span>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-200" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary-600' : ''}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] ${step >= 3 ? 'bg-primary-50 border-primary-600' : 'bg-gray-50 border-gray-200'}`}>3</span>
          <span>Otorisasi PIN</span>
        </div>
      </div>

      {/* Workspace content card */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
        
        {/* STEP 1: Input Account/Bank Details */}
        {step === 1 && (
          <form onSubmit={handleVerifyAccount} className="space-y-6">
            <div className="space-y-3">
              <h4 className="font-extrabold text-gray-900 text-base">Atur Tujuan Transfer</h4>
              <p className="text-xs text-gray-500">Pilih tipe penerimaan Anda. Jaringan transfer antar-bank berlaku biaya admin terendah.</p>
            </div>

            {/* Transfer type selector */}
            <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-200/60">
              <button
                type="button"
                onClick={() => setTransferType('bank')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'bank' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Rekening Bank
              </button>
              <button
                type="button"
                onClick={() => setTransferType('p2p')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'p2p' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Sesama GurkyPay (P2P)
              </button>
            </div>

            {transferType === 'bank' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Pilih Bank Penerima</label>
                <select 
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                >
                  <option value="BCA">BCA (Bank Central Asia)</option>
                  <option value="MANDIRI">Bank Mandiri</option>
                  <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                  <option value="BNI">Bank Negara Indonesia (BNI)</option>
                  <option value="CIMB">CIMB Niaga</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
                {transferType === 'bank' ? 'Nomor Rekening Penerima' : 'ID Wallet / Nomor HP Penerima'}
              </label>
              <div className="relative">
                {transferType === 'bank' ? <Building2 className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" /> : <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />}
                <input 
                  type="text"
                  placeholder={transferType === 'bank' ? 'Contoh: 14028394819' : 'Contoh: GK-081234567890'}
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={checkingAccount}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
            >
              {checkingAccount ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memeriksa Akun...</span>
                </>
              ) : (
                <>
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Input Amount and details */}
        {step === 2 && (
          <form onSubmit={handleDetailsSubmit} className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Rekening Tujuan</span>
                <h5 className="font-extrabold text-gray-900 text-sm mt-0.5">{receiverName}</h5>
              </div>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="text-xs font-bold text-gray-400 hover:text-primary-600"
              >
                Ubah Tujuan
              </button>
            </div>

            {/* Nominal input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Masukkan Jumlah Transfer</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
                <input 
                  type="number"
                  placeholder="Minimal Rp 10.000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Bank Transfer Speed Options */}
            {transferType === 'bank' && (
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700">Metode Pengiriman</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div 
                    onClick={() => setMethod('bifast')}
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${method === 'bifast' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${method === 'bifast' ? 'text-primary-600' : 'text-gray-300'}`} />
                    <div>
                      <h6 className="font-extrabold text-gray-900 text-xs">BI-FAST Instan</h6>
                      <p className="text-[10px] text-gray-500 mt-0.5">Biaya: Rp 2.500 (Direkomendasikan)</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => setMethod('online')}
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${method === 'online' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Clock className={`w-5 h-5 shrink-0 ${method === 'online' ? 'text-primary-600' : 'text-gray-300'}`} />
                    <div>
                      <h6 className="font-extrabold text-gray-900 text-xs">Online Real-time</h6>
                      <p className="text-[10px] text-gray-500 mt-0.5">Biaya: Rp 6.500 (Semua Bank)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Note Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Catatan Transfer (Opsional)</label>
              <input 
                type="text"
                placeholder="Contoh: Pembayaran Invoice, Patungan, Arisan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
              />
            </div>

            {/* Review Box */}
            <div className="p-4 bg-gray-50 rounded-2xl space-y-2.5 text-xs font-bold text-gray-500">
              <div className="flex justify-between">
                <span>Jumlah Kiriman</span>
                <span className="text-gray-900">{amount ? formatIDR(parseInt(amount)) : 'Rp 0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Admin</span>
                <span className="text-gray-900">{formatIDR(feeAmount)}</span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2.5 flex justify-between text-sm text-primary-600 font-black">
                <span>Total Pemotongan Saldo</span>
                <span>{formatIDR(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
            >
              <span>Lanjutkan Ke Konfirmasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          onClose={() => setCheckoutData(null)}
          onSuccess={() => {
            setStep(1);
            setAccountNo('');
            setAmount('');
            setNote('');
            setReceiverName(null);
            setCheckoutData(null);
          }}
        />
      )}

    </div>
  );
};
