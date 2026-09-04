import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  X,
  ArrowRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { useWalletStore } from '../store/wallet.store';
import { useTransactionStore } from '../store/transaction.store';
import { useNotificationStore } from '../store/notification.store';
import { transactionService } from '../services/transaction/transaction.service';
import { useAuth } from '../hooks/useAuth';
import { buildCreatePinUrl, savePendingCheckout } from '../utils/pinGate';
import { isFailedStatus, isSuccessStatus } from '../utils/transactionStatus';
import { formatIDR } from '../utils/currency';
import { getOrCreateIdempotencyKey } from '../utils/idempotency';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { customerFacingPaymentMethodLabel } from '../utils/paymentMethodLabel';
import { resolveReceiptFields } from '../utils/receiptDeliverable';
import { TransactionReceipt } from './TransactionReceipt';

// Dynamic transaction properties
export interface CheckoutData {
  serviceName: string; // e.g. 'Pulsa', 'Paket Data', 'Token PLN', 'Voucher', 'Transfer Saldo', 'Tagihan', 'Voucher Game', 'E-Wallet'
  productName: string;
  targetNo: string;
  amount: number;
  adminFee: number;
  skuCode?: string;
  /** Digiflazz inq-pasca session — required for postpaid bill payment */
  inquiryRefId?: string;
  customDetails?: Record<string, string | number>;
}

interface CheckoutSummaryProps {
  data: CheckoutData;
  onClose: () => void;
  onSuccess?: (transaction: any) => void;
  /** Resume after Create PIN redirect */
  initialStep?: CheckoutStep;
}

