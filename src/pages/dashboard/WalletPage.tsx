import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
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
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { buildCreatePinUrl, PENDING_WALLET_ACTION_KEY } from '../../utils/pinGate';
import { caretFromDigitIndex, formatIDR, formatIDRInput, parseIDRDigits } from '../../utils/currency';
import { PaymentPlaceholderModal, PaymentPlaceholderKind } from '../../components/wallet/PaymentPlaceholderModal';
import { getOrCreateIdempotencyKey } from '../../utils/idempotency';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { RefreshPolicy } from '../../lib/refreshPolicy';
import { ensureMidtransSnap } from '../../utils/midtransSnap';
import { walletService } from '../../services/wallet/wallet.service';
import { useCallback } from 'react';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/toast.store';
import {
  MIN_TOPUP_AMOUNT,
  TOPUP_QUICK_AMOUNTS,
  enabledBanks,
  enabledOutlets,
  extractMidtransPaymentDetails,
  isMethodEnabled,
  isTopUpAmountValid,
  mapTopUpError,
  methodRequiresBank,
  methodRequiresRetailOutlet,
  type MidtransPaymentDetails,
  type TopUpMethodId,
  type TopUpPaymentConfig,
} from '../../utils/topupPaymentFlow';

declare global {
  interface Window {
    snap: any;
  }
}

