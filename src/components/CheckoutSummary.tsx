import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Download, 
  Share2, 
  Printer, 
  X, 
  ArrowRight, 
  Lock, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  QrCode,
  Copy
} from 'lucide-react';
import { useWalletStore } from '../store/wallet.store';
import { useTransactionStore } from '../store/transaction.store';
import { transactionService } from '../services/transaction/transaction.service';

// Dynamic transaction properties
export interface CheckoutData {
  serviceName: string; // e.g. 'Pulsa', 'Paket Data', 'Token PLN', 'Voucher', 'Transfer Saldo', 'Tagihan', 'Voucher Game', 'E-Wallet'
  productName: string;
  targetNo: string;
  amount: number;
  adminFee: number;
  skuCode?: string;
  customDetails?: Record<string, string | number>;
}

interface CheckoutSummaryProps {
  data: CheckoutData;
  onClose: () => void;
  onSuccess?: (transaction: any) => void;
}

type CheckoutStep = 'SUMMARY' | 'CONFIRM' | 'PIN' | 'LOADING' | 'RESULT';

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ data, onClose, onSuccess }) => {
  const { wallet, deductBalance, fetchWallet } = useWalletStore();
  const { createTransaction } = useTransactionStore();

  const [step, setStep] = useState<CheckoutStep>('SUMMARY');
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('Memproses Transaksi...');
  const [finalStatus, setFinalStatus] = useState<'sukses' | 'success' | 'pending' | 'gagal'>('sukses');
  const [createdTrx, setCreatedTrx] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const totalPayment = data.amount + data.adminFee;
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Focus invisible input for keyboard typing on desktop
  useEffect(() => {
    if (step === 'PIN') {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 300);
    }
  }, [step]);

  // Handle PIN input key changes (virtual keypad calls this or physical keyboard does)
  const handlePinChange = (val: string) => {
    if (val.length > 6) return;
    setPin(val);
    setPinError(false);

    if (val.length === 6) {
      // Transition to loading, backend will validate the PIN
      setStep('LOADING');
      startLoadingProcess();
    }
  };

  // Keyboard events listener fallback
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      handlePinChange(pin.slice(0, -1));
    } else if (/^[0-9]$/.test(e.key)) {
      handlePinChange(pin + e.key);
    }
  };

  const startLoadingProcess = async () => {
    setLoadingProgress(50);
    setLoadingStatus('Memproses transaksi...');
    await finalizeTransaction();
    setLoadingProgress(100);
  };

  const finalizeTransaction = async () => {
    setLoadingStatus("Mengirim permintaan ke server...");
    
    const requestPayload = {
      sku_code: data.skuCode || "",
      target_number: data.targetNo,
      pin: pin,
      admin_fee: data.adminFee
    };

    const trx = await createTransaction(requestPayload);
    if (trx) {
      setCreatedTrx(trx);
      setFinalStatus(trx.status || "sukses");
      setStep("RESULT");
      
      try {
        const receiptRes = await transactionService.getReceipt(trx.id || trx.invoice_number);
        if (receiptRes.success && receiptRes.data) {
          setReceiptData(receiptRes.data);
        }
      } catch {
        // Receipt fetch handled gracefully
      }

      if (onSuccess) {
        onSuccess(trx);
      }
      fetchWallet();
    } else {
      const state = useTransactionStore.getState();
      const errorMessage = state.error || "Gagal membuat transaksi.";
      let fullMessage = errorMessage;
      if (state.validationErrors) {
        const vals = Object.values(state.validationErrors).flat().join(", ");
        if (vals) {
           fullMessage += ` - ${vals}`;
        }
      }
      if (state.errorCode) {
        fullMessage = `[${state.errorCode}] ${fullMessage}`;
      }
      setFinalStatus("gagal");
      setCreatedTrx({ invoice_number: "TRX-GAGAL", note: fullMessage });
      setStep("RESULT");
    }
  };


  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleShare = () => {
    const shareText = `Struk Pembayaran GurkyPay\nInvoice: ${createdTrx?.invoice_number || 'N/A'}\nProduk: ${data.productName}\nNominal: ${formatIDR(totalPayment)}\nStatus: ${finalStatus.toUpperCase()}`;
    if (navigator.share) {
      navigator.share({
        title: 'Struk GurkyPay',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      setCopiedText('Detail struk disalin ke papan klip!');
      setTimeout(() => setCopiedText(null), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPlaceholder = () => {
    setCopiedText('Mempersiapkan pengunduhan PDF (Mock)...');
    setTimeout(() => setCopiedText(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
      {/* Dynamic shake animation for invalid PIN */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .shake-element {
          animation: shake 0.5s ease-in-out;
        }
        @media print {
          /* Hide everything in the page except printable-receipt */
          body > * {
            display: none !important;
          }
          #printable-receipt-root {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            z-index: 999999 !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div id="printable-receipt-root" className="bg-white w-full max-w-lg rounded-3xl border border-gray-100 shadow-2xl overflow-hidden relative">
        
        {/* PROGRESS / STEP HEADER (Except during printable view or results) */}
        {step !== 'RESULT' && (
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${step === 'SUMMARY' ? 'bg-primary-600' : 'bg-gray-300'}`} />
              <span className={`w-2 h-2 rounded-full ${step === 'CONFIRM' ? 'bg-primary-600' : 'bg-gray-300'}`} />
              <span className={`w-2 h-2 rounded-full ${step === 'PIN' ? 'bg-primary-600' : 'bg-gray-300'}`} />
              <span className={`w-2 h-2 rounded-full ${step === 'LOADING' ? 'bg-primary-600' : 'bg-gray-300'}`} />
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1: SUMMARY */}
        {step === 'SUMMARY' && (
          <div className="p-6 space-y-6 no-print">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-extrabold text-gray-900">Ringkasan Pembelian</h3>
              <p className="text-xs text-gray-500">Tinjau rincian pembelian produk Anda sebelum melangkah ke konfirmasi.</p>
            </div>

            <div className="bg-primary-50/50 border border-primary-100/50 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">{data.serviceName}</span>
                <h4 className="font-extrabold text-gray-900 text-sm mt-0.5">{data.productName}</h4>
                <p className="text-xs text-gray-500 mt-1">Tujuan: {data.targetNo}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-400">Harga Dasar</span>
                <h5 className="font-extrabold text-gray-900 text-sm">{formatIDR(data.amount)}</h5>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rincian Biaya</h5>
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between text-xs text-gray-600 font-bold">
                  <span>Harga Pokok</span>
                  <span>{formatIDR(data.amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 font-bold">
                  <span>Biaya Admin</span>
                  <span>{formatIDR(data.adminFee)}</span>
                </div>
                {data.customDetails && Object.entries(data.customDetails).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs text-gray-600 font-bold">
                    <span>{key}</span>
                    <span>{val}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-gray-200 pt-2.5 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">Total Pembayaran</span>
                  <span className="text-lg font-black text-primary-600">{formatIDR(totalPayment)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 px-1 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
              <span>Harap pastikan nomor tujuan sudah benar. Transaksi yang berhasil tidak dapat dibatalkan.</span>
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3 border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => setStep('CONFIRM')}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-600/10 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRMATION */}
        {step === 'CONFIRM' && (
          <div className="p-6 space-y-6 no-print">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-extrabold text-gray-900">Konfirmasi Transaksi</h3>
              <p className="text-xs text-gray-500">Saldo GurkyPay Anda sebesar <span className="font-extrabold text-gray-800">{wallet ? formatIDR(wallet.balance) : '-'}</span> akan dipotong.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 divide-y divide-gray-150 space-y-3">
              <div className="pb-3 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Layanan</span>
                <span className="text-xs font-black text-gray-800 bg-primary-50 border border-primary-100 px-2.5 py-1 rounded-lg">{data.serviceName}</span>
              </div>
              <div className="py-3 flex justify-between items-start gap-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Produk</span>
                <span className="text-xs font-black text-gray-800 text-right">{data.productName}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">No Tujuan</span>
                <span className="text-xs font-black text-gray-800 tracking-wider">{data.targetNo}</span>
              </div>
              <div className="pt-3 flex justify-between items-center">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Jumlah Pembayaran</span>
                <span className="text-base font-black text-primary-600">{formatIDR(totalPayment)}</span>
              </div>
            </div>

            {wallet && wallet.balance < totalPayment ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-red-900 text-xs">Saldo Tidak Mencukupi</h5>
                  <p className="text-[11px] text-red-700 mt-0.5">Saldo GurkyPay Anda ({formatIDR(wallet.balance)}) kurang dari nominal tagihan ini.</p>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep('SUMMARY')}
                className="flex-1 py-3 border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Kembali
              </button>
              <button 
                disabled={wallet ? wallet.balance < totalPayment : true}
                onClick={() => setStep('PIN')}
                className={`flex-1 py-3 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  wallet && wallet.balance >= totalPayment 
                    ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/15' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Konfirmasi & Bayar</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TRANSACTION PIN */}
        {step === 'PIN' && (
          <div className="p-6 space-y-6 no-print">
            <div className="text-center space-y-2">
              <div className="w-11 h-11 bg-primary-50 rounded-full flex items-center justify-center mx-auto text-primary-600">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">PIN Transaksi</h3>
              <p className="text-xs text-gray-500">Masukkan 6 digit kode PIN GurkyPay Anda untuk memverifikasi pembayaran.</p>
            </div>

            {/* Invisible input to catch keyboard events on desktop */}
            <input 
              ref={pinInputRef}
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              className="absolute opacity-0 w-0 h-0"
            />

            {/* Dots Display */}
            <div 
              className={`flex justify-center gap-4 py-4 ${pinError ? 'shake-element' : ''}`}
              onClick={() => pinInputRef.current?.focus()}
            >
              {[...Array(6)].map((_, i) => {
                const filled = pin.length > i;
                return (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      pinError 
                        ? 'bg-red-500 border-red-500 scale-110' 
                        : filled 
                        ? 'bg-primary-600 border-primary-600 scale-105' 
                        : 'border-gray-300 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>

            {pinError && (
              <p className="text-center text-xs font-extrabold text-red-500 animate-pulse">
                PIN Salah! Silakan coba kembali. (Dummy PIN: 123456)
              </p>
            )}

            {/* Simulated Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinChange(pin + num)}
                  className="w-14 h-14 mx-auto rounded-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold text-lg flex items-center justify-center active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <button 
                onClick={() => setPin('')}
                className="w-14 h-14 mx-auto rounded-full text-gray-400 hover:text-gray-600 font-bold text-xs flex items-center justify-center"
              >
                Clear
              </button>
              <button
                onClick={() => handlePinChange(pin + '0')}
                className="w-14 h-14 mx-auto rounded-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold text-lg flex items-center justify-center active:scale-95 transition-all"
              >
                0
              </button>
              <button
                onClick={() => handlePinChange(pin.slice(0, -1))}
                className="w-14 h-14 mx-auto rounded-full text-gray-500 hover:text-gray-800 font-bold text-xs flex items-center justify-center"
              >
                Del
              </button>
            </div>

            <p className="text-center text-[10px] text-gray-400 font-bold">
              Tip: Gunakan pin default <span className="text-primary-600 font-black">123456</span> untuk simulasi sukses.
            </p>
          </div>
        )}

        {/* STEP 4: LOADING PROCESS */}
        {step === 'LOADING' && (
          <div className="p-12 space-y-8 text-center no-print">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              {/* Spinning background track */}
              <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
              {/* Animated partial loader */}
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  className="text-primary-600 transition-all duration-300"
                  strokeWidth="4"
                  strokeDasharray={220}
                  strokeDashoffset={220 - (220 * loadingProgress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="35"
                  cx="48"
                  cy="48"
                />
              </svg>
              <span className="absolute text-sm font-black text-primary-950">{loadingProgress}%</span>
            </div>

            <div className="space-y-2">
              <h4 className="font-extrabold text-gray-900 text-base">Memproses Transaksi...</h4>
              <p className="text-xs text-gray-500 font-medium">{loadingStatus}</p>
            </div>

            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-primary-600 h-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 5: RESULT PAGE & RECEIPT */}
        {step === 'RESULT' && (
          <div className="relative">
            
            {/* SUCCESS / PENDING / FAILED HERO SECTION */}
            <div className="p-6 text-center space-y-4 bg-gray-50/50 border-b border-gray-100 no-print">
              
              <div className="flex justify-end absolute top-4 right-4 no-print">
                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white border border-gray-150 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {finalStatus === 'sukses' && (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-emerald-950">Transaksi Berhasil!</h3>
                    <p className="text-xs text-emerald-700 font-medium">Pembayaran Anda telah sukses diverifikasi oleh provider.</p>
                  </div>
                </div>
              )}

              {finalStatus === 'pending' && (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Clock className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-amber-950">Transaksi Tertunda (Pending)</h3>
                    <p className="text-xs text-amber-700 font-medium">Transaksi Anda sedang diantrekan oleh operator terkait.</p>
                  </div>
                </div>
              )}

              {finalStatus === 'gagal' && (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <AlertTriangle className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-red-950">Transaksi Gagal</h3>
                    <p className="text-xs text-red-700 font-medium">Gerbang pembayaran mengalami gangguan atau saldo tidak mencukupi.</p>
                  </div>
                </div>
              )}
            </div>

                        {/* PREMIUM RECEIPT COMPONENT */}
            <div id="printable-receipt" className="p-6 space-y-6">
              {receiptData ? (
                <>
                  <div className="flex justify-between items-start border-b border-dashed border-gray-200 pb-5">
                    <div>
                      <h4 className="text-lg font-black text-gray-900 tracking-tight">{receiptData.header?.company_name || 'GURKYPAY'}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">Bukti Pembayaran Resmi</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        receiptData.transaction_details?.status === 'success' || receiptData.transaction_details?.status === 'sukses' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        receiptData.transaction_details?.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {receiptData.transaction_details?.status || finalStatus}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Nomor Invoice</span>
                      <span className="font-black text-gray-800 tracking-wide">{receiptData.transaction_details?.invoice_number}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Tanggal</span>
                      <span className="font-black text-gray-800">
                        {receiptData.transaction_details?.date 
                          ? new Date(receiptData.transaction_details.date).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                          : '-'}
                      </span>
                    </div>
                    {receiptData.transaction_details?.serial_number && (
                      <div className="flex justify-between items-center text-xs bg-emerald-50/50 p-2 rounded border border-emerald-100">
                        <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">Serial Number (SN)</span>
                        <span className="font-black text-emerald-700 tracking-wide">{receiptData.transaction_details.serial_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Kategori</span>
                      <span className="font-black text-gray-800">{receiptData.transaction_details?.service_name}</span>
                    </div>
                    
                    {receiptData.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs gap-4">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Produk</span>
                        <span className="font-black text-gray-800 text-right">{item.name}</span>
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Nomor Target</span>
                      <span className="font-black text-gray-800 tracking-wider">{receiptData.transaction_details?.target_number}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Metode Pembayaran</span>
                      <span className="font-black text-primary-600">{receiptData.transaction_details?.payment_method}</span>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3.5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                        <span>Harga</span>
                        <span className="text-gray-900">{formatIDR(receiptData.payment_summary?.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                        <span>Admin</span>
                        <span className="text-gray-900">{formatIDR(receiptData.payment_summary?.admin_fee || 0)}</span>
                      </div>
                      <div className="border-t border-dashed border-gray-100 pt-2.5 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-900 uppercase">Total Bayar</span>
                        <span className="text-lg font-black text-primary-600">{formatIDR(receiptData.payment_summary?.total_payment || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-5 flex flex-col items-center text-center space-y-2.5">
                    <div className="p-2 bg-white border border-gray-150 rounded-xl">
                      <div className="w-20 h-20 bg-gray-50 flex items-center justify-center text-gray-400 relative">
                        <QrCode className="w-14 h-14" />
                        <span className="absolute bottom-1 text-[7px] text-gray-300 font-extrabold tracking-widest uppercase">GURKYPAY QR</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold max-w-xs leading-normal">
                      {receiptData.footer?.note || 'Terima kasih telah menggunakan GurkyPay.'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-gray-400 min-h-[300px]">
                  <RefreshCw className="w-8 h-8 animate-spin mb-3 text-primary-500" />
                  <span className="text-xs font-bold">Membuat struk resmi...</span>
                </div>
              )}
            </div>

            {/* ACTIONS FOOTER */}
            <div className="p-6 bg-gray-50 border-t border-gray-150 flex flex-col gap-3 no-print">
              
              {copiedText && (
                <div className="text-xs text-center font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl animate-bounce">
                  {copiedText}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={handleDownloadPlaceholder}
                  className="py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  <span>Download PDF</span>
                </button>
                <button 
                  onClick={handleShare}
                  className="py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Share2 className="w-4 h-4 text-gray-500" />
                  <span>Bagikan</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer className="w-4 h-4 text-gray-500" />
                  <span>Cetak</span>
                </button>
              </div>

              <button 
                onClick={onClose}
                className="w-full mt-1.5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-primary-600/10"
              >
                Selesai & Kembali
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