type CheckoutStep = 'SUMMARY' | 'CONFIRM' | 'PIN' | 'LOADING' | 'RESULT';

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ data, onClose, onSuccess, initialStep = 'SUMMARY' }) => {
  const { wallet, syncAuthoritativeBalance } = useWalletStore();
  const { createTransaction, fetchTransactions, upsertTransaction } = useTransactionStore();
  const { user, fetchUser } = useAuth();
  const { fetchNotifications } = useNotificationStore();
  const { flags: featureFlags, loading: flagsLoading, refresh } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const purchaseEnabled = !flagsLoading && featureFlags.purchase_enabled;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [step, setStep] = useState<CheckoutStep>(() => (initialStep === 'PIN' && !user?.hasPin ? 'CONFIRM' : initialStep));
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [pinErrorMessage, setPinErrorMessage] = useState<string>('PIN Salah! Silakan coba kembali.');
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>('Memproses Transaksi...');
  const [finalStatus, setFinalStatus] = useState<'sukses' | 'success' | 'pending' | 'gagal'>('sukses');
  const [createdTrx, setCreatedTrx] = useState<any | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const totalPayment = data.amount + data.adminFee;
  const pinInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const statusPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SRS 14.1 — one idempotency key per checkout attempt (this modal instance); reused
  // across PIN retries so a network retry or resubmission never creates a second purchase.
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    return () => {
      if (statusPollRef.current) {
        clearTimeout(statusPollRef.current);
      }
    };
  }, []);

  const applySettledUi = async (trx: any) => {
    const status = String(trx?.status || 'pending').toLowerCase();
    upsertTransaction(trx);
    setCreatedTrx(trx);
    if (isFailedStatus(status)) {
      setFinalStatus('gagal');
      setFailureMessage(trx.notes || trx.note || 'Transaksi gagal diproses.');
    } else if (isSuccessStatus(status)) {
      setFinalStatus('sukses');
      setFailureMessage(null);
    } else {
      setFinalStatus('pending');
    }

    try {
      const receiptRes = await transactionService.getReceipt(trx.id || trx.invoice_number || trx.transactionCode);
      if (receiptRes.success && receiptRes.data) {
        setReceiptData(receiptRes.data);
      }
    } catch {
      // ignore receipt race while still pending
    }

    void syncAuthoritativeBalance();
    void fetchTransactions();
    void fetchNotifications({ force: true });
  };

  /** Poll backend until VIP status sync settles SUCCESS/FAILED (aligned with 60s timeout ladder). */
  const pollTransactionUntilSettled = async (idOrInvoice: string) => {
    const maxAttempts = 12; // ~60s at 5s interval (server WatchPendingTransactionJob is SSOT)
    const intervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise<void>((resolve) => {
        statusPollRef.current = setTimeout(() => resolve(), intervalMs);
      });

      try {
        const res = await transactionService.getById(idOrInvoice);
        if (!res.success || !res.data) continue;

        const status = String(res.data.status || '').toLowerCase();
        if (status === 'success' || status === 'sukses' || status === 'failed' || status === 'gagal' || status === 'cancelled' || status === 'canceled') {
          await applySettledUi(res.data);
          return;
        }
      } catch {
        // keep polling on transient errors
      }
    }
  };

  const goToPinStep = () => {
    if (!user?.hasPin) {
      savePendingCheckout(data, location.pathname);
      navigate(buildCreatePinUrl(location.pathname));
      return;
    }
    setStep('PIN');
  };

  // Focus invisible input for keyboard typing on desktop
  useEffect(() => {
    if (step !== 'PIN') return;
    if (!user?.hasPin) {
      savePendingCheckout(data, location.pathname);
      navigate(buildCreatePinUrl(location.pathname));
      return;
    }
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 300);
  }, [step, user?.hasPin, data, location.pathname, navigate]);

  const resolveErrorMessage = (): string => {
    const state = useTransactionStore.getState();
    if (state.validationErrors) {
      const vals = Object.values(state.validationErrors).flat().filter(Boolean);
      if (vals.length > 0) {
        return String(vals[0]);
      }
    }
    return state.error || 'Gagal membuat transaksi.';
  };

  const isPinRelatedError = (message: string): boolean => {
    const state = useTransactionStore.getState();
    if (state.validationErrors?.pin?.length) return true;
    return /pin/i.test(message);
  };

  const finalizeTransaction = async (completedPin: string) => {
    setLoadingProgress(50);
    setLoadingStatus('Mengirim permintaan ke server...');

    if (!purchaseEnabled) {
      setFailureMessage(featureFlags.messages.purchase);
      setFinalStatus('gagal');
      setCreatedTrx({ invoice_number: 'TRX-SEGERA-HADIR', note: featureFlags.messages.purchase });
      setStep('RESULT');
      submittingRef.current = false;
      return;
    }

    if (!data.skuCode) {
      setFailureMessage('SKU produk wajib dipilih. Silakan pilih ulang produk.');
      setFinalStatus('gagal');
      setCreatedTrx({ invoice_number: 'TRX-GAGAL', note: 'SKU produk wajib dipilih.' });
      setStep('RESULT');
      submittingRef.current = false;
      return;
    }

    const requestPayload: Record<string, string> = {
      sku_code: data.skuCode,
      target_number: data.targetNo,
      pin: completedPin,
      idempotency_key: getOrCreateIdempotencyKey(idempotencyKeyRef),
    };
    if (data.inquiryRefId) {
      requestPayload.inquiry_ref_id = data.inquiryRefId;
    }

    const trx = await createTransaction(requestPayload);
    setLoadingProgress(100);

    if (trx) {
      setCreatedTrx(trx);
      const status = trx.status || 'pending';
      if (status === 'failed' || status === 'gagal') {
        setFinalStatus('gagal');
        setFailureMessage(trx.notes || trx.note || 'Transaksi gagal diproses.');
      } else if (status === 'success' || status === 'sukses') {
        setFinalStatus('sukses');
      } else {
        setFinalStatus('pending');
      }
      setStep('RESULT');

      try {
        const receiptRes = await transactionService.getReceipt(trx.id || trx.invoice_number || trx.transactionCode);
        if (receiptRes.success && receiptRes.data) {
          setReceiptData(receiptRes.data);
        }
      } catch {
        // Receipt fetch handled gracefully
      }

      // Create returns pending while queue fulfills + polls VIP — keep UI in sync automatically.
      const terminal =
        status === 'success' || status === 'sukses' || status === 'failed' || status === 'gagal';
      if (!terminal) {
        void pollTransactionUntilSettled(String(trx.id || trx.invoice_number || trx.transactionCode));
      }

      if (onSuccess) {
        onSuccess(trx);
      }
      void syncAuthoritativeBalance();
      submittingRef.current = false;
      idempotencyKeyRef.current = null;
      return;
    }

    const errorMessage = resolveErrorMessage();

    if (isPinRelatedError(errorMessage)) {
      setPin('');
      setPinError(true);
      setPinErrorMessage(errorMessage);
      setStep('PIN');
      submittingRef.current = false;
      setTimeout(() => pinInputRef.current?.focus(), 200);
      return;
    }

    setFailureMessage(errorMessage);
    setFinalStatus('gagal');
    setCreatedTrx({ invoice_number: 'TRX-GAGAL', note: errorMessage });
    setStep('RESULT');
    submittingRef.current = false;
  };

  /**
   * Single source of truth for PIN digits.
   * Keyboard uses controlled input onChange only (no onKeyDown append).
   * On-screen keypad calls this with the next full PIN string.
   */
  const handlePinChange = (val: string) => {
    const cleaned = String(val).replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setPinError(false);

    if (cleaned.length === 6) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setStep('LOADING');
      void finalizeTransaction(cleaned);
    }
  };

  // FR-RECEIPT-UI-01 — single classification pass shared with RiwayatPage's receipt view.
  const receiptFields = resolveReceiptFields({
    receiptData,
    serviceName: data.serviceName,
    isSuccess: finalStatus === 'sukses' || finalStatus === 'success',
    customDetails: data.customDetails,
  });

  const receiptPaymentMethodLabel = customerFacingPaymentMethodLabel(
    receiptData?.transaction_details?.payment_method
  );

  const receiptStatus: 'success' | 'pending' | 'failed' =
    finalStatus === 'sukses' || finalStatus === 'success' ? 'success' : finalStatus === 'pending' ? 'pending' : 'failed';
  // Spinner covers the field list only while the receipt is still loading; a synthetic
  // client-side failure (no transaction ever created) never gets a receipt, so don't spin forever.
  const loadingReceipt = !receiptData && finalStatus !== 'gagal';

  // Real backend-generated PDF (Sprint 8 / FR-USR04) — only available once a real
  // transaction row exists (createdTrx.id). Pre-validation failures never reach the server.
  const handleDownloadPdf = createdTrx?.id
    ? () => {
        void transactionService.downloadReceiptPdf(String(createdTrx.id)).catch(() => {
          alert('Gagal mengunduh struk PDF.');
        });
      }
    : undefined;

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
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className={
          step === 'RESULT'
            ? 'w-full max-w-[400px]'
            : 'bg-white w-full max-w-lg rounded-3xl border border-gray-100 shadow-2xl overflow-hidden relative'
        }
      >
        
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

            {!flagsLoading && !featureFlags.purchase_enabled && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 px-1 bg-amber-50 p-3 rounded-xl border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Segera Hadir — {featureFlags.messages.purchase}</span>
              </div>
            )}

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
                disabled={!purchaseEnabled}
                onClick={() => purchaseEnabled && setStep('CONFIRM')}
                className={`flex-1 py-3 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  purchaseEnabled
                    ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/10'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>{flagsLoading ? 'Memuat...' : purchaseEnabled ? 'Lanjut' : 'Segera Hadir'}</span>
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
                disabled={!purchaseEnabled || (wallet ? wallet.balance < totalPayment : true)}
                onClick={goToPinStep}
                className={`flex-1 py-3 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  purchaseEnabled && wallet && wallet.balance >= totalPayment 
                    ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/15' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{flagsLoading ? 'Memuat...' : purchaseEnabled ? 'Konfirmasi & Bayar' : 'Segera Hadir'}</span>
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

            {/* Invisible input — keyboard digits via onChange only (no onKeyDown append) */}
            <input 
              ref={pinInputRef}
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="absolute opacity-0 w-0 h-0"
              aria-label="PIN Transaksi"
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
                {pinErrorMessage}
              </p>
            )}

            {/* Simulated Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinChange(pin + String(num))}
                  className="w-14 h-14 mx-auto rounded-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold text-lg flex items-center justify-center active:scale-95 transition-all"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button"
                onClick={() => {
                  setPin('');
                  setPinError(false);
                }}
                className="w-14 h-14 mx-auto rounded-full text-gray-400 hover:text-gray-600 font-bold text-xs flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinChange(pin + '0')}
                className="w-14 h-14 mx-auto rounded-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-extrabold text-lg flex items-center justify-center active:scale-95 transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handlePinChange(pin.slice(0, -1))}
                className="w-14 h-14 mx-auto rounded-full text-gray-500 hover:text-gray-800 font-bold text-xs flex items-center justify-center"
              >
                Del
              </button>
            </div>

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

        {/* STEP 5: RESULT PAGE & RECEIPT — reusable paper receipt (FR-RECEIPT-UI-01) */}
        {step === 'RESULT' && (
          <TransactionReceipt
            status={receiptStatus}
            failureMessage={failureMessage || createdTrx?.note || createdTrx?.notes}
            invoiceNumber={receiptData?.transaction_details?.invoice_number}
            date={receiptData?.transaction_details?.date}
            serialNumber={receiptFields.serialNumber}
            category={receiptData?.transaction_details?.service_name || data.serviceName}
            productName={receiptData?.items?.[0]?.name || data.productName}
            targetLabel={receiptFields.targetLabel || undefined}
            targetValue={receiptFields.targetValue || receiptData?.transaction_details?.target_number || data.targetNo}
            paymentMethodLabel={receiptPaymentMethodLabel || undefined}
            price={receiptData?.payment_summary?.subtotal ?? data.amount}
            adminFee={receiptData?.payment_summary?.admin_fee ?? data.adminFee}
            totalPayment={receiptData?.payment_summary?.total_payment ?? totalPayment}
            extraRows={receiptFields.extraRows}
            deliverable={receiptFields.deliverable}
            deliverablePendingLabel={receiptFields.deliverablePendingLabel}
            loading={loadingReceipt}
            onDownloadPdf={handleDownloadPdf}
            onClose={onClose}
            onDone={onClose}
            className="py-5"
          />
        )}

      </div>
    </div>
  );
};