export const WalletPage = ({ defaultTab = 'index' }: { defaultTab?: 'index' | 'topup' | 'transfer' | 'withdraw' }) => {
  const { wallet, summary, history, loading, fetchWallet, applyRealtimeBalance, topUp, transfer, withdraw, depositManual } = useWalletStore();
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const { flags: featureFlags } = useFeatureFlags();
  const withdrawEnabled = featureFlags.withdraw_enabled;

  const getToken = useCallback(() => localStorage.getItem('token'), []);
  const walletChannel = user?.id ? [`wallet.${user.id}`] : [];

  // Sprint 11 / SRS 16.3 — SSE primary balance_updated; RealtimeManager falls back to ~3s poll.
  useRealtimeChannel(
    Boolean(user?.id),
    walletChannel,
    (evt) => {
      if (evt.event !== 'balance_updated') return;
      const bal = Number(evt.payload?.balance);
      if (Number.isFinite(bal)) {
        applyRealtimeBalance(bal);
      }
      void fetchWallet({ force: true });
    },
    getToken,
    RefreshPolicy.walletBalance
  );

  const [activeTab, setActiveTab] = useState<'index' | 'topup' | 'transfer' | 'withdraw'>(
    defaultTab === 'withdraw' && !withdrawEnabled ? 'index' : defaultTab
  );
  
  // States for Top Up — topupAmount stores pure digits (e.g. "250000")
  const [topupAmount, setTopupAmount] = useState<string>('');
  const [topupMethod, setTopupMethod] = useState<TopUpMethodId>('qris');
  const [topupBank, setTopupBank] = useState<string>('');
  const [topupRetail, setTopupRetail] = useState<string>('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<TopUpPaymentConfig | null>(null);
  const [pendingPayment, setPendingPayment] = useState<MidtransPaymentDetails | null>(null);
  const [manualProof, setManualProof] = useState<File | null>(null);
  const [manualNotes, setManualNotes] = useState('');
  const topupAmountInputRef = useRef<HTMLInputElement>(null);
  const topupCaretDigitsRef = useRef<number | null>(null);
  
  // States for Transfer
  const [transferType, setTransferType] = useState<'bank' | 'p2p'>('p2p');
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('BCA');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [transferPin, setTransferPin] = useState<string>('');

  // States for Withdraw
  const [withdrawBank, setWithdrawBank] = useState<string>('BCA');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawPin, setWithdrawPin] = useState<string>('');

  // Status Modals
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Payment placeholders (shown when Midtrans is not configured)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalKind, setPaymentModalKind] = useState<PaymentPlaceholderKind | null>(null);
  const [paymentModalAmount, setPaymentModalAmount] = useState(0);

  // SRS 14.1 — one idempotency key per logical action; reused across retries of the same
  // submission, reset only once that logical action reaches a terminal outcome.
  const topupIdemRef = useRef<string | null>(null);
  const transferIdemRef = useRef<string | null>(null);
  const withdrawIdemRef = useRef<string | null>(null);

  useEffect(() => {
    if (errorMsg) {
      useToastStore.getState().push({ type: 'error', title: 'Terjadi Kesalahan', description: errorMsg });
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      useToastStore.getState().push({ type: 'success', title: 'Aksi Berhasil!', description: successMsg });
    }
  }, [successMsg]);

  useEffect(() => {
    fetchWallet();
    fetchUser();
    void walletService.getPaymentConfig().then((res) => {
      if (res?.data) setPaymentConfig(res.data as TopUpPaymentConfig);
    }).catch(() => {
      /* payment-config is optional bootstrap; form still validates on submit */
    });
    try {
      const raw = sessionStorage.getItem(PENDING_WALLET_ACTION_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_WALLET_ACTION_KEY);
        if (pending?.activeTab) setActiveTab(pending.activeTab);
        if (pending?.targetAccount) setTargetAccount(pending.targetAccount);
        if (pending?.transferAmount) setTransferAmount(pending.transferAmount);
        if (pending?.transferNote) setTransferNote(pending.transferNote);
        if (pending?.transferType) setTransferType(pending.transferType);
        if (pending?.withdrawBank) setWithdrawBank(pending.withdrawBank);
        if (pending?.withdrawAccount) setWithdrawAccount(pending.withdrawAccount);
        if (pending?.withdrawAmount) setWithdrawAmount(pending.withdrawAmount);
      }
    } catch {
      sessionStorage.removeItem(PENDING_WALLET_ACTION_KEY);
    }
  }, [fetchWallet, fetchUser]);

  const openPaymentPlaceholder = (method: string, amount: number) => {
    const kind: PaymentPlaceholderKind =
      method === 'va' ? 'va' : method === 'retail' ? 'retail' : 'qris';
    setPaymentModalKind(kind);
    setPaymentModalAmount(amount);
    setPaymentModalOpen(true);
  };

  // Restore caret after IDR reformat so the cursor does not jump to the end.
  useLayoutEffect(() => {
    if (topupCaretDigitsRef.current === null || !topupAmountInputRef.current) return;
    const el = topupAmountInputRef.current;
    const formatted = formatIDRInput(topupAmount);
    const pos = caretFromDigitIndex(formatted, topupCaretDigitsRef.current);
    el.setSelectionRange(pos, pos);
    topupCaretDigitsRef.current = null;
  }, [topupAmount]);

  const handleTopupAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, '').length;
    const digits = parseIDRDigits(el.value);
    topupCaretDigitsRef.current = Math.min(digitsBeforeCaret, digits.length);
    setTopupAmount(digits);
  };

  const qrisEnabled = paymentConfig ? isMethodEnabled(paymentConfig, 'qris') : true;
  const vaEnabled = paymentConfig ? isMethodEnabled(paymentConfig, 'va') : true;
  const retailEnabled = paymentConfig ? isMethodEnabled(paymentConfig, 'retail') : true;
  const vaBanks = paymentConfig
    ? enabledBanks(paymentConfig)
    : [
        { code: 'bca_va', label: 'BCA', enabled: true },
        { code: 'bni_va', label: 'BNI', enabled: true },
        { code: 'bri_va', label: 'BRI', enabled: true },
        { code: 'echannel', label: 'Mandiri', enabled: true },
      ];
  const retailOutlets = paymentConfig
    ? enabledOutlets(paymentConfig)
    : [
        { code: 'alfamart', label: 'Alfamart', enabled: true },
        { code: 'indomaret', label: 'Indomaret', enabled: true },
      ];
  const minTopup = Number(paymentConfig?.min_amount || MIN_TOPUP_AMOUNT);
  const quickAmounts = (paymentConfig?.quick_amounts || [...TOPUP_QUICK_AMOUNTS]).filter(
    (n) => Number(n) >= minTopup
  );

  const selectTopupMethod = (method: TopUpMethodId) => {
    if (method !== 'manual_transfer' && paymentConfig && !isMethodEnabled(paymentConfig, method)) return;
    setTopupMethod(method);
    setPendingPayment(null);
    topupIdemRef.current = null;
    if (method !== 'va') setTopupBank('');
    if (method !== 'retail') setTopupRetail('');
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (!topupAmount || !isTopUpAmountValid(amount)) {
      setErrorMsg('Minimal top up adalah Rp10.000');
      return;
    }

    if (topupMethod === 'manual_transfer') {
      if (!manualProof) {
        setErrorMsg('Unggah bukti transfer terlebih dahulu.');
        return;
      }
      setTopupSubmitting(true);
      const res = await depositManual(amount, manualProof, manualNotes || undefined);
      setTopupSubmitting(false);
      if (!res) {
        setErrorMsg('Gagal mengajukan deposit manual.');
        return;
      }
      setSuccessMsg('Deposit manual diajukan. Menunggu verifikasi Finance.');
      setTopupAmount('');
      setManualProof(null);
      setManualNotes('');
      setActiveTab('index');
      return;
    }

    if (paymentConfig && !isMethodEnabled(paymentConfig, topupMethod)) {
      setErrorMsg('Metode pembayaran tersebut sedang tidak tersedia.');
      return;
    }

    if (methodRequiresBank(topupMethod) && !topupBank) {
      setErrorMsg('Pilih bank Virtual Account terlebih dahulu.');
      return;
    }

    if (methodRequiresRetailOutlet(topupMethod) && !topupRetail) {
      setErrorMsg('Pilih gerai Alfamart atau Indomaret terlebih dahulu.');
      return;
    }

    const channel = topupMethod === 'va' ? topupBank : topupMethod === 'retail' ? topupRetail : undefined;
    const idempotencyKey = getOrCreateIdempotencyKey(topupIdemRef);
    setTopupSubmitting(true);
    setErrorMsg(null);
    const res = await topUp(amount, topupMethod, idempotencyKey, channel);
    setTopupSubmitting(false);

    if (res?.__error) {
      const msg = mapTopUpError({ code: res.code, message: res.message });
      setErrorMsg(msg);
      if (res.code === 'MIDTRANS_NOT_CONFIGURED') {
        openPaymentPlaceholder(topupMethod, amount);
      }
      return;
    }

    const payment = (res?.payment || {}) as MidtransPaymentDetails;
    setPendingPayment({
      status: 'pending',
      method: topupMethod,
      channel: channel || payment.channel || topupMethod,
      channel_label: payment.channel_label,
      order_id: payment.order_id || res?.transaction?.invoice_number,
      amount,
      va_number: payment.va_number ?? null,
      payment_code: payment.payment_code ?? null,
      store: payment.store ?? null,
      expiry_time: payment.expiry_time ?? null,
    });

    if (res && res.snap_token) {
      const midtransCfg = res.midtrans || (await walletService.getPaymentConfig()).data;
      const snapReady = midtransCfg
        ? await ensureMidtransSnap(midtransCfg)
        : typeof window.snap?.pay === 'function';
      if (!snapReady || typeof window.snap?.pay !== 'function') {
        setErrorMsg('SDK pembayaran belum siap. Silakan muat ulang halaman.');
        return;
      }
      window.snap.pay(res.snap_token, {
        // Snap UI callbacks are NOT wallet settlement. Final status comes from webhook/backend.
        onSuccess: function (result: unknown) {
          const extra = extractMidtransPaymentDetails(result);
          setPendingPayment((prev) => ({ ...(prev || {}), ...extra, status: 'pending' }));
          void fetchWallet({ force: true });
          setSuccessMsg(
            `Menunggu Konfirmasi Pembayaran. Saldo bertambah setelah Midtrans settlement sebesar ${formatIDR(amount)}.`
          );
          setTopupAmount('');
          topupIdemRef.current = null;
        },
        onPending: function (result: unknown) {
          const extra = extractMidtransPaymentDetails(result);
          setPendingPayment((prev) => ({ ...(prev || {}), ...extra, status: 'pending' }));
          void fetchWallet({ force: true });
          setSuccessMsg('Menunggu Pembayaran. Selesaikan pembayaran sesuai instruksi di jendela pembayaran.');
        },
        onError: function () {
          setPendingPayment((prev) => (prev ? { ...prev, status: 'pending' } : prev));
          setErrorMsg('Pembayaran belum berhasil. Cek Riwayat atau lanjutkan pembayaran dari detail transaksi.');
        },
        onClose: function () {
          setPendingPayment((prev) => (prev ? { ...prev, status: 'pending' } : prev));
          setSuccessMsg(
            'Menunggu Pembayaran. Transaksi tetap tersimpan di Riwayat — Anda dapat melanjutkan pembayaran dari detail transaksi.'
          );
        }
      });
    } else if (res) {
      setSuccessMsg('Menunggu Pembayaran. Selesaikan pembayaran sesuai instruksi.');
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
      setErrorMsg('Mohon isi nomor wallet tujuan.');
      return;
    }

    if (transferType === 'bank') {
      setErrorMsg('Transfer ke rekening bank belum tersedia. Gunakan Transfer Sesama GurkyPay atau fitur Tarik Dana.');
      return;
    }

    if (!user?.hasPin) {
      sessionStorage.setItem(
        PENDING_WALLET_ACTION_KEY,
        JSON.stringify({
          activeTab: 'transfer',
          targetAccount,
          transferAmount,
          transferNote,
          transferType,
        })
      );
      navigate(buildCreatePinUrl('/dashboard/wallet'));
      return;
    }

    if (!/^\d{6}$/.test(transferPin)) {
      setErrorMsg('PIN transaksi harus 6 digit.');
      return;
    }

    const idempotencyKey = getOrCreateIdempotencyKey(transferIdemRef);
    const res = await transfer(targetAccount, amount, transferPin, idempotencyKey);
    if (res) {
      setSuccessMsg(`Transfer sebesar ${formatIDR(amount)} berhasil diproses ke ${targetAccount}.`);
      setTransferAmount('');
      setTargetAccount('');
      setTransferNote('');
      setTransferPin('');
      setActiveTab('index');
      transferIdemRef.current = null;
    } else {
      setErrorMsg('Gagal memproses transfer. Pastikan PIN benar, wallet tujuan valid, dan saldo mencukupi.');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawEnabled) {
      setErrorMsg(featureFlags.messages.withdraw);
      return;
    }

    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount < 10000) {
      setErrorMsg('Minimal penarikan adalah Rp 10.000');
      return;
    }
    if (!withdrawAccount.trim()) {
      setErrorMsg('Nomor rekening wajib diisi.');
      return;
    }
    if (!user?.hasPin) {
      sessionStorage.setItem(
        PENDING_WALLET_ACTION_KEY,
        JSON.stringify({
          activeTab: 'withdraw',
          withdrawBank,
          withdrawAccount,
          withdrawAmount,
        })
      );
      navigate(buildCreatePinUrl('/dashboard/wallet'));
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
      idempotencyKey: getOrCreateIdempotencyKey(withdrawIdemRef),
    });

    if (res) {
      setSuccessMsg(`Penarikan ${formatIDR(amount)} ke ${withdrawBank} ${withdrawAccount} sedang diproses.`);
      setWithdrawAmount('');
      setWithdrawAccount('');
      setWithdrawPin('');
      setActiveTab('index');
      withdrawIdemRef.current = null;
    } else {
      setErrorMsg('Gagal memproses penarikan. Periksa PIN, saldo, dan nomor rekening.');
    }
  };

  // Live ledger + monthly summary from GET /wallet (backend-calculated)
  const walletHistory = Array.isArray(history) ? history : [];
  const monthIn = Number(summary?.income_this_month ?? 0);
  const monthOut = Number(summary?.expense_this_month ?? 0);
  const mutationCount = Number(summary?.transaction_count ?? 0);

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="wallet-page-root">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Manajemen Dompet</h2>
          <p className="text-sm text-gray-500">Kelola saldo GurkyPay, transfer bank, dan riwayat mutasi keuangan Anda secara real-time.</p>
        </div>
        <button 
          onClick={() => { fetchWallet(); }}
          className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-100 hover:border-primary-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Active Balance Card */}
      <div className="dashboard-balance-card">
        <div className="brand-glow-accent -right-8 -bottom-8 w-44 h-44 opacity-30 pointer-events-none absolute" />
        <div className="absolute right-6 top-6 opacity-15">
          <Wallet className="w-20 h-20" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary-200 tracking-wide uppercase">Saldo Aktif GurkyPay</p>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight mt-1.5 tabular-nums">
              {wallet ? formatIDR(wallet.balance) : 'Rp 0'}
            </h3>
          </div>
          <div className="flex gap-6 text-xs text-primary-100 font-bold">
            <div>
              <p className="text-[10px] text-primary-300 uppercase">Nomor Wallet ID</p>
              <p className="mt-0.5 tracking-wider">{wallet?.walletNo || 'GK-XXXXXXXX'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-primary-300 uppercase">Poin Reward</p>
              <p className="mt-0.5 flex items-center gap-1 justify-end text-accent-300">
                <Coins className="w-3.5 h-3.5" />
                <span>{wallet?.points || 0} Poin</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented tabs — horizontal, distinct from sidebar nav */}
      <div className="dashboard-segment-tabs" role="tablist" aria-label="Layanan dompet">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'index'}
          onClick={() => setActiveTab('index')}
          className={`dashboard-segment-tab ${activeTab === 'index' ? 'dashboard-segment-tab-active' : ''}`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Ringkasan</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'topup'}
          onClick={() => setActiveTab('topup')}
          className={`dashboard-segment-tab ${activeTab === 'topup' ? 'dashboard-segment-tab-active' : ''}`}
        >
          <ArrowDownLeft className="w-4 h-4 shrink-0" />
          <span>Isi Saldo</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'transfer'}
          onClick={() => setActiveTab('transfer')}
          className={`dashboard-segment-tab ${activeTab === 'transfer' ? 'dashboard-segment-tab-active' : ''}`}
        >
          <ArrowUpRight className="w-4 h-4 shrink-0" />
          <span>Transfer</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'withdraw'}
          onClick={() => withdrawEnabled && setActiveTab('withdraw')}
          disabled={!withdrawEnabled}
          className={`dashboard-segment-tab ${activeTab === 'withdraw' ? 'dashboard-segment-tab-active' : ''}`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>{withdrawEnabled ? 'Tarik Dana' : 'Withdraw'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50/40 px-4 py-3">
        <ShieldCheck className="w-7 h-7 text-primary-600 shrink-0" />
        <p className="text-[11px] text-gray-600 leading-snug">
          <span className="font-extrabold text-gray-900">GurkyPay Secure Protection</span>
          {' — '}
          Seluruh lalu lintas transaksi dikawal enkripsi SSL 256-bit berstandar Bank Indonesia.
        </p>
      </div>

      {/* Tab workspace — full width */}
      <AnimatePresence mode="wait">
            
            {/* TABS 1: Beranda Wallet Index */}
            {activeTab === 'index' && (
              <motion.div 
                key="index"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="dashboard-panel space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Informasi & Aktivitas</h4>
                  <p className="text-xs text-gray-500 mt-1">Ringkasan mutasi saldo dan statistik bulan berjalan.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="dashboard-stat-tile">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Pemasukan Bulan Ini</span>
                    </div>
                    <h5 className="text-lg font-black text-gray-900 tabular-nums">{formatIDR(monthIn)}</h5>
                  </div>
                  <div className="dashboard-stat-tile">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Pengeluaran Bulan Ini</span>
                    </div>
                    <h5 className="text-lg font-black text-gray-900 tabular-nums">{formatIDR(monthOut)}</h5>
                  </div>
                  <div className="dashboard-stat-tile col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-accent-300/40 text-primary-800 flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Mutasi Tercatat</span>
                    </div>
                    <h5 className="text-lg font-black text-gray-900">{mutationCount} transaksi</h5>
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
                      {walletHistory.slice(0, 20).map((row: any) => {
                        const isCredit = String(row.type || row.direction || '').toLowerCase().includes('credit');
                        const title = row.service_name || row.description || row.note || (isCredit ? 'Kredit Saldo' : 'Debit Saldo');
                        const when = row.created_at || row.date || row.createdAt;
                        const invoice = row.invoice_number || row.reference_id;
                        const statusLabel = String(row.status || 'success');
                        return (
                          <div key={row.id} className="p-4 rounded-2xl border border-gray-100 hover:border-gray-200 flex items-center justify-between transition-all">
                            <div className="flex items-center gap-3.5">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isCredit ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-primary-800'
                              }`}>
                                {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-900">{title}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {isCredit ? 'CREDIT' : 'DEBIT'}
                                  {invoice ? ` • ${invoice}` : ''}
                                  {when ? ` • ${new Date(when).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                  {` • ${statusLabel}`}
                                </p>
                              </div>
                            </div>
                            <p className={`text-sm font-black tabular-nums ${isCredit ? 'text-primary-600' : 'text-gray-800'}`}>
                              {isCredit ? '+' : '-'}{formatIDR(Number(row.amount || 0))}
                            </p>
                          </div>
                        );
                      })}
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
                className="dashboard-panel space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Top Up Saldo GurkyPay</h4>
                  <p className="text-xs text-gray-500 mt-1">Pilih nominal, lalu metode pembayaran. Saldo bertambah setelah Midtrans mengonfirmasi pembayaran.</p>
                </div>

                {pendingPayment && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-extrabold text-amber-900 text-sm">
                        {pendingPayment.status === 'success'
                          ? 'Top Up Berhasil'
                          : pendingPayment.status === 'failed'
                            ? 'Top Up Gagal'
                            : pendingPayment.status === 'expired'
                              ? 'Pembayaran Kedaluwarsa'
                              : 'Menunggu Pembayaran'}
                      </h5>
                      <button
                        type="button"
                        onClick={() => setPendingPayment(null)}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-900"
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {pendingPayment.amount != null && (
                        <p className="text-gray-700">Nominal: <span className="font-bold">{formatIDR(pendingPayment.amount)}</span></p>
                      )}
                      <p className="text-gray-700">Metode: <span className="font-bold">{pendingPayment.channel_label || pendingPayment.channel || pendingPayment.method || '-'}</span></p>
                      {pendingPayment.order_id && (
                        <p className="text-gray-700">Referensi: <span className="font-bold">{pendingPayment.order_id}</span></p>
                      )}
                      {pendingPayment.expiry_time && (
                        <p className="text-gray-700">Berlaku hingga: <span className="font-bold">{pendingPayment.expiry_time}</span></p>
                      )}
                    </div>
                    {pendingPayment.va_number && (
                      <div className="rounded-xl bg-white border border-amber-100 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-gray-500">Nomor Virtual Account</p>
                        <p className="text-sm font-black tracking-widest">{pendingPayment.va_number}</p>
                      </div>
                    )}
                    {pendingPayment.payment_code && (
                      <div className="rounded-xl bg-white border border-amber-100 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-gray-500">Kode Pembayaran {pendingPayment.store ? `(${pendingPayment.store})` : ''}</p>
                        <p className="text-sm font-black tracking-widest">{pendingPayment.payment_code}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-amber-800">
                      {pendingPayment.status === 'success'
                        ? 'Top Up berhasil dikonfirmasi. Saldo Anda sudah diperbarui.'
                        : pendingPayment.status === 'failed'
                          ? 'Pembayaran tidak berhasil. Saldo Anda tidak berubah.'
                          : pendingPayment.status === 'expired'
                            ? 'Pembayaran sudah kedaluwarsa. Silakan buat Top Up baru.'
                            : 'Menunggu konfirmasi pembayaran. Saldo hanya bertambah setelah settlement Midtrans. Jika jendela ditutup, lanjutkan dari Riwayat.'}
                    </p>
                  </div>
                )}

                <form onSubmit={handleTopupSubmit} className="space-y-6">
                  {/* Select Preset Amount */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-gray-700">Pilih Nominal Cepat</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {quickAmounts.map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => { setTopupAmount(String(amt)); topupIdemRef.current = null; }}
                          className={`py-3 px-4 rounded-xl border font-bold text-xs transition-all ${topupAmount === String(amt) ? 'bg-primary-600 border-primary-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-primary-400'}`}
                        >
                          {formatIDR(amt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual input */}
                  <div className="space-y-1.5">
                    <label className="auth-label">Atau Masukkan Nominal Manual</label>
                    <input 
                      ref={topupAmountInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Minimal Rp10.000"
                      value={formatIDRInput(topupAmount)}
                      onChange={(e) => { handleTopupAmountChange(e); topupIdemRef.current = null; }}
                      className="auth-input px-4 py-3 font-bold"
                    />
                  </div>

                  {/* Payment Method Option */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-gray-700">Metode Pembayaran</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {qrisEnabled && (
                      <div 
                        onClick={() => selectTopupMethod('qris')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'qris' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <QrCode className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">QRIS</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Langsung tampil QR Midtrans</p>
                        </div>
                      </div>
                      )}

                      {vaEnabled && (
                      <div 
                        onClick={() => selectTopupMethod('va')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'va' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Building2 className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">Virtual Account</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Pilih bank, lalu nomor VA</p>
                        </div>
                      </div>
                      )}

                      {retailEnabled && (
                      <div 
                        onClick={() => selectTopupMethod('retail')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'retail' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Smartphone className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">Alfa / Indomaret</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Kode bayar dari Midtrans</p>
                        </div>
                      </div>
                      )}

                      <div
                        onClick={() => selectTopupMethod('manual_transfer')}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${topupMethod === 'manual_transfer' ? 'border-primary-500 bg-primary-50/20' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Building2 className="w-8 h-8 text-primary-600 shrink-0" />
                        <div>
                          <h6 className="font-extrabold text-gray-900 text-xs">Transfer Manual</h6>
                          <p className="text-[10px] text-gray-500 mt-0.5">Unggah bukti · verifikasi Finance</p>
                        </div>
                      </div>
                    </div>

                    {topupMethod === 'va' && vaEnabled && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-bold text-gray-700">Pilih Bank</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {vaBanks.map((bank) => (
                            <button
                              type="button"
                              key={bank.code}
                              onClick={() => { setTopupBank(bank.code); topupIdemRef.current = null; setPendingPayment(null); }}
                              className={`py-3 px-3 rounded-xl border text-xs font-extrabold transition-all ${topupBank === bank.code ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-primary-400'}`}
                            >
                              {bank.label}
                            </button>
                          ))}
                        </div>
                        {!topupBank && (
                          <p className="text-[11px] text-gray-500">Nomor VA hanya tampil setelah bank dipilih dan pembayaran dibuat.</p>
                        )}
                      </div>
                    )}

                    {topupMethod === 'retail' && retailEnabled && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-bold text-gray-700">Pilih Gerai</p>
                        <div className="grid grid-cols-2 gap-2">
                          {retailOutlets.map((outlet) => (
                            <button
                              type="button"
                              key={outlet.code}
                              onClick={() => { setTopupRetail(outlet.code); topupIdemRef.current = null; setPendingPayment(null); }}
                              className={`py-3 px-3 rounded-xl border text-xs font-extrabold transition-all ${topupRetail === outlet.code ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-primary-400'}`}
                            >
                              {outlet.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {topupMethod === 'manual_transfer' && (
                      <div className="space-y-2 pt-2">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => setManualProof(e.target.files?.[0] || null)}
                          className="w-full text-xs"
                        />
                        <input
                          className="w-full px-3 py-2 rounded-xl border text-sm"
                          placeholder="Catatan (opsional)"
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={topupSubmitting || loading}
                    className="w-full disabled:opacity-60"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{topupSubmitting ? 'Memproses...' : 'Konfirmasi & Bayar Sekarang'}</span>
                  </Button>
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
                className="dashboard-panel space-y-6"
              >
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Transfer Uang</h4>
                  <p className="text-xs text-gray-500 mt-1">Kirim uang langsung ke rekening bank se-Indonesia atau ke sesama pengguna GurkyNet secara instan.</p>
                </div>

                <div className="dashboard-segment-tabs">
                  <button
                    type="button"
                    onClick={() => setTransferType('p2p')}
                    className={`dashboard-segment-tab ${transferType === 'p2p' ? 'dashboard-segment-tab-active' : ''}`}
                  >
                    Transfer Sesama GurkyPay
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('bank')}
                    className={`dashboard-segment-tab ${transferType === 'bank' ? 'dashboard-segment-tab-active' : ''}`}
                  >
                    Kirim ke Rekening Bank
                  </button>
                </div>

                {transferType === 'bank' && (
                  <div className="auth-info-box text-[11px]">
                    Transfer bank langsung belum tersedia. Gunakan <strong>Tarik Dana</strong> untuk penarikan ke rekening, atau pilih Transfer Sesama GurkyPay.
                  </div>
                )}

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  {transferType === 'bank' && (
                    <div className="space-y-1.5">
                      <label className="auth-label">Pilih Bank Tujuan</label>
                      <div className="auth-input-icon-wrap">
                        <div className="auth-input-icon"><Building2 className="w-5 h-5" /></div>
                        <select 
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          className="auth-input pl-10 py-3 font-bold appearance-none"
                        >
                          <option value="BCA">Bank Central Asia (BCA)</option>
                          <option value="MANDIRI">Bank Mandiri</option>
                          <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                          <option value="BNI">Bank Negara Indonesia (BNI)</option>
                          <option value="CIMB">CIMB Niaga</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="auth-label">
                      {transferType === 'bank' ? 'Nomor Rekening Tujuan' : 'Nomor Handphone / ID Wallet Tujuan'}
                    </label>
                    <div className="auth-input-icon-wrap">
                      <div className="auth-input-icon"><Smartphone className="w-5 h-5" /></div>
                      <input 
                        type="text"
                        placeholder={transferType === 'bank' ? 'Contoh: 84019234812' : 'Contoh: GK-081234567890'}
                        value={targetAccount}
                        onChange={(e) => setTargetAccount(e.target.value)}
                        className="auth-input pl-10 py-3 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="auth-label">Nominal Transfer</label>
                    <div className="auth-input-icon-wrap">
                      <div className="auth-input-icon"><DollarSign className="w-5 h-5" /></div>
                      <input 
                        type="number"
                        placeholder="Minimal Rp 10.000"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="auth-input pl-10 py-3 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="auth-label">Catatan Transfer (Opsional)</label>
                    <input 
                      type="text"
                      placeholder="Contoh: Bayar Uang Makan, Arisan, dll."
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      className="auth-input px-4 py-3 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="auth-label">PIN Transaksi</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 digit PIN"
                      value={transferPin}
                      onChange={(e) => setTransferPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="auth-input px-4 py-3 font-bold tracking-widest"
                    />
                  </div>

                  <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4 space-y-3">
                    <div className="flex items-start gap-2 text-[11px] text-primary-900">
                      <AlertCircle className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                      <p className="leading-snug">Pastikan nomor wallet dan nominal transfer Anda sudah benar sebelum menekan tombol kirim.</p>
                    </div>
                    <Button type="submit" variant="primary" className="w-full">
                      <Send className="w-4 h-4" />
                      <span>Kirim Transfer Sekarang</span>
                    </Button>
                  </div>
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
                className="dashboard-panel space-y-6"
              >
                {!withdrawEnabled ? (
                  <div className="rounded-2xl border border-accent-400/40 bg-accent-300/20 px-4 py-6 text-sm text-primary-900">
                    <p className="font-extrabold text-base mb-1">Segera Hadir</p>
                    <p>{featureFlags.messages.withdraw}</p>
                  </div>
                ) : (
                <>
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

                  <Button type="submit" variant="primary" className="w-full">
                    <CreditCard className="w-4 h-4" />
                    <span>Tarik Dana Sekarang</span>
                  </Button>
                </form>
                </>
                )}
              </motion.div>
            )}

          </AnimatePresence>

      <PaymentPlaceholderModal
        open={paymentModalOpen}
        kind={paymentModalKind}
        amount={paymentModalAmount}
        onClose={() => setPaymentModalOpen(false)}
      />

    </div>
  );
};
